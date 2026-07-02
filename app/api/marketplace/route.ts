import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { isNull, inArray, desc, gte, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketplace
 * Query params: q, niche, format, sort (newest|best-sellers|trending|price-asc|price-desc|free), page
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q             = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const nicheFilter   = searchParams.get("niche")?.trim().toLowerCase() ?? "";
  const formatFilter  = searchParams.get("format")?.trim().toLowerCase() ?? "";
  const sort          = searchParams.get("sort") ?? "newest";
  const page          = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);
  const PAGE_SIZE     = 24;

  type MA = {
    isNativePublished?: boolean;
    nativePrice?: number;
    priceLabel?: string;
    thumbnailUrl?: string | null;
    coverThumbnailUrl?: string | null;
    bookMockupUrl?: string | null;
    productDescription?: string;
    comingSoon?: boolean;
  };

  // ── Fetch all published products ──────────────────────────────────────────
  const rows = await db
    .select({ id: productsTable.id, title: productsTable.title, niche: productsTable.niche, format: productsTable.format, marketingAssets: productsTable.marketingAssets, userId: productsTable.userId, createdAt: productsTable.createdAt })
    .from(productsTable)
    .where(isNull(productsTable.deletedAt))
    .orderBy(desc(productsTable.createdAt));

  const published = rows.filter((r) => {
    const ma = (r.marketingAssets ?? {}) as MA;
    return ma.isNativePublished === true && !ma.comingSoon;
  });

  // ── Fetch sales counts (all-time + last 7 days) ───────────────────────────
  const [allTimeSales, trendingSales] = await Promise.all([
    db.select({ productId: productOrdersTable.productId, count: sql<number>`count(*)::int` })
      .from(productOrdersTable)
      .where(eq(productOrdersTable.status, "completed"))
      .groupBy(productOrdersTable.productId),

    db.select({ productId: productOrdersTable.productId, count: sql<number>`count(*)::int` })
      .from(productOrdersTable)
      .where(gte(productOrdersTable.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
      .groupBy(productOrdersTable.productId),
  ]);

  const salesMap:    Record<string, number> = {};
  const trendingMap: Record<string, number> = {};
  for (const r of allTimeSales)  salesMap[r.productId]    = r.count;
  for (const r of trendingSales) trendingMap[r.productId] = r.count;

  // ── Text / niche / format / free filter ──────────────────────────────────
  let filtered = published.filter((r) => {
    const ma = (r.marketingAssets ?? {}) as MA;
    if (sort === "free" && (ma.nativePrice ?? 0) !== 0) return false;
    if (q) {
      const searchable = [r.title, r.niche, r.format, ma.productDescription ?? ""].join(" ").toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    if (nicheFilter && r.niche.toLowerCase() !== nicheFilter) return false;
    if (formatFilter && r.format.toLowerCase() !== formatFilter) return false;
    return true;
  });

  // ── Sort ──────────────────────────────────────────────────────────────────
  if (sort === "best-sellers") {
    filtered = [...filtered].sort((a, b) => (salesMap[b.id] ?? 0) - (salesMap[a.id] ?? 0));
  } else if (sort === "trending") {
    filtered = [...filtered].sort((a, b) => (trendingMap[b.id] ?? 0) - (trendingMap[a.id] ?? 0));
  } else if (sort === "price-asc") {
    filtered = [...filtered].sort((a, b) => {
      const pa = ((a.marketingAssets as MA)?.nativePrice ?? 0);
      const pb = ((b.marketingAssets as MA)?.nativePrice ?? 0);
      return pa - pb;
    });
  } else if (sort === "price-desc") {
    filtered = [...filtered].sort((a, b) => {
      const pa = ((a.marketingAssets as MA)?.nativePrice ?? 0);
      const pb = ((b.marketingAssets as MA)?.nativePrice ?? 0);
      return pb - pa;
    });
  }
  // "newest" and "free" use default DB order (createdAt desc)

  // ── Filter lists for dropdowns ────────────────────────────────────────────
  const allNiches  = Array.from(new Set(published.map((r) => r.niche))).sort();
  const allFormats = Array.from(new Set(published.map((r) => r.format))).sort();

  // ── Paginate ──────────────────────────────────────────────────────────────
  const total     = filtered.length;
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Creator names ─────────────────────────────────────────────────────────
  const userIds = Array.from(new Set(paginated.map((r) => r.userId)));
  const [brandRows, emailRows, storeRows] = await Promise.all([
    userIds.length > 0 ? db.select({ userId: brandVoiceTable.userId, brandName: brandVoiceTable.brandName }).from(brandVoiceTable).where(inArray(brandVoiceTable.userId, userIds)) : [],
    userIds.length > 0 ? db.select({ userId: profilesTable.userId, email: profilesTable.email }).from(profilesTable).where(inArray(profilesTable.userId, userIds)) : [],
    userIds.length > 0 ? db.select({ userId: storeSettingsTable.userId, showSalesCount: storeSettingsTable.showSalesCount }).from(storeSettingsTable).where(inArray(storeSettingsTable.userId, userIds)) : [],
  ]);

  const brandMap:         Record<string, string>  = Object.fromEntries(brandRows.map((r) => [r.userId, r.brandName]));
  const emailMap:         Record<string, string>  = Object.fromEntries(emailRows.map((r) => [r.userId, r.email]));
  const showSalesCountMap:Record<string, boolean> = Object.fromEntries(storeRows.map((r) => [r.userId, r.showSalesCount ?? false]));
  const profileMap: Record<string, string> = {};
  for (const uid of userIds) {
    profileMap[uid] = brandMap[uid]?.trim() || emailMap[uid]?.split("@")[0] || "Creator";
  }

  const items = paginated.map((r) => {
    const ma = (r.marketingAssets ?? {}) as MA;
    return {
      id:            r.id,
      title:         r.title,
      niche:         r.niche,
      format:        r.format,
      priceLabel:    ma.priceLabel ?? null,
      nativePrice:   ma.nativePrice ?? null,
      thumbnailUrl:  ma.coverThumbnailUrl ?? ma.bookMockupUrl ?? ma.thumbnailUrl ?? null,
      description:   (ma.productDescription ?? "").slice(0, 160),
      creatorName:   profileMap[r.userId] ?? "Creator",
      creatorUserId: r.userId,
      salesCount:    showSalesCountMap[r.userId] ? (salesMap[r.id] ?? 0) : null,
      trendingCount: trendingMap[r.id] ?? 0,
    };
  });

  return NextResponse.json({ items, total, page, pageSize: PAGE_SIZE, niches: allNiches, formats: allFormats });
}
