export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { productsTable } from "@/db/schema/products-schema";
import { productViewsTable } from "@/db/schema/product-views-schema";
import { emailContactsTable } from "@/db/schema/email-marketing-schema";
import { productWishlistsTable } from "@/db/schema/product-wishlists-schema";
import { creatorFollowsTable } from "@/db/schema/creator-follows-schema";
import { productReviewsTable } from "@/db/schema/product-reviews-schema";
import { eq, and, sql, desc, gte, inArray, isNull } from "drizzle-orm";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Period param: 7 | 30 | 90 | all (default 30)
    const periodParam = req.nextUrl.searchParams.get("period") ?? "30";
    const periodDays = periodParam === "all" ? null : parseInt(periodParam, 10) || 30;

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

    // All-time totals
    const totalRevenueCents = allOrders.reduce((s, o) => s + o.amountCents, 0);
    const totalOrders = allOrders.length;

    // Period boundaries
    const periodStart = periodDays ? daysAgo(periodDays) : null;
    const prevPeriodStart = periodDays ? daysAgo(periodDays * 2) : null;

    const periodOrders = periodStart
      ? allOrders.filter((o) => new Date(o.createdAt) >= periodStart)
      : allOrders;

    const prevPeriodOrders =
      periodStart && prevPeriodStart
        ? allOrders.filter((o) => {
            const d = new Date(o.createdAt);
            return d >= prevPeriodStart && d < periodStart;
          })
        : [];

    const periodRevenueCents = periodOrders.reduce((s, o) => s + o.amountCents, 0);
    const periodOrdersCount = periodOrders.length;
    const prevPeriodRevenueCents = prevPeriodOrders.reduce((s, o) => s + o.amountCents, 0);

    const avgOrderCents =
      periodOrdersCount > 0 ? Math.round(periodRevenueCents / periodOrdersCount) : 0;

    // Revenue trend: % change vs previous period
    const revenueTrend =
      prevPeriodRevenueCents > 0
        ? Math.round(((periodRevenueCents - prevPeriodRevenueCents) / prevPeriodRevenueCents) * 100)
        : periodRevenueCents > 0
        ? 100
        : 0;

    // Daily revenue for the selected period
    const numDays = periodDays ?? 90;
    const dailyMap = new Map<string, { cents: number; orders: number }>();
    for (let i = 0; i < numDays; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (numDays - 1 - i));
      dailyMap.set(d.toISOString().slice(0, 10), { cents: 0, orders: 0 });
    }
    for (const o of periodOrders) {
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

    // Top products (from period orders)
    const productTotals = new Map<string, { orders: number; revenueCents: number }>();
    for (const o of periodOrders) {
      const existing = productTotals.get(o.productId) ?? { orders: 0, revenueCents: 0 };
      existing.orders += 1;
      existing.revenueCents += o.amountCents;
      productTotals.set(o.productId, existing);
    }

    const productIds = Array.from(productTotals.keys());
    const productTitleMap = new Map<string, string>();
    if (productIds.length > 0) {
      const products = await db
        .select({ id: productsTable.id, title: productsTable.title })
        .from(productsTable)
        .where(sql`${productsTable.id} = ANY(${productIds})`);
      for (const p of products) productTitleMap.set(p.id, p.title);
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

    // Orders for CSV export + recent display
    const allOrdersMapped = periodOrders.map((o) => ({
      id: o.id,
      buyerEmail: o.buyerEmail,
      buyerName: o.buyerName,
      amountCents: o.amountCents,
      currency: o.currency,
      createdAt: o.createdAt.toISOString(),
      productTitle: productTitleMap.get(o.productId) ?? "Unknown Product",
    }));

    const recentOrders = allOrdersMapped.slice(0, 20);

    // Product performance: views, orders, revenue, wishlist saves, avg rating, CVR
    let conversionFunnel: Array<{
      productId: string; title: string; views: number; orders: number;
      revenueCents: number; wishlistSaves: number; avgRating: number | null;
    }> = [];
    let totalViews = 0;
    let totalWishlistSaves = 0;
    let overallAvgRating: number | null = null;
    let followerCount = 0;

    try {
      // Follower count for this creator
      const [followRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(creatorFollowsTable)
        .where(eq(creatorFollowsTable.followedId, userId));
      followerCount = followRow?.count ?? 0;
    } catch { /* non-fatal */ }

    try {
      // All published, non-deleted, non-archived products for this creator
      const creatorProducts = await db
        .select({ id: productsTable.id, title: productsTable.title })
        .from(productsTable)
        .where(and(
          eq(productsTable.userId, userId),
          isNull(productsTable.deletedAt),
          isNull(productsTable.archivedAt),
        ));

      if (creatorProducts.length > 0) {
        const creatorProductIds = creatorProducts.map((p) => p.id);

        // View counts per product for the period
        const viewQuery = periodStart
          ? db.select({ productId: productViewsTable.productId, cnt: sql<number>`count(*)::int` })
              .from(productViewsTable)
              .where(and(inArray(productViewsTable.productId, creatorProductIds), gte(productViewsTable.viewedAt, periodStart)))
              .groupBy(productViewsTable.productId)
          : db.select({ productId: productViewsTable.productId, cnt: sql<number>`count(*)::int` })
              .from(productViewsTable)
              .where(inArray(productViewsTable.productId, creatorProductIds))
              .groupBy(productViewsTable.productId);

        // Wishlist saves per product (all-time)
        const wishlistQuery = db.select({
            productId: productWishlistsTable.productId,
            cnt: sql<number>`count(*)::int`,
          })
          .from(productWishlistsTable)
          .where(inArray(productWishlistsTable.productId, creatorProductIds))
          .groupBy(productWishlistsTable.productId);

        // Avg rating per product (approved reviews only)
        const ratingsQuery = db.select({
            productId: productReviewsTable.productId,
            avgRating: sql<number>`round(avg(${productReviewsTable.rating})::numeric, 1)::float`,
            reviewCount: sql<number>`count(*)::int`,
          })
          .from(productReviewsTable)
          .where(and(
            inArray(productReviewsTable.productId, creatorProductIds),
            eq(productReviewsTable.approved, true),
          ))
          .groupBy(productReviewsTable.productId);

        const [viewCounts, wishlistCounts, ratingRows] = await Promise.all([viewQuery, wishlistQuery, ratingsQuery]);

        const viewMap      = new Map(viewCounts.map((r) => [r.productId, Number(r.cnt)]));
        const wishlistMap  = new Map(wishlistCounts.map((r) => [r.productId, Number(r.cnt)]));
        const ratingsMap   = new Map(ratingRows.map((r) => [r.productId, Number(r.avgRating)]));

        conversionFunnel = creatorProducts
          .map((p) => {
            const orderData = productTotals.get(p.id) ?? { orders: 0, revenueCents: 0 };
            return {
              productId:    p.id,
              title:        p.title,
              views:        viewMap.get(p.id) ?? 0,
              orders:       orderData.orders,
              revenueCents: orderData.revenueCents,
              wishlistSaves: wishlistMap.get(p.id) ?? 0,
              avgRating:    ratingsMap.get(p.id) ?? null,
            };
          })
          .filter((p) => p.views > 0 || p.orders > 0 || p.wishlistSaves > 0)
          .sort((a, b) => b.views - a.views)
          .slice(0, 20);

        // Aggregate totals
        totalViews         = Array.from(viewMap.values()).reduce((s, v) => s + v, 0);
        totalWishlistSaves = Array.from(wishlistMap.values()).reduce((s, v) => s + v, 0);

        // Overall avg rating (weighted by review count)
        if (ratingRows.length > 0) {
          const totalReviews = ratingRows.reduce((s, r) => s + r.reviewCount, 0);
          if (totalReviews > 0) {
            const weightedSum = ratingRows.reduce((s, r) => s + r.avgRating * r.reviewCount, 0);
            overallAvgRating = Math.round((weightedSum / totalReviews) * 10) / 10;
          }
        }
      }
    } catch {
      // Non-fatal — funnel is a nice-to-have
    }

    // Subscriber count + daily growth
    let subscriberCount = 0;
    let dailySubscribers: Array<{ date: string; count: number }> = [];
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

      // Daily new subscribers for the period
      const subRows = await db
        .select({
          day: sql<string>`DATE(${emailContactsTable.subscribedAt})::text`,
          cnt: sql<number>`count(*)::int`,
        })
        .from(emailContactsTable)
        .where(
          and(
            eq(emailContactsTable.userId, userId),
            sql`${emailContactsTable.unsubscribedAt} IS NULL`,
            ...(periodStart ? [gte(emailContactsTable.subscribedAt, periodStart)] : [])
          )
        )
        .groupBy(sql`DATE(${emailContactsTable.subscribedAt})`);

      // Build a filled daily map for the period
      const subMap = new Map(subRows.map((r) => [r.day, Number(r.cnt)]));
      const numSubDays = periodDays ?? 90;
      dailySubscribers = Array.from({ length: numSubDays }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (numSubDays - 1 - i));
        const key = d.toISOString().slice(0, 10);
        return { date: key, count: subMap.get(key) ?? 0 };
      });
    } catch {
      subscriberCount = 0;
    }

    return NextResponse.json({
      // All-time
      totalRevenueCents,
      totalOrders,
      // Period
      periodRevenueCents,
      periodOrdersCount,
      avgOrderCents,
      revenueTrend,
      prevPeriodRevenueCents,
      // Legacy fields for backwards compat
      last30DaysRevenueCents: periodRevenueCents,
      last30DaysOrders: periodOrdersCount,
      // Chart + tables
      dailyRevenue,
      topProducts,
      recentOrders,
      allOrdersForExport: allOrdersMapped,
      subscriberCount,
      dailySubscribers,
      conversionFunnel,
      // New Phase E fields
      totalViews,
      followerCount,
      totalWishlistSaves,
      overallAvgRating,
    });
  } catch (err) {
    console.error("[analytics/revenue] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
