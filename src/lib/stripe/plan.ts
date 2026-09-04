import type Stripe from "stripe";

import type { Plan } from "@/types/database";

/**
 * Maps a Stripe subscription status onto the plan stored on the profile.
 *
 * Only `active` and `trialing` count as paid. Everything else, including
 * `past_due` and `unpaid`, falls back to free: if a renewal payment fails, the
 * user should lose the Pro feature until it is fixed. Stripe retries failed
 * payments on its own and sends another `customer.subscription.updated` when
 * the status changes, which puts them back on Pro without any work here.
 */
export function planForStatus(status: Stripe.Subscription.Status): Plan {
  return status === "active" || status === "trialing" ? "pro" : "free";
}

/**
 * The end of the current billing period.
 *
 * As of API version 2025-03-31 Stripe moved `current_period_end` off the
 * subscription and onto each subscription item, because different items can
 * bill on different cycles. There is only ever one item here, so read it from
 * the first one.
 */
export function currentPeriodEnd(subscription: Stripe.Subscription): string | null {
  const periodEnd = subscription.items.data[0]?.current_period_end;
  return periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
}
