import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { referralsTable } from "@/db/schema/referrals-schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/referral/capture
 * Body: { referrerId: string }
 * Saves that the current user was referred by referrerId.
 * Idempotent — no-op if already captured.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const referrerId = (body.referrerId as string)?.trim();
    if (!referrerId || referrerId === userId) {
      return NextResponse.json({ ok: false });
    }

    // Check if already captured
    const [existing] = await db
      .select({ id: referralsTable.id })
      .from(referralsTable)
      .where(eq(referralsTable.referredUserId, userId))
      .limit(1);

    if (!existing) {
      await db.insert(referralsTable).values({ referrerUserId: referrerId, referredUserId: userId });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[referral/capture]", e);
    return NextResponse.json({ ok: false });
  }
}
