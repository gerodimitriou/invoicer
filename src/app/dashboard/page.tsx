import Link from "next/link";

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import type { Invoice } from "@/types/database";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("invoices")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  const invoices: Invoice[] = data ?? [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium tracking-tight">Invoices</h1>
        <Link
          href="/dashboard/invoices/new"
          className="bg-ink rounded-md px-4 py-2 text-sm text-white hover:opacity-90"
        >
          New invoice
        </Link>
      </div>

      {invoices.length === 0 ? (
        <div className="border-line mt-10 rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted text-sm">
            No invoices yet. Create your first one to get a PDF.
          </p>
        </div>
      ) : (
        <div className="border-line bg-surface mt-8 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[540px] text-sm">
            <thead>
              <tr className="border-line text-muted border-b text-left text-xs">
                <th className="px-4 py-3 font-normal">Number</th>
                <th className="px-4 py-3 font-normal">Client</th>
                <th className="px-4 py-3 font-normal">Issued</th>
                <th className="px-4 py-3 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-line border-b last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/invoices/${invoice.id}`}
                      className="font-mono hover:underline"
                    >
                      {invoice.invoice_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{invoice.client_name}</td>
                  <td className="text-muted px-4 py-3">
                    {formatDate(invoice.issue_date)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(invoice.total, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
