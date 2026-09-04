import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { publicEnv, serverEnv } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Starts a Stripe Checkout session for the Pro subscription and returns its
 * URL for the browser to redirect to.
 *
 * Note what this route does not do: it does not touch the user's plan. A
 * started checkout is not a paid subscription, and the user can abandon the
 * page or the card can be declined. The plan is only ever set from the webhook
 * once Stripe confirms the payment.
 */
export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (profile.plan === "pro") {
    return NextResponse.json({ error: "Already subscribed" }, { status: 409 });
  }

  const stripe = getStripe();

  // Reuse the customer if this user has subscribed before, so cancelling and
  // resubscribing does not scatter duplicate customers across the account.
  let customerId = profile.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;

    // Written with the admin client because profiles is deliberately not
    // writable by users. Saving it now means the webhook can find this user
    // even if the customer.subscription.created event arrives first.
    await createAdminClient()
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: serverEnv.stripeProPriceId, quantity: 1 }],
    success_url: `${publicEnv.siteUrl}/dashboard/billing?checkout=success`,
    cancel_url: `${publicEnv.siteUrl}/dashboard/billing?checkout=cancelled`,
    // Both of these are echoed back on the webhook event. client_reference_id
    // is the documented place for your own user id, and the metadata gives the
    // subscription itself a link back to the user.
    client_reference_id: user.id,
    subscription_data: { metadata: { supabase_user_id: user.id } },
    allow_promotion_codes: true,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
