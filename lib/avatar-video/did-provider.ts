/**
 * D-ID Provider
 * Cost: ~$0.10/video credit — ~10x cheaper than HeyGen
 * Quality: close to HeyGen (HD talking avatar)
 *
 * D-ID handles TTS internally — no separate audio generation needed.
 * Supported TTS: Microsoft Azure voices (en-US-JennyNeural, en-US-GuyNeural, etc.)
 *
 * Docs: https://docs.d-id.com/reference/create-a-talk
 */

import type { StartVideoResult, VideoStatusResult, ProviderOptions } from "./types";

const DID_BASE = "https://api.d-id.com";

// Preset face images — same as fal.ai presets for consistency
export const DID_FACE_PRESETS = [
  {
    id: "presenter-f1",
    label: "Sophia (female)",
    url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=512&h=512&fit=crop&crop=face",
  },
  {
    id: "presenter-f2",
    label: "Maya (female)",
    url: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=512&h=512&fit=crop&crop=face",
  },
  {
    id: "presenter-m1",
    label: "James (male)",
    url: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=512&h=512&fit=crop&crop=face",
  },
  {
    id: "presenter-m2",
    label: "Marcus (male)",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=512&h=512&fit=crop&crop=face",
  },
] as const;

// D-ID Microsoft Azure voice options (English)
export const DID_VOICES = [
  { id: "en-US-JennyNeural", label: "Jenny (female, US)" },
  { id: "en-US-AriaNeural", label: "Aria (female, US)" },
  { id: "en-US-GuyNeural", label: "Guy (male, US)" },
  { id: "en-US-DavisNeural", label: "Davis (male, US)" },
  { id: "en-GB-SoniaNeural", label: "Sonia (female, UK)" },
  { id: "en-GB-RyanNeural", label: "Ryan (male, UK)" },
] as const;

function getDIDApiKey(): string {
  const key = process.env.DID_API_KEY?.trim();
  if (!key) throw new Error("DID_API_KEY is not set in .env.local");
  return key;
}

function authHeader(apiKey: string): string {
  // D-ID uses Basic auth: base64(apiKey) where apiKey is already "email:key" format
  // If it's already base64 (contains no colon), use as-is; otherwise base64 encode it
  if (apiKey.includes(":")) {
    return `Basic ${Buffer.from(apiKey).toString("base64")}`;
  }
  return `Basic ${apiKey}`;
}

/**
 * Start a D-ID talking avatar video. Returns the talk ID.
 */
export async function startDIDVideo(options: ProviderOptions): Promise<StartVideoResult> {
  const apiKey = getDIDApiKey();

  // Pick face image
  const facePresetId = options.faceImageUrl ?? DID_FACE_PRESETS[0].id;
  const preset = DID_FACE_PRESETS.find((p) => p.id === facePresetId);
  const sourceUrl = preset?.url ?? options.faceImageUrl ?? DID_FACE_PRESETS[0].url;

  // Voice (Microsoft Neural)
  const voiceId = options.voiceId ?? "en-US-JennyNeural";

  const payload = {
    source_url: sourceUrl,
    script: {
      type: "text",
      input: options.script.trim(),
      provider: {
        type: "microsoft",
        voice_id: voiceId,
      },
    },
    config: {
      fluent: true,
      pad_audio: 0.0,
      stitch: true,
    },
  };

  const res = await fetch(`${DID_BASE}/talks`, {
    method: "POST",
    headers: {
      Authorization: authHeader(apiKey),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    const msg = String(data.description ?? data.message ?? data.kind ?? res.statusText);
    throw new Error(`D-ID create talk failed: ${res.status} — ${msg}`);
  }

  const talkId = data.id as string | undefined;
  if (!talkId) {
    throw new Error("D-ID did not return a talk ID");
  }

  return { jobId: talkId, provider: "did", script: options.script };
}

/**
 * Poll D-ID talk status. Returns VideoStatusResult.
 */
export async function checkDIDStatus(jobId: string): Promise<VideoStatusResult> {
  const apiKey = getDIDApiKey();

  const res = await fetch(`${DID_BASE}/talks/${jobId}`, {
    headers: {
      Authorization: authHeader(apiKey),
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    if (res.status === 404) return { status: "failed", error: "Talk not found" };
    return { status: "processing" };
  }

  const data = (await res.json()) as Record<string, unknown>;
  const status = String(data.status ?? "created");

  if (status === "done") {
    const resultUrl = data.result_url as string | undefined;
    if (resultUrl) {
      return { status: "completed", videoUrl: resultUrl };
    }
    return { status: "failed", error: "D-ID returned done but no result_url" };
  }

  if (status === "error" || status === "rejected") {
    const errObj = data.error as Record<string, unknown> | string | undefined;
    const errMsg = typeof errObj === "object" && errObj !== null
      ? String(errObj.description ?? errObj.message ?? "D-ID generation failed")
      : String(errObj ?? "D-ID generation failed");
    return { status: "failed", error: errMsg };
  }

  // status is "created" | "started" | "processing"
  return { status: "processing" };
}
