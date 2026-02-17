import { NextResponse } from "next/server";
import { getShotstackApiKey } from "@/lib/shotstack-edit";

/**
 * GET: Returns whether TikTok Shop video generation is configured (Shotstack).
 */
export async function GET() {
  const configured = !!getShotstackApiKey();
  return NextResponse.json({
    mode: configured ? "shotstack" : "unconfigured",
    label: configured ? "Shotstack (text + product image)" : "Not configured",
  });
}
