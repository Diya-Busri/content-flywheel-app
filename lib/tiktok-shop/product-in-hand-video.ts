/**
 * Product-in-hand video pipeline:
 * 1. Generate "person holding product" image via DALL-E 3
 * 2. Upload to HeyGen as talking photo
 * 3. Generate talking video from that photo
 */

import { generateProductInHandImage, PresenterStyle } from "./generate-product-in-hand-image";
import { uploadTalkingPhoto, generateVideoFromTalkingPhoto } from "./heygen-video";

export type ProductInHandVideoOptions = {
  productName: string;
  productDescription?: string;
  script: string;
  voiceId?: string;
  presenterStyle?: PresenterStyle;
  backgroundPreset?: "studio" | "office" | "bedroom" | "gradient" | "warm";
  voiceEmotion?: "Friendly" | "Excited" | "Soothing" | "Serious" | "Broadcaster";
};

/**
 * Generate a video where a person is shown holding and using the product.
 * Uses DALL-E 3 for the composite image, then HeyGen for the talking video.
 */
export async function generateProductInHandVideo(
  options: ProductInHandVideoOptions
): Promise<string> {
  const { productName, productDescription, script, voiceId } = options;

  console.log("[product-in-hand] Generating composite image...");
  const imageBuffer = await generateProductInHandImage({
    productName,
    productDescription,
    presenterStyle: options.presenterStyle,
  });

  console.log("[product-in-hand] Uploading to HeyGen as talking photo...");
  const talkingPhotoId = await uploadTalkingPhoto(imageBuffer, "image/png");

  console.log("[product-in-hand] Creating talking video...");
  return generateVideoFromTalkingPhoto({
    script,
    talkingPhotoId,
    voiceId,
    caption: true,
    backgroundPreset: options.backgroundPreset,
    voiceEmotion: options.voiceEmotion,
  });
}
