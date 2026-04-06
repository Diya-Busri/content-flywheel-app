/**
 * POST /api/story-video/export
 *
 * Body: { imageUrls: string[], audioUrls: string[], outputAspect?: "9:16" | "16:9" }
 * - Same length arrays; public http(s) URLs only (no data: or blob:).
 * - Per-scene audio is concatenated; each still is shown for that clip’s duration (ffprobe on each scene file).
 * - Ken Burns: slow linear zoom 1.0 → 1.05 over each scene (see CompileScene.kenBurnsZoomMax).
 * - Reuses lib/videos/compile.ts (FFmpeg path, concat, mux) + Supabase upload like /api/videos/compile.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  compileVideoToFile,
  concatVoiceoverUrls,
  cleanupWorkDir,
  type CompileScene,
} from "@/lib/videos/compile";
import { mkdir, readFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { tmpdir } from "os";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BUCKET = "timeline-media";
const MAX_SCENES = 50;
const STORY_KEN_BURNS_ZOOM_MAX = 1.05;

function isHttpUrl(s: string): boolean {
  const t = s.trim();
  return t.startsWith("http://") || t.startsWith("https://");
}

function storageErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls : [];
    const audioUrls = Array.isArray(body.audioUrls) ? body.audioUrls : [];

    const outputAspectRaw =
      typeof body.outputAspect === "string" ? body.outputAspect.trim().toLowerCase() : "";
    const outputAspect: "16:9" | "9:16" =
      outputAspectRaw === "16:9" || outputAspectRaw === "landscape" ? "16:9" : "9:16";

    if (imageUrls.length === 0 || audioUrls.length === 0) {
      return NextResponse.json(
        { error: "imageUrls and audioUrls must be non-empty arrays of the same length." },
        { status: 400 }
      );
    }
    if (imageUrls.length !== audioUrls.length) {
      return NextResponse.json(
        { error: "imageUrls and audioUrls must have the same length." },
        { status: 400 }
      );
    }
    if (imageUrls.length > MAX_SCENES) {
      return NextResponse.json({ error: `At most ${MAX_SCENES} scenes.` }, { status: 400 });
    }

    const images = imageUrls.map((u: unknown) => (typeof u === "string" ? u.trim() : ""));
    const audios = audioUrls.map((u: unknown) => (typeof u === "string" ? u.trim() : ""));
    for (let i = 0; i < images.length; i++) {
      if (!images[i] || !isHttpUrl(images[i])) {
        return NextResponse.json(
          { error: `imageUrls[${i}] must be a non-empty http(s) URL.` },
          { status: 400 }
        );
      }
      if (!audios[i] || !isHttpUrl(audios[i])) {
        return NextResponse.json(
          { error: `audioUrls[${i}] must be a non-empty http(s) URL.` },
          { status: 400 }
        );
      }
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: "Storage not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
        { status: 503 }
      );
    }

    const workDir = join(tmpdir(), `story-video-export-${randomUUID().slice(0, 8)}-${randomUUID().slice(0, 8)}`);
    await mkdir(workDir, { recursive: true });

    try {
      const concatenated = await concatVoiceoverUrls(workDir, audios);
      const existingVoicePath = concatenated.path;

      const scenes: CompileScene[] = images.map((image_url: string, i: number) => {
        const measured = concatenated.sceneDurationsSec[i] ?? 0;
        const duration = measured > 0 ? measured : 5;
        return {
          duration,
          image_url,
          video_url: null,
          dialogue: null,
          kenBurnsZoomMax: STORY_KEN_BURNS_ZOOM_MAX,
        };
      });

      const finalPath = await compileVideoToFile(workDir, scenes, "", existingVoicePath, undefined, {
        outputAspect,
      });
      const buffer = await readFile(finalPath);
      const fileName = `story-video-${Date.now()}.mp4`;
      const storagePath = `${userId}/story-video/${randomUUID()}/${fileName}`;

      const { data, error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
        contentType: "video/mp4",
        upsert: true,
      });

      if (error) {
        console.error("[story-video/export] Upload error:", error);
        return NextResponse.json(
          { error: `Upload failed: ${storageErrorMessage(error)}` },
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
    console.error("[story-video/export] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
