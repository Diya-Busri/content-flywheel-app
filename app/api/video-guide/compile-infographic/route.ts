/**
 * POST /api/video-guide/compile-infographic
 *
 * Compiles Dark Infographic slides (captured as base64 PNGs by html2canvas) into
 * a single 9:16 MP4 using the shared FFmpeg pipeline.
 *
 * Input:
 *   slideImages    – base64 data URIs ("data:image/png;base64,…") one per scene
 *   voiceoverUrls  – http(s) TTS URL per scene (empty string = silent for that scene)
 *   sceneDurations – seconds for each scene (fallback: 4 s)
 *   productName    – used for library title
 *   libraryScriptId – optional; if provided, patches the saved script's compiled URL
 *
 * Returns: { videoUrl: string } | { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkVideoCredits, deductVideoCredit } from "@/actions/video-credits-actions";
import { logEvent } from "@/lib/log-event";
import { db } from "@/db/db";
import { videosTable } from "@/db/schema/library-schema";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { compileVideoToFile, concatVoiceoverUrls, cleanupWorkDir, type CompileScene } from "@/lib/videos/compile";
import { mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { tmpdir } from "os";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BUCKET = "timeline-media";

function isHttpUrl(s: string): boolean {
  const t = s.trim();
  return t.startsWith("http://") || t.startsWith("https://");
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const { hasCredits, balance } = await checkVideoCredits("brandStoryVideo");
    if (!hasCredits) {
      return NextResponse.json(
        { error: "You need video credits to compile a video.", code: "NO_VIDEO_CREDITS", balance, redirectTo: "/dashboard/video-credits" },
        { status: 402 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      slideImages?: unknown;
      voiceoverUrls?: unknown;
      sceneDurations?: unknown;
      productName?: unknown;
      libraryScriptId?: unknown;
    };

    const slideImages = Array.isArray(body.slideImages) ? (body.slideImages as string[]) : [];
    const voiceoverUrls = Array.isArray(body.voiceoverUrls) ? (body.voiceoverUrls as string[]) : [];
    const sceneDurations = Array.isArray(body.sceneDurations) ? (body.sceneDurations as number[]) : [];
    const productName = typeof body.productName === "string" ? body.productName.trim() : "Infographic Video";

    if (slideImages.length === 0) {
      return NextResponse.json({ error: "No slide images provided." }, { status: 400 });
    }
    if (slideImages.some((img) => typeof img !== "string" || !img.startsWith("data:"))) {
      return NextResponse.json({ error: "slideImages must be base64 data URIs." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: "Storage not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
        { status: 503 }
      );
    }

    const workDir = join(tmpdir(), `infographic-compile-${randomUUID().slice(0, 12)}`);
    await mkdir(workDir, { recursive: true });

    try {
      // ── 1. Decode base64 PNGs → temp files ────────────────────────────────
      const localImagePaths: string[] = [];
      for (let i = 0; i < slideImages.length; i++) {
        const dataUri = slideImages[i];
        // Strip "data:image/png;base64," prefix
        const commaIdx = dataUri.indexOf(",");
        const b64 = commaIdx !== -1 ? dataUri.slice(commaIdx + 1) : dataUri;
        const buffer = Buffer.from(b64, "base64");
        const imgPath = join(workDir, `slide_${i}.png`);
        await writeFile(imgPath, buffer);
        localImagePaths.push(imgPath);
      }

      // ── 2. Build CompileScene array ────────────────────────────────────────
      const scenes: CompileScene[] = slideImages.map((_, i) => {
        const rawDuration = typeof sceneDurations[i] === "number" ? sceneDurations[i] : 4;
        const duration = Math.max(2, rawDuration);
        return {
          duration,
          image_url: null,
          video_url: null,
          localImagePath: localImagePaths[i],
          disableKenBurns: true,
        };
      });

      // ── 3. Concatenate per-scene voiceovers (if any) ───────────────────────
      const httpVoUrls = voiceoverUrls.map((u) => (typeof u === "string" && isHttpUrl(u) ? u.trim() : ""));
      const validVoUrls = httpVoUrls.filter(Boolean);
      let existingVoicePath: string | undefined;

      if (validVoUrls.length > 0) {
        // Pass all URLs in order (empty slots use the http urls we filtered above;
        // concat only operates on the non-empty list so durations align with validVoUrls)
        const concatenated = await concatVoiceoverUrls(workDir, validVoUrls);
        existingVoicePath = concatenated.path;
        // Sync scene durations to real TTS lengths for voiced scenes
        const HOLD_SEC = 0.15;
        let voiceIdx = 0;
        for (let i = 0; i < scenes.length; i++) {
          if (httpVoUrls[i]) {
            const measured = concatenated.sceneDurationsSec[voiceIdx] ?? 0;
            if (measured > 0.2) {
              scenes[i] = {
                ...scenes[i],
                duration: Math.max(1, Number((measured + HOLD_SEC).toFixed(2))),
              };
            }
            voiceIdx++;
          }
        }
      }

      // ── 4. FFmpeg compile ──────────────────────────────────────────────────
      const finalPath = await compileVideoToFile(
        workDir,
        scenes,
        null,            // voiceoverInput (URL) — null since we use existingVoicePath
        existingVoicePath,
        undefined,       // transition
        { outputAspect: "9:16" }
      );

      // ── 5. Upload to Supabase ──────────────────────────────────────────────
      const buffer = await readFile(finalPath);
      const fileName = `infographic-${Date.now()}.mp4`;
      const storagePath = `${userId}/video-guide-infographic/${randomUUID()}/${fileName}`;

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, { contentType: "video/mp4", upsert: true });

      if (error) {
        console.error("[compile-infographic] Upload error:", error);
        return NextResponse.json(
          { error: `Upload failed: ${error.message ?? String(error)}` },
          { status: 500 }
        );
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
      const videoUrl = urlData.publicUrl;

      // ── 6. Save to My Library (non-fatal) ─────────────────────────────────
      try {
        const dateLabel = new Date().toLocaleDateString("en-GB", {
          day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        });
        await db.insert(videosTable).values({
          userId,
          title: `${productName || "Dark Infographic"} — ${dateLabel}`,
          platforms: ["video-guide"],
          status: "draft",
          metadata: { download_url: videoUrl, compiled_video_url: videoUrl, style: "dark_infographic" },
        });
      } catch (libErr) {
        console.warn("[compile-infographic] Could not save to library:", libErr);
      }

      await deductVideoCredit("brandStoryVideo").catch((e) =>
        console.error("[compile-infographic] credit deduction failed:", e)
      );
      void logEvent(userId, "infographic_video_compiled", { url: videoUrl });

      return NextResponse.json({ videoUrl });
    } finally {
      await cleanupWorkDir(workDir);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[compile-infographic] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
