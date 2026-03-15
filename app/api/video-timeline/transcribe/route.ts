/**
 * POST: Transcribe voiceover to timed caption segments (subtitles) using OpenAI Whisper.
 * Body: { voiceoverUrl?: string } (public http(s) URL) OR FormData with "audio" file.
 * Returns: { segments: { text: string; start: number; end: number }[] }
 * Used by Video Timeline to generate subtitles from the voiceover track.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isHttpUrl(s: string): boolean {
  const t = s.trim();
  return t.startsWith("http://") || t.startsWith("https://");
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Transcription is not configured. Set OPENAI_API_KEY." },
        { status: 503 }
      );
    }

    let arrayBuffer: ArrayBuffer;
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("audio");
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: "FormData must include an 'audio' file" }, { status: 400 });
      }
      arrayBuffer = await file.arrayBuffer();
    } else {
      const body = await request.json().catch(() => null);
      const voiceoverUrl = typeof body?.voiceoverUrl === "string" ? body.voiceoverUrl.trim() : "";
      if (!voiceoverUrl || !isHttpUrl(voiceoverUrl)) {
        return NextResponse.json(
          { error: "JSON body must include voiceoverUrl (http or https), or send FormData with 'audio' file" },
          { status: 400 }
        );
      }
      const res = await fetch(voiceoverUrl, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error("Failed to fetch voiceover: " + res.status);
      arrayBuffer = await res.arrayBuffer();
    }

    const sizeMb = arrayBuffer.byteLength / (1024 * 1024);
    if (sizeMb > 25) {
      return NextResponse.json(
        { error: "Audio is too large for transcription (max 25 MB). Use a shorter voiceover." },
        { status: 400 }
      );
    }

    const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
    const formData = new FormData();
    formData.append("file", blob, "audio.mp3");
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    const raw = await whisperRes.text();
    if (!whisperRes.ok) {
      console.error("[transcribe] Whisper error:", whisperRes.status, raw.slice(0, 300));
      return NextResponse.json(
        { error: "Transcription failed: " + (raw.slice(0, 200) || whisperRes.statusText) },
        { status: 502 }
      );
    }

    let data: { segments?: Array<{ start?: number; end?: number; text?: string }>; text?: string };
    try {
      data = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Invalid transcription response" },
        { status: 502 }
      );
    }

    const segments = Array.isArray(data.segments)
      ? data.segments
          .filter(
            (s): s is { start: number; end: number; text: string } =>
              typeof s.start === "number" &&
              typeof s.end === "number" &&
              typeof s.text === "string" &&
              (s.text as string).trim().length > 0
          )
          .map((s) => ({
            text: (s.text as string).trim(),
            start: s.start,
            end: s.end,
          }))
      : [];

    if (segments.length === 0 && typeof data.text === "string" && data.text.trim()) {
      return NextResponse.json({
        segments: [{ text: data.text.trim(), start: 0, end: Math.max(1, data.text.length * 0.05) }],
      });
    }

    return NextResponse.json({ segments });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[transcribe] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
