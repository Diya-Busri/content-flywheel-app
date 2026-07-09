export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { creatorScoresTable } from "@/db/schema/creator-scores-schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/marketplace/opt-in
 * Body: { leaderboardOptIn?: boolean, publicOptIn?: boolean }
 * Toggle whether this creator appears on the public leaderboard / shows their score.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const leaderboardOptIn = body.leaderboardOptIn as boolean | undefined;
  const publicOptIn      = body.publicOptIn      as boolean | undefined;

  const updateSet: Record<string, unknown> = { updatedAt: new Date() };
  if (leaderboardOptIn !== undefined) updateSet.leaderboardOptIn = leaderboardOptIn;
  if (publicOptIn      !== undefined) updateSet.publicOptIn      = publicOptIn;

  await db
    .insert(creatorScoresTable)
    .values({
      userId,
      score: 0, salesCount: 0, avgRating: 0, reviewCount: 0,
      revenueGbp: 0, followerCount: 0, productCount: 0, productQuality: 0,
      level: "new",
      leaderboardOptIn: leaderboardOptIn ?? false,
      publicOptIn:      publicOptIn      ?? false,
      calculatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: creatorScoresTable.userId,
      set: updateSet,
    });

  return NextResponse.json({ ok: true });
}
