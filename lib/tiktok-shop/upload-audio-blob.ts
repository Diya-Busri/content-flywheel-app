import { put } from "@vercel/blob";

const PREFIX = "voiceovers";

/**
 * Upload voiceover audio to Vercel Blob and return the public URL.
 * Permanent storage; works without Supabase. Requires BLOB_READ_WRITE_TOKEN.
 */
export async function uploadAudioToBlob(
  buffer: Buffer,
  contentType: string,
  key: string
): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set. Add Vercel Blob storage in the project (Storage tab) and set the token."
    );
  }

  const pathname = key.startsWith(PREFIX) ? key : `${PREFIX}/${key}`;
  const blob = await put(pathname, buffer, {
    access: "public",
    contentType: contentType || "audio/mpeg",
    addRandomSuffix: true,
  });
  return blob.url;
}
