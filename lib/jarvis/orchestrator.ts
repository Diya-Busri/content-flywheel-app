import "./tools"; // ensure every tool is registered before any phase runs

import { getTool } from "./tool-registry";
import { runToolLogged } from "./logger";
import { transitionRunStatus, getRunForUser, patchRun } from "./run-store";
import type { ToolContext } from "./types";
import type {
  SelectExecutionRun,
  JarvisPlan,
  OfferAnalysis,
  ProposedAsset,
  ProposedVideoScript,
  ProposedCarousel,
  ProposedEmail,
  JarvisToolName,
} from "@/db/schema/jarvis-schema";
import type {
  BusinessProfileSummary,
  ProductSummary,
  MemorySummary,
  ExistingContentSummary,
} from "./tools/schemas";

export type PhaseResult =
  | { status: "ok"; run: SelectExecutionRun; skipped: boolean }
  | { status: "not_found" }
  | { status: "invalid_state"; run: SelectExecutionRun; message: string };

/**
 * Planning phase: reads business context, analyses the offer, and produces a
 * structured strategy. Runs entirely within a single call — no long-lived
 * connection, no background job. The caller (an API route) awaits this once
 * and returns a structured response.
 *
 * Idempotent: transitionRunStatus's compare-and-swap means only one caller
 * can move a run from queued|failed -> planning. A concurrent duplicate call
 * (double-click, refresh mid-flight) gets `skipped: true` and the current run
 * state back — it never re-runs the tools or spends AI calls twice.
 */
