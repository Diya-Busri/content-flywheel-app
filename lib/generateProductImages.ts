/**
 * Generate DALL-E images for digital products.
 * Creates images for ebook, workbook, guide, templates, course, journal, planner, checklist.
 * Downloads and uploads to Vercel Blob for caching (generated once per product).
 */

import OpenAI from "openai";
import { put } from "@vercel/blob";

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not set. Required for product image generation.");
  return new OpenAI({ apiKey: key });
}

export type ImageContext = {
  productName: string;
  niche: string;
  format?: string;
};

/**
 * Generate one DALL-E image and upload to Vercel Blob.
 * Returns the public Blob URL for persistent storage. Returns null if Blob not configured.
 */
export async function generateProductImage(
  prompt: string,
  context: ImageContext
): Promise<string | null> {
  const client = getClient();

  const fullPrompt = `Professional digital product illustration: ${prompt}. Context: "${context.productName}" for ${context.niche} audience. Clean, modern, high-quality. No text in image. Suitable for digital PDF.`;

  const response = await client.images.generate({
    model: "gpt-image-1",
    prompt: fullPrompt,
    n: 1,
    size: "1024x1024",
    quality: "low",
  });

  const b64 = response.data[0]?.b64_json;
  if (!b64) {
    throw new Error("Image generation returned no data.");
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn("[generateProductImages] BLOB_READ_WRITE_TOKEN not set. Returning data URL.");
    return `data:image/png;base64,${b64}`;
  }

  const buffer = Buffer.from(b64, "base64");

  const folder = context.format ? `${context.format}-images` : "product-images";
  const ext = "png";
  const pathname = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const blob = await put(pathname, buffer, {
    access: "public",
    contentType: "image/png",
    addRandomSuffix: false,
  });
  return blob.url;
}
