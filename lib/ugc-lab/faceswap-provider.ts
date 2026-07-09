/**
 * UGC Lab — FaceSwap provider (Remaker.ai API).
 * Face swap: face image + template video → output video.
 * Does not use script/voiceover; script kept for future providers.
 */

const REMAKER_BASE = "https://developer.remaker.ai/api/remaker/v2/face-swap-video";
const POLL_INTERVAL_MS = 10_000;

function getApiKey(): string {
  const key = process.env.FACESWAP_API_KEY || process.env.REMAKER_API_KEY;
  if (!key?.trim()) {
    throw new Error("FACESWAP_API_KEY or REMAKER_API_KEY is not set");
  }
  return key.trim();
}

export type FaceSwapCreateOptions = {
  faceImageUrl: string;
  templateVideoUrl: string;
  script?: string; // optional; Remaker does not support voiceover
  faceEnhance?: boolean;
};

export type FaceSwapStatus = "pending" | "processing" | "completed" | "failed";

/**
 * Submit a face swap job. Returns external_job_id for polling.
 */
export async function createFaceSwapJob(
  options: FaceSwapCreateOptions
): Promise<string> {
  const { faceImageUrl, templateVideoUrl, faceEnhance = false } = options;
  const apiKey = getApiKey();

  if (!faceImageUrl?.startsWith("http")) {
    throw new Error("Face image URL must be a valid HTTP URL");
  }
  if (!templateVideoUrl?.startsWith("http")) {
    throw new Error("Template video URL must be a valid HTTP URL");
  }

  const res = await fetch(faceImageUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch face image: ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = (res.headers.get("content-type") || "image/jpeg")
    .split(";")[0]
    .trim();
  const ext = contentType.includes("png") ? "png" : "jpg";

  const formData = new FormData();
  formData.append(
    "swap_image",
    new Blob([buffer], { type: contentType }),
    `face.${ext}`
  );
  formData.append("target_video_url", templateVideoUrl);
  formData.append("face_enhance", String(faceEnhance));

  const createRes = await fetch(`${REMAKER_BASE}/create-job`, {
    method: "POST",
    headers: {
      Authorization: apiKey,
    },
    body: formData,
  });

  const data = (await createRes.json()) as {
    code?: number;
    result?: { job_id?: string };
    message?: { en?: string };
  };

  if (!createRes.ok) {
    const msg = data.message?.en ?? (await createRes.text());
    throw new Error(`FaceSwap create failed: ${createRes.status} ${msg}`);
  }

  const jobId = data.result?.job_id;
  if (!jobId || typeof jobId !== "string") {
    throw new Error("FaceSwap did not return job_id");
  }
  return jobId;
}

export type FaceSwapPollResult =
  | { status: "pending" | "processing"; progress: number; videoUrl?: null }
  | { status: "completed"; progress: 100; videoUrl: string }
  | { status: "failed"; error: string };

/**
 * Poll FaceSwap job status. Returns status + videoUrl when completed.
 */
export async function pollFaceSwapStatus(
  externalJobId: string
): Promise<FaceSwapPollResult> {
  const apiKey = getApiKey();

  const res = await fetch(`${REMAKER_BASE}/${externalJobId}`, {
    method: "GET",
    headers: { Authorization: apiKey },
  });

  const data = (await res.json()) as {
    code?: number;
    result?: {
      output?: string[];
      progress?: number;
    };
    message?: { en?: string } | string;
  };

  if (!res.ok) {
    const msg =
      typeof data.message === "object" ? data.message?.en : String(data.message ?? res.statusText);
    return { status: "failed", error: `FaceSwap poll failed: ${res.status} ${msg}` };
  }

  const code = data.code;
  const result = data.result ?? {};
  const progress = typeof result.progress === "number" ? result.progress : 0;
  const output = result.output;

  if (code === 100000 && Array.isArray(output) && output.length > 0) {
    const videoUrl = output[0];
    if (videoUrl && typeof videoUrl === "string") {
      return { status: "completed", progress: 100, videoUrl };
    }
  }

  if (code === 300102) {
    return { status: "processing", progress, videoUrl: null };
  }

  if (code !== 100000 && code !== 300102) {
    const msg =
      typeof data.message === "object" ? data.message?.en : String(data.message ?? "Unknown error");
    return { status: "failed", error: msg || `FaceSwap error code: ${code}` };
  }

  return { status: "processing", progress, videoUrl: null };
}

/**
 * Poll until completed or failed. Returns video_url when done.
 */
export async function pollFaceSwapUntilDone(
  externalJobId: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const result = await pollFaceSwapStatus(externalJobId);

    if (result.status === "completed" && result.videoUrl) {
      return result.videoUrl;
    }
    if (result.status === "failed") {
      throw new Error(result.error);
    }

    onProgress?.(result.progress);

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("FaceSwap job timed out");
}

/**
 * Get template video URL for FaceSwap. Uses env:
 * - FACESWAP_TEMPLATE_VIDEO_URL (default for all templates)
 * - FACESWAP_TEMPLATE_SELFIE_TALK_URL, etc. (per-template override)
 */
export function getTemplateVideoUrl(templateId: string): string {
  const key = templateId
    ? `FACESWAP_TEMPLATE_${templateId.toUpperCase().replace(/-/g, "_")}_URL`
    : "FACESWAP_TEMPLATE_VIDEO_URL";
  const url =
    process.env[key] || process.env.FACESWAP_TEMPLATE_VIDEO_URL;
  if (!url?.trim() || !url.startsWith("http")) {
    throw new Error(
      `${key} or FACESWAP_TEMPLATE_VIDEO_URL must be a valid HTTP URL. Set it in .env.local for FaceSwap.`
    );
  }
  return url.trim();
}
