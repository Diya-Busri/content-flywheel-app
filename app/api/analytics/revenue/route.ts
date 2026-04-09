import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { productsTable } from "@/db/schema/products-schema";
import { emailContactsTable } from "@/db/schema/email-marketing-schema";
import { eq, and, gte, sql, desc } from "drizzle-orm";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // All-time completed orders for this creator
    const allOrders = await db
      .select({
        id: productOrdersTable.id,
        productId: productOrdersTable.productId,
        buyerEmail: productOrdersTable.buyerEmail,
        buyerName: productOrdersTable.buyerName,
        amountCents: productOrdersTable.amountCents,
        currency: productOrdersTable.currency,
        createdAt: productOrdersTable.createdAt,
      })
      .from(productOrdersTable)
      .where(
        and(
          eq(productOrdersTable.creatorUserId, userId),
          eq(productOrdersTable.status, "completed")
        )
      )
      .orderBy(desc(productOrdersTable.createdAt));

    // Compute totals
    const totalRevenueCents = allOrders.reduce((sum, o) => sum + o.amountCents, 0);
    const totalOrders = allOrders.length;

    // Last 30 days
    const last30Orders = allOrders.filter(
      (o) => new Date(o.createdAt) >= thirtyDaysAgo
    );
    const last30DaysRevenueCents = last30Orders.reduce((sum, o) => sum + o.amountCents, 0);
    const last30DaysOrders = last30Orders.length;

    // Daily revenue for last 30 days
    const dailyMap = new Map<string, { cents: number; orders: number }>();
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const key = d.toISOString().slice(0, 10);
      dailyMap.set(key, { cents: 0, orders: 0 });
    }
    for (const o of last30Orders) {
      const key = new Date(o.createdAt).toISOString().slice(0, 10);
      if (dailyMap.has(key)) {
        const entry = dailyMap.get(key)!;
        entry.cents += o.amountCents;
        entry.orders += 1;
      }
    }
    const dailyRevenue = Array.from(dailyMap.entries()).map(([date, v]) => ({
      date,
      cents: v.cents,
      orders: v.orders,
    }));

    // Top products
    const productTotals = new Map<
      string,
      { orders: number; revenueCents: number }
    >();
    for (const o of allOrders) {
      const existing = productTotals.get(o.productId) ?? { orders: 0, revenueCents: 0 };
      existing.orders += 1;
      existing.revenueCents += o.amountCents;
      productTotals.set(o.productId, existing);
    }

    // Fetch product titles for top products
    const productIds = Array.from(productTotals.keys());
    let productTitleMap = new Map<string, string>();
    if (productIds.length > 0) {
      const products = await db
        .select({ id: productsTable.id, title: productsTable.title })
        .from(productsTable)
        .where(sql`${productsTable.id} = ANY(${productIds})`);
      for (const p of products) {
        productTitleMap.set(p.id, p.title);
      }
    }

    const topProducts = Array.from(productTotals.entries())
      .map(([productId, v]) => ({
        productId,
        title: productTitleMap.get(productId) ?? "Unknown Product",
        orders: v.orders,
        revenueCents: v.revenueCents,
      }))
      .sort((a, b) => b.revenueCents - a.revenueCents)
      .slice(0, 10);

    // Recent orders (last 20) with product titles
    const recentOrders = allOrders.slice(0, 20).map((o) => ({
      id: o.id,
      buyerEmail: o.buyerEmail,
      buyerName: o.buyerName,
      amountCents: o.amountCents,
      currency: o.currency,
      createdAt: o.createdAt.toISOString(),
      productTitle: productTitleMap.get(o.productId) ?? "Unknown Product",
    }));

    // Subscriber count
    let subscriberCount = 0;
    try {
      const [countRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(emailContactsTable)
        .where(
          and(
            eq(emailContactsTable.userId, userId),
            sql`${emailContactsTable.unsubscribedAt} IS NULL`
          )
        );
      subscriberCount = countRow?.count ?? 0;
    } catch {
      // email_contacts table might not exist yet
      subscriberCount = 0;
    }

    return NextResponse.json({
      totalRevenueCents,
      totalOrders,
      last30DaysRevenueCents,
      last30DaysOrders,
      dailyRevenue,
      topProducts,
      recentOrders,
      subscriberCount,
    });
  } catch (err) {
    console.error("[analytics/revenue] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
