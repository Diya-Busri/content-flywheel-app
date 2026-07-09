/**
 * GET /api/projects/[launchId]/business-os
 * ──────────────────────────────────────────────────────────────────────────────
 * Business Operating System — morning executive briefing.
 *
 * Aggregates:
 *   • Yesterday's published posts (from analyticsDept)
 *   • Revenue from Stripe / Lemon Squeezy / Gumroad
 *   • Platform view deltas (current vs 7-day prior average from existing posts)
 *   • Best performing content
 *   • Top lesson from Learning Loop
 *   • Critical/High growth task counts
 *   • Growth score
 *
 * Caches by date — skips regeneration if dailyBriefing.date === today.
 * maxDuration=60 (revenue + delta aggregation can be slow on cold starts).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import { eq, and, ne } from "drizzle-orm";
import type { DailyBriefing, PlatformDelta, MarketingManagerId, GrowthTask } from "@/db/schema/launch-schema";
import { fetchRevenueSnapshot } from "@/lib/revenue-bridge";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

function todayStr() {
  return new Date().toISOString().split("T")[0]!;
}

function greet(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function calcDelta(current: number, previous: number): PlatformDelta["direction"] {
  if (previous === 0) return current > 0 ? "up" : "flat";
  const pct = ((current - previous) / previous) * 100;
  if (pct >  5) return "up";
  if (pct < -5) return "down";
  return "flat";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { launchId: string } },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { launchId } = params;
  const today = todayStr();

  /* ── Load project ─────────────────────────────────────────────────────────── */
  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(
      eq(launchProjectsTable.id,     launchId),
      eq(launchProjectsTable.userId, userId),
      ne(launchProjectsTable.status, "queued"),
    ));

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results = (project.stageResults ?? {}) as Record<string, unknown>;

  /* ── Cache hit — return existing briefing if already generated today ────── */
  const existing = (results.dailyBriefing ?? null) as DailyBriefing | null;
  if (existing?.date === today) {
    return NextResponse.json({ briefing: existing, cached: true });
  }

  /* ── Build briefing from live data ──────────────────────────────────────── */

  const analytics  = (results.analyticsDept  as { posts?: Array<{ publishedAt?: string; metrics?: { views?: number }; platform?: string; content?: string }> } | undefined);
  const learning   = (results.learningLoop   as { lessons?: Array<{ lesson?: string; confidence?: string }> } | undefined);
  const growthData = (results.growthTasks    as GrowthTask[] | undefined) ?? [];

  /* Published yesterday */
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const todayMidnight = new Date(yesterday);
  todayMidnight.setDate(todayMidnight.getDate() + 1);

  const posts = analytics?.posts ?? [];
  const publishedYesterday = posts.filter(p => {
    if (!p.publishedAt) return false;
    const d = new Date(p.publishedAt);
    return d >= yesterday && d < todayMidnight;
  }).length;

  /* Platform deltas — compare recent 7 days vs prior 7 days */
  const platformMap = new Map<string, { recentViews: number; priorViews: number }>();
  const now = Date.now();
  const sevenDays  = 7  * 24 * 60 * 60 * 1000;
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;

  for (const p of posts) {
    const ts  = p.publishedAt ? new Date(p.publishedAt).getTime() : 0;
    const age = now - ts;
    const pl  = p.platform ?? "unknown";
    if (!platformMap.has(pl)) platformMap.set(pl, { recentViews: 0, priorViews: 0 });
    const entry = platformMap.get(pl)!;
    const views = p.metrics?.views ?? 0;
    if (age <= sevenDays)                    entry.recentViews += views;
    else if (age > sevenDays && age <= fourteenDays) entry.priorViews  += views;
  }

  const platformDeltas: PlatformDelta[] = [];
  for (const [platform, { recentViews, priorViews }] of platformMap) {
    const dir = calcDelta(recentViews, priorViews);
    const changePercent = priorViews === 0
      ? (recentViews > 0 ? 100 : 0)
      : Math.round(((recentViews - priorViews) / priorViews) * 100);
    platformDeltas.push({
      platform:     platform as MarketingManagerId,
      metric:       "views",
      current:      recentViews,
      previous:     priorViews,
      changePercent,
      direction:    dir,
    });
  }

  /* Best content */
  const bestPost = posts.reduce<typeof posts[number] | null>((best, p) => {
    if (!best) return p;
    return (p.metrics?.views ?? 0) > (best.metrics?.views ?? 0) ? p : best;
  }, null);

  const bestContent = bestPost ? {
    content:     (bestPost.content ?? "").slice(0, 120),
    platform:    (bestPost.platform ?? "tiktok") as MarketingManagerId,
    metric:      "views",
    value:       bestPost.metrics?.views ?? 0,
    publishedAt: bestPost.publishedAt ?? new Date().toISOString(),
  } : null;

  /* Top lesson */
  const highConfidence = learning?.lessons?.filter(l => l.confidence === "high");
  const topLesson = (highConfidence?.length ? highConfidence : learning?.lessons ?? [])
    .slice(-1)[0]?.lesson ?? null;

  /* Task counts */
  const pendingTasks  = growthData.filter(t => t.status === "pending" || t.status === "in_progress");
  const criticalTasks = pendingTasks.filter(t => t.priority === "critical").length;
  const highTasks     = pendingTasks.filter(t => t.priority === "high").length;

  /* Growth score */
  const upDeltas   = platformDeltas.filter(d => d.direction === "up").length;
  const downDeltas = platformDeltas.filter(d => d.direction === "down").length;
  let growthScore: DailyBriefing["growthScore"];
  let growthScoreReason: string;

  if (upDeltas > downDeltas && upDeltas >= 2) {
    growthScore = "strong";
    growthScoreReason = `${upDeltas} platforms up vs ${downDeltas} down this week`;
  } else if (upDeltas > downDeltas) {
    growthScore = "improving";
    growthScoreReason = `${upDeltas} platform${upDeltas !== 1 ? "s" : ""} trending up`;
  } else if (downDeltas > upDeltas) {
    growthScore = "declining";
    growthScoreReason = `${downDeltas} platform${downDeltas !== 1 ? "s" : ""} showing reduced views`;
  } else {
    growthScore = "flat";
    growthScoreReason = "Performance stable across platforms";
  }

  /* Revenue */
  let revenueSales  = 0;
  let revenueAmount = 0;
  let currency      = "gbp";
  try {
    const snapshot    = await fetchRevenueSnapshot("yesterday");
    revenueSales      = snapshot.totalSales;
    revenueAmount     = snapshot.totalRevenue;
    currency          = snapshot.currency;
  } catch { /* store not configured — zero values */ }

  /* Assemble briefing */
  const briefing: DailyBriefing = {
    date:               today,
    greeting:           greet(),
    publishedYesterday,
    revenue:            { sales: revenueSales, amount: revenueAmount, currency },
    platformDeltas,
    bestContent,
    topLesson,
    criticalTasks,
    highTasks,
    growthScore,
    growthScoreReason,
    generatedAt:        new Date().toISOString(),
  };

  /* Cache to DB */
  try {
    const updatedResults = { ...results, dailyBriefing: briefing };
    await db
      .update(launchProjectsTable)
      .set({ stageResults: updatedResults as unknown as typeof launchProjectsTable.$inferInsert["stageResults"] })
      .where(and(
        eq(launchProjectsTable.id,     launchId),
        eq(launchProjectsTable.userId, userId),
      ));
  } catch { /* best-effort cache */ }

  return NextResponse.json({ briefing, cached: false });
}
