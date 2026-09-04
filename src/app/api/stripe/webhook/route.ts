import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { currentPeriodEnd, planForStatus } from "@/lib/stripe/plan";
import { serverEnv } from "@/lib/env";

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
 * Writes the current state of a Stripe subscription onto the matching profile.
 *
 * The subscription is re-fetched from Stripe rather than read out of the event
 * payload. Webhook deliveries are not ordered, so an "updated" event can arrive
 * after a "deleted" one for the same subscription. Asking Stripe for the
 * current state means we always store the latest truth instead of whichever
 * event happened to land last.
 */
async function syncSubscription(subscriptionId: string, userIdHint?: string | null) {
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const customerId = idOf(subscription.customer);
  // Set when the checkout session or the subscription was created by this app.
  const userId = userIdHint ?? subscription.metadata?.supabase_user_id ?? null;

  const admin = createAdminClient();

  const update = {
    plan: planForStatus(subscription.status),
    stripe_subscription_id: subscription.id,
    current_period_end: currentPeriodEnd(subscription),
    ...(customerId ? { stripe_customer_id: customerId } : {}),
  };

  // Prefer the user id we put in metadata. Fall back to the customer id for
  // subscriptions created outside this app, for example straight from the
  // Stripe dashboard.
  const query = admin.from("profiles").update(update);
  const { data, error } = userId
    ? await query.eq("id", userId).select("id")
    : await query.eq("stripe_customer_id", customerId ?? "").select("id");

  if (error) {
    throw new Error(`Failed to update profile: ${error.message}`);
  }

  if (!data || data.length === 0) {
    // Not an error worth retrying: the subscription belongs to a Stripe
    // customer with no profile in this database.
    console.warn(
      `[stripe] no profile matched subscription ${subscription.id} (customer ${customerId})`,
    );
    return;
  }

  console.log(
    `[stripe] ${subscription.id} is ${subscription.status}, set plan to ${update.plan}`,
  );
}

async function handleEvent(event: Stripe.Event & { type: HandledEvent }) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const subscriptionId = idOf(session.subscription);

      // Ignore one-off payments; this app only sells the subscription.
      if (session.mode !== "subscription" || !subscriptionId) return;

      await syncSubscription(subscriptionId, session.client_reference_id);
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    // A deleted subscription still reads back from Stripe with status
    // "canceled", which maps to the free plan, so it needs no special case.
    case "customer.subscription.deleted": {
      await syncSubscription(event.data.object.id);
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
