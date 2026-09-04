import type { LineItem } from "@/types/database";

export type Totals = {
  subtotal: number;
  taxAmount: number;
  total: number;
};

/**
 * Money is added up in integer cents and only converted back at the end.
 * Doing it in floats gives you 0.1 + 0.2 = 0.30000000000000004 on an invoice,
 * which is the kind of thing a client notices.
 */
export function calculateTotals(lineItems: LineItem[], taxRate: number): Totals {
  const subtotalInCents = lineItems.reduce((sum, item) => {
    const unitPriceInCents = Math.round(item.unit_price * 100);
    return sum + Math.round(unitPriceInCents * item.quantity);
  }, 0);

  const taxInCents = Math.round((subtotalInCents * taxRate) / 100);

  return {
    subtotal: subtotalInCents / 100,
    taxAmount: taxInCents / 100,
    total: (subtotalInCents + taxInCents) / 100,
  };
}
