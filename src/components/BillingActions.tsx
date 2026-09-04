"use client";

import { useState } from "react";

type Endpoint = "/api/stripe/checkout" | "/api/stripe/portal";

/**
 * Posts to a Stripe route and follows the URL it returns.
 *
 * The session is always created on the server, so the price and the customer
 * cannot be swapped out from the browser.
 */
function useStripeRedirect(endpoint: Endpoint) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(endpoint, { method: "POST" });
      const body: { url?: string; error?: string } = await response.json();

      if (!response.ok || !body.url) {
        setError(body.error ?? "Something went wrong. Please try again.");
        setPending(false);
        return;
      }

      window.location.href = body.url;
    } catch {
      setError("Could not reach Stripe. Please try again.");
      setPending(false);
    }
  };

  return { go, pending, error };
}

export function UpgradeButton() {
  const { go, pending, error } = useStripeRedirect("/api/stripe/checkout");

  return (
    <div>
      <button
        type="button"
        onClick={go}
        disabled={pending}
        className="bg-ink rounded-md px-4 py-2.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Redirecting to Stripe..." : "Upgrade to Pro"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function ManageBillingButton() {
  const { go, pending, error } = useStripeRedirect("/api/stripe/portal");

  return (
    <div>
      <button
        type="button"
        onClick={go}
        disabled={pending}
        className="border-line hover:bg-canvas rounded-md border px-4 py-2.5 text-sm disabled:opacity-50"
      >
        {pending ? "Opening..." : "Manage subscription"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
