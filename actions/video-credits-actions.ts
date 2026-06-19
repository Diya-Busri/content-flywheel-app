"use server";

import { auth } from "@clerk/nextjs/server";
import { getProfileByUserId } from "@/db/queries/profiles-queries";
import { VIDEO_CREDIT_COST, type VideoType } from "@/lib/video-credits";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { videoCreditTransactionsTable } from "@/db/schema/video-credit-transactions-schema";
import { eq, and, gte, sql } from "drizzle-orm";

const VIDEO_TYPE_LABELS: Record<VideoType, string> = {
  brandStoryVideo: "Brand Story Video",
  cookingVideo: "AI Cooking Video",
  avatarVideo: "Avatar Promo Video",
  aiDesign: "AI Design Generator",
};

/**
 * Check if the current user has enough video credits for a given video type.
 * Returns { hasCredits: boolean; balance: number }
 */
export async function checkVideoCredits(videoType: VideoType = "brandStoryVideo") {
  const { userId } = await auth();
  if (!userId) return { hasCredits: false, balance: 0 };

  const profile = await getProfileByUserId(userId);
  const balance = profile?.videoCredits ?? 0;
  const cost = VIDEO_CREDIT_COST[videoType];
  return { hasCredits: balance >= cost, balance, cost };
}

/**
 * Atomically deduct video credits and log the transaction in a single DB transaction.
 *
 * Previous implementation had two bugs:
 *   1. Race condition: SELECT balance → compute → UPDATE allowed concurrent requests
 *      to read the same stale balance and under-deduct (or double-spend) credits.
 *   2. Silent transaction log failures: if the INSERT into video_credit_transactions
 *      failed, the profile balance was still updated but no record was created, causing
 *      the credit dashboard to show wrong "Used" and "Purchased" totals permanently.
 *
 * This version uses:
 *   - A single DB transaction so both operations succeed or both are rolled back.
 *   - An atomic SQL `UPDATE ... SET video_credits = video_credits - cost WHERE video_credits >= cost`
 *     so concurrent requests cannot over-deduct; exactly one wins if the balance is tight.
 *
 * Returns { success: boolean; newBalance: number }
 */
export async function deductVideoCredit(videoType: VideoType = "brandStoryVideo") {
  const { userId } = await auth();
  if (!userId) return { success: false, newBalance: 0 };

  const cost = VIDEO_CREDIT_COST[videoType];
  const description = VIDEO_TYPE_LABELS[videoType] ?? videoType;

  try {
    const result = await db.transaction(async (tx) => {
      // Atomic decrement — only succeeds if balance ≥ cost.
      // Using raw SQL expression prevents the read-then-write race condition.
      const updated = await tx
        .update(profilesTable)
        .set({ videoCredits: sql`video_credits - ${cost}` })
        .where(
          and(
            eq(profilesTable.userId, userId),
            gte(profilesTable.videoCredits, cost)
          )
        )
        .returning({ videoCredits: profilesTable.videoCredits });

      if (!updated[0]) {
        // Balance was insufficient (another concurrent request may have taken the last credits)
        return { success: false, newBalance: 0 };
      }

      const newBalance = updated[0].videoCredits;

      // Insert transaction record in the same DB transaction — if this fails,
      // the profile update is also rolled back, keeping everything in sync.
      await tx.insert(videoCreditTransactionsTable).values({
        userId,
        type: "usage",
        amount: cost,
        description,
      });

      return { success: true, newBalance };
    });

    if (result.success) {
      console.log(`[video-credits] Deducted ${cost} credit(s) (${description}) from ${userId}. New balance: ${result.newBalance}`);
    } else {
      // Re-read the actual balance for the return value
      const profile = await getProfileByUserId(userId);
      return { success: false, newBalance: profile?.videoCredits ?? 0 };
    }

    return result;
  } catch (err) {
    console.error("[video-credits] Deduction failed:", err);
    const profile = await getProfileByUserId(userId);
    return { success: false, newBalance: profile?.videoCredits ?? 0 };
  }
}
