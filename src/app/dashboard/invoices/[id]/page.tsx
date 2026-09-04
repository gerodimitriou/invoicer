import Link from "next/link";
import { notFound } from "next/navigation";

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import { deleteInvoice } from "../actions";
import type { Invoice } from "@/types/database";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();

  const supabase = await createClient();
  // Row level security scopes this to the signed in user, so an id belonging
  // to someone else comes back empty and renders a 404.
  const { data } = await supabase.from("invoices").select("*").eq("id", id).single();

  if (!data) {
    notFound();
  }

  const invoice: Invoice = data;

  return (
    <div>
      <Link href="/dashboard" className="text-muted hover:text-ink text-sm">
        &larr; Invoices
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-medium tracking-tight">
            {invoice.invoice_number}
          </h1>
          <p className="text-muted mt-1 text-sm">
            Issued {formatDate(invoice.issue_date)}
            {invoice.due_date ? ` - due ${formatDate(invoice.due_date)}` : ""}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <a
            href={`/api/invoices/${invoice.id}/pdf`}
            className="bg-ink rounded-md px-4 py-2 text-sm text-white hover:opacity-90"
          >
            Download PDF
          </a>
          {profile.plan === "free" && (
            <p className="text-muted text-xs">
              Free plan PDFs are watermarked.{" "}
              <Link
                href="/dashboard/billing"
                className="text-ink underline underline-offset-2"
              >
                Upgrade
              </Link>
            </p>
          )}
        </div>
      </div>

      <div className="border-line bg-surface mt-8 rounded-lg border p-6 sm:p-8">
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <h2 className="text-muted text-xs tracking-wide uppercase">From</h2>
            <p className="mt-2 font-medium">{invoice.business_name}</p>
            {invoice.business_email && (
              <p className="text-muted text-sm">{invoice.business_email}</p>
            )}
            {invoice.business_address && (
              <p className="text-muted mt-1 text-sm whitespace-pre-line">
                {invoice.business_address}
              </p>
            )}
          </div>
          <div>
            <h2 className="text-muted text-xs tracking-wide uppercase">Bill to</h2>
            <p className="mt-2 font-medium">{invoice.client_name}</p>
            {invoice.client_email && (
              <p className="text-muted text-sm">{invoice.client_email}</p>
            )}
            {invoice.client_address && (
              <p className="text-muted mt-1 text-sm whitespace-pre-line">
                {invoice.client_address}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[460px] text-sm">
            <thead>
              <tr className="border-line text-muted border-b text-left text-xs">
                <th className="py-2 font-normal">Description</th>
                <th className="w-20 py-2 text-right font-normal">Qty</th>
                <th className="w-28 py-2 text-right font-normal">Unit price</th>
                <th className="w-28 py-2 text-right font-normal">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.line_items.map((item, index) => (
                <tr key={index} className="border-line border-b last:border-0">
                  <td className="py-2.5">{item.description}</td>
                  <td className="py-2.5 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-2.5 text-right tabular-nums">
                    {formatMoney(item.unit_price, invoice.currency)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {formatMoney(item.quantity * item.unit_price, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="mt-6 ml-auto max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="tabular-nums">
              {formatMoney(invoice.subtotal, invoice.currency)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Tax ({invoice.tax_rate}%)</dt>
            <dd className="tabular-nums">
              {formatMoney(invoice.tax_amount, invoice.currency)}
            </dd>
          </div>
          <div className="border-line flex justify-between border-t pt-1.5 text-base font-medium">
            <dt>Total</dt>
            <dd className="tabular-nums">
              {formatMoney(invoice.total, invoice.currency)}
            </dd>
          </div>
        </dl>

        {invoice.notes && (
          <div className="border-line mt-8 border-t pt-6">
            <h2 className="text-muted text-xs tracking-wide uppercase">Notes</h2>
            <p className="text-muted mt-2 text-sm whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}
      </div>

      <form action={deleteInvoice} className="mt-6">
        <input type="hidden" name="id" value={invoice.id} />
        <button type="submit" className="text-muted text-sm hover:text-red-600">
          Delete invoice
        </button>
      </form>
    </div>
  );
}
