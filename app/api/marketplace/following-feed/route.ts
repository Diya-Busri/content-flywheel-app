import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { creatorFollowsTable } from "@/db/schema/creator-follows-schema";
import { productsTable } from "@/db/schema/products-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { eq, inArray, isNull, desc, and } from "drizzle-orm";
import type { MarketingAssets } from "@/db/schema/products-schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketplace/following-feed
 * Returns up to 12 most-recently published products from creators the user follows.
 * Returns { items: [], followingIds: [] } for unauthenticated users.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ items: [], followingIds: [] });

  // Who does this user follow?
  const follows = await db
    .select({ followedId: creatorFollowsTable.followedId })
    .from(creatorFollowsTable)
    .where(eq(creatorFollowsTable.followerId, userId));

  const followingIds = follows.map((f) => f.followedId);
  if (followingIds.length === 0) return NextResponse.json({ items: [], followingIds: [] });

  // Filter out deleted/hidden followed creators before fetching their products
  const activeFollowedProfiles = await db
    .select({ userId: profilesTable.userId })
    .from(profilesTable)
    .where(and(inArray(profilesTable.userId, followingIds), isNull(profilesTable.deletedAt)));
  const activeFollowingIds = activeFollowedProfiles.map((p) => p.userId);
  if (activeFollowingIds.length === 0) return NextResponse.json({ items: [], followingIds });

  // Their published products (not deleted, not archived, isNativePublished)
  const rows = await db
    .select({
      id: productsTable.id,
      title: productsTable.title,
      niche: productsTable.niche,
      format: productsTable.format,
      marketingAssets: productsTable.marketingAssets,
      userId: productsTable.userId,
    })
    .from(productsTable)
    .where(and(inArray(productsTable.userId, activeFollowingIds), isNull(productsTable.deletedAt)))
    .orderBy(desc(productsTable.createdAt))
    .limit(12);

  // Filter to only published, non-archived
  const published = rows.filter((r) => {
    const ma = (r.marketingAssets ?? {}) as MarketingAssets;
    return ma.isNativePublished === true && !ma.comingSoon;
  });

  if (published.length === 0) return NextResponse.json({ items: [], followingIds });

  // Creator names
  const creatorIds = Array.from(new Set(published.map((r) => r.userId)));
  const [brandRows, emailRows] = await Promise.all([
    db.select({ userId: brandVoiceTable.userId, brandName: brandVoiceTable.brandName }).from(brandVoiceTable).where(inArray(brandVoiceTable.userId, creatorIds)),
    db.select({ userId: profilesTable.userId, email: profilesTable.email }).from(profilesTable).where(inArray(profilesTable.userId, creatorIds)),
  ]);

  const brandMap = Object.fromEntries(brandRows.map((r) => [r.userId, r.brandName]));
  const emailMap = Object.fromEntries(emailRows.map((r) => [r.userId, r.email]));

  const items = published.map((r) => {
    const ma = (r.marketingAssets ?? {}) as MarketingAssets;
    return {
      id: r.id,
      title: r.title,
      niche: r.niche,
      format: r.format,
      priceLabel: ma.priceLabel ?? null,
      nativePrice: ma.nativePrice ?? null,
      thumbnailUrl: ma.coverThumbnailUrl ?? ma.bookMockupUrl ?? ma.thumbnailUrl ?? null,
      description: (ma.productDescription ?? "").slice(0, 160),
      creatorName: brandMap[r.userId]?.trim() || emailMap[r.userId]?.split("@")[0] || "Creator",
      creatorUserId: r.userId,
      salesCount: null,
      trendingCount: 0,
      avgRating: null,
      reviewCount: 0,
      wishlistCount: 0,
      featured: false,
    };
  });

  return NextResponse.json({ items, followingIds });
}
