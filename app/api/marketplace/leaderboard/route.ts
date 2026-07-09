export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { creatorScoresTable } from "@/db/schema/creator-scores-schema";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { productsTable } from "@/db/schema/products-schema";
import { creatorFollowsTable } from "@/db/schema/creator-follows-schema";
import { eq, desc, sql, and, count, isNull } from "drizzle-orm";
import { getCreatorLevel } from "@/lib/rewards-config";

export type LeaderboardTab =
  | "top-sellers"
  | "highest-revenue"
  | "fastest-growing"
  | "highest-rated"
  | "most-followed"
  | "creator-of-week";

const VALID_TABS: LeaderboardTab[] = [
  "top-sellers", "highest-revenue", "fastest-growing",
  "highest-rated", "most-followed", "creator-of-week",
];

/**
 * GET /api/marketplace/leaderboard?tab=top-sellers&limit=10
 * Public leaderboard — only shows opted-in creators.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tab   = (searchParams.get("tab") ?? "top-sellers") as LeaderboardTab;
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "10", 10));

  if (!VALID_TABS.includes(tab)) {
    return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
  }

  // Only opted-in creators
  let orderCol: Parameters<typeof desc>[0];
  switch (tab) {
    case "highest-revenue":   orderCol = creatorScoresTable.revenueGbp;    break;
    case "fastest-growing":   orderCol = creatorScoresTable.followerCount;  break;
    case "highest-rated":     orderCol = creatorScoresTable.avgRating;      break;
    case "most-followed":     orderCol = creatorScoresTable.followerCount;  break;
    case "creator-of-week":   orderCol = creatorScoresTable.score;          break;
    default:                  orderCol = creatorScoresTable.salesCount;     break;
  }

  const rows = await db
    .select({
      userId:       creatorScoresTable.userId,
      score:        creatorScoresTable.score,
      salesCount:   creatorScoresTable.salesCount,
      avgRating:    creatorScoresTable.avgRating,
      reviewCount:  creatorScoresTable.reviewCount,
      revenueGbp:   creatorScoresTable.revenueGbp,
      followerCount:creatorScoresTable.followerCount,
      level:        creatorScoresTable.level,
      storeName:    storeSettingsTable.storeName,
      profileImage: storeSettingsTable.profileImageUrl,
      accentColor:  storeSettingsTable.accentColor,
    })
    .from(creatorScoresTable)
    .innerJoin(profilesTable, and(
      eq(profilesTable.userId, creatorScoresTable.userId),
      isNull(profilesTable.deletedAt),     // exclude deleted accounts
    ))
    .leftJoin(storeSettingsTable, eq(storeSettingsTable.userId, creatorScoresTable.userId))
    .where(eq(creatorScoresTable.leaderboardOptIn, true))
    .orderBy(desc(orderCol))
    .limit(limit);

  const entries = rows.map((r, i) => ({
    rank:          i + 1,
    userId:        r.userId,
    displayName:   r.storeName ?? "Creator",
    profileImage:  r.profileImage,
    accentColor:   r.accentColor ?? "#f97316",
    level:         r.level,
    levelLabel:    getCreatorLevel(r.salesCount).label,
    levelEmoji:    getCreatorLevel(r.salesCount).emoji,
    salesCount:    r.salesCount,
    revenueGbp:    r.revenueGbp,
    avgRating:     r.avgRating,
    reviewCount:   r.reviewCount,
    followerCount: r.followerCount,
    score:         r.score,
  }));

  return NextResponse.json({ tab, entries });
}
