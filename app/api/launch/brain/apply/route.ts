/**
 * POST /api/launch/brain/apply
 * ─────────────────────────────────────────────────────────────────────────────
 * Applies an automatable Business Brain recommendation by:
 *   1. Saving the fixInstruction to project memory so agents can use it
 *   2. Clearing the target stage (+ all downstream stages) from stageResults
 *   3. Clearing the cached brain result so it re-runs fresh after the pipeline
 *   4. Resetting project status to "running" at the appropriate stage
 *
 * The client then redirects to /dashboard/launch/[launchId] which auto-runs
 * the pipeline from the cleared stage, applying the fixInstruction context.
 *
 * Body: {
 *   launchId:       string
 *   stage:          "research" | "product" | "design" | "marketing" | "store"
 *   fixInstruction?: string    — extra context injected into the re-run agent
 * }
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type { LaunchStageId, LaunchStageResults, LaunchMemory } from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";

/* Stage dependency order — clearing a stage also clears all downstream stages */
const STAGE_ORDER: LaunchStageId[] = ["research", "product", "design", "marketing", "store"];

/* Progress checkpoint to reset to when clearing a stage */
const STAGE_PROGRESS: Record<string, number> = {
  research:  0,
  product:   20,
  design:    40,
  marketing: 60,
  store:     80,
};

interface ApplyBody {
  launchId?:       string;
  stage?:          string;
  fixInstruction?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({})) as ApplyBody;
    const { launchId, stage, fixInstruction } = body;

    if (!launchId) return NextResponse.json({ error: "launchId required" }, { status: 400 });
    if (!stage || !STAGE_ORDER.includes(stage as LaunchStageId)) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }

    /* Load project */
    const [project] = await db
      .select()
      .from(launchProjectsTable)
      .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
      .limit(1);

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    /* Determine which stages to clear */
    const fromIdx  = STAGE_ORDER.indexOf(stage as LaunchStageId);
    const toClear  = new Set(STAGE_ORDER.slice(fromIdx));

    /* Clear targeted stages from stageResults, also clear brain so it re-runs fresh */
    const existing = (project.stageResults ?? {}) as LaunchStageResults;
    const cleared: LaunchStageResults = { ...existing };

    for (const s of toClear) {
      delete (cleared as Record<string, unknown>)[s];
    }
    // Always clear brain so it re-analyses after the fix
    delete (cleared as Record<string, unknown>).brain;

    /* Save fixInstruction into project memory so agents can read it */
    const existingMemory = (project.memory ?? {}) as LaunchMemory & Record<string, unknown>;
    const updatedMemory: LaunchMemory & Record<string, unknown> = {
      ...existingMemory,
      ...(fixInstruction ? { fixInstruction, fixStage: stage } : {}),
    };

    const resetProgress = STAGE_PROGRESS[stage] ?? 0;

    /* Reset project — ready for pipeline re-run from the cleared stage */
    await db
      .update(launchProjectsTable)
      .set({
        status:       "running",
        currentStage: stage as LaunchStageId,
        progress:     resetProgress,
        stageResults: cleared,
        memory:       updatedMemory,
        updatedAt:    new Date(),
      })
      .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)));

    return NextResponse.json({
      success:     true,
      stage,
      cleared:     Array.from(toClear),
      redirectUrl: `/dashboard/launch/${launchId}`,
    });

  } catch (err) {
    console.error("[brain/apply]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
