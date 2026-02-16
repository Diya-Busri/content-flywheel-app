import type { TikTokScene, ProductAssets, CreatomatePayload } from "./types";

/** Vertical 9:16 for TikTok */
const WIDTH = 1080;
const HEIGHT = 1920;

const DEFAULT_PLACEHOLDER = "https://placehold.co/1080x1920/1a1a1a/fff?text=Product";

export type BuildTikTokPayloadOptions = {
  voiceoverUrl: string;
  /** Creatomate template element names (must match template) */
  elementNames?: {
    productImage?: string;
    beforeImage?: string;
    afterImage?: string;
    voiceover?: string;
    headline?: string;
    subheadline?: string;
    cta?: string;
    /** Optional scene-specific text, e.g. "Scene1-Text", "Scene2-Text" */
    sceneText?: (index: number) => string;
  };
};

/**
 * If requiresProductShot === true → inject product main image.
 * If requiresBeforeAfter === true → inject beforeImage and afterImage.
 * Maps scene variables to Creatomate template placeholders. Vertical 9:16 only.
 */
export function buildTikTokScenePayload(
  scenes: TikTokScene[],
  productAssets: ProductAssets,
  options: BuildTikTokPayloadOptions
): CreatomatePayload {
  const keys = options.elementNames ?? {};
  const productImageKey = keys.productImage ?? "ProductImage.source";
  const beforeImageKey = keys.beforeImage ?? "BeforeImage.source";
  const afterImageKey = keys.afterImage ?? "AfterImage.source";
  const voiceoverKey = keys.voiceover ?? "Voiceover";
  const headlineKey = keys.headline ?? "Headline.text";
  const subheadlineKey = keys.subheadline ?? "Subheadline.text";
  const ctaKey = keys.cta ?? "CTA.text";

  const modifications: Record<string, string | number | boolean> = {
    [voiceoverKey]: options.voiceoverUrl,
    width: WIDTH,
    height: HEIGHT,
  };

  const hasProductShot = scenes.some((s) => s.requiresProductShot);
  const productImageUrl =
    hasProductShot &&
    (productAssets.imageUrl ?? process.env.VIDEO_PLACEHOLDER_IMAGE) ||
    DEFAULT_PLACEHOLDER;
  modifications[productImageKey] = productImageUrl as string;

  const hasBeforeAfter = scenes.some((s) => s.requiresBeforeAfter);
  if (hasBeforeAfter) {
    const beforeUrl =
      productAssets.beforeImageUrl ??
      process.env.VIDEO_PLACEHOLDER_BEFORE_IMAGE ??
      DEFAULT_PLACEHOLDER;
    const afterUrl =
      productAssets.afterImageUrl ?? productAssets.imageUrl ?? DEFAULT_PLACEHOLDER;
    modifications[beforeImageKey] = beforeUrl;
    modifications[afterImageKey] = afterUrl;
  }

  const scene1 = scenes.find((s) => s.sceneIndex === 1);
  const scene2 = scenes.find((s) => s.sceneIndex === 2);
  const ctaScene = scenes.find((s) => s.sceneType === "cta");

  modifications[headlineKey] = (scene1?.onScreenText ?? "").slice(0, 100);
  modifications[subheadlineKey] = (scene2?.onScreenText ?? scene1?.voiceLine ?? "").slice(0, 150);
  modifications[ctaKey] = (ctaScene?.onScreenText ?? "Shop now").slice(0, 50);

  if (keys.sceneText) {
    for (const scene of scenes) {
      const key = keys.sceneText(scene.sceneIndex);
      if (key) modifications[key] = scene.onScreenText.slice(0, 200);
    }
  }

  return {
    template_id: "",
    modifications,
  };
}
