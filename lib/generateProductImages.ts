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
    model: "dall-e-3",
    prompt: fullPrompt,
    n: 1,
    size: "1024x1024",
    quality: "standard",
    style: "natural",
    response_format: "url",
  });

  const url = response.data[0]?.url;
  if (!url || typeof url !== "string") {
    throw new Error("DALL-E did not return an image URL.");
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn("[generateProductImages] BLOB_READ_WRITE_TOKEN not set. Returning temporary OpenAI URL.");
    return url;
  }

  const imageRes = await fetch(url);
  if (!imageRes.ok) {
    throw new Error(`Failed to fetch generated image: ${imageRes.status}`);
  }
  const arrayBuffer = await imageRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

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
