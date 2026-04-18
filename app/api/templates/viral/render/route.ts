/**
 * POST /api/templates/viral/render
 *
 * Renders WYR/Quiz HTML slides via Puppeteer and generates TTS audio.
 * Uploads all assets to Supabase, returns { guideScenes, voiceoverUrl }
 * for the client to pass straight to POST /api/videos/compile.
 *
 * No FFmpeg here — compilation is delegated to the shared compile route
 * so the viral export uses the same pipeline as Video Guide exports.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { getElevenLabsApiKey } from "@/lib/elevenlabs-api-key";
import { buildViralExportVoiceScript, buildViralTimeline } from "@/lib/viral-cta-plan";
import { BGM_REQUEST_VALUES, type BgmSelectValue } from "@/lib/bgm-tracks";
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
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
const BUCKET = "timeline-media";

function resolveVoiceId(raw: unknown, fallback: string): string {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  const id = raw.trim();
  if (!/^[a-zA-Z0-9]{8,64}$/.test(id)) return fallback;
  return id;
}

type Round = {
  optionA?: string; optionB?: string; emojiA?: string; emojiB?: string;
  question?: string; options?: string[]; correctIndex?: number; explanation?: string; emoji?: string;
};

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
      rounds?: Round[];
    };

    const type = body.type === "quiz" ? "quiz" : "would-you-rather";
    const rounds: Round[] = Array.isArray(body.rounds) ? body.rounds : [];
    const slideDuration = typeof body.slideDuration === "number" && body.slideDuration > 0 ? body.slideDuration : 5;
    const is16x9 = body.aspectRatio === "16:9";
    const topic = typeof body.topic === "string" ? body.topic : "";
    const vtKey = typeof body.visualTheme === "string" ? body.visualTheme : "";
    const bgmRaw = typeof body.backgroundMusic === "string" ? body.backgroundMusic.trim() : "none";
    const bgmId: BgmSelectValue = BGM_REQUEST_VALUES.has(bgmRaw) ? (bgmRaw as BgmSelectValue) : "none";

    if (rounds.length === 0) return NextResponse.json({ error: "No rounds provided" }, { status: 400 });

    const apiKey = getElevenLabsApiKey();
    if (!apiKey) return NextResponse.json({ error: "ElevenLabs not configured" }, { status: 500 });

    const voiceId = resolveVoiceId(body.voiceId, DEFAULT_VOICE_ID);
    const vpWidth = is16x9 ? 1920 : 1080;
    const vpHeight = is16x9 ? 1080 : 1920;
    const vt = resolveViralVisualTheme(vtKey);
    const isQuiz = type === "quiz";
    const timeline = buildViralTimeline(rounds.length, 4);
    const scriptLines = buildViralExportVoiceScript(type, topic, rounds as Parameters<typeof buildViralExportVoiceScript>[2], timeline);

    // TTS + Puppeteer launch in parallel
    const [ttsRes, browser] = await Promise.all([
      fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({
          text: scriptLines,
          model_id: "eleven_turbo_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
        }),
      }),
      (async () => {
        const { launchPuppeteerBrowser } = require("@/lib/puppeteer-launch") as {
          launchPuppeteerBrowser: () => Promise<import("puppeteer").Browser>;
        };
        return launchPuppeteerBrowser();
      })(),
    ]);

    if (!ttsRes.ok) {
      await browser.close().catch(() => {});
      const e = await ttsRes.text().catch(() => "");
      return NextResponse.json({ error: `Voiceover failed: ${e}` }, { status: 500 });
    }
    const audioBytes = Buffer.from(await ttsRes.arrayBuffer());

    // Screenshot each slide
    const slides: { buf: Buffer; duration: number }[] = [];

    const screenshotPage = async (html: string): Promise<Buffer> => {
      const page = await browser.newPage();
      await page.setViewport({ width: vpWidth, height: vpHeight, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: "domcontentloaded" });
      const buf = Buffer.from(await page.screenshot({ type: "png" }));
      await page.close();
      return buf;
    };

    for (const item of timeline) {
      if (item.kind === "intro") {
        const html = is16x9
          ? renderIntroSlide16x9(vt, topic, isQuiz, rounds.length)
          : renderIntroSlide(vt, topic, isQuiz, rounds.length);
        slides.push({ buf: await screenshotPage(html), duration: slideDuration });
        continue;
      }
      if (item.kind === "outro") {
        const html = is16x9
          ? renderOutroSlide16x9(vt, topic, isQuiz)
          : renderOutroSlide(vt, topic, isQuiz);
        slides.push({ buf: await screenshotPage(html), duration: slideDuration });
        continue;
      }
      if (item.kind === "cta") {
        const html = is16x9 ? renderCTASlide16x9(vt, "mid") : renderCTASlide(vt, "mid");
        slides.push({ buf: await screenshotPage(html), duration: slideDuration });
        continue;
      }

      const i = item.roundIndex;
      const r = rounds[i]!;

      if (isQuiz) {
        const questionHtml = is16x9
          ? renderQuizSlide16x9(vt, r.question ?? "", r.options ?? [], r.correctIndex ?? 0, r.explanation, r.emoji, i, rounds.length, false)
          : renderQuizSlide(vt, r.question ?? "", r.options ?? [], r.correctIndex ?? 0, r.explanation, i, rounds.length, false);
        const revealHtml = is16x9
          ? renderQuizSlide16x9(vt, r.question ?? "", r.options ?? [], r.correctIndex ?? 0, r.explanation, r.emoji, i, rounds.length, true)
          : renderQuizSlide(vt, r.question ?? "", r.options ?? [], r.correctIndex ?? 0, r.explanation, i, rounds.length, true);
        const half = Math.max(1, Math.round(slideDuration / 2));
        slides.push({ buf: await screenshotPage(questionHtml), duration: half });
        slides.push({ buf: await screenshotPage(revealHtml), duration: half });
      } else {
        const html = is16x9
          ? renderWYRSlide16x9(vt, r.optionA ?? "", r.optionB ?? "", r.emojiA ?? "", r.emojiB ?? "", i, rounds.length)
          : renderWYRSlide(vt, r.optionA ?? "", r.optionB ?? "", i, rounds.length);
        slides.push({ buf: await screenshotPage(html), duration: slideDuration });
      }
    }

    await browser.close();

    // Upload everything to Supabase in parallel
    const supabase = getSupabaseAdmin();
    const prefix = `${userId}/viral-renders/${randomUUID().slice(0, 8)}`;

    const uploadResults = await Promise.all([
      supabase.storage.from(BUCKET).upload(`${prefix}/voice.mp3`, audioBytes, { contentType: "audio/mpeg", upsert: true }),
      ...slides.map((s, i) =>
        supabase.storage.from(BUCKET).upload(`${prefix}/slide-${i}.png`, s.buf, { contentType: "image/png", upsert: true })
      ),
    ]);

    const [voiceUpload, ...imageUploads] = uploadResults;
    if (voiceUpload.error) throw new Error(`Voice upload failed: ${voiceUpload.error.message}`);

    const { data: voiceUrlData } = supabase.storage.from(BUCKET).getPublicUrl(voiceUpload.data!.path);

    const guideScenes = slides.map((s, i) => {
      const upload = imageUploads[i];
      if (upload.error) throw new Error(`Slide ${i} upload failed: ${upload.error.message}`);
      const { data: imgUrlData } = supabase.storage.from(BUCKET).getPublicUrl(upload.data!.path);
      return {
        image_url: imgUrlData.publicUrl,
        video_url: null,
        duration: s.duration,
        disableKenBurns: true,
      };
    });

    return NextResponse.json({
      guideScenes,
      voiceoverUrl: voiceUrlData.publicUrl,
      backgroundMusic: bgmId,
    });
  } catch (err) {
    console.error("[viral/render]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Render failed" }, { status: 500 });
  }
}
