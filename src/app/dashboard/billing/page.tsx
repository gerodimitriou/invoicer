import { requireProfile } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { UpgradeButton, ManageBillingButton } from "@/components/BillingActions";

export const metadata = { title: "Billing - Invoicer" };

// Always read the current plan on request. After returning from Stripe the
// webhook may have only just landed, so a cached page would show a stale plan.
export const dynamic = "force-dynamic";

const proFeatures = [
  "Clean PDF exports with no watermark",
  "Unlimited invoices, same as free",
  "Cancel any time from the billing portal",
];

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  const profile = await requireProfile();
  const isPro = profile.plan === "pro";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-medium tracking-tight">Billing</h1>

      {checkout === "success" && !isPro && (
        <p className="border-line bg-surface mt-4 rounded-md border px-4 py-3 text-sm">
          Payment received. Stripe is confirming it now, so give this page a refresh in a
          moment.
        </p>
      )}
      {checkout === "cancelled" && (
        <p className="border-line bg-surface text-muted mt-4 rounded-md border px-4 py-3 text-sm">
          Checkout cancelled. You have not been charged.
        </p>
      )}

      <div className="border-line bg-surface mt-8 rounded-lg border p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-sm font-medium">
              {isPro ? "You are on Pro" : "You are on the free plan"}
            </h2>
            <p className="text-muted mt-1 text-sm">
              {isPro
                ? profile.current_period_end
                  ? `Renews on ${formatDate(profile.current_period_end)}.`
                  : "Your subscription is active."
                : "PDF exports carry a watermark until you upgrade."}
            </p>
          </div>
          <p className="text-muted text-sm whitespace-nowrap">
            {isPro ? "EUR 9 / month" : "EUR 0"}
          </p>
        </div>

        {!isPro && (
          <ul className="border-line text-muted mt-6 space-y-2 border-t pt-6 text-sm">
            {proFeatures.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        )}

        <div className="mt-6">{isPro ? <ManageBillingButton /> : <UpgradeButton />}</div>
      </div>

      <p className="text-muted mt-6 text-sm">
        This project runs in Stripe test mode. Use card 4242 4242 4242 4242 with any
        future expiry and any CVC.
      </p>
    </div>
  );
}
