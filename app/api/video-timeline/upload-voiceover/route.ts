export const dynamic = "force-dynamic";
/**
 * POST: Upload voiceover audio for a timeline (e.g. after generating from guide).
 * Uses Supabase Storage with the service_role key (not anon). Bucket: timeline-media.
 *
 * FormData: file (required, audio), libraryScriptId (required), sceneIndex (optional, number).
 * If sceneIndex is provided, uploads as voiceover-scene-{n}.mp3; otherwise voiceover.mp3.
 * Returns: { url: string }.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.
 * Create a public bucket named "timeline-media" in Supabase Dashboard → Storage if it doesn't exist.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const BUCKET = "timeline-media";

function storageErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

function isBucketMissingError(err: unknown): boolean {
  const msg = storageErrorMessage(err).toLowerCase();
  return /bucket|not found|no such|404|does not exist/.test(msg);
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
      process.env.SUPABASE_URL?.trim() ||
      "";
    console.log("[upload-voiceover] Supabase URL:", supabaseUrl || "(not set)");

    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });


    const rl = await checkApiRateLimit(userId);


    if (rl) return rl;

    const formData = await request.formData().catch(() => null);
    if (!formData) return NextResponse.json({ error: "FormData required" }, { status: 400 });

    const file = formData.get("file") as File | null;
    const libraryScriptId = formData.get("libraryScriptId") as string | null;
    const sceneIndexRaw = formData.get("sceneIndex");
    const sceneIndex = sceneIndexRaw != null && sceneIndexRaw !== "" ? Number(sceneIndexRaw) : undefined;
    console.log("[upload-voiceover] Uploading:", { sceneIndex, libraryScriptId: !!libraryScriptId, fileSize: file?.size });
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
      const hasUrl = !!(
        process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
        process.env.SUPABASE_URL?.trim()
      );
      const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
      const message = !hasUrl
        ? "Supabase URL missing. Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) in .env.local to your project URL (https://xxxx.supabase.co)."
        : !hasServiceKey
          ? "Supabase service role key missing. Set SUPABASE_SERVICE_ROLE_KEY in .env.local (Dashboard → Settings → API → service_role). Do not use the anon key for uploads."
          : "Storage not configured.";
      console.error("[upload-voiceover]", message);
      return NextResponse.json({ error: message }, { status: 503 });
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
      const errMsg = storageErrorMessage(error);
      console.error("[upload-voiceover] Storage error:", { message: errMsg, error });
      if (isBucketMissingError(error)) {
        const { error: createErr } = await supabase.storage.createBucket(BUCKET, { public: true });
        if (createErr) {
          console.error("[upload-voiceover] createBucket failed:", createErr);
          return NextResponse.json(
            { error: `Bucket missing and create failed: ${storageErrorMessage(createErr)}` },
            { status: 500 }
          );
        }
        const retry = await supabase.storage.from(BUCKET).upload(path, buffer, {
          contentType: file.type || "audio/mpeg",
          upsert: true,
        });
        if (retry.error) {
          const retryMsg = storageErrorMessage(retry.error);
          console.error("[upload-voiceover] Retry upload error:", retry.error);
          return NextResponse.json({ error: retryMsg }, { status: 500 });
        }
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(retry.data.path);
        return NextResponse.json({ url: urlData.publicUrl });
      }
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    console.log("[upload-voiceover] Success:", { sceneIndex, path: data.path });
    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[upload-voiceover] Exception:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
