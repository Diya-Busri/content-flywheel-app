/**
 * Server-side helpers for the Creator Rewards system.
 * All credit-awarding goes through these functions to ensure idempotency.
 */
import { db } from "@/db/db";
import { featuredCreditEventsTable } from "@/db/schema/featured-credits-schema";
import { creatorReferralsTable } from "@/db/schema/creator-referrals-schema";
import { creatorScoresTable } from "@/db/schema/creator-scores-schema";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { productReviewsTable } from "@/db/schema/product-reviews-schema";
import { creatorFollowsTable } from "@/db/schema/creator-follows-schema";
import { productsTable } from "@/db/schema/products-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, and, sum, count, avg, sql } from "drizzle-orm";
import { REWARDS_CONFIG, SCORE_WEIGHTS, getCreatorLevel } from "./rewards-config";
import type { CreditEventType } from "@/db/schema/featured-credits-schema";

// ─── Credit balance ────────────────────────────────────────────────────────────

export async function getCreditBalance(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: sum(featuredCreditEventsTable.amountCredits) })
    .from(featuredCreditEventsTable)
    .where(eq(featuredCreditEventsTable.userId, userId));
  return Number(row?.total ?? 0);
}

// ─── Award a credit (idempotent) ───────────────────────────────────────────────

export async function awardCredit({
  userId,
  type,
  amountCredits,
  description,
  idempotencyKey,
  relatedId,
  adminUserId,
}: {
  userId: string;
  type: CreditEventType;
  amountCredits: number;
  description: string;
  idempotencyKey: string;
  relatedId?: string;
  adminUserId?: string;
}): Promise<{ awarded: boolean; eventId: string | null }> {
  try {
    const [event] = await db
      .insert(featuredCreditEventsTable)
      .values({ userId, type, amountCredits, description, idempotencyKey, relatedId, adminUserId })
      .onConflictDoNothing()
      .returning({ id: featuredCreditEventsTable.id });

    return { awarded: !!event, eventId: event?.id ?? null };
  } catch {
    return { awarded: false, eventId: null };
  }
}

// ─── Referral credit award (called from Stripe webhook on trial → paid) ────────

export async function tryAwardReferralCredit(referredUserId: string): Promise<void> {
  // 1. Find the referral record
  const [referral] = await db
    .select()
    .from(creatorReferralsTable)
    .where(
      and(
        eq(creatorReferralsTable.referredUserId, referredUserId),
        eq(creatorReferralsTable.status, "pro_converted"),
      )
    )
    .limit(1);

  // No referral or already processed
  if (!referral) return;

  // 2. Award credit to referrer
  const { awarded, eventId } = await awardCredit({
    userId:          referral.referrerUserId,
    type:            "referral_conversion",
    amountCredits:   REWARDS_CONFIG.REFERRAL_CONVERSION_CREDIT,
    description:     "Referred creator converted to Pro",
    idempotencyKey:  `ref:converted:${referredUserId}`,
    relatedId:       referral.id,
  });

  if (awarded && eventId) {
    // 3. Update referral row to credit_awarded
    await db
      .update(creatorReferralsTable)
      .set({
        status: "credit_awarded",
        creditAwardedAt: new Date(),
        creditEventId: eventId,
        updatedAt: new Date(),
      })
      .where(eq(creatorReferralsTable.id, referral.id));
  }
}

// ─── Mark referral as trial_active (called at checkout) ───────────────────────

export async function markReferralTrialActive(referredUserId: string): Promise<void> {
  await db
    .update(creatorReferralsTable)
    .set({ status: "trial_active", trialStartedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(creatorReferralsTable.referredUserId, referredUserId),
        eq(creatorReferralsTable.status, "pending_signup"),
      )
    );
}

// ─── Mark referral as pro_converted (called from Stripe webhook) ───────────────

export async function markReferralConverted(referredUserId: string): Promise<void> {
  const existing = await db
    .select({ status: creatorReferralsTable.status })
    .from(creatorReferralsTable)
    .where(eq(creatorReferralsTable.referredUserId, referredUserId))
    .limit(1);

  if (!existing[0]) return;
  if (existing[0].status === "credit_awarded") return; // already done

  await db
    .update(creatorReferralsTable)
    .set({ status: "pro_converted", convertedAt: new Date(), updatedAt: new Date() })
    .where(eq(creatorReferralsTable.referredUserId, referredUserId));

  // Immediately try to award the credit
  await tryAwardReferralCredit(referredUserId);
}

// ─── Check & award sales milestone credit ──────────────────────────────────────

export async function checkSalesMilestones(userId: string): Promise<void> {
  const [row] = await db
    .select({ cnt: count() })
    .from(productOrdersTable)
    .where(
      and(
        eq(productOrdersTable.creatorUserId, userId),
        eq(productOrdersTable.status, "completed"),
      )
    );

  const totalSales = Number(row?.cnt ?? 0);
  const milestones = Math.floor(totalSales / REWARDS_CONFIG.SALES_PER_CREDIT);

  for (let m = 1; m <= milestones; m++) {
    const threshold = m * REWARDS_CONFIG.SALES_PER_CREDIT;
    await awardCredit({
      userId,
      type:            "sales_milestone",
      amountCredits:   REWARDS_CONFIG.SALES_CREDIT,
      description:     `Reached ${threshold} verified sales`,
      idempotencyKey:  `sales:${REWARDS_CONFIG.SALES_PER_CREDIT}:${userId}:${m}`,
    });
  }
}

// ─── Check & award revenue milestone credit ────────────────────────────────────

