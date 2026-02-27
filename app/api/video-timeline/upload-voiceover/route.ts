/**
 * POST: Upload voiceover audio for a timeline (e.g. after generating from guide).
 * FormData: file (required, audio), libraryScriptId (required), sceneIndex (optional, number).
 * If sceneIndex is provided, uploads as voiceover-scene-{n}.mp3; otherwise voiceover.mp3.
 * Returns: { url: string }.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const BUCKET = "timeline-media";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData().catch(() => null);
    if (!formData) return NextResponse.json({ error: "FormData required" }, { status: 400 });

    const file = formData.get("file") as File | null;
    const libraryScriptId = formData.get("libraryScriptId") as string | null;
    const sceneIndexRaw = formData.get("sceneIndex");
    const sceneIndex = sceneIndexRaw != null && sceneIndexRaw !== "" ? Number(sceneIndexRaw) : undefined;
    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    if (!libraryScriptId || typeof libraryScriptId !== "string") {
      return NextResponse.json({ error: "libraryScriptId required" }, { status: 400 });
    }

    const type = (file.type || "").toLowerCase();
    if (!type.startsWith("audio/")) {
      return NextResponse.json({ error: "File must be audio" }, { status: 400 });
    }
    const ext = type.includes("mpeg") || type.includes("mp3") ? "mp3" : type.includes("wav") ? "wav" : "mp3";
    const buffer = Buffer.from(await file.arrayBuffer());

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
    }

    const fileName = typeof sceneIndex === "number" && Number.isInteger(sceneIndex) && sceneIndex >= 0
      ? `voiceover-scene-${sceneIndex + 1}.${ext}`
      : `voiceover.${ext}`;
    const path = `${userId}/${libraryScriptId}/${fileName}`;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type || "audio/mpeg",
        upsert: true,
      });

    if (error) {
      const msg = String(error.message || error).toLowerCase();
      if (msg.includes("bucket") || msg.includes("not found")) {
        await supabase.storage.createBucket(BUCKET, { public: true });
        const retry = await supabase.storage.from(BUCKET).upload(path, buffer, {
          contentType: file.type || "audio/mpeg",
          upsert: true,
        });
        if (retry.error) {
          console.error("Voiceover upload retry error:", retry.error);
          return NextResponse.json({ error: "Upload failed" }, { status: 500 });
        }
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(retry.data.path);
        return NextResponse.json({ url: urlData.publicUrl });
      }
      console.error("Voiceover upload error:", error);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error("Upload voiceover error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
