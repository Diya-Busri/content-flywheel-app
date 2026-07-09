/**
 * Trust Score — server-side computation helpers.
 * All public-facing trust signals are computed here and saved to creator_trust_scores.
 */
import { db } from "@/db/db";
import { creatorTrustScoresTable } from "@/db/schema/creator-trust-scores-schema";
import { creatorTrustScoreHistoryTable } from "@/db/schema/creator-trust-score-history-schema";
import { creatorReputationEventsTable } from "@/db/schema/creator-reputation-events-schema";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { productReviewsTable } from "@/db/schema/product-reviews-schema";
import { creatorFollowsTable } from "@/db/schema/creator-follows-schema";
import { productsTable } from "@/db/schema/products-schema";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, and, count, avg, sql, isNull } from "drizzle-orm";
import {
  TRUST_SCORE_WEIGHTS,
  TRUST_CAPS,
  TRUST_ABUSE,
  getTrustLevel,
  type TrustLevel,
} from "./trust-score-config";
import type { MarketingAssets } from "@/db/schema/products-schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrustScoreBreakdown = {
  verifiedSales:       number; // 0–100
  avgRating:           number;
  reviewCount:         number;
  refundRate:          number;
  productCompleteness: number;
  profileCompleteness: number;
  followerGrowth:      number;
  accountAge:          number;
  communityScore:      number;
  responseTime:        number;
};