export async function runPlanningPhase(userId: string, runId: string): Promise<PhaseResult> {
  const existing = await getRunForUser(userId, runId);
  if (!existing) return { status: "not_found" };

  const claimed = await transitionRunStatus(userId, runId, ["queued", "failed"], "planning", {
    currentGate: null,
    error: null,
  });
  if (!claimed) {
    return { status: "ok", run: existing, skipped: true };
  }

  const ctx: ToolContext = { userId, runId };

  try {
    const [profileResult, productsResult, memoryResult, contentResult] = await Promise.all([
      runToolLogged(getTool("get_business_profile"), ctx, {}),
      runToolLogged(getTool("get_product_details"), ctx, {}),
      // get_brand_memory's query is capped at 500 chars (search query, not
      // the full goal) — truncate rather than let a long goal fail validation.
      runToolLogged(getTool("get_brand_memory"), ctx, { query: claimed.goal.slice(0, 500) }),
      runToolLogged(getTool("get_existing_content"), ctx, {}),
    ]);

    if (!profileResult.success) return failRun(userId, runId, profileResult.error);
    if (!productsResult.success) return failRun(userId, runId, productsResult.error);
    if (!memoryResult.success) return failRun(userId, runId, memoryResult.error);
    if (!contentResult.success) return failRun(userId, runId, contentResult.error);

    const businessProfile = profileResult.data as BusinessProfileSummary;
    const productsOut = productsResult.data as { count: number; products: ProductSummary[] };
    const memoryOut = memoryResult.data as { count: number; memories: MemorySummary[] };
    const existingContent = contentResult.data as ExistingContentSummary;

    const offerResult = await runToolLogged(getTool("analyse_offer"), ctx, {
      goal: claimed.goal,
      businessProfile,
      products: productsOut.products,
      memories: memoryOut.memories,
    });
    if (!offerResult.success) return failRun(userId, runId, offerResult.error);
    const offerAnalysis = offerResult.data as OfferAnalysis;

    const strategyResult = await runToolLogged(getTool("create_content_strategy"), ctx, {
      goal: claimed.goal,
      businessProfile,
      products: productsOut.products,
      memories: memoryOut.memories,
      existingContent,
      offerAnalysis,
    });
    if (!strategyResult.success) return failRun(userId, runId, strategyResult.error);
    const plan = strategyResult.data as JarvisPlan;

    const finished = await transitionRunStatus(userId, runId, ["planning"], "awaiting_approval", {
      currentGate: "plan_review",
      plan,
    });
    if (!finished) {
      // Nothing else should be able to move a run out of "planning" — this
      // branch is defensive only. Never claim success without DB confirmation.
      const current = await getRunForUser(userId, runId);
      return current ? { status: "ok", run: current, skipped: true } : { status: "not_found" };
    }

    return { status: "ok", run: finished, skipped: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Planning phase failed unexpectedly";
    return failRun(userId, runId, message);
  }
}

async function failRun(userId: string, runId: string, error: string): Promise<PhaseResult> {
  const failed = await transitionRunStatus(userId, runId, ["planning", "running"], "failed", {
    error,
    currentGate: null,
  });
  if (failed) return { status: "ok", run: failed, skipped: false };
  const current = await getRunForUser(userId, runId);
  return current ? { status: "ok", run: current, skipped: true } : { status: "not_found" };
}

/**
 * Generation phase: takes the approved plan and generates every asset it
 * calls for (video scripts / carousels / emails). Assets are returned as
 * PROPOSED only — nothing is saved to the user's library here. Runs
 * entirely within a single call, same as planning.
 *
 * Idempotent + gate-aware: the compare-and-swap requires both status
 * (awaiting_approval or failed, to allow retry) AND current_gate
 * (plan_review, or null for a retry-from-failed) to match. This means:
 *   - a run already sitting in asset_review can never have generation
 *     re-triggered (assets are preserved, no duplicate AI spend on refresh
 *     or accidental re-click)
 *   - a run that failed during planning (no plan yet) is rejected up front
 *     with a clear message rather than silently doing nothing
 */
export async function runGenerationPhase(
  userId: string,
  runId: string,
  answers?: Record<string, string>,
): Promise<PhaseResult> {
  const existing = await getRunForUser(userId, runId);
  if (!existing) return { status: "not_found" };

  if (!existing.plan) {
    return {
      status: "invalid_state",
      run: existing,
      message: "No strategy has been created yet for this run — retry planning first.",
    };
  }

  const claimed = await transitionRunStatus(
    userId,
    runId,
    ["awaiting_approval", "failed"],
    "running",
    { currentGate: null, error: null },
    ["plan_review", null],
  );
  if (!claimed) {
    return { status: "ok", run: existing, skipped: true };
  }

  let plan = claimed.plan as JarvisPlan;
  if (answers && Object.keys(answers).length > 0) {
    plan = { ...plan, answers: { ...(plan.answers ?? {}), ...answers } };
    await patchRun(userId, runId, { plan });
  }

  const ctx: ToolContext = { userId, runId };

  try {
    const [profileResult, productsResult] = await Promise.all([
      runToolLogged(getTool("get_business_profile"), ctx, {}),
      runToolLogged(getTool("get_product_details"), ctx, {}),
    ]);
    if (!profileResult.success) return failRun(userId, runId, profileResult.error);
    if (!productsResult.success) return failRun(userId, runId, productsResult.error);

    const businessProfile = profileResult.data as BusinessProfileSummary;
    const productsOut = productsResult.data as { count: number; products: ProductSummary[] };

    const allAssets: ProposedAsset[] = [];

    for (const item of plan.assetPlan) {
      const toolName: JarvisToolName =
        item.assetType === "video_script"
          ? "generate_video_scripts"
          : item.assetType === "carousel"
            ? "generate_carousel_copy"
            : "generate_email_campaign";

      const result = await runToolLogged(getTool(toolName), ctx, {
        goal: existing.goal,
        angle: item.angle,
        count: item.count,
        businessProfile,
        products: productsOut.products,
      });

      if (!result.success) return failRun(userId, runId, result.error);

      if (item.assetType === "video_script") {
        allAssets.push(...(result.data as { scripts: ProposedVideoScript[] }).scripts);
      } else if (item.assetType === "carousel") {
        allAssets.push(...(result.data as { carousels: ProposedCarousel[] }).carousels);
      } else {
        allAssets.push(...(result.data as { emails: ProposedEmail[] }).emails);
      }
    }

    if (allAssets.length === 0) {
      return failRun(userId, runId, "No assets were generated from the strategy's asset plan.");
    }

    const finished = await transitionRunStatus(userId, runId, ["running"], "awaiting_approval", {
      currentGate: "asset_review",
      assets: allAssets,
    });
    if (!finished) {
      const current = await getRunForUser(userId, runId);
      return current ? { status: "ok", run: current, skipped: true } : { status: "not_found" };
    }

    return { status: "ok", run: finished, skipped: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation phase failed unexpectedly";
    return failRun(userId, runId, message);
  }
}
