"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { MutableRefObject } from "react";
import {
  buildViralTimeline,
  getCtaVoiceSnippet,
  getIntroVoiceSnippet,
  getOutroVoiceSnippet,
  timelineIndexForRound,
} from "@/lib/viral-cta-plan";
import { ViralCTASlide } from "@/components/templates/ViralCTASlide";
import { ViralIntroSlide, ViralOutroSlide } from "@/components/templates/ViralIntroOutroSlides";
import { BGM_MIX_VOLUME, BGM_TRACKS, type BgmSelectValue } from "@/lib/bgm-tracks";
import { resolveViralVisualTheme, type ViralVisualThemeId, type ViralVisualThemeTokens } from "@/lib/viral-visual-themes";

// ─── Shared types ─────────────────────────────────────────────────────────────

export type WouldYouRatherRound = {
  optionA: string;
  optionB: string;
  emojiA?: string;
  emojiB?: string;
};

export type QuizRound = {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation?: string;
  emoji?: string;
};

export type ViralTemplateType = "would-you-rather" | "quiz";

export type ViralTemplateData =
  | { type: "would-you-rather"; topic: string; rounds: WouldYouRatherRound[]; visualTheme?: ViralVisualThemeId }
  | { type: "quiz"; topic: string; rounds: QuizRound[]; visualTheme?: ViralVisualThemeId };

export type ViralSettings = {
  slideDuration: number;   // seconds per slide
  aspectRatio: "9:16" | "16:9";
  showTimer: boolean;
  voiceover: boolean;
  /** Looped preview + export mix (same catalog as story / video compile). */
  backgroundMusic: BgmSelectValue;
};

export const VIRAL_SHORT_DURATION = 5;
export const VIRAL_LONG_DURATION = 10;

// ─── Circular countdown timer ─────────────────────────────────────────────────

function CountdownTimer({ total, remaining, size = 56 }: { total: number; remaining: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const progress = remaining / total;
  const dashOffset = circ * (1 - progress);
  const colour = progress > 0.5 ? "#00C49A" : progress > 0.25 ? "#FF6B35" : "#FF416C";

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.1)" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={colour} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={dashOffset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.25s linear, stroke 0.4s ease" }}
      />
      <text
        x={size / 2} y={size / 2}
        textAnchor="middle" dominantBaseline="central"
        fill="#fff" fontSize={size * 0.32} fontWeight={800}
        style={{ transform: `rotate(90deg)`, transformBox: "fill-box", transformOrigin: "center", fontFamily: "system-ui" }}
      >
        {Math.ceil(remaining)}
      </text>
    </svg>
  );
}

// ─── Would You Rather slide ───────────────────────────────────────────────────

