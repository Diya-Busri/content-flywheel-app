import { generateStructuredScript } from "./generate-structured-script";
import { generateVoice } from "./generate-voice";
import { buildScenePayload } from "./build-scene-payload";
import { renderWithCreatomate } from "./render-with-creatomate";
import type { ProductData, ProductAssets, VideoStyle } from "./types";

const STYLE_ENV_KEYS: Record<VideoStyle, string> = {
  unboxing: "CREATOMATE_TEMPLATE_UNBOXING",
  promo: "CREATOMATE_TEMPLATE_PROMO",
  demo: "CREATOMATE_TEMPLATE_DEMO",
  beforeAfter: "CREATOMATE_TEMPLATE_BEFORE_AFTER",
};

function getTemplateId(style: VideoStyle): string {
  const envKey = STYLE_ENV_KEYS[style];
  const id = process.env[envKey];
  if (!id || !String(id).trim()) {
    throw new Error(
      `${envKey} is not set. Add your Creatomate template ID for "${style}" to .env.local`
    );
  }
  return String(id).trim();
}

export type GenerateProductVideoOptions = {
  videoStyle?: VideoStyle;
  /** Upload voice buffer to get a public URL (required for Creatomate). */
  uploadVoiceBuffer?: (buffer: Buffer) => Promise<string>;
  /** Override product assets (default: derived from productData.imageUrl) */
  productAssets?: ProductAssets;
};

/**
 * Orchestrates the full pipeline: script → voice → payload → render.
 * Returns the final rendered video URL.
 */
export async function generateProductVideo(
  productData: ProductData,
  options: GenerateProductVideoOptions = {}
): Promise<string> {
  const style: VideoStyle = options.videoStyle ?? "demo";
  const productAssets: ProductAssets = options.productAssets ?? {
    imageUrl: productData.imageUrl,
  };

  console.log("[video-pipeline] Starting for product:", productData.name, "style:", style);

  const scriptResult = await generateStructuredScript(productData);
  console.log("[video-pipeline] Script generated, scenes:", scriptResult.scenes.length);

  const voiceBuffer = await generateVoice(scriptResult.fullNarration);
  console.log("[video-pipeline] Voice generated, size:", voiceBuffer.length);

  let voiceoverUrl: string;
  if (options.uploadVoiceBuffer) {
    voiceoverUrl = await options.uploadVoiceBuffer(voiceBuffer);
    console.log("[video-pipeline] Voice uploaded, url:", voiceoverUrl);
  } else {
    throw new Error(
      "uploadVoiceBuffer is required. Pass a function that uploads the buffer and returns a public URL (e.g. Supabase or Vercel Blob)."
    );
  }

  const payload = buildScenePayload(scriptResult.scenes, productAssets, {
    voiceoverUrl,
    headline: scriptResult.scenes[0]?.onScreenText,
    subheadline: scriptResult.scenes[1]?.onScreenText ?? scriptResult.scenes[0]?.voiceLine,
  });

  const templateId = getTemplateId(style);
  payload.template_id = templateId;

  const videoUrl = await renderWithCreatomate(payload);
  console.log("[video-pipeline] Done, videoUrl:", videoUrl);

  return videoUrl;
}
