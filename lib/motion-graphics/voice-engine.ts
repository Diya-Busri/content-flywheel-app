/**
 * Motion Graphics Studio — ElevenLabs Voice Engine
 *
 * Two entry points:
 *   - listVoices()             → live voice list from ElevenLabs (falls back
 *                                 to the static ELEVENLABS_VOICES list used
 *                                 elsewhere in the app if the API call fails
 *                                 or no key is configured).
 *   - generateSpeech(text, id) → calls ElevenLabs TTS, uploads the resulting
 *                                 mp3 to R2 (this feature's storage — see
 *                                 lib/storage.ts), returns the public URL.
 *
 * Reuses the app's existing ElevenLabs conventions rather than inventing new
 * ones: getElevenLabsApiKey() (lib/elevenlabs-api-key.ts) for key
 * normalization, and ELEVENLABS_VOICES (lib/elevenlabs-voices.ts) as the
 * offline fallback voice catalogue. Uploads go to R2 (not Supabase storage,
 * which lib/elevenlabs.ts uses) because every other Motion Graphics Studio
 * asset — images, video, logos, music, sfx — already lives in R2.
 */

import { randomUUID } from "crypto";
import { getElevenLabsApiKey } from "@/lib/elevenlabs-api-key";
import { ELEVENLABS_VOICES } from "@/lib/elevenlabs-voices";
import { upload } from "@/lib/storage";

const TAG = "[motion-graphics/voice-engine]";
const MAX_RETRIES = 3;
const DEFAULT_VOICE_ID = "pNInz6obpgDQGcFmaJgB"; // Adam — matches lib/elevenlabs.ts's existing default

export interface VoiceOption {
  id: string;
  name: string;
  category?: string;
  previewUrl?: string;
}

interface ElevenLabsVoicesApiResponse {
  voices?: Array<{
    voice_id: string;
    name: string;
    category?: string;
    preview_url?: string;
  }>;
}

/**
 * Returns the voice list to populate the Scene Editor's voice picker.
 * Tries the live ElevenLabs account (includes any cloned/custom voices);
 * falls back to the static catalogue if the key is missing or the call
 * fails, so the picker is never empty.
 */
export async function listVoices(): Promise<VoiceOption[]> {
  const apiKey = getElevenLabsApiKey();
  if (!apiKey) {
    console.warn(TAG, "no ELEVENLABS_API_KEY configured — returning static voice catalogue");
    return ELEVENLABS_VOICES.map((v) => ({ id: v.voiceId, name: v.name, category: v.category }));
  }

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      method: "GET",
      headers: { "xi-api-key": apiKey },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(TAG, "list voices API error:", { status: res.status, body: errText.slice(0, 200) });
      throw new Error(`ElevenLabs voices API ${res.status}`);
    }

    const data = (await res.json()) as ElevenLabsVoicesApiResponse;
    const voices = data.voices ?? [];
    if (voices.length === 0) throw new Error("empty voice list");

    return voices.map((v) => ({
      id: v.voice_id,
      name: v.name,
      category: v.category,
      previewUrl: v.preview_url,
    }));
  } catch (err) {
    console.error(TAG, "listVoices failed, falling back to static catalogue:", err);
    return ELEVENLABS_VOICES.map((v) => ({ id: v.voiceId, name: v.name, category: v.category }));
  }
}

async function fetchAudioWithRetry(text: string, voiceId: string): Promise<Buffer> {
  const apiKey = getElevenLabsApiKey();
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set — add it to .env.local and restart the dev server");
  }

  const body = {
    text,
    model_id: "eleven_monolingual_v1",
    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
  };

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(TAG, "TTS API error:", { status: res.status, attempt, body: errText.slice(0, 200) });
        throw new Error(`ElevenLabs API ${res.status}: ${errText.slice(0, 200)}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(TAG, "attempt failed:", { attempt, maxRetries: MAX_RETRIES, error: lastError.message });
      if (attempt === MAX_RETRIES) break;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }

  throw lastError ?? new Error("ElevenLabs request failed after retries");
}

/**
 * Generates a voiceover mp3 for `text` using the given ElevenLabs voice
 * (defaults to "Adam" if omitted), uploads it to R2, and returns the public
 * URL — ready to drop straight into Scene.voiceover.audioAssetUrl.
 */
export async function generateSpeech(
  text: string,
  voiceId: string = DEFAULT_VOICE_ID
): Promise<{ url: string; voiceId: string }> {
  const trimmed = text?.trim();
  if (!trimmed) {
    throw new Error("generateSpeech: text is required");
  }

  console.log(TAG, `generating speech — voiceId=${voiceId}, textLength=${trimmed.length}`);
  const audioBuffer = await fetchAudioWithRetry(trimmed, voiceId);

  const pathname = `motion-graphics/voiceovers/${randomUUID()}.mp3`;
  const { url } = await upload(pathname, audioBuffer, { contentType: "audio/mpeg" });
  console.log(TAG, "uploaded voiceover:", url);

  return { url, voiceId };
}
