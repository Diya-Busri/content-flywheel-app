export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { desc, eq, ilike, isNull, isNotNull, inArray, sql, count, and, or } from "drizzle-orm";

/**
 * GET /api/admin/creators
 * Admin-only: list all creator profiles with product counts, status, marketplace visibility.
 *
 * Query params:
 *   q        – search email / userId
 *   status   – all | active | suspended | hidden | deleted
 *   sort     – newest (default) | oldest | products | email
 *   page     – page number (default 1)
 *   pageSize – items per page (default 40, max 100)
 */
export async function GET(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp       = new URL(request.url).searchParams;
  const q        = sp.get("q")?.trim().toLowerCase() ?? "";
  const status   = sp.get("status") ?? "all";
  const sort     = sp.get("sort") ?? "newest";
  const page     = Math.max(1, parseInt(sp.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") ?? "40") || 40));
  const offset   = (page - 1) * pageSize;

  // ── Fetch profiles ─────────────────────────────────────────────────────────
  const profileRows = await db
    .select({
      userId:               profilesTable.userId,
      email:                profilesTable.email,
      membership:           profilesTable.membership,
      status:               profilesTable.status,
      hiddenFromMarketplace: profilesTable.hiddenFromMarketplace,
      deletedAt:            profilesTable.deletedAt,
      stripeConnectOnboardingComplete: profilesTable.stripeConnectOnboardingComplete,
      createdAt:            profilesTable.createdAt,
      lastActiveAt:         profilesTable.lastActiveAt,
    })
    .from(profilesTable)
    .orderBy(sort === "oldest" ? profilesTable.createdAt : desc(profilesTable.createdAt));

  // ── Fetch product counts per creator ───────────────────────────────────────
  const allUserIds = profileRows.map((p) => p.userId);
  const productCounts = allUserIds.length > 0
    ? await db
        .select({
          userId: productsTable.userId,
          total:  sql<number>`count(*)::int`,
          published: sql<number>`count(*) filter (where ${productsTable.moderationStatus} is null and ${productsTable.removedAt} is null and ${productsTable.archivedAt} is null)::int`,
        })
        .from(productsTable)
        .where(and(isNull(productsTable.deletedAt), inArray(productsTable.userId, allUserIds)))
        .groupBy(productsTable.userId)
    : [];

  const countMap: Record<string, { total: number; published: number }> = {};
  for (const c of productCounts) countMap[c.userId] = { total: c.total, published: c.published };

  // ── Enrich + filter ────────────────────────────────────────────────────────
  let enriched = profileRows.map((p) => ({
    ...p,
    productCount:   countMap[p.userId]?.total ?? 0,
    publishedCount: countMap[p.userId]?.published ?? 0,
    isDeleted:      !!p.deletedAt,
    isSuspended:    (p.status ?? "").toLowerCase() === "suspended",
  }));

  // Status filter
  if (status === "active") {
    enriched = enriched.filter((p) => !p.isDeleted && !p.isSuspended && !p.hiddenFromMarketplace);
  } else if (status === "suspended") {
    enriched = enriched.filter((p) => p.isSuspended && !p.isDeleted);
  } else if (status === "hidden") {
    enriched = enriched.filter((p) => p.hiddenFromMarketplace && !p.isDeleted);
  } else if (status === "deleted") {
    enriched = enriched.filter((p) => p.isDeleted);
  }
  // "all" — include everyone

  // Search filter
  if (q) {
    enriched = enriched.filter((p) =>
      (p.email ?? "").toLowerCase().includes(q) ||
      p.userId.toLowerCase().includes(q)
    );
  }

  // Sort by product count if requested
  if (sort === "products") {
    enriched.sort((a, b) => b.productCount - a.productCount);
  }

  // ── Paginate ───────────────────────────────────────────────────────────────
  const total   = enriched.length;
  const results = enriched.slice(offset, offset + pageSize);

  return NextResponse.json({
    creators: results,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