function WYRSlide({ theme, round, index, total, timeLeft, totalTime, showTimer }: {
  theme: ViralVisualThemeTokens;
  round: WouldYouRatherRound; index: number; total: number;
  timeLeft: number; totalTime: number; showTimer: boolean;
}) {
  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "column",
      background: theme.wyrBg,
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      {/* Background glow */}
      <div style={{
        position: "absolute", inset: 0,
        background: theme.wyrGlow,
      }} />

      {/* Round counter + timer row */}
      <div style={{
        position: "absolute", top: "4%", left: 0, right: 0,
        display: "flex", justifyContent: "center", alignItems: "center",
        gap: "clamp(8px,2vw,16px)", zIndex: 2,
      }}>
        <span style={{
          background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)",
          fontSize: "clamp(10px,1.6vw,14px)", fontWeight: 600, letterSpacing: "0.15em",
          textTransform: "uppercase", padding: "0.35em 1em",
          borderRadius: "999px", border: "1px solid rgba(255,255,255,0.12)",
        }}>{index + 1} / {total}</span>
        {showTimer && <CountdownTimer total={totalTime} remaining={timeLeft} size={46} />}
      </div>

      {/* Header */}
      <div style={{
        position: "absolute", top: "10.5%", left: 0, right: 0,
        display: "flex", justifyContent: "center", zIndex: 2,
      }}>
        <p style={{
          color: "rgba(255,255,255,0.9)", fontSize: "clamp(12px,1.8vw,18px)",
          fontWeight: 800, letterSpacing: "0.25em", textTransform: "uppercase", margin: 0,
        }}>Would You Rather</p>
      </div>

      {/* Split panels */}
      <div style={{
        position: "absolute", top: "17%", bottom: "14%", left: "4%", right: "4%",
        display: "flex", flexDirection: "column", gap: "3%", zIndex: 2,
      }}>
        {/* Option A */}
        <div style={{
          flex: 1, background: theme.wyrPanelA,
          borderRadius: "clamp(10px,1.6vw,18px)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "5% 8%", boxShadow: theme.wyrShadowA,
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: "-20%", right: "-10%", width: "50%", height: "140%", background: "rgba(255,255,255,0.06)", borderRadius: "50%" }} />
          {round.emojiA && <span style={{ fontSize: "clamp(24px,4vw,48px)", marginBottom: "0.2em" }}>{round.emojiA}</span>}
          <span style={{ fontSize: "clamp(8px,1.2vw,12px)", fontWeight: 700, color: "rgba(255,255,255,0.65)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "0.4em" }}>A</span>
          <p style={{ fontSize: "clamp(13px,2vw,26px)", fontWeight: 800, color: "#fff", textAlign: "center", margin: 0, lineHeight: 1.25 }}>{round.optionA}</p>
        </div>

        {/* OR badge */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "9%", flexShrink: 0 }}>
          <div style={{
            background: "#fff", color: theme.wyrOrColor, fontWeight: 900,
            fontSize: "clamp(10px,1.5vw,15px)",
            width: "clamp(32px,4.5vw,48px)", height: "clamp(32px,4.5vw,48px)",
            borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            letterSpacing: "0.05em", boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}>OR</div>
        </div>

        {/* Option B */}
        <div style={{
          flex: 1, background: theme.wyrPanelB,
          borderRadius: "clamp(10px,1.6vw,18px)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "5% 8%", boxShadow: theme.wyrShadowB,
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", bottom: "-20%", left: "-10%", width: "50%", height: "140%", background: "rgba(255,255,255,0.06)", borderRadius: "50%" }} />
          {round.emojiB && <span style={{ fontSize: "clamp(24px,4vw,48px)", marginBottom: "0.2em" }}>{round.emojiB}</span>}
          <span style={{ fontSize: "clamp(8px,1.2vw,12px)", fontWeight: 700, color: "rgba(255,255,255,0.65)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "0.4em" }}>B</span>
          <p style={{ fontSize: "clamp(13px,2vw,26px)", fontWeight: 800, color: "#fff", textAlign: "center", margin: 0, lineHeight: 1.25 }}>{round.optionB}</p>
        </div>
      </div>

      {/* CTA */}
      <div style={{
        position: "absolute", bottom: "4%", left: 0, right: 0,
        display: "flex", justifyContent: "center", zIndex: 2,
      }}>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "clamp(9px,1.4vw,13px)", fontWeight: 500, margin: 0 }}>
          💬 Comment A or B below!
        </p>
      </div>
    </div>
  );
}

// ─── Quiz slide ───────────────────────────────────────────────────────────────

const OPTION_LABELS = ["A", "B", "C", "D"] as const;

function QuizSlide({ theme, round, index, total, revealed, timeLeft, totalTime, showTimer }: {
  theme: ViralVisualThemeTokens;
  round: QuizRound; index: number; total: number; revealed: boolean;
  timeLeft: number; totalTime: number; showTimer: boolean;
}) {
  const optColors = theme.optColors;
  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "column",
      background: theme.quizBg,
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: theme.quizTopBar, height: "0.4%", minHeight: 3 }} />

      {/* Top row: badge + timer */}
      <div style={{
        position: "absolute", top: "4%", left: 0, right: 0,
        display: "flex", justifyContent: "center", alignItems: "center",
        gap: "clamp(8px,2vw,16px)", zIndex: 2,
      }}>
        <span style={{
          background: theme.quizBadgeBg, color: theme.quizBadgeColor,
          fontSize: "clamp(9px,1.4vw,13px)", fontWeight: 700,
          letterSpacing: "0.12em", textTransform: "uppercase",
          padding: "0.35em 1em", borderRadius: "999px",
          border: `1px solid ${theme.quizBadgeBorder}`,
        }}>Q{index + 1}/{total}</span>
        {showTimer && !revealed && <CountdownTimer total={totalTime} remaining={timeLeft} size={46} />}
        {revealed && <span style={{ fontSize: "clamp(10px,1.5vw,14px)", color: theme.correctText, fontWeight: 700 }}>✓ Answer</span>}
      </div>

      {/* Emoji */}
      {round.emoji && (
        <div style={{ position: "absolute", top: "10%", left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 2 }}>
          <span style={{ fontSize: "clamp(28px,5vw,56px)" }}>{round.emoji}</span>
        </div>
      )}

      {/* Question */}
      <div style={{
        position: "absolute",
        top: round.emoji ? "18%" : "12%",
        left: "5%", right: "5%", height: "26%",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2,
      }}>
        <p style={{ color: "#fff", fontSize: "clamp(14px,2.2vw,30px)", fontWeight: 800, textAlign: "center", margin: 0, lineHeight: 1.3 }}>
          {round.question}
        </p>
      </div>

      {/* Options */}
      <div style={{
        position: "absolute", top: "46%", bottom: "7%", left: "5%", right: "5%",
        display: "flex", flexDirection: "column", gap: "3%", zIndex: 2,
      }}>
        {round.options.map((opt, i) => {
          const isCorrect = i === round.correctIndex;
          const color = optColors[i]!;
          const bgColor = revealed ? (isCorrect ? theme.correctBg : "rgba(255,255,255,0.03)") : "rgba(255,255,255,0.05)";
          const borderColor = revealed ? (isCorrect ? theme.correctBorder : "rgba(255,255,255,0.07)") : "rgba(255,255,255,0.1)";
          const textColor = revealed ? (isCorrect ? theme.correctText : "rgba(255,255,255,0.3)") : "#fff";
          return (
            <div key={i} style={{
              flex: 1, background: bgColor,
              border: `1px solid ${borderColor}`,
              borderRadius: "clamp(7px,1vw,12px)",
              display: "flex", alignItems: "center", padding: "0 5%",
              transition: "all 0.35s ease",
            }}>
              <div style={{
                width: "clamp(22px,3.2vw,34px)", height: "clamp(22px,3.2vw,34px)",
                borderRadius: "50%", flexShrink: 0, marginRight: "4%",
                background: revealed ? (isCorrect ? theme.correctBorder : "rgba(255,255,255,0.07)") : color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "clamp(8px,1.2vw,12px)", fontWeight: 800,
                color: revealed && !isCorrect ? "rgba(255,255,255,0.25)" : "#fff",
              }}>{OPTION_LABELS[i]}</div>
              <p style={{ color: textColor, fontSize: "clamp(11px,1.7vw,20px)", fontWeight: 600, margin: 0, lineHeight: 1.25, flex: 1 }}>{opt}</p>
              {revealed && isCorrect && <span style={{ fontSize: "clamp(13px,1.8vw,20px)", marginLeft: "2%" }}>✓</span>}
            </div>
          );
        })}
      </div>

      {revealed && round.explanation && (
        <div style={{ position: "absolute", bottom: "1%", left: "5%", right: "5%", zIndex: 2, textAlign: "center" }}>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "clamp(8px,1.2vw,13px)", margin: 0, fontStyle: "italic" }}>{round.explanation}</p>
        </div>
      )}
    </div>
  );
}

