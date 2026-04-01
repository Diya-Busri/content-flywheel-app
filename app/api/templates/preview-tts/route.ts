import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getElevenLabsApiKey } from "@/lib/elevenlabs-api-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Sarah

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({})) as { text?: string; voiceId?: string };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });

    const voiceId = typeof body.voiceId === "string" && body.voiceId.trim() ? body.voiceId.trim() : DEFAULT_VOICE_ID;

    const apiKey = getElevenLabsApiKey();
    if (!apiKey) return NextResponse.json({ error: "ElevenLabs not configured" }, { status: 500 });

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
      }),
    });

    if (!res.ok) {
      const e = await res.text().catch(() => "");
      return NextResponse.json({ error: `TTS failed: ${e}` }, { status: 502 });
    }

    const audio = await res.arrayBuffer();
    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("[preview-tts]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "TTS failed" }, { status: 500 });
  }
}
