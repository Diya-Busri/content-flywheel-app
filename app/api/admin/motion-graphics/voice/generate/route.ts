/**
 * POST /api/admin/motion-graphics/voice/generate
 * Body: { text: string, voiceId?: string }
 *
 * Generates a single voiceover clip via ElevenLabs, uploads it to R2, and
 * returns the public URL. Used by the Scene Editor's per-scene "Generate
 * voice" button (as opposed to the automatic generation that happens for
 * every scene during AI Script to Video — see
 * lib/motion-graphics/ai-script-to-scenes.ts's attachVoiceovers()).
 *
 * Admin-only (see lib/motion-graphics/guard.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/motion-graphics/guard";
import { generateSpeech } from "@/lib/motion-graphics/voice-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: { text?: string; voiceId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  try {
    const result = await generateSpeech(text, body.voiceId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/motion-graphics/voice/generate] failed:", err);
    const message = err instanceof Error ? err.message : "Voice generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
