import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, gte, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Total all-time revenue
  const [totals] = await db
    .select({
      totalCents: sql<number>`COALESCE(SUM(${productOrdersTable.amountCents}), 0)`,
      totalOrders: sql<number>`COUNT(*)`,
    })
    .from(productOrdersTable)
    .where(and(eq(productOrdersTable.creatorUserId, userId), eq(productOrdersTable.status, "completed")));

  // This month revenue
  const [monthly] = await db
    .select({
      totalCents: sql<number>`COALESCE(SUM(${productOrdersTable.amountCents}), 0)`,
      totalOrders: sql<number>`COUNT(*)`,
    })
    .from(productOrdersTable)
    .where(
      and(
        eq(productOrdersTable.creatorUserId, userId),
        eq(productOrdersTable.status, "completed"),
        gte(productOrdersTable.createdAt, startOfMonth)
      )
    );

  // Best selling product
  const bestSellers = await db
    .select({
      productId: productOrdersTable.productId,
      productTitle: productsTable.title,
      salesCount: sql<number>`COUNT(*)`,
      revenueCents: sql<number>`SUM(${productOrdersTable.amountCents})`,
    })
    .from(productOrdersTable)
    .leftJoin(productsTable, eq(productOrdersTable.productId, productsTable.id))
    .where(and(eq(productOrdersTable.creatorUserId, userId), eq(productOrdersTable.status, "completed")))
    .groupBy(productOrdersTable.productId, productsTable.title)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(1);

  return NextResponse.json({
    allTime: { cents: Number(totals?.totalCents ?? 0), orders: Number(totals?.totalOrders ?? 0) },
    thisMonth: { cents: Number(monthly?.totalCents ?? 0), orders: Number(monthly?.totalOrders ?? 0) },
    bestSeller: bestSellers[0] ?? null,
  });
}
