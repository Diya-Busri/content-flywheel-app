export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productViewsTable } from "@/db/schema/product-views-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, gte, sql } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify ownership
  const [product] = await db
    .select({ userId: productsTable.userId })
    .from(productsTable)
    .where(eq(productsTable.id, id))
    .limit(1);

  if (!product || product.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
  const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productViewsTable)
    .where(eq(productViewsTable.productId, id));

  const [last7Row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productViewsTable)
    .where(and(eq(productViewsTable.productId, id), gte(productViewsTable.viewedAt, day7)));

  const [last30Row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productViewsTable)
    .where(and(eq(productViewsTable.productId, id), gte(productViewsTable.viewedAt, day30)));

  return NextResponse.json({
    total: totalRow?.count ?? 0,
    last7Days: last7Row?.count ?? 0,
    last30Days: last30Row?.count ?? 0,
  });
}
