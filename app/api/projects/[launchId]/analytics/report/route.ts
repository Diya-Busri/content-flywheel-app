/**
 * POST /api/projects/[launchId]/analytics/report
 * ──────────────────────────────────────────────────────────────────────────────
 * Generates today's Daily Intelligence Report from all analysed posts.
 * Saves to analyticsDept.reports (newest first, capped at 30).
 * Merges strategic memory facts into Business Memory.
 *
 * Body: { date?: string }  — YYYY-MM-DD, defaults to today
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type { LaunchStageResults, AnalyticsDepartment } from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";
import { generateDailyReport, extractAnalyticsMemoryFacts } from "@/lib/analytics-ai";
import { mergeMemoryFacts } from "@/lib/memory-context";

export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ launchId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { launchId } = await params;
  const { date: reqDate } = await req.json().catch(() => ({})) as { date?: string };
  const date = reqDate ?? new Date().toISOString().slice(0, 10);

  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results  = project.stageResults ?? ({} as LaunchStageResults);
  const existing = results.analyticsDept ?? { posts: [], recommendations: [], reports: [] } as AnalyticsDepartment;

  // Use all analysed posts (reports cover the full picture, not just today's)
  const analysedPosts = existing.posts.filter(p => p.analysedAt);

  // Generate report (works even with 0 posts — gives a "no data yet" narrative)
  const report = await generateDailyReport(analysedPosts, results, date);

  // Prepend to history, cap at 30
  const updatedReports = [report, ...existing.reports.filter(r => r.date !== date)].slice(0, 30);

  // Merge recommendations into global recommendations list
  const existingRecIds = new Set(existing.recommendations.map(r => r.id));
  const newRecs = report.recommendations.filter(r => !existingRecIds.has(r.id));
  const updatedRecs = [...newRecs, ...existing.recommendations].slice(0, 100);

  // Memory facts from report insights
  const memFacts   = extractAnalyticsMemoryFacts(report.insights, report.recommendations);
  const existingMem = results.memory ?? { facts: [] };
  const mergedFacts = mergeMemoryFacts(existingMem.facts, memFacts);
  const updatedMem  = { ...existingMem, facts: mergedFacts, lastExtractedAt: new Date().toISOString() };

  const updatedDept: AnalyticsDepartment = {
    ...existing,
    reports:          updatedReports,
    recommendations:  updatedRecs,
    lastReportAt:     new Date().toISOString(),
  };

  await db
    .update(launchProjectsTable)
    .set({
      stageResults: { ...results, analyticsDept: updatedDept, memory: updatedMem },
      updatedAt:    new Date(),
    })
    .where(eq(launchProjectsTable.id, launchId));

  return NextResponse.json({ report, analyticsDept: updatedDept });
}
