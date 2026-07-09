/**
 * Puppeteer HTML for viral MP4 export — colors come from {@link ViralVisualThemeTokens} so export matches preview.
 */
import type { ViralVisualThemeTokens } from "@/lib/viral-visual-themes";

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const GRID_BG = `linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)`;

export function renderWYRSlide16x9(
  t: ViralVisualThemeTokens,
  optionA: string,
  optionB: string,
  emojiA: string,
  emojiB: string,
  idx: number,
  total: number
): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1920px; height: 1080px; overflow: hidden;
    background: ${t.wyrBg};
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    display: flex; flex-direction: column; position: relative;
  }
  .bg-glow {
    position: absolute; inset: 0;
    background: ${t.wyrGlowStrong};
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
    background: ${t.wyrPanelA};
    border-radius: 24px 0 0 24px;
    box-shadow: ${t.wyrShadowA};
  }
  .panel-b {
    background: ${t.wyrPanelB};
    border-radius: 0 24px 24px 0;
    box-shadow: ${t.wyrShadowB};
  }
  .or-wrap {
    display: flex; align-items: center; justify-content: center;
    width: 90px; flex-shrink: 0; z-index: 3;
  }
  .or-inner {
    width: 72px; height: 72px; border-radius: 50%;
    background: #fff; color: ${t.wyrOrColor};
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

export function renderQuizSlide16x9(
  t: ViralVisualThemeTokens,
  question: string,
  options: string[],
  correctIndex: number,
  explanation: string | undefined,
  emoji: string | undefined,
  idx: number,
  total: number,
  revealed: boolean
): string {
  const COLORS = t.optColors;
  const LABELS = ["A", "B", "C", "D"];
  const optionsHtml = options.map((opt, i) => {
    const isCorrect = i === correctIndex;
    const bg = revealed ? (isCorrect ? t.correctBg : "rgba(255,255,255,0.03)") : "rgba(255,255,255,0.05)";
    const border = revealed ? (isCorrect ? t.correctBorder : "rgba(255,255,255,0.07)") : "rgba(255,255,255,0.1)";
    const textColor = revealed ? (isCorrect ? t.correctText : "rgba(255,255,255,0.3)") : "#fff";
    const badgeBg = revealed ? (isCorrect ? t.correctBorder : "rgba(255,255,255,0.08)") : COLORS[i];
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
    background: ${t.quizBg}; display: flex; flex-direction: row;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    position: relative;
  }
  .grid-bg {
    position: absolute; inset: 0;
    background-image: ${GRID_BG};
    background-size: 60px 60px;
  }
  .top-bar { position: absolute; top: 0; left: 0; right: 0; height: 5px; background: ${t.quizTopBar}; }
  .left-col {
    flex: 0 0 42%; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 60px 48px 60px 60px; position: relative; z-index: 2;
    border-right: 1px solid rgba(255,255,255,0.06);
  }
  .badge {
    background: ${t.quizBadgeBg}; color: ${t.quizBadgeColor};
    font-size: 24px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase;
    padding: 12px 36px; border-radius: 999px;
    border: 1px solid ${t.quizBadgeBorder}; margin-bottom: 28px;
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
    ${revealed ? `<div style="margin-top:24px;font-size:26px;color:${t.correctText};font-weight:700;">✓ Answer revealed</div>` : ""}
  </div>
  <div class="right-col">${optionsHtml}</div>
  ${revealed && explanation ? `<div class="explanation">${escHtml(explanation)}</div>` : ""}
</body></html>`;
}

export function renderWYRSlide(t: ViralVisualThemeTokens, optionA: string, optionB: string, idx: number, total: number): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1080px; height: 1920px; overflow: hidden;
    background: ${t.wyrBg};
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    position: relative;
  }
  .bg-glow {
    position: absolute; inset: 0;
    background: ${t.wyrGlow};
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
    background: ${t.wyrPanelA};
    box-shadow: ${t.wyrShadowA};
  }
  .panel-b {
    background: ${t.wyrPanelB};
    box-shadow: ${t.wyrShadowB};
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
    background: #fff; color: ${t.wyrOrColor};
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

export function renderQuizSlide(
  t: ViralVisualThemeTokens,
  question: string,
  options: string[],
  correctIndex: number,
  explanation: string | undefined,
  idx: number,
  total: number,
  revealed: boolean
): string {
  const COLORS = t.optColors;
  const LABELS = ["A", "B", "C", "D"];
  const optionsHtml = options.map((opt, i) => {
    const isCorrect = i === correctIndex;
    const bg = revealed ? (isCorrect ? t.correctBgStrong : "rgba(255,255,255,0.03)") : "rgba(255,255,255,0.07)";
    const border = revealed ? (isCorrect ? t.correctBorder : "rgba(255,255,255,0.08)") : "rgba(255,255,255,0.12)";
    const textColor = revealed ? (isCorrect ? t.correctText : "rgba(255,255,255,0.3)") : "#fff";
    const badgeBg = revealed ? (isCorrect ? t.correctBorder : "rgba(255,255,255,0.1)") : COLORS[i];
    const badgeColor = revealed && !isCorrect ? "rgba(255,255,255,0.3)" : "#fff";
    return `<div style="display:flex;align-items:center;padding:0 50px;background:${bg};border:2px solid ${border};border-radius:20px;flex:1;">
      <div style="width:60px;height:60px;border-radius:50%;background:${badgeBg};display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:${badgeColor};flex-shrink:0;margin-right:40px;">${LABELS[i]}</div>
      <div style="font-size:44px;font-weight:700;color:${textColor};line-height:1.2;flex:1;">${escHtml(opt)}</div>
      ${revealed && isCorrect ? '<div style="font-size:48px;margin-left:20px;">✓</div>' : ""}
    </div>`;
  }).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1080px; height: 1920px; overflow: hidden;
    background: ${t.quizBg}; position: relative;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  }
  .grid-bg {
    position: absolute; inset: 0;
    background-image: ${GRID_BG};
    background-size: 60px 60px;
  }
  .top-bar { position: absolute; top: 0; left: 0; right: 0; height: 6px; background: ${t.quizTopBar}; }
  .badge {
    position: absolute; top: 60px; left: 0; right: 0;
    display: flex; justify-content: center;
  }
  .badge-inner {
    background: ${t.quizBadgeBg}; color: ${t.quizBadgeColor};
    font-size: 30px; font-weight: 800; letter-spacing: 4px;
    text-transform: uppercase; padding: 14px 48px;
    border-radius: 999px; border: 2px solid ${t.quizBadgeBorder};
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

export function renderIntroSlide16x9(t: ViralVisualThemeTokens, topic: string, isQuiz: boolean, roundCount: number): string {
  const label = isQuiz ? "TRIVIA QUIZ" : "WOULD YOU RATHER";
  const sub = isQuiz
    ? `${roundCount} question${roundCount === 1 ? "" : "s"} — how many can you get?`
    : `${roundCount} tough choice${roundCount === 1 ? "" : "s"} — pick your side`;
  const tp = topic.trim() || "Your topic";
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1920px; height: 1080px; overflow: hidden;
    background: ${t.quizBg};
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    position: relative;
  }
  .grid-bg {
    position: absolute; inset: 0;
    background-image: ${GRID_BG};
    background-size: 60px 60px;
  }
  .glow {
    position: absolute; inset: 0;
    background: ${t.introGlow};
    pointer-events: none;
  }
  .top-bar { position: absolute; top: 0; left: 0; right: 0; height: 5px; background: ${t.quizTopBar}; }
  .badge-wrap { position: absolute; top: 10%; left: 0; right: 0; display: flex; justify-content: center; z-index: 2; }
  .badge {
    background: ${t.introBadgeBg}; color: ${t.introBadgeColor};
    font-size: 26px; font-weight: 800; letter-spacing: 10px; text-transform: uppercase;
    padding: 14px 40px; border-radius: 999px; border: 1px solid ${t.introBadgeBorder};
  }
  .center {
    position: absolute; top: 22%; bottom: 16%; left: 8%; right: 8%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; z-index: 2;
  }
  h1 { color: #fff; font-size: 76px; font-weight: 900; line-height: 1.12; margin-bottom: 28px; text-shadow: 0 4px 40px rgba(0,0,0,0.45); }
  .sub { color: rgba(255,255,255,0.72); font-size: 34px; font-weight: 600; line-height: 1.35; max-width: 92%; }
  .go { color: rgba(255,255,255,0.38); font-size: 24px; font-weight: 700; margin-top: 36px; letter-spacing: 8px; text-transform: uppercase; }
</style></head><body>
  <div class="grid-bg"></div>
  <div class="glow"></div>
  <div class="top-bar"></div>
  <div class="badge-wrap"><div class="badge">${escHtml(label)}</div></div>
  <div class="center">
    <h1>${escHtml(tp)}</h1>
    <p class="sub">${escHtml(sub)}</p>
    <p class="go">Let&apos;s go →</p>
  </div>
</body></html>`;
}

export function renderIntroSlide(t: ViralVisualThemeTokens, topic: string, isQuiz: boolean, roundCount: number): string {
  const label = isQuiz ? "TRIVIA QUIZ" : "WOULD YOU RATHER";
  const sub = isQuiz
    ? `${roundCount} question${roundCount === 1 ? "" : "s"} — how many can you get?`
    : `${roundCount} tough choice${roundCount === 1 ? "" : "s"} — pick your side`;
  const tp = topic.trim() || "Your topic";
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1080px; height: 1920px; overflow: hidden;
    background: ${t.quizBg};
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    position: relative;
  }
  .grid-bg {
    position: absolute; inset: 0;
    background-image: ${GRID_BG};
    background-size: 60px 60px;
  }
  .glow {
    position: absolute; inset: 0;
    background: ${t.introGlow};
    pointer-events: none;
  }
  .top-bar { position: absolute; top: 0; left: 0; right: 0; height: 6px; background: ${t.quizTopBar}; }
  .badge-wrap { position: absolute; top: 9%; left: 0; right: 0; display: flex; justify-content: center; z-index: 2; }
  .badge {
    background: ${t.introBadgeBg}; color: ${t.introBadgeColor};
    font-size: 28px; font-weight: 800; letter-spacing: 8px; text-transform: uppercase;
    padding: 16px 44px; border-radius: 999px; border: 1px solid ${t.introBadgeBorder};
  }
  .center {
    position: absolute; top: 24%; bottom: 18%; left: 7%; right: 7%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; z-index: 2;
  }
  h1 { color: #fff; font-size: 84px; font-weight: 900; line-height: 1.12; margin-bottom: 36px; text-shadow: 0 4px 40px rgba(0,0,0,0.45); }
  .sub { color: rgba(255,255,255,0.72); font-size: 38px; font-weight: 600; line-height: 1.35; max-width: 94%; }
  .go { color: rgba(255,255,255,0.38); font-size: 26px; font-weight: 700; margin-top: 44px; letter-spacing: 6px; text-transform: uppercase; }
</style></head><body>
  <div class="grid-bg"></div>
  <div class="glow"></div>
  <div class="top-bar"></div>
  <div class="badge-wrap"><div class="badge">${escHtml(label)}</div></div>
  <div class="center">
    <h1>${escHtml(tp)}</h1>
    <p class="sub">${escHtml(sub)}</p>
    <p class="go">Let&apos;s go →</p>
  </div>
</body></html>`;
}

export function renderOutroSlide16x9(t: ViralVisualThemeTokens, topic: string, isQuiz: boolean): string {
  const tp = topic.trim();
  const comment = isQuiz ? "Drop your score in the comments" : "Tell us what you’d pick in the comments";
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1920px; height: 1080px; overflow: hidden;
    background: ${t.quizBg};
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    position: relative;
  }
  .grid-bg {
    position: absolute; inset: 0;
    background-image: ${GRID_BG};
    background-size: 60px 60px;
  }
  .glow {
    position: absolute; inset: 0;
    background: ${t.outroGlow};
    pointer-events: none;
  }
  .top-bar { position: absolute; top: 0; left: 0; right: 0; height: 5px; background: ${t.quizTopBar}; }
  .badge-wrap { position: absolute; top: 8%; left: 0; right: 0; display: flex; justify-content: center; z-index: 2; }
  .badge {
    background: ${t.outroBadgeBg}; color: ${t.outroBadgeColor};
    font-size: 26px; font-weight: 800; letter-spacing: 8px; text-transform: uppercase;
    padding: 14px 36px; border-radius: 999px; border: 1px solid ${t.outroBadgeBorder};
  }
  .center {
    position: absolute; top: 20%; bottom: 12%; left: 8%; right: 8%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; z-index: 2;
  }
  h2 { color: #fff; font-size: 72px; font-weight: 900; line-height: 1.15; margin-bottom: 20px; }
  .topic { color: rgba(255,255,255,0.52); font-size: 30px; font-weight: 500; margin-bottom: 28px; }
  .line { color: rgba(255,255,255,0.9); font-size: 38px; font-weight: 600; line-height: 1.4; }
  .sub { color: rgba(255,255,255,0.42); font-size: 28px; font-weight: 500; margin-top: 28px; }
</style></head><body>
  <div class="grid-bg"></div>
  <div class="glow"></div>
  <div class="top-bar"></div>
  <div class="badge-wrap"><div class="badge">OUTRO</div></div>
  <div class="center">
    <h2>Thanks for playing!</h2>
    ${tp ? `<p class="topic">${escHtml(tp)}</p>` : ""}
    <p class="line">👍 Like · 🔁 Share · 🔔 Follow for more</p>
    <p class="sub">${escHtml(comment)}</p>
  </div>
</body></html>`;
}

export function renderOutroSlide(t: ViralVisualThemeTokens, topic: string, isQuiz: boolean): string {
  const tp = topic.trim();
  const comment = isQuiz ? "Drop your score in the comments" : "Tell us what you’d pick in the comments";
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1080px; height: 1920px; overflow: hidden;
    background: ${t.quizBg};
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    position: relative;
  }
  .grid-bg {
    position: absolute; inset: 0;
    background-image: ${GRID_BG};
    background-size: 60px 60px;
  }
  .glow {
    position: absolute; inset: 0;
    background: ${t.outroGlow};
    pointer-events: none;
  }
  .top-bar { position: absolute; top: 0; left: 0; right: 0; height: 6px; background: ${t.quizTopBar}; }
  .badge-wrap { position: absolute; top: 7%; left: 0; right: 0; display: flex; justify-content: center; z-index: 2; }
  .badge {
    background: ${t.outroBadgeBg}; color: ${t.outroBadgeColor};
    font-size: 28px; font-weight: 800; letter-spacing: 6px; text-transform: uppercase;
    padding: 16px 40px; border-radius: 999px; border: 1px solid ${t.outroBadgeBorder};
  }
  .center {
    position: absolute; top: 22%; bottom: 14%; left: 7%; right: 7%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; z-index: 2;
  }
  h2 { color: #fff; font-size: 80px; font-weight: 900; line-height: 1.15; margin-bottom: 24px; }
  .topic { color: rgba(255,255,255,0.52); font-size: 34px; font-weight: 500; margin-bottom: 32px; }
  .line { color: rgba(255,255,255,0.9); font-size: 42px; font-weight: 600; line-height: 1.45; }
  .sub { color: rgba(255,255,255,0.42); font-size: 30px; font-weight: 500; margin-top: 36px; }
</style></head><body>
  <div class="grid-bg"></div>
  <div class="glow"></div>
  <div class="top-bar"></div>
  <div class="badge-wrap"><div class="badge">OUTRO</div></div>
  <div class="center">
    <h2>Thanks for playing!</h2>
    ${tp ? `<p class="topic">${escHtml(tp)}</p>` : ""}
    <p class="line">👍 Like · 🔁 Share · 🔔 Follow for more</p>
    <p class="sub">${escHtml(comment)}</p>
  </div>
</body></html>`;
}

export function renderCTASlide16x9(t: ViralVisualThemeTokens, variant: "mid" | "end"): string {
  const badge = variant === "mid" ? "Keep watching" : "Thanks for watching";
  const extra = variant === "end" ? `<p class="sub">Comment your score below</p>` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1920px; height: 1080px; overflow: hidden;
    background: ${t.quizBg};
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    position: relative;
  }
  .grid-bg {
    position: absolute; inset: 0;
    background-image: ${GRID_BG};
    background-size: 60px 60px;
  }
  .top-bar { position: absolute; top: 0; left: 0; right: 0; height: 5px; background: ${t.quizTopBar}; }
  .badge-wrap { position: absolute; top: 8%; left: 0; right: 0; display: flex; justify-content: center; z-index: 2; }
  .badge {
    background: ${t.ctaBadgeBg}; color: ${t.ctaBadgeColor};
    font-size: 28px; font-weight: 800; letter-spacing: 6px; text-transform: uppercase;
    padding: 14px 40px; border-radius: 999px; border: 2px solid ${t.ctaBadgeBorder};
  }
  .center {
    position: absolute; top: 22%; bottom: 12%; left: 8%; right: 8%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; z-index: 2;
  }
  h2 { color: #fff; font-size: 72px; font-weight: 900; line-height: 1.15; margin-bottom: 36px; }
  .line { color: rgba(255,255,255,0.9); font-size: 40px; font-weight: 600; line-height: 1.4; }
  .sub { color: rgba(255,255,255,0.45); font-size: 30px; font-weight: 500; margin-top: 28px; }
</style></head><body>
  <div class="grid-bg"></div>
  <div class="top-bar"></div>
  <div class="badge-wrap"><div class="badge">${escHtml(badge)}</div></div>
  <div class="center">
    <h2>Enjoyed this?</h2>
    <p class="line">👍 Like | 🔁 Share | 🔔 Follow for more</p>
    ${extra}
  </div>
</body></html>`;
}

export function renderCTASlide(t: ViralVisualThemeTokens, variant: "mid" | "end"): string {
  const badge = variant === "mid" ? "Keep watching" : "Thanks for watching";
  const extra = variant === "end" ? `<p class="sub">Comment your score below</p>` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1080px; height: 1920px; overflow: hidden;
    background: ${t.quizBg};
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    position: relative;
  }
  .grid-bg {
    position: absolute; inset: 0;
    background-image: ${GRID_BG};
    background-size: 60px 60px;
  }
  .top-bar { position: absolute; top: 0; left: 0; right: 0; height: 6px; background: ${t.quizTopBar}; }
  .badge-wrap { position: absolute; top: 7%; left: 0; right: 0; display: flex; justify-content: center; z-index: 2; }
  .badge {
    background: ${t.ctaBadgeBg}; color: ${t.ctaBadgeColor};
    font-size: 30px; font-weight: 800; letter-spacing: 4px; text-transform: uppercase;
    padding: 14px 48px; border-radius: 999px; border: 2px solid ${t.ctaBadgeBorder};
  }
  .center {
    position: absolute; top: 26%; bottom: 16%; left: 8%; right: 8%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; z-index: 2;
  }
  h2 { color: #fff; font-size: 80px; font-weight: 900; line-height: 1.2; margin-bottom: 48px; }
  .line { color: rgba(255,255,255,0.9); font-size: 44px; font-weight: 600; line-height: 1.45; }
  .sub { color: rgba(255,255,255,0.45); font-size: 32px; font-weight: 500; margin-top: 36px; }
</style></head><body>
  <div class="grid-bg"></div>
  <div class="top-bar"></div>
  <div class="badge-wrap"><div class="badge">${escHtml(badge)}</div></div>
  <div class="center">
    <h2>Enjoyed this?</h2>
    <p class="line">👍 Like | 🔁 Share | 🔔 Follow for more</p>
    ${extra}
  </div>
</body></html>`;
}
