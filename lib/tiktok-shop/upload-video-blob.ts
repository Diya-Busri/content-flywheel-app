import { put } from "@vercel/blob";

const PREFIX = "videos";

/**
 * Download video from URL and upload to Vercel Blob for permanent storage.
 * HeyGen URLs expire in 7 days; this preserves the video.
 */
export async function uploadVideoFromUrlToBlob(videoUrl: string): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set");
  }
  const res = await fetch(videoUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch video: ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const pathname = `${PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
  const blob = await put(pathname, buffer, {
    access: "public",
    contentType: "video/mp4",
    addRandomSuffix: false,
  });
  return blob.url;
}
