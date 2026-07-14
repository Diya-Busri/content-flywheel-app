/**
 * POST /api/admin/motion-graphics/agent-runs/:runId/approve-plan
 *
 * Accepts optional edits to the plan, then runs Phase 2:
 *   mg_script_agent → mg_storyboard_agent → awaiting_storyboard_approval
 *
 * Authorization (Correction 6): admin + run belongs to user + run is at awaiting_plan_approval.
 * CAS ensures only one request can start generation — concurrent doubles get null back.
 *
 * Correction 10: User edits (angle, hook, lesson, CTA, CF level, deliverables) are
 * merged into the plan before generation. The merged plan is the source of truth.
 *
 * Correction 5: checkSpendLimit is called inside each tool, immediately before
 * each provider request. This route confirms state before dispatching tools.
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
import { mgScriptAgentTool } from "@/lib/motion-graphics/tools/mg_script_agent";
import { mgStoryboardAgentTool } from "@/lib/motion-graphics/tools/mg_storyboard_agent";
import type { MgPlan } from "@/lib/motion-graphics/agent-types";

const TAG = "[mg-agent-runs:approve-plan]";
const SOURCE_PREVIEW_MAX = 3000;

type Ctx = { params: Promise<{ runId: string }> };

// Fields the user can edit at plan review (Correction 10)
const BodySchema = z.object({
  recommendedAngle:   z.string().max(500).optional(),
  selectedHook:       z.string().max(300).optional(),
  mainLesson:         z.string().max(500).optional(),
  suggestedCta:       z.string().max(200).optional(),
  cfIntegrationLevel: z.enum(["off", "subtle", "direct"]).optional(),
  deliverables:       z.array(z.string()).optional(),
});

export async function POST(request: NextRequest, { params }: Ctx) {
  // Authorization (Correction 6)
  const denied = await requireAdmin();
  if (denied) return denied;

  const user = await currentUser();
  const userId = user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { runId } = await params;

  // Confirm run exists and belongs to user
  const run = await getMgRunForUser(userId, runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  // Confirm run is in the expected state (Correction 5)
  if (run.status !== "awaiting_plan_approval" || run.currentGate !== "plan_review") {
    const result = await getMgRunWithSteps(userId, runId);
    return NextResponse.json(result ?? { error: "Run not found" });
  }

  if (!run.plan) {
    return NextResponse.json({ error: "Run has no plan" }, { status: 422 });
  }

  // Parse optional edits
  let edits: z.infer<typeof BodySchema> = {};
  try {
    const raw = await request.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (parsed.success) edits = parsed.data;
  } catch {
    // edits remain empty — proceed with original plan
  }

  // Merge user edits into plan (Correction 10: edited plan is source of truth)
  const approvedPlan: MgPlan = {
    ...run.plan,
    ...(edits.recommendedAngle   !== undefined ? { recommendedAngle: edits.recommendedAngle }     : {}),
    ...(edits.selectedHook        !== undefined ? { selectedHook: edits.selectedHook }             : {}),
    ...(edits.mainLesson          !== undefined ? { mainLesson: edits.mainLesson }                 : {}),
    ...(edits.suggestedCta        !== undefined ? { suggestedCta: edits.suggestedCta }             : {}),
    ...(edits.cfIntegrationLevel  !== undefined ? { cfIntegrationLevel: edits.cfIntegrationLevel } : {}),
    ...(edits.deliverables        !== undefined ? { deliverables: edits.deliverables }             : {}),
  };

  // CAS: awaiting_plan_approval → scripting (only one winner)
  const casToScripting = await transitionMgRunStatus(
    userId, runId,
    ["awaiting_plan_approval"], "scripting",
    { plan: approvedPlan, currentGate: null },
    ["plan_review"]
  );

  if (!casToScripting) {
    // Another request already won — return current state
    const existing = await getMgRunWithSteps(userId, runId);
    return NextResponse.json(existing ?? { error: "Run not found" });
  }

  const ctx = { userId, runId };
  const sourcePreview = run.sourceText.slice(0, SOURCE_PREVIEW_MAX);

  // ── Script Agent ──────────────────────────────────────────────────────────
  const scriptAttempt = (await getLatestAttemptNumber(runId, "mg_script_agent")) + 1;
  const scriptStepId = await startMgStep(runId, "mg_script_agent", scriptAttempt, {
    cfIntegrationLevel: approvedPlan.cfIntegrationLevel,
    sourcePreviewLength: sourcePreview.length,
  });

  const scriptResult = await mgScriptAgentTool.execute(ctx, {
    sourcePreview,
    plan: {
      recommendedAngle:   approvedPlan.recommendedAngle,
      selectedHook:       approvedPlan.selectedHook,
      mainLesson:         approvedPlan.mainLesson,
      suggestedCta:       approvedPlan.suggestedCta,
      cfIntegrationLevel: approvedPlan.cfIntegrationLevel,
      analysis: {
        coreProblem:    approvedPlan.analysis.coreProblem,
        emotionalAngle: approvedPlan.analysis.emotionalAngle,
        audience:       approvedPlan.analysis.audience,
        strongestQuote: approvedPlan.analysis.strongestQuote,
        keyInsight:     approvedPlan.analysis.keyInsight,
      },
    },
    aspectRatio:   run.aspectRatio,
    videoDuration: run.videoDuration,
    tone:          run.tone,
  });

  if (!scriptResult.success) {
    await failMgStep(scriptStepId, scriptResult.error);
    await transitionMgRunStatus(
      userId, runId,
      ["scripting"], "failed",
      { error: scriptResult.error }
    );
    console.error(TAG, `Script agent failed for run ${runId}:`, scriptResult.error);
    return NextResponse.json({ error: scriptResult.error }, { status: 500 });
  }

  const script = scriptResult.data;
  await completeMgStep(scriptStepId, script as unknown as Record<string, unknown>);

  // ── Storyboard Agent ──────────────────────────────────────────────────────
  const casToStoryboarding = await transitionMgRunStatus(
    userId, runId,
    ["scripting"], "storyboarding"
  );
  if (!casToStoryboarding) {
    const existing = await getMgRunWithSteps(userId, runId);
    return NextResponse.json(existing ?? { error: "Run not found" });
  }

  const storyboardAttempt = (await getLatestAttemptNumber(runId, "mg_storyboard_agent")) + 1;
  const storyboardStepId = await startMgStep(runId, "mg_storyboard_agent", storyboardAttempt, {
    sceneCount: 5,
    sourcePreviewLength: sourcePreview.length,
  });

  const storyboardResult = await mgStoryboardAgentTool.execute(ctx, {
    sourcePreview,
    script: {
      title:           script.title,
      hook:            script.hook,
      fullScript:      script.fullScript,
      callToAction:    script.callToAction,
      durationSeconds: script.durationSeconds,
    },
    plan: {
      recommendedAngle:   approvedPlan.recommendedAngle,
      selectedHook:       approvedPlan.selectedHook,
      mainLesson:         approvedPlan.mainLesson,
      suggestedCta:       approvedPlan.suggestedCta,
      cfIntegrationLevel: approvedPlan.cfIntegrationLevel,
      analysis: {
        coreProblem:    approvedPlan.analysis.coreProblem,
        emotionalAngle: approvedPlan.analysis.emotionalAngle,
        audience:       approvedPlan.analysis.audience,
        strongestQuote: approvedPlan.analysis.strongestQuote,
      },
    },
    aspectRatio: run.aspectRatio,
  });

  if (!storyboardResult.success) {
    await failMgStep(storyboardStepId, storyboardResult.error);
    await transitionMgRunStatus(
      userId, runId,
      ["storyboarding"], "failed",
      { error: storyboardResult.error }
    );
    console.error(TAG, `Storyboard agent failed for run ${runId}:`, storyboardResult.error);
    return NextResponse.json({ error: storyboardResult.error }, { status: 500 });
  }

  const shortForm = storyboardResult.data;
  await completeMgStep(storyboardStepId, { sceneCount: shortForm.scenes.length });

  // Pause at storyboard review
  await transitionMgRunStatus(
    userId, runId,
    ["storyboarding"], "awaiting_storyboard_approval",
    { shortForm, currentGate: "storyboard_review" }
  );

  console.log(TAG, `Run ${runId} at awaiting_storyboard_approval`);

  const result = await getMgRunWithSteps(userId, runId);
  return NextResponse.json(result);
}
