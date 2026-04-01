"use client";

import { useState, useEffect, useRef } from "react";

// ─── Shared types ─────────────────────────────────────────────────────────────

export type WouldYouRatherRound = {
  optionA: string;
  optionB: string;
};

export type QuizRound = {
  question: string;
  options: [string, string, string, string];
  correctIndex: number; // 0-3
  explanation?: string;
};

export type ViralTemplateType = "would-you-rather" | "quiz";

export type ViralTemplateData =
  | { type: "would-you-rather"; topic: string; rounds: WouldYouRatherRound[] }
  | { type: "quiz"; topic: string; rounds: QuizRound[] };

// ─── Would You Rather slide ───────────────────────────────────────────────────

function WYRSlide({ round, index, total }: { round: WouldYouRatherRound; index: number; total: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#0A0A0F",
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background texture */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 20% 50%, rgba(255,65,108,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 50%, rgba(71,118,230,0.08) 0%, transparent 60%)",
      }} />

      {/* Round counter */}
      <div style={{
        position: "absolute", top: "5%", left: 0, right: 0,
        display: "flex", justifyContent: "center", zIndex: 2,
      }}>
        <span style={{
          background: "rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.7)",
          fontSize: "clamp(11px, 1.8vw, 16px)",
          fontWeight: 600,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          padding: "0.4em 1.2em",
          borderRadius: "999px",
          border: "1px solid rgba(255,255,255,0.12)",
        }}>
          {index + 1} / {total}
        </span>
      </div>

      {/* Header */}
      <div style={{
        position: "absolute", top: "11%", left: 0, right: 0,
        display: "flex", justifyContent: "center", zIndex: 2,
      }}>
        <p style={{
          color: "rgba(255,255,255,0.9)",
          fontSize: "clamp(13px, 2vw, 20px)",
          fontWeight: 800,
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          margin: 0,
        }}>Would You Rather</p>
      </div>

      {/* Split panels */}
      <div style={{
        position: "absolute", top: "18%", bottom: "18%", left: "4%", right: "4%",
        display: "flex", flexDirection: "column", gap: "3%", zIndex: 2,
      }}>
        {/* Option A */}
        <div style={{
          flex: 1,
          background: "linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)",
          borderRadius: "clamp(12px, 1.8vw, 20px)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "6% 8%",
          boxShadow: "0 8px 32px rgba(255,65,108,0.35)",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: "-20%", right: "-10%",
            width: "50%", height: "140%",
            background: "rgba(255,255,255,0.06)", borderRadius: "50%",
          }} />
          <span style={{
            fontSize: "clamp(9px, 1.4vw, 13px)", fontWeight: 700,
            color: "rgba(255,255,255,0.7)", letterSpacing: "0.2em",
            textTransform: "uppercase", marginBottom: "0.5em",
          }}>A</span>
          <p style={{
            fontSize: "clamp(14px, 2.2vw, 28px)", fontWeight: 800,
            color: "#fff", textAlign: "center", margin: 0,
            lineHeight: 1.25, textShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}>{round.optionA}</p>
        </div>

        {/* OR badge */}
        <div style={{
          display: "flex", justifyContent: "center", alignItems: "center",
          height: "10%", flexShrink: 0,
        }}>
          <div style={{
            background: "#fff", color: "#0A0A0F",
            fontWeight: 900, fontSize: "clamp(11px, 1.6vw, 16px)",
            width: "clamp(36px, 5vw, 52px)", height: "clamp(36px, 5vw, 52px)",
            borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            letterSpacing: "0.05em", boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}>OR</div>
        </div>

        {/* Option B */}
        <div style={{
          flex: 1,
          background: "linear-gradient(135deg, #4776E6 0%, #8E54E9 100%)",
          borderRadius: "clamp(12px, 1.8vw, 20px)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "6% 8%",
          boxShadow: "0 8px 32px rgba(71,118,230,0.35)",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", bottom: "-20%", left: "-10%",
            width: "50%", height: "140%",
            background: "rgba(255,255,255,0.06)", borderRadius: "50%",
          }} />
          <span style={{
            fontSize: "clamp(9px, 1.4vw, 13px)", fontWeight: 700,
            color: "rgba(255,255,255,0.7)", letterSpacing: "0.2em",
            textTransform: "uppercase", marginBottom: "0.5em",
          }}>B</span>
          <p style={{
            fontSize: "clamp(14px, 2.2vw, 28px)", fontWeight: 800,
            color: "#fff", textAlign: "center", margin: 0,
            lineHeight: 1.25, textShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}>{round.optionB}</p>
        </div>
      </div>

      {/* Comment CTA */}
      <div style={{
        position: "absolute", bottom: "5%", left: 0, right: 0,
        display: "flex", justifyContent: "center", zIndex: 2,
      }}>
        <p style={{
          color: "rgba(255,255,255,0.5)", fontSize: "clamp(10px, 1.5vw, 14px)",
          fontWeight: 500, margin: 0, letterSpacing: "0.05em",
        }}>💬 Comment A or B below!</p>
      </div>
    </div>
  );
}

// ─── Quiz slide ───────────────────────────────────────────────────────────────

const OPTION_LABELS = ["A", "B", "C", "D"] as const;
const OPTION_COLORS = ["#FF6B35", "#4776E6", "#00C49A", "#FF416C"] as const;

function QuizSlide({
  round, index, total, revealed,
}: {
  round: QuizRound; index: number; total: number; revealed: boolean;
}) {
  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "column",
      background: "#080B14",
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      {/* Subtle grid bg */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      {/* Header strip */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        background: "linear-gradient(90deg, #FF6B35, #FF416C)",
        height: "0.5%", minHeight: 3,
      }} />

      {/* Round counter */}
      <div style={{
        position: "absolute", top: "5%", left: 0, right: 0,
        display: "flex", justifyContent: "center", zIndex: 2,
      }}>
        <span style={{
          background: "rgba(255,107,53,0.15)", color: "#FF6B35",
          fontSize: "clamp(10px, 1.6vw, 14px)", fontWeight: 700,
          letterSpacing: "0.15em", textTransform: "uppercase",
          padding: "0.4em 1.2em", borderRadius: "999px",
          border: "1px solid rgba(255,107,53,0.3)",
        }}>Question {index + 1}/{total}</span>
      </div>

      {/* Question */}
      <div style={{
        position: "absolute", top: "12%", left: "5%", right: "5%",
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "28%", zIndex: 2,
      }}>
        <p style={{
          color: "#fff", fontSize: "clamp(15px, 2.4vw, 32px)",
          fontWeight: 800, textAlign: "center", margin: 0,
          lineHeight: 1.3,
        }}>{round.question}</p>
      </div>

      {/* Options */}
      <div style={{
        position: "absolute", top: "43%", bottom: "8%", left: "5%", right: "5%",
        display: "flex", flexDirection: "column", gap: "3%", zIndex: 2,
      }}>
        {round.options.map((opt, i) => {
          const isCorrect = i === round.correctIndex;
          const color = OPTION_COLORS[i]!;
          const bgColor = revealed
            ? isCorrect ? "rgba(0,196,154,0.15)" : "rgba(255,255,255,0.03)"
            : "rgba(255,255,255,0.05)";
          const borderColor = revealed
            ? isCorrect ? "#00C49A" : "rgba(255,255,255,0.08)"
            : "rgba(255,255,255,0.1)";
          const textColor = revealed
            ? isCorrect ? "#00C49A" : "rgba(255,255,255,0.35)"
            : "#fff";

          return (
            <div key={i} style={{
              flex: 1,
              background: bgColor,
              border: `1px solid ${borderColor}`,
              borderRadius: "clamp(8px, 1.2vw, 14px)",
              display: "flex", alignItems: "center",
              padding: "0 5%",
              transition: "all 0.4s ease",
            }}>
              <div style={{
                width: "clamp(24px, 3.5vw, 36px)", height: "clamp(24px, 3.5vw, 36px)",
                borderRadius: "50%", flexShrink: 0, marginRight: "4%",
                background: revealed
                  ? isCorrect ? "#00C49A" : "rgba(255,255,255,0.08)"
                  : color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "clamp(9px, 1.3vw, 13px)", fontWeight: 800,
                color: revealed && !isCorrect ? "rgba(255,255,255,0.3)" : "#fff",
              }}>{OPTION_LABELS[i]}</div>
              <p style={{
                color: textColor, fontSize: "clamp(12px, 1.8vw, 22px)",
                fontWeight: 600, margin: 0, lineHeight: 1.25, flex: 1,
                transition: "color 0.4s ease",
              }}>{opt}</p>
              {revealed && isCorrect && (
                <span style={{ fontSize: "clamp(14px, 2vw, 22px)", marginLeft: "2%" }}>✓</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Explanation */}
      {revealed && round.explanation && (
        <div style={{
          position: "absolute", bottom: "2%", left: "5%", right: "5%",
          zIndex: 2, textAlign: "center",
        }}>
          <p style={{
            color: "rgba(255,255,255,0.5)", fontSize: "clamp(9px, 1.3vw, 14px)",
            margin: 0, fontStyle: "italic",
          }}>{round.explanation}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main preview player ──────────────────────────────────────────────────────

const SLIDE_HOLD_MS = 4000;
const REVEAL_AFTER_MS = 2500;

export function ViralTemplatePreview({ data, autoPlay = false }: { data: ViralTemplateData; autoPlay?: boolean }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [revealed, setRevealed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rounds = data.rounds as (WouldYouRatherRound | QuizRound)[];
  const total = rounds.length;

  const goTo = (idx: number) => {
    setCurrentIdx(idx);
    setRevealed(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (revealRef.current) clearTimeout(revealRef.current);
  };

  useEffect(() => {
    if (!playing) return;
    if (data.type === "quiz") {
      revealRef.current = setTimeout(() => setRevealed(true), REVEAL_AFTER_MS);
    }
    timerRef.current = setTimeout(() => {
      if (currentIdx < total - 1) {
        goTo(currentIdx + 1);
      } else {
        setPlaying(false);
      }
    }, SLIDE_HOLD_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (revealRef.current) clearTimeout(revealRef.current);
    };
  }, [playing, currentIdx, total, data.type]);

  const round = rounds[currentIdx];
  if (!round) return null;

  return (
    <div className="flex flex-col gap-3 w-full select-none">
      {/* 9:16 preview */}
      <div className="relative mx-auto w-full" style={{ maxWidth: 380, aspectRatio: "9/16" }}>
        <div className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl">
          {data.type === "would-you-rather" ? (
            <WYRSlide round={round as WouldYouRatherRound} index={currentIdx} total={total} />
          ) : (
            <QuizSlide round={round as QuizRound} index={currentIdx} total={total} revealed={revealed} />
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 mt-1">
        <button
          onClick={() => goTo(Math.max(0, currentIdx - 1))}
          disabled={currentIdx === 0}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-30 transition"
        >←</button>
        <button
          onClick={() => { setPlaying(!playing); if (!playing) setRevealed(false); }}
          className="px-5 py-1.5 rounded-lg text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white transition"
        >{playing ? "⏸ Pause" : "▶ Play"}</button>
        {data.type === "quiz" && !revealed && (
          <button
            onClick={() => setRevealed(true)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-500 hover:bg-green-600 text-white transition"
          >Reveal</button>
        )}
        <button
          onClick={() => goTo(Math.min(total - 1, currentIdx + 1))}
          disabled={currentIdx === total - 1}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-30 transition"
        >→</button>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5">
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
            className={`w-full text-left rounded-lg border p-3 text-sm transition ${i === currentIdx ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"}`}
          >
            <span className="font-semibold text-gray-500 dark:text-gray-400 mr-2">#{i + 1}</span>
            {data.type === "would-you-rather"
              ? `${(r as WouldYouRatherRound).optionA} vs ${(r as WouldYouRatherRound).optionB}`
              : (r as QuizRound).question}
          </button>
        ))}
      </div>
    </div>
  );
}
