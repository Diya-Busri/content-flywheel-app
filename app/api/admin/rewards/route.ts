export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { featuredCreditEventsTable } from "@/db/schema/featured-credits-schema";
import { creatorReferralsTable } from "@/db/schema/creator-referrals-schema";
import { featuredProductsTable } from "@/db/schema/featured-products-schema";
import { creatorScoresTable } from "@/db/schema/creator-scores-schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { awardCredit } from "@/lib/rewards-helpers";

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

function isAdmin(userId: string) {
  return ADMIN_IDS.includes(userId);
}

/**
 * GET /api/admin/rewards
 * Returns overview data for the admin rewards page.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId || !isAdmin(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [recentEvents, referralChains, activeFeatured, topScores] = await Promise.all([
    db.select()
      .from(featuredCreditEventsTable)
      .orderBy(desc(featuredCreditEventsTable.createdAt))
      .limit(100),

    db.select()
      .from(creatorReferralsTable)
      .orderBy(desc(creatorReferralsTable.createdAt))
      .limit(200),

    db.select()
      .from(featuredProductsTable)
      .where(eq(featuredProductsTable.active, true))
      .orderBy(desc(featuredProductsTable.createdAt)),

    db.select()
      .from(creatorScoresTable)
      .orderBy(desc(creatorScoresTable.score))
      .limit(50),
  ]);

  return NextResponse.json({ recentEvents, referralChains, activeFeatured, topScores });
}

/**
 * POST /api/admin/rewards
 * Actions: manual-credit | revoke-credit | potw | feature | unfeature | reject-referral
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId || !isAdmin(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { action } = body as { action: string };

  switch (action) {
    case "manual-credit": {
      const { targetUserId, amountCredits, description } = body;
      if (!targetUserId || !amountCredits) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

      const { awarded } = await awardCredit({
        userId:         targetUserId,
        type:           "manual_admin",
        amountCredits:  Number(amountCredits),
        description:    description ?? `Manual credit by admin`,
        idempotencyKey: `admin:manual:${userId}:${targetUserId}:${Date.now()}`,
        adminUserId:    userId,
      });
      return NextResponse.json({ ok: awarded });
    }

    case "revoke-credit": {
      const { targetUserId, amountCredits, reason } = body;
      if (!targetUserId || !amountCredits) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

      const { awarded } = await awardCredit({
        userId:         targetUserId,
        type:           "revoked",
        amountCredits:  -Math.abs(Number(amountCredits)),
        description:    reason ?? `Credits revoked by admin`,
        idempotencyKey: `admin:revoke:${userId}:${targetUserId}:${Date.now()}`,
        adminUserId:    userId,
      });
      return NextResponse.json({ ok: awarded });
    }

    case "potw": {
      // Product of the Week — +2 credits
      const { targetUserId, productId, weekId } = body;
      if (!targetUserId || !weekId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

      const { awarded } = await awardCredit({
        userId:         targetUserId,
        type:           "product_of_week",
        amountCredits:  2.0,
        description:    `Product of the Week — Week ${weekId}`,
        idempotencyKey: `potw:${weekId}:${targetUserId}`,
        relatedId:      productId,
        adminUserId:    userId,
      });
      return NextResponse.json({ ok: awarded });
    }

    case "feature": {
      // Admin-force-feature a product (no credit cost)
      const { productId, creatorUserId, durationDays } = body;
      if (!productId || !creatorUserId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

      const days = Number(durationDays ?? 7);
      const featuredUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      await db
        .insert(featuredProductsTable)
        .values({ productId, userId: creatorUserId, niche: "general", active: true, featuredUntil })
        .onConflictDoUpdate({
          target: featuredProductsTable.productId,
          set: { active: true, featuredUntil, updatedAt: new Date() },
        });
      return NextResponse.json({ ok: true, featuredUntil });
    }

    case "unfeature": {
      const { productId } = body;
      if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });
      await db
        .update(featuredProductsTable)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(featuredProductsTable.productId, productId));
      return NextResponse.json({ ok: true });
    }

    case "reject-referral": {
      const { referralId } = body;
      if (!referralId) return NextResponse.json({ error: "referralId required" }, { status: 400 });
      await db
        .update(creatorReferralsTable)
        .set({ status: "rejected", updatedAt: new Date() })
        .where(eq(creatorReferralsTable.id, referralId));
      return NextResponse.json({ ok: true });
    }

    case "leaderboard-visibility": {
      const { targetUserId, leaderboardOptIn } = body;
      if (!targetUserId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      await db
        .update(creatorScoresTable)
        .set({ leaderboardOptIn: !!leaderboardOptIn, updatedAt: new Date() })
        .where(eq(creatorScoresTable.userId, targetUserId));
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
