/**
 * POST /api/admin/motion-graphics/agent-runs/:runId/approve-storyboard
 *
 * Accepts the final (user-edited) storyboard and saves or creates a
 * motion_graphics_project. Returns the project ID and editor URL.
 *
 * Authorization (Correction 6): admin + run belongs to user + correct gate.
 * CAS guards against double-click saving.
 *
 * Correction 10: The exact storyboard submitted by the user is saved.
 *   No regeneration happens during save.
 * Correction 12: Saves to motion_graphics_projects so the project opens
 *   in the existing storyboard editor and Remotion preview.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/motion-graphics/guard";
import { currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import {
  getMgRunForUser,
  transitionMgRunStatus,
  startMgStep,
  completeMgStep,
  failMgStep,
  getLatestAttemptNumber,
  getMgRunWithSteps,
} from "@/lib/motion-graphics/mg-run-store";
import { mgSaveAgentTool } from "@/lib/motion-graphics/tools/mg_save_agent";
import type { StoryboardScene } from "@/lib/motion-graphics/types";

const TAG = "[mg-agent-runs:approve-storyboard]";

type Ctx = { params: Promise<{ runId: string }> };

// Accept the edited storyboard
const SceneSchema = z.object({
  id:              z.string(),
  startTime:       z.number(),
  endTime:         z.number(),
  narration:       z.string(),
  onScreenText:    z.string(),
  visualType:      z.string(),
  animationPreset: z.string(),
  transitionPreset: z.string(),
  assetSuggestions: z.array(z.string()).default([]),
  soundEffect:     z.string().optional(),
  emphasisWords:   z.array(z.string()).default([]),
  assetUrl:        z.string().optional(),
  missingAsset:    z.boolean().optional(),
  redditAuthor:    z.string().optional(),
  anonymiseAuthor: z.boolean().optional(),
});

const BodySchema = z.object({
  /** All 5 edited scenes. Exactly as the user sees them — saved verbatim. */
  scenes: z.array(SceneSchema).min(1).max(20),
  /** Optional: link to an existing project instead of creating a new one. */
  existingProjectId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest, { params }: Ctx) {
  // Authorization
  const denied = await requireAdmin();
  if (denied) return denied;

  const user = await currentUser();
  const userId = user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { runId } = await params;

  // Confirm ownership + state
  const run = await getMgRunForUser(userId, runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  if (run.status !== "awaiting_storyboard_approval" || run.currentGate !== "storyboard_review") {
    const existing = await getMgRunWithSteps(userId, runId);
    return NextResponse.json(existing ?? { error: "Run not found" });
  }
  if (!run.shortForm) {
    return NextResponse.json({ error: "Run has no storyboard" }, { status: 422 });
  }

  // Parse edited storyboard
  let body: z.infer<typeof BodySchema>;
  try {
    const raw = await request.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return NextResponse.json({ error: `Invalid storyboard: ${issues}` }, { status: 400 });
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // CAS: awaiting_storyboard_approval → saving
  const casToSaving = await transitionMgRunStatus(
    userId, runId,
    ["awaiting_storyboard_approval"], "saving",
    { currentGate: null },
    ["storyboard_review"]
  );
  if (!casToSaving) {
    const existing = await getMgRunWithSteps(userId, runId);
    return NextResponse.json(existing ?? { error: "Run not found" });
  }

  const ctx = { userId, runId };
  const saveAttempt = (await getLatestAttemptNumber(runId, "mg_save_agent")) + 1;
  const saveStepId = await startMgStep(runId, "mg_save_agent", saveAttempt, {
    sceneCount: body.scenes.length,
    hasExistingProject: !!body.existingProjectId,
  });

  // Build the approved shortForm with user-edited scenes
  const approvedShortForm = {
    ...run.shortForm,
    scenes: body.scenes as StoryboardScene[],
    durationSeconds: body.scenes.reduce(
      (acc, s) => acc + Math.max(s.endTime - s.startTime, 0),
      0
    ),
  };

  const saveResult = await mgSaveAgentTool.execute(ctx, {
    existingProjectId: body.existingProjectId,
    contentMode:    run.contentMode,
    name:           run.shortForm.title || `${run.contentMode} — ${new Date().toLocaleDateString("en-GB")}`,
    aspectRatio:    run.aspectRatio,
    cfMention:      run.cfMention,
    targetAudience: run.targetAudience,
    mainOpinion:    run.mainOpinion,
    desiredCta:     run.desiredCta,
    videoDuration:  run.videoDuration,
    tone:           run.tone,
    sourceUrl:      run.sourceUrl,
    shortForm:      approvedShortForm,
  });

  if (!saveResult.success) {
    await failMgStep(saveStepId, saveResult.error);
    await transitionMgRunStatus(
      userId, runId,
      ["saving"], "failed",
      { error: saveResult.error }
    );
    console.error(TAG, `Save agent failed for run ${runId}:`, saveResult.error);
    return NextResponse.json({ error: saveResult.error }, { status: 500 });
  }

  const { projectId } = saveResult.data;
  await completeMgStep(saveStepId, { projectId });

  // Mark completed and link project
  await transitionMgRunStatus(
    userId, runId,
    ["saving"], "completed",
    { projectId, error: null }
  );

  console.log(TAG, `Run ${runId} completed → project ${projectId}`);

  const result = await getMgRunWithSteps(userId, runId);
  const projectUrl = `/dashboard/admin/motion-graphics-studio/projects/${projectId}`;
  return NextResponse.json({ ...result, projectId, projectUrl });
}
