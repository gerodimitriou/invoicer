import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { currentPeriodEnd, planForStatus } from "@/lib/stripe/plan";
import { serverEnv } from "@/lib/env";
import type { Plan } from "@/types/database";

// Signature verification needs the raw body and Node's crypto, so this handler
// cannot run on the edge runtime.
export const runtime = "nodejs";

/** Events worth acting on. Stripe sends plenty more; the rest are ignored. */
const HANDLED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
] as const;

type HandledEvent = (typeof HANDLED_EVENTS)[number];

function isHandled(type: string): type is HandledEvent {
  return (HANDLED_EVENTS as readonly string[]).includes(type);
}

function idOf(value: string | { id: string } | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * Recomputes a user's plan from everything Stripe currently knows about that
 * customer, and writes the result to their profile.
 *
 * It deliberately works off the customer rather than off the subscription in
 * the event. Webhook deliveries are not ordered, and a customer accumulates
 * subscription records over time: cancelling and resubscribing leaves the old
 * cancelled one behind alongside a new active one. Acting on a single
 * subscription means a late "deleted" event for the old one would downgrade
 * someone who is currently paying. Asking Stripe for all of them and checking
 * whether any is active makes the outcome the same whatever order the events
 * turn up in.
 */
async function syncCustomer(customerId: string, userIdHint?: string | null) {
  const stripe = getStripe();

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  });

  // Stripe returns these newest first.
  const granting = subscriptions.data.find(
    (subscription) => planForStatus(subscription.status) === "pro",
  );
  const current = granting ?? subscriptions.data[0] ?? null;
  const plan: Plan = granting ? "pro" : "free";

  const userId = userIdHint ?? current?.metadata?.supabase_user_id ?? null;

  const admin = createAdminClient();

  const update = {
    plan,
    stripe_customer_id: customerId,
    stripe_subscription_id: current?.id ?? null,
    current_period_end: granting ? currentPeriodEnd(granting) : null,
  };

  // Prefer the user id we put in metadata. Fall back to the customer id for
  // subscriptions created outside this app, for example straight from the
  // Stripe dashboard.
  const query = admin.from("profiles").update(update);
  const { data, error } = userId
    ? await query.eq("id", userId).select("id")
    : await query.eq("stripe_customer_id", customerId).select("id");

  if (error) {
    throw new Error(`Failed to update profile: ${error.message}`);
  }

  if (!data || data.length === 0) {
    // Not worth retrying: this Stripe customer has no profile in this database.
    console.warn(`[stripe] no profile matched customer ${customerId}`);
    return;
  }

  console.log(
    `[stripe] customer ${customerId} has ${subscriptions.data.length} subscription(s), set plan to ${plan}`,
  );
}

async function handleEvent(event: Stripe.Event & { type: HandledEvent }) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;

      // Ignore one-off payments; this app only sells the subscription.
      if (session.mode !== "subscription") return;

      const customerId = idOf(session.customer);
      if (!customerId) return;

      await syncCustomer(customerId, session.client_reference_id);
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const customerId = idOf(event.data.object.customer);
      if (!customerId) return;

      await syncCustomer(customerId);
      return;
    }
  }
}

/**
 * Stripe webhook endpoint. This is the only place a user's plan is ever
 * written.
 *
 * Doing it here rather than on the checkout success page is the whole point.
 * The success page is just a redirect the browser can be pointed at directly,
 * and it says nothing about whether the card actually cleared. A webhook comes
 * from Stripe, is signed with a secret only the server holds, and arrives
 * after the payment is confirmed. It is also the only way to hear about things
 * that happen with no browser involved at all: a cancellation from the billing
 * portal, or a renewal payment failing next month.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return new NextResponse("Missing stripe-signature header", { status: 400 });
  }

  // The exact bytes Stripe sent. Parsing to JSON first would change the
  // formatting and the signature would no longer match.
  const rawBody = await request.text();

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      serverEnv.stripeWebhookSecret,
    );
  } catch (error) {
    // Either the secret is wrong or the request did not come from Stripe.
    console.error("[stripe] signature verification failed:", error);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  if (!isHandled(event.type)) {
    return NextResponse.json({ received: true, handled: false });
  }

  const admin = createAdminClient();

  // Claim the event before doing any work. Stripe delivers at least once, and
  // the CLI can replay events by hand, so the same id can arrive twice. The
  // primary key on stripe_events makes the second insert fail, and that is the
  // signal to skip it.
  const { error: claimError } = await admin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });

  if (claimError) {
    if (claimError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // The database is unreachable. Return 500 so Stripe retries rather than
    // dropping the event.
    console.error("[stripe] could not record event:", claimError);
    return new NextResponse("Could not record event", { status: 500 });
  }

  try {
    await handleEvent(event as Stripe.Event & { type: HandledEvent });
  } catch (error) {
    // Release the claim, otherwise Stripe's retry would be treated as a
    // duplicate and the event would never be applied.
    await admin.from("stripe_events").delete().eq("id", event.id);

    console.error(`[stripe] handler failed for ${event.type}:`, error);
    return new NextResponse("Webhook handler failed", { status: 500 });
  }

  return NextResponse.json({ received: true });
}
