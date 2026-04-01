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
const DEFAULT_slideDuration = 5; // seconds per round

// ─── HTML renderers ───────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderWYRSlide16x9(optionA: string, optionB: string, emojiA: string, emojiB: string, idx: number, total: number): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1920px; height: 1080px; overflow: hidden;
    background: #0A0A0F;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    display: flex; flex-direction: column; position: relative;
  }
  .bg-glow {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at 20% 50%, rgba(255,65,108,0.1), transparent 55%),
                radial-gradient(ellipse at 80% 50%, rgba(71,118,230,0.1), transparent 55%);
  }
  .top-bar {
    position: absolute; top: 0; left: 0; right: 0;
    display: flex; justify-content: space-between; align-items: center;
    padding: 36px 60px; z-index: 3;
  }
  .title { font-size: 32px; font-weight: 800; letter-spacing: 8px; text-transform: uppercase; color: rgba(255,255,255,0.9); }
  .counter {
    background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7);
    font-size: 24px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase;
    padding: 10px 28px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.12);
  }
  .panels {
    position: absolute; top: 110px; bottom: 80px;
    left: 48px; right: 48px;
    display: flex; flex-direction: row; gap: 0;
  }
  .panel {
    flex: 1; border-radius: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; padding: 60px 80px;
    position: relative; overflow: hidden;
  }
  .panel-a {
    background: linear-gradient(160deg, #FF416C 0%, #FF4B2B 100%);
    border-radius: 24px 0 0 24px;
    box-shadow: 0 12px 60px rgba(255,65,108,0.35);
  }
  .panel-b {
    background: linear-gradient(160deg, #4776E6 0%, #8E54E9 100%);
    border-radius: 0 24px 24px 0;
    box-shadow: 0 12px 60px rgba(71,118,230,0.35);
  }
  .or-wrap {
    display: flex; align-items: center; justify-content: center;
    width: 90px; flex-shrink: 0; z-index: 3;
  }
  .or-inner {
    width: 72px; height: 72px; border-radius: 50%;
    background: #fff; color: #0A0A0F;
    font-weight: 900; font-size: 22px;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 6px 24px rgba(0,0,0,0.5);
  }
  .label { font-size: 22px; font-weight: 700; color: rgba(255,255,255,0.65); letter-spacing: 4px; text-transform: uppercase; margin-bottom: 16px; }
  .emoji { font-size: 64px; margin-bottom: 16px; }
  .option-text { font-size: 56px; font-weight: 900; color: #fff; text-align: center; line-height: 1.2; text-shadow: 0 4px 20px rgba(0,0,0,0.2); }
  .cta { position: absolute; bottom: 24px; left: 0; right: 0; text-align: center; font-size: 28px; color: rgba(255,255,255,0.4); }
</style></head><body>
  <div class="bg-glow"></div>
  <div class="top-bar">
    <div class="title">Would You Rather</div>
    <div class="counter">${idx + 1} / ${total}</div>
  </div>
  <div class="panels">
    <div class="panel panel-a">
      ${emojiA ? `<div class="emoji">${escHtml(emojiA)}</div>` : ""}
      <div class="label">A</div>
      <div class="option-text">${escHtml(optionA)}</div>
    </div>
    <div class="or-wrap"><div class="or-inner">OR</div></div>
    <div class="panel panel-b">
      ${emojiB ? `<div class="emoji">${escHtml(emojiB)}</div>` : ""}
      <div class="label">B</div>
      <div class="option-text">${escHtml(optionB)}</div>
    </div>
  </div>
  <div class="cta">💬 Comment A or B below!</div>
</body></html>`;
}

function renderQuizSlide16x9(question: string, options: string[], correctIndex: number, explanation: string | undefined, emoji: string | undefined, idx: number, total: number, revealed: boolean): string {
  const COLORS = ["#FF6B35", "#4776E6", "#00C49A", "#FF416C"];
  const LABELS = ["A", "B", "C", "D"];
  const optionsHtml = options.map((opt, i) => {
    const isCorrect = i === correctIndex;
    const bg = revealed ? (isCorrect ? "rgba(0,196,154,0.15)" : "rgba(255,255,255,0.03)") : "rgba(255,255,255,0.05)";
    const border = revealed ? (isCorrect ? "#00C49A" : "rgba(255,255,255,0.07)") : "rgba(255,255,255,0.1)";
    const textColor = revealed ? (isCorrect ? "#00C49A" : "rgba(255,255,255,0.3)") : "#fff";
    const badgeBg = revealed ? (isCorrect ? "#00C49A" : "rgba(255,255,255,0.08)") : COLORS[i];
    const badgeColor = revealed && !isCorrect ? "rgba(255,255,255,0.25)" : "#fff";
    return `<div style="display:flex;align-items:center;padding:0 32px;background:${bg};border:1px solid ${border};border-radius:14px;flex:1;">
      <div style="width:48px;height:48px;border-radius:50%;background:${badgeBg};display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:${badgeColor};flex-shrink:0;margin-right:28px;">${LABELS[i]}</div>
      <div style="font-size:34px;font-weight:600;color:${textColor};line-height:1.25;flex:1;">${escHtml(opt)}</div>
      ${revealed && isCorrect ? '<div style="font-size:36px;margin-left:12px;">✓</div>' : ""}
    </div>`;
  }).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1920px; height: 1080px; overflow: hidden;
    background: #080B14; display: flex; flex-direction: row;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    position: relative;
  }
  .grid-bg {
    position: absolute; inset: 0;
    background-image: linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
    background-size: 60px 60px;
  }
  .top-bar { position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg, #FF6B35, #FF416C); }
  .left-col {
    flex: 0 0 42%; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 60px 48px 60px 60px; position: relative; z-index: 2;
    border-right: 1px solid rgba(255,255,255,0.06);
  }
  .badge {
    background: rgba(255,107,53,0.15); color: #FF6B35;
    font-size: 24px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase;
    padding: 12px 36px; border-radius: 999px;
    border: 1px solid rgba(255,107,53,0.3); margin-bottom: 28px;
  }
  .emoji { font-size: 72px; margin-bottom: 20px; }
  .question-text { font-size: 52px; font-weight: 900; color: #fff; text-align: center; line-height: 1.3; }
  .right-col {
    flex: 1; display: grid;
    grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr;
    gap: 24px; padding: 60px; position: relative; z-index: 2;
  }
  .explanation { position: absolute; bottom: 16px; left: 5%; right: 5%; z-index: 2; text-align: center; font-size: 24px; color: rgba(255,255,255,0.4); font-style: italic; }
</style></head><body>
  <div class="grid-bg"></div>
  <div class="top-bar"></div>
  <div class="left-col">
    <div class="badge">Question ${idx + 1}/${total}</div>
    ${emoji ? `<div class="emoji">${escHtml(emoji)}</div>` : ""}
    <div class="question-text">${escHtml(question)}</div>
    ${revealed ? '<div style="margin-top:24px;font-size:26px;color:#00C49A;font-weight:700;">✓ Answer revealed</div>' : ""}
  </div>
  <div class="right-col">${optionsHtml}</div>
  ${revealed && explanation ? `<div class="explanation">${escHtml(explanation)}</div>` : ""}
</body></html>`;
}

function renderWYRSlide(optionA: string, optionB: string, idx: number, total: number): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1080px; height: 1920px; overflow: hidden;
    background: #0A0A0F;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    position: relative;
  }
  .bg-glow {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at 20% 50%, rgba(255,65,108,0.08), transparent 60%),
                radial-gradient(ellipse at 80% 50%, rgba(71,118,230,0.08), transparent 60%);
  }
  .counter {
    position: absolute; top: 80px; left: 0; right: 0;
    display: flex; justify-content: center;
    font-size: 28px; font-weight: 700; letter-spacing: 4px;
    text-transform: uppercase; color: rgba(255,255,255,0.6);
  }
  .header {
    position: absolute; top: 155px; left: 0; right: 0;
    text-align: center; font-size: 48px; font-weight: 900;
    letter-spacing: 8px; text-transform: uppercase; color: rgba(255,255,255,0.9);
  }
  .panels {
    position: absolute; top: 280px; bottom: 280px;
    left: 60px; right: 60px;
    display: flex; flex-direction: column; gap: 40px;
  }
  .panel {
    flex: 1; border-radius: 28px;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 60px 80px; position: relative; overflow: hidden;
  }
  .panel-a {
    background: linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%);
    box-shadow: 0 20px 80px rgba(255,65,108,0.4);
  }
  .panel-b {
    background: linear-gradient(135deg, #4776E6 0%, #8E54E9 100%);
    box-shadow: 0 20px 80px rgba(71,118,230,0.4);
  }
  .label {
    font-size: 28px; font-weight: 800; letter-spacing: 6px;
    text-transform: uppercase; color: rgba(255,255,255,0.65);
    margin-bottom: 20px;
  }
  .option-text {
    font-size: 60px; font-weight: 900; color: #fff;
    text-align: center; line-height: 1.2;
    text-shadow: 0 4px 20px rgba(0,0,0,0.25);
  }
  .or-badge {
    display: flex; align-items: center; justify-content: center;
    height: 90px; flex-shrink: 0;
  }
  .or-inner {
    width: 90px; height: 90px; border-radius: 50%;
    background: #fff; color: #0A0A0F;
    font-weight: 900; font-size: 28px;
    display: flex; align-items: center; justify-content: center;
    letter-spacing: 1px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  }
  .cta {
    position: absolute; bottom: 90px; left: 0; right: 0;
    text-align: center; font-size: 36px; color: rgba(255,255,255,0.45);
  }
</style></head><body>
  <div class="bg-glow"></div>
  <div class="counter">${idx + 1} / ${total}</div>
  <div class="header">Would You Rather</div>
  <div class="panels">
    <div class="panel panel-a">
      <div class="label">A</div>
      <div class="option-text">${escHtml(optionA)}</div>
    </div>
    <div class="or-badge"><div class="or-inner">OR</div></div>
    <div class="panel panel-b">
      <div class="label">B</div>
      <div class="option-text">${escHtml(optionB)}</div>
    </div>
  </div>
  <div class="cta">💬 Comment A or B below!</div>
</body></html>`;
}

function renderQuizSlide(question: string, options: string[], correctIndex: number, explanation: string | undefined, idx: number, total: number, revealed: boolean): string {
  const COLORS = ["#FF6B35", "#4776E6", "#00C49A", "#FF416C"];
  const LABELS = ["A", "B", "C", "D"];
  const optionsHtml = options.map((opt, i) => {
    const isCorrect = i === correctIndex;
    const bg = revealed ? (isCorrect ? "rgba(0,196,154,0.18)" : "rgba(255,255,255,0.03)") : "rgba(255,255,255,0.07)";
    const border = revealed ? (isCorrect ? "#00C49A" : "rgba(255,255,255,0.08)") : "rgba(255,255,255,0.12)";
    const textColor = revealed ? (isCorrect ? "#00C49A" : "rgba(255,255,255,0.3)") : "#fff";
    const badgeBg = revealed ? (isCorrect ? "#00C49A" : "rgba(255,255,255,0.1)") : COLORS[i];
    const badgeColor = revealed && !isCorrect ? "rgba(255,255,255,0.3)" : "#fff";
    return `<div style="display:flex;align-items:center;padding:0 50px;background:${bg};border:2px solid ${border};border-radius:20px;flex:1;">
      <div style="width:60px;height:60px;border-radius:50%;background:${badgeBg};display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:${badgeColor};flex-shrink:0;margin-right:40px;">${LABELS[i]}</div>
      <div style="font-size:44px;font-weight:700;color:${textColor};line-height:1.2;flex:1;">${escHtml(opt)}</div>
      ${revealed && isCorrect ? '<div style="font-size:48px;margin-left:20px;">✓</div>' : ''}
    </div>`;
  }).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1080px; height: 1920px; overflow: hidden;
    background: #080B14; position: relative;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  }
  .grid-bg {
    position: absolute; inset: 0;
    background-image: linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
    background-size: 60px 60px;
  }
  .top-bar { position: absolute; top: 0; left: 0; right: 0; height: 6px; background: linear-gradient(90deg, #FF6B35, #FF416C); }
  .badge {
    position: absolute; top: 60px; left: 0; right: 0;
    display: flex; justify-content: center;
  }
  .badge-inner {
    background: rgba(255,107,53,0.15); color: #FF6B35;
    font-size: 30px; font-weight: 800; letter-spacing: 4px;
    text-transform: uppercase; padding: 14px 48px;
    border-radius: 999px; border: 2px solid rgba(255,107,53,0.3);
  }
  .question {
    position: absolute; top: 200px; left: 60px; right: 60px; height: 400px;
    display: flex; align-items: center; justify-content: center;
  }
  .question-text {
    font-size: 68px; font-weight: 900; color: #fff;
    text-align: center; line-height: 1.25;
  }
  .options {
    position: absolute; top: 640px; bottom: 100px;
    left: 60px; right: 60px;
    display: flex; flex-direction: column; gap: 28px;
  }
  .explanation {
    position: absolute; bottom: 30px; left: 60px; right: 60px;
    text-align: center; font-size: 30px; color: rgba(255,255,255,0.4);
    font-style: italic;
  }
</style></head><body>
  <div class="grid-bg"></div>
  <div class="top-bar"></div>
  <div class="badge"><div class="badge-inner">Question ${idx + 1}/${total}</div></div>
  <div class="question"><div class="question-text">${escHtml(question)}</div></div>
  <div class="options">${optionsHtml}</div>
  ${revealed && explanation ? `<div class="explanation">${escHtml(explanation)}</div>` : ""}
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
      type?: string;
      topic?: string;
      slideDuration?: number;
      aspectRatio?: string;
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

    // Build voiceover script
    const scriptLines = rounds.map((r, i) => {
      if (type === "would-you-rather") {
        return `Round ${i + 1}. Would you rather: ${r.optionA ?? ""}... or ${r.optionB ?? ""}? Comment A or B below!`;
      } else {
        const optLabels = ["A", "B", "C", "D"];
        const optText = (r.options ?? []).map((o, oi) => `${optLabels[oi]}: ${o}`).join(", ");
        return `Question ${i + 1}: ${r.question ?? ""}. Options: ${optText}.`;
      }
    }).join(" ");

    // Generate voiceover
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}`, {
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

      for (let i = 0; i < rounds.length; i++) {
        const r = rounds[i]!;
        const html = is16x9
          ? (type === "would-you-rather"
            ? renderWYRSlide16x9(r.optionA ?? "", r.optionB ?? "", (r as {emojiA?: string}).emojiA ?? "", (r as {emojiB?: string}).emojiB ?? "", i, rounds.length)
            : renderQuizSlide16x9(r.question ?? "", r.options ?? [], r.correctIndex ?? 0, r.explanation, (r as {emoji?: string}).emoji, i, rounds.length, false))
          : (type === "would-you-rather"
            ? renderWYRSlide(r.optionA ?? "", r.optionB ?? "", i, rounds.length)
            : renderQuizSlide(r.question ?? "", r.options ?? [], r.correctIndex ?? 0, r.explanation, i, rounds.length, false));

        const page = await browser.newPage();
        await page.setViewport({ width: vpWidth, height: vpHeight, deviceScaleFactor: 1 });
        await page.setContent(html, { waitUntil: "networkidle0" });
        const imgPath = join(workDir, `slide_${i}.png`);
        await page.screenshot({ path: imgPath as `${string}.png`, type: "png" });
        await page.close();

        compileScenes.push({ duration: slideDuration, image_url: null, video_url: null, localImagePath: imgPath });

        // For quiz: also render revealed version at half duration
        if (type === "quiz") {
          const revealedHtml = is16x9
            ? renderQuizSlide16x9(r.question ?? "", r.options ?? [], r.correctIndex ?? 0, r.explanation, (r as {emoji?: string}).emoji, i, rounds.length, true)
            : renderQuizSlide(r.question ?? "", r.options ?? [], r.correctIndex ?? 0, r.explanation, i, rounds.length, true);
          const revealedPage = await browser.newPage();
          await revealedPage.setViewport({ width: vpWidth, height: vpHeight, deviceScaleFactor: 1 });
          await revealedPage.setContent(revealedHtml, { waitUntil: "networkidle0" });
          const revealedPath = join(workDir, `slide_${i}_revealed.png`);
          await revealedPage.screenshot({ path: revealedPath as `${string}.png`, type: "png" });
          await revealedPage.close();
          compileScenes[compileScenes.length - 1] = { duration: Math.round(slideDuration / 2), image_url: null, video_url: null, localImagePath: imgPath };
          compileScenes.push({ duration: Math.round(slideDuration / 2), image_url: null, video_url: null, localImagePath: revealedPath });
        }
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
