import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";
import { publicEnv } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Sends the user to Stripe's billing portal, which is where cancelling,
 * updating a card and viewing past invoices happen.
 *
 * Cancelling there does not change anything in this database directly. Stripe
 * sends customer.subscription.updated or .deleted afterwards, and the webhook
 * handler is what moves the user back to the free plan.
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
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: "No Stripe customer yet" }, { status: 400 });
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${publicEnv.siteUrl}/dashboard/billing`,
  });

  return NextResponse.json({ url: session.url });
}
