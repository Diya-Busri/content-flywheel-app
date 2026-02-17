import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getShotstackApiKey, renderShotstack } from "@/lib/shotstack-edit";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1557683316-973673baf926?w=1080&h=1920&fit=crop";

export const maxDuration = 120;

/**
 * POST: Generate a short Shotstack preview video with hook + product image.
 * Replaces HeyGen avatar preview. Body: fullScript, productImageUrl?
 * Uses first ~20 words as hook for a quick preview.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiKey = getShotstackApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "SHOTSTACK_API_KEY_SANDBOX is not set. Add it to .env." },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { fullScript, productImageUrl } = body as {
      fullScript?: string;
      productImageUrl?: string;
    };

    if (!fullScript || typeof fullScript !== "string" || !fullScript.trim()) {
      return NextResponse.json(
        { error: "fullScript is required. Generate a script first." },
        { status: 400 }
      );
    }

    const words = fullScript.trim().split(/\s+/);
    const hook = words.slice(0, 20).join(" ") || "Preview";
    const imageUrl = typeof productImageUrl === "string" && productImageUrl.trim()
      ? productImageUrl.trim()
      : FALLBACK_IMAGE;

    const shotstackScript = { hook, body: "Preview of your video...", cta: "Link in bio" };
    const videoUrl = await renderShotstack(shotstackScript, imageUrl, apiKey);

    return NextResponse.json({ videoUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Preview generation failed";
    console.error("[avatar-preview] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
