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

// ─── Scatter doodles (ambient decorative layer across the whole canvas) ───────

function ScatterDoodles({ pose, animKey }: { pose: StickmanPose; animKey: number }) {
  // viewBox 160×90 = 16:9 — dots stay round, not stretched
  // Positions chosen to avoid the caption text area (top 5%–58%, left 5%–72%)
  // and the doodle area (top 9%–56%, right 78%–98%)
  // Safe zones: far left strip (x<8), far right strip (x>155), bottom row (y>75)
  const stars: [number, number, number, number][] = [
    [4,5,1.8,300],[6,14,1.4,370],[3,22,1.6,430],
    [156,5,1.8,320],[158,13,1.3,390],[154,22,1.5,460],
    [4,68,1.8,680],[7,76,1.4,730],[3,84,1.6,780],
    [156,68,1.8,700],[158,76,1.3,750],[154,84,1.5,800],
    [80,80,1.6,850],[100,83,1.4,890],[60,85,1.5,920],
  ];
  // Small ✕ — stay in far margins
  const crosses: [number, number, number][] = [[5,40,400],[5,55,460],[155,40,500],[155,55,560]];
  // Squiggly accent lines — bottom strip only
  const squigs: [string,number][] = [
    ["M10,87 Q14,84 18,87 Q22,90 26,87", 650],
    ["M134,87 Q138,84 142,87 Q146,90 150,87", 720],
  ];
  // Small rings
  const rings: [number,number,number,number][] = [[5,62,2,860],[155,62,2,910],[80,87,1.8,960]];

  return (
    <svg key={animKey} viewBox="0 0 160 90" className="absolute inset-0 w-full h-full pointer-events-none">
      <style>{`
        @keyframes cf-draw { to { stroke-dashoffset: 0; } }
        @keyframes cf-pop  {
          0%  { opacity:0; transform:scale(0.2); }
          60% { opacity:1; transform:scale(1.3); }
          100%{ opacity:1; transform:scale(1); }
        }
      `}</style>
      {/* filled star dots */}
      {stars.map(([cx,cy,r,d],i) => (
        <circle key={i} cx={cx} cy={cy} r={r}
          style={{ fill: i%2===0 ? "#ea580c" : "#fbbf24", opacity:0,
            animation:"cf-pop 0.3s ease-out forwards", animationDelay:`${d}ms`,
            transformBox:"fill-box", transformOrigin:"center" }} />
      ))}
      {/* ✕ crosses */}
      {crosses.map(([cx,cy,d],i) => (
        <g key={i}>
          <line x1={cx-3} y1={cy-3} x2={cx+3} y2={cy+3}
            style={{ stroke:"#c4b89a", strokeWidth:1.5, strokeLinecap:"round",
              strokeDasharray:20, strokeDashoffset:20,
              animation:"cf-draw 0.3s ease-out forwards", animationDelay:`${d}ms` }} />
          <line x1={cx+3} y1={cy-3} x2={cx-3} y2={cy+3}
            style={{ stroke:"#c4b89a", strokeWidth:1.5, strokeLinecap:"round",
              strokeDasharray:20, strokeDashoffset:20,
              animation:"cf-draw 0.3s ease-out forwards", animationDelay:`${d+40}ms` }} />
        </g>
      ))}
      {/* squiggles */}
      {squigs.map(([p,d],i) => (
        <path key={i} d={p}
          style={{ fill:"none", stroke:"#d4c9a8", strokeWidth:1.5, strokeLinecap:"round",
            strokeDasharray:50, strokeDashoffset:50,
            animation:"cf-draw 0.4s ease-out forwards", animationDelay:`${d}ms` }} />
      ))}
      {/* small rings */}
      {rings.map(([cx,cy,r,d],i) => (
        <circle key={i} cx={cx} cy={cy} r={r}
          style={{ fill:"none", stroke:"#c4b89a", strokeWidth:1.5,
            strokeDasharray:30, strokeDashoffset:30,
            animation:"cf-draw 0.3s ease-out forwards", animationDelay:`${d}ms` }} />
      ))}
      {/* pose-specific accent — bottom strip, 160×90 coords */}
      {pose === "pointing" && <line x1="45" y1="88" x2="115" y2="88"
        style={{ stroke:"#ea580c", strokeWidth:1.5, strokeLinecap:"round",
          strokeDasharray:80, strokeDashoffset:80,
          animation:"cf-draw 0.5s ease-out forwards", animationDelay:"1100ms" }} />}
      {pose === "celebrating" && [30,46,62,78,94,110].map((x,i) => (
        <line key={i} x1={x} y1={85} x2={x+5} y2={90}
          style={{ stroke:i%2===0?"#ea580c":"#fbbf24", strokeWidth:1.5,
            strokeDasharray:12, strokeDashoffset:12,
            animation:"cf-draw 0.2s ease-out forwards", animationDelay:`${1000+i*60}ms` }} />
      ))}
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

        {/* Scatter doodles — ambient layer across full canvas */}
        <ScatterDoodles pose={scene.pose} animKey={currentIndex} />

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
