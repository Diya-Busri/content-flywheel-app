import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { listAvatars, listVoices } from "@/lib/tiktok-shop/heygen-video";

/**
 * GET: List HeyGen avatars and voices (for avatar picker UI).
 * Returns { avatars: [...], voices: [...] } when HEYGEN_API_KEY is set.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!process.env.HEYGEN_API_KEY?.trim()) {
      return NextResponse.json(
        { avatars: [], voices: [], available: false },
        { status: 200 }
      );
    }

    const [avatars, voices] = await Promise.all([listAvatars(), listVoices()]);

    return NextResponse.json({
      avatars: avatars.map((a) => ({
        id: a.avatar_id ?? (a as Record<string, unknown>).avatarId,
        name: a.avatar_name ?? (a as Record<string, unknown>).avatarName,
        gender: a.gender,
        previewImageUrl: a.preview_image_url ?? (a as Record<string, unknown>).previewImageUrl,
        previewVideoUrl: (a as Record<string, unknown>).preview_video_url ?? (a as Record<string, unknown>).previewVideoUrl,
        premium: a.premium,
      })),
      voices: voices.map((v) => ({
        id: v.voice_id ?? (v as Record<string, unknown>).voiceId,
        name: v.name,
        language: v.language,
        gender: v.gender,
      })),
      available: true,
    });
  } catch (err) {
    console.error("[avatars] Error:", err);
    return NextResponse.json(
      { avatars: [], voices: [], available: false, error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 200 }
    );
  }
}