export type TrustScoreResult = {
  userId:             string;
  totalScore:         number;
  level:              TrustLevel;
  breakdown:          TrustScoreBreakdown;
  rawSignals:         Record<string, number>;
  recommendations:    string[];
  publicOptIn:        boolean;
  adminSuppressed:    boolean;
  adminOverrideScore: number | null;
  lastCalculatedAt:   Date;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Log-normalise a value. Returns 0–100. */
function logNorm(value: number, base: number): number {
  if (value <= 0 || base <= 0) return 0;
  return Math.min(100, (Math.log(value + 1) / Math.log(base + 1)) * 100);
}

/** Clamp to 0–100. */
function clamp(n: number) {
  return Math.max(0, Math.min(100, n));
}

// ─── Compute raw signals ──────────────────────────────────────────────────────

async function gatherSignals(userId: string): Promise<Record<string, number>> {
  const [
    orderStats,
    reviewStats,
    followerRow,
    products,
    storeSettings,
    profile,
  ] = await Promise.all([
    // Order stats: total, completed, refunded
    db
      .select({
        total:     count(),
        completed: sql<number>`count(*) filter (where status = 'completed')`,
        refunded:  sql<number>`count(*) filter (where status = 'refunded')`,
      })
      .from(productOrdersTable)
      .where(eq(productOrdersTable.creatorUserId, userId))
      .then((r) => r[0] ?? { total: 0, completed: 0, refunded: 0 }),

    // Review stats: count + avg rating (approved only)
    db
      .select({
        reviewCount: count(),
        avgRating:   avg(productReviewsTable.rating),
      })
      .from(productReviewsTable)
      .where(
        and(
          eq(productReviewsTable.creatorUserId, userId),
          eq(productReviewsTable.approved, true),
        )
      )
      .then((r) => r[0] ?? { reviewCount: 0, avgRating: null }),

    // Follower count
    db
      .select({ count: count() })
      .from(creatorFollowsTable)
      .where(eq(creatorFollowsTable.followedId, userId))
      .then((r) => r[0]?.count ?? 0),

    // Products (for completeness scoring)
    db
      .select({ id: productsTable.id, marketingAssets: productsTable.marketingAssets })
      .from(productsTable)
      .where(and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt)))
      .limit(50),

    // Store settings (profile completeness)
    db
      .select()
      .from(storeSettingsTable)
      .where(eq(storeSettingsTable.userId, userId))
      .limit(1)
      .then((r) => r[0] ?? null),

    // Profile (for account age)
    db
      .select({ createdAt: profilesTable.createdAt })
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1)
      .then((r) => r[0] ?? null),
  ]);

  // Derived: verified sales (completed, non-refunded)
  const verifiedSales  = Number(orderStats.completed ?? 0);
  const totalOrders    = Number(orderStats.total ?? 0);
  const refundedOrders = Number(orderStats.refunded ?? 0);
  const refundRatePct  = totalOrders > 0 ? (refundedOrders / totalOrders) * 100 : 0;
  const reviewCount    = Number(reviewStats.reviewCount ?? 0);
  const avgRating      = Number(reviewStats.avgRating ?? 0);
  const followerCount  = Number(followerRow ?? 0);

  // Account age (days)
  const accountAgeDays = profile?.createdAt
    ? Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / 86_400_000)
    : 0;

  // Product completeness — average across published products
  const publishedProducts = products.filter((p) => {
    const ma = p.marketingAssets as MarketingAssets | null;
    return ma?.isNativePublished || ma?.checkoutUrl;
  });

  let productCompletenessSum = 0;
  for (const p of publishedProducts) {
    const ma = p.marketingAssets as MarketingAssets | null;
    let pts = 0;
    if (ma?.coverThumbnailUrl || ma?.bookMockupUrl || ma?.thumbnailUrl) pts += 30;
    if (ma?.productDescription && ma.productDescription.length > 50)     pts += 25;
    if (ma?.nativePrice !== undefined && ma.nativePrice > 0)             pts += 20;
    if (ma?.previewPageUrl)                                              pts += 15;
    if ((ma?.faqs as unknown[])?.length)                                 pts += 10;
    productCompletenessSum += pts;
  }
  const productCompleteness = publishedProducts.length > 0
    ? productCompletenessSum / publishedProducts.length
    : 0;

  // Profile completeness (out of 100)
  let profilePts = 0;
  if (storeSettings?.profileImageUrl)                                     profilePts += 25;
  if (storeSettings?.bio && storeSettings.bio.length > 30)               profilePts += 20;
  if (storeSettings?.bannerImageUrl || storeSettings?.bannerGradient)    profilePts += 15;
  if (storeSettings?.storeName)                                           profilePts += 15;
  if (storeSettings?.tagline)                                             profilePts += 10;
  if (storeSettings?.showSocialLinks) {
    try {
      const socials = JSON.parse(storeSettings.socialLinks ?? "{}");
      if (Object.values(socials).some((v) => v)) profilePts += 15;
    } catch {}
  }
  const profileCompleteness = Math.min(100, profilePts);

  return {
    verifiedSales,
    totalOrders,
    refundedOrders,
    refundRatePct,
    reviewCount,
    avgRating,
    followerCount,
    accountAgeDays,
    productCompleteness,
    profileCompleteness,
  };
}

// ─── Compute breakdown scores (each 0–100) ────────────────────────────────────

function computeBreakdown(signals: Record<string, number>): TrustScoreBreakdown {
  const { verifiedSales, refundRatePct, reviewCount, avgRating,
          followerCount, accountAgeDays, productCompleteness,
          profileCompleteness } = signals;

  // Abuse protection: high refund rate caps the refundRate score hard
  const refundScore = refundRatePct >= TRUST_ABUSE.HIGH_REFUND_RATE_PCT
    ? clamp(100 - refundRatePct * 3)                    // heavy penalty
    : clamp(100 - (refundRatePct / TRUST_ABUSE.HIGH_REFUND_RATE_PCT) * 30); // gentle slope

  // avgRating needs minimum review volume before it counts in full
  const ratingWeight = reviewCount >= TRUST_ABUSE.MIN_REVIEWS_FOR_RATING ? 1 :
    reviewCount / TRUST_ABUSE.MIN_REVIEWS_FOR_RATING;
  const ratingScore = clamp(((avgRating - 1) / 4) * 100 * ratingWeight); // 1–5 → 0–100

  return {
    verifiedSales:       clamp(logNorm(verifiedSales, TRUST_CAPS.SALES_LOG_BASE)),
    avgRating:           ratingScore,
    reviewCount:         clamp(logNorm(reviewCount, TRUST_CAPS.REVIEWS_LOG_BASE)),
    refundRate:          refundScore,
    productCompleteness: clamp(productCompleteness),
    profileCompleteness: clamp(profileCompleteness),
    followerGrowth:      clamp(logNorm(followerCount, TRUST_CAPS.FOLLOWERS_LOG_BASE)),
    accountAge:          clamp((accountAgeDays / TRUST_CAPS.ACCOUNT_AGE_DAYS) * 100),
    communityScore:      0,  // placeholder — will plug in academy/challenge data
    responseTime:        50, // default middle score — no messaging stats yet
  };
}

