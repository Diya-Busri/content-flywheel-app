/**
 * Generate voiceover audio buffer via ElevenLabs (no upload).
 * Use this when you need the buffer for a fallback upload (e.g. temp host).
 */
export async function getVoiceoverBuffer(script: string, voiceId?: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  const vid = voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? "pNInz6obpgDQGcFmaJgB";
  console.log("[generate-voiceover] TTS, voiceId:", vid, "scriptLength:", script.length);

  const res = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + vid, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: script,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[generate-voiceover] ElevenLabs error:", res.status, errText);
    try {
      const errJson = JSON.parse(errText) as { detail?: { status?: string; message?: string } };
      if (errJson.detail?.status === "quota_exceeded") {
        throw new Error(
          "ElevenLabs quota exceeded. " + (errJson.detail.message ?? "Not enough credits for this script. Add credits at elevenlabs.io or use a shorter script.")
        );
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("ElevenLabs quota exceeded")) throw e;
    }
    throw new Error("ElevenLabs TTS failed: " + res.status);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  console.log("[generate-voiceover] Audio size:", buffer.length);
  return buffer;
}

/**
 * Generate voiceover with ElevenLabs and upload to Supabase Storage.
 * Returns public URL of the audio file.
 * Voice "Adam" = use ELEVENLABS_VOICE_ID or default premade male voice.
 */
export async function generateVoiceover(
  script: string,
  options: {
    voiceId?: string;
    supabaseUpload: (buffer: Buffer, contentType: string, key: string) => Promise<string>;
  }
): Promise<string> {
  const buffer = await getVoiceoverBuffer(script, options.voiceId);
  const key = "voiceover/" + Date.now() + "-" + Math.random().toString(36).slice(2) + ".mp3";
  const url = await options.supabaseUpload(buffer, "audio/mpeg", key);
  console.log("[generate-voiceover] Uploaded, url:", url);
  return url;
}
