import type { Scene, ProductData, SceneAssetPlan, CreatomateVariables, VideoSourceMode } from "./types";

const PLACEHOLDER = "https://placehold.co/1080x1920/1a1a1a/fff?text=Clip";
/** Placeholder for AI-generated visuals until image gen + motion is wired. Do not replicate any specific creator. */
const AI_FALLBACK_CLIP = process.env.VIDEO_AI_FALLBACK_CLIP ?? "https://placehold.co/1080x1920/0f0f0f/888?text=Scene";

function getClipUrlForScene(
  sceneIndex: number,
  scene: Scene,
  productData: ProductData,
  mode: VideoSourceMode
): string {
  const clips = productData.demoClipUrls ?? [];
  const userClip0 = clips[0];
  const userClip1 = clips[1] ?? clips[0];
  const otherClips = clips.length > 2 ? clips.slice(2) : clips.length ? [clips[0]!] : [];

  if (mode === "user_clips") {
    if (sceneIndex === 1) return userClip0 ?? PLACEHOLDER;
    if (sceneIndex === 3) return userClip1 ?? userClip0 ?? PLACEHOLDER;
    const otherIndex = sceneIndex === 2 ? 0 : sceneIndex === 4 ? 1 : 2;
    return otherClips[otherIndex % Math.max(1, otherClips.length)] ?? userClip0 ?? PLACEHOLDER;
  }

  if (mode === "ai_generated") {
    return AI_FALLBACK_CLIP;
  }

  if (mode === "hybrid") {
    if (sceneIndex === 3) return userClip1 ?? userClip0 ?? AI_FALLBACK_CLIP;
    return AI_FALLBACK_CLIP;
  }

  return PLACEHOLDER;
}

/**
 * Map clips to scenes by videoSourceMode.
 * user_clips: demoClipUrls to scenes (1→[0], 3→[1] or [0], rest round-robin).
 * ai_generated: fallback placeholder for all (no creator replication).
 * hybrid: user clips for scene 3 only; AI fallback for hook and result (1, 2, 4, 5).
 */
export function planAssetsForScenes(
  scenes: Scene[],
  productData: ProductData
): { plans: SceneAssetPlan[]; variables: CreatomateVariables } {
  const mode: VideoSourceMode = productData.videoSourceMode ?? "user_clips";
  const plans: SceneAssetPlan[] = [];
  const variables: CreatomateVariables = {
    width: 1080,
    height: 1920,
  };

  for (const scene of scenes.sort((a, b) => a.sceneIndex - b.sceneIndex)) {
    const clipUrl = getClipUrlForScene(scene.sceneIndex, scene, productData, mode);

    const productOverlayUrl =
      scene.requiresProductOverlay && productData.productImageUrl
        ? productData.productImageUrl
        : undefined;
    const beforeImageUrl =
      scene.requiresBeforeAfter && productData.beforeImageUrl ? productData.beforeImageUrl : undefined;
    const afterImageUrl =
      scene.requiresBeforeAfter && productData.afterImageUrl ? productData.afterImageUrl : undefined;

    const n = scene.sceneIndex;
    variables[`Scene${n}.Clip.source`] = clipUrl;
    variables[`Scene${n}.Text.text`] = scene.onScreenText;
    if (productOverlayUrl) variables[`Scene${n}.ProductOverlay.source`] = productOverlayUrl;
    if (beforeImageUrl && n === 4) variables["Scene4.BeforeImage.source"] = beforeImageUrl;
    if (afterImageUrl && n === 4) variables["Scene4.AfterImage.source"] = afterImageUrl;

    plans.push({
      sceneIndex: scene.sceneIndex,
      clipUrl,
      productOverlayUrl,
      beforeImageUrl,
      afterImageUrl,
      voiceLine: scene.voiceLine,
      onScreenText: scene.onScreenText,
    });
  }

  return { plans, variables };
}