// ─── Generate recommendations ─────────────────────────────────────────────────

function generateRecommendations(
  signals: Record<string, number>,
  breakdown: TrustScoreBreakdown,
): string[] {
  const recs: string[] = [];

  if (breakdown.profileCompleteness < 70) {
    recs.push("Complete your store profile — add a photo, bio, and banner image to build buyer confidence.");
  }
  if (breakdown.productCompleteness < 60) {
    recs.push("Improve your product listings — add cover images, detailed descriptions, and preview pages.");
  }
  if (breakdown.verifiedSales < 30) {
    recs.push("Share your store link on social media to grow your verified sales.");
  }
  if (breakdown.avgRating < 60 && signals.reviewCount >= TRUST_ABUSE.MIN_REVIEWS_FOR_RATING) {
    recs.push("Focus on delivering exceptional product quality — your average rating has room to grow.");
  }
  if (breakdown.reviewCount < 40) {
    recs.push("Ask buyers to leave a review after purchasing — reviews are your strongest trust signal.");
  }
  if (breakdown.refundRate < 60) {
    recs.push("Work to reduce your refund rate — set clear product expectations and respond to issues quickly.");
  }
  if (breakdown.followerGrowth < 20) {
    recs.push("Grow your follower base by sharing free value and promoting your creator profile.");
  }
  if (breakdown.communityScore < 30) {
    recs.push("Join creator challenges and complete academy courses to boost your community reputation.");
  }
  if (breakdown.responseTime < 60) {
    recs.push("Reply to buyer messages quickly — fast responses signal an active, supportive creator.");
  }
  if (signals.verifiedSales >= 10 && breakdown.productCompleteness >= 80) {
    recs.push("Publish another product — creators with 3+ products earn buyer trust faster.");
  }

  // Positive reinforcement if doing well
  if (recs.length === 0) {
    recs.push("You're doing great! Keep publishing quality products and engaging with your community.");
  }

  return recs.slice(0, 5); // cap at 5 suggestions
}

// ─── Compute total weighted score ─────────────────────────────────────────────

function weightedTotal(breakdown: TrustScoreBreakdown): number {
  let total = 0;
  for (const [key, weight] of Object.entries(TRUST_SCORE_WEIGHTS)) {
    const factor = breakdown[key as keyof TrustScoreBreakdown] ?? 0;
    total += factor * (weight / 100);
  }
  return Math.round(Math.min(100, Math.max(0, total)));
}

// ─── Main: recompute and save ─────────────────────────────────────────────────

export async function recomputeTrustScore(
  userId: string,
  trigger = "manual",
): Promise<TrustScoreResult> {
  const signals   = await gatherSignals(userId);
  const breakdown = computeBreakdown(signals);
  const total     = weightedTotal(breakdown);
  const level     = getTrustLevel(total);
  const recommendations = generateRecommendations(signals, breakdown);

  const now = new Date();

  // Upsert the main row
  await db
    .insert(creatorTrustScoresTable)
    .values({
      userId,
      totalScore:       total,
      level:            level.id,
      breakdown,
      recommendations,
      rawSignals:       signals,
      lastCalculatedAt: now,
    })
    .onConflictDoUpdate({
      target: creatorTrustScoresTable.userId,
      set: {
        totalScore:       total,
        level:            level.id,
        breakdown,
        recommendations,
        rawSignals:       signals,
        lastCalculatedAt: now,
        updatedAt:        now,
      },
    });

  // Append history row
  await db.insert(creatorTrustScoreHistoryTable).values({
    userId,
    score:     total,
    level:     level.id,
    breakdown,
    trigger,
    calculatedAt: now,
  });

  // Log a reputation event
  await db.insert(creatorReputationEventsTable).values({
    userId,
    eventType:   "score_recalculated",
    description: `Trust Score recalculated: ${total}/100 (${level.label}) — trigger: ${trigger}`,
    metadata:    { trigger, score: total, level: level.id },
  });

  return {
    userId,
    totalScore:         total,
    level:              level.id,
    breakdown,
    rawSignals:         signals,
    recommendations,
    publicOptIn:        false, // caller fetches from DB if needed
    adminSuppressed:    false,
    adminOverrideScore: null,
    lastCalculatedAt:   now,
  };
}

