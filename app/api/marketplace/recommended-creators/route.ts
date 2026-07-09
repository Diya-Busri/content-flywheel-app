export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { creatorFollowsTable } from "@/db/schema/creator-follows-schema";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";

/**
 * GET /api/marketplace/recommended-creators
 * Returns up to 12 active creators to discover, excluding ones the user already follows.
 * Sorted by published product count (desc).
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();

  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "12"), 24);

  // Get IDs of creators the current user already follows (skip if not authed)
  let alreadyFollowing = new Set<string>();
  if (userId) {
    const following = await db
      .select({ followedId: creatorFollowsTable.followedId })
      .from(creatorFollowsTable)
      .where(eq(creatorFollowsTable.followerId, userId))
      .catch(() => []);
    alreadyFollowing = new Set(following.map((r) => r.followedId));
  }

  // Count published products per creator (not deleted, not archived)
  const productCounts = await db
    .select({
      userId: productsTable.userId,
      count: sql<number>`count(*)::int`,
    })
    .from(productsTable)
    .where(and(isNull(productsTable.deletedAt), isNull(productsTable.archivedAt)))
    .groupBy(productsTable.userId)
    .having(sql`count(*) >= 1`)
    .catch(() => []);

  // Filter: exclude the viewer, exclude already-followed, must have published products
  const eligibleUserIds = productCounts
    .filter((r) => r.userId !== userId && !alreadyFollowing.has(r.userId))
    .sort((a, b) => b.count - a.count)
    .slice(0, 40) // fetch more than needed to allow for inactive-seller filtering
    .map((r) => r.userId);

  if (eligibleUserIds.length === 0) {
    return NextResponse.json({ creators: [] });
  }

  const productCountMap: Record<string, number> = {};
  for (const r of productCounts) productCountMap[r.userId] = r.count;

  // Fetch profile info (membership/status for active-seller check + deletedAt for safety)
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const [profiles, brandRows, storeRows, followerRows] = await Promise.all([
    db.select({ userId: profilesTable.userId, email: profilesTable.email, membership: profilesTable.membership, status: profilesTable.status, deletedAt: profilesTable.deletedAt, hiddenFromMarketplace: profilesTable.hiddenFromMarketplace })
      .from(profilesTable)
      .where(and(inArray(profilesTable.userId, eligibleUserIds), isNull(profilesTable.deletedAt))),
    db.select({ userId: brandVoiceTable.userId, brandName: brandVoiceTable.brandName })
      .from(brandVoiceTable)
      .where(inArray(brandVoiceTable.userId, eligibleUserIds)),
    db.select({ userId: storeSettingsTable.userId, profileImageUrl: storeSettingsTable.profileImageUrl, bio: storeSettingsTable.bio, storeName: storeSettingsTable.storeName, accentColor: storeSettingsTable.accentColor })
      .from(storeSettingsTable)
      .where(inArray(storeSettingsTable.userId, eligibleUserIds)),
    // Follower counts
    db.select({ followedId: creatorFollowsTable.followedId, cnt: sql<number>`count(*)::int` })
      .from(creatorFollowsTable)
      .where(inArray(creatorFollowsTable.followedId, eligibleUserIds))
      .groupBy(creatorFollowsTable.followedId),
  ]);

  const profileMap    = Object.fromEntries(profiles.map((p) => [p.userId, p]));
  const brandMap      = Object.fromEntries(brandRows.map((r) => [r.userId, r.brandName]));
  const storeMap      = Object.fromEntries(storeRows.map((r) => [r.userId, r]));
  const followerMap   = Object.fromEntries(followerRows.map((r) => [r.followedId, Number(r.cnt)]));

  // Filter to active, non-deleted, non-hidden sellers only
  const creators = eligibleUserIds
    .filter((uid) => {
      const p = profileMap[uid];
      if (!p) return false; // not in map means deleted (we filtered above)
      if (p.hiddenFromMarketplace) return false;
      const isAdmin = adminEmail.length > 0 && (p.email ?? "").trim().toLowerCase() === adminEmail;
      const isActive = p.membership === "pro" && ["active", "trialing"].includes((p.status ?? "").toLowerCase());
      return isAdmin || isActive;
    })
    .slice(0, limit)
    .map((uid) => {
      const profile = profileMap[uid];
      const store   = storeMap[uid];
      const brand   = brandMap[uid];
      const displayName = store?.storeName?.trim() || brand?.trim() || profile?.email?.split("@")[0] || "Creator";
      return {
        userId:         uid,
        displayName,
        bio:            store?.bio ?? null,
        profileImageUrl: store?.profileImageUrl ?? null,
        accentColor:    store?.accentColor ?? "#f97316",
        productCount:   productCountMap[uid] ?? 0,
        followerCount:  followerMap[uid] ?? 0,
      };
    });

  return NextResponse.json({ creators });
}