// ─── 16:9 Would You Rather slide ─────────────────────────────────────────────

function WYRSlide16x9({ theme, round, index, total, timeLeft, totalTime, showTimer }: {
  theme: ViralVisualThemeTokens;
  round: WouldYouRatherRound; index: number; total: number;
  timeLeft: number; totalTime: number; showTimer: boolean;
}) {
  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "column",
      background: theme.wyrBg,
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      {/* Background glow */}
      <div style={{
        position: "absolute", inset: 0,
        background: theme.wyrGlowStrong,
      }} />

      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "2.5% 4%", zIndex: 3,
      }}>
        <p style={{ color: "rgba(255,255,255,0.9)", fontSize: "clamp(10px,1.4vw,18px)", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", margin: 0 }}>
          Would You Rather
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "clamp(6px,1vw,12px)" }}>
          <span style={{
            background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)",
            fontSize: "clamp(9px,1.1vw,13px)", fontWeight: 600, letterSpacing: "0.12em",
            textTransform: "uppercase", padding: "0.3em 0.8em",
            borderRadius: "999px", border: "1px solid rgba(255,255,255,0.12)",
          }}>{index + 1} / {total}</span>
          {showTimer && <CountdownTimer total={totalTime} remaining={timeLeft} size={38} />}
        </div>
      </div>

      {/* Side-by-side panels */}
      <div style={{
        position: "absolute", top: "16%", bottom: "12%", left: "3%", right: "3%",
        display: "flex", flexDirection: "row", gap: 0, zIndex: 2,
      }}>
        {/* Option A */}
        <div style={{
          flex: 1, background: theme.wyrPanelA,
          borderRadius: "clamp(8px,1.2vw,16px) 0 0 clamp(8px,1.2vw,16px)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "4% 6%", boxShadow: theme.wyrShadowA,
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: "-30%", right: "-20%", width: "60%", height: "160%", background: "rgba(255,255,255,0.06)", borderRadius: "50%" }} />
          {round.emojiA && <span style={{ fontSize: "clamp(22px,3.5vw,48px)", marginBottom: "0.25em" }}>{round.emojiA}</span>}
          <span style={{ fontSize: "clamp(8px,1vw,11px)", fontWeight: 700, color: "rgba(255,255,255,0.65)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "0.35em" }}>A</span>
          <p style={{ fontSize: "clamp(12px,1.8vw,24px)", fontWeight: 800, color: "#fff", textAlign: "center", margin: 0, lineHeight: 1.3 }}>{round.optionA}</p>
        </div>

        {/* OR badge in center */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "clamp(40px,6vw,72px)", flexShrink: 0, zIndex: 3 }}>
          <div style={{
            background: "#fff", color: theme.wyrOrColor, fontWeight: 900,
            fontSize: "clamp(9px,1.2vw,14px)",
            width: "clamp(32px,4.5vw,52px)", height: "clamp(32px,4.5vw,52px)",
            borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            letterSpacing: "0.03em", boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          }}>OR</div>
        </div>

        {/* Option B */}
        <div style={{
          flex: 1, background: theme.wyrPanelB,
          borderRadius: "0 clamp(8px,1.2vw,16px) clamp(8px,1.2vw,16px) 0",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "4% 6%", boxShadow: theme.wyrShadowB,
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", bottom: "-30%", left: "-20%", width: "60%", height: "160%", background: "rgba(255,255,255,0.06)", borderRadius: "50%" }} />
          {round.emojiB && <span style={{ fontSize: "clamp(22px,3.5vw,48px)", marginBottom: "0.25em" }}>{round.emojiB}</span>}
          <span style={{ fontSize: "clamp(8px,1vw,11px)", fontWeight: 700, color: "rgba(255,255,255,0.65)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "0.35em" }}>B</span>
          <p style={{ fontSize: "clamp(12px,1.8vw,24px)", fontWeight: 800, color: "#fff", textAlign: "center", margin: 0, lineHeight: 1.3 }}>{round.optionB}</p>
        </div>
      </div>

      {/* CTA */}
      <div style={{ position: "absolute", bottom: "3%", left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 2 }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "clamp(8px,1.1vw,12px)", fontWeight: 500, margin: 0 }}>💬 Comment A or B below!</p>
      </div>
    </div>
  );
}

// ─── 16:9 Quiz slide ──────────────────────────────────────────────────────────

function QuizSlide16x9({ theme, round, index, total, revealed, timeLeft, totalTime, showTimer }: {
  theme: ViralVisualThemeTokens;
  round: QuizRound; index: number; total: number; revealed: boolean;
  timeLeft: number; totalTime: number; showTimer: boolean;
}) {
  const optColors = theme.optColors;
  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "row",
      background: theme.quizBg,
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: theme.quizTopBar, height: "0.5%", minHeight: 3 }} />

      {/* Left: question area */}
      <div style={{
        flex: "0 0 42%", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "5% 4% 5% 5%", position: "relative", zIndex: 2,
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{
          background: theme.quizBadgeBg, color: theme.quizBadgeColor,
          fontSize: "clamp(8px,1vw,12px)", fontWeight: 700,
          letterSpacing: "0.12em", textTransform: "uppercase",
          padding: "0.3em 0.9em", borderRadius: "999px",
          border: `1px solid ${theme.quizBadgeBorder}`, marginBottom: "1em",
        }}>Q{index + 1}/{total}</div>
        {round.emoji && <span style={{ fontSize: "clamp(24px,4vw,52px)", marginBottom: "0.3em" }}>{round.emoji}</span>}
        <p style={{ color: "#fff", fontSize: "clamp(12px,1.8vw,22px)", fontWeight: 800, textAlign: "center", margin: 0, lineHeight: 1.35 }}>{round.question}</p>
        {showTimer && !revealed && (
          <div style={{ marginTop: "1em" }}>
            <CountdownTimer total={totalTime} remaining={timeLeft} size={42} />
          </div>
        )}
        {revealed && <span style={{ marginTop: "0.8em", fontSize: "clamp(9px,1.2vw,14px)", color: theme.correctText, fontWeight: 700 }}>✓ Answer revealed</span>}
      </div>

      {/* Right: 2×2 options grid */}
      <div style={{
        flex: 1, display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: "2.5%", padding: "5%",
        position: "relative", zIndex: 2,
      }}>
        {round.options.map((opt, i) => {
          const isCorrect = i === round.correctIndex;
          const color = optColors[i]!;
          const bgColor = revealed ? (isCorrect ? theme.correctBg : "rgba(255,255,255,0.03)") : "rgba(255,255,255,0.05)";
          const borderColor = revealed ? (isCorrect ? theme.correctBorder : "rgba(255,255,255,0.07)") : "rgba(255,255,255,0.1)";
          const textColor = revealed ? (isCorrect ? theme.correctText : "rgba(255,255,255,0.3)") : "#fff";
          return (
            <div key={i} style={{
              background: bgColor, border: `1px solid ${borderColor}`,
              borderRadius: "clamp(6px,0.8vw,10px)",
              display: "flex", alignItems: "center",
              padding: "0 5%", transition: "all 0.35s ease",
            }}>
              <div style={{
                width: "clamp(20px,2.8vw,32px)", height: "clamp(20px,2.8vw,32px)",
                borderRadius: "50%", flexShrink: 0, marginRight: "6%",
                background: revealed ? (isCorrect ? theme.correctBorder : "rgba(255,255,255,0.07)") : color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "clamp(7px,0.9vw,11px)", fontWeight: 800,
                color: revealed && !isCorrect ? "rgba(255,255,255,0.25)" : "#fff",
              }}>{OPTION_LABELS[i]}</div>
              <p style={{ color: textColor, fontSize: "clamp(9px,1.3vw,16px)", fontWeight: 600, margin: 0, lineHeight: 1.25, flex: 1 }}>{opt}</p>
              {revealed && isCorrect && <span style={{ fontSize: "clamp(11px,1.5vw,18px)", marginLeft: "4%" }}>✓</span>}
            </div>
          );
        })}
      </div>

      {revealed && round.explanation && (
        <div style={{ position: "absolute", bottom: "1.5%", left: "5%", right: "5%", zIndex: 2, textAlign: "center" }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "clamp(7px,1vw,12px)", margin: 0, fontStyle: "italic" }}>{round.explanation}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main preview player ──────────────────────────────────────────────────────

const REVEAL_FRAC = 0.5; // quiz: reveal answer at this fraction of slide duration

function speakText(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05;
  u.pitch = 1;
  window.speechSynthesis.speak(u);
}

/** Soft beep each time the on-screen countdown drops a second (Web Audio, no asset files). */
function playViralTimerTick(audioCtxRef: MutableRefObject<AudioContext | null>, secondsRemaining: number) {
  if (typeof window === "undefined") return;
  if (typeof document !== "undefined" && document.hidden) return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AC();
    }
    const ctx = audioCtxRef.current;
    void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const urgent = secondsRemaining <= 3;
    osc.frequency.value = urgent ? 1040 : 720;
    osc.type = "sine";
    const vol = urgent ? 0.11 : 0.075;
    const t0 = ctx.currentTime;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + (urgent ? 0.1 : 0.065));
    osc.start(t0);
    osc.stop(t0 + 0.11);
  } catch {
    /* ignore — autoplay or unsupported */
  }
}

