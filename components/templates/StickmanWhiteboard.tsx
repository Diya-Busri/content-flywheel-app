"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Public types ─────────────────────────────────────────────────────────────

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

// ─── SVG element types ────────────────────────────────────────────────────────
// ViewBox: 0 0 160 180
// k="L" → stroke line (draw-on)
// k="C" → stroke circle (draw-on)
// k="P" → stroke path (draw-on)
// k="D" → filled dot (pop-in)

type El =
  | { k: "L"; x1: number; y1: number; x2: number; y2: number; delay: number; sw?: number }
  | { k: "C"; cx: number; cy: number; r: number; delay: number; sw?: number }
  | { k: "P"; p: string; delay: number; sw?: number }
  | { k: "D"; cx: number; cy: number; r: number; delay: number };

// ─── Stroke widths ────────────────────────────────────────────────────────────

const SW = 3.6;   // stickman body
const FW = 2.2;   // face features
const PW = 2.4;   // props

// ─── Low-level helpers ────────────────────────────────────────────────────────

const L = (x1: number, y1: number, x2: number, y2: number, delay: number, sw = SW): El =>
  ({ k: "L", x1, y1, x2, y2, delay, sw });

const C = (cx: number, cy: number, r: number, delay: number, sw = SW): El =>
  ({ k: "C", cx, cy, r, delay, sw });

const P = (p: string, delay: number, sw = PW): El =>
  ({ k: "P", p, delay, sw });

const D = (cx: number, cy: number, r: number, delay: number): El =>
  ({ k: "D", cx, cy, r, delay });

// ─── Composite helpers ────────────────────────────────────────────────────────

/** Asterisk-style sparkle ✦ */
const sparkle = (cx: number, cy: number, R: number, delay: number): El[] => {
  const d = R * 0.65;
  return [
    L(cx - R, cy, cx + R, cy, delay, PW),
    L(cx, cy - R, cx, cy + R, delay + 60, PW),
    L(cx - d, cy - d, cx + d, cy + d, delay + 120, PW),
    L(cx - d, cy + d, cx + d, cy - d, delay + 180, PW),
  ];
};

/** Downward arrow */
const arrowDown = (x: number, y1: number, y2: number, delay: number): El[] => [
  L(x, y1, x, y2, delay, PW),
  L(x - 5, y2 - 8, x, y2, delay + 130, PW),
  L(x + 5, y2 - 8, x, y2, delay + 160, PW),
];

/** Exclamation mark */
const exclaim = (cx: number, y1: number, delay: number): El[] => [
  L(cx, y1, cx, y1 + 18, delay, PW),
  D(cx, y1 + 24, 1.8, delay + 200),
];

/** Horizontal motion lines (speed lines pointing left) */
const speedLines = (rightEdge: number, yStart: number, delay: number): El[] =>
  [24, 18, 22, 15].map((len, i) =>
    L(rightEdge - len, yStart + i * 14, rightEdge, yStart + i * 14, delay + i * 70, PW)
  );

/** Question mark drawn with path + dot */
const qmark = (cx: number, cy: number, s: number, delay: number): El[] => [
  P(
    `M ${cx - 3 * s} ${cy - 1 * s}` +
    ` Q ${cx - 3 * s} ${cy - 8 * s} ${cx} ${cy - 8 * s}` +
    ` Q ${cx + 3 * s} ${cy - 8 * s} ${cx + 3 * s} ${cy - 3.5 * s}` +
    ` Q ${cx + 3 * s} ${cy} ${cx} ${cy}` +
    ` L ${cx} ${cy + 2 * s}`,
    delay, PW
  ),
  D(cx, cy + 4.5 * s, 1.4 * s, delay + 260),
];

