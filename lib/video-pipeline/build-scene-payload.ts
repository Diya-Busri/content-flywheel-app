import type { Scene, ProductAssets, CreatomatePayload } from "./types";

const DEFAULT_PLACEHOLDER_IMAGE = "https://placehold.co/1080x1920/1a1a1a/fff?text=Product";

export type BuildPayloadOptions = {
  /** URL of the voiceover audio (from generateVoice + upload) */
  voiceoverUrl: string;
  /** Optional override for headline (default: first scene onScreenText) */
  headline?: string;
  /** Optional override for subheadline */
  subheadline?: string;
  /** Creatomate template element names (must match template) */
  elementNames?: {
    productImage?: string;
    voiceover?: string;
    headline?: string;
    subheadline?: string;
    cta?: string;
  };
};

/**
 * If requiresProductShot === true for any scene, inject product image or mockup URL.
 * Maps scene data to Creatomate template variables.
 */
export function buildScenePayload(
  scenes: Scene[],
  productAssets: ProductAssets,
  options: BuildPayloadOptions
): CreatomatePayload {
  const keys = options.elementNames ?? {};
  const productImageKey = keys.productImage ?? "ProductImage.source";
  const voiceoverKey = keys.voiceover ?? "Voiceover";
  const headlineKey = keys.headline ?? "Headline.text";
  const subheadlineKey = keys.subheadline ?? "Subheadline.text";
  const ctaKey = keys.cta ?? "CTA.text";

  const requiresProductShot = scenes.some((s) => s.requiresProductShot);
  const productImageUrl =
    requiresProductShot &&
    (productAssets.imageUrl ?? productAssets.mockupUrl ?? process.env.VIDEO_PLACEHOLDER_IMAGE) ||
    DEFAULT_PLACEHOLDER_IMAGE;

  const headline =
    options.headline ?? scenes[0]?.onScreenText ?? "";
  const subheadline =
    options.subheadline ?? scenes[1]?.onScreenText ?? scenes[0]?.voiceLine ?? "";

  const modifications: Record<string, string | number | boolean> = {
    [voiceoverKey]: options.voiceoverUrl,
    [headlineKey]: headline,
    [subheadlineKey]: subheadline,
    [ctaKey]: "Shop now",
    [productImageKey]: productImageUrl,
  };

  return {
    template_id: "", // caller must set from getTemplateId(style)
    modifications,
  };
}
