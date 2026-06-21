/**
 * fal.ai SadTalker Provider
 * Cost: ~$0.002/video (fal.ai pay-per-use) + ~$0.001 (OpenAI TTS) = <$0.01 total
 *
 * Flow:
 *   1. Generate MP3 audio from script via OpenAI TTS
 *   2. Upload MP3 to Vercel Blob (fal.ai needs a URL, not raw bytes)
 *   3. Submit fal-ai/sadtalker job with face image URL + audio URL
 *   4. Return requestId → client polls /status
 */

import OpenAI from "openai";
import { upload } from "@/lib/storage";
import type { StartVideoResult, VideoStatusResult, ProviderOptions } from "./types";

const FAL_BASE = "https://queue.fal.run";
const FAL_MODEL = "fal-ai/sadtalker";

// OpenAI TTS voices available in the picker
export const FAL_TTS_VOICES = [
  { id: "nova", label: "Nova (female, warm)" },
  { id: "alloy", label: "Alloy (neutral)" },
  { id: "echo", label: "Echo (male)" },
  { id: "fable", label: "Fable (male, storyteller)" },
  { id: "onyx", label: "Onyx (male, deep)" },
  { id: "shimmer", label: "Shimmer (female, bright)" },
] as const;

export type FalTtsVoice = (typeof FAL_TTS_VOICES)[number]["id"];

// Preset stock face images — neutral professional presenters
// These are publicly hosted royalty-free headshots
export const FAL_FACE_PRESETS = [
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

export type FalFacePresetId = (typeof FAL_FACE_PRESETS)[number]["id"];

function getFalApiKey(): string {
  const key = process.env.FAL_API_KEY?.trim();
  if (!key) throw new Error("FAL_API_KEY is not set in .env.local");
  return key;
}

/**
 * Generate MP3 from script via OpenAI TTS and upload to Vercel Blob.
 * Returns a public URL fal.ai can fetch.
 */
async function generateAudioUrl(script: string, voice: string = "nova"): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for audio generation");

  const openai = new OpenAI({ apiKey });
  const mp3 = await openai.audio.speech.create({
    model: "tts-1",
    voice: voice as "nova" | "alloy" | "echo" | "fable" | "onyx" | "shimmer",
    input: script.slice(0, 4096),
    response_format: "mp3",
    speed: 1.05, // Slightly faster for punchy promos
  });

  const buffer = Buffer.from(await mp3.arrayBuffer());

  // Must persist to a public URL — fal.ai can't receive base64 audio
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await upload(
      `avatar-audio/${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`,
      buffer,
      { access: "public", contentType: "audio/mpeg", addRandomSuffix: false }
    );
    return blob.url;
  }

  throw new Error(
    "BLOB_READ_WRITE_TOKEN is required for fal.ai provider (audio must be a public URL). " +
    "Add it to .env.local or use D-ID/HeyGen which handle TTS internally."
  );
}

/**
 * Start a SadTalker video job. Returns the fal.ai request_id.
 */
export async function startFalVideo(options: ProviderOptions & { ttsVoice?: string }): Promise<StartVideoResult> {
  const apiKey = getFalApiKey();

  // 1. Pick face image
  const facePresetId = (options.faceImageUrl as string | undefined) ?? FAL_FACE_PRESETS[0].id;
  const preset = FAL_FACE_PRESETS.find((p) => p.id === facePresetId);
  const faceUrl = preset?.url ?? options.faceImageUrl ?? FAL_FACE_PRESETS[0].url;

  // 2. Generate audio
  const voice = options.voiceId ?? "nova";
  const audioUrl = await generateAudioUrl(options.script, voice);

  // 3. Submit to fal.ai SadTalker queue
  const res = await fetch(`${FAL_BASE}/${FAL_MODEL}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source_image_url: faceUrl,
      driven_audio_url: audioUrl,
      expression_scale: 1.2,     // More expressive
      still_mode: false,          // Allow head movement
      preprocess: "crop",
      size_of_image: 256,
      pose_style: 0,
    }),
  });

  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`fal.ai SadTalker error: ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    const msg = (data.detail ?? data.message ?? data.error ?? res.statusText) as string;
    throw new Error(`fal.ai SadTalker submit failed: ${res.status} — ${msg}`);
  }

  const requestId = (data.request_id ?? data.requestId) as string | undefined;
  if (!requestId) {
    throw new Error("fal.ai SadTalker did not return a request_id");
  }

  return { jobId: requestId, provider: "falai", script: options.script };
}

/**
 * Poll the status of a SadTalker job.
 */
export async function checkFalStatus(jobId: string): Promise<VideoStatusResult> {
  const apiKey = getFalApiKey();

  const statusRes = await fetch(
    `https://queue.fal.run/${FAL_MODEL}/requests/${jobId}/status`,
    { headers: { Authorization: `Key ${apiKey}` } }
  );

  if (!statusRes.ok) {
    return { status: "processing" }; // Retry on transient errors
  }

  const raw = (await statusRes.json()) as Record<string, unknown>;
  const status = String(raw.status ?? "IN_QUEUE");

  if (status === "COMPLETED") {
    // Fetch result
    const resultRes = await fetch(
      `https://queue.fal.run/${FAL_MODEL}/requests/${jobId}`,
      { headers: { Authorization: `Key ${apiKey}` } }
    );
    if (!resultRes.ok) return { status: "processing" };

    const result = (await resultRes.json()) as Record<string, unknown>;
    const videoUrl =
      (result as { video?: { url?: string } }).video?.url ??
      (result as { video_url?: string }).video_url ??
      (result as { url?: string }).url;

    if (videoUrl && typeof videoUrl === "string") {
      return { status: "completed", videoUrl };
    }
    return { status: "failed", error: "No video URL in fal.ai result" };
  }

  if (status === "FAILED" || status === "ERROR") {
    const errMsg = String(raw.error ?? raw.detail ?? "fal.ai SadTalker failed");
    return { status: "failed", error: errMsg };
  }

  return { status: "processing" };
}
