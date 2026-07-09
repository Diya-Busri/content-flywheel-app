/**
 * AI-generated image of a person holding the product.
 * Uses DALL-E 3 to create a UGC-style photo for HeyGen talking_photo.
 */

import OpenAI from "openai";

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not set. Required for product-in-hand image generation.");
  return new OpenAI({ apiKey: key });
}

export type PresenterStyle =
  | "young-woman"
  | "young-man"
  | "middle-aged-woman"
  | "middle-aged-man"
  | "diverse";

export type GenerateProductInHandOptions = {
  productName: string;
  productDescription?: string;
  presenterStyle?: PresenterStyle;
};

/**
 * Generate an image of a person holding/using the product.
 * Returns PNG buffer suitable for HeyGen talking_photo upload.
 * Uses DALL-E 3 for best quality and instruction following.
 */
const PRESENTER_PROMPTS: Record<PresenterStyle, string> = {
  "young-woman": "a young woman (mid-20s) with a natural, friendly smile",
  "young-man": "a young man (mid-20s) with a natural, friendly smile",
  "middle-aged-woman": "a middle-aged woman (40s) with a warm, approachable expression",
  "middle-aged-man": "a middle-aged man (40s) with a warm, approachable expression",
  diverse: "a person of diverse appearance with a natural, friendly smile",
};

export async function generateProductInHandImage(
  options: GenerateProductInHandOptions
): Promise<Buffer> {
  const client = getClient();
  const { productName, productDescription, presenterStyle = "young-woman" } = options;

  const productContext = productDescription
    ? `${productName}. ${productDescription}`
    : productName;

  const personDesc = PRESENTER_PROMPTS[presenterStyle] ?? PRESENTER_PROMPTS["young-woman"];
  const prompt = `Professional UGC-style photograph of ${personDesc} holding and showing a product to the camera. The product is: ${productContext}. Soft bedroom or office background. Vertical 9:16 portrait orientation. The product is clearly visible in their hands. Realistic lighting, high quality, TikTok-style aesthetic. Single person, one face visible.`;

  const response = await client.images.generate({
    model: "gpt-image-1",
    prompt,
    n: 1,
    size: "1024x1536",
    quality: "auto",
  });

  const b64 = (response.data![0] as { b64_json?: string })?.b64_json;
  if (!b64) {
    throw new Error("Image generation did not return image data.");
  }

  return Buffer.from(b64, "base64");
}
