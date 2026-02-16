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
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1024x1792",
    quality: "standard",
    style: "natural",
    response_format: "url",
  });

  const url = response.data[0]?.url;
  if (!url || typeof url !== "string") {
    throw new Error("DALL-E did not return an image URL.");
  }

  const imageRes = await fetch(url);
  if (!imageRes.ok) {
    throw new Error(`Failed to fetch generated image: ${imageRes.status}`);
  }
  const arrayBuffer = await imageRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
