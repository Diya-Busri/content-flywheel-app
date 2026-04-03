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

export type StickmanLayout = "left-presenter" | "center-presenter" | "right-presenter" | "desk-scene";
export type StickmanKeyObject = "chart" | "clock" | "money" | "warning" | "audience" | "idea" | "brand";
export type StickmanCamera = "wide" | "medium";
export type StickmanShotTemplate =
  | "desk-explain"
  | "stand-explain"
  | "point-to-board"
  | "walk-and-talk"
  | "result-moment";

export interface StickmanScene {
  sceneIndex: number;
  /** Full VO script (ElevenLabs reads this). */
  caption: string;
  /** Short headline on the whiteboard (Shorts-style hook). */
  sceneTitle?: string;
  /** 2–3 punchy lines shown as a list while VO plays (tutorial-style). */
  bullets?: string[];
  pose: StickmanPose;
  layout?: StickmanLayout;
  keyObject?: StickmanKeyObject;
  camera?: StickmanCamera;
  shotTemplate?: StickmanShotTemplate;
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

// ─── Stroke widths (slightly bolder for crisp HD scaling) ─────────────────────

const SW = 4.1;   // stickman body / limbs
const FW = 2.65;  // face features
const PW = 2.75;  // props / desk / laptop

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

  const eyes: El[] = [D(cx - EX, EY, 2.15, 140), D(cx + EX, EY, 2.15, 175)];

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
  // ── STANDING — presenter stance; no floating symbols (those read as clutter next to KeyObjectDoodle)
  standing: [
    ...mkBody({
      cx: 80,
      cy: 30,
      lArm: [54, 58],
      rArm: [106, 58],
      lLeg: [66, 135],
      rLeg: [94, 135],
    }),
    ...mkFace(80, 30, "smile"),
    // Subtle “stage” line under feet — grounds the figure
    L(52, 138, 108, 138, 1080, PW),
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
  const depthDx = 1.8;
  const depthDy = 1.8;

  // Perpendicular highlight for 3D tube effect on a line segment
  const tubeHighlight = (x1: number, y1: number, x2: number, y2: number, delay: number): React.ReactNode => {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return null;
    const nx = (-dy / len) * 2.0, ny = (dx / len) * 2.0;
    return (
      <line
        x1={x1 + nx} y1={y1 + ny} x2={x2 + nx} y2={y2 + ny}
        style={{
          stroke: "rgba(255,255,255,0.85)", strokeWidth: 1.95,
          strokeLinecap: "round",
          strokeDasharray: 600, strokeDashoffset: 600,
          animation: "cf-draw 0.55s ease-out forwards",
          animationDelay: `${delay + 20}ms`,
        }}
      />
    );
  };

  const isHeadCircle = (el: El) => el.k === "C" && el.delay === 0 && el.r >= 12;

  return (
    <svg
      key={animKey}
      viewBox="0 0 160 180"
      className="w-full h-full [shape-rendering:geometricPrecision]"
      aria-label={`Stickman: ${pose}`}
    >
      <defs>
        <filter
          id={`cfStickmanInk-${animKey}`}
          x="-25%"
          y="-25%"
          width="150%"
          height="150%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="0.45" result="blur" />
          <feOffset in="blur" dx="0.35" dy="1.1" result="off" />
          <feFlood floodColor="#1a1208" floodOpacity="0.2" result="flood" />
          <feComposite in="flood" in2="off" operator="in" result="sh" />
          <feMerge>
            <feMergeNode in="sh" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id={`cfHeadFill-${animKey}`} cx="32%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#fffdf8" />
          <stop offset="55%" stopColor="#f3ece0" />
          <stop offset="100%" stopColor="#e8dfd0" />
        </radialGradient>
        <radialGradient id={`cfEyeGrad-${animKey}`} cx="32%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="35%" stopColor="#3d3830" />
          <stop offset="100%" stopColor="#0f0d0b" />
        </radialGradient>
      </defs>
      <style>{`
        @keyframes cf-draw { to { stroke-dashoffset: 0; } }
        @keyframes cf-pop {
          0%   { opacity: 0; transform: scale(0.3); }
          60%  { opacity: 1; transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes cf-shadow-in { to { opacity: 1; } }
        @keyframes cf-head-fill-in {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        .cf-stroke {
          fill: none; stroke: #100e0c;
          stroke-linecap: round; stroke-linejoin: round;
          stroke-dasharray: 600; stroke-dashoffset: 600;
          animation: cf-draw 0.55s ease-out forwards;
          paint-order: stroke fill;
        }
        .cf-dot {
          opacity: 0;
          transform-box: fill-box; transform-origin: center;
          animation: cf-pop 0.22s cubic-bezier(.34,1.56,.64,1) forwards;
        }
        .cf-dot-eye { fill: url(#cfEyeGrad-${animKey}); }
        .cf-dot-solid { fill: #100e0c; }
        .cf-head-fill {
          opacity: 0;
          animation: cf-head-fill-in 0.38s ease-out 0.05s forwards;
        }
      `}</style>

      {/* Ground shadow — gives 3D grounded feel */}
      <ellipse cx="83" cy="168" rx="40" ry="8"
        style={{ fill: "rgba(0,0,0,0.09)", opacity: 0,
          animation: "cf-shadow-in 0.45s ease-out 0.12s forwards" }} />

      {/* Depth pass: slight offset/extrusion behind main ink lines */}
      {elements.map((el, i) => {
        const sw = ((el as { sw?: number }).sw ?? SW) + 0.3;
        if (el.k === "D") {
          return (
            <circle
              key={`depth-dot-${i}`}
              cx={el.cx + depthDx}
              cy={el.cy + depthDy}
              r={el.r}
              style={{
                fill: "rgba(0,0,0,0.14)",
                opacity: 0,
                transformBox: "fill-box",
                transformOrigin: "center",
                animation: "cf-pop 0.2s ease-out forwards",
                animationDelay: `${el.delay + 30}ms`,
              }}
            />
          );
        }

        if (el.k === "L") {
          return (
            <line
              key={`depth-line-${i}`}
              x1={el.x1 + depthDx}
              y1={el.y1 + depthDy}
              x2={el.x2 + depthDx}
              y2={el.y2 + depthDy}
              style={{
                fill: "none",
                stroke: "rgba(0,0,0,0.11)",
                strokeWidth: sw,
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeDasharray: 600,
                strokeDashoffset: 600,
                animation: "cf-draw 0.55s ease-out forwards",
                animationDelay: `${el.delay + 25}ms`,
              }}
            />
          );
        }

        if (el.k === "C") {
          return (
            <circle
              key={`depth-circle-${i}`}
              cx={el.cx + depthDx}
              cy={el.cy + depthDy}
              r={el.r}
              style={{
                fill: "none",
                stroke: "rgba(0,0,0,0.11)",
                strokeWidth: sw,
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeDasharray: 600,
                strokeDashoffset: 600,
                animation: "cf-draw 0.55s ease-out forwards",
                animationDelay: `${el.delay + 25}ms`,
              }}
            />
          );
        }

        return (
          <path
            key={`depth-path-${i}`}
            d={el.p}
            style={{
              fill: "none",
              stroke: "rgba(0,0,0,0.11)",
              strokeWidth: sw,
              strokeLinecap: "round",
              strokeLinejoin: "round",
              strokeDasharray: 600,
              strokeDashoffset: 600,
              animation: "cf-draw 0.55s ease-out forwards",
              animationDelay: `${el.delay + 25}ms`,
            }}
            transform={`translate(${depthDx} ${depthDy})`}
          />
        );
      })}

      <g filter={`url(#cfStickmanInk-${animKey})`}>
        {elements.map((el, i) => {
          if (el.k === "D") {
            const eyeGrad = el.r >= 2.05 && el.r <= 2.35;
            return (
              <circle
                key={i}
                className={`cf-dot ${eyeGrad ? "cf-dot-eye" : "cf-dot-solid"}`}
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
              <g key={i}>
                <line
                  className="cf-stroke"
                  x1={el.x1}
                  y1={el.y1}
                  x2={el.x2}
                  y2={el.y2}
                  strokeWidth={sw}
                  style={style}
                />
                {sw >= 2.85 && tubeHighlight(el.x1, el.y1, el.x2, el.y2, el.delay)}
              </g>
            );
          }

          if (el.k === "C") {
            const hr = el.r * 0.28;
            const head = isHeadCircle(el);
            return (
              <g key={i}>
                {head ? (
                  <circle
                    className="cf-head-fill"
                    cx={el.cx}
                    cy={el.cy}
                    r={Math.max(el.r - 0.55, 0.5)}
                    fill={`url(#cfHeadFill-${animKey})`}
                  />
                ) : null}
                <circle className="cf-stroke" cx={el.cx} cy={el.cy} r={el.r} strokeWidth={sw} style={style} />
                <circle
                  cx={el.cx - el.r * 0.3}
                  cy={el.cy - el.r * 0.3}
                  r={hr}
                  style={{
                    fill: "rgba(255,255,255,0.88)",
                    opacity: 0,
                    animation: "cf-pop 0.2s ease-out forwards",
                    animationDelay: `${el.delay + 80}ms`,
                    transformBox: "fill-box",
                    transformOrigin: "center",
                  }}
                />
                <circle
                  cx={el.cx + el.r * 0.22}
                  cy={el.cy + el.r * 0.28}
                  r={el.r * 0.18}
                  style={{
                    fill: "rgba(0,0,0,0.08)",
                    opacity: 0,
                    animation: "cf-pop 0.2s ease-out forwards",
                    animationDelay: `${el.delay + 100}ms`,
                    transformBox: "fill-box",
                    transformOrigin: "center",
                  }}
                />
              </g>
            );
          }

          return (
            <path key={i} className="cf-stroke" d={el.p} strokeWidth={sw} style={style} />
          );
        })}
      </g>
    </svg>
  );
}

// ─── Caption lines (staggered slide-in, first line orange) ───────────────────

/** First sentence (or first chunk) = orange hook; rest = supporting lines — reads like a Short hook + payoff. */
function splitCaptionHook(raw: string): { hook: string; body: string } {
  const text = raw.trim();
  if (!text) return { hook: "", body: "" };
  const sentence = text.match(/^(.{1,100}?[.!?])(\s+|$)/);
  if (sentence && sentence[1].length >= 12 && sentence[1].length <= 110) {
    const hook = sentence[1].trim();
    const body = text.slice(sentence[1].length).trim();
    return { hook, body };
  }
  const words = text.split(/\s+/).filter(Boolean);
  const hookLen = Math.min(12, Math.max(5, Math.ceil(words.length * 0.38)));
  if (words.length <= hookLen) return { hook: text, body: "" };
  return {
    hook: words.slice(0, hookLen).join(" "),
    body: words.slice(hookLen).join(" "),
  };
}

/** Headline + bullet list on the board; full `caption` stays audio-only when bullets are present (matches common AI stickman tutorial layout). */
function TutorialBoardText({
  sceneTitle,
  bullets,
  caption,
  sceneKey,
}: {
  sceneTitle?: string;
  bullets?: string[];
  caption: string;
  sceneKey: number;
}) {
  const title = sceneTitle?.trim() ?? "";
  const list = (bullets ?? []).map((b) => b.trim()).filter(Boolean);
  const hasBullets = list.length >= 2;
  const titleDelay = 90;
  const bulletBaseDelay = title ? titleDelay + 240 : titleDelay;

  return (
    <div key={sceneKey} style={{ position: "relative" }}>
      {title ? (
        <div
          className="cf-line"
          style={{
            animationDelay: `${titleDelay}ms`,
            fontFamily: "'Caveat', cursive",
            fontWeight: 700,
            fontSize: "clamp(1.15rem, 1.35rem + 0.65vw, 2.35rem)",
            lineHeight: 1.12,
            color: "#c2410c",
            marginBottom: "0.28em",
            letterSpacing: "0.01em",
            textShadow: "0 1px 0 rgba(255,255,255,0.6)",
          }}
        >
          {title}
        </div>
      ) : null}
      {list.map((line, i) => (
        <div
          key={i}
          className="cf-line"
          style={{
            animationDelay: `${bulletBaseDelay + i * 230}ms`,
            fontFamily: "'Caveat', cursive",
            fontWeight: 600,
            fontSize: "clamp(0.95rem, 1rem + 0.35vw, 1.55rem)",
            lineHeight: 1.14,
            color: "#1e1b12",
            marginBottom: "0.12em",
            paddingLeft: "0.05em",
            display: "flex",
            alignItems: "baseline",
            gap: "0.35em",
          }}
        >
          <span style={{ color: "#ea580c", fontWeight: 700, flexShrink: 0 }}>→</span>
          <span>{line}</span>
        </div>
      ))}
      {!hasBullets && title ? (
        <div style={{ marginTop: "0.35em" }}>
          <AnimatedCaption text={caption} sceneKey={sceneKey * 1000 + 1} />
        </div>
      ) : null}
    </div>
  );
}

function SceneBoardText({ scene }: { scene: StickmanScene }) {
  const title = scene.sceneTitle?.trim() ?? "";
  const bulletCount = (scene.bullets ?? []).filter((b) => b.trim()).length;
  const useTutorial = Boolean(title) || bulletCount >= 2;
  if (!useTutorial) {
    return <AnimatedCaption text={scene.caption} sceneKey={scene.sceneIndex} />;
  }
  return (
    <TutorialBoardText
      sceneTitle={title || undefined}
      bullets={bulletCount >= 2 ? scene.bullets : undefined}
      caption={scene.caption}
      sceneKey={scene.sceneIndex}
    />
  );
}

function AnimatedCaption({ text, sceneKey }: { text: string; sceneKey: number }) {
  const { hook, body } = splitCaptionHook(text);
  const bodyWords = body.split(/\s+/).filter(Boolean);
  const wordsPerLine = bodyWords.length > 52 ? 8 : bodyWords.length > 36 ? 7 : bodyWords.length > 24 ? 6 : 5;
  const lines: string[] = [];
  if (hook) lines.push(hook);
  for (let i = 0; i < bodyWords.length; i += wordsPerLine) {
    lines.push(bodyWords.slice(i, i + wordsPerLine).join(" "));
  }
  if (lines.length === 0) lines.push(text.trim());
  const lineCount = Math.max(lines.length, 1);
  // Use rem-only clamps so caption text scales with layout, not viewport width (avoids huge type on wide screens / flex overflow).
  const titleSize =
    lineCount > 9 ? "clamp(0.9375rem, 1.05rem + 0.4vw, 1.5rem)" :
    lineCount > 7 ? "clamp(1rem, 1.1rem + 0.45vw, 1.75rem)" :
    "clamp(1.05rem, 1.15rem + 0.5vw, 2rem)";
  const bodySize =
    lineCount > 9 ? "clamp(0.75rem, 0.82rem + 0.25vw, 1.125rem)" :
    lineCount > 7 ? "clamp(0.8125rem, 0.88rem + 0.28vw, 1.25rem)" :
    "clamp(0.875rem, 0.95rem + 0.3vw, 1.35rem)";
  const lineHeight = lineCount > 8 ? 1.08 : 1.12;

  return (
    <div key={sceneKey} style={{ position: "relative" }}>
      {lines.map((line, i) => (
        <div
          key={i}
          className="cf-line"
          style={{
            animationDelay: `${100 + i * 260}ms`,
            fontFamily: "'Caveat', cursive",
            fontWeight: i === 0 ? 700 : 600,
            fontSize: i === 0 ? titleSize : bodySize,
            lineHeight,
            color: i === 0 ? "#c2410c" : "#1e1b12",
            marginBottom: i === 0 ? "0.22em" : "0.1em",
            letterSpacing: i === 0 ? "0.01em" : "0",
            textShadow: i === 0 ? "0 1px 0 rgba(255,255,255,0.6)" : undefined,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

// ─── Pose doodle (top-right decorative icon) ──────────────────────────────────

// shared style helpers (used by PoseDoodle)
const _ss = (delay: number, sw = 2.5, da = 300): React.CSSProperties => ({
  fill: "none", stroke: "#1e1b12", strokeWidth: sw,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  strokeDasharray: da, strokeDashoffset: da,
  animation: "cf-draw 0.5s ease-out forwards", animationDelay: `${delay}ms`,
});
const _ds = (delay: number, color = "#1e1b12"): React.CSSProperties => ({
  fill: color, opacity: 0,
  animation: "cf-pop 0.25s ease-out forwards", animationDelay: `${delay}ms`,
  transformBox: "fill-box" as const, transformOrigin: "center",
});
// 3D face fills (orange-tinted)
const TOP3D  = "rgba(234,88,12,0.18)";
const SIDE3D = "rgba(234,88,12,0.09)";
const DARK3D = "rgba(30,27,18,0.06)";

// ─── Pose doodle ─────────────────────────────────────────────────────────────

function PoseDoodle({ pose }: { pose: StickmanPose }) {
  const icons: Record<StickmanPose, React.ReactNode> = {

    // 3D Lightbulb globe (sphere + meridians + rays + socket)
    thinking: (<>
      {/* 3D sphere base */}
      <circle cx="50" cy="36" r="24" style={{ fill: "rgba(251,191,36,0.08)", ..._ss(200, 2, 200) }} />
      {/* latitude lines */}
      <ellipse cx="50" cy="26" rx="16" ry="5"  style={_ss(380, 1.5, 150)} />
      <ellipse cx="50" cy="36" rx="24" ry="7"  style={_ss(440, 1.5, 200)} />
      <ellipse cx="50" cy="46" rx="16" ry="5"  style={_ss(500, 1.5, 150)} />
      {/* meridian */}
      <ellipse cx="50" cy="36" rx="6"  ry="24" style={_ss(560, 1.5, 200)} />
      {/* socket */}
      <line x1="43" y1="60" x2="43" y2="66" style={_ss(650, 2)} />
      <line x1="57" y1="60" x2="57" y2="66" style={_ss(680, 2)} />
      <line x1="42" y1="66" x2="58" y2="66" style={_ss(720, 2)} />
      <line x1="43" y1="71" x2="57" y2="71" style={_ss(760, 2)} />
      {/* rays */}
      {[0,45,90,135,180,225,270,315].map((d,i) => {
        const r = d*Math.PI/180, x1=50+26*Math.cos(r), y1=36+26*Math.sin(r), x2=50+34*Math.cos(r), y2=36+34*Math.sin(r);
        return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} style={_ss(850+i*40, 1.8)} />;
      })}
      {/* inner glow dot */}
      <circle cx="50" cy="36" r="5" style={_ds(950, "rgba(251,191,36,0.6)")} />
    </>),

    // 3D isometric bar chart
    pointing: (<>
      {/* floor */}
      <line x1="6" y1="78" x2="94" y2="78" style={_ss(200, 2)} />
      <line x1="6" y1="78" x2="6"  y2="16" style={_ss(300, 2)} />
      {/* iso bar 1 — short */}
      <polygon points="12,78 26,78 26,62 12,62" style={{ fill: SIDE3D, ..._ss(400, 1.8) }} />
      <polygon points="26,62 36,56 36,72 26,78" style={{ fill: DARK3D, ..._ss(460, 1.8) }} />
      <polygon points="12,62 26,62 36,56 22,50" style={{ fill: TOP3D,  ..._ss(520, 1.8) }} />
      {/* iso bar 2 — medium */}
      <polygon points="38,78 52,78 52,48 38,48" style={{ fill: SIDE3D, ..._ss(560, 1.8) }} />
      <polygon points="52,48 62,42 62,72 52,78" style={{ fill: DARK3D, ..._ss(620, 1.8) }} />
      <polygon points="38,48 52,48 62,42 48,36" style={{ fill: TOP3D,  ..._ss(680, 1.8) }} />
      {/* iso bar 3 — tall */}
      <polygon points="64,78 78,78 78,28 64,28" style={{ fill: SIDE3D, ..._ss(720, 1.8) }} />
      <polygon points="78,28 88,22 88,72 78,78" style={{ fill: DARK3D, ..._ss(780, 1.8) }} />
      <polygon points="64,28 78,28 88,22 74,16" style={{ fill: TOP3D,  ..._ss(840, 1.8) }} />
      {/* arrow up */}
      <line x1="92" y1="30" x2="92" y2="8"  style={_ss(920, 2.5)} />
      <line x1="84" y1="16" x2="92" y2="8"  style={_ss(970, 2.5)} />
      <line x1="100" y1="16" x2="92" y2="8" style={_ss(1010, 2.5)} />
    </>),

    // 3D trophy with star-burst
    celebrating: (<>
      {/* 3D cube base */}
      <polygon points="28,80 50,80 50,70 28,70" style={{ fill: SIDE3D, ..._ss(900, 1.8) }} />
      <polygon points="50,70 50,80 62,74 62,64" style={{ fill: DARK3D, ..._ss(950, 1.8) }} />
      <polygon points="28,70 50,70 62,64 40,64" style={{ fill: TOP3D,  ..._ss(980, 1.8) }} />
      {/* stem */}
      <line x1="45" y1="54" x2="43" y2="64" style={_ss(700, 2)} />
      <line x1="55" y1="54" x2="57" y2="64" style={_ss(730, 2)} />
      {/* cup body */}
      <path d="M28 14 h44 v26 a22 22 0 0 1-44 0 Z" style={{ fill:"rgba(251,191,36,0.10)", ..._ss(200, 2.5) }} />
      {/* handles */}
      <path d="M28 18 Q12 22 12 32 Q12 42 28 46" style={_ss(420, 2)} />
      <path d="M72 18 Q88 22 88 32 Q88 42 72 46" style={_ss(500, 2)} />
      {/* star dots */}
      {[[10,8],[90,8],[6,55],[94,55],[50,6]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r="3.5" style={_ds(1050+i*60, "#f97316")} />
      ))}
      {/* shine lines on cup */}
      <line x1="38" y1="22" x2="36" y2="38" style={_ss(650, 1.5)} />
      <line x1="44" y1="20" x2="42" y2="36" style={_ss(680, 1.5)} />
    </>),

    // 3D extruded question mark
    standing: (<>
      {/* 3D cube behind ? */}
      <polygon points="12,82 38,82 38,70 12,70" style={{ fill: SIDE3D, ..._ss(900, 1.5) }} />
      <polygon points="38,70 38,82 50,76 50,64" style={{ fill: DARK3D, ..._ss(950, 1.5) }} />
      <polygon points="12,70 38,70 50,64 24,64" style={{ fill: TOP3D,  ..._ss(1000,1.5) }} />
      {/* giant ? front */}
      <path d="M32 22 a18 18 0 1 1 22 17 c0 5-4 9-4 17" style={_ss(200, 3.5, 400)} />
      <circle cx="50" cy="72" r="4" style={_ds(750)} />
      {/* shadow/depth lines on ? */}
      <path d="M36 22 a14 14 0 1 1 18 13 c0 4-3 7-3 14" style={{ ..._ss(350, 1.2, 350), stroke:"rgba(234,88,12,0.4)" }} />
      {/* small scatter */}
      <circle cx="16" cy="20" r="2.5" style={_ds(850, "#ea580c")} />
      <circle cx="84" cy="20" r="2.5" style={_ds(900, "#ea580c")} />
      <circle cx="16" cy="65" r="2"   style={_ds(950, "#ea580c")} />
    </>),

    // 3D perspective laptop
    sitting: (<>
      {/* keyboard base — 3D box */}
      <polygon points="8,78 68,78 68,68 8,68"  style={{ fill: SIDE3D, ..._ss(700, 1.8) }} />
      <polygon points="68,68 68,78 80,70 80,60" style={{ fill: DARK3D, ..._ss(750, 1.8) }} />
      <polygon points="8,68 68,68 80,60 20,60"  style={{ fill: TOP3D,  ..._ss(800, 1.8) }} />
      {/* screen panel */}
      <rect x="14" y="10" width="60" height="42" rx="3" style={{ fill:"rgba(59,130,246,0.06)", ..._ss(200, 2) }} />
      {/* code lines */}
      <line x1="22" y1="20" x2="50" y2="20" style={_ss(400, 1.8)} />
      <line x1="22" y1="27" x2="42" y2="27" style={_ss(450, 1.8)} />
      <line x1="26" y1="34" x2="58" y2="34" style={_ss(500, 1.8)} />
      <line x1="22" y1="41" x2="46" y2="41" style={_ss(550, 1.8)} />
      {/* cursor */}
      <rect x="51" y="23" width="2.5" height="9" style={_ds(850, "#ea580c")} />
      {/* screen bezel glow */}
      <line x1="14" y1="52" x2="74" y2="52" style={{ ..._ss(600, 1), stroke:"rgba(234,88,12,0.5)" }} />
      {/* wifi dots */}
      <circle cx="82" cy="20" r="2" style={_ds(900, "#ea580c")} />
      <circle cx="82" cy="30" r="2" style={_ds(940)} />
      <circle cx="82" cy="40" r="2" style={_ds(980)} />
    </>),

    // 3D storm with cracked floor
    defeated: (<>
      {/* 3D cracked floor tiles */}
      <polygon points="10,82 40,82 46,74 16,74" style={{ fill: DARK3D, ..._ss(900, 1.5) }} />
      <polygon points="40,82 70,82 76,74 46,74" style={{ fill: SIDE3D, ..._ss(950, 1.5) }} />
      <line x1="10" y1="82" x2="70" y2="82" style={_ss(1000, 1.5)} />
      <line x1="46" y1="74" x2="46" y2="82" style={_ss(1020, 1.5)} />
      {/* crack */}
      <path d="M46,74 l-4,4 l6,2 l-5,2" style={_ss(1060, 1.2)} />
      {/* 3D cloud */}
      <ellipse cx="26" cy="36" rx="16" ry="11" style={{ fill:"rgba(100,116,139,0.12)", ..._ss(200, 2, 200) }} />
      <ellipse cx="46" cy="28" rx="18" ry="13" style={{ fill:"rgba(100,116,139,0.10)", ..._ss(300, 2, 200) }} />
      <ellipse cx="64" cy="34" rx="14" ry="10" style={{ fill:"rgba(100,116,139,0.12)", ..._ss(380, 2, 200) }} />
      {/* cloud bottom */}
      <line x1="12" y1="44" x2="76" y2="44" style={_ss(460, 1.5)} />
      {/* 3D rain drops */}
      {[[24,54],[34,50],[44,56],[54,52],[64,54],[30,64],[46,66],[60,62]].map(([x,y],i)=>(
        <ellipse key={i} cx={x} cy={y} rx="1.5" ry="4" style={{ fill:"rgba(59,130,246,0.5)", ..._ss(550+i*50,1,100) }} />
      ))}
      {/* lightning bolt */}
      <path d="M54,28 l-8,14 h6 l-6,14" style={_ss(700, 2.5, 200)} />
    </>),

    // 3D firework sphere explosion
    "arms-raised": (<>
      {/* 3D sphere */}
      <circle cx="50" cy="38" r="18" style={{ fill:"rgba(234,88,12,0.08)", ..._ss(200, 2, 200) }} />
      <ellipse cx="50" cy="38" rx="18" ry="6"  style={_ss(320, 1.5, 150)} />
      <ellipse cx="50" cy="30" rx="12" ry="4"  style={_ss(380, 1.5, 100)} />
      <ellipse cx="50" cy="46" rx="12" ry="4"  style={_ss(420, 1.5, 100)} />
      <ellipse cx="50" cy="38" rx="5"  ry="18" style={_ss(460, 1.5, 150)} />
      {/* burst rays — 16 directions */}
      {Array.from({length:16},(_,i)=>{
        const a=i*(Math.PI/8), x1=50+20*Math.cos(a), y1=38+20*Math.sin(a), x2=50+36*Math.cos(a), y2=38+36*Math.sin(a);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} style={_ss(520+i*35, 2)} />;
      })}
      {/* star tips */}
      {[[50,2],[86,20],[94,56],[68,82],[32,82],[6,56],[14,20]].map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r="2.5" style={_ds(1050+i*50, i%2===0?"#ea580c":"#fbbf24")} />
      ))}
    </>),

    // 3D perspective road to horizon
    walking: (<>
      {/* sky/horizon */}
      <line x1="4" y1="38" x2="96" y2="38" style={{ ..._ss(200,1), stroke:"#c4b89a" }} />
      {/* road surface — perspective trapezoid */}
      <polygon points="50,38 38,82 62,82" style={{ fill:"rgba(234,88,12,0.08)", ..._ss(300,1.8,400) }} />
      {/* road edges */}
      <line x1="50" y1="38" x2="20" y2="82" style={_ss(350, 2)} />
      <line x1="50" y1="38" x2="80" y2="82" style={_ss(400, 2)} />
      {/* lane dashes */}
      {[48,56,64,72,80].map((y,i)=>(
        <line key={i} x1={50-(y-38)*0.28} y1={y} x2={50+(y-38)*0.28} y2={y} style={_ss(500+i*60,1.5)} />
      ))}
      {/* trees left */}
      <line x1="18" y1="58" x2="18" y2="80" style={_ss(700,2)} />
      <ellipse cx="18" cy="50" rx="8" ry="10" style={{ fill:"rgba(34,197,94,0.12)", ..._ss(740,1.8,150) }} />
      {/* trees right */}
      <line x1="82" y1="58" x2="82" y2="80" style={_ss(780,2)} />
      <ellipse cx="82" cy="50" rx="8" ry="10" style={{ fill:"rgba(34,197,94,0.12)", ..._ss(820,1.8,150) }} />
      {/* sun / destination */}
      <circle cx="50" cy="22" r="10" style={{ fill:"rgba(251,191,36,0.15)", ..._ss(220,2,100) }} />
      {[0,45,90,135,180,225,270,315].map((d,i)=>{
        const r=d*Math.PI/180, x1=50+13*Math.cos(r), y1=22+13*Math.sin(r), x2=50+18*Math.cos(r), y2=22+18*Math.sin(r);
        return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} style={_ss(900+i*30,1.5)} />;
      })}
    </>),
  };

  return (
    <svg viewBox="0 0 100 88" className="w-full h-full">
      <style>{`
        @keyframes cf-draw { to { stroke-dashoffset: 0; } }
        @keyframes cf-pop  {
          0%  { opacity:0; transform:scale(0.2); }
          60% { opacity:1; transform:scale(1.25); }
          100%{ opacity:1; transform:scale(1); }
        }
      `}</style>
      {icons[pose]}
    </svg>
  );
}

function KeyObjectDoodle({ kind }: { kind: StickmanKeyObject }) {
  // draw-on animated versions of each key object
  const dr = (delay: number, da = 300): React.CSSProperties => ({
    fill: "none", stroke: "#1e1b12", strokeWidth: 2.6,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    strokeDasharray: da, strokeDashoffset: da,
    animation: "cf-draw 0.55s ease-out forwards",
    animationDelay: `${delay}ms`,
  });
  const dp = (delay: number, fill = "#ea580c"): React.CSSProperties => ({
    fill, opacity: 0, transformBox: "fill-box" as const, transformOrigin: "center",
    animation: "cf-pop 0.28s ease-out forwards", animationDelay: `${delay}ms`,
  });

  switch (kind) {
    case "clock":
      return (
        <svg viewBox="0 0 100 88" className="w-full h-full">
          <style>{`@keyframes cf-draw{to{stroke-dashoffset:0}}@keyframes cf-pop{0%{opacity:0;transform:scale(0.2)}60%{opacity:1;transform:scale(1.25)}100%{opacity:1;transform:scale(1)}}`}</style>
          <circle
            cx="50"
            cy="44"
            r="24"
            fill="rgba(251,191,36,0.1)"
            style={{
              opacity: 0,
              transformBox: "fill-box",
              transformOrigin: "center",
              animation: "cf-pop 0.32s ease-out forwards",
              animationDelay: "70ms",
            }}
          />
          <circle cx="50" cy="44" r="26" style={dr(200, 164)} />
          <line x1="50" y1="44" x2="50" y2="26" style={{ ...dr(480, 20), strokeWidth: 2.85 }} />
          <line x1="50" y1="44" x2="64" y2="50" style={{ ...dr(540, 16), strokeWidth: 2.35 }} />
          <circle cx="50" cy="44" r="2.8" style={dp(620)} />
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg, i) => {
            const a = (deg * Math.PI) / 180;
            const inner = deg % 90 === 0 ? 19 : 21.5;
            const outer = 26;
            return (
              <line
                key={i}
                x1={50 + inner * Math.cos(a)}
                y1={44 + inner * Math.sin(a)}
                x2={50 + outer * Math.cos(a)}
                y2={44 + outer * Math.sin(a)}
                style={dr(680 + i * 28, 4 + (deg % 90 === 0 ? 2 : 0))}
              />
            );
          })}
          <circle cx="76" cy="22" r="3.5" style={dp(1040)} />
        </svg>
      );
    case "money":
      return (
        <svg viewBox="0 0 100 88" className="w-full h-full">
          <style>{`@keyframes cf-draw{to{stroke-dashoffset:0}}@keyframes cf-pop{0%{opacity:0;transform:scale(0.2)}60%{opacity:1;transform:scale(1.25)}100%{opacity:1;transform:scale(1)}}`}</style>
          {/* coin stack */}
          <ellipse cx="50" cy="62" rx="20" ry="6" style={dr(200, 80)} />
          <ellipse cx="50" cy="54" rx="20" ry="6" style={dr(290, 80)} />
          <ellipse cx="50" cy="46" rx="20" ry="6" style={dr(380, 80)} />
          <line x1="30" y1="62" x2="30" y2="46" style={dr(460, 16)} />
          <line x1="70" y1="62" x2="70" y2="46" style={dr(490, 16)} />
          {/* $ sign */}
          <path d="M44 34 Q44 26 50 26 Q56 26 56 32 Q56 38 50 38 Q56 38 56 44 Q56 50 50 50 Q44 50 44 42" style={dr(560, 60)} />
          <line x1="50" y1="22" x2="50" y2="54" style={dr(700, 32)} />
          <circle cx="78" cy="22" r="3" style={dp(800)} />
        </svg>
      );
    case "warning":
      // Hazard triangle — visually distinct from the round clock metaphor
      return (
        <svg viewBox="0 0 100 88" className="w-full h-full">
          <style>{`@keyframes cf-draw{to{stroke-dashoffset:0}}@keyframes cf-pop{0%{opacity:0;transform:scale(0.2)}60%{opacity:1;transform:scale(1.25)}100%{opacity:1;transform:scale(1)}}`}</style>
          <path
            d="M 50 18 L 84 72 L 16 72 Z"
            fill="rgba(234,88,12,0.11)"
            stroke="none"
            style={{ opacity: 0, animation: "cf-pop 0.35s ease-out 0.15s forwards" }}
          />
          <path d="M 50 18 L 84 72 L 16 72 Z" style={{ ...dr(200, 198), fill: "none" }} />
          <line x1="50" y1="36" x2="50" y2="56" style={{ ...dr(520, 22), stroke: "#9a3412", strokeWidth: 3.2 }} />
          <circle cx="50" cy="64" r="3.2" style={dp(680, "#c2410c")} />
          <circle cx="76" cy="22" r="3" style={dp(900)} />
        </svg>
      );
    case "audience":
      return (
        <svg viewBox="0 0 100 88" className="w-full h-full">
          <style>{`@keyframes cf-draw{to{stroke-dashoffset:0}}@keyframes cf-pop{0%{opacity:0;transform:scale(0.2)}60%{opacity:1;transform:scale(1.25)}100%{opacity:1;transform:scale(1)}}`}</style>
          <circle cx="50" cy="28" r="9" style={dr(200, 57)} />
          <circle cx="28" cy="38" r="7" style={dr(320, 44)} />
          <circle cx="72" cy="38" r="7" style={dr(380, 44)} />
          <path d="M34 60 Q42 50 50 60 Q58 50 66 60" style={dr(500, 50)} />
          <path d="M16 68 Q22 58 28 68" style={dr(580, 30)} />
          <path d="M72 68 Q78 58 84 68" style={dr(630, 30)} />
          {/* speech bubble */}
          <path d="M40 14 h20 a4 4 0 0 1 4 4 v8 a4 4 0 0 1-4 4 l-4 4 -4-4 h-12 a4 4 0 0 1-4-4 v-8 a4 4 0 0 1 4-4 z" style={dr(720, 80)} />
          <circle cx="76" cy="22" r="3" style={dp(900)} />
        </svg>
      );
    case "brand":
      return (
        <svg viewBox="0 0 100 88" className="w-full h-full">
          <style>{`@keyframes cf-draw{to{stroke-dashoffset:0}}@keyframes cf-pop{0%{opacity:0;transform:scale(0.2)}60%{opacity:1;transform:scale(1.25)}100%{opacity:1;transform:scale(1)}}`}</style>
          {/* megaphone */}
          <polygon points="22,34 40,34 62,20 62,68 40,54 22,54" style={dr(200, 140)} />
          <rect x="12" y="36" width="10" height="16" rx="2" style={dr(500, 52)} />
          {/* sound waves */}
          <path d="M66 32 Q76 44 66 56" style={dr(620, 30)} />
          <path d="M70 24 Q86 44 70 64" style={dr(700, 50)} />
          {/* star accent */}
          {[0,72,144,216,288].map((deg,i)=>{
            const a=deg*Math.PI/180, r1=4, r2=8;
            const pts=`${22+r2*Math.cos(a)},${74+r2*Math.sin(a)} ${22+r1*Math.cos(a+Math.PI/5)},${74+r1*Math.sin(a+Math.PI/5)}`;
            return null; // skip complex star, use dots
          })}
          <circle cx="78" cy="22" r="3.2" style={dp(850)} />
          <circle cx="84" cy="32" r="2.2" style={dp(900)} />
          <circle cx="88" cy="44" r="2.5" style={dp(940)} />
        </svg>
      );
    case "idea":
      return (
        <svg viewBox="0 0 100 88" className="w-full h-full">
          <style>{`@keyframes cf-draw{to{stroke-dashoffset:0}}@keyframes cf-pop{0%{opacity:0;transform:scale(0.2)}60%{opacity:1;transform:scale(1.25)}100%{opacity:1;transform:scale(1)}}`}</style>
          {/* lightbulb */}
          <path d="M34 38 Q34 20 50 20 Q66 20 66 38 Q66 50 58 56 L42 56 Q34 50 34 38 Z" style={dr(200, 130)} />
          <line x1="42" y1="60" x2="58" y2="60" style={dr(560, 16)} />
          <line x1="43" y1="66" x2="57" y2="66" style={dr(600, 14)} />
          <line x1="45" y1="72" x2="55" y2="72" style={dr(640, 10)} />
          {/* rays */}
          {[0,45,90,135,180,225,270,315].map((deg,i)=>{
            const a=deg*Math.PI/180, x1=50+30*Math.cos(a), y1=38+30*Math.sin(a), x2=50+38*Math.cos(a), y2=38+38*Math.sin(a);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} style={dr(700+i*40, 9)} />;
          })}
          <circle cx="50" cy="38" r="4" style={dp(1080, "rgba(251,191,36,0.8)")} />
          <circle cx="76" cy="20" r="3" style={dp(1120)} />
        </svg>
      );
    case "chart":
    default:
      return (
        <svg viewBox="0 0 100 88" className="w-full h-full">
          <style>{`@keyframes cf-draw{to{stroke-dashoffset:0}}@keyframes cf-pop{0%{opacity:0;transform:scale(0.2)}60%{opacity:1;transform:scale(1.25)}100%{opacity:1;transform:scale(1)}}`}</style>
          {/* axes */}
          <line x1="14" y1="72" x2="88" y2="72" style={dr(200, 74)} />
          <line x1="14" y1="72" x2="14" y2="14" style={dr(300, 58)} />
          {/* arrow tip */}
          <polyline points="8,20 14,14 20,20" style={dr(390, 17)} />
          {/* bars */}
          <rect x="22" y="52" width="12" height="20" style={{ ...dr(460, 64), fill: "rgba(234,88,12,0.08)" }} />
          <rect x="40" y="40" width="12" height="32" style={{ ...dr(530, 88), fill: "rgba(234,88,12,0.10)" }} />
          <rect x="58" y="26" width="12" height="46" style={{ ...dr(600, 104), fill: "rgba(234,88,12,0.14)" }} />
          {/* trend arrow */}
          <polyline points="24,50 42,38 60,24 74,16" style={dr(720, 80)} />
          <polyline points="66,16 74,16 74,24" style={dr(820, 16)} />
          <circle cx="78" cy="22" r="3.2" style={dp(900)} />
          {/* axis tick dots */}
          {[28,46,64].map((x,i) => <circle key={i} cx={x} cy="72" r="1.8" style={dp(960+i*40, "#c4b89a")} />)}
        </svg>
      );
  }
}

