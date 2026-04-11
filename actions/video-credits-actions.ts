"use server";

import { auth } from "@clerk/nextjs/server";
import { getProfileByUserId, updateProfile } from "@/db/queries/profiles-queries";
import { VIDEO_CREDIT_COST, type VideoType } from "@/lib/video-credits";
import { db } from "@/db/db";
import { videoCreditTransactionsTable } from "@/db/schema/video-credit-transactions-schema";

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
 * Deduct video credits for the current user.
 * Call this AFTER a video has been successfully generated.
 * Returns { success: boolean; newBalance: number }
 */
export async function deductVideoCredit(videoType: VideoType = "brandStoryVideo") {
  const { userId } = await auth();
  if (!userId) return { success: false, newBalance: 0 };

  const profile = await getProfileByUserId(userId);
  const current = profile?.videoCredits ?? 0;
  const cost = VIDEO_CREDIT_COST[videoType];

  if (current < cost) return { success: false, newBalance: current };

  const newBalance = current - cost;
  await updateProfile(userId, { videoCredits: newBalance });

  // Log the transaction
  try {
    await db.insert(videoCreditTransactionsTable).values({
      userId,
      type: "usage",
      amount: cost,
      description: VIDEO_TYPE_LABELS[videoType] ?? videoType,
    });
  } catch (err) {
    console.error("[video-credits] Failed to log usage transaction:", err);
  }

  console.log(`[video-credits] Deducted ${cost} credit(s) from ${userId}. New balance: ${newBalance}`);
  return { success: true, newBalance };
}
