/**
 * GET /api/admin/motion-graphics/voice
 *
 * Returns the ElevenLabs voice list used to populate the Scene Editor's
 * voice picker. Backed by lib/motion-graphics/voice-engine.ts's listVoices(),
 * which tries the live ElevenLabs account and falls back to a static
 * catalogue if no key is configured or the call fails.
 *
 * Admin-only (see lib/motion-graphics/guard.ts).
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/motion-graphics/guard";
import { listVoices } from "@/lib/motion-graphics/voice-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const voices = await listVoices();
    return NextResponse.json({ voices });
  } catch (err) {
    console.error("[api/motion-graphics/voice] failed to list voices:", err);
    return NextResponse.json({ error: "Failed to list voices" }, { status: 500 });
  }
}
