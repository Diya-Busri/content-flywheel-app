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

  if (!wide) {
    // Portrait: single centred layout (unchanged)
    const baseFontSize = text.length > 80 ? 60 : text.length > 50 ? 76 : text.length > 30 ? 90 : 108;
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width:${W}px; height:${H}px; overflow:hidden; background:${scheme.bg};
    font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;
    display:flex; flex-direction:column; align-items:center; justify-content:center; position:relative; }
  .glow { position:absolute; top:40%; left:50%; transform:translate(-50%,-50%);
    width:900px; height:800px; background:radial-gradient(ellipse,${scheme.glow} 0%,transparent 70%); pointer-events:none; }
  .progress { position:absolute; top:0; left:0; height:6px; width:${progressPct}%;
    background:${scheme.accent}; border-radius:0 3px 3px 0; }
  .counter { position:absolute; top:50px; right:60px; font-size:32px; font-weight:700;
    letter-spacing:2px; color:rgba(255,255,255,0.22); }
  .text-block { position:relative; z-index:2; max-width:920px; text-align:center; padding:0 60px; }
  .main-text { font-size:${baseFontSize}px; font-weight:900; line-height:1.2; letter-spacing:-0.01em; }
  .accent-line { position:absolute; bottom:200px; left:50%; transform:translateX(-50%);
    width:80px; height:6px; background:${scheme.accent}; border-radius:3px; opacity:0.5; }
</style></head><body>
  <div class="glow"></div>
  <div class="progress"></div>
  <div class="counter">${index + 1}/${total}</div>
  <div class="text-block"><div class="main-text">${wordsHtml}</div></div>
  <div class="accent-line"></div>
</body></html>`;
  }

  // ── Wide (16:9): 3 rotating layouts ─────────────────────────────────────────
  const layout = index % 3;
  const fs = text.length > 80 ? 64 : text.length > 50 ? 80 : text.length > 30 ? 96 : 112;

  if (layout === 0) {
    // Layout A: Large ghost number left | text right
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:${W}px; height:${H}px; overflow:hidden; background:${scheme.bg};
    font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;
    display:flex; align-items:center; position:relative; }
  .glow { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
    width:1400px; height:700px; background:radial-gradient(ellipse,${scheme.glow} 0%,transparent 70%); pointer-events:none; }
  .progress { position:absolute; top:0; left:0; height:5px; width:${progressPct}%;
    background:${scheme.accent}; border-radius:0 3px 3px 0; }
  .ghost-num { position:absolute; left:60px; top:50%; transform:translateY(-50%);
    font-size:520px; font-weight:900; line-height:1;
    color:${scheme.accent}; opacity:0.06; letter-spacing:-0.05em; user-select:none; }
  .left-bar { position:absolute; left:0; top:0; width:8px; height:100%;
    background:${scheme.accent}; opacity:0.7; }
  .right-panel { position:relative; z-index:2; margin-left:480px; max-width:1300px;
    padding:0 80px 0 0; }
  .eyebrow { font-size:22px; font-weight:700; letter-spacing:0.18em; text-transform:uppercase;
    color:${scheme.accent}; margin-bottom:24px; opacity:0.9; }
  .main-text { font-size:${fs}px; font-weight:900; line-height:1.2; letter-spacing:-0.01em; }
  .counter { position:absolute; bottom:50px; right:60px; font-size:24px; font-weight:700;
    letter-spacing:2px; color:rgba(255,255,255,0.2); }
</style></head><body>
  <div class="glow"></div>
  <div class="progress"></div>
  <div class="ghost-num">${index + 1}</div>
  <div class="left-bar"></div>
  <div class="right-panel">
    <div class="eyebrow">Part ${index + 1} of ${total}</div>
    <div class="main-text">${wordsHtml}</div>
  </div>
  <div class="counter">${index + 1} / ${total}</div>
</body></html>`;
  }

  if (layout === 1) {
    // Layout B: Centered text with flanking horizontal rules + corner accents
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:${W}px; height:${H}px; overflow:hidden; background:${scheme.bg};
    font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;
    display:flex; align-items:center; justify-content:center; position:relative; }
  .glow { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
    width:1600px; height:800px; background:radial-gradient(ellipse,${scheme.glow} 0%,transparent 65%); pointer-events:none; }
  .progress { position:absolute; top:0; left:0; height:5px; width:${progressPct}%;
    background:${scheme.accent}; border-radius:0 3px 3px 0; }
  /* corner accents */
  .c-tl,.c-tr,.c-bl,.c-br { position:absolute; width:48px; height:48px; }
  .c-tl { top:32px; left:32px; border-top:4px solid ${scheme.accent}; border-left:4px solid ${scheme.accent}; }
  .c-tr { top:32px; right:32px; border-top:4px solid ${scheme.accent}; border-right:4px solid ${scheme.accent}; }
  .c-bl { bottom:32px; left:32px; border-bottom:4px solid ${scheme.accent}; border-left:4px solid ${scheme.accent}; }
  .c-br { bottom:32px; right:32px; border-bottom:4px solid ${scheme.accent}; border-right:4px solid ${scheme.accent}; }
  .inner { position:relative; z-index:2; max-width:1400px; text-align:center; padding:0 100px; }
  .rule-wrap { display:flex; align-items:center; gap:24px; margin-bottom:36px; }
  .rule { flex:1; height:2px; background:${scheme.accent}; opacity:0.35; }
  .rule-label { font-size:20px; font-weight:700; letter-spacing:0.22em; text-transform:uppercase;
    color:${scheme.accent}; opacity:0.8; white-space:nowrap; }
  .main-text { font-size:${fs}px; font-weight:900; line-height:1.2; letter-spacing:-0.01em; }
  .rule-wrap-b { display:flex; align-items:center; gap:24px; margin-top:40px; }
  .counter { position:absolute; bottom:48px; right:60px; font-size:22px; font-weight:700;
    letter-spacing:2px; color:rgba(255,255,255,0.2); }
