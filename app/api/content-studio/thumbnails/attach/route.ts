import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { videosTable } from "@/db/schema/library-schema";
import { eq, and } from "drizzle-orm";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BUCKET = "timeline-media";
const PREFIX = "thumbnails";

/**
 * POST: Attach a thumbnail image to a library video.
 * Body: { videoId: string, imageUrl: string }
 * Fetches the image, uploads to storage, updates video.thumbnailUrl.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const videoId = typeof body.videoId === "string" ? body.videoId.trim() : "";
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";

    if (!videoId || !imageUrl) {
      return NextResponse.json(
        { error: "videoId and imageUrl are required." },
        { status: 400 }
      );
    }

    const [video] = await db
      .select({ id: videosTable.id })
      .from(videosTable)
      .where(and(eq(videosTable.id, videoId), eq(videosTable.userId, userId)))
      .limit(1);

    if (!video) {
      return NextResponse.json({ error: "Video not found." }, { status: 404 });
    }

    const res = await fetch(imageUrl, {
      headers: { Accept: "image/*" },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch image." },
        { status: 502 }
      );
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/png";
    const ext = contentType.includes("png") ? "png" : "jpg";
    const path = `${PREFIX}/${userId}/${Date.now()}_thumb.${ext}`;

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: "Storage not configured." },
        { status: 503 }
      );
    }

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType, upsert: true });

    if (uploadError) {
      console.error("[thumbnails/attach] Upload error:", uploadError);
      return NextResponse.json(
        { error: uploadError.message ?? "Upload failed" },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path);
    const thumbnailUrl = urlData.publicUrl;

    await db
      .update(videosTable)
      .set({ thumbnailUrl, updatedAt: new Date() })
      .where(and(eq(videosTable.id, videoId), eq(videosTable.userId, userId)));

    return NextResponse.json({ url: thumbnailUrl, videoId });
  } catch (err) {
    console.error("[content-studio/thumbnails/attach]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Attach failed" },
      { status: 500 }
    );
  }
}
