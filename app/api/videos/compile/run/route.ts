/**
 * POST /api/videos/compile/run
 * Internal background endpoint — called server-to-server (fire-and-forget) after
 * a job record is created by /api/videos/compile. Not called directly by the browser.
 *
 * Verifies the COMPILE_INTERNAL_SECRET header so only our own server can trigger it.
 * Runs FFmpeg compilation and updates the renderJobsTable row on completion/failure.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { renderJobsTable, videosTable, savedScriptsTable } from "@/db/schema/library-schema";
import { goalsTable } from "@/db/schema/goals-schema";
import { eq, and } from "drizzle-orm";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { compileVideoToFile, concatVoiceoverUrls, cleanupWorkDir, type CompileScene } from "@/lib/videos/compile";
import { BGM_MIX_VOLUME, type BgmSelectValue } from "@/lib/bgm-tracks";
import { resolveLocalBgmPath } from "@/lib/bgm-tracks.server";
import { mkdir, readFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { deductVideoCredit } from "@/actions/video-credits-actions";
import { logEvent } from "@/lib/log-event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BUCKET = "timeline-media";

type SceneRow = {
  duration?: number;
  image_url?: string | null;
  video_url?: string | null;
  voiceover_url?: string | null;
  voiceoverUrl?: string | null;
  script_text?: string;
  caption?: string | null;
};

function sceneVoiceoverHttpUrl(s: SceneRow): string | null {
  const raw =
    (typeof s.voiceover_url === "string" && s.voiceover_url.trim()) ||
    (typeof s.voiceoverUrl === "string" && s.voiceoverUrl.trim()) ||
    "";
  const u = raw.trim();
  return u.startsWith("http://") || u.startsWith("https://") ? u : null;
}

function isHttpUrl(s: string) {
  const t = s.trim();
  return t.startsWith("http://") || t.startsWith("https://");
}

export async function POST(request: NextRequest) {
  // Verify internal secret — same derivation as /api/videos/compile/route.ts
  const secret =
    process.env.COMPILE_INTERNAL_SECRET?.trim() ||
    (process.env.DATABASE_URL
      ? Buffer.from(process.env.DATABASE_URL).toString("base64").slice(0, 40)
      : null);
  const provided = request.headers.get("x-compile-secret")?.trim();
  if (!secret || !provided || secret !== provided) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({})) as {
    jobId?: string;
    userId?: string;
    storageFolderKey?: string;
    scriptId?: string;
    sceneRows?: SceneRow[];
    voiceoverUrl?: string | null;
    backgroundMusic?: BgmSelectValue;
    outputAspect?: "16:9" | "9:16";
    transition?: string;
  };

  const { jobId, userId, storageFolderKey, sceneRows, scriptId, backgroundMusic = "none", outputAspect, transition } = body;

  if (!jobId || !userId) {
    return NextResponse.json({ error: "jobId and userId required" }, { status: 400 });
  }

  // Mark as processing
  await db
    .update(renderJobsTable)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(renderJobsTable.id, jobId));

  const workDir = join(tmpdir(), `video-compile-${randomUUID().slice(0, 8)}`);
  await mkdir(workDir, { recursive: true });

  try {
    // Resolve scene rows (from inline or DB)
    let resolvedSceneRows: SceneRow[] = [];
    let savedScriptVoiceover: string | null = null;
    let finalStorageFolderKey = storageFolderKey ?? `bg-compile/${randomUUID()}`;

    if (Array.isArray(sceneRows) && sceneRows.length > 0) {
      resolvedSceneRows = sceneRows;
    } else if (scriptId) {
      const [row] = await db
        .select()
        .from(savedScriptsTable)
        .where(and(eq(savedScriptsTable.id, scriptId), eq(savedScriptsTable.userId, userId)))
        .limit(1);
      if (!row) throw new Error("Script not found");
      resolvedSceneRows = (Array.isArray(row.scenesJson) ? row.scenesJson : []) as SceneRow[];
      savedScriptVoiceover = row.voiceoverUrl?.trim() ?? null;
      finalStorageFolderKey = scriptId;
    }

    if (resolvedSceneRows.length === 0) throw new Error("No scenes to compile");

    const perSceneVoiceoverUrls = resolvedSceneRows.map(sceneVoiceoverHttpUrl);
    const usePerSceneVoiceover = perSceneVoiceoverUrls.every((u): u is string => u != null);
    const bodyVoiceRaw = typeof body.voiceoverUrl === "string" ? body.voiceoverUrl.trim() : "";
    const bodySingleVoice = isHttpUrl(bodyVoiceRaw) ? bodyVoiceRaw : null;
    const singleVoiceoverUrl = !usePerSceneVoiceover ? bodySingleVoice ?? savedScriptVoiceover : null;

    const scenes: CompileScene[] = resolvedSceneRows.map((s) => {
      const duration = typeof s.duration === "number" && s.duration > 0 ? s.duration : 5;
      const imageUrl = typeof s.image_url === "string" && s.image_url.trim() ? s.image_url.trim() : null;
      const videoUrl = typeof s.video_url === "string" && s.video_url.trim() ? s.video_url.trim() : null;
      const scriptLine = typeof s.script_text === "string" ? s.script_text.trim() : "";
      const capLine = typeof s.caption === "string" ? s.caption.trim() : "";
      const rawLine = scriptLine || capLine;
      const dialogue = rawLine ? rawLine.replace(/\r?\n/g, " ").trim() : null;
      return { duration, image_url: imageUrl, video_url: videoUrl || null, dialogue };
    });

    let voiceoverInput = "";
    let existingVoicePath: string | undefined;
    if (usePerSceneVoiceover) {
      const concatenated = await concatVoiceoverUrls(workDir, perSceneVoiceoverUrls);
      existingVoicePath = concatenated.path;
      const HOLD_SEC = 0.15;
      for (let i = 0; i < scenes.length; i++) {
        const measured = concatenated.sceneDurationsSec[i] ?? 0;
        if (measured > 0.2) {
          scenes[i] = { ...scenes[i], duration: Math.max(1, Number((measured + HOLD_SEC).toFixed(2))) };
        }
      }
    } else {
      voiceoverInput = singleVoiceoverUrl ?? "";
    }

    const bgmPath = resolveLocalBgmPath(backgroundMusic);
    const estimatedDurationSec = scenes.reduce((sum, s) => sum + (s.duration || 5), 0);
    const isHugeVideo = scenes.length > 60 || estimatedDurationSec > 600;
    const isLargeVideo = !isHugeVideo && scenes.length > 20;
    const compileQuality = isHugeVideo
      ? { resolution: "480p" as const, crf: 32, videoPreset: "veryfast" as const }
      : isLargeVideo
        ? { resolution: "720p" as const, crf: 28 }
        : {};

    const finalPath = await compileVideoToFile(workDir, scenes, voiceoverInput, existingVoicePath, transition, {
      bgmPath,
      bgmVolume: BGM_MIX_VOLUME,
      ...(outputAspect ? { outputAspect } : {}),
      ...compileQuality,
    });

    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("Storage not configured");

    const buffer = await readFile(finalPath);
    const fileName = `compiled-${Date.now()}.mp4`;
    const storagePath = `${userId}/${finalStorageFolderKey}/${fileName}`;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: "video/mp4", upsert: true });

    if (error) throw new Error(`Upload failed: ${error.message}`);

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    const publicUrl = urlData.publicUrl;

    // Mark job completed
    await db
      .update(renderJobsTable)
      .set({ status: "completed", videoUrl: publicUrl, updatedAt: new Date() })
      .where(eq(renderJobsTable.id, jobId));

    // Save to library
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
    } catch { /* non-fatal */ }

    // Auto-track goals
    try {
      const VIDEO_GOAL_KEYWORDS = ["video", "post", "content", "create"];
      const activeGoals = await db
        .select().from(goalsTable)
        .where(and(eq(goalsTable.userId, userId), eq(goalsTable.status, "active")));
      for (const goal of activeGoals.filter((g) =>
        VIDEO_GOAL_KEYWORDS.some((kw) => `${g.title} ${g.description ?? ""}`.toLowerCase().includes(kw))
      )) {
        const nextDay = Math.min(goal.totalDays, goal.currentDay + 1);
        const newStreak = goal.streakCount + 1;
        await db.update(goalsTable)
          .set({ currentDay: nextDay, streakCount: newStreak, longestStreak: Math.max(goal.longestStreak, newStreak), updatedAt: new Date() })
          .where(and(eq(goalsTable.id, goal.id), eq(goalsTable.userId, userId)));
      }
    } catch { /* non-fatal */ }

    await deductVideoCredit("brandStoryVideo").catch(() => {});
    void logEvent(userId, "video_compiled", { url: publicUrl, async: true });

    return NextResponse.json({ ok: true, url: publicUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[videos/compile/run]", err);
    await db
      .update(renderJobsTable)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(renderJobsTable.id, jobId));
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await cleanupWorkDir(workDir);
  }
}
