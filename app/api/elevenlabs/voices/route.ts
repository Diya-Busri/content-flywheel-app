/**
 * GET /api/elevenlabs/voices
 * Fetches available voices from ElevenLabs /v1/voices using ELEVENLABS_API_KEY.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export type ElevenLabsVoiceItem = { voice_id: string; name: string };

export async function GET() {
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

    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[elevenlabs/voices] API error:", res.status, errText);
      return NextResponse.json(
        {
          error:
            res.status === 401
              ? "Invalid API key"
              : res.status === 403
                ? "Access denied"
                : "Failed to load voices",
        },
        { status: res.status === 401 || res.status === 403 ? res.status : 502 }
      );
    }

    const data = (await res.json()) as { voices?: Array<{ voice_id?: string; name?: string }> };
    const raw = Array.isArray(data.voices) ? data.voices : [];
    const voices: ElevenLabsVoiceItem[] = raw
      .filter((v) => v?.voice_id && v?.name)
      .map((v) => ({ voice_id: String(v.voice_id), name: String(v.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ voices });
  } catch (e) {
    console.error("[elevenlabs/voices]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load voices" },
      { status: 500 }
    );
  }
}