// ─── Get current Trust Score (read-only, no recalculate) ─────────────────────

export async function getTrustScore(userId: string): Promise<{
  score: number;
  level: TrustLevel;
  breakdown: TrustScoreBreakdown;
  recommendations: string[];
  publicOptIn: boolean;
  adminSuppressed: boolean;
  adminOverrideScore: number | null;
  lastCalculatedAt: Date;
} | null> {
  const [row] = await db
    .select()
    .from(creatorTrustScoresTable)
    .where(eq(creatorTrustScoresTable.userId, userId))
    .limit(1);

  if (!row) return null;

  const displayScore = row.adminOverrideScore ?? row.totalScore;

  return {
    score:              Math.round(displayScore),
    level:              row.level as TrustLevel,
    breakdown:          row.breakdown as TrustScoreBreakdown,
    recommendations:    row.recommendations as string[],
    publicOptIn:        row.publicOptIn,
    adminSuppressed:    row.adminSuppressed,
    adminOverrideScore: row.adminOverrideScore ?? null,
    lastCalculatedAt:   row.lastCalculatedAt,
  };
}

// ─── Log a reputation event ───────────────────────────────────────────────────

export async function logReputationEvent(params: {
  userId: string;
  eventType: string;
  description: string;
  scoreDelta?: number;
  metadata?: Record<string, unknown>;
  adminUserId?: string;
}): Promise<void> {
  await db.insert(creatorReputationEventsTable).values({
    userId:      params.userId,
    eventType:   params.eventType,
    description: params.description,
    scoreDelta:  params.scoreDelta,
    metadata:    params.metadata ?? {},
    adminUserId: params.adminUserId,
  });
}

// ─── Set public opt-in ────────────────────────────────────────────────────────

export async function setTrustScoreOptIn(
  userId: string,
  publicOptIn: boolean,
): Promise<void> {
  await db
    .insert(creatorTrustScoresTable)
    .values({
      userId,
      totalScore: 0,
      level: "building",
      breakdown: {},
      recommendations: [],
      rawSignals: {},
      publicOptIn,
      lastCalculatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: creatorTrustScoresTable.userId,
      set: { publicOptIn, updatedAt: new Date() },
    });
}

// ─── Get score history (last N rows) ─────────────────────────────────────────

export async function getTrustScoreHistory(userId: string, limit = 30) {
  return db
    .select({
      score:        creatorTrustScoreHistoryTable.score,
      level:        creatorTrustScoreHistoryTable.level,
      trigger:      creatorTrustScoreHistoryTable.trigger,
      calculatedAt: creatorTrustScoreHistoryTable.calculatedAt,
    })
    .from(creatorTrustScoreHistoryTable)
    .where(eq(creatorTrustScoreHistoryTable.userId, userId))
    .orderBy(creatorTrustScoreHistoryTable.calculatedAt)
    .limit(limit);
}

// ─── Get reputation events ────────────────────────────────────────────────────

export async function getReputationEvents(userId: string, limit = 20) {
  return db
    .select()
    .from(creatorReputationEventsTable)
    .where(eq(creatorReputationEventsTable.userId, userId))
    .orderBy(sql`${creatorReputationEventsTable.createdAt} DESC`)
    .limit(limit);
}
