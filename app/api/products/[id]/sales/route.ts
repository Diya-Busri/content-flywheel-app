import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productSalesTable } from "@/db/schema/product-sales-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull, desc, sum } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/products/[id]/sales
 * Returns all sales entries for the product + total revenue.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: productId } = await params;

    // Verify ownership
    const [product] = await db.select({ id: productsTable.id })
      .from(productsTable)
      .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const sales = await db.select()
      .from(productSalesTable)
      .where(and(eq(productSalesTable.productId, productId), eq(productSalesTable.userId, userId)))
      .orderBy(desc(productSalesTable.soldAt));

    const totalCents = sales.reduce((acc, s) => acc + s.amountCents, 0);

    return NextResponse.json({ sales, totalCents });
  } catch (err) {
    console.error("[sales/GET]", err);
    return NextResponse.json({ error: "Failed to fetch sales" }, { status: 500 });
  }
}

/**
 * POST /api/products/[id]/sales
 * Body: { platform, amountCents, currency?, note?, soldAt? }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: productId } = await params;

    const [product] = await db.select({ id: productsTable.id })
      .from(productsTable)
      .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const platform = typeof body.platform === "string" ? body.platform.trim() : "other";
    const amountCents = typeof body.amountCents === "number" ? Math.round(body.amountCents) : 0;
    if (amountCents <= 0) return NextResponse.json({ error: "Amount must be > 0" }, { status: 400 });

    const currency = typeof body.currency === "string" ? body.currency.toUpperCase() : "USD";
    const note = typeof body.note === "string" ? body.note.trim() || null : null;
    const soldAt = body.soldAt ? new Date(body.soldAt) : new Date();

    const [sale] = await db.insert(productSalesTable).values({
      userId,
      productId,
      platform,
      amountCents,
      currency,
      note,
      soldAt,
    }).returning();

    return NextResponse.json({ sale });
  } catch (err) {
    console.error("[sales/POST]", err);
    return NextResponse.json({ error: "Failed to log sale" }, { status: 500 });
  }
}

/**
 * DELETE /api/products/[id]/sales
 * Body: { saleId }
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const saleId = typeof body.saleId === "string" ? body.saleId : "";
    if (!saleId) return NextResponse.json({ error: "saleId required" }, { status: 400 });

    await db.delete(productSalesTable)
      .where(and(eq(productSalesTable.id, saleId), eq(productSalesTable.userId, userId)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[sales/DELETE]", err);
    return NextResponse.json({ error: "Failed to delete sale" }, { status: 500 });
  }
}