</style></head><body>
  <div class="glow"></div>
  <div class="progress"></div>
  <div class="c-tl"></div><div class="c-tr"></div>
  <div class="c-bl"></div><div class="c-br"></div>
  <div class="inner">
    <div class="rule-wrap"><div class="rule"></div><div class="rule-label">${index + 1} / ${total}</div><div class="rule"></div></div>
    <div class="main-text">${wordsHtml}</div>
    <div class="rule-wrap-b"><div class="rule"></div><div class="rule"></div></div>
  </div>
  <div class="counter">${progressPct}%</div>
</body></html>`;
  }

  // Layout C: text left-aligned with decorative dot grid + vertical line on right
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:${W}px; height:${H}px; overflow:hidden; background:${scheme.bg};
    font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;
    display:flex; align-items:center; position:relative; }
  .glow { position:absolute; top:50%; left:30%; transform:translate(-50%,-50%);
    width:1200px; height:700px; background:radial-gradient(ellipse,${scheme.glow} 0%,transparent 70%); pointer-events:none; }
  .progress { position:absolute; top:0; left:0; height:5px; width:${progressPct}%;
    background:${scheme.accent}; border-radius:0 3px 3px 0; }
  .content { position:relative; z-index:2; padding:0 0 0 120px; max-width:1300px; }
  .tag { display:inline-flex; align-items:center; gap:10px; margin-bottom:32px; }
  .tag-dot { width:14px; height:14px; border-radius:50%; background:${scheme.accent}; }
  .tag-text { font-size:20px; font-weight:700; letter-spacing:0.2em; text-transform:uppercase;
    color:${scheme.accent}; opacity:0.85; }
  .main-text { font-size:${fs}px; font-weight:900; line-height:1.2; letter-spacing:-0.01em; text-align:left; }
  /* dot grid on right */
  .dot-grid { position:absolute; right:80px; top:50%; transform:translateY(-50%);
    display:grid; grid-template-columns:repeat(6,24px); gap:16px; opacity:0.12; }
  .dot-grid span { width:8px; height:8px; border-radius:50%; background:${scheme.accent}; display:block; }
  /* vertical accent bar */
  .v-bar { position:absolute; right:340px; top:10%; height:80%; width:3px;
    background:${scheme.accent}; opacity:0.18; border-radius:2px; }
  .counter { position:absolute; bottom:48px; left:120px; font-size:22px; font-weight:700;
    letter-spacing:2px; color:rgba(255,255,255,0.2); }
</style></head><body>
  <div class="glow"></div>
  <div class="progress"></div>
  <div class="content">
    <div class="tag"><div class="tag-dot"></div><div class="tag-text">Scene ${index + 1}</div></div>
    <div class="main-text">${wordsHtml}</div>
  </div>
  <div class="v-bar"></div>
  <div class="dot-grid">${Array.from({length:42}).map(()=>`<span></span>`).join("")}</div>
  <div class="counter">${index + 1} / ${total}</div>
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
