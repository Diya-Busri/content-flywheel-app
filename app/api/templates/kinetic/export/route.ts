import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { getElevenLabsApiKey } from "@/lib/elevenlabs-api-key";
import { compileVideoToFile, cleanupWorkDir, type CompileScene } from "@/lib/videos/compile";
import { mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { tmpdir } from "os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
const SCENE_DURATION = 3.5; // seconds per scene

// ─── Color schemes ────────────────────────────────────────────────────────────

const SCHEMES = {
  "dark-orange": { bg: "#0A0A0A", accent: "#FF6B35", text: "#FFFFFF", glow: "rgba(255,107,53,0.18)" },
  "dark-blue":   { bg: "#060D1F", accent: "#4776E6", text: "#FFFFFF", glow: "rgba(71,118,230,0.18)" },
  "dark-green":  { bg: "#030F0A", accent: "#00C49A", text: "#FFFFFF", glow: "rgba(0,196,154,0.18)" },
  "dark-purple": { bg: "#0D0814", accent: "#8E54E9", text: "#FFFFFF", glow: "rgba(142,84,233,0.18)" },
};

type SchemeKey = keyof typeof SCHEMES;

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderKineticSlide(
  text: string,
  accentWords: number,
  schemeKey: SchemeKey,
  index: number,
  total: number,
  wide = false
): string {
  const scheme = SCHEMES[schemeKey] ?? SCHEMES["dark-orange"];
  const words = text.split(/\s+/).filter(Boolean);
  const wordsHtml = words.map((w, wi) => {
    const color = wi < accentWords ? scheme.accent : scheme.text;
    return `<span style="color:${color};">${escHtml(w)}${wi < words.length - 1 ? " " : ""}</span>`;
  }).join("");

  const progressPct = Math.round(((index + 1) / total) * 100);

  const W = wide ? 1920 : 1080;
  const H = wide ? 1080 : 1920;
  // Font size: wider canvas needs larger type for visual impact
  const baseFontSize = wide
    ? (text.length > 80 ? 72 : text.length > 50 ? 92 : text.length > 30 ? 108 : 128)
    : (text.length > 80 ? 60 : text.length > 50 ? 76 : text.length > 30 ? 90 : 108);
  const maxWidth = wide ? 1600 : 920;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${W}px; height: ${H}px; overflow: hidden;
    background: ${scheme.bg};
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    position: relative;
  }
  .glow {
    position: absolute; top: 40%; left: 50%;
    transform: translate(-50%, -50%);
    width: ${wide ? 1400 : 900}px; height: ${wide ? 700 : 800}px;
    background: radial-gradient(ellipse, ${scheme.glow} 0%, transparent 70%);
    pointer-events: none;
  }
  .progress {
    position: absolute; top: 0; left: 0;
    height: ${wide ? 5 : 6}px; width: ${progressPct}%;
    background: ${scheme.accent}; border-radius: 0 3px 3px 0;
  }
  .counter {
    position: absolute; top: ${wide ? 36 : 50}px; right: ${wide ? 48 : 60}px;
    font-size: ${wide ? 28 : 32}px; font-weight: 700; letter-spacing: 2px;
    color: rgba(255,255,255,0.22);
  }
  .text-block {
    position: relative; z-index: 2;
    max-width: ${maxWidth}px; text-align: center; padding: 0 ${wide ? 80 : 60}px;
  }
  .main-text {
    font-size: ${baseFontSize}px; font-weight: 900;
    line-height: 1.2; letter-spacing: -0.01em;
  }
  .accent-line {
    position: absolute; bottom: ${wide ? 80 : 200}px; left: 50%;
    transform: translateX(-50%);
    width: ${wide ? 100 : 80}px; height: ${wide ? 5 : 6}px;
    background: ${scheme.accent}; border-radius: 3px; opacity: 0.5;
  }
</style></head><body>
  <div class="glow"></div>
  <div class="progress"></div>
  <div class="counter">${index + 1}/${total}</div>
  <div class="text-block">
    <div class="main-text">${wordsHtml}</div>
  </div>
  <div class="accent-line"></div>
</body></html>`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({})) as {
      topic?: string;
      colorScheme?: string;
      voiceId?: string;
      aspectRatio?: string;
      scenes?: { text?: string; accentWords?: number }[];
    };

    const scenes = Array.isArray(body.scenes) ? body.scenes : [];
    if (scenes.length === 0) return NextResponse.json({ error: "No scenes provided" }, { status: 400 });

    const colorScheme = (["dark-orange", "dark-blue", "dark-green", "dark-purple"].includes(body.colorScheme ?? "")
      ? body.colorScheme
      : "dark-orange") as SchemeKey;

    const is16x9 = body.aspectRatio === "16:9";
    const vpWidth = is16x9 ? 1920 : 1080;
    const vpHeight = is16x9 ? 1080 : 1920;

    const voiceId = typeof body.voiceId === "string" && body.voiceId.trim() ? body.voiceId.trim() : DEFAULT_VOICE_ID;

    const apiKey = getElevenLabsApiKey();
    if (!apiKey) return NextResponse.json({ error: "ElevenLabs not configured" }, { status: 500 });

    // Build voiceover script (just read all scenes naturally)
    const scriptText = scenes.map((s) => s.text ?? "").filter(Boolean).join(". ");
    if (!scriptText) return NextResponse.json({ error: "No text content in scenes" }, { status: 400 });

    // Generate voiceover
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text: scriptText,
        model_id: "eleven_turbo_v2",
        voice_settings: { stability: 0.52, similarity_boost: 0.78, style: 0.1, use_speaker_boost: true },
      }),
    });
    if (!ttsRes.ok) {
      const e = await ttsRes.text().catch(() => "");
      return NextResponse.json({ error: `Voiceover failed: ${e}` }, { status: 502 });
    }
    const audioBytes = Buffer.from(await ttsRes.arrayBuffer());

    const workDir = join(tmpdir(), `kinetic-export-${randomUUID().slice(0, 8)}`);
    await mkdir(workDir, { recursive: true });

    try {
      const { launchPuppeteerBrowser } = require("@/lib/puppeteer-launch") as { launchPuppeteerBrowser: () => Promise<import("puppeteer").Browser> };
      const browser = await launchPuppeteerBrowser();

      const compileScenes: CompileScene[] = [];

      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i]!;
        const html = renderKineticSlide(
          scene.text ?? "",
          scene.accentWords ?? 2,
          colorScheme,
          i,
          scenes.length,
          is16x9
        );

        const page = await browser.newPage();
        await page.setViewport({ width: vpWidth, height: vpHeight, deviceScaleFactor: 1 });
        await page.setContent(html, { waitUntil: "networkidle0" });
        const imgPath = join(workDir, `scene_${i}.png`);
        await page.screenshot({ path: imgPath as `${string}.png`, type: "png" });
        await page.close();

        // Duration: based on word count (~2.5 words/sec for average speech)
        const wordCount = (scene.text ?? "").split(/\s+/).filter(Boolean).length;
        const duration = Math.max(2, Math.round(wordCount / 2.5 * 10) / 10);
        compileScenes.push({ duration, image_url: null, video_url: null, localImagePath: imgPath });
      }

      await browser.close();

      const voicePath = join(workDir, "voiceover.mp3");
      await writeFile(voicePath, audioBytes);

      const finalPath = await compileVideoToFile(workDir, compileScenes, "", voicePath, "fade", {
        outputAspect: is16x9 ? "16:9" : "9:16",
        videoPreset: "veryfast",
      });

      const buffer = await readFile(finalPath);
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": `attachment; filename="kinetic-${Date.now()}.mp4"`,
        },
      });
    } finally {
      await cleanupWorkDir(workDir);
    }
  } catch (err) {
    console.error("[templates/kinetic/export]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Export failed" }, { status: 500 });
  }
}