/** Chart: Y-axis, X-axis, upward trend line + dots */
const chart = (ox: number, oy: number, delay: number): El[] => [
  // Axes
  L(ox, oy - 5, ox, oy + 88, delay, PW),           // Y-axis
  L(ox, oy + 88, ox + 46, oy + 88, delay + 100, PW), // X-axis
  // Arrow on Y-axis
  L(ox - 4, oy + 4, ox, oy - 5, delay + 80, PW),
  L(ox + 4, oy + 4, ox, oy - 5, delay + 100, PW),
  // Trend line going up-right
  P(`M ${ox + 6} ${oy + 78} L ${ox + 16} ${oy + 55} L ${ox + 28} ${oy + 30} L ${ox + 40} ${oy + 8}`, delay + 300, PW),
  // Dots on trend
  D(ox + 6,  oy + 78, 2.5, delay + 380),
  D(ox + 16, oy + 55, 2.5, delay + 420),
  D(ox + 28, oy + 30, 2.5, delay + 460),
  D(ox + 40, oy + 8,  2.5, delay + 500),
];

/** Laptop: screen + keyboard on a desk */
const laptop = (sx: number, sy: number, delay: number): El[] => [
  // Screen frame
  L(sx, sy,      sx + 28, sy,      delay,       PW), // top
  L(sx + 28, sy, sx + 28, sy + 22, delay + 80,  PW), // right
  L(sx, sy + 22, sx + 28, sy + 22, delay + 160, PW), // bottom (hinge)
  L(sx, sy,      sx, sy + 22,      delay + 240, PW), // left
  // Screen content lines
  L(sx + 4, sy + 7,  sx + 24, sy + 7,  delay + 340, PW),
  L(sx + 4, sy + 13, sx + 18, sy + 13, delay + 380, PW),
  // Keyboard base
  L(sx - 3, sy + 22, sx + 31, sy + 22, delay + 440, PW),
  L(sx - 3, sy + 26, sx + 31, sy + 26, delay + 480, PW),
];

/** Thought bubble: three escalating circles */
const thoughtBubble = (tx: number, ty: number, delay: number): El[] => [
  C(tx,      ty + 12, 3.5,  delay,       PW),
  C(tx + 14, ty,      6,    delay + 150, PW),
  C(tx + 32, ty - 10, 13,   delay + 300, PW),
  // "?" inside big circle
  ...qmark(tx + 32, ty - 6, 1, delay + 500),
];

/** Sweat drop (wavy teardrop) */
const sweatDrop = (cx: number, cy: number, delay: number): El[] => [
  P(`M ${cx} ${cy} Q ${cx + 5} ${cy + 8} ${cx + 3} ${cy + 13} Q ${cx} ${cy + 16} ${cx - 3} ${cy + 13} Q ${cx - 5} ${cy + 8} ${cx} ${cy}`, delay, PW),
];

// ─── Face builder ─────────────────────────────────────────────────────────────

type FaceExpr = "neutral" | "smile" | "grin" | "frown" | "curious" | "excited" | "determined";

