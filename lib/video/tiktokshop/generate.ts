import { generateTikTokShopScript } from "./script";
import { generateVoiceElevenLabs } from "./voice";
import { planAssetsForScenes } from "./assetPlan";
import { renderWithCreatomate } from "./creatomate";
import { structureExtractionMode } from "./structureExtraction";
import type { ProductData } from "./types";

const TEMPLATE_ID_ENV = "CREATOMATE_TEMPLATE_TIKTOK_DEMO";

function getTemplateId(): string {
  const id =
    process.env.CREATOMATE_TEMPLATE_TIKTOK_DEMO ?? process.env.CREATOMATE_TEMPLATE_DEMO;
  if (!id || !String(id).trim()) {
    throw new Error(
      TEMPLATE_ID_ENV + " or CREATOMATE_TEMPLATE_DEMO is not set"
    );
  }
  return String(id).trim();
}

/**
 * Orchestrates: optional structure extraction → script → voice → asset plan → Creatomate render.
 * Returns final video URL.
 */
export async function generateTikTokShopVideo(productData: ProductData): Promise<string> {
  const templateId = getTemplateId();
  const mode = productData.videoSourceMode ?? "user_clips";

  if (mode !== "user_clips" && mode !== "ai_generated" && mode !== "hybrid") {
    throw new Error("videoSourceMode must be user_clips, ai_generated, or hybrid");
  }
  if ((mode === "user_clips" || mode === "hybrid") && (!productData.demoClipUrls?.length)) {
    throw new Error("demoClipUrls required for user_clips and hybrid (at least one clip)");
  }

  let blueprint: Awaited<ReturnType<typeof structureExtractionMode>> | null = null;
  if (productData.inputVideoUrl?.trim()) {
    blueprint = await structureExtractionMode(productData.inputVideoUrl.trim());
  }

  const scriptResult = await generateTikTokShopScript(productData, blueprint ?? undefined);
  const voiceoverUrl = await generateVoiceElevenLabs(scriptResult.fullNarration);

  const { variables } = planAssetsForScenes(scriptResult.scenes, productData);
  variables["Voiceover.source"] = voiceoverUrl;

  const result = await renderWithCreatomate(templateId, variables);
  if (!result.url) throw new Error("No video URL returned from Creatomate");
  return result.url;
}
