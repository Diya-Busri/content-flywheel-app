import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateAvatarVideo } from "@/lib/tiktok-shop/heygen-video";

/** Allow up to 5 min for HeyGen (typical: 1–3 min; free tier can queue). */
export const maxDuration = 300;

/**
 * POST: Generate a short (~3 sec) HeyGen preview video with the selected avatar.
 * Body: fullScript, avatarId, voiceId?, avatarStyle?
 * Uses first 2 lines, truncated to ~6 words for faster HeyGen render.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!process.env.HEYGEN_API_KEY?.trim()) {
      return NextResponse.json(
        { error: "HEYGEN_API_KEY is not set. Avatar preview requires HeyGen." },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { fullScript, avatarId, voiceId, avatarStyle, backgroundPreset, voiceEmotion } = body as {
      fullScript?: string;
      avatarId?: string;
      voiceId?: string;
      avatarStyle?: "normal" | "circle" | "closeUp";
      backgroundPreset?: "studio" | "office" | "bedroom" | "gradient" | "warm";
      voiceEmotion?: "Friendly" | "Excited" | "Soothing" | "Serious" | "Broadcaster";
    };

    if (!fullScript || typeof fullScript !== "string" || !fullScript.trim()) {
      return NextResponse.json(
        { error: "fullScript is required. Generate a script first." },
        { status: 400 }
      );
    }

    if (!avatarId || typeof avatarId !== "string") {
      return NextResponse.json(
        { error: "avatarId is required. Select an avatar first." },
        { status: 400 }
      );
    }

    // First 2 lines, truncated to ~6 words for faster HeyGen render (~3 sec clip)
    const lines = fullScript.trim().split(/\n+/).filter(Boolean);
    let previewScript = lines.slice(0, 2).join(" ").trim();
    if (!previewScript) previewScript = fullScript.trim();
    const words = previewScript.split(/\s+/);
    if (words.length > 6) {
      previewScript = words.slice(0, 6).join(" ") + ".";
    }

    if (!previewScript || previewScript.length < 5) {
      return NextResponse.json(
        { error: "Script too short for preview." },
        { status: 400 }
      );
    }

    const videoUrl = await generateAvatarVideo({
      script: previewScript,
      avatarId,
      voiceId: voiceId || undefined,
      avatarStyle: avatarStyle ?? "normal",
      dimension: { width: 720, height: 1280 },
      caption: false,
      backgroundPreset: backgroundPreset ?? "office",
      voiceEmotion: voiceEmotion && ["Friendly", "Excited", "Soothing", "Serious", "Broadcaster"].includes(voiceEmotion) ? voiceEmotion : "Friendly",
      useAvatarIV: true,
    });

    return NextResponse.json({ videoUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Preview generation failed";
    console.error("[avatar-preview] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
