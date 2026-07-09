import { NextRequest, NextResponse } from "next/server";
import { checkApiRateLimit, getClientIp } from "@/lib/rate-limit-api";

export const dynamic = "force-dynamic";

/**
 * POST: Verify Campaign Mode access password.
 * Body: { password: string }
 * Returns { ok: true } if CAMPAIGN_MODE_PASSWORD matches; 401 otherwise.
 */
export async function POST(request: NextRequest) {
  const rl = await checkApiRateLimit(getClientIp(request));
  if (rl) return rl;
  try {
    const body = await request.json().catch(() => ({}));
    const password = typeof body.password === "string" ? body.password : "";
    const expected =
      process.env.CAMPAIGN_MODE_PASSWORD?.trim() ||
      process.env.GATED_FEATURES_PASSWORD?.trim() ||
      "";
    if (!expected) {
      return NextResponse.json(
        { error: "Campaign Mode is not configured." },
        { status: 503 }
      );
    }
    if (password !== expected) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Verification failed." }, { status: 500 });
  }
}
