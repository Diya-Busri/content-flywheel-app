import { upload } from "@/lib/storage";

const PREFIX = "face-profiles";

/** Upload face image buffer to R2 (temporary/public storage). */
export async function uploadFaceImage(
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const pathname = `${PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const blob = await upload(pathname, buffer, {
    access: "public",
    contentType: contentType || "image/jpeg",
    addRandomSuffix: false,
  });
  return blob.url;
}
