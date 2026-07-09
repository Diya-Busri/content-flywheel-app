import { getSupabaseAdmin } from "@/lib/supabase/server";

const VOICE_ID = "pNInz6obpgDQGcFmaJgB";
const BUCKET = "voiceovers";
const MAX_RETRIES = 3;

type ElevenLabsVoiceSettings = {
  stability: number;
  similarity_boost: number;
};

type ElevenLabsRequestBody = {
  text: string;
  model_id: string;
  voice_settings: ElevenLabsVoiceSettings;
};

/**
 * Call ElevenLabs text-to-speech API with retries.
 * Returns the raw audio buffer on success.
 */
async function fetchAudioWithRetry(script: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  const body: ElevenLabsRequestBody = {
    text: script,
    model_id: "eleven_monolingual_v1",
    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
  };

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("[elevenlabs] API error:", { status: res.status, attempt, body: errText });
        throw new Error(`ElevenLabs API ${res.status}: ${errText.slice(0, 200)}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error("[elevenlabs] Attempt failed:", { attempt, maxRetries: MAX_RETRIES, error: lastError.message });
      if (attempt === MAX_RETRIES) break;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }

  throw lastError ?? new Error("ElevenLabs request failed after retries");
}

/**
 * Upload buffer to Supabase storage bucket and return public URL.
 */
function uploadToSupabase(buffer: Buffer, key: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }

  return supabase.storage
    .from(BUCKET)
    .upload(key, buffer, { contentType: "audio/mpeg", upsert: true })
    .then(({ data, error }) => {
      if (error) {
        console.error("[elevenlabs] Supabase upload error:", error);
        throw new Error("Failed to upload voiceover: " + (error.message ?? "unknown"));
      }
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
      return urlData.publicUrl;
    });
}

/**
 * Generate voiceover from script using ElevenLabs (Adam voice), upload to Supabase bucket "voiceovers", return public URL.
 * Retries up to 3 times on API failure. Logs errors with details.
 */
export async function generateVoiceover(script: string): Promise<string> {
  if (!script?.trim()) {
    throw new Error("generateVoiceover: script is required");
  }

  console.log("[elevenlabs] Generating voiceover, script length:", script.length);

  const audioBuffer = await fetchAudioWithRetry(script.trim());
  console.log("[elevenlabs] Audio received, size:", audioBuffer.length);

  const key = `${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`;
  const url = await uploadToSupabase(audioBuffer, key);
  console.log("[elevenlabs] Uploaded, url:", url);

  return url;
}
