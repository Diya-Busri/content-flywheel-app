/**
 * Generate product thumbnail images via DALL-E 3.
 * Uses style-specific prompts for marketplace-optimized thumbnails.
 * Caches results in Supabase storage.
 */

import OpenAI from "openai";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type ThumbnailStyleId =
  | "modern-gradient"
  | "clean-minimal"
  | "bold-dark"
  | "lifestyle";

const STYLE_PROMPTS: Record<
  ThumbnailStyleId,
  string
> = {
  "modern-gradient":
    "vibrant gradient background, floating 3D mockup",
  "clean-minimal":
    "white clean background, minimal shadows, elegant",
  "bold-dark":
    "dark premium background, dramatic lighting, luxury feel",
  "lifestyle":
    "lifestyle flat lay setting, desk setup, cozy aesthetic",
};

/** Uses existing product-images bucket (same as ebook/product image generation). */
const BUCKET = "product-images";

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey: key });
}

function buildPrompt(
  style: ThumbnailStyleId,
  productTitle: string,
  productType: string,
  niche: string
): string {
  const styleDesc = STYLE_PROMPTS[style];
  const typeLabel =
    productType?.toLowerCase().includes("workbook")
      ? "workbook"
      : productType?.toLowerCase().includes("planner")
        ? "planner"
        : productType?.toLowerCase().includes("journal")
          ? "journal"
          : productType?.toLowerCase().includes("spreadsheet")
            ? "spreadsheet template"
            : "ebook";

  return `Professional digital product mockup for a ${typeLabel} called '${productTitle}' about ${niche || "digital products"}. Show an elegant 3D ${typeLabel} mockup on a premium background. ${styleDesc}. Modern, clean, marketplace-ready design. High quality, professional lighting, attractive colors. No text on the image.`;
}

export type GenerateThumbnailResult = { url: string; cached: boolean };

/**
 * Generate thumbnail via DALL-E 3. Tries to cache in Supabase; if that fails, returns the DALL-E URL so the thumbnail still works (may expire ~1h).
 */
export async function generateThumbnail(
  productId: string,
  product: {
    title: string;
    niche: string;
    format?: string;
  },
  style: ThumbnailStyleId
): Promise<GenerateThumbnailResult> {
  const openai = getOpenAI();
  const prompt = buildPrompt(
    style,
    product.title || "Digital Product",
    product.format || "PDF",
    product.niche || ""
  );

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1792x1024",
    quality: "standard",
    style: "natural",
    response_format: "url",
  });

  const imageUrl = response.data[0]?.url;
  if (!imageUrl || typeof imageUrl !== "string") {
    throw new Error("DALL-E did not return an image URL.");
  }

  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    throw new Error(`Failed to fetch generated image: ${imageRes.status}`);
  }
  const arrayBuffer = await imageRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { url: imageUrl, cached: false };
  }

  const ext = "png";
  const path = `thumbnails/${productId}/thumbnail.${ext}`;

  let uploadResult = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (uploadResult.error) {
    const errMsg = String(uploadResult.error.message || uploadResult.error).toLowerCase();
    const isBucketMissing = errMsg.includes("bucket") || errMsg.includes("not found") || errMsg.includes("does not exist");
    if (isBucketMissing) {
      const { error: createErr } = await supabase.storage.createBucket(BUCKET, { public: true });
      if (!createErr) {
        uploadResult = await supabase.storage
          .from(BUCKET)
          .upload(path, buffer, { contentType: "image/png", upsert: true });
      }
    }
  }

  if (uploadResult.error) {
    console.warn("[thumbnail-dalle] Supabase upload failed, using DALL-E URL:", uploadResult.error.message);
    return { url: imageUrl, cached: false };
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return { url: urlData.publicUrl, cached: true };
}
