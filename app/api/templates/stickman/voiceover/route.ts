export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getElevenLabsApiKey } from "@/lib/elevenlabs-api-key";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export const runtime = "nodejs";

const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = (await request.json()) as { text?: string; sceneIndex?: number; voiceId?: string };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const voiceId = typeof body.voiceId === "string" && body.voiceId.trim() ? body.voiceId.trim() : DEFAULT_VOICE_ID;

    if (!text) {
      return new Response("text is required", { status: 400 });
    }

    const apiKey = getElevenLabsApiKey();
    if (!apiKey) {
      return new Response("ElevenLabs API key not configured", { status: 500 });
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "unknown error");
      console.error("[stickman/voiceover] ElevenLabs error", response.status, errText);
      return new Response(`ElevenLabs error: ${errText}`, { status: response.status });
    }

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
        "Content-Length": String(audioBuffer.byteLength),
      },
    });
  } catch (err) {
    console.error("[stickman/voiceover]", err);
    return new Response(
      err instanceof Error ? err.message : "Internal server error",
      { status: 500 }
    );
  }
}
