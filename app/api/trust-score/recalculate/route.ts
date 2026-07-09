export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { recomputeTrustScore, getTrustScore } from "@/lib/trust-score-helpers";
import { getTrustLevel } from "@/lib/trust-score-config";

/**
 * POST /api/trust-score/recalculate
 * Recalculates the calling creator's Trust Score on-demand.
 * Also called internally from webhooks (sale, review, refund, profile update).
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const trigger = (body.trigger as string) ?? "manual";

  const result = await recomputeTrustScore(userId, trigger);
  const levelMeta = getTrustLevel(result.totalScore);

  return NextResponse.json({
    ok: true,
    score:        result.totalScore,
    level:        result.level,
    levelLabel:   levelMeta.label,
    levelEmoji:   levelMeta.emoji,
    breakdown:    result.breakdown,
    recommendations: result.recommendations,
    lastCalculatedAt: result.lastCalculatedAt,
  });
}
