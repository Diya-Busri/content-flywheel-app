"use client";

import { useState, useEffect, useRef, useCallback } from "react";

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
  | { type: "would-you-rather"; topic: string; rounds: WouldYouRatherRound[] }
  | { type: "quiz"; topic: string; rounds: QuizRound[] };

export type ViralSettings = {
  slideDuration: number;   // seconds per slide
  aspectRatio: "9:16" | "16:9";
  showTimer: boolean;
  voiceover: boolean;
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

function WYRSlide({ round, index, total, timeLeft, totalTime, showTimer }: {
  round: WouldYouRatherRound; index: number; total: number;
  timeLeft: number; totalTime: number; showTimer: boolean;
}) {
  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "column",
      background: "#0A0A0F",
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      {/* Background glow */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 20% 50%, rgba(255,65,108,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 50%, rgba(71,118,230,0.08) 0%, transparent 60%)",
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
          flex: 1, background: "linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)",
          borderRadius: "clamp(10px,1.6vw,18px)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "5% 8%", boxShadow: "0 8px 32px rgba(255,65,108,0.35)",
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
            background: "#fff", color: "#0A0A0F", fontWeight: 900,
            fontSize: "clamp(10px,1.5vw,15px)",
            width: "clamp(32px,4.5vw,48px)", height: "clamp(32px,4.5vw,48px)",
            borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            letterSpacing: "0.05em", boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}>OR</div>
        </div>

        {/* Option B */}
        <div style={{
          flex: 1, background: "linear-gradient(135deg, #4776E6 0%, #8E54E9 100%)",
          borderRadius: "clamp(10px,1.6vw,18px)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "5% 8%", boxShadow: "0 8px 32px rgba(71,118,230,0.35)",
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
const OPTION_COLORS = ["#FF6B35", "#4776E6", "#00C49A", "#FF416C"] as const;

function QuizSlide({ round, index, total, revealed, timeLeft, totalTime, showTimer }: {
  round: QuizRound; index: number; total: number; revealed: boolean;
  timeLeft: number; totalTime: number; showTimer: boolean;
}) {
  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "column",
      background: "#080B14",
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: "linear-gradient(90deg,#FF6B35,#FF416C)", height: "0.4%", minHeight: 3 }} />

      {/* Top row: badge + timer */}
      <div style={{
        position: "absolute", top: "4%", left: 0, right: 0,
        display: "flex", justifyContent: "center", alignItems: "center",
        gap: "clamp(8px,2vw,16px)", zIndex: 2,
      }}>
        <span style={{
          background: "rgba(255,107,53,0.15)", color: "#FF6B35",
          fontSize: "clamp(9px,1.4vw,13px)", fontWeight: 700,
          letterSpacing: "0.12em", textTransform: "uppercase",
          padding: "0.35em 1em", borderRadius: "999px",
          border: "1px solid rgba(255,107,53,0.3)",
        }}>Q{index + 1}/{total}</span>
        {showTimer && !revealed && <CountdownTimer total={totalTime} remaining={timeLeft} size={46} />}
        {revealed && <span style={{ fontSize: "clamp(10px,1.5vw,14px)", color: "#00C49A", fontWeight: 700 }}>✓ Answer</span>}
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
          const color = OPTION_COLORS[i]!;
          const bgColor = revealed ? (isCorrect ? "rgba(0,196,154,0.15)" : "rgba(255,255,255,0.03)") : "rgba(255,255,255,0.05)";
          const borderColor = revealed ? (isCorrect ? "#00C49A" : "rgba(255,255,255,0.07)") : "rgba(255,255,255,0.1)";
          const textColor = revealed ? (isCorrect ? "#00C49A" : "rgba(255,255,255,0.3)") : "#fff";
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
                background: revealed ? (isCorrect ? "#00C49A" : "rgba(255,255,255,0.07)") : color,
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

function WYRSlide16x9({ round, index, total, timeLeft, totalTime, showTimer }: {
  round: WouldYouRatherRound; index: number; total: number;
  timeLeft: number; totalTime: number; showTimer: boolean;
}) {
  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "column",
      background: "#0A0A0F",
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      {/* Background glow */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 20% 50%, rgba(255,65,108,0.1) 0%, transparent 55%), radial-gradient(ellipse at 80% 50%, rgba(71,118,230,0.1) 0%, transparent 55%)",
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
          flex: 1, background: "linear-gradient(160deg, #FF416C 0%, #FF4B2B 100%)",
          borderRadius: "clamp(8px,1.2vw,16px) 0 0 clamp(8px,1.2vw,16px)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "4% 6%", boxShadow: "0 8px 40px rgba(255,65,108,0.35)",
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
            background: "#fff", color: "#0A0A0F", fontWeight: 900,
            fontSize: "clamp(9px,1.2vw,14px)",
            width: "clamp(32px,4.5vw,52px)", height: "clamp(32px,4.5vw,52px)",
            borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            letterSpacing: "0.03em", boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          }}>OR</div>
        </div>

        {/* Option B */}
        <div style={{
          flex: 1, background: "linear-gradient(160deg, #4776E6 0%, #8E54E9 100%)",
          borderRadius: "0 clamp(8px,1.2vw,16px) clamp(8px,1.2vw,16px) 0",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "4% 6%", boxShadow: "0 8px 40px rgba(71,118,230,0.35)",
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

function QuizSlide16x9({ round, index, total, revealed, timeLeft, totalTime, showTimer }: {
  round: QuizRound; index: number; total: number; revealed: boolean;
  timeLeft: number; totalTime: number; showTimer: boolean;
}) {
  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "row",
      background: "#080B14",
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: "linear-gradient(90deg,#FF6B35,#FF416C)", height: "0.5%", minHeight: 3 }} />

      {/* Left: question area */}
      <div style={{
        flex: "0 0 42%", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "5% 4% 5% 5%", position: "relative", zIndex: 2,
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{
          background: "rgba(255,107,53,0.15)", color: "#FF6B35",
          fontSize: "clamp(8px,1vw,12px)", fontWeight: 700,
          letterSpacing: "0.12em", textTransform: "uppercase",
          padding: "0.3em 0.9em", borderRadius: "999px",
          border: "1px solid rgba(255,107,53,0.3)", marginBottom: "1em",
        }}>Q{index + 1}/{total}</div>
        {round.emoji && <span style={{ fontSize: "clamp(24px,4vw,52px)", marginBottom: "0.3em" }}>{round.emoji}</span>}
        <p style={{ color: "#fff", fontSize: "clamp(12px,1.8vw,22px)", fontWeight: 800, textAlign: "center", margin: 0, lineHeight: 1.35 }}>{round.question}</p>
        {showTimer && !revealed && (
          <div style={{ marginTop: "1em" }}>
            <CountdownTimer total={totalTime} remaining={timeLeft} size={42} />
          </div>
        )}
        {revealed && <span style={{ marginTop: "0.8em", fontSize: "clamp(9px,1.2vw,14px)", color: "#00C49A", fontWeight: 700 }}>✓ Answer revealed</span>}
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
          const color = OPTION_COLORS[i]!;
          const bgColor = revealed ? (isCorrect ? "rgba(0,196,154,0.15)" : "rgba(255,255,255,0.03)") : "rgba(255,255,255,0.05)";
          const borderColor = revealed ? (isCorrect ? "#00C49A" : "rgba(255,255,255,0.07)") : "rgba(255,255,255,0.1)";
          const textColor = revealed ? (isCorrect ? "#00C49A" : "rgba(255,255,255,0.3)") : "#fff";
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
                background: revealed ? (isCorrect ? "#00C49A" : "rgba(255,255,255,0.07)") : color,
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

export function ViralTemplatePreview({
  data,
  settings,
}: {
  data: ViralTemplateData;
  settings: ViralSettings;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(settings.slideDuration);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const rounds = data.rounds as (WouldYouRatherRound | QuizRound)[];
  const total = rounds.length;

  const stopTick = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }, []);

  const goTo = useCallback((idx: number) => {
    stopTick();
    if (settings.voiceover) window.speechSynthesis?.cancel();
    setCurrentIdx(idx);
    setRevealed(false);
    setTimeLeft(settings.slideDuration);
  }, [settings.slideDuration, settings.voiceover, stopTick]);

  // Reset timer when settings change
  useEffect(() => { setTimeLeft(settings.slideDuration); }, [settings.slideDuration]);

  // Tick
  useEffect(() => {
    if (!playing) { stopTick(); return; }
    const TICK = 0.25;
    tickRef.current = setInterval(() => {
      setTimeLeft((t) => {
        const next = t - TICK;
        if (next <= 0) {
          stopTick();
          // advance
          setCurrentIdx((i) => {
            const nextIdx = i < total - 1 ? i + 1 : i;
            if (i < total - 1) {
              setRevealed(false);
              setTimeLeft(settings.slideDuration);
              // restart tick
              setTimeout(() => {
                if (tickRef.current) clearInterval(tickRef.current);
                tickRef.current = setInterval(() => {
                  setTimeLeft((tt) => {
                    const nn = tt - TICK;
                    if (nn <= 0) { stopTick(); return 0; }
                    return nn;
                  });
                }, TICK * 1000);
              }, 50);
            } else {
              setPlaying(false);
            }
            return nextIdx;
          });
          return 0;
        }
        // Quiz: reveal at halfway
        if (data.type === "quiz" && t > settings.slideDuration * REVEAL_FRAC && next <= settings.slideDuration * REVEAL_FRAC) {
          setRevealed(true);
        }
        return next;
      });
    }, TICK * 1000);
    return stopTick;
  }, [playing, total, settings.slideDuration, data.type, stopTick]);

  // Voiceover on slide change
  useEffect(() => {
    if (!settings.voiceover || !playing) return;
    const round = rounds[currentIdx];
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
    return () => { window.speechSynthesis?.cancel(); };
  }, [currentIdx, playing, settings.voiceover]);

  const handlePlayPause = () => {
    if (playing) {
      stopTick();
      window.speechSynthesis?.cancel();
      setPlaying(false);
    } else {
      setPlaying(true);
    }
  };

  const round = rounds[currentIdx];
  if (!round) return null;

  const is16x9 = settings.aspectRatio === "16:9";

  return (
    <div className="flex flex-col gap-3 w-full select-none">
      {/* Preview — switches between 9:16 and 16:9 */}
      <div
        className="relative mx-auto w-full"
        style={is16x9
          ? { maxWidth: 640, aspectRatio: "16/9" }
          : { maxWidth: 380, aspectRatio: "9/16" }
        }
      >
        <div className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl">
          {data.type === "would-you-rather" ? (
            is16x9 ? (
              <WYRSlide16x9
                round={round as WouldYouRatherRound}
                index={currentIdx} total={total}
                timeLeft={timeLeft} totalTime={settings.slideDuration}
                showTimer={settings.showTimer}
              />
            ) : (
              <WYRSlide
                round={round as WouldYouRatherRound}
                index={currentIdx} total={total}
                timeLeft={timeLeft} totalTime={settings.slideDuration}
                showTimer={settings.showTimer}
              />
            )
          ) : (
            is16x9 ? (
              <QuizSlide16x9
                round={round as QuizRound}
                index={currentIdx} total={total}
                revealed={revealed}
                timeLeft={timeLeft} totalTime={settings.slideDuration}
                showTimer={settings.showTimer}
              />
            ) : (
              <QuizSlide
                round={round as QuizRound}
                index={currentIdx} total={total}
                revealed={revealed}
                timeLeft={timeLeft} totalTime={settings.slideDuration}
                showTimer={settings.showTimer}
              />
            )
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
        <button
          onClick={() => { goTo(Math.max(0, currentIdx - 1)); }}
          disabled={currentIdx === 0}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-30 transition"
        >←</button>
        <button
          onClick={handlePlayPause}
          className="px-5 py-1.5 rounded-lg text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white transition"
        >{playing ? "⏸ Pause" : "▶ Play"}</button>
        {data.type === "quiz" && !revealed && (
          <button
            onClick={() => setRevealed(true)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-500 hover:bg-green-600 text-white transition"
          >Reveal</button>
        )}
        <button
          onClick={() => { goTo(Math.min(total - 1, currentIdx + 1)); }}
          disabled={currentIdx === total - 1}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-30 transition"
        >→</button>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5 flex-wrap">
        {rounds.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`rounded-full transition-all ${i === currentIdx ? "w-5 h-2 bg-orange-500" : "w-2 h-2 bg-gray-300 dark:bg-gray-600"}`}
          />
        ))}
      </div>

      {/* Round list */}
      <div className="mt-2 space-y-2 max-h-64 overflow-y-auto pr-1">
        {rounds.map((r, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`w-full text-left rounded-lg border p-3 text-sm transition ${i === currentIdx ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
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
