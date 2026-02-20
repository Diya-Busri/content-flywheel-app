/**
 * GET /api/elevenlabs/voices
 * Fetches available voices from ElevenLabs /v1/voices using ELEVENLABS_API_KEY.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getElevenLabsApiKey } from "@/lib/elevenlabs-api-key";

export type ElevenLabsVoiceItem = { voice_id: string; name: string };

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiKey = getElevenLabsApiKey();
    console.log("[elevenlabs/voices] ELEVENLABS_API_KEY present:", !!apiKey, "length:", apiKey?.length ?? 0, "first 10 chars:", apiKey ? `${apiKey.slice(0, 10)}...` : "n/a");

    if (!apiKey) {
      console.error("[elevenlabs/voices] Missing ELEVENLABS_API_KEY. Set it in Vercel Project Settings > Environment Variables (or .env.local for local).");
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY is not configured. Add it in project environment variables (e.g. Vercel)." },
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

    const bodyText = await res.text();
    console.log("[elevenlabs/voices] ElevenLabs response status:", res.status, "body length:", bodyText.length);

    if (!res.ok) {
      console.error("[elevenlabs/voices] ElevenLabs API error:", res.status, "body:", bodyText.slice(0, 500));
      const message =
        res.status === 401
          ? "Invalid API key. Check the key at elevenlabs.io and in Vercel env vars. If you just updated it, redeploy the site so the new key is used."
          : res.status === 403
            ? "Access denied"
            : "Failed to load voices";
      return NextResponse.json(
        { error: message },
        { status: res.status === 401 || res.status === 403 ? res.status : 502 }
      );
    }

    let data: { voices?: Array<{ voice_id?: string; id?: string; name?: string }> };
    try {
      data = JSON.parse(bodyText) as typeof data;
    } catch (parseErr) {
      console.error("[elevenlabs/voices] Failed to parse response JSON:", parseErr);
      return NextResponse.json({ error: "Invalid response from voice service" }, { status: 502 });
    }

    const raw = Array.isArray(data.voices) ? data.voices : [];
    if (raw.length > 0) {
      const first = raw[0] as Record<string, unknown>;
      console.log("[elevenlabs/voices] First voice keys:", Object.keys(first ?? {}));
    } else {
      console.warn("[elevenlabs/voices] No voices in response. Top-level keys:", Object.keys(data));
    }

    const voices: ElevenLabsVoiceItem[] = raw
      .filter((v) => v && (v.voice_id ?? (v as { id?: string }).id) && v.name)
      .map((v) => ({
        voice_id: String((v as { voice_id?: string }).voice_id ?? (v as { id?: string }).id),
        name: String(v.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    console.log("[elevenlabs/voices] Returning voices count:", voices.length);
    return NextResponse.json({ voices });
  } catch (e) {
    console.error("[elevenlabs/voices] Unexpected error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load voices" },
      { status: 500 }
    );
  }
}
