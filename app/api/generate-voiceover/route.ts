/**
 * POST /api/generate-voiceover
 * ElevenLabs text-to-speech using ELEVENLABS_API_KEY; falls back to OpenAI TTS (tts-1, alloy) on 401 or quota_exceeded.
 * Long scripts (>10k chars) are chunked automatically and audio is concatenated.
 * Body: { text, voiceId, stability?, similarity? }
 * Returns: MP3 audio file (downloadable). Client uploads to Supabase when saving.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getElevenLabsApiKey } from "@/lib/elevenlabs-api-key";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export const dynamic = "force-dynamic";

const AUDIO_HEADERS = {
  "Content-Type": "audio/mpeg",
  "Content-Disposition": 'attachment; filename="voiceover.mp3"',
} as const;

/** ElevenLabs max text per request (they return 422 above this). */
const ELEVENLABS_MAX_CHARS = 10000;
/** Chunk slightly under limit to avoid edge cases. */
const CHUNK_MAX_CHARS = 9500;

/**
 * Split text into chunks of at most CHUNK_MAX_CHARS, breaking at paragraph/sentence boundaries when possible.
 */
function chunkText(text: string): string[] {
  if (text.length <= CHUNK_MAX_CHARS) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= CHUNK_MAX_CHARS) {
      chunks.push(remaining);
      break;
    }
    const block = remaining.slice(0, CHUNK_MAX_CHARS);
    const lastBreak = Math.max(
      block.lastIndexOf("\n\n"),
      block.lastIndexOf("\n"),
      block.lastIndexOf(". "),
      block.lastIndexOf("? "),
      block.lastIndexOf("! ")
    );
    const splitAt = lastBreak >= 0 ? lastBreak + 1 : CHUNK_MAX_CHARS;
    const chunk = remaining.slice(0, splitAt).trim();
    if (chunk.length > 0) chunks.push(chunk);
    remaining = remaining.slice(splitAt).trim();
  }
  return chunks.filter(Boolean);
}

/** Call ElevenLabs for one chunk. Returns MP3 array buffer or throws. */
async function generateOneChunkElevenLabs(
  text: string,
  voiceId: string,
  apiKey: string,
  stability: number,
  similarity: number
): Promise<ArrayBuffer> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: { stability, similarity_boost: similarity },
      output_format: "mp3_44100_128",
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    let errDetail = "";
    try {
      const errJson = JSON.parse(errText) as { detail?: { message?: string }; message?: string };
      errDetail = errJson.detail?.message ?? errJson.message ?? errText.slice(0, 200);
    } catch {
      errDetail = errText.slice(0, 200);
    }
    throw new Error(errDetail || `ElevenLabs returned ${res.status}`);
  }
  return res.arrayBuffer();
}

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

/** Concatenate multiple MP3 ArrayBuffers into one. Simple byte concatenation works for most players. */
function concatArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  const total = buffers.reduce((sum, b) => sum + b.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) {
    out.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  }
  return out.buffer;
}

export async function POST(request: NextRequest) {
  try {
    console.log("[generate-voiceover] Scene voiceover request received");
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

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

    const chunks = chunkText(text);
    console.log("[generate-voiceover] Chunks:", chunks.length, "total chars:", text.length);

    if (chunks.length === 1) {
      // Single chunk: use existing flow (including OpenAI fallback on 401/quota)
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: chunks[0],
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability, similarity_boost: similarity },
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
      let errDetail = "";
      try {
        const errJson = JSON.parse(errText) as { detail?: { status?: string; message?: string }; message?: string };
        if (typeof errJson.detail?.message === "string") errDetail = errJson.detail.message;
        else if (typeof errJson.message === "string") errDetail = errJson.message;
        if (!useOpenAIFallback && errJson.detail?.status === "quota_exceeded") useOpenAIFallback = true;
      } catch {
        // ignore
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

      const userMessage =
        res.status === 401
          ? "Invalid ElevenLabs API key. Set ELEVENLABS_API_KEY in .env.local (get key from elevenlabs.io) and restart the dev server."
          : res.status === 404
            ? "Voice not found. Check that the voice ID is valid."
            : res.status === 429
              ? "Rate limit exceeded. Wait a minute or upgrade your ElevenLabs plan."
              : res.status === 422
                ? errDetail || "Invalid request (e.g. text too long or unsupported). Try a shorter script."
                : errDetail
                  ? `ElevenLabs error: ${errDetail.slice(0, 200)}`
                  : `Voiceover failed (${res.status}). Check the server console for details.`;
      return NextResponse.json(
        { error: userMessage },
        { status: res.status === 401 || res.status === 404 ? res.status : 502 }
      );
    }

    // Long script: generate each chunk and concatenate
    const buffers: ArrayBuffer[] = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log("[generate-voiceover] Chunk", i + 1, "/", chunks.length);
      try {
        const buf = await generateOneChunkElevenLabs(chunks[i], voiceId, apiKey, stability, similarity);
        buffers.push(buf);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Chunk failed";
        console.error("[generate-voiceover] Chunk", i + 1, "failed:", msg);
        return NextResponse.json(
          { error: `Part ${i + 1} of ${chunks.length} failed: ${msg}` },
          { status: 502 }
        );
      }
    }
    const combined = concatArrayBuffers(buffers);
    return new NextResponse(combined, { status: 200, headers: AUDIO_HEADERS });
  } catch (e) {
    console.error("[generate-voiceover]", e);
    const message =
      e instanceof Error ? e.message : "Voiceover generation failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
