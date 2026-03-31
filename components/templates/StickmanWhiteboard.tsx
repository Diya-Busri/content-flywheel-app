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
          animation: cf-draw 0.55s ease-out forwards;
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

// ─── Caption lines (4 words per line, first line orange) ─────────────────────

function AnimatedCaption({ text, sceneKey }: { text: string; sceneKey: number }) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += 4) lines.push(words.slice(i, i + 4).join(" "));
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
            fontSize: i === 0 ? "clamp(22px, 3.2vw, 46px)" : "clamp(16px, 2.2vw, 32px)",
            lineHeight: 1.25,
            color: i === 0 ? "#ea580c" : "#1e1b12",
            marginBottom: i === 0 ? "0.18em" : "0.1em",
            letterSpacing: i === 0 ? "0.01em" : "0",
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

// ─── Pose doodle (top-right decorative icon) ──────────────────────────────────

function PoseDoodle({ pose }: { pose: StickmanPose }) {
  const strokeStyle = (delay: number, sw = 2.5): React.CSSProperties => ({
    fill: "none", stroke: "#1e1b12", strokeWidth: sw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    strokeDasharray: 300, strokeDashoffset: 300,
    animation: "cf-draw 0.5s ease-out forwards",
    animationDelay: `${delay}ms`,
  });
  const dotStyle = (delay: number): React.CSSProperties => ({
    fill: "#1e1b12", opacity: 0,
    animation: "cf-pop 0.25s ease-out forwards",
    animationDelay: `${delay}ms`,
  });
  const oStyle = (delay: number, sw = 2.5): React.CSSProperties => ({ ...strokeStyle(delay, sw), strokeDasharray: 200 });

  const icons: Record<StickmanPose, React.ReactNode> = {
    thinking: (
      <>
        {/* Lightbulb */}
        <circle cx="50" cy="32" r="18" style={oStyle(200)} />
        <line x1="38" y1="46" x2="43" y2="54" style={strokeStyle(600)} />
        <line x1="50" y1="48" x2="50" y2="56" style={strokeStyle(650)} />
        <line x1="62" y1="46" x2="57" y2="54" style={strokeStyle(700)} />
        <line x1="43" y1="57" x2="57" y2="57" style={strokeStyle(750)} />
        <line x1="44" y1="62" x2="56" y2="62" style={strokeStyle(800)} />
        {/* Rays */}
        <line x1="50" y1="8"  x2="50" y2="2"  style={strokeStyle(400, 2)} />
        <line x1="70" y1="18" x2="74" y2="14" style={strokeStyle(440, 2)} />
        <line x1="30" y1="18" x2="26" y2="14" style={strokeStyle(480, 2)} />
        <line x1="76" y1="34" x2="82" y2="34" style={strokeStyle(520, 2)} />
        <line x1="24" y1="34" x2="18" y2="34" style={strokeStyle(560, 2)} />
      </>
    ),
    pointing: (
      <>
        {/* Bar chart */}
        <line x1="14" y1="72" x2="86" y2="72" style={strokeStyle(200, 2.5)} />
        <line x1="14" y1="72" x2="14" y2="14" style={strokeStyle(350, 2.5)} />
        <rect x="20" y="52" width="12" height="20" style={{ ...strokeStyle(500), fill: "rgba(234,88,12,0.15)" }} />
        <rect x="38" y="40" width="12" height="32" style={{ ...strokeStyle(600), fill: "rgba(234,88,12,0.15)" }} />
        <rect x="56" y="26" width="12" height="46" style={{ ...strokeStyle(700), fill: "rgba(234,88,12,0.15)" }} />
        {/* Up arrow */}
        <line x1="78" y1="30" x2="78" y2="10" style={strokeStyle(850, 2.5)} />
        <line x1="70" y1="18" x2="78" y2="10" style={strokeStyle(900, 2.5)} />
        <line x1="86" y1="18" x2="78" y2="10" style={strokeStyle(950, 2.5)} />
      </>
    ),
    celebrating: (
      <>
        {/* Trophy */}
        <path d="M34 14 h32 v24 a16 16 0 0 1-32 0 Z" style={strokeStyle(200)} />
        <line x1="50" y1="54" x2="50" y2="68" style={strokeStyle(600)} />
        <line x1="34" y1="68" x2="66" y2="68" style={strokeStyle(700)} />
        <line x1="20" y1="18" x2="34" y2="18" style={strokeStyle(350)} />
        <line x1="80" y1="18" x2="66" y2="18" style={strokeStyle(450)} />
        {/* Stars */}
        <circle cx="18" cy="36" r="3" style={dotStyle(750)} />
        <circle cx="82" cy="36" r="3" style={dotStyle(800)} />
        <circle cx="26" cy="60" r="2" style={dotStyle(850)} />
        <circle cx="74" cy="60" r="2" style={dotStyle(900)} />
        <circle cx="50" cy="8"  r="3" style={dotStyle(950)} />
      </>
    ),
    standing: (
      <>
        {/* Giant ? */}
        <path d="M34 28 a16 16 0 1 1 20 15 c0 4-4 8-4 14" style={strokeStyle(200, 3.5)} />
        <circle cx="50" cy="70" r="3.5" style={dotStyle(750)} />
      </>
    ),
    sitting: (
      <>
        {/* Laptop */}
        <rect x="16" y="20" width="68" height="44" rx="4" style={strokeStyle(200)} />
        <line x1="24" y1="30" x2="52" y2="30" style={strokeStyle(500, 1.8)} />
        <line x1="24" y1="38" x2="44" y2="38" style={strokeStyle(560, 1.8)} />
        <line x1="24" y1="46" x2="56" y2="46" style={strokeStyle(620, 1.8)} />
        <line x1="8"  y1="68" x2="92" y2="68" style={strokeStyle(750)} />
        {/* Code cursor */}
        <rect x="57" y="34" width="2" height="8" style={dotStyle(800)} />
      </>
    ),
    defeated: (
      <>
        {/* Storm cloud */}
        <path d="M24 44 a14 14 0 0 1 14-14 a10 10 0 0 1 20 0 a12 12 0 0 1 8 22 H24 Z" style={strokeStyle(200)} />
        {/* Rain */}
        <line x1="30" y1="56" x2="26" y2="70" style={strokeStyle(600, 2)} />
        <line x1="42" y1="56" x2="38" y2="72" style={strokeStyle(650, 2)} />
        <line x1="54" y1="56" x2="50" y2="70" style={strokeStyle(700, 2)} />
        <line x1="66" y1="56" x2="62" y2="72" style={strokeStyle(750, 2)} />
        <line x1="38" y1="76" x2="34" y2="84" style={strokeStyle(800, 2)} />
        <line x1="52" y1="74" x2="48" y2="82" style={strokeStyle(840, 2)} />
      </>
    ),
    "arms-raised": (
      <>
        {/* Firework burst */}
        {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg, idx) => {
          const rad = (deg * Math.PI) / 180;
          const x1 = 50 + 14 * Math.cos(rad), y1 = 42 + 14 * Math.sin(rad);
          const x2 = 50 + 34 * Math.cos(rad), y2 = 42 + 34 * Math.sin(rad);
          return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} style={strokeStyle(300 + idx * 50, 2)} />;
        })}
        <circle cx="50" cy="42" r="10" style={oStyle(200)} />
        <circle cx="50" cy="42" r="4"  style={dotStyle(900)} />
      </>
    ),
    walking: (
      <>
        {/* Winding path + arrow */}
        <path d="M10 72 Q30 50 50 60 Q70 70 90 42" style={strokeStyle(200, 2.5)} />
        <line x1="82" y1="34" x2="90" y2="42" style={strokeStyle(700, 2.5)} />
        <line x1="90" y1="42" x2="82" y2="50" style={strokeStyle(750, 2.5)} />
        {/* Footprints */}
        <ellipse cx="22" cy="74" rx="3" ry="5" style={oStyle(450, 1.5)} />
        <ellipse cx="34" cy="66" rx="3" ry="5" style={oStyle(520, 1.5)} />
        <ellipse cx="46" cy="62" rx="3" ry="5" style={oStyle(590, 1.5)} />
        <ellipse cx="58" cy="66" rx="3" ry="5" style={oStyle(660, 1.5)} />
        {/* Destination star */}
        <circle cx="90" cy="34" r="5" style={dotStyle(850)} />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 100 88" className="w-full h-full">
      <style>{`
        @keyframes cf-draw { to { stroke-dashoffset: 0; } }
        @keyframes cf-pop  { 0%{opacity:0;transform:scale(0.3)} 60%{opacity:1;transform:scale(1.2)} 100%{opacity:1;transform:scale(1)} }
      `}</style>
      {icons[pose]}
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
    <div className="flex flex-col gap-3 w-full select-none">
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
          background: "#FFFEF8",
          border: "2px solid #E6DFC8",
          boxShadow: "0 12px 40px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)",
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

        {/* Orange top bar */}
        <div className="absolute top-0 left-0 right-0 h-[7px]"
          style={{ background: "linear-gradient(90deg, #c2410c, #ea580c, #f97316, #fbbf24)" }} />

        {/* Horizontal separator between text area and stickman row */}
        <div className="absolute left-[5%] right-[5%]" style={{ top: "58%", height: "1px", background: "linear-gradient(90deg, transparent, #d4c9a8 20%, #d4c9a8 80%, transparent)" }} />

        {/* Scene fade-in wrapper */}
        <div key={currentIndex} className="cf-scene-fade absolute inset-0">

          {/* ── TOP AREA: caption (left) + doodle (right) ── */}

          {/* Highlight bar behind first line */}
          <div
            className="cf-highlight-bar"
            style={{
              position: "absolute",
              top: "11%", left: "4%", right: "30%", height: "17%",
              background: "rgba(234,88,12,0.10)",
              borderRadius: 6,
              animationDelay: "60ms",
            }}
          />

          {/* Caption text */}
          <div style={{ position: "absolute", top: "10%", left: "5%", right: "28%", bottom: "42%" }}>
            <AnimatedCaption text={scene.caption} sceneKey={currentIndex} />
          </div>

          {/* Pose doodle — top right */}
          <div className="cf-doodle-pop" style={{ position: "absolute", top: "9%", right: "2%", width: "22%", height: "47%" }}>
            <PoseDoodle pose={scene.pose} />
          </div>

          {/* ── BOTTOM ROW: stickman (left-centre) ── */}
          <div style={{ position: "absolute", bottom: "2%", left: "5%", width: "42%", top: "58%" }}>
            <StickmanSvg pose={scene.pose} animKey={currentIndex} />
          </div>

          {/* Scene badge — bottom right */}
          <div style={{
            position: "absolute", bottom: "6%", right: "4%",
            fontFamily: "'Caveat', cursive", fontWeight: 700,
            fontSize: "clamp(12px, 1.4vw, 18px)", color: "#a8956a",
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
