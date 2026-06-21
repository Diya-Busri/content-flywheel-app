import { upload } from "@/lib/storage";

const PREFIX = "product-images";

/** Upload product image buffer to R2 and return the public URL. */
export async function uploadProductImageToBlob(
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