function SceneShotTemplateLayer({
  shotTemplate,
}: {
  shotTemplate: StickmanShotTemplate;
}) {
  const s: React.CSSProperties = {
    fill: "none",
    stroke: "rgba(30,27,18,0.34)",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  if (shotTemplate === "desk-explain") {
    return (
      <svg viewBox="0 0 160 90" className="absolute inset-0 w-full h-full pointer-events-none">
        <line x1="18" y1="74" x2="76" y2="74" style={s} />
        <line x1="22" y1="74" x2="22" y2="82" style={s} />
        <line x1="72" y1="74" x2="72" y2="82" style={s} />
      </svg>
    );
  }
  if (shotTemplate === "point-to-board") {
    return (
      <svg viewBox="0 0 160 90" className="absolute inset-0 w-full h-full pointer-events-none">
        <rect x="90" y="54" width="44" height="20" rx="2" style={s} />
        <line x1="94" y1="60" x2="124" y2="60" style={s} />
        <line x1="94" y1="65" x2="116" y2="65" style={s} />
        <line x1="99" y1="74" x2="95" y2="82" style={s} />
        <line x1="125" y1="74" x2="129" y2="82" style={s} />
      </svg>
    );
  }
  if (shotTemplate === "walk-and-talk") {
    return (
      <svg viewBox="0 0 160 90" className="absolute inset-0 w-full h-full pointer-events-none">
        <path d="M8 78 Q 38 74 68 78 Q 98 82 128 78 Q 144 76 156 78" style={s} />
        <line x1="26" y1="70" x2="34" y2="70" style={s} />
        <line x1="40" y1="68" x2="49" y2="68" style={s} />
      </svg>
    );
  }
  if (shotTemplate === "result-moment") {
    return (
      <svg viewBox="0 0 160 90" className="absolute inset-0 w-full h-full pointer-events-none">
        <circle cx="80" cy="68" r="13" style={s} />
        <line x1="80" y1="52" x2="80" y2="56" style={s} />
        <line x1="64" y1="68" x2="68" y2="68" style={s} />
        <line x1="96" y1="68" x2="92" y2="68" style={s} />
      </svg>
    );
  }
  // stand-explain
  return (
    <svg viewBox="0 0 160 90" className="absolute inset-0 w-full h-full pointer-events-none">
      <line x1="10" y1="78" x2="150" y2="78" style={s} />
    </svg>
  );
}

function SceneSupportAccents({
  kind,
  layout,
  animKey,
}: {
  kind: StickmanKeyObject;
  layout: StickmanLayout;
  animKey: number;
}) {
  const ink = "rgba(30,27,18,0.35)";
  const accent = "#ea580c";
  const draw = (delay: number, w = 1.4): React.CSSProperties => ({
    fill: "none",
    stroke: ink,
    strokeWidth: w,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeDasharray: 120,
    strokeDashoffset: 120,
    animation: "cf-draw 0.35s ease-out forwards",
    animationDelay: `${delay}ms`,
  });
  const pop = (delay: number): React.CSSProperties => ({
    fill: accent,
    opacity: 0,
    transformBox: "fill-box",
    transformOrigin: "center",
    animation: "cf-pop 0.22s ease-out forwards",
    animationDelay: `${delay}ms`,
  });

  const leftX = layout === "right-presenter" ? 70 : 86;
  const midY = 68;
  const variant = Math.abs(animKey) % 3;

  return (
    <svg viewBox="0 0 160 90" className="absolute inset-0 w-full h-full pointer-events-none">
      <style>{`
        @keyframes cf-draw { to { stroke-dashoffset: 0; } }
        @keyframes cf-pop  { 0%{opacity:0;transform:scale(0.3)} 100%{opacity:1;transform:scale(1)} }
      `}</style>

      {/* light guide line to connect scene composition */}
      <line x1={leftX} y1={74} x2={108} y2={74} style={draw(360, 1.2)} />

      {kind === "chart" && (
        <>
          <line x1={leftX + 2} y1={70} x2={leftX + 7} y2={66} style={draw(430)} />
          <line x1={leftX + 8} y1={69} x2={leftX + 14} y2={63} style={draw(470)} />
          <circle cx={leftX + 16} cy={62} r={1.8} style={pop(520)} />
        </>
      )}
      {kind === "clock" && (
        <>
          <path d={`M ${leftX + 4} 68 q 6 -6 12 0`} style={draw(430)} />
          <circle cx={leftX + 20} cy={65} r={2} style={pop(500)} />
        </>
      )}
      {kind === "money" && (
        <>
          <rect x={leftX + 2} y={63} width={10} height={6} rx={1.5} style={draw(430)} />
          <circle cx={leftX + 22} cy={66} r={2} style={pop(500)} />
        </>
      )}
      {kind === "warning" && (
        <>
          <line x1={leftX + 5} y1={62} x2={leftX + 5} y2={68} style={draw(430)} />
          <circle cx={leftX + 5} cy={70} r={1.6} style={pop(500)} />
        </>
      )}
      {kind === "audience" && (
        <>
          <circle cx={leftX + 4} cy={66} r={1.8} style={draw(430)} />
          <circle cx={leftX + 10} cy={64} r={1.8} style={draw(460)} />
          <circle cx={leftX + 16} cy={66} r={1.8} style={draw(490)} />
        </>
      )}
      {kind === "brand" && (
        <>
          <line x1={leftX + 3} y1={64} x2={leftX + 14} y2={64} style={draw(430)} />
          <line x1={leftX + 3} y1={68} x2={leftX + 10} y2={68} style={draw(470)} />
          <circle cx={leftX + 17} cy={63} r={1.7} style={pop(520)} />
        </>
      )}
      {kind === "idea" && (
        <>
          <circle cx={leftX + 8} cy={65} r={3.2} style={draw(430)} />
          <circle cx={leftX + 18} cy={62} r={1.7} style={pop(500)} />
        </>
      )}

      {/* subtle scene variation */}
      {variant === 1 && <circle cx="136" cy={midY + 8} r="1.8" style={pop(560)} />}
      {variant === 2 && <line x1="132" y1={midY + 7} x2="142" y2={midY + 7} style={draw(560, 1.1)} />}
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
  /** Same-scene fetches must share one promise — prefetch + play used to race and return null while in flight. */
  const voPromisesRef       = useRef<Map<number, Promise<string | null>>>(new Map());
  const lastVoFailureRef    = useRef<string | null>(null);
  const voFallbackTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef          = useRef(true);
  /** When resuming paused audio from the play button, skip one [isPlaying] effect — it would otherwise double-call playScene with handlePlay. */
  const skipNextSceneEffectRef = useRef(false);
  const audioSceneIndexRef = useRef<number | null>(null);

  const clearVoFallback = useCallback(() => {
    if (voFallbackTimerRef.current) {
      clearTimeout(voFallbackTimerRef.current);
      voFallbackTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (voFallbackTimerRef.current) {
        clearTimeout(voFallbackTimerRef.current);
        voFallbackTimerRef.current = null;
      }
      audioCacheRef.current.forEach((u) => URL.revokeObjectURL(u));
      audioCacheRef.current.clear();
    };
  }, []);

  const fetchVO = useCallback(
    async (idx: number): Promise<string | null> => {
      const cached = audioCacheRef.current.get(idx);
      if (cached) return cached;

      const existing = voPromisesRef.current.get(idx);
      if (existing) return existing;

      const p = (async (): Promise<string | null> => {
        try {
          const scene = scenes[idx];
          if (!scene) return null;
          const res = await fetch("/api/templates/stickman/voiceover", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: scene.caption, sceneIndex: idx, voiceId: voiceId ?? DEFAULT_VOICE_ID }),
          });
          const errText = res.ok ? "" : (await res.text().catch(() => "")).trim();
          if (!res.ok) {
            const short =
              errText.length > 280 ? `${errText.slice(0, 277)}…` : errText || `HTTP ${res.status}`;
            lastVoFailureRef.current = short;
            console.error("[StickmanWhiteboard] voiceover HTTP", res.status, short);
            return null;
          }
          const blob = await res.blob();
          if (blob.size < 64) {
            lastVoFailureRef.current = "ElevenLabs returned an empty or invalid audio response.";
            return null;
          }
          const url = URL.createObjectURL(blob);
          if (mountedRef.current) {
            audioCacheRef.current.set(idx, url);
            return url;
          }
          URL.revokeObjectURL(url);
          return null;
        } catch (e) {
          lastVoFailureRef.current = e instanceof Error ? e.message : "Network error";
          console.error("[StickmanWhiteboard] voiceover", e);
          return null;
        } finally {
          voPromisesRef.current.delete(idx);
        }
      })();

      voPromisesRef.current.set(idx, p);
      return p;
    },
    [scenes, voiceId]
  );

  const prefetchAhead = useCallback(
    (from: number) => {
      for (let i = from + 1; i <= from + 2 && i < scenes.length; i++) {
        if (!audioCacheRef.current.has(i)) void fetchVO(i);
      }
    },
    [fetchVO, scenes.length]
  );

  const playScene = useCallback(
    async (idx: number) => {
      if (!mountedRef.current) return;
      clearVoFallback();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.onended = null; }
      setLoadingVO(true); setError(null);
      const url = await fetchVO(idx);
      prefetchAhead(idx);
      if (!mountedRef.current) return;
      setLoadingVO(false);
      const sceneNow = scenes[idx];
      const advance = () => {
        if (!mountedRef.current) return;
        const next = idx + 1;
        if (next < scenes.length) setCurrentIndex(next);
        else { setIsPlaying(false); onComplete?.(); }
      };
      if (!url) {
        audioSceneIndexRef.current = null;
        const detail = lastVoFailureRef.current;
        lastVoFailureRef.current = null;
        const base =
          detail ??
          "Voiceover request returned no audio. If ELEVENLABS_API_KEY is in .env.local, restart the dev server so Next.js picks it up.";
        const withHint =
          /not configured|API key|xi-api-key|401|403/i.test(base)
            ? `${base} Restart \`npm run dev\` after changing env; the key is never read from the browser.`
            : `${base} Preview auto-advances by read time.`;
        setError(withHint);
        const words = (sceneNow?.caption ?? "").split(/\s+/).filter(Boolean).length;
        const ms = Math.min(Math.max(3200, words * 380), 15000);
        voFallbackTimerRef.current = setTimeout(advance, ms);
        return;
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audioSceneIndexRef.current = idx;
      audio.onended = () => {
        clearVoFallback();
        if (!mountedRef.current) return;
        advance();
      };
      audio.onerror = () => { if (mountedRef.current) setError("Audio playback error."); };
      try { await audio.play(); } catch { setError("Playback blocked — click ▶ to start."); setIsPlaying(false); }
    },
    [fetchVO, prefetchAhead, scenes, onComplete, clearVoFallback]
  );

  useEffect(() => {
    if (!isPlaying || scenes.length === 0) return;
    if (skipNextSceneEffectRef.current) {
      skipNextSceneEffectRef.current = false;
      return;
    }
    void playScene(currentIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, isPlaying]);

  useEffect(() => {
    if (!isPlaying) audioRef.current?.pause();
  }, [isPlaying]);

  const handlePlay = () => {
    const a = audioRef.current;
    if (a && a.src && !a.ended && a.paused && audioSceneIndexRef.current === currentIndex) {
      skipNextSceneEffectRef.current = true;
      setIsPlaying(true);
      void a.play().catch(() => {
        skipNextSceneEffectRef.current = false;
        setError("Playback blocked — click ▶ to start.");
        setIsPlaying(false);
      });
      return;
    }
    setIsPlaying(true);
  };
  const handlePause = () => {
    clearVoFallback();
    setIsPlaying(false);
    audioRef.current?.pause();
  };
  const handlePrev  = () => {
    clearVoFallback();
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };
  const handleNext  = () => {
    clearVoFallback();
    if (currentIndex < scenes.length - 1) setCurrentIndex((i) => i + 1);
  };

  const scene    = scenes[currentIndex];
  if (!scene) return null;
  const progress = scenes.length > 1 ? (currentIndex / (scenes.length - 1)) * 100 : 100;
  const keyObject: StickmanKeyObject = scene.keyObject ?? "idea";
  const shotTemplate: StickmanShotTemplate = scene.shotTemplate ?? "stand-explain";

  // ── Per-scene visual composition ──────────────────────────────────────────
  // Each property uses a DIFFERENT prime modulo so combinations never repeat
  // within any reasonable video length (LCM of 6,7,5,11,13 = 30030 scenes)

  const i = currentIndex;

  // Background tint — mod 6
  const BG = ["#FFFEF8","#FFFBF0","#FFFDF5","#FEFEF8","#FFFCF2","#FDFEF5"];
  const bg = BG[i % 6]!;

  // Accent gradient — mod 7
  const GRADIENTS = [
    "linear-gradient(90deg,#c2410c,#ea580c,#f97316,#fbbf24)",
    "linear-gradient(90deg,#92400e,#b45309,#d97706,#fbbf24)",
    "linear-gradient(90deg,#9a3412,#c2410c,#ea580c,#fb923c)",
    "linear-gradient(90deg,#7c2d12,#c2410c,#f97316,#fbbf24)",
    "linear-gradient(90deg,#a16207,#ca8a04,#eab308,#fde047)",
    "linear-gradient(90deg,#c2410c,#dc2626,#ea580c,#f97316)",
    "linear-gradient(90deg,#78350f,#b45309,#f97316,#fbbf24)",
  ];
  const accentGradient = GRADIENTS[i % 7]!;

  // Caption side: left or right — mod 2 (alternates every scene)
  const captionOnLeft = (i % 2) === 0;

  // Icon size tier — mod 5 (small / medium / large / wide / watermark)
  const iconTier = i % 5; // 0=normal, 1=large, 2=small+high, 3=wide, 4=watermark

  // Stickman X slot — mod 11 mapped to 5 positions so it shifts unpredictably
  const stickmanSlot = i % 11 < 3 ? 0 : i % 11 < 5 ? 1 : i % 11 < 7 ? 2 : i % 11 < 9 ? 3 : 4;

  // Divider height — mod 13 mapped to 3 heights
  const dividerPct = i % 13 < 5 ? "55%" : i % 13 < 9 ? "58%" : "61%";

  // Highlight accent colour — mod 3
  const accentBgColor = [
    "rgba(234,88,12,0.09)",
    "rgba(251,191,36,0.10)",
    "rgba(234,88,12,0.07)",
  ][i % 3]!;

  // Build caption position from captionOnLeft + iconTier
  const iconWidth = iconTier === 1 ? "26%" : iconTier === 3 ? "30%" : iconTier === 4 ? "30%" : "22%";
  /** Was 0.15 for "watermark" tier — looked like broken empty placeholders in the feed. */
  const iconOpacity = iconTier === 4 ? "0.88" : "1";
  const captionGap = iconTier === 4 ? `calc(${iconWidth} + 8%)` : `calc(${iconWidth} + 6%)`;

  const captionPos = captionOnLeft
    ? { top:"9%", left:"5%", right:captionGap, bottom: dividerPct === "55%" ? "46%" : "42%" }
    : { top:"9%", left:captionGap, right:"5%", bottom: dividerPct === "55%" ? "46%" : "42%" };

  const highlightPos = captionOnLeft
    ? { top:"10%", left:"4%", right:captionGap, height:"17%" }
    : { top:"10%", left:captionGap, right:"4%", height:"17%" };

  // Icon position — opposite side of caption, height varies by tier
  const iconHeight = iconTier === 1 ? "52%" : iconTier === 2 ? "38%" : iconTier === 3 ? "50%" : "46%";
  const iconTop    = iconTier === 2 ? "6%"  : iconTier === 1 ? "7%"  : "9%";
  const iconPos = captionOnLeft
    ? { top: iconTop, right:"2%", width: iconWidth, height: iconHeight, opacity: iconOpacity }
    : { top: iconTop, left:"2%",  width: iconWidth, height: iconHeight, opacity: iconOpacity };
  const iconFlip = !captionOnLeft;

  // Stickman X position (5 slots spread across bottom row)
  const STICKMAN_X = ["5%","15%","28%","40%","52%"];
  const stickmanLeft = scene.pose === "sitting" ? "12%" : (STICKMAN_X[stickmanSlot] ?? "5%");
  const stickmanWidth = scene.pose === "sitting" ? "48%" : "42%";
  const effectiveStickmanPos = { bottom:"2%", left: stickmanLeft, width: stickmanWidth, top: dividerPct };

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-3 w-full select-none">
      {/* Global styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&display=swap');
        @keyframes cf-line {
          from { opacity: 0; transform: translateX(-18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .cf-line { opacity: 0; animation: cf-line 0.42s ease-out forwards; }
        @keyframes cf-highlight-bar {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        .cf-highlight-bar {
          transform-origin: left center;
          animation: cf-highlight-bar 0.5s cubic-bezier(.22,1,.36,1) forwards;
        }
        @keyframes cf-scene-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .cf-scene-fade { animation: cf-scene-fade 0.35s ease-out forwards; }
        @keyframes cf-doodle-pop {
          from { opacity: 0; transform: scale(0.75) rotate(-6deg); }
          to   { opacity: 1; transform: scale(1)    rotate(0deg);  }
        }
        .cf-doodle-pop { opacity: 0; animation: cf-doodle-pop 0.5s cubic-bezier(.34,1.56,.64,1) 0.2s forwards; }
      `}</style>

      {/* ── Whiteboard canvas 16:9 ── */}
      <div
        className="relative rounded-2xl overflow-hidden w-full"
        style={{
          aspectRatio: "16/9",
          background: bg,
          border: "2px solid #E6DFC8",
          boxShadow: "0 12px 40px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)",
          transition: "background 0.4s ease",
        }}
      >
        {/* Soft vignette under grid + scene (no z-index — stays below later siblings) */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 85% 75% at 50% 45%, transparent 0%, transparent 55%, rgba(90,78,56,0.06) 100%)",
          }}
          aria-hidden
        />
        {/* Dot grid */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 160 90" preserveAspectRatio="none" style={{ opacity: 0.07 }}>
          {Array.from({ length: 15 }, (_, row) =>
            Array.from({ length: 27 }, (_, col) => (
              <circle key={`${row}-${col}`} cx={col * 6 + 3} cy={row * 6 + 3} r="0.55" fill="#b8a882" />
            ))
          )}
        </svg>

        {/* Accent top bar — rotates gradient per scene */}
        <div className="absolute top-0 left-0 right-0 h-[7px]"
          style={{ background: accentGradient, transition: "background 0.5s ease" }} />

        {/* Horizontal separator */}
        <div className="absolute left-[5%] right-[5%]"
          style={{ top: dividerPct, height: "1px", background: "linear-gradient(90deg, transparent, #d4c9a8 20%, #d4c9a8 80%, transparent)" }} />

        {/* Scene fade-in wrapper */}
        <div key={currentIndex} className="cf-scene-fade absolute inset-0">
          <SceneShotTemplateLayer shotTemplate={shotTemplate} />

          {/* Highlight bar behind caption */}
          <div
            className="cf-highlight-bar"
            style={{
              position: "absolute",
              top: highlightPos.top,
              left: highlightPos.left,
              right: highlightPos.right,
              height: highlightPos.height,
              background: accentBgColor,
              borderRadius: 6,
              animationDelay: "60ms",
            }}
          />

          {/* Caption text */}
          <div style={{ position: "absolute", ...captionPos, overflow: "hidden" }}>
            <SceneBoardText scene={scene} />
          </div>

          {/* Scene key object */}
          <div
            className="cf-doodle-pop"
            style={{
              position: "absolute",
              ...iconPos,
              ...(iconFlip ? { transform: "scaleX(-1)" } : {}),
            }}
          >
            <KeyObjectDoodle kind={keyObject} />
          </div>

          {/* Stickman — position driven by theme */}
          <div style={{ position: "absolute", ...effectiveStickmanPos }}>
            <StickmanSvg pose={scene.pose} animKey={currentIndex} />
          </div>

          {/* Scene badge — bottom right */}
          <div style={{
            position: "absolute", bottom: "4%", right: "4%",
            fontFamily: "'Caveat', cursive", fontWeight: 700,
            fontSize: "clamp(0.6875rem, 0.75rem + 0.2vw, 1rem)", color: "#a8956a",
          }}>
            {currentIndex + 1} / {scenes.length}
          </div>
        </div>

        {/* Loading overlay */}
        {loadingVO && (
          <div className="absolute inset-0 flex items-center justify-center z-20"
            style={{ background: "rgba(255,254,248,0.82)", backdropFilter: "blur(4px)" }}>
            <div className="flex flex-col items-center gap-2" style={{ color: "#a8956a" }}>
              <svg className="w-7 h-7 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <span style={{ fontFamily: "'Caveat', cursive", fontSize: 17 }}>Generating voice…</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p
          className={`text-center text-sm ${
            /auto-advance|restart|\.env/i.test(error) ? "text-amber-800 dark:text-amber-200" : "text-red-500"
          }`}
        >
          {error}
        </p>
      )}

      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "#EDE8D9" }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%`, background: "linear-gradient(90deg, #c2410c, #f97316)" }} />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <button type="button" onClick={handlePrev} disabled={currentIndex === 0}
          className="p-2 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ background: "#F0EAD8" }} aria-label="Previous">
          <svg className="w-5 h-5" style={{ color: "#7a6a50" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>

        {/* Pill dots */}
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          {scenes.map((s, i) => (
            <button key={s.sceneIndex} type="button"
              onClick={() => {
                if (isPlaying) {
                  setCurrentIndex(i);
                  return;
                }
                if (i === currentIndex) {
                  handlePlay();
                  return;
                }
                setCurrentIndex(i);
                setIsPlaying(true);
              }}
              className="rounded-full transition-all duration-300"
              style={{ width: i === currentIndex ? 22 : 8, height: 8, background: i === currentIndex ? "#ea580c" : "#CFC5A8" }}
              aria-label={`Scene ${i + 1}`} />
          ))}
        </div>

        {isPlaying ? (
          <button type="button" onClick={handlePause}
            className="p-3 rounded-full text-white shadow-md" style={{ background: "#ea580c" }} aria-label="Pause">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          </button>
        ) : (
          <button type="button" onClick={handlePlay}
            className="p-3 rounded-full text-white shadow-md" style={{ background: "#ea580c" }} aria-label="Play">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
        )}

        <button type="button" onClick={handleNext} disabled={currentIndex === scenes.length - 1}
          className="p-2 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ background: "#F0EAD8" }} aria-label="Next">
          <svg className="w-5 h-5" style={{ color: "#7a6a50" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
  );
}
