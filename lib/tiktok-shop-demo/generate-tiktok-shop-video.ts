import { generateTikTokShopScript } from "./generate-tiktok-shop-script";
import { generateVoice } from "./generate-voice";
import { buildTikTokScenePayload } from "./build-tiktok-scene-payload";
import { renderWithCreatomate } from "./render-with-creatomate";
import type { ProductData, ProductAssets } from "./types";

const TEMPLATE_ENV_KEY = "CREATOMATE_TEMPLATE_TIKTOK_DEMO";

function getTemplateId(): string {
  const id =
    process.env.CREATOMATE_TEMPLATE_TIKTOK_DEMO ?? process.env.CREATOMATE_TEMPLATE_DEMO;
  if (!id || !String(id).trim()) {
    throw new Error(
      `${TEMPLATE_ENV_KEY} or CREATOMATE_TEMPLATE_DEMO is not set. Add your Creatomate template ID to .env.local`
    );
  }
  return String(id).trim();
}

export type GenerateTikTokShopVideoOptions = {
  /** Upload voice buffer and return public URL (required for Creatomate). */
  uploadVoiceBuffer: (buffer: Buffer) => Promise<string>;
  /** Override product assets (default: imageUrl from productData) */
  productAssets?: ProductAssets;
};

/**
 * Orchestrates TikTok Shop Demo pipeline: script → voice → payload → render.
 * Returns the final rendered video URL. Fully async, uses env vars, handles API errors.
 */
export async function generateTikTokShopVideo(
  productData: ProductData,
  options: GenerateTikTokShopVideoOptions
): Promise<string> {
  const productAssets: ProductAssets = options.productAssets ?? {
    imageUrl: productData.imageUrl,
  };

  console.log("[tiktok-shop-demo] Starting for product:", productData.name);

  const scriptResult = await generateTikTokShopScript(productData);
  console.log("[tiktok-shop-demo] Script generated, scenes:", scriptResult.scenes.length);

  const voiceBuffer = await generateVoice(scriptResult.fullNarration);
  console.log("[tiktok-shop-demo] Voice generated, size:", voiceBuffer.length);

  const voiceoverUrl = await options.uploadVoiceBuffer(voiceBuffer);
  console.log("[tiktok-shop-demo] Voice uploaded, url:", voiceoverUrl);

  const payload = buildTikTokScenePayload(scriptResult.scenes, productAssets, {
    voiceoverUrl,
  });

  payload.template_id = getTemplateId();

  const videoUrl = await renderWithCreatomate(payload);
  console.log("[tiktok-shop-demo] Done, videoUrl:", videoUrl);

  return videoUrl;
}
