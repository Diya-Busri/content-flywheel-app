"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

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
  caption: string;
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
          stroke: "rgba(255,255,255,0.72)", strokeWidth: 1.6,
          strokeLinecap: "round",
          strokeDasharray: 600, strokeDashoffset: 600,
          animation: "cf-draw 0.55s ease-out forwards",
          animationDelay: `${delay + 20}ms`,
        }}
      />
    );
  };

  return (
    <svg
      key={animKey}
      viewBox="0 0 160 180"
      className="w-full h-full"
      aria-label={`Stickman: ${pose}`}
    >
      <style>{`
        @keyframes cf-draw { to { stroke-dashoffset: 0; } }
        @keyframes cf-pop {
          0%   { opacity: 0; transform: scale(0.3); }
          60%  { opacity: 1; transform: scale(1.15); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes cf-shadow-in { to { opacity: 1; } }
        .cf-stroke {
          fill: none; stroke: #1a1512;
          stroke-linecap: round; stroke-linejoin: round;
          stroke-dasharray: 600; stroke-dashoffset: 600;
          animation: cf-draw 0.55s ease-out forwards;
        }
        .cf-dot {
          opacity: 0; fill: #1a1512;
          transform-box: fill-box; transform-origin: center;
          animation: cf-pop 0.2s ease-out forwards;
        }
      `}</style>

      {/* Ground shadow — gives 3D grounded feel */}
      <ellipse cx="83" cy="168" rx="38" ry="7"
        style={{ fill: "rgba(0,0,0,0.07)", opacity: 0,
          animation: "cf-shadow-in 0.4s ease-out 0.15s forwards" }} />

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
                fill: "rgba(0,0,0,0.18)",
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
                stroke: "rgba(0,0,0,0.18)",
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
                stroke: "rgba(0,0,0,0.18)",
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
              stroke: "rgba(0,0,0,0.18)",
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

      {elements.map((el, i) => {
        if (el.k === "D") {
          return (
            <circle key={i} className="cf-dot"
              cx={el.cx} cy={el.cy} r={el.r}
              style={{ animationDelay: `${el.delay}ms` }} />
          );
        }
        const style: React.CSSProperties = { animationDelay: `${el.delay}ms` };
        const sw = el.sw ?? SW;

        if (el.k === "L") {
          return (
            <g key={i}>
              {/* main limb stroke */}
              <line className="cf-stroke"
                x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2}
                strokeWidth={sw} style={style} />
              {/* 3D tube highlight — white sheen on upper-left edge */}
              {sw >= 3 && tubeHighlight(el.x1, el.y1, el.x2, el.y2, el.delay)}
            </g>
          );
        }

        if (el.k === "C") {
          const hr = el.r * 0.28; // highlight radius
          return (
            <g key={i}>
              {/* main circle */}
              <circle className="cf-stroke"
                cx={el.cx} cy={el.cy} r={el.r}
                strokeWidth={sw} style={style} />
              {/* 3D sphere highlight dot — top-left */}
              <circle
                cx={el.cx - el.r * 0.3} cy={el.cy - el.r * 0.3} r={hr}
                style={{
                  fill: "rgba(255,255,255,0.78)", opacity: 0,
                  animation: "cf-pop 0.2s ease-out forwards",
                  animationDelay: `${el.delay + 80}ms`,
                  transformBox: "fill-box", transformOrigin: "center",
                }} />
              {/* subtle shadow arc bottom-right */}
              <circle
                cx={el.cx + el.r * 0.22} cy={el.cy + el.r * 0.28} r={el.r * 0.18}
                style={{
                  fill: "rgba(0,0,0,0.10)", opacity: 0,
                  animation: "cf-pop 0.2s ease-out forwards",
                  animationDelay: `${el.delay + 100}ms`,
                  transformBox: "fill-box", transformOrigin: "center",
                }} />
            </g>
          );
        }

        // k === "P" — paths (face features, props)
        return (
          <path key={i} className="cf-stroke"
            d={el.p} strokeWidth={sw} style={style} />
        );
      })}
    </svg>
  );
}

