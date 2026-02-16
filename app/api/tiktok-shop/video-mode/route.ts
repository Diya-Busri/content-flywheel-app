import { NextResponse } from "next/server";

/**
 * GET: Returns whether TikTok Shop uses AI avatar (HeyGen) or product-only (Creatomate) video.
 * Does not expose API keys.
 */
export async function GET() {
  const useAvatar = Boolean(process.env.HEYGEN_API_KEY?.trim());
  return NextResponse.json({
    mode: useAvatar ? "avatar" : "product",
    label: useAvatar ? "AI Avatar (HeyGen)" : "Product + text",
  });
}
