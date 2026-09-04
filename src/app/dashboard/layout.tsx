import Link from "next/link";

import { requireProfile } from "@/lib/auth";
import { PlanBadge } from "@/components/PlanBadge";
import { SignOutButton } from "@/components/SignOutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="font-mono text-sm tracking-tight">
              invoicer
            </Link>
            <PlanBadge plan={profile.plan} />
          </div>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/dashboard" className="text-muted hover:text-ink">
              Invoices
            </Link>
            <Link href="/dashboard/billing" className="text-muted hover:text-ink">
              Billing
            </Link>
            <SignOutButton />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
