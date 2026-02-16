import { put } from "@vercel/blob";

const PREFIX = "product-images";

/**
 * Upload product image buffer to Vercel Blob and return the public URL.
 * Requires BLOB_READ_WRITE_TOKEN. Used so the user's uploaded image is always used in the video.
 */
export async function uploadProductImageToBlob(
  buffer: Buffer,
  contentType: string
): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set");
  }
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const pathname = `${PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const blob = await put(pathname, buffer, {
    access: "public",
    contentType: contentType || "image/jpeg",
    addRandomSuffix: false,
  });
  return blob.url;
}
