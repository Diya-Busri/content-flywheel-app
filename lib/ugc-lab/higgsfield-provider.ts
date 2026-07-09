/**
 * UGC Lab — Higgsfield provider (image-to-video API).
 * Takes a face/portrait image + prompt → animated video.
 *
 * Base URL: https://platform.higgsfield.ai
 * Docs:     https://docs.higgsfield.ai/docs/how-to/introduction
 *
 * Flow:
 *  1. POST /{model_id}  → { request_id }
 *  2. GET  /requests/{request_id}/status  → poll until completed
 *  3. Extract video_url from completed response
 */

const HIGGSFIELD_BASE = "https://platform.higgsfield.ai";
const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_ATTEMPTS = 36; // 6 minutes max

// Best model for portrait/UGC animation
// Docs: https://docs.higgsfield.ai/docs/guides/video
const DEFAULT_MODEL = "higgsfield-ai/dop/standard";

// Per-template prompts — each maps to a distinct UGC style
const TEMPLATE_PROMPTS: Record<string, string> = {
  "selfie-talk":
    "Person speaking directly to camera with enthusiasm and energy, natural selfie-style perspective, slight body movement, expressive and engaging facial expressions",
  "unboxing":
    "Person looking excited and surprised, hands moving as if unboxing a product, glancing at camera with delight, genuine reaction",
  "testimonial":
    "Person speaking calmly and sincerely to camera, nodding gently, warm confident expression, natural lighting",
  "reaction":
    "Person reacting with genuine surprise and excitement, expressive face, hands gesturing with enthusiasm, high energy",
  "aesthetic-vibe":
    "Person with graceful slow movement, looking dreamily at camera, soft aesthetic atmosphere, cinematic bokeh",
};

const DEFAULT_PROMPT =
  "Person speaking naturally to camera, expressive and engaging, UGC creator style";

/**
 * Higgsfield uses  "Key {api_key}:{api_secret}"  — not Bearer.
 * Store HIGGSFIELD_API_KEY  and  HIGGSFIELD_API_SECRET  in env.
 * Both are shown on cloud.higgsfield.ai/api-keys
 */
function getAuthHeader(): string {
  const key = process.env.HIGGSFIELD_API_KEY?.trim();
  const secret = process.env.HIGGSFIELD_API_SECRET?.trim();
  if (!key) throw new Error("HIGGSFIELD_API_KEY is not set");
  if (!secret) throw new Error("HIGGSFIELD_API_SECRET is not set");
  return `Key ${key}:${secret}`;
}

export function getTemplatePrompt(templateId: string, script?: string): string {
  const basePrompt = TEMPLATE_PROMPTS[templateId] ?? DEFAULT_PROMPT;
  if (script?.trim()) {
    return `${basePrompt}. Context: ${script.slice(0, 200)}`;
  }
  return basePrompt;
}

export type HiggsfieldCreateOptions = {
  imageUrl: string;
  templateId: string;
  script?: string;
  model?: string;
};

/**
 * Submit an image-to-video job. Returns request_id for polling.
 */
export async function createHiggsfieldJob(
  options: HiggsfieldCreateOptions
): Promise<string> {
  const { imageUrl, templateId, script, model = DEFAULT_MODEL } = options;
  const auth = getAuthHeader();

  const prompt = getTemplatePrompt(templateId, script);

  const res = await fetch(`${HIGGSFIELD_BASE}/${model}`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      image_url: imageUrl,
      prompt,
    }),
  });

  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    // ignore parse errors
  }

  if (!res.ok) {
    const msg = (data.error as string) || (data.message as string) || res.statusText;
    throw new Error(`Higgsfield submit failed ${res.status}: ${msg}`);
  }

  const requestId =
    (data.request_id as string) ||
    (data.id as string) ||
    ((data.data as Record<string, unknown>)?.request_id as string);

  if (!requestId) {
    throw new Error(`Higgsfield returned no request_id. Response: ${JSON.stringify(data)}`);
  }

  return requestId;
}

export type HiggsfieldPollResult = {
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  videoUrl: string | null;
  error?: string;
};

/**
 * Check the status of a Higgsfield job once.
 */
export async function pollHiggsfieldStatus(
  requestId: string
): Promise<HiggsfieldPollResult> {
  const auth = getAuthHeader();

  const res = await fetch(
    `${HIGGSFIELD_BASE}/requests/${requestId}/status`,
    {
      headers: { Authorization: auth, "Accept": "application/json" },
    }
  );

  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok) {
    return { status: "failed", progress: 0, videoUrl: null, error: `Status check failed: ${res.status}` };
  }

  const status = (data.status as string)?.toLowerCase() ?? "";

  // Completed — extract video URL from various possible response shapes.
  // Higgsfield actual format: { status: "completed", video: { url: "..." } }
  if (status === "completed" || status === "succeeded" || status === "success") {
    const video = data.video as Record<string, unknown> | undefined;
    const output = data.output as Record<string, unknown> | undefined;
    const result = data.result as Record<string, unknown> | undefined;
    const videoUrl =
      (video?.url as string) ||                                              // ✓ actual format
      (output?.video_url as string) ||
      (output?.url as string) ||
      (result?.url as string) ||
      (result?.video_url as string) ||
      (data.video_url as string) ||
      (Array.isArray(data.output) ? (data.output as string[])[0] : null) ||
      null;

    console.log("[higgsfield] Completed response keys:", Object.keys(data));
    console.log("[higgsfield] video field:", JSON.stringify(video));
    console.log("[higgsfield] Resolved videoUrl:", videoUrl);

    if (!videoUrl) {
      return {
        status: "failed",
        progress: 100,
        videoUrl: null,
        error: `Job completed but no video URL found. Response: ${JSON.stringify(data).slice(0, 500)}`,
      };
    }
    return { status: "completed", progress: 100, videoUrl };
  }

  if (status === "failed" || status === "error" || status === "cancelled") {
    const error = (data.error as string) || (data.message as string) || "Job failed";
    return { status: "failed", progress: 0, videoUrl: null, error };
  }

  // queued / processing / running / pending
  const progress =
    typeof data.progress === "number"
      ? data.progress
      : status === "processing"
      ? 50
      : 10;

  return { status: "processing", progress, videoUrl: null };
}

/**
 * Poll until completed or failed. Returns video_url when done.
 */
export async function pollHiggsfieldUntilDone(
  requestId: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const result = await pollHiggsfieldStatus(requestId);

    if (result.status === "completed" && result.videoUrl) {
      return result.videoUrl;
    }
    if (result.status === "failed") {
      throw new Error(result.error ?? "Higgsfield job failed");
    }

    onProgress?.(result.progress);
  }

  throw new Error("Higgsfield job timed out after 6 minutes");
}