export async function checkRevenueMilestones(userId: string): Promise<void> {
  const [row] = await db
    .select({ total: sum(productOrdersTable.amountCents) })
    .from(productOrdersTable)
    .where(
      and(
        eq(productOrdersTable.creatorUserId, userId),
        eq(productOrdersTable.status, "completed"),
      )
    );

  const totalGbp = Number(row?.total ?? 0) / 100;
  const milestones = Math.floor(totalGbp / REWARDS_CONFIG.REVENUE_PER_CREDIT_GBP);

  for (let m = 1; m <= milestones; m++) {
    const threshold = m * REWARDS_CONFIG.REVENUE_PER_CREDIT_GBP;
    await awardCredit({
      userId,
      type:            "revenue_milestone",
      amountCredits:   REWARDS_CONFIG.REVENUE_CREDIT,
      description:     `Reached £${threshold} in verified revenue`,
      idempotencyKey:  `revenue:${REWARDS_CONFIG.REVENUE_PER_CREDIT_GBP}:${userId}:${m}`,
    });
  }
}

// ─── Check & award review milestone credit ─────────────────────────────────────

export async function checkReviewMilestones(userId: string): Promise<void> {
  const [row] = await db
    .select({ cnt: count() })
    .from(productReviewsTable)
    .where(
      and(
        eq(productReviewsTable.creatorUserId, userId),
        eq(productReviewsTable.rating, 5),
        eq(productReviewsTable.approved, true),
      )
    );

  const totalReviews = Number(row?.cnt ?? 0);
  const milestones = Math.floor(totalReviews / REWARDS_CONFIG.REVIEWS_PER_CREDIT);

  for (let m = 1; m <= milestones; m++) {
    const threshold = m * REWARDS_CONFIG.REVIEWS_PER_CREDIT;
    await awardCredit({
      userId,
      type:            "review_milestone",
      amountCredits:   REWARDS_CONFIG.REVIEW_CREDIT,
      description:     `Reached ${threshold} five-star reviews`,
      idempotencyKey:  `reviews:${REWARDS_CONFIG.REVIEWS_PER_CREDIT}:${userId}:${m}`,
    });
  }
}

// ─── Recompute & cache creator score ──────────────────────────────────────────

export async function recomputeCreatorScore(userId: string): Promise<void> {
  // Gather signals in parallel
  const [salesRow, revenueRow, reviewRow, avgRatingRow, followerRow, productRow] = await Promise.all([
    db.select({ cnt: count() }).from(productOrdersTable)
      .where(and(eq(productOrdersTable.creatorUserId, userId), eq(productOrdersTable.status, "completed"))),
    db.select({ total: sum(productOrdersTable.amountCents) }).from(productOrdersTable)
      .where(and(eq(productOrdersTable.creatorUserId, userId), eq(productOrdersTable.status, "completed"))),
    db.select({ cnt: count() }).from(productReviewsTable)
      .where(and(eq(productReviewsTable.creatorUserId, userId), eq(productReviewsTable.approved, true))),
    db.select({ avg: avg(productReviewsTable.rating) }).from(productReviewsTable)
      .where(and(eq(productReviewsTable.creatorUserId, userId), eq(productReviewsTable.approved, true))),
    db.select({ cnt: count() }).from(creatorFollowsTable)
      .where(eq(creatorFollowsTable.followedId, userId)),
    db.select({ cnt: count() }).from(productsTable)
      .where(eq(productsTable.userId, userId)),
  ]);

  const salesCount    = Number(salesRow[0]?.cnt ?? 0);
  const revenueGbp    = Number(revenueRow[0]?.total ?? 0) / 100;
  const reviewCount   = Number(reviewRow[0]?.cnt ?? 0);
  const avgRating     = Number(avgRatingRow[0]?.avg ?? 0);
  const followerCount = Number(followerRow[0]?.cnt ?? 0);
  const productCount  = Number(productRow[0]?.cnt ?? 0);

  // Simple product quality proxy (0–10): has cover + description + price
  const productQuality = Math.min(10, productCount * 2);

  // Normalise each signal to 0–1
  const norm = {
    salesCount:    Math.min(1, salesCount    / 500),
    avgRating:     Math.min(1, avgRating     / 5),
    reviewCount:   Math.min(1, reviewCount   / 50),
    revenueGbp:    Math.min(1, revenueGbp    / 5000),
    followerGrowth:Math.min(1, followerCount / 500),
    productQuality:Math.min(1, productQuality / 10),
    communityScore:0,
  };

  const score = Math.round(
    norm.salesCount    * SCORE_WEIGHTS.salesCount     +
    norm.avgRating     * SCORE_WEIGHTS.avgRating      +
    norm.reviewCount   * SCORE_WEIGHTS.reviewCount    +
    norm.revenueGbp    * SCORE_WEIGHTS.revenueGbp     +
    norm.followerGrowth* SCORE_WEIGHTS.followerGrowth +
    norm.productQuality* SCORE_WEIGHTS.productQuality +
    norm.communityScore* SCORE_WEIGHTS.communityScore
  );

  const level = getCreatorLevel(salesCount).id;

  await db
    .insert(creatorScoresTable)
    .values({
      userId, score, salesCount, avgRating, reviewCount,
      revenueGbp, followerCount, productCount, productQuality,
      level, calculatedAt: new Date(), updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: creatorScoresTable.userId,
      set: {
        score, salesCount, avgRating, reviewCount,
        revenueGbp, followerCount, productCount, productQuality,
        level, calculatedAt: new Date(), updatedAt: new Date(),
      },
    });
}
