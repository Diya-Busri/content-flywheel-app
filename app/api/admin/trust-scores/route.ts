export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { creatorTrustScoresTable } from "@/db/schema/creator-trust-scores-schema";
import { creatorReputationEventsTable } from "@/db/schema/creator-reputation-events-schema";
import { eq, desc, sql } from "drizzle-orm";
import {
  recomputeTrustScore,
  logReputationEvent,
} from "@/lib/trust-score-helpers";
import { getTrustLevel } from "@/lib/trust-score-config";

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
function isAdmin(userId: string) { return ADMIN_IDS.includes(userId); }

/**
 * GET /api/admin/trust-scores
 * Returns overview of all creator Trust Scores + recent reputation events.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId || !isAdmin(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [scores, recentEvents] = await Promise.all([
    db
      .select()
      .from(creatorTrustScoresTable)
      .orderBy(desc(creatorTrustScoresTable.totalScore))
      .limit(100),

    db
      .select()
      .from(creatorReputationEventsTable)
      .orderBy(desc(creatorReputationEventsTable.createdAt))
      .limit(200),
  ]);

  return NextResponse.json({ scores, recentEvents });
}

/**
 * POST /api/admin/trust-scores
 * Actions: recalculate | suppress | unsuppress | override | clear-override | hide | show
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId || !isAdmin(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { action, targetUserId } = body as { action: string; targetUserId: string };

  if (!targetUserId) return NextResponse.json({ error: "targetUserId required" }, { status: 400 });

  switch (action) {
    case "recalculate": {
      const result = await recomputeTrustScore(targetUserId, `admin:${userId}`);
      const levelMeta = getTrustLevel(result.totalScore);
      return NextResponse.json({ ok: true, score: result.totalScore, levelLabel: levelMeta.label });
    }

    case "suppress": {
      await db
        .update(creatorTrustScoresTable)
        .set({ adminSuppressed: true, updatedAt: new Date() })
        .where(eq(creatorTrustScoresTable.userId, targetUserId));
      await logReputationEvent({
        userId: targetUserId,
        eventType: "admin_flag",
        description: "Trust Score suppressed by admin — hidden from public display.",
        adminUserId: userId,
      });
      return NextResponse.json({ ok: true });
    }

    case "unsuppress": {
      await db
        .update(creatorTrustScoresTable)
        .set({ adminSuppressed: false, updatedAt: new Date() })
        .where(eq(creatorTrustScoresTable.userId, targetUserId));
      await logReputationEvent({
        userId: targetUserId,
        eventType: "admin_flag",
        description: "Trust Score suppression lifted by admin.",
        adminUserId: userId,
      });
      return NextResponse.json({ ok: true });
    }

    case "override": {
      const { overrideScore, reason } = body;
      const score = Number(overrideScore);
      if (isNaN(score) || score < 0 || score > 100) {
        return NextResponse.json({ error: "overrideScore must be 0–100" }, { status: 400 });
      }
      const level = getTrustLevel(score);
      await db
        .update(creatorTrustScoresTable)
        .set({ adminOverrideScore: score, level: level.id, updatedAt: new Date() })
        .where(eq(creatorTrustScoresTable.userId, targetUserId));
      await logReputationEvent({
        userId: targetUserId,
        eventType: "admin_override",
        description: `Trust Score manually overridden to ${score}/100 by admin. Reason: ${reason ?? "unspecified"}`,
        adminUserId: userId,
        metadata: { overrideScore: score, reason },
      });
      return NextResponse.json({ ok: true });
    }

    case "clear-override": {
      await db
        .update(creatorTrustScoresTable)
        .set({ adminOverrideScore: sql`NULL`, updatedAt: new Date() })
        .where(eq(creatorTrustScoresTable.userId, targetUserId));
      await logReputationEvent({
        userId: targetUserId,
        eventType: "admin_override",
        description: "Admin override cleared — score reverts to computed value.",
        adminUserId: userId,
      });
      return NextResponse.json({ ok: true });
    }

    case "hide": {
      await db
        .update(creatorTrustScoresTable)
        .set({ publicOptIn: false, updatedAt: new Date() })
        .where(eq(creatorTrustScoresTable.userId, targetUserId));
      return NextResponse.json({ ok: true });
    }

    case "show": {
      await db
        .update(creatorTrustScoresTable)
        .set({ publicOptIn: true, updatedAt: new Date() })
        .where(eq(creatorTrustScoresTable.userId, targetUserId));
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
