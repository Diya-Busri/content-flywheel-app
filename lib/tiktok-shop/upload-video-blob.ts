import { upload } from "@/lib/storage";

const PREFIX = "videos";

/**
 * Download video from URL and upload to R2 for permanent storage.
 * HeyGen URLs expire in 7 days; this preserves the video.
 */
export async function uploadVideoFromUrlToBlob(videoUrl: string): Promise<string> {
  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`Failed to fetch video: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const pathname = `${PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
  const blob = await upload(pathname, buffer, {
    access: "public",
    contentType: "video/mp4",
    addRandomSuffix: false,
  });
  return blob.url;
}
