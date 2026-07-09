import { NextResponse } from "next/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

/**
 * GET: Video rendering removed in favor of Video Creation Guides.
 * Always returns unconfigured so the UI never shows the old render flow.
 */
export async function GET() {
  return NextResponse.json({
    mode: "unconfigured",
    label: "Use Video Creation Guide (Step 4)",
  });
}
