export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  checkSalesMilestones,
  checkRevenueMilestones,
  checkReviewMilestones,
  recomputeCreatorScore,
  awardCredit,
  getCreditBalance,
} from "@/lib/rewards-helpers";
import { db } from "@/db/db";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { creatorScoresTable } from "@/db/schema/creator-scores-schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/rewards/check-milestones
 * Runs all milestone checks for the current user and updates their score.
 * Should be called after a sale is completed, a review is approved, etc.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Run all checks in parallel
  await Promise.all([
    checkSalesMilestones(userId),
    checkRevenueMilestones(userId),
    checkReviewMilestones(userId),
    recomputeCreatorScore(userId),
    checkProfileCompleteness(userId),
  ]);

  const balance = await getCreditBalance(userId);

  return NextResponse.json({ ok: true, availableCredits: Math.max(0, balance) });
}

async function checkProfileCompleteness(userId: string): Promise<void> {
  // Award 0.25 credit once per creator for completing their profile
  const [store] = await db
    .select()
    .from(storeSettingsTable)
    .where(eq(storeSettingsTable.userId, userId))
    .limit(1);

  if (!store) return;

  const isComplete = !!(
    store.storeName?.trim() &&
    store.bio?.trim() &&
    store.profileImageUrl?.trim() &&
    store.accentColor
  );

  if (isComplete) {
    await awardCredit({
      userId,
      type:            "profile_complete",
      amountCredits:   0.25,
      description:     "Completed creator profile",
      idempotencyKey:  `profile:complete:${userId}`,
    });
  }
}
