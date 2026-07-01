import { NextResponse } from "next/server";
import { db } from "@/db/db";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { productsTable } from "@/db/schema/products-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { eq, and } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export const dynamic = "force-dynamic";

function currencySymbol(currency: string): string {
  switch (currency.toLowerCase()) {
    case "usd": return "$";
    case "eur": return "€";
    case "gbp": return "£";
    default: return currency.toUpperCase() + " ";
  }
}

function formatAmount(amountCents: number, currency: string): string {
  return `${currencySymbol(currency)}${(amountCents / 100).toFixed(2)}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 10).toUpperCase();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  // Fetch order and join product
  const rows = await db
    .select({
      id: productOrdersTable.id,
      buyerEmail: productOrdersTable.buyerEmail,
      buyerName: productOrdersTable.buyerName,
      amountCents: productOrdersTable.amountCents,
      currency: productOrdersTable.currency,
      createdAt: productOrdersTable.createdAt,
      downloadToken: productOrdersTable.downloadToken,
      creatorUserId: productOrdersTable.creatorUserId,
      productTitle: productsTable.title,
    })
    .from(productOrdersTable)
    .leftJoin(productsTable, eq(productOrdersTable.productId, productsTable.id))
    .where(and(eq(productOrdersTable.id, id), eq(productOrdersTable.status, "completed")))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const order = rows[0];

  // Verify token
  if (!order.downloadToken || order.downloadToken !== token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  // Fetch creator brand name (optional, best-effort)
  let sellerName = "Content Flywheel Creator";
  try {
    const bvRows = await db
      .select({ brandName: brandVoiceTable.brandName })
      .from(brandVoiceTable)
      .where(eq(brandVoiceTable.userId, order.creatorUserId))
      .limit(1);
    if (bvRows[0]?.brandName) sellerName = bvRows[0].brandName;
  } catch {
    // non-critical
  }

  // Build PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4

  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const orange = rgb(0.976, 0.451, 0.086); // #f97316
  const darkGray = rgb(0.067, 0.094, 0.153); // #111827
  const midGray = rgb(0.42, 0.447, 0.502); // #6b7280
  const lightGray = rgb(0.957, 0.961, 0.969); // #f3f4f6
  const white = rgb(1, 1, 1);
  const { width, height } = page.getSize();

  // ── Header band ──────────────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 100, width, height: 100, color: darkGray });

  page.drawText("INVOICE", {
    x: 48,
    y: height - 60,
    size: 28,
    font: helveticaBold,
    color: white,
  });

  page.drawText("Content Flywheel", {
    x: 48,
    y: height - 82,
    size: 11,
    font: helvetica,
    color: rgb(0.7, 0.7, 0.7),
  });

  // Invoice # badge (right side)
  const invNum = `#INV-${shortId(order.id)}`;
  const invNumWidth = helveticaBold.widthOfTextAtSize(invNum, 13);
  page.drawText(invNum, {
    x: width - 48 - invNumWidth,
    y: height - 56,
    size: 13,
    font: helveticaBold,
    color: orange,
  });

  const dateStr = formatDate(order.createdAt);
  const dateWidth = helvetica.widthOfTextAtSize(dateStr, 10);
  page.drawText(dateStr, {
    x: width - 48 - dateWidth,
    y: height - 78,
    size: 10,
    font: helvetica,
    color: rgb(0.7, 0.7, 0.7),
  });

  // ── Bill To / Sold By columns ─────────────────────────────
  const colY = height - 160;

  page.drawText("BILL TO", { x: 48, y: colY + 18, size: 9, font: helveticaBold, color: midGray });
  page.drawText(order.buyerEmail, { x: 48, y: colY, size: 12, font: helveticaBold, color: darkGray });
  if (order.buyerName) {
    page.drawText(order.buyerName, { x: 48, y: colY - 18, size: 11, font: helvetica, color: midGray });
  }

  page.drawText("SOLD BY", { x: 300, y: colY + 18, size: 9, font: helveticaBold, color: midGray });
  page.drawText(sellerName, { x: 300, y: colY, size: 12, font: helveticaBold, color: darkGray });
  page.drawText("via Content Flywheel", { x: 300, y: colY - 18, size: 10, font: helvetica, color: midGray });

  // ── Divider ───────────────────────────────────────────────
  const dividerY = height - 220;
  page.drawRectangle({ x: 48, y: dividerY, width: width - 96, height: 1, color: lightGray });

  // ── Line items table header ───────────────────────────────
  const tableHeaderY = dividerY - 28;
  page.drawRectangle({ x: 48, y: tableHeaderY - 4, width: width - 96, height: 22, color: lightGray });

  page.drawText("DESCRIPTION", { x: 56, y: tableHeaderY + 4, size: 9, font: helveticaBold, color: midGray });
  page.drawText("AMOUNT", { x: width - 100, y: tableHeaderY + 4, size: 9, font: helveticaBold, color: midGray });

  // ── Line item row ─────────────────────────────────────────
  const rowY = tableHeaderY - 36;
  const productTitle = order.productTitle ?? "Digital Product";
  // Truncate long titles
  const maxTitleWidth = width - 96 - 100;
  let displayTitle = productTitle;
  while (
    helvetica.widthOfTextAtSize(displayTitle, 13) > maxTitleWidth &&
    displayTitle.length > 10
  ) {
    displayTitle = displayTitle.slice(0, -4) + "…";
  }

  page.drawText(displayTitle, { x: 56, y: rowY, size: 13, font: helvetica, color: darkGray });

  const amtStr = formatAmount(order.amountCents, order.currency);
  const amtWidth = helveticaBold.widthOfTextAtSize(amtStr, 13);
  page.drawText(amtStr, {
    x: width - 48 - amtWidth,
    y: rowY,
    size: 13,
    font: helveticaBold,
    color: darkGray,
  });

  // Row underline
  page.drawRectangle({ x: 48, y: rowY - 14, width: width - 96, height: 0.5, color: lightGray });

  // ── Total ─────────────────────────────────────────────────
  const totalY = rowY - 56;

  // Total label
  page.drawText("TOTAL PAID", {
    x: 300,
    y: totalY,
    size: 10,
    font: helveticaBold,
    color: midGray,
  });

  // Total amount — larger, orange
  const totalStr = formatAmount(order.amountCents, order.currency);
  const totalWidth = helveticaBold.widthOfTextAtSize(totalStr, 22);
  page.drawText(totalStr, {
    x: width - 48 - totalWidth,
    y: totalY - 4,
    size: 22,
    font: helveticaBold,
    color: orange,
  });

  // ── Paid stamp ────────────────────────────────────────────
  const stampX = 56;
  const stampY = totalY - 8;
  page.drawRectangle({ x: stampX, y: stampY - 4, width: 60, height: 22, borderColor: rgb(0.133, 0.545, 0.133), borderWidth: 1.5, color: rgb(0.94, 1, 0.94) });
  page.drawText("PAID", { x: stampX + 12, y: stampY + 4, size: 11, font: helveticaBold, color: rgb(0.133, 0.545, 0.133) });

  // ── Footer ────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width, height: 60, color: darkGray });
  page.drawText("Thank you for your purchase!", {
    x: 48,
    y: 34,
    size: 11,
    font: helveticaBold,
    color: white,
  });
  page.drawText("Questions? Visit contentflywheel.io or contact the seller.", {
    x: 48,
    y: 16,
    size: 9,
    font: helvetica,
    color: rgb(0.6, 0.6, 0.6),
  });

  const invNumFooter = `Invoice ${invNum}`;
  const footerRightWidth = helvetica.widthOfTextAtSize(invNumFooter, 9);
  page.drawText(invNumFooter, {
    x: width - 48 - footerRightWidth,
    y: 24,
    size: 9,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();

  const filename = `invoice-${shortId(order.id)}.pdf`;
  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": pdfBytes.byteLength.toString(),
    },
  });
}