export function ViralTemplatePreview({
  data,
  settings,
}: {
  data: ViralTemplateData;
  settings: ViralSettings;
}) {
  const [slideIdx, setSlideIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(settings.slideDuration);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slideIdxRef = useRef(0);
  const timerAudioCtxRef = useRef<AudioContext | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  /** Last whole-second value shown on the circular timer (for tick sounds). */
  const timerSecondRef = useRef<number | null>(null);

  const rounds = data.rounds as (WouldYouRatherRound | QuizRound)[];
  const totalRounds = rounds.length;
  const visualTheme = useMemo(
    () => resolveViralVisualTheme(data.visualTheme),
    [data.visualTheme]
  );
  const timeline = useMemo(() => buildViralTimeline(totalRounds, 4), [totalRounds]);
  const totalSlides = timeline.length;

  useEffect(() => {
    setSlideIdx((s) => Math.min(s, Math.max(0, totalSlides - 1)));
  }, [totalSlides]);

  useEffect(() => {
    slideIdxRef.current = slideIdx;
  }, [slideIdx]);

  useEffect(() => {
    timerSecondRef.current = null;
  }, [slideIdx]);

  // Countdown tick sound when the displayed second drops (timer visible + playing only).
  useEffect(() => {
    if (!playing || !settings.showTimer) {
      timerSecondRef.current = null;
      return;
    }
    const item = timeline[slideIdx];
    const countdownVisible =
      item?.kind === "round" &&
      (data.type === "would-you-rather" || (data.type === "quiz" && !revealed));
    if (!countdownVisible) {
      timerSecondRef.current = null;
      return;
    }
    const sec = Math.ceil(timeLeft);
    const prev = timerSecondRef.current;
    if (prev !== null && sec < prev && sec >= 0) {
      playViralTimerTick(timerAudioCtxRef, sec);
    }
    timerSecondRef.current = sec;
  }, [timeLeft, playing, settings.showTimer, slideIdx, revealed, data.type, timeline]);

  const musicId = settings.backgroundMusic ?? "none";

  useEffect(() => {
    const el = bgmRef.current;
    if (!el) return;
    if (musicId === "none") {
      el.pause();
      el.removeAttribute("src");
      void el.load();
      return;
    }
    const row = BGM_TRACKS.find((t) => t.id === musicId);
    if (!row?.filename) return;
    el.src = `/bgm/${row.filename}`;
    el.loop = true;
    el.volume = BGM_MIX_VOLUME;
    void el.load();
  }, [musicId]);

  useEffect(() => {
    const el = bgmRef.current;
    if (!el || musicId === "none") return;
    if (playing) void el.play().catch(() => {});
    else el.pause();
  }, [playing, musicId]);

  useEffect(
    () => () => {
      const el = bgmRef.current;
      if (el) {
        el.pause();
        el.removeAttribute("src");
      }
    },
    []
  );

  const stopTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const goTo = useCallback(
    (idx: number) => {
      stopTick();
      if (settings.voiceover) window.speechSynthesis?.cancel();
      const clamped = Math.max(0, Math.min(totalSlides - 1, idx));
      setSlideIdx(clamped);
      setRevealed(false);
      setTimeLeft(settings.slideDuration);
    },
    [settings.slideDuration, settings.voiceover, stopTick, totalSlides]
  );

  // Reset timer when settings change
  useEffect(() => {
    setTimeLeft(settings.slideDuration);
  }, [settings.slideDuration]);

  // Tick: advance through timeline (rounds + CTA cards). slideIdx in deps restarts the timer each slide so quiz reveal works every round.
  useEffect(() => {
    if (!playing) {
      stopTick();
      return;
    }
    const TICK = 0.25;
    tickRef.current = setInterval(() => {
      setTimeLeft((t) => {
        const next = t - TICK;
        const item = timeline[slideIdxRef.current];
        const isQuizRound = data.type === "quiz" && item?.kind === "round";

        if (isQuizRound && t > settings.slideDuration * REVEAL_FRAC && next <= settings.slideDuration * REVEAL_FRAC) {
          setRevealed(true);
        }

        if (next <= 0) {
          stopTick();
          setSlideIdx((i) => {
            if (i < totalSlides - 1) {
              setRevealed(false);
              setTimeLeft(settings.slideDuration);
              return i + 1;
            }
            setPlaying(false);
            return i;
          });
          return 0;
        }
        return next;
      });
    }, TICK * 1000);
    return stopTick;
  }, [playing, slideIdx, totalSlides, settings.slideDuration, data.type, timeline, stopTick]);

  // Voiceover on timeline step change
  useEffect(() => {
    if (!settings.voiceover || !playing) return;
    const item = timeline[slideIdx];
    if (!item) return;

    if (item.kind === "intro") {
      speakText(getIntroVoiceSnippet(data.type, data.topic));
      return () => {
        window.speechSynthesis?.cancel();
      };
    }
    if (item.kind === "outro") {
      speakText(getOutroVoiceSnippet(data.type));
      return () => {
        window.speechSynthesis?.cancel();
      };
    }
    if (item.kind === "cta") {
      speakText(getCtaVoiceSnippet(data.type));
      return () => {
        window.speechSynthesis?.cancel();
      };
    }

    const round = rounds[item.roundIndex];
    if (!round) return;
    let text = "";
    if (data.type === "would-you-rather") {
      const r = round as WouldYouRatherRound;
      text = `Would you rather... ${r.optionA}... or ${r.optionB}?`;
    } else {
      const r = round as QuizRound;
      text = r.question;
    }
    speakText(text);
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, [slideIdx, playing, settings.voiceover, data.type, data.topic, timeline, data.rounds]);

  const handlePlayPause = () => {
    if (playing) {
      stopTick();
      window.speechSynthesis?.cancel();
      setPlaying(false);
    } else {
      setPlaying(true);
    }
  };

  const currentItem = timeline[slideIdx];
  if (!currentItem) return null;

  const is16x9 = settings.aspectRatio === "16:9";
  const showRevealBtn =
    data.type === "quiz" && currentItem.kind === "round" && !revealed;

  return (
    <div className="flex flex-col gap-3 w-full select-none">
      <audio ref={bgmRef} className="sr-only" playsInline preload="auto" aria-hidden />
      <div
        className="relative mx-auto w-full"
        style={is16x9 ? { maxWidth: 640, aspectRatio: "16/9" } : { maxWidth: 380, aspectRatio: "9/16" }}
      >
        <div className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl">
          {currentItem.kind === "intro" ? (
            <ViralIntroSlide
              theme={visualTheme}
              topic={data.topic}
              contentType={data.type}
              roundCount={totalRounds}
              aspectRatio={settings.aspectRatio}
            />
          ) : currentItem.kind === "outro" ? (
            <ViralOutroSlide theme={visualTheme} topic={data.topic} contentType={data.type} aspectRatio={settings.aspectRatio} />
          ) : currentItem.kind === "cta" ? (
            <ViralCTASlide theme={visualTheme} variant="mid" aspectRatio={settings.aspectRatio} />
          ) : data.type === "would-you-rather" ? (
            is16x9 ? (
              <WYRSlide16x9
                theme={visualTheme}
                round={rounds[currentItem.roundIndex] as WouldYouRatherRound}
                index={currentItem.roundIndex}
                total={totalRounds}
                timeLeft={timeLeft}
                totalTime={settings.slideDuration}
                showTimer={settings.showTimer}
              />
            ) : (
              <WYRSlide
                theme={visualTheme}
                round={rounds[currentItem.roundIndex] as WouldYouRatherRound}
                index={currentItem.roundIndex}
                total={totalRounds}
                timeLeft={timeLeft}
                totalTime={settings.slideDuration}
                showTimer={settings.showTimer}
              />
            )
          ) : is16x9 ? (
            <QuizSlide16x9
              theme={visualTheme}
              round={rounds[currentItem.roundIndex] as QuizRound}
              index={currentItem.roundIndex}
              total={totalRounds}
              revealed={revealed}
              timeLeft={timeLeft}
              totalTime={settings.slideDuration}
              showTimer={settings.showTimer}
            />
          ) : (
            <QuizSlide
              theme={visualTheme}
              round={rounds[currentItem.roundIndex] as QuizRound}
              index={currentItem.roundIndex}
              total={totalRounds}
              revealed={revealed}
              timeLeft={timeLeft}
              totalTime={settings.slideDuration}
              showTimer={settings.showTimer}
            />
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
        <button
          type="button"
          onClick={() => goTo(slideIdx - 1)}
          disabled={slideIdx === 0}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-30 transition"
        >
          ←
        </button>
        <button
          type="button"
          onClick={handlePlayPause}
          className="px-5 py-1.5 rounded-lg text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white transition"
        >
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>
        {showRevealBtn && (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-500 hover:bg-green-600 text-white transition"
          >
            Reveal
          </button>
        )}
        <button
          type="button"
          onClick={() => goTo(slideIdx + 1)}
          disabled={slideIdx === totalSlides - 1}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-30 transition"
        >
          →
        </button>
      </div>

      <div className="flex justify-center gap-1.5 flex-wrap">
        {timeline.map((step, i) => (
          <button
            key={i}
            type="button"
            title={
              step.kind === "intro"
                ? "Intro"
                : step.kind === "outro"
                  ? "Outro"
                  : step.kind === "cta"
                    ? "CTA"
                    : `Question ${step.roundIndex + 1}`
            }
            onClick={() => goTo(i)}
            className={`rounded-full transition-all ${
              i === slideIdx
                ? "w-5 h-2 bg-orange-500"
                : step.kind === "intro"
                  ? "w-2 h-2 bg-violet-400 dark:bg-violet-600"
                  : step.kind === "outro"
                    ? "w-2 h-2 bg-emerald-400 dark:bg-emerald-600"
                    : step.kind === "cta"
                      ? "w-2 h-2 bg-amber-400 dark:bg-amber-600"
                      : "w-2 h-2 bg-gray-300 dark:bg-gray-600"
            }`}
          />
        ))}
      </div>

      <div className="mt-2 space-y-2 max-h-64 overflow-y-auto pr-1">
        {rounds.map((r, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(timelineIndexForRound(timeline, i))}
            className={`w-full text-left rounded-lg border p-3 text-sm transition ${
              currentItem.kind === "round" && currentItem.roundIndex === i
                ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
            }`}
          >
            <span className="font-semibold text-gray-400 mr-2">#{i + 1}</span>
            {data.type === "would-you-rather"
              ? `${(r as WouldYouRatherRound).optionA} vs ${(r as WouldYouRatherRound).optionB}`
              : (r as QuizRound).question}
          </button>
        ))}
      </div>
    </div>
  );
}
