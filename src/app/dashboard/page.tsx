import { requireProfile } from "@/lib/auth";

export default async function DashboardPage() {
  const profile = await requireProfile();

  return (
    <div>
      <h1 className="text-2xl font-medium tracking-tight">Invoices</h1>
      <p className="mt-2 text-sm text-muted">Signed in as {profile.email}.</p>
    </div>
  );
}
