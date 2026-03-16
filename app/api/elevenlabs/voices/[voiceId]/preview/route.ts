/**
 * GET /api/elevenlabs/voices/[voiceId]/preview
 * Returns a ~5 second TTS preview for the voice. Used by the voice picker "Click to hear" sample.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getElevenLabsApiKey } from "@/lib/elevenlabs-api-key";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export const dynamic = "force-dynamic";

const PREVIEW_TEXT = "This is a short sample of this voice. Use it for your narration or voice-over.";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ voiceId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const apiKey = getElevenLabsApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: "ELEVENLABS_API_KEY is not configured" }, { status: 503 });
    }

    const { voiceId } = await context.params;
    if (!voiceId?.trim()) {
      return NextResponse.json({ error: "voiceId required" }, { status: 400 });
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId.trim())}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: PREVIEW_TEXT,
          model_id: "eleven_monolingual_v1",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          output_format: "mp3_44100_128",
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("[elevenlabs/voices/preview] TTS error:", res.status, errText.slice(0, 200));
      return NextResponse.json(
        { error: res.status === 404 ? "Voice not found" : "Preview failed" },
        { status: res.status === 404 ? 404 : 502 }
      );
    }

    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": "inline; filename=\"voice-preview.mp3\"",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    console.error("[elevenlabs/voices/preview]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Preview failed" },
      { status: 500 }
    );
  }
}
