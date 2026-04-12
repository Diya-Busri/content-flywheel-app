/**
 * POST /api/videos/prerender-scene
 *
 * Renders a single timeline scene to a self-contained segment MP4 and uploads
 * it to Supabase. Called in the background as each scene's media is added to
 * the Video Timeline so that export time is near-instant (just concat segments).
 *
 * Body:
 *   imageUrl?     string   — source image URL for Ken Burns effect
 *   videoUrl?     string   — source video clip URL (trimmed to duration)
 *   duration      number   — scene duration in seconds (should match voiceover length)
 *   dialogue?     string   — caption text burned into the clip
 *   disableKenBurns? boolean
 *   kenBurnsZoomMax? number
 *   resolution?   "1080p" | "720p" | "480p"  default: "720p"
 *   outputAspect? "16:9" | "9:16"            default: "16:9"
 *   sceneKey?     string   — stable identifier used for storage path deduplication
 *
 * Returns: { segmentUrl: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  renderSceneSegmentOnly,
  cleanupWorkDir,
  type CompileScene,
} from "@/lib/videos/compile";
import { mkdir } from "fs/promises";
import { createReadStream, statSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { tmpdir } from "os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // 2 min per scene is plenty

const BUCKET = "timeline-media";

function compileDimensionsLocal(
  outputAspect: "16:9" | "9:16" | undefined,
  resolution: "1080p" | "720p" | "480p"
): { width: number; height: number } {
  if (resolution === "480p") {
    return outputAspect === "9:16" ? { width: 480, height: 854 } : { width: 854, height: 480 };
  }
  const is720 = resolution === "720p";
  if (outputAspect === "9:16") return is720 ? { width: 720, height: 1280 } : { width: 1080, height: 1920 };
  return is720 ? { width: 1280, height: 720 } : { width: 1920, height: 1080 };
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({})) as {
      imageUrl?: string;
      videoUrl?: string;
      duration?: number;
      dialogue?: string;
      disableKenBurns?: boolean;
      kenBurnsZoomMax?: number | null;
      resolution?: "1080p" | "720p" | "480p";
      outputAspect?: "16:9" | "9:16";
      sceneKey?: string;
    };

    const {
      imageUrl,
      videoUrl,
      duration = 5,
      dialogue,
      disableKenBurns,
      kenBurnsZoomMax,
      resolution = "720p",
      outputAspect,
      sceneKey,
    } = body;

    if (!imageUrl && !videoUrl) {
      return NextResponse.json({ error: "imageUrl or videoUrl is required" }, { status: 400 });
    }
    if (typeof duration !== "number" || duration <= 0) {
      return NextResponse.json({ error: "duration must be a positive number" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
    }

    const workDir = join(tmpdir(), `prerender-${randomUUID().slice(0, 8)}`);
    await mkdir(workDir, { recursive: true });

    try {
      const { width, height } = compileDimensionsLocal(outputAspect, resolution);
      const segPath = join(workDir, "segment.mp4");

      const scene: CompileScene = {
        duration,
        image_url: imageUrl ?? null,
        video_url: videoUrl ?? null,
        dialogue: dialogue ?? null,
        disableKenBurns: Boolean(disableKenBurns),
        kenBurnsZoomMax: typeof kenBurnsZoomMax === "number" ? kenBurnsZoomMax : null,
      };

      await renderSceneSegmentOnly(workDir, scene, segPath, width, height);

      const key = sceneKey?.trim().replace(/[^a-z0-9_-]/gi, "_").slice(0, 64) || randomUUID().slice(0, 8);
      const storagePath = `${userId}/segments/${key}-${Date.now()}.mp4`;

      // Stream upload — avoids OOM for long scenes
      const fileSizeBytes = statSync(segPath).size;
      const fileStream = createReadStream(segPath);

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

      const uploadRes = await fetch(
        `${supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "video/mp4",
            "Content-Length": String(fileSizeBytes),
            "x-upsert": "true",
          },
          // @ts-ignore — Node 18 fetch supports ReadStream with duplex: "half"
          body: fileStream,
          duplex: "half",
        } as RequestInit
      );

      if (!uploadRes.ok) {
        const msg = await uploadRes.text().catch(() => uploadRes.statusText);
        return NextResponse.json({ error: `Upload failed: ${msg}` }, { status: 500 });
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
      return NextResponse.json({ segmentUrl: urlData.publicUrl });
    } finally {
      await cleanupWorkDir(workDir);
    }
  } catch (err) {
    console.error("[videos/prerender-scene]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Pre-render failed" },
      { status: 500 }
    );
  }
}
