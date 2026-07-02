import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { productReviewsTable } from "@/db/schema/product-reviews-schema";
import { isNull, eq, sql, desc } from "drizzle-orm";
import CreatorMarketplaceClient from "./CreatorMarketplaceClient";

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

export async function generateMetadata({ params }: { params: { userId: string } }): Promise<Metadata> {
  const [brand] = await db
    .select({ brandName: brandVoiceTable.brandName })
    .from(brandVoiceTable)
    .where(eq(brandVoiceTable.userId, params.userId))
    .limit(1);
  const name = brand?.brandName?.trim() || "Creator";
  return {
    title: `${name} | Content Flywheel Marketplace`,
    description: `Browse digital products by ${name} on the Content Flywheel marketplace.`,
  };
}

export default async function CreatorMarketplacePage({ params }: { params: { userId: string } }) {
  const { userId } = params;

  // ── Creator info ──────────────────────────────────────────────────────────
  const [[brand], [profile], [storeSettings]] = await Promise.all([
    db.select({ brandName: brandVoiceTable.brandName }).from(brandVoiceTable).where(eq(brandVoiceTable.userId, userId)).limit(1),
    db.select({ email: profilesTable.email }).from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1),
    db.select({ storeName: storeSettingsTable.storeName, bio: storeSettingsTable.bio, profileImageUrl: storeSettingsTable.profileImageUrl, showSalesCount: storeSettingsTable.showSalesCount })
      .from(storeSettingsTable).where(eq(storeSettingsTable.userId, userId)).limit(1),
  ]);

  const creatorName = storeSettings?.storeName?.trim() || brand?.brandName?.trim() || profile?.email?.split("@")[0] || "Creator";

  // ── Products ──────────────────────────────────────────────────────────────
  const rows = await db
    .select({ id: productsTable.id, title: productsTable.title, niche: productsTable.niche, format: productsTable.format, marketingAssets: productsTable.marketingAssets, createdAt: productsTable.createdAt })
    .from(productsTable)
    .where(eq(productsTable.userId, userId))
    .orderBy(desc(productsTable.createdAt));

  const publishedRows = rows.filter((r) => {
    const ma = (r.marketingAssets ?? {}) as MA;
    return ma.isNativePublished === true && !ma.comingSoon && r.niche && !isNull(productsTable.deletedAt);
  });

  // ── Sales counts ──────────────────────────────────────────────────────────
  const productIds = publishedRows.map((r) => r.id);
  const [salesRows, ratingsRows] = productIds.length > 0 ? await Promise.all([
    db.select({ productId: productOrdersTable.productId, count: sql<number>`count(*)::int` })
      .from(productOrdersTable)
      .where(eq(productOrdersTable.status, "completed"))
      .groupBy(productOrdersTable.productId),
    db.select({
      productId: productReviewsTable.productId,
      avgRating: sql<number>`round(avg(${productReviewsTable.rating})::numeric,1)::float`,
      reviewCount: sql<number>`count(*)::int`,
    })
      .from(productReviewsTable)
      .where(eq(productReviewsTable.approved, true))
      .groupBy(productReviewsTable.productId),
  ]) : [[], []];

  const salesMap: Record<string, number> = Object.fromEntries(salesRows.map((r) => [r.productId, r.count]));
  const ratingsMap: Record<string, { avgRating: number; reviewCount: number }> = Object.fromEntries(ratingsRows.map((r) => [r.productId, { avgRating: r.avgRating, reviewCount: r.reviewCount }]));
  const showSales = storeSettings?.showSalesCount ?? false;
  const totalSales = showSales ? Object.values(salesMap).reduce((a, b) => a + b, 0) : null;

  const products = publishedRows.map((r) => {
    const ma = (r.marketingAssets ?? {}) as MA;
    return {
      id: r.id,
      title: r.title,
      niche: r.niche,
      format: r.format,
      nativePrice: ma.nativePrice ?? null,
      priceLabel: ma.priceLabel ?? null,
      thumbnailUrl: ma.coverThumbnailUrl ?? ma.bookMockupUrl ?? ma.thumbnailUrl ?? null,
      description: (ma.productDescription ?? "").slice(0, 160),
      salesCount: showSales ? (salesMap[r.id] ?? 0) : null,
      avgRating: ratingsMap[r.id]?.avgRating ?? null,
      reviewCount: ratingsMap[r.id]?.reviewCount ?? 0,
    };
  });

  return (
    <Suspense fallback={<div style={{ padding: "80px", textAlign: "center", color: "#9ca3af" }}>Loading…</div>}>
      <CreatorMarketplaceClient
        creatorName={creatorName}
        bio={storeSettings?.bio ?? null}
        profileImageUrl={storeSettings?.profileImageUrl ?? null}
        totalSales={totalSales}
        userId={userId}
        products={products}
      />
    </Suspense>
  );
}
