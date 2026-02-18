import { NextResponse } from "next/server";

/** Deprecated: Use Video Creation Guide. Always returns not configured. */
export async function GET() {
  return NextResponse.json({
    configured: false,
    hasApiKey: false,
    hasSandbox: false,
    hasProduction: false,
  });
}
