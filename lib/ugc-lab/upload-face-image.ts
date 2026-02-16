import { put } from "@vercel/blob";

const PREFIX = "face-profiles";

/**
 * Upload face image buffer to Vercel Blob (temporary/public storage).
 * Requires BLOB_READ_WRITE_TOKEN.
 */
export async function uploadFaceImage(
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
