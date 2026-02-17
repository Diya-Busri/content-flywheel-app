import { NextResponse } from "next/server";

export async function GET() {
  const hasSandbox = !!(
    process.env.SHOTSTACK_API_KEY_SANDBOX?.trim() ||
    process.env.SHOTSTACK_SANDBOX_API_KEY?.trim()
  );
  const hasProduction = !!(process.env.SHOTSTACK_API_KEY?.trim());
  const configured = hasSandbox || hasProduction;

  return NextResponse.json({
    configured,
    hasApiKey: configured,
    hasSandbox,
    hasProduction,
  });
}
