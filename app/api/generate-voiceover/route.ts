/**
 * POST /api/generate-voiceover
 * ElevenLabs text-to-speech using ELEVENLABS_API_KEY; falls back to OpenAI TTS (tts-1, alloy) on 401 or quota_exceeded.
 * Body: { text, voiceId, stability?, similarity? }
 * Returns: MP3 audio file (downloadable). Client uploads to Supabase when saving.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getElevenLabsApiKey } from "@/lib/elevenlabs-api-key";

export const dynamic = "force-dynamic";

const AUDIO_HEADERS = {
  "Content-Type": "audio/mpeg",
  "Content-Disposition": 'attachment; filename="voiceover.mp3"',
} as const;

/** Call OpenAI TTS (tts-1, alloy). Returns MP3 array buffer or throws. */
async function generateWithOpenAITTS(text: string): Promise<ArrayBuffer> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured. Cannot use TTS fallback.");
  }
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "tts-1",
      voice: "alloy",
      input: text,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("[generate-voiceover] OpenAI TTS error:", res.status, errText.slice(0, 300));
    throw new Error(`OpenAI TTS failed: ${res.status}`);
  }
  return res.arrayBuffer();
}

export async function POST(request: NextRequest) {
  try {
    console.log("[generate-voiceover] Scene voiceover request received");
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    console.log("[generate-voiceover] Body:", JSON.stringify(body).substring(0, 200));

    const apiKey = getElevenLabsApiKey();
    console.log("[generate-voiceover] ElevenLabs key exists:", !!process.env.ELEVENLABS_API_KEY);
    if (!apiKey) {
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY is not configured. Add it to .env.local (local) or Vercel env vars, then restart or redeploy." },
        { status: 503 }
      );
    }
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const voiceId = typeof body.voiceId === "string" ? body.voiceId.trim() : "";
    const stability = typeof body.stability === "number" ? Math.max(0, Math.min(1, body.stability)) : 0.5;
    const similarity = typeof body.similarity === "number" ? Math.max(0, Math.min(1, body.similarity)) : 0.75;

    console.log("[generate-voiceover] Request:", { textLength: text.length, textPreview: text.slice(0, 80), hasVoiceId: !!voiceId });

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    if (!voiceId) {
      return NextResponse.json({ error: "voiceId is required" }, { status: 400 });
    }

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability,
          similarity_boost: similarity,
        },
        output_format: "mp3_44100_128",
      }),
    });

    console.log("[generate-voiceover] ElevenLabs response:", res.status);

    if (res.ok) {
      const audioBuffer = await res.arrayBuffer();
      return new NextResponse(audioBuffer, { status: 200, headers: AUDIO_HEADERS });
    }

    const errText = await res.text();
    console.error("[generate-voiceover] ElevenLabs error:", res.status, errText.slice(0, 400));

    let useOpenAIFallback = res.status === 401;
    if (!useOpenAIFallback) {
      try {
        const errJson = JSON.parse(errText) as { detail?: { status?: string } };
        useOpenAIFallback = errJson.detail?.status === "quota_exceeded";
      } catch {
        // ignore parse errors
      }
    }

    if (useOpenAIFallback && process.env.OPENAI_API_KEY?.trim()) {
      console.log("[generate-voiceover] Using OpenAI TTS fallback (tts-1, alloy)");
      try {
        const audioBuffer = await generateWithOpenAITTS(text);
        return new NextResponse(audioBuffer, { status: 200, headers: AUDIO_HEADERS });
      } catch (e) {
        console.error("[generate-voiceover] OpenAI TTS fallback failed:", e);
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Voiceover fallback failed" },
          { status: 502 }
        );
      }
    }

    return NextResponse.json(
      {
        error:
          res.status === 401
            ? "Invalid API key. Check .env.local: variable must be ELEVENLABS_API_KEY (exact name), value = your key from elevenlabs.io. Restart the dev server after editing .env.local."
            : res.status === 404
              ? "Voice not found"
              : "Voiceover generation failed",
      },
      { status: res.status === 401 || res.status === 404 ? res.status : 502 }
    );
  } catch (e) {
    console.error("[generate-voiceover]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Voiceover generation failed" },
      { status: 500 }
    );
  }
}