// ─── Caption lines (4 words per line, first line orange) ─────────────────────

/** TikTok-style caption: one line (≤4 words) at a time, cycling with a fade. */
function AnimatedCaption({ text, sceneKey }: { text: string; sceneKey: number }) {
  const lines = useMemo(() => {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += 4) {
      chunks.push(words.slice(i, i + 4).join(" "));
    }
    return chunks.length > 0 ? chunks : [text];
  }, [text]);

  const [lineIdx, setLineIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  // Reset to first line on scene change
  useEffect(() => {
    setLineIdx(0);
    setVisible(true);
  }, [sceneKey]);

  // Cycle through lines: hold 1.8 s → fade out → next line
  useEffect(() => {
    if (lines.length <= 1) return;
    const HOLD_MS = 1800;
    const FADE_MS = 180;
    const t = setTimeout(() => {
      if (lineIdx < lines.length - 1) {
        setVisible(false);
        setTimeout(() => {
          setLineIdx(idx => idx + 1);
          setVisible(true);
        }, FADE_MS);
      }
      // Last line stays visible until next scene
    }, HOLD_MS);
    return () => clearTimeout(t);
  }, [lineIdx, lines.length, sceneKey]);

  return (
    <span
      style={{
        display: "inline-block",
        background: "rgba(0,0,0,0.62)",
        borderRadius: "clamp(5px, 0.7vw, 9px)",
        padding: "0.18em 0.6em 0.22em",
        fontFamily: "'Caveat', cursive",
        fontWeight: 700,
        fontSize: "clamp(17px, 2.8vw, 40px)",
        color: "#ffffff",
        textShadow: "0 1px 5px rgba(0,0,0,0.95), 0 0 20px rgba(0,0,0,0.45)",
        letterSpacing: "0.015em",
        lineHeight: 1.15,
        whiteSpace: "nowrap",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.18s ease",
        userSelect: "none",
      }}
    >
      {lines[lineIdx] ?? ""}
    </span>
  );
}

// ─── Pose doodle (top-right decorative icon) ──────────────────────────────────

