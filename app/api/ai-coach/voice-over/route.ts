/**
 * POST /api/ai-coach/voice-over
 * Generate voice-over from script via ElevenLabs, upload to Supabase, optionally save to My Library.
 * Body: { script: string, voiceId?: string, stability?: number, similarity?: number, saveToLibrary?: boolean, maxDurationSeconds?: number }
 * When maxDurationSeconds is set (e.g. 5), audio longer than that is sped up with FFmpeg atempo before upload.
 * Returns: { url: string, libraryId?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getElevenLabsApiKey } from "@/lib/elevenlabs-api-key";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { db } from "@/db/db";
import { myLibraryTable } from "@/db/schema/library-schema";
import { fitMp3BufferToMaxDuration } from "@/lib/fit-mp3-to-max-duration";

export const dynamic = "force-dynamic";

const BUCKET = "voiceovers";
const DEFAULT_VOICE_ID = "pNInz6obpgDQGcFmaJgB";
const CHUNK_MAX_CHARS = 9500;

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

async function generateOneChunk(
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
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const apiKey = getElevenLabsApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY is not configured. Add it to .env.local or Vercel env vars." },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const script = typeof body.script === "string" ? body.script.trim() : "";
    const voiceId = typeof body.voiceId === "string" && body.voiceId.trim() ? body.voiceId.trim() : DEFAULT_VOICE_ID;
    const stability = typeof body.stability === "number" ? Math.max(0, Math.min(1, body.stability)) : 0.5;
    const similarity = typeof body.similarity === "number" ? Math.max(0, Math.min(1, body.similarity)) : 0.75;
    const saveToLibrary = body.saveToLibrary === true;
    const maxDurationSeconds =
      typeof body.maxDurationSeconds === "number" &&
      Number.isFinite(body.maxDurationSeconds) &&
      body.maxDurationSeconds > 0
        ? body.maxDurationSeconds
        : null;

    if (!script) {
      return NextResponse.json({ error: "script is required" }, { status: 400 });
    }

    const chunks = chunkText(script);
    const buffers: ArrayBuffer[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const buf = await generateOneChunk(chunks[i], voiceId, apiKey, stability, similarity);
      buffers.push(buf);
    }

    const combined = buffers.length === 1 ? buffers[0] : concatArrayBuffers(buffers);
    const buffer = Buffer.from(combined);

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase is not configured. Cannot store voice-over." },
        { status: 503 }
      );
    }

    const timestamp = Date.now();
    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const path = `voice-overs/${safeUserId}/${timestamp}.mp3`;

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: "audio/mpeg", upsert: true });

    if (error) {
      console.error("[ai-coach/voice-over] Supabase upload error:", error);
      return NextResponse.json(
        { error: "Failed to upload voice-over: " + (error.message ?? "unknown") },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    const url = urlData.publicUrl;

    let libraryId: string | undefined;
    if (saveToLibrary) {
      const [row] = await db
        .insert(myLibraryTable)
        .values({
          userId,
          type: "voice_over",
          title: `Voice-over ${new Date(timestamp).toLocaleDateString()}`,
          url,
        })
        .returning({ id: myLibraryTable.id });
      if (row) libraryId = row.id;
    }

    return NextResponse.json({ url, libraryId });
  } catch (e) {
    console.error("[ai-coach/voice-over]", e);
    const message = e instanceof Error ? e.message : "Voice-over generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
