import Link from "next/link";

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InvoiceForm } from "@/components/InvoiceForm";

export const metadata = { title: "New invoice - Invoicer" };

/** Suggests the next number in a simple INV-0001 sequence, based on how many
 *  invoices the user already has. They can overwrite it. */
async function suggestInvoiceNumber(userId: string): Promise<string> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return `INV-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

export default async function NewInvoicePage() {
  const profile = await requireProfile();
  const invoiceNumber = await suggestInvoiceNumber(profile.id);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <Link href="/dashboard" className="text-muted hover:text-ink text-sm">
        &larr; Invoices
      </Link>
      <h1 className="mt-3 text-2xl font-medium tracking-tight">New invoice</h1>

      <div className="mt-8">
        <InvoiceForm defaultInvoiceNumber={invoiceNumber} today={today} />
      </div>
    </div>
  );
}
