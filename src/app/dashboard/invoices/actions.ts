"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { invoiceInputSchema } from "@/lib/invoices/schema";
import { calculateTotals } from "@/lib/invoices/totals";

export type InvoiceFormState = { error: string } | null;

/**
 * Line items are submitted as three parallel lists of inputs, which is what a
 * plain HTML form gives us for repeated fields. Zip them back into objects
 * before validating.
 */
function readLineItems(formData: FormData) {
  const descriptions = formData.getAll("description");
  const quantities = formData.getAll("quantity");
  const unitPrices = formData.getAll("unit_price");

  return descriptions.map((description, index) => ({
    description: String(description),
    quantity: String(quantities[index] ?? ""),
    unit_price: String(unitPrices[index] ?? ""),
  }));
}

export async function createInvoice(
  _prev: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const parsed = invoiceInputSchema.safeParse({
    invoice_number: formData.get("invoice_number"),
    issue_date: formData.get("issue_date"),
    due_date: formData.get("due_date") ?? "",
    currency: formData.get("currency"),
    business_name: formData.get("business_name"),
    business_email: formData.get("business_email") ?? "",
    business_address: formData.get("business_address") ?? "",
    client_name: formData.get("client_name"),
    client_email: formData.get("client_email") ?? "",
    client_address: formData.get("client_address") ?? "",
    line_items: readLineItems(formData),
    tax_rate: formData.get("tax_rate") ?? 0,
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const input = parsed.data;
  // Totals come from the server, never from the form, so a tampered request
  // cannot save an invoice whose total disagrees with its line items.
  const totals = calculateTotals(input.line_items, input.tax_rate);

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      ...input,
      user_id: user.id,
      subtotal: totals.subtotal,
      tax_amount: totals.taxAmount,
      total: totals.total,
    })
    .select("id")
    .single();

  if (error || !invoice) {
    return { error: "Could not save the invoice. Please try again." };
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/invoices/${invoice.id}`);
}

export async function deleteInvoice(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  // No user check needed here: row level security only lets a user delete
  // their own rows, so a guessed id simply matches nothing.
  await supabase.from("invoices").delete().eq("id", id);

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
