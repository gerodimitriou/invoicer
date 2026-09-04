import Stripe from "stripe";

import { serverEnv } from "@/lib/env";

let cached: Stripe | null = null;

/**
 * The Stripe SDK, created on first use.
 *
 * It is not built at module load because that would read STRIPE_SECRET_KEY
 * during the build, and the project is meant to build without a populated
 * .env.local.
 */
export function getStripe(): Stripe {
  if (!cached) {
    cached = new Stripe(serverEnv.stripeSecretKey, {
      // Pinning the API version means a future Stripe release cannot change
      // the shape of the webhook payloads this code parses.
      apiVersion: "2026-08-26.dahlia",
      appInfo: { name: "Invoicer", version: "0.1.0" },
    });
  }

  return cached;
}
