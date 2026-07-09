import { NextRequest, NextResponse } from "next/server";
import { checkApiRateLimit, getClientIp } from "@/lib/rate-limit-api";

export const dynamic = "force-dynamic";

/**
 * POST: Verify feature preview access (Content Calendar, Video Analytics, Template Studio).
 * Body: { password: string }
 * Returns { ok: true } if FEATURE_PREVIEW_PASSWORD matches; 401 otherwise.
 */
export async function POST(request: NextRequest) {
  const rl = await checkApiRateLimit(getClientIp(request));
  if (rl) return rl;
  try {
    const body = await request.json().catch(() => ({}));
    const password = typeof body.password === "string" ? body.password : "";
    const expected =
      process.env.FEATURE_PREVIEW_PASSWORD?.trim() ||
      process.env.GATED_FEATURES_PASSWORD?.trim() ||
      "";
    if (!expected) {
      return NextResponse.json(
        { error: "Feature preview is not configured." },
        { status: 503 }
      );
    }
    if (password !== expected) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Verification failed." }, { status: 500 });
  }
}
