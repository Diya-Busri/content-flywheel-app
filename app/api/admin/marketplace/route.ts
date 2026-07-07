export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { productViewsTable } from "@/db/schema/product-views-schema";
import { desc, asc, eq, ilike, inArray, isNull, isNotNull, or, and, sql, count, sum } from "drizzle-orm";

/**
 * GET /api/admin/marketplace
 * Admin-only: list all products with full metadata, creator info, analytics.
 *
 * Query params:
 *   q           – search title / niche / creator email
 *   status      – all | published | hidden | archived | removed | suspended
 *   creator     – filter by creator userId or email substring
 *   niche       – filter by niche substring
 *   sort        – newest (default) | oldest | sales | reports
 *   page        – page number (default 1)
 *   pageSize    – items per page (default 30, max 100)
 */
export async function GET(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp       = new URL(request.url).searchParams;
  const q        = sp.get("q")?.trim().toLowerCase() ?? "";
  const status   = sp.get("status") ?? "all";
  const creator  = sp.get("creator")?.trim().toLowerCase() ?? "";
  const niche    = sp.get("niche")?.trim().toLowerCase() ?? "";
  const sort     = sp.get("sort") ?? "newest";
  const page     = Math.max(1, parseInt(sp.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") ?? "30") || 30));
  const offset   = (page - 1) * pageSize;
  const featuredOnly = sp.get("featured") === "1";

  // ── Build WHERE conditions ────────────────────────────────────────────────
  const conditions: ReturnType<typeof eq>[] = [];

  // Status filter
  if (status === "published") {
    conditions.push(isNull(productsTable.removedAt) as ReturnType<typeof eq>);
    conditions.push(isNull(productsTable.archivedAt) as ReturnType<typeof eq>);
    conditions.push(isNull(productsTable.moderationStatus) as ReturnType<typeof eq>);
    conditions.push(isNull(productsTable.deletedAt) as ReturnType<typeof eq>);
    // Published = has isNativePublished in marketingAssets — we check client-side
  } else if (status === "archived") {
    conditions.push(isNotNull(productsTable.archivedAt) as ReturnType<typeof eq>);
    conditions.push(isNull(productsTable.removedAt) as ReturnType<typeof eq>);
    conditions.push(isNull(productsTable.deletedAt) as ReturnType<typeof eq>);
  } else if (status === "removed") {
    conditions.push(isNotNull(productsTable.removedAt) as ReturnType<typeof eq>);
  } else if (status === "hidden") {
    conditions.push(eq(productsTable.moderationStatus, "hidden") as ReturnType<typeof eq>);
    conditions.push(isNull(productsTable.removedAt) as ReturnType<typeof eq>);
  } else if (status === "suspended") {
    conditions.push(eq(productsTable.moderationStatus, "suspended") as ReturnType<typeof eq>);
    conditions.push(isNull(productsTable.removedAt) as ReturnType<typeof eq>);
  } else {
    // "all" — exclude hard-deleted only
    conditions.push(isNull(productsTable.deletedAt) as ReturnType<typeof eq>);
  }

  // Niche filter
  if (niche) {
    conditions.push(ilike(productsTable.niche, `%${niche}%`) as ReturnType<typeof eq>);
  }

  // Featured filter — staff picks OR homepage-pinned
  if (featuredOnly) {
    conditions.push(
      or(
        eq(productsTable.staffPick, true),
        eq(productsTable.pinnedHomepage, true),
      ) as ReturnType<typeof eq>
    );
  }

  // ── Fetch products ─────────────────────────────────────────────────────────
  const orderClause = sort === "oldest" ? asc(productsTable.createdAt) : desc(productsTable.createdAt);

  const rows = await db
    .select({
      id:               productsTable.id,
      userId:           productsTable.userId,
      title:            productsTable.title,
      niche:            productsTable.niche,
      format:           productsTable.format,
      status:           productsTable.status,
      moderationStatus: productsTable.moderationStatus,
      staffPick:        productsTable.staffPick,
      pinnedHomepage:   productsTable.pinnedHomepage,
      adminNotes:       productsTable.adminNotes,
      marketingAssets:  productsTable.marketingAssets,
      archivedAt:       productsTable.archivedAt,
      removedAt:        productsTable.removedAt,
      createdAt:        productsTable.createdAt,
      updatedAt:        productsTable.updatedAt,
    })
    .from(productsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderClause);

  // ── Enrich with creator profiles ─────────────────────────────────────────
  const allUserIds = Array.from(new Set(rows.map((r) => r.userId)));
  const profiles = allUserIds.length > 0
    ? await db
        .select({ userId: profilesTable.userId, email: profilesTable.email, membership: profilesTable.membership, status: profilesTable.status })
        .from(profilesTable)
        .where(inArray(profilesTable.userId, allUserIds))
    : [];
  const profileMap: Record<string, typeof profiles[0]> = {};
  for (const p of profiles) profileMap[p.userId] = p;

  // ── Enrich with order counts per product ──────────────────────────────────
  const productIds = rows.map((r) => r.id);
  const orderCounts = productIds.length > 0
    ? await db
        .select({
          productId: productOrdersTable.productId,
          count:     sql<number>`count(*)::int`,
          revenue:   sql<number>`coalesce(sum(${productOrdersTable.amountCents}),0)::int`,
        })
        .from(productOrdersTable)
        .where(inArray(productOrdersTable.productId, productIds))
        .groupBy(productOrdersTable.productId)
    : [];
  const orderMap: Record<string, { count: number; revenue: number }> = {};
  for (const o of orderCounts) orderMap[o.productId] = { count: o.count, revenue: o.revenue };

  // ── View counts ───────────────────────────────────────────────────────────
  const viewCounts = productIds.length > 0
    ? await db
        .select({ productId: productViewsTable.productId, count: sql<number>`count(*)::int` })
        .from(productViewsTable)
        .where(inArray(productViewsTable.productId, productIds))
        .groupBy(productViewsTable.productId)
    : [];
  const viewMap: Record<string, number> = {};
  for (const v of viewCounts) viewMap[v.productId] = v.count;

  // ── Apply search + creator filter (post-join) ────────────────────────────
  let enriched = rows.map((r) => {
    const profile = profileMap[r.userId];
    const orders  = orderMap[r.id] ?? { count: 0, revenue: 0 };
    const views   = viewMap[r.id] ?? 0;
    const ma      = r.marketingAssets as { isNativePublished?: boolean; nativePrice?: number; thumbnailUrl?: string | null; priceLabel?: string | null } | null;
    return {
      ...r,
      creatorEmail:      profile?.email ?? null,
      creatorMembership: profile?.membership ?? null,
      creatorStatus:     profile?.status ?? null,
      isNativePublished: ma?.isNativePublished ?? false,
      nativePrice:       ma?.nativePrice ?? null,
      priceLabel:        ma?.priceLabel ?? null,
      thumbnailUrl:      ma?.thumbnailUrl ?? null,
      orderCount:        orders.count,
      revenueGbp:        orders.revenue,
      viewCount:         views,
    };
  });

  // Search filter (title, niche, creator email)
  if (q) {
    enriched = enriched.filter((r) =>
      r.title.toLowerCase().includes(q) ||
      r.niche.toLowerCase().includes(q) ||
      (r.creatorEmail ?? "").toLowerCase().includes(q)
    );
  }

  // Creator filter
  if (creator) {
    enriched = enriched.filter((r) =>
      r.userId.toLowerCase().includes(creator) ||
      (r.creatorEmail ?? "").toLowerCase().includes(creator)
    );
  }

  // Sort by sales if requested
  if (sort === "sales") {
    enriched.sort((a, b) => b.orderCount - a.orderCount);
  }

  // ── Paginate ──────────────────────────────────────────────────────────────
  const total   = enriched.length;
  const results = enriched.slice(offset, offset + pageSize);

  return NextResponse.json({
    products:   results,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
