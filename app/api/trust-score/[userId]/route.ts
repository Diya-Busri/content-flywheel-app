export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getTrustScore, recomputeTrustScore } from "@/lib/trust-score-helpers";
import { TRUST_FACTOR_META, getTrustLevel } from "@/lib/trust-score-config";

/**
 * GET /api/trust-score/[userId]
 * Public endpoint — returns Trust Score for display on store/marketplace pages.
 * Respects publicOptIn and adminSuppressed flags.
 * Auto-triggers recalculation if score is stale (>24h) or missing.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  let data = await getTrustScore(userId);

  // Auto-recalculate if missing or stale (> 24 hours)
  if (!data) {
    const result = await recomputeTrustScore(userId, "auto").catch(() => null);
    if (result) {
      data = {
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
  } else {
    const ageMs = Date.now() - new Date(data.lastCalculatedAt).getTime();
    if (ageMs > 24 * 60 * 60 * 1000) {
      // Stale — kick off recalculation in the background (don't await)
      recomputeTrustScore(userId, "auto_stale").catch(() => {});
    }
  }

  if (!data) return NextResponse.json({ error: "No Trust Score found" }, { status: 404 });

  const levelMeta = getTrustLevel(data.score);

  // If not opted in or admin-suppressed, return minimal public response
  if (!data.publicOptIn || data.adminSuppressed) {
    return NextResponse.json({
      userId,
      publicOptIn: false,
      adminSuppressed: data.adminSuppressed,
      message: "This creator has not enabled public reputation stats.",
    });
  }

  return NextResponse.json({
    userId,
    score:           data.score,
    level:           data.level,
    levelLabel:      levelMeta.label,
    levelEmoji:      levelMeta.emoji,
    levelColor:      levelMeta.color,
    levelTagline:    levelMeta.tagline,
    publicOptIn:     true,
    adminSuppressed: false,
    breakdown:       data.breakdown,
    factorMeta:      TRUST_FACTOR_META,
    lastCalculatedAt: data.lastCalculatedAt,
  });
}
