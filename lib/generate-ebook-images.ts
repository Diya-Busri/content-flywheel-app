/**
 * Generate DALL-E images for ebook chapters.
 * Creates 1 image per chapter for professional illustrated ebooks.
 */

import OpenAI from "openai";
import { upload } from "@/lib/storage";

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
    model: "gpt-image-1",
    prompt: fullPrompt,
    n: 1,
    size: "1024x1024",
    quality: "auto",
  });

  const b64 = (response.data![0] as { b64_json?: string })?.b64_json;
  if (!b64) {
    throw new Error("Image generation did not return image data.");
  }

  const buffer = Buffer.from(b64, "base64");

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn("[ebook-images] BLOB_READ_WRITE_TOKEN not set. Skipping image upload.");
    return null;
  }

  const ext = "png";
  const pathname = `ebook-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const blob = await upload(pathname, buffer, {
    access: "public",
    contentType: "image/png",
    addRandomSuffix: false,
  });
  return blob.url;
}
