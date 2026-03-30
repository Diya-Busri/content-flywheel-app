"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StickmanPose =
  | "standing"
  | "thinking"
  | "sitting"
  | "celebrating"
  | "pointing"
  | "defeated"
  | "arms-raised"
  | "walking";

export interface StickmanScene {
  sceneIndex: number;
  caption: string;
  pose: StickmanPose;
}

interface Props {
  scenes: StickmanScene[];
  voiceId?: string;
  autoPlay?: boolean;
  onComplete?: () => void;
}

// ─── SVG Pose Definitions ─────────────────────────────────────────────────────
// ViewBox: 0 0 100 100
// Head: circle cx=50 cy=13 r=11
// Body: (50,24) → (50,62)
// Shoulders at y=38, Hips at y=62

interface CircleEl  { kind: "circle"; cx: number; cy: number; r: number; delay: number }
interface LineEl    { kind: "line";   x1: number; y1: number; x2: number; y2: number; delay: number }
type PoseElement = CircleEl | LineEl;

const HEAD: CircleEl = { kind: "circle", cx: 50, cy: 13, r: 11, delay: 0 };
const BODY: LineEl   = { kind: "line", x1: 50, y1: 24, x2: 50, y2: 62, delay: 280 };

const POSE_ELEMENTS: Record<StickmanPose, PoseElement[]> = {
  standing: [
    HEAD, BODY,
    { kind: "line", x1: 50, y1: 38, x2: 32, y2: 55, delay: 520 }, // L arm
    { kind: "line", x1: 50, y1: 38, x2: 68, y2: 55, delay: 660 }, // R arm
    { kind: "line", x1: 50, y1: 62, x2: 37, y2: 93, delay: 800 }, // L leg
    { kind: "line", x1: 50, y1: 62, x2: 63, y2: 93, delay: 940 }, // R leg
  ],
  thinking: [
    HEAD, BODY,
    { kind: "line", x1: 50, y1: 38, x2: 32, y2: 55, delay: 520 }, // L arm
    { kind: "line", x1: 50, y1: 38, x2: 64, y2: 28, delay: 660 }, // R arm up
    { kind: "line", x1: 64, y1: 28, x2: 57, y2: 20, delay: 780 }, // finger to chin
    { kind: "line", x1: 50, y1: 62, x2: 37, y2: 93, delay: 900 }, // L leg
    { kind: "line", x1: 50, y1: 62, x2: 63, y2: 93, delay: 1040 },
  ],
  sitting: [
    HEAD, BODY,
    { kind: "line", x1: 50, y1: 38, x2: 32, y2: 54, delay: 520 }, // L arm
    { kind: "line", x1: 50, y1: 38, x2: 68, y2: 54, delay: 660 }, // R arm
    { kind: "line", x1: 50, y1: 62, x2: 28, y2: 70, delay: 800 }, // L thigh horizontal
    { kind: "line", x1: 28, y1: 70, x2: 28, y2: 93, delay: 940 }, // L shin vertical
    { kind: "line", x1: 50, y1: 62, x2: 72, y2: 70, delay: 1000 }, // R thigh
    { kind: "line", x1: 72, y1: 70, x2: 72, y2: 93, delay: 1140 }, // R shin
  ],
  celebrating: [
    HEAD, BODY,
    { kind: "line", x1: 50, y1: 38, x2: 25, y2: 12, delay: 520 }, // L arm raised
    { kind: "line", x1: 50, y1: 38, x2: 75, y2: 12, delay: 660 }, // R arm raised
    { kind: "line", x1: 50, y1: 62, x2: 35, y2: 93, delay: 800 },
    { kind: "line", x1: 50, y1: 62, x2: 65, y2: 93, delay: 940 },
  ],
  pointing: [
    HEAD, BODY,
    { kind: "line", x1: 50, y1: 38, x2: 32, y2: 55, delay: 520 }, // L arm down
    { kind: "line", x1: 50, y1: 38, x2: 82, y2: 38, delay: 660 }, // R arm extended →
    { kind: "line", x1: 50, y1: 62, x2: 37, y2: 93, delay: 800 },
    { kind: "line", x1: 50, y1: 62, x2: 63, y2: 93, delay: 940 },
  ],
  defeated: [
    { kind: "circle", cx: 52, cy: 15, r: 11, delay: 0 }, // head slightly tilted
    { kind: "line", x1: 50, y1: 26, x2: 50, y2: 62, delay: 280 },
    { kind: "line", x1: 50, y1: 38, x2: 38, y2: 59, delay: 520 }, // arms hanging in
    { kind: "line", x1: 50, y1: 38, x2: 62, y2: 59, delay: 660 },
    { kind: "line", x1: 50, y1: 62, x2: 41, y2: 93, delay: 800 }, // legs closer
    { kind: "line", x1: 50, y1: 62, x2: 59, y2: 93, delay: 940 },
  ],
  "arms-raised": [
    HEAD, BODY,
    { kind: "line", x1: 50, y1: 38, x2: 22, y2: 8,  delay: 520 }, // L arm V
    { kind: "line", x1: 50, y1: 38, x2: 78, y2: 8,  delay: 660 }, // R arm V
    { kind: "line", x1: 50, y1: 62, x2: 37, y2: 93, delay: 800 },
    { kind: "line", x1: 50, y1: 62, x2: 63, y2: 93, delay: 940 },
  ],
  walking: [
    HEAD, BODY,
    { kind: "line", x1: 50, y1: 38, x2: 30, y2: 50, delay: 520 }, // L arm fwd
    { kind: "line", x1: 50, y1: 38, x2: 68, y2: 52, delay: 660 }, // R arm back
    { kind: "line", x1: 50, y1: 62, x2: 32, y2: 90, delay: 800 }, // L leg fwd
    { kind: "line", x1: 50, y1: 62, x2: 66, y2: 91, delay: 940 }, // R leg back
  ],
};

