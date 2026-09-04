import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length > 0 ? value : null));

/** Optional email fields arrive as "" from an untouched input, which is not a
 *  validation error - it just means the field was left blank. */
const optionalEmail = z
  .union([z.literal(""), z.email("Enter a valid email address").max(200)])
  .transform((value) => (value.length > 0 ? value : null));

export const lineItemSchema = z.object({
  description: z.string().trim().min(1, "Every line needs a description").max(200),
  quantity: z.coerce.number().positive("Quantity must be greater than 0").max(100_000),
  unit_price: z.coerce.number().min(0, "Price cannot be negative").max(1_000_000),
});

/** What the invoice form is allowed to send. Totals are not in here on
 *  purpose - the server recalculates them from the line items. */
export const invoiceInputSchema = z.object({
  invoice_number: z.string().trim().min(1, "Invoice number is required").max(50),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid issue date"),
  due_date: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: "Invalid due date",
    })
    .transform((value) => (value.length > 0 ? value : null)),
  currency: z.enum(["EUR", "USD", "GBP"]),

  business_name: z.string().trim().min(1, "Your business name is required").max(120),
  business_email: optionalEmail,
  business_address: optionalText(400),

  client_name: z.string().trim().min(1, "Client name is required").max(120),
  client_email: optionalEmail,
  client_address: optionalText(400),

  line_items: z.array(lineItemSchema).min(1, "Add at least one line item").max(50),
  tax_rate: z.coerce.number().min(0).max(100),
  notes: optionalText(1000),
});

export type InvoiceInput = z.infer<typeof invoiceInputSchema>;
