import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import type { Invoice } from "@/types/database";

// A4 in PDF points.
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM_LIMIT = MARGIN + 60;

const INK = rgb(0.08, 0.09, 0.1);
const MUTED = rgb(0.45, 0.47, 0.5);
const LINE = rgb(0.85, 0.85, 0.84);
const WATERMARK = rgb(0.72, 0.74, 0.78);

// Right edge of each column, measured from the left margin.
const COL_QTY_RIGHT = CONTENT_WIDTH - 250;
const COL_PRICE_RIGHT = CONTENT_WIDTH - 120;
const COL_AMOUNT_RIGHT = CONTENT_WIDTH;
const COL_DESC_WIDTH = COL_QTY_RIGHT - 12;

type Fonts = { regular: PDFFont; bold: PDFFont };

/**
 * The standard PDF fonts are WinAnsi encoded, so anything outside Latin-1
 * (Greek, curly quotes, emoji) makes pdf-lib throw while drawing. Users paste
 * all sorts of things into a description field, so replace what cannot be
 * encoded instead of failing the whole download.
 *
 * The result is always a single line: line breaks collapse to spaces, because
 * every caller measures the string before drawing it. Multi-line values go
 * through wrapText, which splits on newlines first.
 */
function sanitize(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?")
    .trim();
}

function money(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));

  // Currency codes rather than symbols: unambiguous on an invoice, and safe in
  // every standard font encoding.
  return `${currency} ${formatted}`;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

