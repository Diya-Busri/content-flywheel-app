/**
 * POST /api/projects/[launchId]/analytics/analyze
 * ──────────────────────────────────────────────────────────────────────────────
 * Runs AI analysis on unanalysed posts (or a specific post).
 * Generates qualitative insights per post, merges facts into Business Memory.
 *
 * Body: { postId?: string }   — if omitted, analyses all unanalysed posts (max 10)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type { LaunchStageResults, AnalyticsDepartment } from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";
import { analyzePost, extractAnalyticsMemoryFacts } from "@/lib/analytics-ai";
import { mergeMemoryFacts } from "@/lib/memory-context";
import { runLearningCycle, buildTrends, mergeLessons } from "@/lib/learning-loop";

export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ launchId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { launchId } = await params;
  const { postId } = await req.json().catch(() => ({})) as { postId?: string };

  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results  = project.stageResults ?? ({} as LaunchStageResults);
  const existing = results.analyticsDept ?? { posts: [], recommendations: [], reports: [] } as AnalyticsDepartment;

  // Determine which posts to analyse
  let toAnalyse = postId
    ? existing.posts.filter(p => p.id === postId)
    : existing.posts.filter(p => !p.analysedAt).slice(0, 10); // max 10 per call

  if (toAnalyse.length === 0) {
    return NextResponse.json({ analyticsDept: existing, analysed: 0 });
  }

  const allNewFacts: ReturnType<typeof mergeMemoryFacts>[0][] = [];

  const analysedPosts = await Promise.all(
    toAnalyse.map(async post => {
      try {
        const { insights, memoryFacts } = await analyzePost(post, results);
        allNewFacts.push(...memoryFacts);
        return { ...post, insights, analysedAt: new Date().toISOString() };
      } catch {
        return post; // keep original if AI fails
      }
    }),
  );

  // Merge back
  const analysedIds = new Set(analysedPosts.map(p => p.id));
  const updatedPosts = existing.posts.map(p =>
    analysedIds.has(p.id) ? (analysedPosts.find(a => a.id === p.id) ?? p) : p,
  );

  // Memory update
  const existingMem  = results.memory ?? { facts: [] };
  const mergedFacts  = mergeMemoryFacts(existingMem.facts, allNewFacts);
  const updatedMem   = { ...existingMem, facts: mergedFacts, lastExtractedAt: new Date().toISOString() };

  const updatedDept: AnalyticsDepartment = {
    ...existing,
    posts:           updatedPosts,
    lastAnalysedAt:  new Date().toISOString(),
  };

  await db
    .update(launchProjectsTable)
    .set({
      stageResults: { ...results, analyticsDept: updatedDept, memory: updatedMem },
      updatedAt:    new Date(),
    })
    .where(eq(launchProjectsTable.id, launchId));

  // Auto-trigger learning cycle when >= 2 posts are now analysed
  const nowAnalysed = updatedDept.posts.filter(p => p.analysedAt && p.insights.length > 0).length;
  let finalDept     = updatedDept;
  let finalMem      = updatedMem;

  if (nowAnalysed >= 2) {
    try {
      const { lessons: newLessons, todaysSummary, memoryFacts: learnFacts } = await runLearningCycle(
        updatedDept.posts.filter(p => p.analysedAt),
        { ...results, analyticsDept: updatedDept, memory: updatedMem },
        updatedDept.lessons ?? [],
      );
      const mergedLessons = mergeLessons(updatedDept.lessons ?? [], newLessons);
      const trends        = buildTrends(updatedDept.posts);
      const mergedLFacts  = mergeMemoryFacts(updatedMem.facts, learnFacts);

      finalMem  = { ...updatedMem, facts: mergedLFacts, lastExtractedAt: new Date().toISOString() };
      finalDept = {
        ...updatedDept,
        lessons:        mergedLessons,
        trends,
        todaysSummary,
        learningCycles: (updatedDept.learningCycles ?? 0) + 1,
        lastLearnedAt:  new Date().toISOString(),
      };

      await db
        .update(launchProjectsTable)
        .set({ stageResults: { ...results, analyticsDept: finalDept, memory: finalMem }, updatedAt: new Date() })
        .where(eq(launchProjectsTable.id, launchId));
    } catch { /* learning is best-effort — don't fail the whole analyze */ }
  }

  return NextResponse.json({ analyticsDept: finalDept, analysed: analysedPosts.length });
}
