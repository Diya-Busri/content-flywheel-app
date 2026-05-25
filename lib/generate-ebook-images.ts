/**
 * Generate DALL-E images for ebook chapters.
 * Creates 1 image per chapter for professional illustrated ebooks.
 */

import OpenAI from "openai";
import { put } from "@vercel/blob";

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not set. Required for ebook image generation.");
  return new OpenAI({ apiKey: key });
}

export type EbookSectionWithPrompt = { id: string; title: string; imagePrompt: string };

/**
 * Generate one DALL-E image for an ebook chapter.
 * Returns the public Blob URL after upload. Falls back to null if Blob not configured.
 */
export async function generateAndUploadEbookImage(
  prompt: string,
  productName: string,
  niche: string
): Promise<string | null> {
  const client = getClient();

  // Refine prompt for professional ebook illustration
  const fullPrompt = `Professional ebook illustration: ${prompt}. Context: "${productName}" for ${niche} audience. Clean, modern, high-quality. No text in image. Suitable for digital book.`;

  const response = await client.images.generate({
    model: "dall-e-3",
    prompt: fullPrompt,
    n: 1,
    size: "1024x1024",
    quality: "standard",
    style: "natural",
    response_format: "url",
  });

  const url = response.data![0]?.url;
  if (!url || typeof url !== "string") {
    throw new Error("DALL-E did not return an image URL.");
  }

  const imageRes = await fetch(url);
  if (!imageRes.ok) {
    throw new Error(`Failed to fetch generated image: ${imageRes.status}`);
  }
  const arrayBuffer = await imageRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn("[ebook-images] BLOB_READ_WRITE_TOKEN not set. Skipping image upload.");
    return null;
  }

  const ext = "png";
  const pathname = `ebook-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const blob = await put(pathname, buffer, {
    access: "public",
    contentType: "image/png",
    addRandomSuffix: false,
  });
  return blob.url;
}
