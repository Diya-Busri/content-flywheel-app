/**
 * POST /api/projects/[launchId]/analytics/learn
 * ──────────────────────────────────────────────────────────────────────────────
 * Runs the full Continuous Learning Cycle:
 *   1. Stratify all analysed posts into top/bottom performers
 *   2. AI extracts new structured lessons (hooks, CTAs, timing, format, etc.)
 *   3. Merge new lessons into existing ones (increment evidence counts)
 *   4. Compute per-platform metric trends over time
 *   5. Promote high-confidence lessons into Business Memory
 *   6. Save todaysSummary ("What the company learned today")
 *
 * Called automatically by the analyze route when >= 2 posts are analysed.
 * Can also be triggered manually.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type { LaunchStageResults, AnalyticsDepartment } from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";
import { runLearningCycle, buildTrends, mergeLessons } from "@/lib/learning-loop";
import { mergeMemoryFacts } from "@/lib/memory-context";

export const maxDuration = 120;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ launchId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { launchId } = await params;

  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results  = project.stageResults ?? ({} as LaunchStageResults);
  const existing = results.analyticsDept ?? { posts: [], recommendations: [], reports: [] } as AnalyticsDepartment;

  // Only use analysed posts (have AI insights + real metrics)
  const analysedPosts = existing.posts.filter(p => p.analysedAt && p.insights.length > 0);

  if (analysedPosts.length < 1) {
    return NextResponse.json({ analyticsDept: existing, message: "Not enough analysed posts yet" });
  }

  // 1. Run AI learning cycle
  const { lessons: newLessons, todaysSummary, memoryFacts } = await runLearningCycle(
    analysedPosts,
    results,
    existing.lessons ?? [],
  );

  // 2. Merge lessons (dedup + reinforce evidence)
  const mergedLessons = mergeLessons(existing.lessons ?? [], newLessons);

  // 3. Compute metric trends
  const trends = buildTrends(existing.posts);

  // 4. Merge memory facts
  const existingMem = results.memory ?? { facts: [] };
  const mergedFacts = mergeMemoryFacts(existingMem.facts, memoryFacts);
  const updatedMem  = {
    ...existingMem,
    facts:            mergedFacts,
    lastExtractedAt:  new Date().toISOString(),
  };

  const updatedDept: AnalyticsDepartment = {
    ...existing,
    lessons:        mergedLessons,
    trends,
    todaysSummary,
    learningCycles: (existing.learningCycles ?? 0) + 1,
    lastLearnedAt:  new Date().toISOString(),
  };

  await db
    .update(launchProjectsTable)
    .set({
      stageResults: { ...results, analyticsDept: updatedDept, memory: updatedMem },
      updatedAt:    new Date(),
    })
    .where(eq(launchProjectsTable.id, launchId));

  return NextResponse.json({
    analyticsDept:  updatedDept,
    newLessons:     newLessons.length,
    totalLessons:   mergedLessons.length,
    trends:         trends.length,
    todaysSummary,
  });
}
