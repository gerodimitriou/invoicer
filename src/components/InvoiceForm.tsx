"use client";

import { useActionState, useState } from "react";

import { createInvoice, type InvoiceFormState } from "@/app/dashboard/invoices/actions";
import { calculateTotals } from "@/lib/invoices/totals";
import { formatMoney } from "@/lib/format";

type Row = { key: number; description: string; quantity: string; unit_price: string };

const emptyRow = (key: number): Row => ({
  key,
  description: "",
  quantity: "1",
  unit_price: "",
});

const inputClass =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent";

const labelClass = "block text-sm font-medium";

export function InvoiceForm({
  defaultInvoiceNumber,
  today,
}: {
  defaultInvoiceNumber: string;
  today: string;
}) {
  const [state, formAction, pending] = useActionState<InvoiceFormState, FormData>(
    createInvoice,
    null,
  );
  const [rows, setRows] = useState<Row[]>([emptyRow(0)]);
  const [taxRate, setTaxRate] = useState("0");
  const [currency, setCurrency] = useState("EUR");

  const updateRow = (key: number, patch: Partial<Row>) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );

  const addRow = () =>
    setRows((current) => [
      ...current,
      emptyRow(Math.max(...current.map((row) => row.key)) + 1),
    ]);

  const removeRow = (key: number) =>
    setRows((current) =>
      current.length === 1 ? current : current.filter((row) => row.key !== key),
    );

  // Preview only. The server recalculates these from the submitted line items
  // and stores its own result.
  const totals = calculateTotals(
    rows.map((row) => ({
      description: row.description,
      quantity: Number(row.quantity) || 0,
      unit_price: Number(row.unit_price) || 0,
    })),
    Number(taxRate) || 0,
  );

  return (
    <form action={formAction} className="space-y-10">
      <section className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="invoice_number" className={labelClass}>
            Invoice number
          </label>
          <input
            id="invoice_number"
            name="invoice_number"
            defaultValue={defaultInvoiceNumber}
            required
            className={`mt-1.5 ${inputClass}`}
          />
        </div>
        <div>
          <label htmlFor="issue_date" className={labelClass}>
            Issue date
          </label>
          <input
            id="issue_date"
            name="issue_date"
            type="date"
            defaultValue={today}
            required
            className={`mt-1.5 ${inputClass}`}
          />
        </div>
        <div>
          <label htmlFor="due_date" className={labelClass}>
            Due date <span className="text-muted font-normal">(optional)</span>
          </label>
          <input
            id="due_date"
            name="due_date"
            type="date"
            className={`mt-1.5 ${inputClass}`}
          />
        </div>
      </section>

      <section className="grid gap-8 sm:grid-cols-2">
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium">From</legend>
          <div>
            <label htmlFor="business_name" className="sr-only">
              Your business name
            </label>
            <input
              id="business_name"
              name="business_name"
              placeholder="Your business name"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="business_email" className="sr-only">
              Your email
            </label>
            <input
              id="business_email"
              name="business_email"
              type="email"
              placeholder="you@example.com"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="business_address" className="sr-only">
              Your address
            </label>
            <textarea
              id="business_address"
              name="business_address"
              rows={3}
              placeholder="Address, VAT number, anything else"
              className={inputClass}
            />
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-medium">Bill to</legend>
          <div>
            <label htmlFor="client_name" className="sr-only">
              Client name
            </label>
            <input
              id="client_name"
              name="client_name"
              placeholder="Client name"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="client_email" className="sr-only">
              Client email
            </label>
            <input
              id="client_email"
              name="client_email"
              type="email"
              placeholder="client@example.com"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="client_address" className="sr-only">
              Client address
            </label>
            <textarea
              id="client_address"
              name="client_address"
              rows={3}
              placeholder="Client address"
              className={inputClass}
            />
          </div>
        </fieldset>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Line items</h2>
          <button
            type="button"
            onClick={addRow}
            className="border-line hover:bg-surface rounded-md border px-3 py-1.5 text-sm"
          >
            Add line
          </button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-y-2">
            <thead>
              <tr className="text-muted text-left text-xs">
                <th className="font-normal">Description</th>
                <th className="w-24 font-normal">Qty</th>
                <th className="w-32 font-normal">Unit price</th>
                <th className="w-28 text-right font-normal">Amount</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const amount =
                  (Number(row.quantity) || 0) * (Number(row.unit_price) || 0);
                return (
                  <tr key={row.key}>
                    <td className="pr-2">
                      <input
                        name="description"
                        value={row.description}
                        onChange={(event) =>
                          updateRow(row.key, { description: event.target.value })
                        }
                        placeholder="What are you charging for?"
                        required
                        aria-label="Description"
                        className={inputClass}
                      />
                    </td>
                    <td className="pr-2">
                      <input
                        name="quantity"
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.quantity}
                        onChange={(event) =>
                          updateRow(row.key, { quantity: event.target.value })
                        }
                        required
                        aria-label="Quantity"
                        className={inputClass}
                      />
                    </td>
                    <td className="pr-2">
                      <input
                        name="unit_price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.unit_price}
                        onChange={(event) =>
                          updateRow(row.key, { unit_price: event.target.value })
                        }
                        placeholder="0.00"
                        required
                        aria-label="Unit price"
                        className={inputClass}
                      />
                    </td>
                    <td className="pr-2 text-right text-sm tabular-nums">
                      {formatMoney(amount, currency)}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(row.key)}
                        disabled={rows.length === 1}
                        aria-label="Remove line"
                        className="text-muted hover:text-ink px-2 disabled:opacity-30"
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-8 sm:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label htmlFor="notes" className={labelClass}>
              Notes <span className="text-muted font-normal">(optional)</span>
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Payment terms, bank details, thanks for your business"
              className={`mt-1.5 ${inputClass}`}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="currency" className={labelClass}>
                Currency
              </label>
              <select
                id="currency"
                name="currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                className={`mt-1.5 ${inputClass}`}
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div>
              <label htmlFor="tax_rate" className={labelClass}>
                Tax rate %
              </label>
              <input
                id="tax_rate"
                name="tax_rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={taxRate}
                onChange={(event) => setTaxRate(event.target.value)}
                className={`mt-1.5 ${inputClass}`}
              />
            </div>
          </div>

          <dl className="border-line bg-surface space-y-1.5 rounded-lg border p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tabular-nums">{formatMoney(totals.subtotal, currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Tax</dt>
              <dd className="tabular-nums">{formatMoney(totals.taxAmount, currency)}</dd>
            </div>
            <div className="border-line flex justify-between border-t pt-1.5 font-medium">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatMoney(totals.total, currency)}</dd>
            </div>
          </dl>
        </div>
      </section>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-ink rounded-md px-4 py-2.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save invoice"}
        </button>
        <span className="text-muted text-sm">You can download the PDF next.</span>
      </div>
    </form>
  );
}
