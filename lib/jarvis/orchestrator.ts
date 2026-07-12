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
  JarvisFinalSummary,
} from "@/db/schema/jarvis-schema";
import type {
  BusinessProfileSummary,
  ProductSummary,
  MemorySummary,
  ExistingContentSummary,
  AssetForSave,
} from "./tools/schemas";
import type { SaveResultItem } from "./tools/save-content-campaign";

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

function toSaveInput(asset: ProposedAsset): AssetForSave {
  if (asset.type === "video_script") {
    return {
      id: asset.id,
      type: "video_script",
      platform: asset.platform,
      title: asset.title,
      hook: asset.hook,
      script: asset.script,
      cta: asset.cta,
    };
  }
  if (asset.type === "carousel") {
    return {
      id: asset.id,
      type: "carousel",
      platform: asset.platform,
      title: asset.title,
      slides: asset.slides,
      caption: asset.caption,
      hashtags: asset.hashtags,
    };
  }
  return {
    id: asset.id,
    type: "email",
    name: asset.name,
    subject: asset.subject,
    previewText: asset.previewText,
    bodyHtml: asset.bodyHtml,
  };
}

/**
 * Save phase: persists approved assets into the user's library and marks
 * the run completed. Runs entirely within a single call.
 *
 * Idempotent + gate-aware, same pattern as generation: the compare-and-swap
 * requires the run to be in awaiting_approval/asset_review (or failed, to
 * allow retry) — a run that's already completed, or a concurrent duplicate
 * approve click, gets the current (already-saved) state back instead of
 * saving anything twice. The actual DB writes additionally happen inside
 * one transaction (lib/jarvis/tools/save-content-campaign.ts) — either
 * every approved asset in this call is saved, or none are, so the run's
 * bookkeeping can never disagree with what's actually in the library.
 *
 * `approvedAssetIds` is optional so a retry-after-failure can omit it and
 * reuse whatever was already marked "approved" on the previous attempt;
 * when provided, it's authoritative and re-marks every asset accordingly
 * (this is also how a deselected asset ends up "rejected" and never saved).
 */
export async function runSavePhase(
  userId: string,
  runId: string,
  approvedAssetIds?: string[],
): Promise<PhaseResult> {
  const existing = await getRunForUser(userId, runId);
  if (!existing) return { status: "not_found" };

  if (!existing.plan || existing.assets.length === 0) {
    return {
      status: "invalid_state",
      run: existing,
      message: "No generated assets are available to approve for this run.",
    };
  }

  const approvedIds = approvedAssetIds
    ? new Set(approvedAssetIds)
    : new Set(existing.assets.filter((a) => a.status === "approved").map((a) => a.id));

  if (approvedIds.size === 0) {
    return {
      status: "invalid_state",
      run: existing,
      message: "No assets were selected for approval.",
    };
  }

  const markedAssets: ProposedAsset[] = existing.assets.map((a) =>
    a.status === "saved" ? a : { ...a, status: approvedIds.has(a.id) ? "approved" : "rejected" },
  );

  const claimed = await transitionRunStatus(
    userId,
    runId,
    ["awaiting_approval", "failed"],
    "running",
    { assets: markedAssets, error: null },
    ["asset_review", null],
  );
  if (!claimed) {
    return { status: "ok", run: existing, skipped: true };
  }

  const ctx: ToolContext = { userId, runId };
  const approvedAssets = claimed.assets.filter((a) => a.status === "approved");

  try {
    const saveResult = await runToolLogged(getTool("save_content_campaign"), ctx, {
      assets: approvedAssets.map(toSaveInput),
    });

    if (!saveResult.success) return failRun(userId, runId, saveResult.error);

    const results = (saveResult.data as { results: SaveResultItem[] }).results;
    const byAssetId = new Map(results.map((r) => [r.assetId, r]));

    const savedCounts = { videoScripts: 0, carousels: 0, emails: 0 };
    const savedAssetIds: string[] = [];
    const failedAssetIds: string[] = [];

    const finalAssets: ProposedAsset[] = claimed.assets.map((a) => {
      const r = byAssetId.get(a.id);
      if (!r) return a; // rejected assets never appear in results
      if (r.success) {
        savedAssetIds.push(a.id);
        if (a.type === "video_script") savedCounts.videoScripts++;
        else if (a.type === "carousel") savedCounts.carousels++;
        else savedCounts.emails++;
        return { ...a, status: "saved", savedRefTable: r.table, savedRefId: r.savedId };
      }
      failedAssetIds.push(a.id);
      return { ...a, saveError: r.error };
    });

    const finalSummary: JarvisFinalSummary = {
      completedAt: new Date().toISOString(),
      savedCounts,
      savedAssetIds,
      failedAssetIds,
      message:
        failedAssetIds.length === 0
          ? `Saved ${savedAssetIds.length} asset${savedAssetIds.length === 1 ? "" : "s"} to your library.`
          : `Saved ${savedAssetIds.length} asset(s); ${failedAssetIds.length} failed to save.`,
    };

    const finished = await transitionRunStatus(userId, runId, ["running"], "completed", {
      assets: finalAssets,
      finalSummary,
      currentGate: null,
    });
    if (!finished) {
      const current = await getRunForUser(userId, runId);
      return current ? { status: "ok", run: current, skipped: true } : { status: "not_found" };
    }

    return { status: "ok", run: finished, skipped: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save phase failed unexpectedly";
    return failRun(userId, runId, message);
  }
}
