/**
 * POST: Concatenate per-scene voiceover URLs into a single MP3 and upload to storage.
 * Body: { urls: string[] } — array of http(s) URLs to scene voiceover MP3s.
 * Returns: { url: string } (public URL of the combined voiceover).
 * Used when the Video Guide has scene voiceovers but no single timeline voiceover, so the timeline can play one audio.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { concatVoiceoverUrls, cleanupWorkDir } from "@/lib/videos/compile";
import { mkdir, readFile, rm } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { tmpdir } from "os";

const BUCKET = "timeline-media";

function storageErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const urls = Array.isArray((body as { urls?: unknown }).urls)
      ? ((body as { urls: unknown[] }).urls as string[]).filter(
          (u) => typeof u === "string" && u.trim().startsWith("http")
        )
      : [];
    if (urls.length === 0) {
      return NextResponse.json({ error: "urls array with at least one http(s) URL required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: "Storage not configured. Set Supabase env vars." },
        { status: 503 }
      );
    }

    const workDir = join(tmpdir(), `voiceover-concat-${randomUUID()}`);
    await mkdir(workDir, { recursive: true });

    try {
      const outPath = await concatVoiceoverUrls(workDir, urls);
      const buffer = await readFile((outPath as any).path ?? outPath);

      const path = `${userId}/voiceover-concat/${randomUUID()}.mp3`;
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(path, buffer, {
          contentType: "audio/mpeg",
          upsert: false,
        });

      if (error) {
        return NextResponse.json(
          { error: storageErrorMessage(error) },
          { status: 500 }
        );
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
      return NextResponse.json({ url: urlData.publicUrl });
    } finally {
      await cleanupWorkDir(workDir);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
