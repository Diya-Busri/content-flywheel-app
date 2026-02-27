/**
 * POST: Upload a video or image file for a timeline scene slot.
 * FormData: file (required), libraryScriptId (required), sceneIndex (required, number).
 * Returns: { url: string }. Persists to script content via optional body or client PATCH.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const BUCKET = "timeline-media";
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData().catch(() => null);
    if (!formData) return NextResponse.json({ error: "FormData required" }, { status: 400 });

    const file = formData.get("file") as File | null;
    const libraryScriptId = formData.get("libraryScriptId") as string | null;
    const sceneIndexStr = formData.get("sceneIndex") as string | null;
    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    if (!libraryScriptId || typeof libraryScriptId !== "string") {
      return NextResponse.json({ error: "libraryScriptId required" }, { status: 400 });
    }
    const sceneIndex = sceneIndexStr != null ? parseInt(String(sceneIndexStr), 10) : NaN;
    if (Number.isNaN(sceneIndex) || sceneIndex < 0) {
      return NextResponse.json({ error: "sceneIndex required (non-negative number)" }, { status: 400 });
    }

    const type = (file.type || "").toLowerCase();
    const isVideo = type.startsWith("video/") || VIDEO_TYPES.includes(type);
    const isImage = type.startsWith("image/") || IMAGE_TYPES.includes(type);
    if (!isVideo && !isImage) {
      return NextResponse.json(
        { error: "File must be video (mp4, webm, mov) or image (jpeg, png, webp, gif)" },
        { status: 400 }
      );
    }
    const mediaType = isVideo ? "video" : "image";
    const ext = isVideo
      ? (type.includes("webm") ? "webm" : type.includes("quicktime") ? "mov" : "mp4")
      : type.includes("png")
        ? "png"
        : type.includes("webp")
          ? "webp"
          : type.includes("gif")
            ? "gif"
            : "jpg";
    const buffer = Buffer.from(await file.arrayBuffer());

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
    }

    const path = `${userId}/${libraryScriptId}/scene-${sceneIndex}-${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type || (isVideo ? "video/mp4" : "image/jpeg"),
        upsert: true,
      });

    if (error) {
      const msg = String(error.message || error).toLowerCase();
      if (msg.includes("bucket") || msg.includes("not found")) {
        await supabase.storage.createBucket(BUCKET, { public: true });
        const retry = await supabase.storage.from(BUCKET).upload(path, buffer, {
          contentType: file.type || (isVideo ? "video/mp4" : "image/jpeg"),
          upsert: true,
        });
        if (retry.error) {
          console.error("Timeline media upload retry error:", retry.error);
          return NextResponse.json({ error: "Upload failed" }, { status: 500 });
        }
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(retry.data.path);
        return NextResponse.json({ url: urlData.publicUrl, mediaType });
      }
      console.error("Timeline media upload error:", error);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    return NextResponse.json({ url: urlData.publicUrl, mediaType });
  } catch (err) {
    console.error("Upload scene media error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
