export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { creatorReferralsTable } from "@/db/schema/creator-referrals-schema";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/rewards/referrals
 * Returns all referrals made by the current user with statuses.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const referrals = await db
    .select()
    .from(creatorReferralsTable)
    .where(eq(creatorReferralsTable.referrerUserId, userId));

  return NextResponse.json({ referrals });
}

/**
 * POST /api/rewards/referrals
 * Capture a referral when a new user signs up via referral link.
 * Body: { referrerId: string, referredEmail?: string, ipHash?: string }
 *
 * Replaces the old /api/referral/capture endpoint.
 * NO CREDIT IS AWARDED HERE — only when the user converts to paid Pro.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ ok: false });

    const body = await req.json().catch(() => ({}));
    const referrerId   = (body.referrerId   as string)?.trim();
    const referredEmail = (body.referredEmail as string)?.trim() ?? null;
    const ipHash       = (body.ipHash        as string)?.trim() ?? null;

    // Self-referral check
    if (!referrerId || referrerId === userId) {
      return NextResponse.json({ ok: false, reason: "self_referral" });
    }

    // Idempotent — no-op if already captured
    const [existing] = await db
      .select({ id: creatorReferralsTable.id })
      .from(creatorReferralsTable)
      .where(eq(creatorReferralsTable.referredUserId, userId))
      .limit(1);

    if (existing) return NextResponse.json({ ok: true, alreadyCaptured: true });

    await db.insert(creatorReferralsTable).values({
      referrerUserId: referrerId,
      referredUserId: userId,
      referredEmail,
      ipHash,
      status: "pending_signup",
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[rewards/referrals POST]", e);
    return NextResponse.json({ ok: false });
  }
}
