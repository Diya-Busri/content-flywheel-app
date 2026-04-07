/**
 * POST /api/videos/compile (Phase 4 - FFmpeg video export)
 *
 * Input (one of):
 * - { scriptId: string } — loads scenes from saved_scripts (AI Coach timeline).
 * - { guideScenes: [...] } — inline scenes from Video Guide (same shape as scenes_json rows).
 *   Optional { voiceoverUrl: string } for a single global voiceover instead of per-scene URLs.
 *
 * Process:
 * 1. Download all assets (images, videos, voiceover audio) to a temp folder.
 * 2. For each scene:
 *    - If IMAGE: FFmpeg Ken Burns (zoom/pan) for scene duration → segment MP4.
 *    - If VIDEO: FFmpeg trim to scene duration, scale to 1920x1080 → segment MP4.
 * 3. Concatenate segments with the concat filter (no cross-fades; requires lib/videos/compile.ts).
 * 4. Overlay voiceover as audio track (optional royalty-free BGM from /public/bgm, looped, low volume).
 * 5. Export single MP4 (default 1920x1080, or 1080x1920 when body.outputAspect is "9:16", 25fps, H.264 + AAC).
 * 6. Upload to Supabase Storage (timeline-media bucket).
 *
 * Returns: { url: string } (public download URL) or { error: string }.
 * Requires: FFmpeg (@ffmpeg-installer/ffmpeg or ffmpeg-static), Supabase.
 * All scene and voiceover URLs must be http(s) (no blob/data URLs).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkVideoCredits, useVideoCredit } from "@/actions/video-credits-actions";
import { db } from "@/db/db";
import { savedScriptsTable, videosTable } from "@/db/schema/library-schema";
import { goalsTable } from "@/db/schema/goals-schema";
import { eq, and } from "drizzle-orm";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { compileVideoToFile, concatVoiceoverUrls, cleanupWorkDir, type CompileScene } from "@/lib/videos/compile";
import { BGM_MIX_VOLUME, BGM_REQUEST_VALUES, type BgmSelectValue } from "@/lib/bgm-tracks";
import { resolveLocalBgmPath } from "@/lib/bgm-tracks.server";
import { mkdir, readFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { tmpdir } from "os";

const BUCKET = "timeline-media";
const MAX_GUIDE_SCENES = 40;

type SceneRow = {
  duration?: number;
  image_url?: string | null;
  video_url?: string | null;
  voiceover_url?: string | null;
  voiceoverUrl?: string | null;
  script_text?: string;
  caption?: string | null;
};

function storageErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

function sceneVoiceoverHttpUrl(s: SceneRow): string | null {
  const raw =
    (typeof s.voiceover_url === "string" && s.voiceover_url.trim()) ||
    (typeof s.voiceoverUrl === "string" && s.voiceoverUrl.trim()) ||
    "";
  const u = raw.trim();
  return u.startsWith("http://") || u.startsWith("https://") ? u : null;
}

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min for long compilations (Vercel Pro)

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const { hasCredits, balance } = await checkVideoCredits("brandStoryVideo");
    if (!hasCredits) {
      return NextResponse.json(
        { error: "You need video credits to generate a video.", code: "NO_VIDEO_CREDITS", balance, redirectTo: "/dashboard/video-credits" },
        { status: 402 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const scriptId = typeof (body as { scriptId?: string }).scriptId === "string"
      ? (body as { scriptId: string }).scriptId.trim()
      : "";
    const transition = typeof (body as { transition?: string }).transition === "string"
      ? (body as { transition: string }).transition.trim()
      : undefined;
    const bgmRaw =
      typeof (body as { backgroundMusic?: string }).backgroundMusic === "string"
        ? (body as { backgroundMusic: string }).backgroundMusic.trim().toLowerCase()
        : "none";
    if (!BGM_REQUEST_VALUES.has(bgmRaw)) {
      return NextResponse.json(
        { error: "Invalid backgroundMusic. Use: none, dramatic, romantic, tense, upbeat." },
        { status: 400 }
      );
    }
    const backgroundMusic = bgmRaw as BgmSelectValue;

    const outputAspectRaw =
      typeof (body as { outputAspect?: string }).outputAspect === "string"
        ? (body as { outputAspect: string }).outputAspect.trim().toLowerCase()
        : "";
    const outputAspect: "16:9" | "9:16" | undefined =
      outputAspectRaw === "9:16" || outputAspectRaw === "portrait" || outputAspectRaw === "vertical"
        ? "9:16"
        : outputAspectRaw === "16:9" || outputAspectRaw === "landscape"
          ? "16:9"
          : undefined;

    const guideRaw = (body as { guideScenes?: unknown }).guideScenes;
    let sceneRows: SceneRow[];
    /** Supabase path segment after userId/ */
    let storageFolderKey: string;
    let savedScriptVoiceover: string | null = null;

    if (Array.isArray(guideRaw) && guideRaw.length > 0) {
      if (guideRaw.length > MAX_GUIDE_SCENES) {
        return NextResponse.json({ error: `At most ${MAX_GUIDE_SCENES} scenes per export.` }, { status: 400 });
      }
      if (guideRaw.some((x) => !x || typeof x !== "object")) {
        return NextResponse.json({ error: "guideScenes must be an array of scene objects." }, { status: 400 });
      }
      sceneRows = guideRaw as SceneRow[];
      storageFolderKey = `video-guide/${randomUUID()}`;
    } else {
      if (!scriptId) {
        return NextResponse.json(
          { error: "Provide scriptId (saved script) or guideScenes (Video Guide export)." },
          { status: 400 }
        );
      }
      const [row] = await db
        .select()
        .from(savedScriptsTable)
        .where(and(eq(savedScriptsTable.id, scriptId), eq(savedScriptsTable.userId, userId)))
        .limit(1);

      if (!row) return NextResponse.json({ error: "Script not found" }, { status: 404 });

      const scenesJson = Array.isArray(row.scenesJson) ? row.scenesJson : [];
      if (scenesJson.length === 0) {
        return NextResponse.json({ error: "Script has no scenes" }, { status: 400 });
      }
      sceneRows = scenesJson as SceneRow[];
      storageFolderKey = scriptId;
      savedScriptVoiceover = row.voiceoverUrl?.trim() ?? null;
    }

    const bodyVoiceRaw =
      typeof (body as { voiceoverUrl?: string }).voiceoverUrl === "string"
        ? (body as { voiceoverUrl: string }).voiceoverUrl.trim()
        : "";
    const bodySingleVoice =
      bodyVoiceRaw.startsWith("http://") || bodyVoiceRaw.startsWith("https://") ? bodyVoiceRaw : null;

    const perSceneVoiceoverUrls = sceneRows.map(sceneVoiceoverHttpUrl);
    const usePerSceneVoiceover =
      sceneRows.length > 0 && perSceneVoiceoverUrls.every((u): u is string => u != null);
    const singleVoiceoverUrl = !usePerSceneVoiceover ? bodySingleVoice ?? savedScriptVoiceover : null;
    const hasSingleUrl =
      singleVoiceoverUrl &&
      (singleVoiceoverUrl.startsWith("http://") || singleVoiceoverUrl.startsWith("https://"));

    if (!usePerSceneVoiceover && !hasSingleUrl) {
      return NextResponse.json(
        {
          error:
            "Voiceover is missing. Generate per-scene voiceovers in the Video Guide, pass voiceoverUrl for one file for all scenes, or use a saved script with voiceover.",
        },
        { status: 400 }
      );
    }

    const scenes: CompileScene[] = sceneRows.map((s) => {
      const duration = typeof s.duration === "number" && s.duration > 0 ? s.duration : 5;
      const imageUrl = typeof s.image_url === "string" && s.image_url.trim() ? s.image_url.trim() : null;
      const videoUrl = typeof s.video_url === "string" && s.video_url.trim() ? s.video_url.trim() : null;
      const scriptLine = typeof s.script_text === "string" ? s.script_text.trim() : "";
      const capLine = typeof s.caption === "string" ? s.caption.trim() : "";
      const rawLine = scriptLine || capLine;
      const dialogue = rawLine ? rawLine.replace(/\r?\n/g, " ").trim() : null;
      return {
        duration,
        image_url: imageUrl,
        video_url: videoUrl || null,
        dialogue,
      };
    });

    const invalidSceneIndices = scenes.reduce<number[]>((acc, s, i) => (!s.image_url && !s.video_url ? [...acc, i + 1] : acc), []);
    if (invalidSceneIndices.length > 0) {
      return NextResponse.json(
        {
          error: `Scene${invalidSceneIndices.length > 1 ? "s" : ""} ${invalidSceneIndices.join(", ")} ${invalidSceneIndices.length > 1 ? "have" : "has"} no image or video — add a photo or clip to every scene before exporting.`,
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: "Storage not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
        { status: 503 }
      );
    }

    const workDir = join(tmpdir(), `video-compile-${randomUUID().slice(0, 8)}-${randomUUID().slice(0, 8)}`);
    await mkdir(workDir, { recursive: true });

    try {
      let voiceoverInput: string;
      let existingVoicePath: string | undefined;
      if (usePerSceneVoiceover) {
        const concatenated = await concatVoiceoverUrls(workDir, perSceneVoiceoverUrls);
        existingVoicePath = concatenated.path;
        // Keep scene pacing synced to real TTS lengths to avoid silent visual tail.
        // Add a tiny hold so cuts don't feel too abrupt.
        const HOLD_SEC = 0.15;
        for (let i = 0; i < scenes.length; i++) {
          const measured = concatenated.sceneDurationsSec[i] ?? 0;
          if (measured > 0.2) {
            scenes[i] = {
              ...scenes[i],
              duration: Math.max(1, Number((measured + HOLD_SEC).toFixed(2))),
            };
          }
        }
        voiceoverInput = "";
      } else {
        voiceoverInput = singleVoiceoverUrl!;
      }
      const bgmPath = resolveLocalBgmPath(backgroundMusic);
      if (backgroundMusic !== "none" && !bgmPath) {
        return NextResponse.json(
          { error: "Background music file missing on server. Ensure public/bgm/*.mp3 exists." },
          { status: 503 }
        );
      }
      const finalPath = await compileVideoToFile(workDir, scenes, voiceoverInput, existingVoicePath, transition, {
        bgmPath,
        bgmVolume: BGM_MIX_VOLUME,
        ...(outputAspect ? { outputAspect } : {}),
      });
      const buffer = await readFile(finalPath);
      const fileName = `compiled-${Date.now()}.mp4`;
      const storagePath = `${userId}/${storageFolderKey}/${fileName}`;

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
          contentType: "video/mp4",
          upsert: true,
        });

      if (error) {
        console.error("[videos/compile] Upload error:", error);
        return NextResponse.json(
          { error: `Upload failed: ${storageErrorMessage(error)}` },
          { status: 500 }
        );
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
      const publicUrl = urlData.publicUrl;

      // Save compiled video to My Library (videos table) so users can find it later
      try {
        const dateLabel = new Date().toLocaleDateString("en-GB", {
          day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        });
        await db.insert(videosTable).values({
          userId,
          title: `Compiled Video — ${dateLabel}`,
          platforms: ["video-guide"],
          status: "draft",
          metadata: { download_url: publicUrl, compiled_video_url: publicUrl },
        });
      } catch (libErr) {
        // Non-fatal: log but don't fail the response
        console.warn("[videos/compile] Could not save to library:", libErr);
      }

      // Auto-track goal progress: increment currentDay for active goals related to video creation
      try {
        const VIDEO_GOAL_KEYWORDS = ["video", "post", "content", "create"];
        const activeGoals = await db
          .select()
          .from(goalsTable)
          .where(and(eq(goalsTable.userId, userId), eq(goalsTable.status, "active")));

        const matchingGoals = activeGoals.filter((g) => {
          const haystack = `${g.title} ${g.description ?? ""}`.toLowerCase();
          return VIDEO_GOAL_KEYWORDS.some((kw) => haystack.includes(kw));
        });

        for (const goal of matchingGoals) {
          const nextDay = Math.min(goal.totalDays, goal.currentDay + 1);
          const newStreak = goal.streakCount + 1;
          const newLongest = Math.max(goal.longestStreak, newStreak);
          await db
            .update(goalsTable)
            .set({
              currentDay: nextDay,
              streakCount: newStreak,
              longestStreak: newLongest,
              updatedAt: new Date(),
            })
            .where(and(eq(goalsTable.id, goal.id), eq(goalsTable.userId, userId)));
        }
      } catch (goalErr) {
        // Non-fatal: log but don't fail the response
        console.warn("[videos/compile] Could not auto-track goal progress:", goalErr);
      }

      await useVideoCredit("brandStoryVideo").catch((e) => console.error("[videos/compile] credit deduction failed:", e));
      return NextResponse.json({ url: publicUrl });
    } finally {
      await cleanupWorkDir(workDir);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[videos/compile] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