function mkFace(cx: number, cy: number, expr: FaceExpr): El[] {
  // Eye & brow geometry
  const EX = 5.5, EY = cy - 2.5;
  const BX = 6.5, BY = cy - 9;

  const eyes: El[] = [D(cx - EX, EY, 1.8, 140), D(cx + EX, EY, 1.8, 175)];

  const browFlat = (): El[] => [
    L(cx - BX, BY, cx - 1.5, BY, 215, FW),
    L(cx + 1.5, BY, cx + BX, BY, 245, FW),
  ];
  const browHappy = (): El[] => [
    L(cx - BX, BY, cx - 1.5, BY - 1.5, 215, FW),
    L(cx + 1.5, BY - 1.5, cx + BX, BY, 245, FW),
  ];
  const browSad = (): El[] => [
    L(cx - BX, BY - 2, cx - 1.5, BY, 215, FW),
    L(cx + 1.5, BY, cx + BX, BY - 2, 245, FW),
  ];
  const browCurious = (): El[] => [
    L(cx - BX, BY, cx - 1.5, BY - 0.5, 215, FW),
    L(cx + 1.5, BY - 3.5, cx + BX, BY - 1.5, 245, FW), // right raised
  ];
  const browExcited = (): El[] => [
    L(cx - BX, BY - 2, cx - 1.5, BY - 4, 215, FW),
    L(cx + 1.5, BY - 4, cx + BX, BY - 2, 245, FW),
  ];

  let brows: El[];
  let mouth: El;

  switch (expr) {
    case "smile":
      brows = browHappy();
      mouth = P(`M ${cx-5} ${cy+4} Q ${cx} ${cy+9} ${cx+5} ${cy+4}`, 280, FW);
      break;
    case "grin":
      brows = browHappy();
      mouth = P(`M ${cx-7} ${cy+3} Q ${cx} ${cy+11} ${cx+7} ${cy+3}`, 280, FW + 0.3);
      break;
    case "frown":
      brows = browSad();
      mouth = P(`M ${cx-5} ${cy+8} Q ${cx} ${cy+3} ${cx+5} ${cy+8}`, 280, FW);
      break;
    case "curious":
      brows = browCurious();
      mouth = P(`M ${cx-4} ${cy+4} Q ${cx} ${cy+7.5} ${cx+4} ${cy+4}`, 280, FW);
      break;
    case "excited":
      brows = browExcited();
      mouth = C(cx, cy + 5, 3.5, 280, FW); // open O
      break;
    case "determined":
      brows = [
        L(cx - BX, BY - 0.5, cx - 1.5, BY, 215, FW),
        L(cx + 1.5, BY, cx + BX, BY - 0.5, 245, FW),
      ];
      mouth = L(cx - 3.5, cy + 5, cx + 3.5, cy + 5, 280, FW);
      break;
    default: // neutral
      brows = browFlat();
      mouth = L(cx - 4, cy + 5, cx + 4, cy + 5, 280, FW);
  }

  return [...eyes, ...brows, mouth];
}

// ─── Standard body segments ───────────────────────────────────────────────────

interface BodyArgs {
  cx: number; cy: number;       // head centre
  lArm: [number, number];
  rArm: [number, number];
  lLeg: [number, number];
  rLeg: [number, number];
  shoulderY?: number;           // offset from cy (default +28)
  hipY?: number;                // absolute Y (default cy+66)
  extraLimbs?: El[];            // e.g. bent forearm
}

function mkBody({ cx, cy, lArm, rArm, lLeg, rLeg, shoulderY = 28, hipY, extraLimbs = [] }: BodyArgs): El[] {
  const neck = cy + 14;
  const shoulder = cy + shoulderY;
  const hip = hipY ?? cy + 66;
  return [
    C(cx, cy, 14, 0),                                    // head
    L(cx, neck, cx, hip, 270),                           // body
    L(cx, shoulder, lArm[0], lArm[1], 500, SW),         // L arm
    L(cx, shoulder, rArm[0], rArm[1], 650, SW),         // R arm
    L(cx, hip, lLeg[0], lLeg[1], 820, SW),              // L leg
    L(cx, hip, rLeg[0], rLeg[1], 970, SW),              // R leg
    ...extraLimbs,
  ];
}

// ─── Pose definitions ─────────────────────────────────────────────────────────

