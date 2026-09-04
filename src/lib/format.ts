/** Formatting helpers shared by the UI. The PDF does its own formatting
 *  because pdf-lib only embeds Latin-1 glyphs by default. */

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    // Postgres numeric can arrive as a string depending on the driver, so
    // coerce before formatting.
  }).format(Number(amount));
}

export function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
