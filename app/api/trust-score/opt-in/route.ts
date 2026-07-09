export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { setTrustScoreOptIn, recomputeTrustScore, getTrustScore } from "@/lib/trust-score-helpers";

/**
 * POST /api/trust-score/opt-in
 * Body: { publicOptIn: boolean }
 * Toggles whether the creator's Trust Score is publicly visible.
 * Triggers a recalculation first if no score exists yet.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (typeof body.publicOptIn !== "boolean") {
    return NextResponse.json({ error: "publicOptIn (boolean) required" }, { status: 400 });
  }

  // Ensure a score exists before opting in
  const existing = await getTrustScore(userId);
  if (!existing) {
    await recomputeTrustScore(userId, "opt_in").catch(() => {});
  }

  await setTrustScoreOptIn(userId, body.publicOptIn);

  return NextResponse.json({ ok: true, publicOptIn: body.publicOptIn });
}

/**
 * GET /api/trust-score/opt-in
 * Returns the current opt-in state and full score for the authenticated creator.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let score = await getTrustScore(userId);
  if (!score) {
    const result = await recomputeTrustScore(userId, "first_load").catch(() => null);
    if (result) {
      score = {
        score:              result.totalScore,
        level:              result.level,
        breakdown:          result.breakdown,
        recommendations:    result.recommendations,
        publicOptIn:        false,
        adminSuppressed:    false,
        adminOverrideScore: null,
        lastCalculatedAt:   result.lastCalculatedAt,
      };
    }
  }

  const history = score ? await import("@/lib/trust-score-helpers").then(m =>
    m.getTrustScoreHistory(userId, 30)
  ) : [];

  const events = score ? await import("@/lib/trust-score-helpers").then(m =>
    m.getReputationEvents(userId, 10)
  ) : [];

  return NextResponse.json({ score, history, events });
}