const POSES: Record<StickmanPose, El[]> = {
  // ── STANDING — centred, neutral. Props: floating question marks (hook/intro)
  standing: [
    ...mkBody({
      cx: 80, cy: 30,
      lArm: [56, 56], rArm: [104, 56],
      lLeg: [65, 135], rLeg: [95, 135],
    }),
    ...mkFace(80, 30, "neutral"),
    // Question marks scattered around
    ...qmark(28, 52, 1.1, 1120),
    ...qmark(134, 36, 0.95, 1280),
    ...qmark(148, 88, 0.8, 1440),
  ],

  // ── THINKING — shifted left, right arm to chin. Props: thought bubble top-right
  thinking: [
    ...mkBody({
      cx: 58, cy: 30,
      lArm: [33, 56], rArm: [74, 44],
      lLeg: [43, 135], rLeg: [73, 135],
      extraLimbs: [L(74, 44, 68, 33, 800, SW)], // forearm to chin
    }),
    ...mkFace(58, 30, "curious"),
    ...thoughtBubble(86, 52, 1100),
  ],

  // ── SITTING — at desk left, laptop right
  sitting: [
    // Body (shorter — seated)
    C(58, 26, 14, 0),                        // head
    L(58, 40, 58, 82, 270),                  // body
    L(58, 54, 38, 66, 500, SW),              // L arm (resting on desk)
    L(58, 54, 78, 66, 650, SW),              // R arm (resting on desk)
    L(58, 82, 32, 90, 820, SW),             // L thigh (horizontal)
    L(32, 90, 32, 126, 900, SW),            // L shin (vertical)
    L(58, 82, 84, 90, 970, SW),             // R thigh
    L(84, 90, 84, 126, 1050, SW),           // R shin
    // Desk surface
    L(18, 66, 118, 66, 1200, PW + 0.4),
    L(18, 69, 118, 69, 1230, PW),            // desk thickness
    ...mkFace(58, 26, "determined"),
    // Laptop
    ...laptop(88, 42, 1350),
  ],

  // ── CELEBRATING — arms raised high. Props: sparkles at corners
  celebrating: [
    ...mkBody({
      cx: 80, cy: 30,
      lArm: [42, 8],   // raised high left
      rArm: [118, 8],  // raised high right
      lLeg: [60, 135], rLeg: [100, 135],
    }),
    ...mkFace(80, 30, "grin"),
    // Sparkles
    ...sparkle(26, 18, 11, 1080),
    ...sparkle(134, 18, 11, 1180),
    ...sparkle(16, 68, 7, 1280),
    ...sparkle(144, 68, 7, 1350),
    ...sparkle(80, 6, 5, 1450),   // small sparkle above head
  ],

  // ── POINTING — stickman hard-left, arm extended right. Props: chart
  pointing: [
    ...mkBody({
      cx: 46, cy: 30,
      lArm: [20, 56],              // L arm hanging down
      rArm: [112, 52],             // R arm fully extended → pointing
      lLeg: [30, 135], rLeg: [62, 135],
      shoulderY: 26,
    }),
    ...mkFace(46, 30, "smile"),
    // Upward-trending chart on the right
    ...chart(116, 18, 1080),
  ],

  // ── DEFEATED — arms hanging inward. Props: down-arrows + sweat drop
  defeated: [
    // Slightly tilted head for sad slumped look
    C(82, 32, 14, 0),
    L(80, 46, 80, 92, 270),
    L(80, 60, 62, 84, 500, SW),    // L arm hanging in
    L(80, 60, 98, 84, 650, SW),    // R arm hanging in
    L(80, 92, 68, 135, 820, SW),   // legs closer together
    L(80, 92, 92, 135, 970, SW),
    ...mkFace(82, 32, "frown"),
    // Down-arrows on left
    ...arrowDown(30, 48, 80, 1100),
    ...arrowDown(18, 62, 90, 1250),
    // Sweat drop near head
    ...sweatDrop(98, 26, 1380),
  ],

  // ── ARMS-RAISED — full V. Props: exclamation marks + starburst
  "arms-raised": [
    ...mkBody({
      cx: 80, cy: 30,
      lArm: [34, 4],    // V shape high-left
      rArm: [126, 4],   // V shape high-right
      lLeg: [64, 135], rLeg: [96, 135],
    }),
    ...mkFace(80, 30, "excited"),
    // Starburst between raised arms (centred top)
    ...sparkle(80, 10, 8, 1060),
    // Exclamation marks
    ...exclaim(22, 48, 1200),
    ...exclaim(138, 48, 1320),
    // Extra tiny sparkles
    ...sparkle(20, 22, 5, 1420),
    ...sparkle(140, 22, 5, 1480),
  ],

  // ── WALKING — stickman left-of-centre, striding. Props: speed lines + ground
  walking: [
    ...mkBody({
      cx: 70, cy: 28,
      lArm: [48, 50],    // L arm forward
      rArm: [90, 56],    // R arm back
      lLeg: [46, 132],   // L leg forward
      rLeg: [92, 135],   // R leg trailing
    }),
    ...mkFace(70, 28, "determined"),
    // Speed lines to the left
    ...speedLines(46, 48, 1060),
    // Ground line
    L(6, 138, 154, 138, 1240, PW),
  ],
};

// ─── StickmanSvg renderer ─────────────────────────────────────────────────────

