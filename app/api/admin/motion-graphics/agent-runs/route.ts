/**
 * POST /api/admin/motion-graphics/agent-runs
 *
 * Creates a new MG agent run and immediately executes Phase 1:
 *   mg_source_analyst → mg_content_strategist → awaiting_plan_approval
 *
 * Phase 1 is awaited within this request (no background worker).
 * Progress is persisted before and after each tool so the UI always
 * reflects the real state even if the request is interrupted.
 *
 * Authorization checks (Correction 6):
 *   1. User must be admin
 *   2. Run is created with userId from server-side Clerk session
 *
 * Idempotency:
 *   The client disables the submit button after the first click. The server
 *   enforces per-phase idempotency via CAS transitions (transitionMgRunStatus).
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/motion-graphics/guard";
import { currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import {
  createMgRun,
  transitionMgRunStatus,
  startMgStep,
  completeMgStep,
  failMgStep,
  getLatestAttemptNumber,
  getMgRunWithSteps,
} from "@/lib/motion-graphics/mg-run-store";
import { mgSourceAnalystTool } from "@/lib/motion-graphics/tools/mg_source_analyst";
import { mgContentStrategistTool } from "@/lib/motion-graphics/tools/mg_content_strategist";
import { MG_TOOL_CREDIT_COSTS, totalMgRunCreditCost } from "@/lib/motion-graphics/mg-credit-config";
import type { MgPlan, MgSourceAnalysis } from "@/lib/motion-graphics/agent-types";

const TAG = "[mg-agent-runs:POST]";
const SOURCE_PREVIEW_MAX = 3000;

const BodySchema = z.object({
  contentMode:    z.enum([
    "reddit-reaction", "creator-complaint", "startup-breakdown",
    "digital-product-advice", "product-demo", "tutorial",
    "storytime", "short-form", "long-form-youtube", "custom",
  ]),
  sourceText:     z.string().min(20, "Source text must be at least 20 characters"),
  sourceUrl:      z.string().url().optional().or(z.literal("")),
  targetAudience: z.string().max(200).optional(),
  mainOpinion:    z.string().max(300).optional(),
  desiredCta:     z.string().max(200).optional(),
  cfMention:      z.enum(["off", "subtle", "direct"]).default("subtle"),
  videoDuration:  z.string().max(50).optional(),
  tone:           z.string().max(100).optional(),
  aspectRatio:    z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
});

export async function POST(request: NextRequest) {
  // Authorization (Correction 6)
  const denied = await requireAdmin();
  if (denied) return denied;

  const user = await currentUser();
  const userId = user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  // Validate body
  let body: z.infer<typeof BodySchema>;
  try {
    const raw = await request.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return NextResponse.json({ error: `Invalid request: ${issues}` }, { status: 400 });
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // First-delivery restriction: Agent Workflow is only for reddit-reaction (Correction 11)
  if (body.contentMode !== "reddit-reaction") {
    return NextResponse.json(
      { error: "Agent Workflow is only available for Reddit Reaction in this release." },
      { status: 400 }
    );
  }

  // Create the run
  const run = await createMgRun(userId, {
    contentMode:    body.contentMode,
    sourceText:     body.sourceText,
    sourceUrl:      body.sourceUrl || undefined,
    targetAudience: body.targetAudience,
    mainOpinion:    body.mainOpinion,
    desiredCta:     body.desiredCta,
    cfMention:      body.cfMention,
    videoDuration:  body.videoDuration,
    tone:           body.tone,
    aspectRatio:    body.aspectRatio,
  });

  const ctx = { userId, runId: run.id };
  const sourcePreview = body.sourceText.slice(0, SOURCE_PREVIEW_MAX);

  // ── Phase 1: Source Analysis ──────────────────────────────────────────────
  const casToAnalysing = await transitionMgRunStatus(
    userId, run.id,
    ["queued"], "analysing",
    { currentGate: null }
  );
  if (!casToAnalysing) {
    // Run already moved on (shouldn't happen for a brand-new run, but be safe)
    const existing = await getMgRunWithSteps(userId, run.id);
    return NextResponse.json(existing ?? { error: "Run not found" }, { status: 200 });
  }

  const analystAttempt = (await getLatestAttemptNumber(run.id, "mg_source_analyst")) + 1;
  const analystStepId = await startMgStep(run.id, "mg_source_analyst", analystAttempt, {
    contentMode: body.contentMode,
    sourcePreviewLength: sourcePreview.length,
  });

  const analystResult = await mgSourceAnalystTool.execute(ctx, {
    sourcePreview,
    contentMode: body.contentMode,
  });

  if (!analystResult.success) {
    await failMgStep(analystStepId, analystResult.error);
    await transitionMgRunStatus(
      userId, run.id,
      ["analysing"], "failed",
      { error: analystResult.error }
    );
    console.error(TAG, `Source analyst failed for run ${run.id}:`, analystResult.error);
    return NextResponse.json({ error: analystResult.error }, { status: 500 });
  }

  const analysis: MgSourceAnalysis = analystResult.data;
  await completeMgStep(analystStepId, analysis as unknown as Record<string, unknown>);

  // ── Phase 1b: Content Strategy ────────────────────────────────────────────
  const casToStrategising = await transitionMgRunStatus(
    userId, run.id,
    ["analysing"], "strategising"
  );
  if (!casToStrategising) {
    const existing = await getMgRunWithSteps(userId, run.id);
    return NextResponse.json(existing ?? { error: "Run not found" });
  }

  const strategistAttempt = (await getLatestAttemptNumber(run.id, "mg_content_strategist")) + 1;
  const strategistStepId = await startMgStep(run.id, "mg_content_strategist", strategistAttempt, {
    cfMention: body.cfMention,
    hasTone: !!body.tone,
  });

  const strategistResult = await mgContentStrategistTool.execute(ctx, {
    analysis,
    contentMode:    body.contentMode,
    cfMention:      body.cfMention,
    targetAudience: body.targetAudience,
    mainOpinion:    body.mainOpinion,
    desiredCta:     body.desiredCta,
    tone:           body.tone,
  });

  if (!strategistResult.success) {
    await failMgStep(strategistStepId, strategistResult.error);
    await transitionMgRunStatus(
      userId, run.id,
      ["strategising"], "failed",
      { error: strategistResult.error }
    );
    console.error(TAG, `Content strategist failed for run ${run.id}:`, strategistResult.error);
    return NextResponse.json({ error: strategistResult.error }, { status: 500 });
  }

  const strategy = strategistResult.data;
  await completeMgStep(strategistStepId, strategy as unknown as Record<string, unknown>);

  // ── Assemble plan and pause at plan_review ────────────────────────────────
  const plan: MgPlan = {
    analysis,
    recommendedAngle:   strategy.recommendedAngle,
    hookOptions:        strategy.hookOptions,
    selectedHook:       strategy.selectedHook,
    mainLesson:         strategy.mainLesson,
    suggestedCta:       strategy.suggestedCta,
    cfIntegrationLevel: strategy.cfIntegrationLevel,
    deliverables:       ["short-form-video"],
    estimatedScenes:    5,
    estimatedCreditCost:
      MG_TOOL_CREDIT_COSTS.mg_script_agent +
      MG_TOOL_CREDIT_COSTS.mg_storyboard_agent,
    repurposingOptions: [], // Coming soon
  };

  await transitionMgRunStatus(
    userId, run.id,
    ["strategising"], "awaiting_plan_approval",
    { plan, currentGate: "plan_review" }
  );

  console.log(TAG, `Run ${run.id} at awaiting_plan_approval`);

  const result = await getMgRunWithSteps(userId, run.id);
  return NextResponse.json(result);
}
