/**
 * CF Video Engine – Asset Orchestrator
 *
 * Responsibility: For each scene in a VideoEngineProject, decide HOW its visual
 * layer will be produced and produce an actionable SceneAssetPlan.
 *
 * It does NOT fetch or generate assets itself — it produces a plan that
 * downstream steps (Higgsfield, upload flow, Remotion) will execute.
 *
 * TODO (v2 — Higgsfield):
 *   For ai_visual scenes, call:
 *     POST https://api.higgsfield.ai/v1/generations
 *   with { prompt: scene.visualPrompt, duration: scene.durationSeconds, aspect_ratio: "9:16" }
 *   Store the returned clip URL in SceneAssetPlan.assetUrl.
 *
 * TODO (v2 — upload flow):
 *   For app_screenshot / product_mockup scenes, trigger an admin upload modal
 *   so the admin can attach a real asset URL to each scene.
 *
 * TODO (v2 — Remotion):
 *   For cta / text_slide scenes, call the Remotion Lambda renderer with
 *   the scene's onScreenText, color palette, and duration.
 */

import { VideoScene, SceneType, VideoEngineProject, SceneAssetPlan } from "./schema";

// ─── Strategy descriptions (human-readable) ───────────────────────────────────

const STRATEGY_LABELS: Record<SceneType, string> = {
  ai_visual:
    "Generate a short video clip with Higgsfield AI using the visual prompt",
  app_screenshot:
    "Use a static or animated screenshot of the Content Flywheel app",
  product_mockup:
    "Use a product image or Printify / Canva mockup uploaded by admin",
  cta:
    "Render a full-screen CTA slide via Remotion (text + brand colours)",
  text_slide:
    "Render a text-only slide via Remotion (headline + subtitle layout)",
};

const STRATEGY_NOTES: Record<SceneType, string> = {
  ai_visual:
    "TODO (v2): call Higgsfield API with visualPrompt. Set HIGGSFIELD_API_KEY in .env.",
  app_screenshot:
    "Upload a screen recording or screenshot from the CF dashboard and paste the URL into assetUrl.",
  product_mockup:
    "Upload your product mockup (eBook cover, POD item, template preview) and paste the URL into assetUrl.",
  cta:
    "TODO (v2): wire into Remotion Lambda. For now, record or design this slide manually.",
  text_slide:
    "TODO (v2): wire into Remotion Lambda. For now, record or design this slide manually.",
};

// ─── Per-scene planner ────────────────────────────────────────────────────────

function planSceneAsset(scene: VideoScene): SceneAssetPlan {
  const ready = Boolean(scene.assetUrl);

  return {
    sceneId: scene.id,
    sceneNumber: scene.sceneNumber,
    sceneType: scene.sceneType,
    strategy: STRATEGY_LABELS[scene.sceneType],
    notes: STRATEGY_NOTES[scene.sceneType],
    ready,
    assetUrl: scene.assetUrl,
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Produce a SceneAssetPlan for every scene in the project.
 * Call this after planProject() to understand what assets need to be sourced.
 */
export function orchestrateAssets(
  project: VideoEngineProject
): SceneAssetPlan[] {
  return project.scenes.map(planSceneAsset);
}

/**
 * Check whether every scene has a resolved asset.
 * Returns true only when the project is ready to hand off to the renderer.
 */
export function allAssetsReady(plans: SceneAssetPlan[]): boolean {
  return plans.every((p) => p.ready);
}

/**
 * Return only the plans that still need an asset — useful for showing
 * an actionable checklist in the admin UI.
 */
export function pendingAssets(plans: SceneAssetPlan[]): SceneAssetPlan[] {
  return plans.filter((p) => !p.ready);
}

/**
 * Merge a resolved asset URL back into a scene.
 * Call this when the admin uploads an asset or Higgsfield returns a clip URL.
 *
 * TODO (v2): persist the updated scene to the database.
 */
export function resolveSceneAsset(
  scene: VideoScene,
  assetUrl: string
): VideoScene {
  return { ...scene, assetUrl };
}
