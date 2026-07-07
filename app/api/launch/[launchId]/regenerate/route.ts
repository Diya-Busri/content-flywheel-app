/**
 * POST /api/launch/[launchId]/regenerate
 * ─────────────────────────────────────────
 * Clears a specific stage (and all downstream stages) from stageResults,
 * then resets the launch status so the execution page can re-run from
 * that stage.
 *
 * Stage dependency order: research → product → design → marketing → store
 * Clearing "design" also clears marketing and store.
 *
 * Body: { stage: LaunchStageId }
 *
 * The client should redirect to /dashboard/launch/[launchId] after success.
 * The execution page will detect the cleared stage and re-run the pipeline.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type { LaunchStageId, LaunchStageResults } from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";

/* Stage order — used to derive which downstream stages to also clear */
const STAGE_ORDER: LaunchStageId[] = ["research", "product", "design", "marketing", "store"];

/* Overall progress checkpoint per stage (for reset) */
const STAGE_PROGRESS: Record<string, number> = {
  research:  0,
  product:   20,
  design:    40,
  marketing: 60,
  store:     80,
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ launchId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { launchId } = await params;
    const body = await request.json().catch(() => ({})) as { stage?: string };
    const stage = body.stage as LaunchStageId | undefined;

    if (!stage || !STAGE_ORDER.includes(stage)) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }

    /* Load the project */
    const [project] = await db
      .select()
      .from(launchProjectsTable)
      .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
      .limit(1);

    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    /* Determine which stages to clear (the requested stage + all downstream) */
    const fromIdx   = STAGE_ORDER.indexOf(stage);
    const toClear   = new Set(STAGE_ORDER.slice(fromIdx));

    /* Build cleared stageResults */
    const existing = (project.stageResults ?? {}) as LaunchStageResults;
    const cleared: LaunchStageResults = { ...existing };

    for (const s of toClear) {
      delete (cleared as Record<string, unknown>)[s];
    }

    const resetProgress = STAGE_PROGRESS[stage] ?? 0;

    /* Reset project state */
    const [updated] = await db
      .update(launchProjectsTable)
      .set({
        status:       "running",
        currentStage: stage,
        progress:     resetProgress,
        stageResults: cleared,
        updatedAt:    new Date(),
      })
      .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
      .returning();

    return NextResponse.json({
      success:   true,
      stage,
      cleared:   Array.from(toClear),
      progress:  resetProgress,
      project:   updated,
    });

  } catch (err) {
    console.error("[launch/regenerate]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
