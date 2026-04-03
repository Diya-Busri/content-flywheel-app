import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { getElevenLabsApiKey } from "@/lib/elevenlabs-api-key";
import { buildViralExportVoiceScript, buildViralTimeline } from "@/lib/viral-cta-plan";
import { compileVideoToFile, cleanupWorkDir, type CompileScene } from "@/lib/videos/compile";
import { BGM_MIX_VOLUME, BGM_REQUEST_VALUES, type BgmSelectValue } from "@/lib/bgm-tracks";
import { resolveLocalBgmPath } from "@/lib/bgm-tracks.server";
import { resolveViralVisualTheme } from "@/lib/viral-visual-themes";
import {
  renderCTASlide,
  renderCTASlide16x9,
  renderIntroSlide,
  renderIntroSlide16x9,
  renderOutroSlide,
  renderOutroSlide16x9,
  renderQuizSlide,
  renderQuizSlide16x9,
  renderWYRSlide,
  renderWYRSlide16x9,
} from "@/lib/viral-export-html";
import { mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { tmpdir } from "os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
const DEFAULT_slideDuration = 5; // seconds per round

function resolveViralExportVoiceId(raw: unknown, fallback: string): string {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  const id = raw.trim();
  if (!/^[a-zA-Z0-9]{8,64}$/.test(id)) return fallback;
  return id;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({})) as {
      type?: string;
      topic?: string;
      slideDuration?: number;
      aspectRatio?: string;
      voiceId?: string;
      backgroundMusic?: string;
      visualTheme?: string;
      rounds?: { optionA?: string; optionB?: string; question?: string; options?: string[]; correctIndex?: number; explanation?: string }[];
    };

    const type = body.type === "quiz" ? "quiz" : "would-you-rather";
    const rounds = Array.isArray(body.rounds) ? body.rounds : [];
    const slideDuration = typeof body.slideDuration === "number" && body.slideDuration > 0 ? body.slideDuration : DEFAULT_slideDuration;
    const is16x9 = body.aspectRatio === "16:9";
    const vpWidth = is16x9 ? 1920 : 1080;
    const vpHeight = is16x9 ? 1080 : 1920;
    if (rounds.length === 0) return NextResponse.json({ error: "No rounds provided" }, { status: 400 });

    const apiKey = getElevenLabsApiKey();
    if (!apiKey) return NextResponse.json({ error: "ElevenLabs not configured" }, { status: 500 });

    const voiceId = resolveViralExportVoiceId(body.voiceId, DEFAULT_VOICE_ID);

    const bgmRaw = typeof body.backgroundMusic === "string" ? body.backgroundMusic.trim() : "none";
    const bgmId: BgmSelectValue = BGM_REQUEST_VALUES.has(bgmRaw) ? (bgmRaw as BgmSelectValue) : "none";
    const bgmPath = resolveLocalBgmPath(bgmId);

    const topic = typeof body.topic === "string" ? body.topic : "";
    const vt = resolveViralVisualTheme(typeof body.visualTheme === "string" ? body.visualTheme : undefined);
    const timeline = buildViralTimeline(rounds.length, 4);
    const scriptLines = buildViralExportVoiceScript(type, topic, rounds, timeline);

    // Generate voiceover
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text: scriptLines,
        model_id: "eleven_turbo_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
      }),
    });
    if (!ttsRes.ok) {
      const e = await ttsRes.text().catch(() => "");
      return NextResponse.json({ error: `Voiceover failed: ${e}` }, { status: 502 });
    }
    const audioBytes = Buffer.from(await ttsRes.arrayBuffer());

    // Render slides via Puppeteer
    const workDir = join(tmpdir(), `viral-export-${randomUUID().slice(0, 8)}`);
    await mkdir(workDir, { recursive: true });

    try {
      const { launchPuppeteerBrowser } = require("@/lib/puppeteer-launch") as { launchPuppeteerBrowser: () => Promise<import("puppeteer").Browser> };
      const browser = await launchPuppeteerBrowser();

      const compileScenes: CompileScene[] = [];
      let fileCounter = 0;

      const screenshotHtml = async (html: string) => {
        const page = await browser.newPage();
        await page.setViewport({ width: vpWidth, height: vpHeight, deviceScaleFactor: 1 });
        await page.setContent(html, { waitUntil: "networkidle0" });
        const imgPath = join(workDir, `slide_${fileCounter++}.png`);
        await page.screenshot({ path: imgPath as `${string}.png`, type: "png" });
        await page.close();
        return imgPath;
      };

      const isQuiz = type === "quiz";

      for (const item of timeline) {
        if (item.kind === "intro") {
          const html = is16x9
            ? renderIntroSlide16x9(vt, topic, isQuiz, rounds.length)
            : renderIntroSlide(vt, topic, isQuiz, rounds.length);
          const imgPath = await screenshotHtml(html);
          compileScenes.push({ duration: slideDuration, image_url: null, video_url: null, localImagePath: imgPath });
          continue;
        }
        if (item.kind === "outro") {
          const html = is16x9 ? renderOutroSlide16x9(vt, topic, isQuiz) : renderOutroSlide(vt, topic, isQuiz);
          const imgPath = await screenshotHtml(html);
          compileScenes.push({ duration: slideDuration, image_url: null, video_url: null, localImagePath: imgPath });
          continue;
        }
        if (item.kind === "cta") {
          const html = is16x9 ? renderCTASlide16x9(vt, "mid") : renderCTASlide(vt, "mid");
          const imgPath = await screenshotHtml(html);
          compileScenes.push({ duration: slideDuration, image_url: null, video_url: null, localImagePath: imgPath });
          continue;
        }

        const i = item.roundIndex;
        const r = rounds[i]!;
        const html = is16x9
          ? type === "would-you-rather"
            ? renderWYRSlide16x9(vt, r.optionA ?? "", r.optionB ?? "", (r as { emojiA?: string }).emojiA ?? "", (r as { emojiB?: string }).emojiB ?? "", i, rounds.length)
            : renderQuizSlide16x9(vt, r.question ?? "", r.options ?? [], r.correctIndex ?? 0, r.explanation, (r as { emoji?: string }).emoji, i, rounds.length, false)
          : type === "would-you-rather"
            ? renderWYRSlide(vt, r.optionA ?? "", r.optionB ?? "", i, rounds.length)
            : renderQuizSlide(vt, r.question ?? "", r.options ?? [], r.correctIndex ?? 0, r.explanation, i, rounds.length, false);

        const imgPath = await screenshotHtml(html);

        if (type === "quiz") {
          const revealedHtml = is16x9
            ? renderQuizSlide16x9(vt, r.question ?? "", r.options ?? [], r.correctIndex ?? 0, r.explanation, (r as { emoji?: string }).emoji, i, rounds.length, true)
            : renderQuizSlide(vt, r.question ?? "", r.options ?? [], r.correctIndex ?? 0, r.explanation, i, rounds.length, true);
          const revealedPath = await screenshotHtml(revealedHtml);
          compileScenes.push({
            duration: Math.round(slideDuration / 2),
            image_url: null,
            video_url: null,
            localImagePath: imgPath,
          });
          compileScenes.push({
            duration: Math.round(slideDuration / 2),
            image_url: null,
            video_url: null,
            localImagePath: revealedPath,
          });
        } else {
          compileScenes.push({ duration: slideDuration, image_url: null, video_url: null, localImagePath: imgPath });
        }
      }

      await browser.close();

      const voicePath = join(workDir, "voiceover.mp3");
      await writeFile(voicePath, audioBytes);

      const finalPath = await compileVideoToFile(workDir, compileScenes, "", voicePath, "fade", {
        outputAspect: is16x9 ? "16:9" : "9:16",
        bgmPath,
        bgmVolume: BGM_MIX_VOLUME,
      });

      const buffer = await readFile(finalPath);
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": `attachment; filename="viral-video-${Date.now()}.mp4"`,
        },
      });
    } finally {
      await cleanupWorkDir(workDir);
    }
  } catch (err) {
    console.error("[templates/viral/export]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Export failed" }, { status: 500 });
  }
}
