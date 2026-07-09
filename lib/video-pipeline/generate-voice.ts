/**
 * Generate voiceover audio via ElevenLabs.
 * Returns the audio buffer. Use an upload step to get a URL for Creatomate.
 */
export async function generateVoice(narration: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("ELEVENLABS_API_KEY is not set. Add it to your environment.");
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() ?? "pNInz6obpgDQGcFmaJgB";

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
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[video-pipeline] ElevenLabs error:", res.status, err);
    throw new Error(`ElevenLabs TTS failed: ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
