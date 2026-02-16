import { getSupabaseAdmin } from "@/lib/supabase/server";

const ELEVENLABS_TIMEOUT_MS = 60000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

/**
 * Generate voiceover via ElevenLabs. Returns a hosted audio URL when Supabase is configured.
 * Otherwise returns data URL (base64) and caller must upload to storage.
 */
export async function generateVoiceElevenLabs(narration: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() ?? "pNInz6obpgDQGcFmaJgB";

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ELEVENLABS_TIMEOUT_MS);

    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: narration,
          model_id: process.env.ELEVENLABS_MODEL_ID?.trim() ?? "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text();
        console.error("[tiktokshop/voice] ElevenLabs error:", res.status, errText.slice(0, 200));
        throw new Error(`ElevenLabs TTS failed: ${res.status}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const supabase = getSupabaseAdmin();
      const bucket = process.env.SUPABASE_VOICEOVERS_BUCKET ?? "tiktok-audio";
      if (supabase) {
        const key = `voiceover/${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`;
        const { data, error } = await supabase.storage.from(bucket).upload(key, buffer, {
          contentType: "audio/mpeg",
          upsert: true,
        });
        if (error) {
          console.error("[tiktokshop/voice] Supabase upload error:", error.message);
          throw new Error("Voice upload failed: " + error.message);
        }
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
        return urlData.publicUrl;
      }

      const base64 = buffer.toString("base64");
      const dataUrl = `data:audio/mpeg;base64,${base64}`;
      console.warn(
        "[tiktokshop/voice] Supabase not configured. Returning base64 data URL. Caller must upload to storage for Creatomate."
      );
      return dataUrl;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (err instanceof Error && err.name === "AbortError") {
        lastError = new Error("ElevenLabs request timed out");
      }
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }

  throw lastError ?? new Error("ElevenLabs TTS failed after retries");
}
