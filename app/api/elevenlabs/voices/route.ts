/**
 * GET /api/elevenlabs/voices
 * Fetches available voices from ElevenLabs /v1/voices using ELEVENLABS_API_KEY.
 * Caches response (voices don't change often). Returns id, name, description, preview_url.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getElevenLabsApiKey } from "@/lib/elevenlabs-api-key";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export const dynamic = "force-dynamic";

type VoiceLabels = { accent?: string; age?: string; description?: string; gender?: string; use_case?: string };

export type ElevenLabsVoiceItem = {
  voice_id: string;
  name: string;
  /** Human-readable: e.g. "Professional, Male, Calm" from category + labels */
  description?: string;
  /** App URL to play 5-second preview (requires auth). */
  preview_url?: string;
};

/** Build description from category and labels for display in UI. */
function buildDescription(
  category?: string,
  labels?: VoiceLabels | null
): string {
  const parts: string[] = [];
  if (category) parts.push(category.charAt(0).toUpperCase() + category.slice(1));
  if (labels?.gender) parts.push(labels.gender);
  if (labels?.description) parts.push(labels.description);
  if (labels?.accent) parts.push(labels.accent);
  if (labels?.age) parts.push(labels.age);
  return parts.length ? parts.join(", ") : "";
}

export async function GET(request: Request) {
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
      next: { revalidate: 300 },
    });

    const bodyText = await res.text();
    if (!res.ok) {
      console.error("[elevenlabs/voices] ElevenLabs API error:", res.status, bodyText.slice(0, 500));
      const message =
        res.status === 401
          ? "Invalid API key. Check the key at elevenlabs.io and in Vercel env vars."
          : res.status === 403
            ? "Access denied"
            : "Failed to load voices";
      return NextResponse.json(
        { error: message },
        { status: res.status === 401 || res.status === 403 ? res.status : 502 }
      );
    }

    let data: {
      voices?: Array<{
        voice_id?: string;
        id?: string;
        name?: string;
        category?: string;
        labels?: VoiceLabels;
      }>;
    };
    try {
      data = JSON.parse(bodyText) as typeof data;
    } catch (parseErr) {
      console.error("[elevenlabs/voices] Failed to parse response JSON:", parseErr);
      return NextResponse.json({ error: "Invalid response from voice service" }, { status: 502 });
    }

    const raw = Array.isArray(data.voices) ? data.voices : [];
    const voices: ElevenLabsVoiceItem[] = raw
      .filter((v) => v && (v.voice_id ?? v.id) && v.name)
      .map((v) => {
        const id = String(v.voice_id ?? v.id);
        const description = buildDescription(v.category, v.labels);
        return {
          voice_id: id,
          name: String(v.name),
          description: description || undefined,
          preview_url: `/api/elevenlabs/voices/${encodeURIComponent(id)}/preview`,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ voices });
  } catch (e) {
    console.error("[elevenlabs/voices] Unexpected error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load voices" },
      { status: 500 }
    );
  }
}
