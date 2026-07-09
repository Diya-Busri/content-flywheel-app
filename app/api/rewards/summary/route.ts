export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { featuredCreditEventsTable } from "@/db/schema/featured-credits-schema";
import { creatorReferralsTable } from "@/db/schema/creator-referrals-schema";
import { featuredProductsTable } from "@/db/schema/featured-products-schema";
import { creatorScoresTable } from "@/db/schema/creator-scores-schema";
import { eq, sum, desc } from "drizzle-orm";
import { getCreditBalance } from "@/lib/rewards-helpers";

/**
 * GET /api/rewards/summary
 * Returns:
 *  - availableCredits   (balance)
 *  - pendingReferrals   (count of referrals not yet converted)
 *  - creditHistory      (last 20 events)
 *  - activeFeatured     (current featured product if any)
 *  - creatorLevel       (level from cached score)
 *  - creatorScore       (reputation score if opted in)
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [balance, history, referrals, activeFeatured, scoreRow] = await Promise.all([
    getCreditBalance(userId),

    db.select()
      .from(featuredCreditEventsTable)
      .where(eq(featuredCreditEventsTable.userId, userId))
      .orderBy(desc(featuredCreditEventsTable.createdAt))
      .limit(20),

    db.select()
      .from(creatorReferralsTable)
      .where(eq(creatorReferralsTable.referrerUserId, userId))
      .orderBy(desc(creatorReferralsTable.createdAt)),

    db.select()
      .from(featuredProductsTable)
      .where(eq(featuredProductsTable.userId, userId))
      .limit(5),

    db.select()
      .from(creatorScoresTable)
      .where(eq(creatorScoresTable.userId, userId))
      .limit(1),
  ]);

  const now = new Date();
  const activeSlots = activeFeatured.filter(
    (f) => f.active && (!f.featuredUntil || new Date(f.featuredUntil) > now)
  );

  const pendingReferralCount = referrals.filter(
    (r) => !["credit_awarded", "expired", "rejected"].includes(r.status)
  ).length;

  const score = scoreRow[0] ?? null;

  return NextResponse.json({
    availableCredits:  Math.max(0, balance),
    pendingReferrals:  pendingReferralCount,
    creditHistory:     history,
    referrals,
    activeFeatured:    activeSlots,
    creatorLevel:      score?.level ?? "new",
    creatorScore:      score?.publicOptIn ? score.score : null,
    leaderboardOptIn:  score?.leaderboardOptIn ?? false,
    salesCount:        score?.salesCount ?? 0,
  });
}