function StickmanSvg({ pose, animKey }: { pose: StickmanPose; animKey: number }) {
  const elements = POSES[pose] ?? POSES.standing;

  return (
    <svg
      key={animKey}
      viewBox="0 0 160 180"
      className="w-full h-full"
      aria-label={`Stickman: ${pose}`}
    >
      <style>{`
        @keyframes cf-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes cf-pop {
          0%   { opacity: 0; transform: scale(0.3); }
          60%  { opacity: 1; transform: scale(1.15); }
          100% { opacity: 1; transform: scale(1); }
        }
        .cf-stroke {
          fill: none;
          stroke: #111827;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 600;
          stroke-dashoffset: 600;
          animation: cf-draw 0.42s ease-out forwards;
        }
        .cf-dot {
          opacity: 0;
          fill: #111827;
          transform-box: fill-box;
          transform-origin: center;
          animation: cf-pop 0.2s ease-out forwards;
        }
      `}</style>

      {elements.map((el, i) => {
        if (el.k === "D") {
          return (
            <circle
              key={i}
              className="cf-dot"
              cx={el.cx}
              cy={el.cy}
              r={el.r}
              style={{ animationDelay: `${el.delay}ms` }}
            />
          );
        }
        const style: React.CSSProperties = { animationDelay: `${el.delay}ms` };
        const sw = el.sw ?? SW;
        if (el.k === "L") {
          return (
            <line
              key={i}
              className="cf-stroke"
              x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2}
              strokeWidth={sw}
              style={style}
            />
          );
        }
        if (el.k === "C") {
          return (
            <circle
              key={i}
              className="cf-stroke"
              cx={el.cx} cy={el.cy} r={el.r}
              strokeWidth={sw}
              style={style}
            />
          );
        }
        // k === "P"
        return (
          <path
            key={i}
            className="cf-stroke"
            d={el.p}
            strokeWidth={sw}
            style={style}
          />
        );
      })}
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

export function StickmanWhiteboard({ scenes, voiceId, autoPlay = true, onComplete }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying]       = useState(autoPlay);
  const [loadingVO, setLoadingVO]       = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const audioRef            = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef       = useRef<Map<number, string>>(new Map());
  const prefetchInFlightRef = useRef<Set<number>>(new Set());
  const mountedRef          = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      audioCacheRef.current.forEach((u) => URL.revokeObjectURL(u));
      audioCacheRef.current.clear();
    };
  }, []);

  const fetchVO = useCallback(
    async (idx: number): Promise<string | null> => {
      const cached = audioCacheRef.current.get(idx);
      if (cached) return cached;
      if (prefetchInFlightRef.current.has(idx)) return null;
      prefetchInFlightRef.current.add(idx);
      try {
        const scene = scenes[idx];
        if (!scene) return null;
        const res = await fetch("/api/templates/stickman/voiceover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: scene.caption, sceneIndex: idx, voiceId: voiceId ?? DEFAULT_VOICE_ID }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        if (mountedRef.current) { audioCacheRef.current.set(idx, url); return url; }
        URL.revokeObjectURL(url);
        return null;
      } catch (e) {
        console.error("[StickmanWhiteboard] voiceover", e);
        return null;
      } finally {
        prefetchInFlightRef.current.delete(idx);
      }
    },
    [scenes, voiceId]
  );

  const prefetchAhead = useCallback(
    (from: number) => {
      for (let i = from + 1; i <= from + 2 && i < scenes.length; i++) {
        if (!audioCacheRef.current.has(i) && !prefetchInFlightRef.current.has(i)) void fetchVO(i);
      }
    },
    [fetchVO, scenes.length]
  );

  const playScene = useCallback(
    async (idx: number) => {
      if (!mountedRef.current) return;
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.onended = null; }
      setLoadingVO(true); setError(null);
      const url = await fetchVO(idx);
      prefetchAhead(idx);
      if (!mountedRef.current) return;
      setLoadingVO(false);
      if (!url) { setError("Could not load voiceover — check your ElevenLabs API key."); return; }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        if (!mountedRef.current) return;
        const next = idx + 1;
        if (next < scenes.length) setCurrentIndex(next);
        else { setIsPlaying(false); onComplete?.(); }
      };
      audio.onerror = () => { if (mountedRef.current) setError("Audio playback error."); };
      try { await audio.play(); } catch { setError("Playback blocked — click ▶ to start."); setIsPlaying(false); }
    },
    [fetchVO, prefetchAhead, scenes.length, onComplete]
  );

  useEffect(() => {
    if (!isPlaying || scenes.length === 0) return;
    void playScene(currentIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, isPlaying]);

  useEffect(() => {
    if (!isPlaying) audioRef.current?.pause();
  }, [isPlaying]);

  const handlePlay  = () => { setIsPlaying(true); if (!audioRef.current || audioRef.current.paused) void playScene(currentIndex); };
  const handlePause = () => { setIsPlaying(false); audioRef.current?.pause(); };
  const handlePrev  = () => { if (currentIndex > 0) setCurrentIndex((i) => i - 1); };
  const handleNext  = () => { if (currentIndex < scenes.length - 1) setCurrentIndex((i) => i + 1); };

  const scene    = scenes[currentIndex];
  if (!scene) return null;
  const progress = scenes.length > 1 ? (currentIndex / (scenes.length - 1)) * 100 : 100;

  return (
    <div className="flex flex-col gap-4 w-full select-none">
      {/* Whiteboard */}
      <div
        className="relative rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
        style={{ aspectRatio: "9/16", width: "100%", maxWidth: 360, margin: "0 auto" }}
      >
        {/* Very faint horizontal ruled lines — like a notepad */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 160" preserveAspectRatio="none"
          style={{ opacity: 0.03 }}
        >
          {Array.from({ length: 16 }, (_, i) => (
            <line key={i} x1="0" y1={i * 10} x2="100" y2={i * 10} stroke="#000" strokeWidth="0.6" />
          ))}
        </svg>

        {/* Scene counter */}
        <div className="absolute top-3 right-3 z-10 text-[10px] font-mono text-slate-400 bg-white/80 px-2 py-0.5 rounded-full border border-slate-200">
          {currentIndex + 1} / {scenes.length}
        </div>

        {/* Stickman — top 62% of canvas */}
        <div className="absolute inset-x-0 top-0 h-[62%] flex items-end justify-center pb-2 pt-3 px-4">
          <StickmanSvg pose={scene.pose} animKey={currentIndex} />
        </div>

        {/* Caption — bottom 38% */}
        <div className="absolute inset-x-0 bottom-0 h-[38%] flex items-start justify-center px-5 pt-2">
          <p
            className="text-center text-slate-800 font-semibold leading-snug tracking-tight"
            style={{ fontSize: "clamp(12px, 3.2vw, 16px)" }}
          >
            {scene.caption}
          </p>
        </div>

        {/* Loading spinner */}
        {loadingVO && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm z-20">
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <svg className="w-7 h-7 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <span className="text-xs">Generating voice…</span>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-center text-sm text-red-500">{error}</p>}

      {/* Progress */}
      <div className="w-full max-w-[360px] mx-auto h-1 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full bg-orange-400 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 max-w-[360px] mx-auto">
        <button type="button" onClick={handlePrev} disabled={currentIndex === 0}
          className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous">
          <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>

        {isPlaying ? (
          <button type="button" onClick={handlePause}
            className="p-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow transition-colors" aria-label="Pause">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          </button>
        ) : (
          <button type="button" onClick={handlePlay}
            className="p-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow transition-colors" aria-label="Play">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
        )}

        <button type="button" onClick={handleNext} disabled={currentIndex === scenes.length - 1}
          className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next">
          <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {/* Scene dots */}
      <div className="flex items-center justify-center gap-2 max-w-[360px] mx-auto flex-wrap">
        {scenes.map((s, i) => (
          <button
            key={s.sceneIndex}
            type="button"
            onClick={() => { setCurrentIndex(i); if (!isPlaying) handlePlay(); }}
            className={`w-2 h-2 rounded-full transition-all ${i === currentIndex ? "bg-orange-500 scale-125" : "bg-slate-300 hover:bg-slate-400"}`}
            aria-label={`Scene ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