// ─── Stickman SVG ─────────────────────────────────────────────────────────────

function StickmanSvg({ pose, animKey }: { pose: StickmanPose; animKey: number }) {
  const elements = POSE_ELEMENTS[pose] ?? POSE_ELEMENTS.standing;

  return (
    <svg
      key={animKey}
      viewBox="0 0 100 100"
      className="w-full h-full"
      aria-label={`Stickman pose: ${pose}`}
    >
      <style>{`
        @keyframes cf-draw-on {
          from { stroke-dashoffset: 300; }
          to   { stroke-dashoffset: 0; }
        }
        .cf-draw {
          stroke: #1e293b;
          stroke-width: 3.2;
          stroke-linecap: round;
          stroke-linejoin: round;
          fill: none;
          stroke-dasharray: 300;
          stroke-dashoffset: 300;
          animation: cf-draw-on 0.45s ease-out forwards;
        }
        .cf-draw-circle {
          stroke: #1e293b;
          stroke-width: 3.2;
          fill: none;
          stroke-dasharray: 300;
          stroke-dashoffset: 300;
          animation: cf-draw-on 0.45s ease-out forwards;
        }
      `}</style>

      {elements.map((el, i) => {
        const style: React.CSSProperties = { animationDelay: `${el.delay}ms` };
        if (el.kind === "circle") {
          return (
            <circle
              key={i}
              className="cf-draw-circle"
              cx={el.cx}
              cy={el.cy}
              r={el.r}
              style={style}
            />
          );
        }
        return (
          <line
            key={i}
            className="cf-draw"
            x1={el.x1}
            y1={el.y1}
            x2={el.x2}
            y2={el.y2}
            style={style}
          />
        );
      })}
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

export function StickmanWhiteboard({ scenes, voiceId, autoPlay = true, onComplete }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [loadingVoiceover, setLoadingVoiceover] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audio management
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Cache: sceneIndex → blob URL
  const audioCacheRef = useRef<Map<number, string>>(new Map());
  const prefetchInFlightRef = useRef<Set<number>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Revoke cached blob URLs on unmount
      audioCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      audioCacheRef.current.clear();
    };
  }, []);

  const fetchVoiceover = useCallback(
    async (sceneIndex: number): Promise<string | null> => {
      const cached = audioCacheRef.current.get(sceneIndex);
      if (cached) return cached;

      if (prefetchInFlightRef.current.has(sceneIndex)) return null;
      prefetchInFlightRef.current.add(sceneIndex);

      try {
        const scene = scenes[sceneIndex];
        if (!scene) return null;

        const res = await fetch("/api/templates/stickman/voiceover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: scene.caption,
            sceneIndex,
            voiceId: voiceId ?? DEFAULT_VOICE_ID,
          }),
        });

        if (!res.ok) throw new Error(`Voiceover fetch failed: ${res.status}`);

        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        if (mountedRef.current) {
          audioCacheRef.current.set(sceneIndex, blobUrl);
        } else {
          URL.revokeObjectURL(blobUrl);
          return null;
        }
        return blobUrl;
      } catch (err) {
        console.error("[StickmanWhiteboard] voiceover fetch error", err);
        return null;
      } finally {
        prefetchInFlightRef.current.delete(sceneIndex);
      }
    },
    [scenes, voiceId]
  );

  // Prefetch next 2 scenes silently
  const prefetchAhead = useCallback(
    (fromIndex: number) => {
      for (let i = fromIndex + 1; i <= fromIndex + 2 && i < scenes.length; i++) {
        if (!audioCacheRef.current.has(i) && !prefetchInFlightRef.current.has(i)) {
          void fetchVoiceover(i);
        }
      }
    },
    [fetchVoiceover, scenes.length]
  );

  // Play a scene: fetch voiceover + play audio
  const playScene = useCallback(
    async (index: number) => {
      if (!mountedRef.current) return;

      // Stop any current audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
      }

      setLoadingVoiceover(true);
      setError(null);

      const blobUrl = await fetchVoiceover(index);
      prefetchAhead(index);

      if (!mountedRef.current) return;
      setLoadingVoiceover(false);

      if (!blobUrl) {
        setError("Could not load voiceover. Check your ElevenLabs API key.");
        return;
      }

      const audio = new Audio(blobUrl);
      audioRef.current = audio;

      audio.onended = () => {
        if (!mountedRef.current) return;
        const next = index + 1;
        if (next < scenes.length) {
          setCurrentIndex(next);
        } else {
          setIsPlaying(false);
          onComplete?.();
        }
      };

      audio.onerror = () => {
        if (!mountedRef.current) return;
        setError("Audio playback error.");
      };

      try {
        await audio.play();
      } catch {
        setError("Audio playback blocked. Click play to start.");
        setIsPlaying(false);
      }
    },
    [fetchVoiceover, prefetchAhead, scenes.length, onComplete]
  );

  // When currentIndex changes and we're playing → play that scene
  useEffect(() => {
    if (!isPlaying || scenes.length === 0) return;
    void playScene(currentIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, isPlaying]);

  // Cleanup audio when paused
  useEffect(() => {
    if (!isPlaying && audioRef.current) {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  const handlePlay = () => {
    setIsPlaying(true);
    if (!audioRef.current || audioRef.current.paused) {
      void playScene(currentIndex);
    }
  };

  const handlePause = () => {
    setIsPlaying(false);
    audioRef.current?.pause();
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < scenes.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const scene = scenes[currentIndex];
  if (!scene) return null;

  const progress = scenes.length > 1 ? (currentIndex / (scenes.length - 1)) * 100 : 100;

  return (
    <div className="flex flex-col gap-4 w-full select-none">
      {/* Whiteboard canvas */}
      <div
        className="relative w-full rounded-xl border-2 border-slate-200 bg-white shadow-sm overflow-hidden"
        style={{ aspectRatio: "9/16", maxWidth: 360, margin: "0 auto" }}
      >
        {/* Subtle grid lines */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {Array.from({ length: 10 }, (_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 10} x2="100" y2={i * 10} stroke="#000" strokeWidth="0.5" />
          ))}
          {Array.from({ length: 10 }, (_, i) => (
            <line key={`v${i}`} x1={i * 10} y1="0" x2={i * 10} y2="100" stroke="#000" strokeWidth="0.5" />
          ))}
        </svg>

        {/* Scene counter */}
        <div className="absolute top-3 right-3 text-xs font-mono text-slate-400 bg-white/80 px-2 py-0.5 rounded-full border border-slate-200">
          {currentIndex + 1} / {scenes.length}
        </div>

        {/* Stickman — takes up top 65% of the canvas */}
        <div className="absolute inset-x-0 top-0 h-[65%] flex items-center justify-center px-8 pt-8">
          <StickmanSvg pose={scene.pose} animKey={currentIndex} />
        </div>

        {/* Caption panel — bottom 35% */}
        <div className="absolute inset-x-0 bottom-0 h-[35%] flex items-start justify-center px-5 pt-3">
          <p
            className="text-center text-slate-800 font-medium leading-snug"
            style={{ fontSize: "clamp(13px, 3.5vw, 17px)" }}
          >
            {scene.caption}
          </p>
        </div>

        {/* Loading overlay */}
        {loadingVoiceover && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <span className="text-xs">Generating voiceover…</span>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-center text-sm text-red-500">{error}</p>
      )}

      {/* Progress bar */}
      <div className="w-full max-w-[360px] mx-auto h-1 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full bg-orange-400 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 max-w-[360px] mx-auto">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous scene"
        >
          <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {isPlaying ? (
          <button
            type="button"
            onClick={handlePause}
            className="p-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white transition-colors shadow"
            aria-label="Pause"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePlay}
            className="p-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white transition-colors shadow"
            aria-label="Play"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </button>
        )}

        <button
          type="button"
          onClick={handleNext}
          disabled={currentIndex === scenes.length - 1}
          className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next scene"
        >
          <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Scene dots */}
      <div className="flex items-center justify-center gap-1.5 max-w-[360px] mx-auto flex-wrap">
        {scenes.map((s, i) => (
          <button
            key={s.sceneIndex}
            type="button"
            onClick={() => {
              setCurrentIndex(i);
              if (!isPlaying) handlePlay();
            }}
            className={`w-2 h-2 rounded-full transition-all ${
              i === currentIndex ? "bg-orange-500 scale-125" : "bg-slate-300 hover:bg-slate-400"
            }`}
            aria-label={`Go to scene ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
