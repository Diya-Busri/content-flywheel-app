/**
 * Upload a product image to a public https URL (FFmpeg / compile, extract helpers).
 * Tries Vercel Blob first when configured; on failure or missing token, uses Supabase
 * Storage (timeline-media bucket, same as video compile).
 */
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { uploadProductImageToBlob } from "@/lib/tiktok-shop/upload-product-image-blob";

const SUPABASE_BUCKET = "timeline-media";

export async function uploadProductImageToPublicUrl(
  buffer: Buffer,
  contentType: string,
  userId: string
): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    try {
      return await uploadProductImageToBlob(buffer, contentType);
    } catch (err) {
      console.warn(
        "[upload-product-image-public] Vercel Blob failed; trying Supabase:",
        err instanceof Error ? err.message : err
      );
    }
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error(
      "Image upload unavailable: Vercel Blob failed or is not configured, and Supabase is not set (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)."
    );
  }

  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const path = `${safeUser}/tiktok-shop-products/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).upload(path, buffer, {
    contentType: contentType || "image/jpeg",
    upsert: true,
  });

  if (error) {
    const msg = String(error.message || error).toLowerCase();
    if (msg.includes("bucket") || msg.includes("not found")) {
      await supabase.storage.createBucket(SUPABASE_BUCKET, { public: true });
      const retry = await supabase.storage.from(SUPABASE_BUCKET).upload(path, buffer, {
        contentType: contentType || "image/jpeg",
        upsert: true,
      });
      if (retry.error) {
        console.error("[upload-product-image-public] Supabase retry:", retry.error);
        throw new Error(retry.error.message || "Supabase image upload failed");
      }
      const { data: pub } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(retry.data.path);
      return pub.publicUrl;
    }
    console.error("[upload-product-image-public] Supabase:", error);
    throw new Error(error.message || "Supabase image upload failed");
  }

  const { data: urlData } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}
