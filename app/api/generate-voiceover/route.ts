/**
 * POST /api/generate-voiceover
 * ElevenLabs text-to-speech using ELEVENLABS_API_KEY from environment.
 * Body: { text, voiceId, stability?, similarity? }
 * Returns: MP3 audio file (downloadable).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY is not configured. Add it to .env.local." },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const voiceId = typeof body.voiceId === "string" ? body.voiceId.trim() : "";
    const stability = typeof body.stability === "number" ? Math.max(0, Math.min(1, body.stability)) : 0.5;
    const similarity = typeof body.similarity === "number" ? Math.max(0, Math.min(1, body.similarity)) : 0.75;

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

    if (!res.ok) {
      const errText = await res.text();
      console.error("[generate-voiceover] ElevenLabs error:", res.status, errText);
      return NextResponse.json(
        { error: res.status === 401 ? "Invalid API key" : res.status === 404 ? "Voice not found" : "Voiceover generation failed" },
        { status: res.status === 401 || res.status === 404 ? res.status : 502 }
      );
    }

    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": 'attachment; filename="voiceover.mp3"',
      },
    });
  } catch (e) {
    console.error("[generate-voiceover]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Voiceover generation failed" },
      { status: 500 }
    );
  }
}
