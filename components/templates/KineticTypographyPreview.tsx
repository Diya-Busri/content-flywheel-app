"use client";

import { useState, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type KineticScene = {
  text: string;
  accentWords: number; // first N words shown in accent colour
};

export type KineticData = {
  topic: string;
  voiceId?: string;
  colorScheme: "dark-orange" | "dark-blue" | "dark-green" | "dark-purple";
  scenes: KineticScene[];
};

// ─── Color schemes ────────────────────────────────────────────────────────────

const SCHEMES = {
  "dark-orange": { bg: "#0A0A0A", accent: "#FF6B35", text: "#FFFFFF", glow: "rgba(255,107,53,0.2)" },
  "dark-blue":   { bg: "#060D1F", accent: "#4776E6", text: "#FFFFFF", glow: "rgba(71,118,230,0.2)" },
  "dark-green":  { bg: "#030F0A", accent: "#00C49A", text: "#FFFFFF", glow: "rgba(0,196,154,0.2)" },
  "dark-purple": { bg: "#0D0814", accent: "#8E54E9", text: "#FFFFFF", glow: "rgba(142,84,233,0.2)" },
};

// ─── Single kinetic scene ─────────────────────────────────────────────────────

function KineticSlide({
  scene, scheme, index, total,
}: {
  scene: KineticScene; scheme: typeof SCHEMES["dark-orange"]; index: number; total: number;
}) {
  const words = scene.text.split(/\s+/).filter(Boolean);
  const accentCount = Math.min(scene.accentWords, words.length);

  return (
    <div
      key={`${index}-${scene.text.slice(0, 20)}`}
      style={{
        width: "100%", height: "100%",
        background: scheme.bg,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        position: "relative", overflow: "hidden",
        padding: "8% 7%",
        boxSizing: "border-box",
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: "absolute", top: "30%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "80%", height: "60%",
        background: `radial-gradient(ellipse, ${scheme.glow} 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      {/* Progress bar */}
      <div style={{
        position: "absolute", top: 0, left: 0,
        height: 3,
        width: `${((index + 1) / total) * 100}%`,
        background: scheme.accent,
        transition: "width 0.4s ease",
      }} />

      {/* Scene number */}
      <div style={{
        position: "absolute", top: "5%", right: "6%",
        color: "rgba(255,255,255,0.25)", fontSize: "clamp(10px, 1.4vw, 13px)",
        fontWeight: 600, letterSpacing: "0.1em",
      }}>
        {index + 1}/{total}
      </div>

      {/* Text block */}
      <div
        className="kt-slide-in"
        style={{
          textAlign: "center",
          position: "relative", zIndex: 2,
          maxWidth: "90%",
        }}
      >
        <p style={{
          fontSize: "clamp(20px, 4vw, 54px)",
          fontWeight: 900,
          lineHeight: 1.2,
          margin: 0,
          letterSpacing: "-0.01em",
        }}>
          {words.map((word, wi) => (
            <span key={wi} style={{
              color: wi < accentCount ? scheme.accent : scheme.text,
              display: "inline",
            }}>
              {word}{wi < words.length - 1 ? " " : ""}
            </span>
          ))}
        </p>
      </div>

      {/* Decorative accent line */}
      <div style={{
        position: "absolute", bottom: "12%", left: "50%",
        transform: "translateX(-50%)",
        width: "clamp(30px, 5vw, 50px)", height: 3,
        background: scheme.accent, borderRadius: 2,
        opacity: 0.6,
      }} />

      <style>{`
        @keyframes kt-slide {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .kt-slide-in {
          animation: kt-slide 0.45s cubic-bezier(.22,1,.36,1) forwards;
        }
      `}</style>
    </div>
  );
}

// ─── Preview player ───────────────────────────────────────────────────────────

const SLIDE_HOLD_MS = 3500;

export const KINETIC_COLOR_OPTIONS = [
  { value: "dark-orange" as const, label: "Dark Orange (default)" },
  { value: "dark-blue"   as const, label: "Dark Blue" },
  { value: "dark-green"  as const, label: "Dark Green" },
  { value: "dark-purple" as const, label: "Dark Purple" },
];

export const KINETIC_VOICE_OPTIONS = [
  { value: "EXAVITQu4vr4xnSDxMaL", label: "Sarah (calm, clear)" },
  { value: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam (deep, authoritative)" },
  { value: "pNInz6obpgDQGcFmaJgB", label: "Adam (neutral, clean)" },
  { value: "jBpfuIE2acCO8z3wKNLl", label: "Matilda (energetic)" },
  { value: "onwK4e9ZLuTAKqWW03F9", label: "Daniel (professional)" },
];

export function KineticTypographyPreview({ data, voiceover = false }: { data: KineticData; voiceover?: boolean }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheme = SCHEMES[data.colorScheme];
  const total = data.scenes.length;

  const goTo = (idx: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (voiceover && typeof window !== "undefined") window.speechSynthesis?.cancel();
    setCurrentIdx(idx);
  };

  // Auto-advance timer — duration based on word count
  useEffect(() => {
    if (!playing) return;
    const scene = data.scenes[currentIdx];
    const wordCount = (scene?.text ?? "").split(/\s+/).filter(Boolean).length;
    const durationMs = Math.max(2000, Math.round((wordCount / 2.5) * 1000) + 600);
    timerRef.current = setTimeout(() => {
      if (currentIdx < total - 1) {
        setCurrentIdx(i => i + 1);
      } else {
        setPlaying(false);
      }
    }, durationMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [playing, currentIdx, total, data.scenes]);

  // Voiceover: speak each scene's text when playing
  useEffect(() => {
    if (!voiceover || !playing) return;
    const text = data.scenes[currentIdx]?.text;
    if (!text || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
    return () => { window.speechSynthesis.cancel(); };
  }, [currentIdx, playing, voiceover, data.scenes]);

  const scene = data.scenes[currentIdx];
  if (!scene) return null;

  return (
    <div className="flex flex-col gap-3 w-full select-none">
      {/* 9:16 preview */}
      <div className="relative mx-auto w-full" style={{ maxWidth: 380, aspectRatio: "9/16" }}>
        <div className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl">
          <KineticSlide
            key={currentIdx}
            scene={scene}
            scheme={scheme}
            index={currentIdx}
            total={total}
          />
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
          onClick={() => { if (playing) { window.speechSynthesis?.cancel(); } setPlaying(p => !p); }}
          className="px-5 py-1.5 rounded-lg text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white transition"
        >{playing ? "⏸ Pause" : "▶ Play"}</button>
        <button
          onClick={() => goTo(Math.min(total - 1, currentIdx + 1))}
          disabled={currentIdx === total - 1}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-30 transition"
        >→</button>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5 flex-wrap">
        {data.scenes.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`rounded-full transition-all ${i === currentIdx ? "w-5 h-2 bg-orange-500" : "w-2 h-2 bg-gray-300 dark:bg-gray-600"}`}
          />
        ))}
      </div>

      {/* Scene list */}
      <div className="mt-2 space-y-2 max-h-56 overflow-y-auto pr-1">
        {data.scenes.map((s, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`w-full text-left rounded-lg border p-3 text-sm transition ${i === currentIdx ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
          >
            <span className="font-semibold text-gray-400 mr-2">#{i + 1}</span>
            {s.text}
          </button>
        ))}
      </div>
    </div>
  );
}