/** Greedy word wrap, measured against the font actually being drawn. */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];

  // Split on newlines before sanitizing, otherwise the line breaks the user
  // typed are collapsed away with the rest of the whitespace.
  for (const paragraph of text.split("\n")) {
    let current = "";

    for (const word of sanitize(paragraph).split(" ").filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }

    lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

function drawRight(
  page: PDFPage,
  text: string,
  rightEdge: number,
  y: number,
  font: PDFFont,
  size: number,
  color = INK,
) {
  const clean = sanitize(text);
  page.drawText(clean, {
    x: rightEdge - font.widthOfTextAtSize(clean, size),
    y,
    size,
    font,
    color,
  });
}

function drawLeft(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = INK,
) {
  page.drawText(sanitize(text), { x, y, size, font, color });
}

function drawTableHeader(page: PDFPage, fonts: Fonts, y: number): number {
  drawLeft(page, "Description", MARGIN, y, fonts.bold, 8, MUTED);
  drawRight(page, "Qty", MARGIN + COL_QTY_RIGHT, y, fonts.bold, 8, MUTED);
  drawRight(page, "Unit price", MARGIN + COL_PRICE_RIGHT, y, fonts.bold, 8, MUTED);
  drawRight(page, "Amount", MARGIN + COL_AMOUNT_RIGHT, y, fonts.bold, 8, MUTED);

  page.drawLine({
    start: { x: MARGIN, y: y - 8 },
    end: { x: MARGIN + CONTENT_WIDTH, y: y - 8 },
    thickness: 0.75,
    color: LINE,
  });

  return y - 24;
}

/**
 * Diagonal watermark across the middle of the page, plus a line at the foot
 * explaining how to remove it.
 *
 * This is drawn based on the plan the server read from the database. It is
 * never decided in the browser, so the only way to get a clean PDF is to
 * actually hold a Pro subscription.
 */
function drawWatermark(page: PDFPage, fonts: Fonts) {
  const text = "FREE PLAN";
  const size = 86;
  const angle = 45;
  const radians = (angle * Math.PI) / 180;
  const width = fonts.bold.widthOfTextAtSize(text, size);

  page.drawText(text, {
    x: PAGE_WIDTH / 2 - (width / 2) * Math.cos(radians),
    y: PAGE_HEIGHT / 2 - (width / 2) * Math.sin(radians),
    size,
    font: fonts.bold,
    color: WATERMARK,
    rotate: degrees(angle),
    opacity: 0.28,
  });

  const footer = "Generated on the free plan. Upgrade to Pro for a clean PDF.";
  drawRight(page, footer, MARGIN + CONTENT_WIDTH, MARGIN - 20, fonts.regular, 8, MUTED);
}

export type RenderOptions = {
  /** True for free plan users. Decided server side from profiles.plan. */
  watermark: boolean;
};

export async function renderInvoicePdf(
  invoice: Invoice,
  { watermark }: RenderOptions,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Invoice ${sanitize(invoice.invoice_number)}`);
  doc.setCreator("Invoicer");

  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  // --- Header -------------------------------------------------------------
  drawLeft(page, "INVOICE", MARGIN, y - 22, fonts.bold, 26);
  drawRight(page, invoice.invoice_number, MARGIN + CONTENT_WIDTH, y - 8, fonts.bold, 12);
  drawRight(
    page,
    `Issued ${formatDate(invoice.issue_date)}`,
    MARGIN + CONTENT_WIDTH,
    y - 24,
    fonts.regular,
    9,
    MUTED,
  );
  if (invoice.due_date) {
    drawRight(
      page,
      `Due ${formatDate(invoice.due_date)}`,
      MARGIN + CONTENT_WIDTH,
      y - 38,
      fonts.regular,
      9,
      MUTED,
    );
  }

  y -= 74;

  // --- From / Bill to -----------------------------------------------------
  const columnWidth = CONTENT_WIDTH / 2 - 16;
  const parties = [
    {
      heading: "FROM",
      x: MARGIN,
      name: invoice.business_name,
      details: [invoice.business_email, invoice.business_address],
    },
    {
      heading: "BILL TO",
      x: MARGIN + CONTENT_WIDTH / 2 + 16,
      name: invoice.client_name,
      details: [invoice.client_email, invoice.client_address],
    },
  ];

  let partyBottom = y;

  for (const party of parties) {
    let partyY = y;
    drawLeft(page, party.heading, party.x, partyY, fonts.bold, 8, MUTED);
    partyY -= 16;

    drawLeft(page, party.name, party.x, partyY, fonts.bold, 11);
    partyY -= 14;

    for (const detail of party.details) {
      if (!detail) continue;
      for (const wrapped of wrapText(detail, fonts.regular, 9, columnWidth)) {
        drawLeft(page, wrapped, party.x, partyY, fonts.regular, 9, MUTED);
        partyY -= 12;
      }
    }

    partyBottom = Math.min(partyBottom, partyY);
  }

  y = partyBottom - 28;

  // --- Line items ---------------------------------------------------------
  y = drawTableHeader(page, fonts, y);

  for (const item of invoice.line_items) {
    const descriptionLines = wrapText(
      item.description,
      fonts.regular,
      9.5,
      COL_DESC_WIDTH,
    );
    // y tracks the top of the row. The first baseline sits below it so the
    // ascenders clear the rule drawn above, and the padding leaves room for
    // the rule drawn below.
    const rowHeight = descriptionLines.length * 12 + 14;

    if (y - rowHeight < BOTTOM_LIMIT) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = drawTableHeader(page, fonts, PAGE_HEIGHT - MARGIN);
    }

    const baseline = y - 10;

    descriptionLines.forEach((line, index) => {
      drawLeft(page, line, MARGIN, baseline - index * 12, fonts.regular, 9.5);
    });

    drawRight(
      page,
      String(item.quantity),
      MARGIN + COL_QTY_RIGHT,
      baseline,
      fonts.regular,
      9.5,
    );
    drawRight(
      page,
      money(item.unit_price, invoice.currency),
      MARGIN + COL_PRICE_RIGHT,
      baseline,
      fonts.regular,
      9.5,
    );
    drawRight(
      page,
      money(item.quantity * item.unit_price, invoice.currency),
      MARGIN + COL_AMOUNT_RIGHT,
      baseline,
      fonts.regular,
      9.5,
    );

    y -= rowHeight;
    page.drawLine({
      start: { x: MARGIN, y: y + 4 },
      end: { x: MARGIN + CONTENT_WIDTH, y: y + 4 },
      thickness: 0.5,
      color: LINE,
    });
  }

  // --- Totals -------------------------------------------------------------
  if (y - 90 < BOTTOM_LIMIT) {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  }

  y -= 18;
  const totals: Array<[string, string, boolean]> = [
    ["Subtotal", money(invoice.subtotal, invoice.currency), false],
    [`Tax (${invoice.tax_rate}%)`, money(invoice.tax_amount, invoice.currency), false],
    ["Total", money(invoice.total, invoice.currency), true],
  ];

  for (const [label, value, emphasis] of totals) {
    if (emphasis) {
      page.drawLine({
        start: { x: MARGIN + COL_PRICE_RIGHT - 60, y: y + 14 },
        end: { x: MARGIN + CONTENT_WIDTH, y: y + 14 },
        thickness: 0.75,
        color: LINE,
      });
    }

    const font = emphasis ? fonts.bold : fonts.regular;
    const size = emphasis ? 12 : 9.5;
    drawRight(
      page,
      label,
      MARGIN + COL_PRICE_RIGHT,
      y,
      font,
      size,
      emphasis ? INK : MUTED,
    );
    drawRight(page, value, MARGIN + COL_AMOUNT_RIGHT, y, font, size);
    y -= emphasis ? 22 : 16;
  }

  // --- Notes --------------------------------------------------------------
  if (invoice.notes) {
    y -= 18;
    const noteLines = wrapText(invoice.notes, fonts.regular, 9, CONTENT_WIDTH);

    if (y - noteLines.length * 12 < BOTTOM_LIMIT) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }

    drawLeft(page, "NOTES", MARGIN, y, fonts.bold, 8, MUTED);
    y -= 16;
    for (const line of noteLines) {
      drawLeft(page, line, MARGIN, y, fonts.regular, 9, MUTED);
      y -= 12;
    }
  }

  if (watermark) {
    for (const eachPage of doc.getPages()) {
      drawWatermark(eachPage, fonts);
    }
  }

  return doc.save();
}
