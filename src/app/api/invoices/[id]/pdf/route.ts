import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import type { Invoice, Profile } from "@/types/database";

// pdf-lib needs a Node runtime, not the edge one.
export const runtime = "nodejs";

/** Strips anything that could break out of the Content-Disposition header. */
function safeFilename(invoiceNumber: string): string {
  const cleaned = invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 40);
  return `invoice-${cleaned || "download"}.pdf`;
}

/**
 * Generates the PDF for one invoice.
 *
 * The whole subscription gate lives here. The watermark is decided from
 * profiles.plan, which is read from the database on this request and is only
 * ever written by the Stripe webhook handler. Nothing the browser sends can
 * influence it: there is no query parameter, no header and no request body
 * that turns the watermark off. Rendering on the server rather than in the
 * browser is the point, since client side generation would mean shipping the
 * unwatermarked code path to every free user.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const [invoiceResult, profileResult] = await Promise.all([
    // Row level security limits this to the current user's invoices, so
    // guessing another user's id returns nothing rather than their data.
    supabase.from("invoices").select("*").eq("id", id).single(),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
  ]);

  const invoice = invoiceResult.data as Invoice | null;
  const profile = profileResult.data as Profile | null;

  if (!invoice) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Anything other than a confirmed Pro subscription gets the watermark,
  // including the case where the profile row somehow failed to load.
  const pdfBytes = await renderInvoicePdf(invoice, {
    watermark: profile?.plan !== "pro",
  });

  return new NextResponse(pdfBytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFilename(invoice.invoice_number)}"`,
      "Content-Length": String(pdfBytes.length),
      // These contain customer data and depend on the user's plan, so they
      // must never be cached by a CDN or shared proxy.
      "Cache-Control": "private, no-store",
    },
  });
}
