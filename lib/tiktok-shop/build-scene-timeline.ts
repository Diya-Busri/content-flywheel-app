import type { ScriptScenes } from "./types";
import { PLATFORM_ASPECT_RATIOS } from "./types";

export type SceneTimelineInput = {
  scriptScenes: ScriptScenes;
  productImageUrl: string;
  voiceoverUrl: string;
  platform: string;
};

export type CreatomateModifications = Record<string, string | number>;

/**
 * Build Creatomate modifications for the 4-scene product-driven template.
 * Product image is used in ALL scenes. No stock or generic fallbacks.
 *
 * Template must have:
 * - Voiceover.source
 * - Scene1.Image.source, Scene1.Text.text (hook – template can apply blur/zoom)
 * - Scene2.Image.source, Scene2.Text.text (pain – close-up)
 * - Scene3.Image.source, Scene3.Text.text (solution – bullets)
 * - Scene4.Image.source, Scene4.Text.text (CTA + "Buy now on TikTok Shop")
 */
export function buildSceneTimeline(input: SceneTimelineInput): CreatomateModifications {
  const { scriptScenes, productImageUrl, voiceoverUrl, platform } = input;
  const aspect = PLATFORM_ASPECT_RATIOS[platform] ?? PLATFORM_ASPECT_RATIOS.tiktok;
  const ctaText = [scriptScenes.cta, "Buy now on TikTok Shop"].filter(Boolean).join("\n");

  return {
    width: aspect.width,
    height: aspect.height,
    "Voiceover.source": voiceoverUrl,
    "Scene1.Image.source": productImageUrl,
    "Scene1.Text.text": scriptScenes.hook,
    "Scene2.Image.source": productImageUrl,
    "Scene2.Text.text": scriptScenes.pain,
    "Scene3.Image.source": productImageUrl,
    "Scene3.Text.text": scriptScenes.solution,
    "Scene4.Image.source": productImageUrl,
    "Scene4.Text.text": ctaText,
  };
}
