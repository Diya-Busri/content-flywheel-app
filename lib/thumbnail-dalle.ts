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

/** Background-only prompt: no title or text in the image. Title is overlaid as HTML/CSS in the UI. */
function buildPrompt(
  style: ThumbnailStyleId,
  productTitle: string,
  productType: string,
  niche: string
): string {
  const styleDesc = STYLE_PROMPTS[style];
  const typeLabel =
    productType?.toLowerCase().includes("workbook")
      ? "spiral-bound workbook"
      : productType?.toLowerCase().includes("planner")
        ? "daily planner"
        : productType?.toLowerCase().includes("journal")
          ? "hardcover journal"
          : productType?.toLowerCase().includes("spreadsheet")
            ? "spreadsheet template on a laptop screen"
            : productType?.toLowerCase().includes("checklist")
              ? "checklist printable"
              : productType?.toLowerCase().includes("notion")
                ? "Notion template dashboard on a screen"
                : "ebook";

  const nicheDesc = niche || "digital products";
  const titleHint = productTitle
    ? `representing "${productTitle.slice(0, 50)}"`
    : "";

  return `Professional digital product mockup: elegant 3D ${typeLabel} mockup on a premium background, themed around ${nicheDesc} ${titleHint}. ${styleDesc}. Modern, clean, marketplace-ready. High quality, professional lighting, attractive colors. The product looks distinct and specific to its type. No text, no words, no letters visible anywhere in the image.`;
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
    model: "gpt-image-1",
    prompt,
    n: 1,
    size: "1536x1024",
    quality: "medium",
  });

  const b64 = response.data![0]?.b64_json;
  if (!b64) {
    throw new Error("Image generation returned no data.");
  }
  const buffer = Buffer.from(b64, "base64");

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { url: `data:image/png;base64,${b64}`, cached: false };
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
    console.warn("[thumbnail-dalle] Supabase upload failed, using data URL:", uploadResult.error.message);
    return { url: `data:image/png;base64,${b64}`, cached: false };
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return { url: urlData.publicUrl, cached: true };
}
