/**
 * POST /api/videos/compile-fast
 *
 * Near-instant video export using pre-rendered scene segments.
 * All segments are H.264/yuv420p (rendered by /api/videos/prerender-scene),
 * so they can be concatenated with -c copy (no re-encoding).
 *
 * Time: ~5-30s for any video length (download-bound, not encode-bound).
 *
 * Body:
 *   segmentUrls        string[]   — ordered array of pre-rendered segment MP4 URLs
 *   voiceoverUrls?     string[]   — per-scene voiceover URLs (will be concatenated)
 *   singleVoiceoverUrl? string    — single voiceover for whole video (alternative)
 *   backgroundMusic?   string     — BGM key ("none"|"dramatic"|"romantic"|"tense"|"upbeat")
 *   outputAspect?      "16:9"|"9:16"
 *   scriptId?          string     — saved script ID (used for storage path)
 *
 * Returns: { url: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkVideoCredits, deductVideoCredit } from "@/actions/video-credits-actions";
import { logEvent } from "@/lib/log-event";
import { db } from "@/db/db";
import { videosTable } from "@/db/schema/library-schema";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  compileFastFromSegments,
  concatVoiceoverUrls,
  cleanupWorkDir,
} from "@/lib/videos/compile";
import { BGM_MIX_VOLUME, BGM_REQUEST_VALUES, type BgmSelectValue } from "@/lib/bgm-tracks";
import { resolveLocalBgmPath } from "@/lib/bgm-tracks.server";
import { mkdir } from "fs/promises";
import { createReadStream, statSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { tmpdir } from "os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BUCKET = "timeline-media";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const { hasCredits, balance } = await checkVideoCredits("brandStoryVideo");
    if (!hasCredits) {
      return NextResponse.json(
        { error: "You need video credits to export a video.", code: "NO_VIDEO_CREDITS", balance, redirectTo: "/dashboard/video-credits" },
        { status: 402 }
      );
    }

    const body = await request.json().catch(() => ({})) as {
      segmentUrls?: string[];
      voiceoverUrls?: string[];
      singleVoiceoverUrl?: string;
      backgroundMusic?: string;
      outputAspect?: "16:9" | "9:16";
      scriptId?: string;
      scriptTitle?: string;
      topic?: string;
      niche?: string;
    };

    const {
      segmentUrls = [],
      voiceoverUrls = [],
      singleVoiceoverUrl,
      backgroundMusic: bgmRaw = "none",
      outputAspect,
      scriptId,
      scriptTitle,
      topic,
      niche,
    } = body;

    if (!Array.isArray(segmentUrls) || segmentUrls.length === 0) {
      return NextResponse.json({ error: "segmentUrls array is required" }, { status: 400 });
    }

    const invalidSegments = segmentUrls.filter((u) => typeof u !== "string" || !u.startsWith("http"));
    if (invalidSegments.length > 0) {
      return NextResponse.json({ error: "All segmentUrls must be valid http(s) URLs" }, { status: 400 });
    }

    const bgm = BGM_REQUEST_VALUES.has(bgmRaw as BgmSelectValue) ? bgmRaw as BgmSelectValue : "none";
    const usePerSceneVoice = Array.isArray(voiceoverUrls) && voiceoverUrls.length > 0;
    const hasSingle = typeof singleVoiceoverUrl === "string" && singleVoiceoverUrl.startsWith("http");

    if (!usePerSceneVoice && !hasSingle) {
      return NextResponse.json(
        { error: "Provide voiceoverUrls (per-scene) or singleVoiceoverUrl" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
    }

    const workDir = join(tmpdir(), `compile-fast-${randomUUID().slice(0, 8)}`);
    await mkdir(workDir, { recursive: true });

    try {
      // Concatenate per-scene voiceovers if provided
      let voiceoverInput = singleVoiceoverUrl ?? "";
      let existingVoicePath: string | undefined;

      if (usePerSceneVoice) {
        const validUrls = voiceoverUrls.filter((u) => typeof u === "string" && u.startsWith("http"));
        if (validUrls.length === 0) {
          return NextResponse.json({ error: "No valid voiceover URLs provided" }, { status: 400 });
        }
        const concatenated = await concatVoiceoverUrls(workDir, validUrls);
        existingVoicePath = concatenated.path;
        voiceoverInput = "";
      }

      const bgmPath = resolveLocalBgmPath(bgm);

      const finalPath = await compileFastFromSegments(
        workDir,
        segmentUrls,
        voiceoverInput,
        existingVoicePath,
        {
          bgmPath,
          bgmVolume: BGM_MIX_VOLUME,
          outputAspect,
        }
      );

      const storageKey = scriptId?.trim() ? scriptId.trim() : `fast-compile/${randomUUID()}`;
      const fileName = `compiled-fast-${Date.now()}.mp4`;
      const storagePath = `${userId}/${storageKey}/${fileName}`;

      // Stream directly to Supabase REST API — avoids loading the whole video
      // into memory (compiled 27-min videos can be 200MB–1GB+).
      const fileSizeBytes = statSync(finalPath).size;
      const fileStream = createReadStream(finalPath);

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
      const publicUrl = urlData.publicUrl;

      // Save to library
      try {
        const dateLabel = new Date().toLocaleDateString("en-GB", {
          day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        });
        // Use script title if provided so YouTube SEO has proper context
        const videoTitle = scriptTitle?.trim()
          ? scriptTitle.trim()
          : `Compiled Video — ${dateLabel}`;
        await db.insert(videosTable).values({
          userId,
          title: videoTitle,
          platforms: ["video-guide"],
          status: "draft",
          metadata: {
            download_url: publicUrl,
            compiled_video_url: publicUrl,
            fastCompile: true,
            topic: topic ?? null,
            niche: niche ?? null,
          },
        });
      } catch { /* non-fatal */ }

      await deductVideoCredit("brandStoryVideo").catch(() => {});
      void logEvent(userId, "video_compiled_fast", { url: publicUrl, segments: segmentUrls.length });

      return NextResponse.json({ url: publicUrl, fastCompile: true, segments: segmentUrls.length });
    } finally {
      await cleanupWorkDir(workDir);
    }
  } catch (err) {
    console.error("[videos/compile-fast]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fast compile failed" },
      { status: 500 }
    );
  }
}
