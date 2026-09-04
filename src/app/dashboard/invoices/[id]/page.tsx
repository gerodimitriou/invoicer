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
  await requireProfile();

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
      <Link href="/dashboard" className="text-sm text-muted hover:text-ink">
        &larr; Invoices
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-medium tracking-tight">
            {invoice.invoice_number}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Issued {formatDate(invoice.issue_date)}
            {invoice.due_date ? ` - due ${formatDate(invoice.due_date)}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-line bg-surface p-6 sm:p-8">
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <h2 className="text-xs tracking-wide text-muted uppercase">From</h2>
            <p className="mt-2 font-medium">{invoice.business_name}</p>
            {invoice.business_email && (
              <p className="text-sm text-muted">{invoice.business_email}</p>
            )}
            {invoice.business_address && (
              <p className="mt-1 text-sm whitespace-pre-line text-muted">
                {invoice.business_address}
              </p>
            )}
          </div>
          <div>
            <h2 className="text-xs tracking-wide text-muted uppercase">Bill to</h2>
            <p className="mt-2 font-medium">{invoice.client_name}</p>
            {invoice.client_email && (
              <p className="text-sm text-muted">{invoice.client_email}</p>
            )}
            {invoice.client_address && (
              <p className="mt-1 text-sm whitespace-pre-line text-muted">
                {invoice.client_address}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[460px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 font-normal">Description</th>
                <th className="w-20 py-2 text-right font-normal">Qty</th>
                <th className="w-28 py-2 text-right font-normal">Unit price</th>
                <th className="w-28 py-2 text-right font-normal">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.line_items.map((item, index) => (
                <tr key={index} className="border-b border-line last:border-0">
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
          <div className="flex justify-between border-t border-line pt-1.5 text-base font-medium">
            <dt>Total</dt>
            <dd className="tabular-nums">
              {formatMoney(invoice.total, invoice.currency)}
            </dd>
          </div>
        </dl>

        {invoice.notes && (
          <div className="mt-8 border-t border-line pt-6">
            <h2 className="text-xs tracking-wide text-muted uppercase">Notes</h2>
            <p className="mt-2 text-sm whitespace-pre-line text-muted">{invoice.notes}</p>
          </div>
        )}
      </div>

      <form action={deleteInvoice} className="mt-6">
        <input type="hidden" name="id" value={invoice.id} />
        <button type="submit" className="text-sm text-muted hover:text-red-600">
          Delete invoice
        </button>
      </form>
    </div>
  );
}
