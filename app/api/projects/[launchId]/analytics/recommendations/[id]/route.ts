/**
 * PATCH /api/projects/[launchId]/analytics/recommendations/[id]
 * ──────────────────────────────────────────────────────────────────────────────
 * Accept, ignore, or set a recommendation to auto_apply.
 *
 * Body: { status: "accepted" | "ignored" | "auto_apply" }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type { LaunchStageResults, AnalyticsDepartment, RecommendationStatus } from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";

const VALID_STATUSES: RecommendationStatus[] = ["accepted", "ignored", "auto_apply", "pending"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ launchId: string; id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { launchId, id } = await params;
  const { status } = await req.json().catch(() => ({})) as { status?: RecommendationStatus };

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results  = project.stageResults ?? ({} as LaunchStageResults);
  const existing = results.analyticsDept ?? { posts: [], recommendations: [], reports: [] } as AnalyticsDepartment;

  let found = false;

  // Update in global recommendations list
  const updatedRecs = existing.recommendations.map(r => {
    if (r.id !== id) return r;
    found = true;
    return { ...r, status, appliedAt: status !== "ignored" ? new Date().toISOString() : undefined };
  });

  // Also update inside any report that contains this recommendation
  const updatedReports = existing.reports.map(report => ({
    ...report,
    recommendations: report.recommendations.map(r => {
      if (r.id !== id) return r;
      found = true;
      return { ...r, status, appliedAt: status !== "ignored" ? new Date().toISOString() : undefined };
    }),
  }));

  if (!found) return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });

  const updatedDept: AnalyticsDepartment = {
    ...existing,
    recommendations: updatedRecs,
    reports:         updatedReports,
  };

  await db
    .update(launchProjectsTable)
    .set({ stageResults: { ...results, analyticsDept: updatedDept }, updatedAt: new Date() })
    .where(eq(launchProjectsTable.id, launchId));

  return NextResponse.json({ updated: true, status });
}
