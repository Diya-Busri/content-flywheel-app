import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { productReviewsTable } from "@/db/schema/product-reviews-schema";
import { featuredProductsTable } from "@/db/schema/featured-products-schema";
import { productWishlistsTable } from "@/db/schema/product-wishlists-schema";
import { isNull, isNotNull, inArray, desc, gte, eq, sql, and, gt, not } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Returns true if a seller profile has an active subscription. */
function isSellerActive(profile: { membership: string | null; status: string | null } | undefined): boolean {
  if (!profile) return false;
  const status = (profile.status ?? "").toLowerCase();
  return profile.membership === "pro" && (status === "active" || status === "trialing");
}

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
  const newThisWeek   = searchParams.get("newThisWeek") === "1";
  const minPrice      = searchParams.get("minPrice") ? parseInt(searchParams.get("minPrice")!) * 100 : null; // convert £ → pence
  const maxPrice      = searchParams.get("maxPrice") ? parseInt(searchParams.get("maxPrice")!) * 100 : null;
  const minRating     = searchParams.get("minRating") ? parseFloat(searchParams.get("minRating")!) : null;
  const PAGE_SIZE     = newThisWeek ? 12 : 24;

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

  // ── Fetch all non-deleted products ────────────────────────────────────────
  const rows = await db
    .select({
      id: productsTable.id,
      title: productsTable.title,
      niche: productsTable.niche,
      format: productsTable.format,
      marketingAssets: productsTable.marketingAssets,
      userId: productsTable.userId,
      createdAt: productsTable.createdAt,
      status: productsTable.status,
    })
    .from(productsTable)
    .where(and(
      isNull(productsTable.deletedAt),
      isNull(productsTable.archivedAt),
      isNull(productsTable.removedAt),       // admin-removed products never appear
      isNull(productsTable.moderationStatus), // admin-hidden or suspended products never appear
    ))
    .orderBy(desc(productsTable.createdAt));

  // ── Seller status filter: only active subscriptions ───────────────────────
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const allUserIds = Array.from(new Set(rows.map((r) => r.userId)));
  const sellerProfileRows = allUserIds.length > 0
    ? await db
        .select({ userId: profilesTable.userId, membership: profilesTable.membership, status: profilesTable.status, email: profilesTable.email })
        .from(profilesTable)
        .where(inArray(profilesTable.userId, allUserIds))
    : [];

  const sellerProfileMap: Record<string, typeof sellerProfileRows[0]> = {};
  for (const p of sellerProfileRows) sellerProfileMap[p.userId] = p;

  const activeSellerIds = new Set(
    sellerProfileRows
      .filter((p) => {
        const isAdminUser = adminEmail.length > 0 && (p.email ?? "").trim().toLowerCase() === adminEmail;
        return isAdminUser || isSellerActive(p);
      })
      .map((p) => p.userId)
  );

  // ── Apply publish + seller-active + asset validity filters ────────────────
  const nowMs = Date.now();
  const published = rows.filter((r) => {
    const ma = (r.marketingAssets ?? {}) as MA;
    // Must be explicitly published to native store
    if (ma.isNativePublished !== true) return false;
    // Coming-soon products are not purchasable yet
    if (ma.comingSoon) return false;
    // Sale window expired — treat as unpublished
    if (ma.saleEndsAt && new Date(ma.saleEndsAt).getTime() < nowMs) return false;
    // Seller must have an active subscription (or be the admin)
    if (!activeSellerIds.has(r.userId)) return false;
    // Must have at least one usable cover image
    if (!ma.coverThumbnailUrl && !ma.bookMockupUrl && !ma.thumbnailUrl) return false;
    return true;
  });

  // ── Fetch sales counts (all-time + last 7 days) + ratings + wishlist counts ─
  const publishedIds = published.map((r) => r.id);
  const [allTimeSales, trendingSales, ratingsRows, wishlistRows] = await Promise.all([
    db.select({ productId: productOrdersTable.productId, count: sql<number>`count(*)::int` })
      .from(productOrdersTable)
      .where(eq(productOrdersTable.status, "completed"))
      .groupBy(productOrdersTable.productId),

    db.select({ productId: productOrdersTable.productId, count: sql<number>`count(*)::int` })
      .from(productOrdersTable)
      .where(gte(productOrdersTable.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
      .groupBy(productOrdersTable.productId),

    db.select({
      productId: productReviewsTable.productId,
      avgRating: sql<number>`round(avg(${productReviewsTable.rating})::numeric, 1)::float`,
      reviewCount: sql<number>`count(*)::int`,
    })
      .from(productReviewsTable)
      .where(eq(productReviewsTable.approved, true))
      .groupBy(productReviewsTable.productId),

    // Wishlist save counts per product
    publishedIds.length > 0
      ? db.select({ productId: productWishlistsTable.productId, count: sql<number>`count(*)::int` })
          .from(productWishlistsTable)
          .where(inArray(productWishlistsTable.productId, publishedIds))
          .groupBy(productWishlistsTable.productId)
      : Promise.resolve([]),
  ]);

  const salesMap:    Record<string, number> = {};
  const trendingMap: Record<string, number> = {};
  const ratingsMap:  Record<string, { avgRating: number; reviewCount: number }> = {};
  const wishlistMap: Record<string, number> = {};
  for (const r of allTimeSales)  salesMap[r.productId]    = r.count;
  for (const r of trendingSales) trendingMap[r.productId] = r.count;
  for (const r of ratingsRows)   ratingsMap[r.productId]  = { avgRating: r.avgRating, reviewCount: r.reviewCount };
  for (const r of wishlistRows)  wishlistMap[r.productId] = r.count;

  // ── Text / niche / format / free / newThisWeek filter ───────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let filtered = published.filter((r) => {
    const ma = (r.marketingAssets ?? {}) as MA;
    if (newThisWeek && new Date(r.createdAt) < sevenDaysAgo) return false;
    if (sort === "free" && (ma.nativePrice ?? 0) !== 0) return false;
    if (minPrice !== null && (ma.nativePrice ?? 0) < minPrice) return false;
    if (maxPrice !== null && (ma.nativePrice ?? 0) > maxPrice) return false;
    if (minRating !== null) {
      const rating = ratingsMap[r.id]?.avgRating ?? null;
      if (rating === null || rating < minRating) return false;
    }
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

  // ── Featured products (pin to top on page 1) ──────────────────────────────
  const now = new Date();
  const featuredRows = await db
    .select({ productId: featuredProductsTable.productId })
    .from(featuredProductsTable)
    .where(
      and(
        eq(featuredProductsTable.active, true),
        gt(featuredProductsTable.featuredUntil, now)
      )
    );
  const featuredIds = new Set(featuredRows.map((r) => r.productId));

  // On page 1, sort featured items to the front
  if (page === 1 && featuredIds.size > 0) {
    filtered = [
      ...filtered.filter((r) => featuredIds.has(r.id)),
      ...filtered.filter((r) => !featuredIds.has(r.id)),
    ];
  }

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
      avgRating:     ratingsMap[r.id]?.avgRating ?? null,
      reviewCount:   ratingsMap[r.id]?.reviewCount ?? 0,
      wishlistCount: wishlistMap[r.id] ?? 0,
      featured:      featuredIds.has(r.id),
    };
  });

  return NextResponse.json({ items, total, page, pageSize: PAGE_SIZE, niches: allNiches, formats: allFormats });
}
