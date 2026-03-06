import { NextResponse } from "next/server";
import { checkApiRateLimit, getClientIp } from "@/lib/rate-limit-api";

/** Deprecated: Use Video Creation Guide. Always returns not configured. */
export async function GET(request: Request) {
  const rl = await checkApiRateLimit(getClientIp(request));
  if (rl) return rl;
  return NextResponse.json({
    configured: false,
    hasApiKey: false,
    hasSandbox: false,
    hasProduction: false,
  });
}
