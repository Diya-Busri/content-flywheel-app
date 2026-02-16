/**
 * UGC Lab — Single video render via HeyGen talking photo.
 * Takes script + face image URL → uploads face to HeyGen → generates video → returns URL.
 */

import {
  uploadTalkingPhoto,
  generateVideoFromTalkingPhoto,
  type HeyGenBackgroundPreset,
} from "@/lib/tiktok-shop/heygen-video";
import { uploadVideoFromUrlToBlob } from "@/lib/tiktok-shop/upload-video-blob";

export type RenderHeyGenOptions = {
  script: string;
  faceImageUrl: string;
  voiceId?: string;
  /** Persist to Blob (HeyGen URLs expire in 7 days) */
  persistToBlob?: boolean;
  backgroundPreset?: HeyGenBackgroundPreset;
};

/**
 * Render one UGC video: face photo + script → HeyGen talking photo → video URL.
 */
export async function renderUgcVideoHeyGen(
  options: RenderHeyGenOptions
): Promise<string> {
  const { script, faceImageUrl, voiceId, persistToBlob = true } = options;

  if (!script?.trim()) {
    throw new Error("Script is required");
  }
  if (!faceImageUrl?.startsWith("http")) {
    throw new Error("Face image URL must be a valid HTTP URL");
  }

  const res = await fetch(faceImageUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch face image: ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = (res.headers.get("content-type") || "image/jpeg")
    .split(";")[0]
    .trim() as "image/jpeg" | "image/png";
  const ct: "image/jpeg" | "image/png" =
    contentType === "image/png" ? "image/png" : "image/jpeg";

  const talkingPhotoId = await uploadTalkingPhoto(buffer, ct);
  const heygenUrl = await generateVideoFromTalkingPhoto({
    script: script.trim(),
    talkingPhotoId,
    voiceId,
    caption: true,
    backgroundPreset: options.backgroundPreset ?? "office",
  });

  if (persistToBlob && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      return await uploadVideoFromUrlToBlob(heygenUrl);
    } catch (e) {
      console.warn("[render-heygen] Blob persist failed, using HeyGen URL:", e);
      return heygenUrl;
    }
  }
  return heygenUrl;
}