// shared style helpers (used by PoseDoodle + ScatterDoodles)
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
          <circle cx="50" cy="44" r="26" style={dr(200, 164)} />
          <line x1="50" y1="44" x2="50" y2="25" style={dr(500, 20)} />
          <line x1="50" y1="44" x2="66" y2="52" style={dr(560, 18)} />
          <circle cx="50" cy="44" r="2.5" style={dp(640)} />
          {[0,60,120,180,240,300].map((deg,i) => {
            const a=deg*Math.PI/180;
            return <line key={i} x1={50+22*Math.cos(a)} y1={44+22*Math.sin(a)} x2={50+26*Math.cos(a)} y2={44+26*Math.sin(a)} style={dr(700+i*40, 5)} />;
          })}
          <circle cx="76" cy="22" r="3.5" style={dp(1000)} />
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
      // Instead of the boring static triangle, draw an exclamation in a circle
      return (
        <svg viewBox="0 0 100 88" className="w-full h-full">
          <style>{`@keyframes cf-draw{to{stroke-dashoffset:0}}@keyframes cf-pop{0%{opacity:0;transform:scale(0.2)}60%{opacity:1;transform:scale(1.25)}100%{opacity:1;transform:scale(1)}}`}</style>
          {/* outer circle */}
          <circle cx="50" cy="44" r="28" style={dr(200, 176)} />
          {/* exclamation body */}
          <line x1="50" y1="26" x2="50" y2="52" style={dr(560, 28)} />
          <circle cx="50" cy="60" r="3.5" style={dp(720)} />
          {/* 4 notch marks on the circle like a warning dial */}
          {[270, 330, 30, 90].map((deg, i) => {
            const a = deg * Math.PI / 180;
            return <line key={i} x1={50+24*Math.cos(a)} y1={44+24*Math.sin(a)} x2={50+28*Math.cos(a)} y2={44+28*Math.sin(a)} style={dr(800+i*50, 5)} />;
          })}
          <circle cx="76" cy="20" r="3" style={dp(1000)} />
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

// ─── Scene-aware doodles (caption-driven, not random) ────────────────────────
function SceneContextDoodles({
  caption,
  animKey,
}: {
  caption: string;
  animKey: number;
}) {
  const text = caption.toLowerCase();
  const has = (words: string[]) => words.some((w) => text.includes(w));
  type Kind = "brand" | "money" | "growth" | "time" | "warning" | "idea" | "social";
  let primary: Kind = "idea";
  if (has(["problem", "mistake", "wrong", "fail", "risk", "avoid"])) primary = "warning";
  else if (has(["money", "sales", "revenue", "profit", "income", "price"])) primary = "money";
  else if (has(["grow", "growth", "scale", "increase", "improve", "results"])) primary = "growth";
  else if (has(["time", "fast", "quick", "minutes", "today", "now"])) primary = "time";
  else if (has(["audience", "people", "customers", "community", "social", "followers"])) primary = "social";
  else if (has(["brand", "business", "startup", "company", "founder"])) primary = "brand";

  const sceneCycle: Kind[] = ["idea", "growth", "brand", "social", "time", "money", "warning", "growth"];
  const secondary = sceneCycle[Math.abs(animKey) % sceneCycle.length]!;

  const ink = "rgba(30,27,18,0.32)";
  const accent = "#ea580c";
  const style = (
    delay: number,
    width = 1.4,
    stroke: string = ink
  ): React.CSSProperties => ({
    fill: "none",
    stroke,
    strokeWidth: width,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeDasharray: 180,
    strokeDashoffset: 180,
    animation: "cf-draw 0.42s ease-out forwards",
    animationDelay: `${delay}ms`,
  });
  const pop = (delay: number): React.CSSProperties => ({
    fill: accent,
    opacity: 0,
    transformBox: "fill-box",
    transformOrigin: "center",
    animation: "cf-pop 0.24s ease-out forwards",
    animationDelay: `${delay}ms`,
  });

  const drawIcon = (kind: Kind, x: number, y: number, delay: number, compact = false) => {
    const k = compact ? 0.8 : 1;
    switch (kind) {
      case "money":
        return (
          <g>
            <rect x={x - 10 * k} y={y - 6 * k} width={20 * k} height={12 * k} rx={2} style={style(delay, 1.8, ink)} />
            <circle cx={x} cy={y} r={2.6 * k} style={style(delay + 60, 1.5, ink)} />
          </g>
        );
      case "growth":
        return (
          <g>
            <line x1={x - 10 * k} y1={y + 8 * k} x2={x - 10 * k} y2={y - 8 * k} style={style(delay, 1.8, ink)} />
            <line x1={x - 10 * k} y1={y + 8 * k} x2={x + 10 * k} y2={y + 8 * k} style={style(delay + 50, 1.8, ink)} />
            <polyline points={`${x - 7 * k},${y + 4 * k} ${x - 1 * k},${y} ${x + 3 * k},${y - 4 * k} ${x + 8 * k},${y - 8 * k}`} style={style(delay + 110, 1.8, ink)} />
          </g>
        );
      case "time":
        return (
          <g>
            <circle cx={x} cy={y} r={8 * k} style={style(delay, 1.8, ink)} />
            <line x1={x} y1={y} x2={x} y2={y - 4 * k} style={style(delay + 60, 1.6, ink)} />
            <line x1={x} y1={y} x2={x + 3 * k} y2={y + 2 * k} style={style(delay + 90, 1.6, ink)} />
          </g>
        );
      case "warning":
        return (
          <g>
            <polygon points={`${x},${y - 9 * k} ${x + 9 * k},${y + 8 * k} ${x - 9 * k},${y + 8 * k}`} style={style(delay, 1.8, ink)} />
            <line x1={x} y1={y - 2 * k} x2={x} y2={y + 3 * k} style={style(delay + 60, 1.6, ink)} />
            <circle cx={x} cy={y + 6 * k} r={1.4 * k} style={pop(delay + 110)} />
          </g>
        );
      case "brand":
        return (
          <g>
            <rect x={x - 9 * k} y={y - 7 * k} width={18 * k} height={14 * k} rx={2} style={style(delay, 1.8, ink)} />
            <path d={`M ${x - 3 * k} ${y - 9 * k} h ${6 * k}`} style={style(delay + 60, 1.6, ink)} />
          </g>
        );
      case "social":
        return (
          <g>
            <circle cx={x - 6 * k} cy={y - 1 * k} r={2.8 * k} style={style(delay, 1.5, ink)} />
            <circle cx={x + 6 * k} cy={y - 1 * k} r={2.8 * k} style={style(delay + 40, 1.5, ink)} />
            <circle cx={x} cy={y + 5 * k} r={2.8 * k} style={style(delay + 80, 1.5, ink)} />
            <line x1={x - 3 * k} y1={y} x2={x - 1 * k} y2={y + 3 * k} style={style(delay + 110, 1.4, ink)} />
            <line x1={x + 3 * k} y1={y} x2={x + 1 * k} y2={y + 3 * k} style={style(delay + 140, 1.4, ink)} />
          </g>
        );
      default:
        return (
          <g>
            <circle cx={x} cy={y} r={7 * k} style={style(delay, 1.8, ink)} />
            <line x1={x - 3 * k} y1={y + 7 * k} x2={x + 3 * k} y2={y + 7 * k} style={style(delay + 60, 1.6, ink)} />
          </g>
        );
    }
  };

  return (
    <svg key={animKey} viewBox="0 0 160 90" className="absolute inset-0 w-full h-full pointer-events-none">
      <style>{`
        @keyframes cf-draw { to { stroke-dashoffset: 0; } }
        @keyframes cf-pop  { 0%{opacity:0;transform:scale(0.2)} 60%{opacity:1;transform:scale(1.2)} 100%{opacity:1;transform:scale(1)} }
      `}</style>
      {/* Clean layout: one primary + one secondary marker */}
      {/* Primary icon (ink) */}
      {drawIcon(primary, 118, 68, 420, false)}
      {/* Secondary icon (lighter ink) */}
      <g opacity={0.85}>
        {/* we keep geometry identical but soften via opacity + stroke color */}
        {(() => {
          const original = (kind: Kind) => drawIcon(kind, 145, 62, 560, true);
          // Wrap secondary in a <g> where all strokes are softened by CSS currentColor.
          // Simpler: re-render with softInk via the style() stroke argument.
          const drawSoft = (kind: Kind) => {
            const k = true ? 0.8 : 1;
            // Reuse drawIcon by duplicating compact shapes with softInk.
            // For maintainability, keep secondary as a minimal dot marker if not directly supported.
            return drawIcon(kind, 145, 62, 560, true);
          };
          return drawSoft(secondary);
        })()}
      </g>
    </svg>
  );
}

// ─── Scatter doodles ─────────────────────────────────────────────────────────

function ScatterDoodles({ pose, animKey }: { pose: StickmanPose; animKey: number }) {
  // viewBox 160×90 (16:9). Canvas zones:
  //   Text area: x=8–115, y=8–55  |  Doodle icon: x=118–158, y=8–52
  //   Stickman: x=8–72, y=54–88   |  OPEN: x=73–158 y=54–88, margins, bottom strip

  const sc: React.CSSProperties = { strokeLinecap:"round" as const, strokeLinejoin:"round" as const };

  // stroke-dashoffset draw-on helper
  const sd = (delay: number, da: number, stroke="#c4b89a", sw=1.4): React.CSSProperties => ({
    ...sc, fill:"none", stroke, strokeWidth:sw,
    strokeDasharray:da, strokeDashoffset:da,
    animation:"cf-draw 0.38s ease-out forwards", animationDelay:`${delay}ms`,
  });
  // filled pop-in helper
  const pd = (delay: number, fill="#c4b89a"): React.CSSProperties => ({
    fill, opacity:0, transformBox:"fill-box" as const, transformOrigin:"center",
    animation:"cf-pop 0.25s ease-out forwards", animationDelay:`${delay}ms`,
  });

  // ── element builders ──
  const dot   = (cx:number,cy:number,r:number,d:number,c="#ea580c") =>
    <circle cx={cx} cy={cy} r={r} style={pd(d,c)} />;

  const ring  = (cx:number,cy:number,r:number,d:number,c="#c4b89a") =>
    <circle cx={cx} cy={cy} r={r} style={sd(d,r*7,c)} />;

  const cross = (cx:number,cy:number,r:number,d:number,c="#c4b89a") => (<g>
    <line x1={cx-r} y1={cy-r} x2={cx+r} y2={cy+r} style={sd(d,r*4,c)} />
    <line x1={cx+r} y1={cy-r} x2={cx-r} y2={cy+r} style={sd(d+40,r*4,c)} />
  </g>);

  const plus  = (cx:number,cy:number,r:number,d:number,c="#c4b89a") => (<g>
    <line x1={cx-r} y1={cy} x2={cx+r} y2={cy} style={sd(d,r*3,c)} />
    <line x1={cx} y1={cy-r} x2={cx} y2={cy+r} style={sd(d+30,r*3,c)} />
  </g>);

  const asterisk6 = (cx:number,cy:number,r:number,d:number,c="#c4b89a") => (<g>
    {[0,60,120].map((deg,i) => {
      const a=deg*Math.PI/180;
      return <line key={i} x1={cx-r*Math.cos(a)} y1={cy-r*Math.sin(a)} x2={cx+r*Math.cos(a)} y2={cy+r*Math.sin(a)} style={sd(d+i*40,r*3,c)} />;
    })}
  </g>);

  const arrow = (x1:number,y1:number,x2:number,y2:number,d:number,c="#c4b89a") => {
    const dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy),nx=dx/len,ny=dy/len;
    const ax=nx*0.7,ay=ny*0.7,px=-ny*0.5,py=nx*0.5;
    return (<g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} style={sd(d,len+4,c,1.4)} />
      <line x1={x2} y1={y2} x2={x2-ax*3+px*2} y2={y2-ay*3+py*2} style={sd(d+80,6,c,1.4)} />
      <line x1={x2} y1={y2} x2={x2-ax*3-px*2} y2={y2-ay*3-py*2} style={sd(d+100,6,c,1.4)} />
    </g>);
  };

  const diamond = (cx:number,cy:number,r:number,d:number,c="#c4b89a") =>
    <polygon points={`${cx},${cy-r} ${cx+r},${cy} ${cx},${cy+r} ${cx-r},${cy}`}
      style={sd(d,r*8,c)} />;

  const triangle = (cx:number,cy:number,r:number,d:number,c="#c4b89a") =>
    <polygon points={`${cx},${cy-r} ${cx+r*0.866},${cy+r*0.5} ${cx-r*0.866},${cy+r*0.5}`}
      style={sd(d,r*7,c)} />;

  const check = (cx:number,cy:number,r:number,d:number,c="#ea580c") =>
    <polyline points={`${cx-r},${cy} ${cx-r*0.3},${cy+r} ${cx+r},${cy-r*0.6}`}
      style={sd(d,r*6,c,1.6)} />;

  const squiggle = (x:number,y:number,d:number,c="#d4c9a8") =>
    <path d={`M${x},${y} Q${x+4},${y-3} ${x+8},${y} Q${x+12},${y+3} ${x+16},${y}`}
      style={sd(d,30,c,1.3)} />;

  const lightning = (cx:number,cy:number,r:number,d:number,c="#fbbf24") =>
    <polyline points={`${cx+r*0.4},${cy-r} ${cx-r*0.2},${cy-r*0.1} ${cx+r*0.3},${cy} ${cx-r*0.4},${cy+r}`}
      style={sd(d,r*6,c,1.6)} />;

  const hashtag = (cx:number,cy:number,r:number,d:number,c="#c4b89a") => (<g>
    <line x1={cx-r*0.6} y1={cy-r*0.4} x2={cx+r*0.6} y2={cy-r*0.4} style={sd(d,r*2,c)} />
    <line x1={cx-r*0.6} y1={cy+r*0.4} x2={cx+r*0.6} y2={cy+r*0.4} style={sd(d+40,r*2,c)} />
    <line x1={cx-r*0.2} y1={cy-r*0.8} x2={cx-r*0.4} y2={cy+r*0.8} style={sd(d+70,r*2,c)} />
    <line x1={cx+r*0.2} y1={cy-r*0.8} x2={cx+r*0.0} y2={cy+r*0.8} style={sd(d+100,r*2,c)} />
  </g>);

  const infinity = (cx:number,cy:number,r:number,d:number,c="#c4b89a") =>
    <path d={`M${cx},${cy} C${cx-r},${cy-r} ${cx-r*2},${cy-r} ${cx-r*1.5},${cy} C${cx-r},${cy+r} ${cx},${cy+r*0.5} ${cx},${cy} C${cx},${cy-r*0.5} ${cx+r},${cy-r} ${cx+r*1.5},${cy} C${cx+r*2},${cy+r} ${cx+r},${cy+r} ${cx},${cy}`}
      style={sd(d,r*12,c)} />;

  const spiral = (cx:number,cy:number,r:number,d:number,c="#c4b89a") =>
    <path d={`M${cx+r},${cy} A${r},${r} 0 1 0 ${cx-r*0.3},${cy-r*0.95} A${r*0.5},${r*0.5} 0 0 1 ${cx+r*0.3},${cy+r*0.3}`}
      style={sd(d,r*10,c)} />;

  return (
    <svg key={animKey} viewBox="0 0 160 90" className="absolute inset-0 w-full h-full pointer-events-none">
      <style>{`
        @keyframes cf-draw { to { stroke-dashoffset: 0; } }
        @keyframes cf-pop  { 0%{opacity:0;transform:scale(0.2)} 60%{opacity:1;transform:scale(1.3)} 100%{opacity:1;transform:scale(1)} }
      `}</style>

      {/* ── LEFT MARGIN strip (x=2–8) ── */}
      {dot(3,6,1.6,280,"#ea580c")}
      {dot(5,15,1.3,340,"#fbbf24")}
      {cross(4,26,2.2,400)}
      {dot(3,35,1.5,460,"#ea580c")}
      {plus(5,45,2.5,520)}
      {cross(4,56,2.2,580)}
      {dot(3,65,1.6,640,"#fbbf24")}
      {ring(5,74,2.2,700)}
      {dot(4,83,1.4,760,"#ea580c")}

      {/* ── RIGHT MARGIN strip (x=152–158) ── */}
      {dot(157,6,1.6,300,"#fbbf24")}
      {dot(155,15,1.3,360,"#ea580c")}
      {cross(156,26,2.2,420)}
      {dot(157,35,1.5,480,"#fbbf24")}
      {plus(155,45,2.5,540)}
      {cross(156,56,2.2,600)}
      {dot(157,65,1.6,660,"#ea580c")}
      {ring(155,74,2.2,720)}
      {dot(156,83,1.4,780,"#fbbf24")}

      {/* ── BOTTOM STRIP (y=78–88, all x) — fills the narrow footer ── */}
      {squiggle(10,84,650)}
      {squiggle(35,86,690)}
      {squiggle(60,83,730)}
      {squiggle(88,85,770)}
      {squiggle(112,84,810)}
      {squiggle(136,86,850)}
      {dot(22,87,1.4,880,"#ea580c")}
      {dot(48,85,1.3,910,"#fbbf24")}
      {dot(75,88,1.5,940,"#ea580c")}
      {dot(104,86,1.3,970,"#fbbf24")}
      {dot(130,87,1.4,1000,"#ea580c")}
      {dot(148,85,1.3,1030,"#fbbf24")}

      {/* ── BOTTOM-RIGHT OPEN AREA (x=73–155, y=54–78) — main doodle zone ── */}
      {asterisk6(82,62,4,550,"#c4b89a")}
      {arrow(92,58,104,58,600)}
      {diamond(115,60,4,650)}
      {lightning(130,57,5,700,"#fbbf24")}
      {triangle(145,60,4,750)}
      {check(86,72,4.5,800)}
      {hashtag(100,70,5,840)}
      {infinity(117,71,4,890)}
      {asterisk6(133,68,3.5,930,"#ea580c")}
      {spiral(148,70,4,970)}
      {plus(78,76,3.5,820,"#ea580c")}
      {ring(95,78,3,870)}
      {cross(110,77,2.8,910)}
      {arrow(122,80,134,75,950)}
      {diamond(143,77,3.5,990)}
      {dot(80,69,1.5,680,"#fbbf24")}
      {dot(153,63,1.4,720,"#ea580c")}

      {/* ── BOTTOM-CENTER (x=40–72, y=60–78) beside stickman ── */}
      {asterisk6(48,64,3.5,560,"#d4c9a8")}
      {plus(60,68,2.8,610)}
      {ring(50,74,2.5,660)}
      {cross(65,72,2.2,710)}
      {dot(55,80,1.4,760,"#ea580c")}
      {dot(68,76,1.3,800,"#fbbf24")}

      {/* ── Pose-specific accents ── */}
      {pose==="pointing"   && arrow(40,87,110,87,1050,"#ea580c")}
      {pose==="celebrating"&& [28,44,60,76,92,108].map((x,i)=>(
        <line key={i} x1={x} y1={84} x2={x+5} y2={90}
          style={sd(1000+i*55,10,i%2===0?"#ea580c":"#fbbf24",1.6)} />
      ))}
      {pose==="thinking"   && <>{ring(88,65,3.5,950,"#a8956a")}{ring(92,60,2,1020,"#a8956a")}</>}
      {pose==="arms-raised"&& [80,95,110,125,140].map((x,i)=>(
        dot(x,i%2===0?60:66,1.6,900+i*60,i%2===0?"#ea580c":"#fbbf24")
      ))}
      {pose==="walking"    && arrow(80,65,98,60,900,"#ea580c")}
      {pose==="defeated"   && cross(95,62,3,900,"#ea580c")}
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
  const keyObject: StickmanKeyObject = scene.keyObject ?? "idea";

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


  // Icon layout (caption now lives at bottom-center, icon alternates sides via captionOnLeft)
  const iconWidth = iconTier === 1 ? "26%" : iconTier === 3 ? "30%" : iconTier === 4 ? "34%" : "22%";
  const iconOpacity = iconTier === 4 ? "0.15" : "1";

  // Icon position — alternates sides each scene, height varies by tier
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
    <div className="flex flex-col gap-3 w-full select-none">
      {/* Global styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&display=swap');
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
        {/* Dot grid */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 160 90" preserveAspectRatio="none" style={{ opacity: 0.16 }}>
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

          {/* TikTok-style caption — bottom third, centred */}
          <div style={{
            position: "absolute",
            bottom: "11%",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            pointerEvents: "none",
            zIndex: 10,
          }}>
            <AnimatedCaption text={scene.caption} sceneKey={currentIndex} />
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

          {/* Caption-aware scene doodles */}
          <SceneContextDoodles caption={scene.caption} animKey={currentIndex} />

          {/* Stickman — position driven by theme */}
          <div style={{ position: "absolute", ...effectiveStickmanPos }}>
            <StickmanSvg pose={scene.pose} animKey={currentIndex} />
          </div>

          {/* Scene badge — bottom right */}
          <div style={{
            position: "absolute", bottom: "4%", right: "4%",
            fontFamily: "'Caveat', cursive", fontWeight: 700,
            fontSize: "clamp(11px, 1.3vw, 16px)", color: "#a8956a",
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

      {error && <p className="text-center text-sm text-red-500">{error}</p>}

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
              onClick={() => { setCurrentIndex(i); if (!isPlaying) handlePlay(); }}
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
