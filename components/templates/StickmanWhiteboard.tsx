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

// ─── Scatter doodles ─────────────────────────────────────────────────────────
// Caption keyword → topic detection → scene-relevant illustration cluster

type ScatterTopic =
  | "money" | "growth" | "social" | "mindset" | "tech" | "time"
  | "health" | "learning" | "brand" | "success" | "problem" | "default";

function detectTopic(caption: string): ScatterTopic {
  const t = caption.toLowerCase();
  if (/\b(money|cash|income|revenue|earn|profit|invest|financ|wealth|dollar|price|pay|sale|cost)\b/.test(t)) return "money";
  if (/\b(grow|growth|scale|expand|audience|follower|reach|viral|trend|traffic|views|engagement)\b/.test(t)) return "growth";
  if (/\b(social|post|content|brand|instagram|tiktok|youtube|facebook|platform|channel|creator|face)\b/.test(t)) return "social";
  if (/\b(mind|mindset|think|believe|fear|confidence|habit|routine|morning|mental|focus|discipline)\b/.test(t)) return "mindset";
  if (/\b(tech|tool|app|software|ai|automat|system|workflow|build|product|digital|online|website)\b/.test(t)) return "tech";
  if (/\b(time|daily|schedule|hour|minutes|week|month|year|consistent|every day|deadline|procrastinat)\b/.test(t)) return "time";
  if (/\b(health|energy|sleep|exercise|diet|stress|burnout|wellbeing|balance|rest|body|workout)\b/.test(t)) return "health";
  if (/\b(learn|study|skill|knowledge|course|book|read|educate|practice|improve|master|expert)\b/.test(t)) return "learning";
  if (/\b(brand|niche|identity|logo|story|trust|audience|authentic|personal|unique|message|value)\b/.test(t)) return "brand";
  if (/\b(success|win|goal|achieve|result|outcome|celebrat|breakthrough|unlock|accomplish|dream)\b/.test(t)) return "success";
  if (/\b(problem|struggle|hard|difficult|challeng|fail|mistake|wrong|obstacle|barrier|stuck|lost)\b/.test(t)) return "problem";
  return "default";
}

function ScatterDoodles({ pose, caption, animKey }: { pose: StickmanPose; caption: string; animKey: number }) {
  const topic = detectTopic(caption);

  const sc: React.CSSProperties = { strokeLinecap:"round" as const, strokeLinejoin:"round" as const };
  const sd = (delay: number, da: number, stroke="#c4b89a", sw=1.4): React.CSSProperties => ({
    ...sc, fill:"none", stroke, strokeWidth:sw,
    strokeDasharray:da, strokeDashoffset:da,
    animation:"cf-draw 0.4s ease-out forwards", animationDelay:`${delay}ms`,
  });
  const pd = (delay: number, fill="#c4b89a"): React.CSSProperties => ({
    fill, opacity:0, transformBox:"fill-box" as const, transformOrigin:"center",
    animation:"cf-pop 0.28s ease-out forwards", animationDelay:`${delay}ms`,
  });

  // ── primitive helpers ──
  const dot  = (cx:number,cy:number,r:number,d:number,c="#ea580c") => <circle cx={cx} cy={cy} r={r} style={pd(d,c)} />;
  const ring = (cx:number,cy:number,r:number,d:number,c="#c4b89a") => <circle cx={cx} cy={cy} r={r} style={sd(d,r*7,c)} />;
  const ln   = (x1:number,y1:number,x2:number,y2:number,d:number,c="#c4b89a",sw=1.4) => {
    const len = Math.sqrt((x2-x1)**2+(y2-y1)**2);
    return <line x1={x1} y1={y1} x2={x2} y2={y2} style={sd(d,len+2,c,sw)} />;
  };
  const arw = (x1:number,y1:number,x2:number,y2:number,d:number,c="#ea580c") => {
    const dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy),nx=dx/len,ny=dy/len;
    const px=-ny*0.5,py=nx*0.5;
    return (<g>
      {ln(x1,y1,x2,y2,d,c,1.5)}
      <line x1={x2} y1={y2} x2={x2-nx*4+px*2.5} y2={y2-ny*4+py*2.5} style={sd(d+90,6,c,1.5)} />
      <line x1={x2} y1={y2} x2={x2-nx*4-px*2.5} y2={y2-ny*4-py*2.5} style={sd(d+110,6,c,1.5)} />
    </g>);
  };
  const sqg = (x:number,y:number,d:number,c="#d4c9a8") =>
    <path d={`M${x},${y} Q${x+4},${y-3} ${x+8},${y} Q${x+12},${y+3} ${x+16},${y}`} style={sd(d,30,c,1.3)} />;
  const chk = (cx:number,cy:number,r:number,d:number,c="#22c55e") =>
    <polyline points={`${cx-r},${cy} ${cx-r*0.3},${cy+r} ${cx+r},${cy-r*0.6}`} style={sd(d,r*6,c,1.8)} />;
  const zap = (cx:number,cy:number,r:number,d:number,c="#fbbf24") =>
    <polyline points={`${cx+r*0.4},${cy-r} ${cx-r*0.2},${cy-r*0.1} ${cx+r*0.3},${cy} ${cx-r*0.4},${cy+r}`} style={sd(d,r*6,c,1.8)} />;

  // ── TOPIC ILLUSTRATION clusters (bottom-right open zone: x=73–155, y=55–78) ──

  // 💰 Money: coin stack, upward arrow, dollar sign
  const moneyCluster = (<>
    {/* coin stack */}
    {ring(88,74,5,500,"#fbbf24")}
    {ring(88,70,5,560,"#fbbf24")}
    {ring(88,66,5,620,"#fbbf24")}
    {dot(88,66,2,680,"#fbbf24")}
    {/* $ sign */}
    <path d={`M110,58 Q105,56 105,61 Q105,66 115,66 Q125,66 125,72 Q125,77 118,76`} style={sd(700,40,"#ea580c",2)} />
    {ln(118,54,118,78,640,"#ea580c",1.6)}
    {/* upward trend */}
    {arw(130,76,152,58,780,"#22c55e")}
    {dot(130,76,1.8,880,"#22c55e")}
    {dot(138,71,1.8,920,"#22c55e")}
    {dot(146,64,1.8,960,"#22c55e")}
    {/* sparkle dots */}
    {dot(102,60,1.5,750,"#fbbf24")}
    {dot(125,57,1.4,800,"#ea580c")}
  </>);

  // 📈 Growth: bar chart + rocket
  const growthCluster = (<>
    {/* bar chart */}
    {ln(78,78,78,55,500,"#c4b89a",1.4)}
    {ln(78,78,110,78,540,"#c4b89a",1.4)}
    <rect x="82" y="68" width="6" height="10" style={sd(600,30,"#c4b89a",1.4)} />
    <rect x="91" y="61" width="6" height="17" style={sd(650,40,"#ea580c",1.6)} />
    <rect x="100" y="57" width="6" height="21" style={sd(700,50,"#ea580c",1.8)} />
    {arw(108,76,118,58,780,"#22c55e")}
    {/* rocket */}
    <path d={`M140,74 Q144,62 148,57 Q152,62 148,74 Z`} style={sd(820,30,"#ea580c",1.8)} />
    {ln(143,73,140,78,870,"#ea580c",1.4)}
    {ln(148,73,151,78,890,"#ea580c",1.4)}
    {dot(148,56,2,950,"#fbbf24")}
    {dot(138,60,1.5,990,"#fbbf24")}
    {dot(152,63,1.4,1020,"#c4b89a")}
  </>);

  // 📱 Social media: phone + like + speech bubble
  const socialCluster = (<>
    {/* phone outline */}
    <rect x="80" y="57" width="14" height="22" rx="2" style={sd(500,60,"#c4b89a",1.6)} />
    {ln(82,62,92,62,580,"#c4b89a",1.2)}
    {dot(87,75,1.5,620,"#c4b89a")}
    {/* heart */}
    <path d={`M108,65 C108,62 112,62 112,65 C112,62 116,62 116,65 C116,68 112,73 112,73 C112,73 108,68 108,65`} style={sd(660,30,"#ea580c",1.8)} />
    {/* speech bubble */}
    <rect x="123" y="57" width="22" height="14" rx="3" style={sd(740,60,"#c4b89a",1.6)} />
    {ln(126,71,123,75,810,"#c4b89a",1.4)}
    {ln(123,61,139,61,850,"#c4b89a",1.1)}
    {ln(123,65,135,65,880,"#c4b89a",1.1)}
    {ln(123,69,131,69,910,"#c4b89a",1.1)}
    {/* likes count */}
    {dot(104,62,1.5,960,"#fbbf24")}
    {dot(119,68,1.5,1000,"#ea580c")}
  </>);

  // 🧠 Mindset: brain waves + light bulb glow + upward path
  const mindsetCluster = (<>
    {/* brain squiggles */}
    {sqg(78,64,500,"#a8956a")}
    {sqg(78,69,560,"#a8956a")}
    {sqg(78,74,620,"#a8956a")}
    {/* step path upward */}
    {ln(104,78,104,70,680,"#ea580c",1.6)}
    {ln(104,70,114,70,720,"#ea580c",1.6)}
    {ln(114,70,114,62,760,"#ea580c",1.6)}
    {ln(114,62,124,62,800,"#ea580c",1.6)}
    {ln(124,62,124,57,840,"#ea580c",1.6)}
    {/* infinity */}
    <path d={`M136,67 C136,63 140,63 142,67 C144,63 148,63 148,67 C148,71 144,71 142,67 C140,71 136,71 136,67`} style={sd(880,40,"#c4b89a",1.4)} />
    {dot(142,67,1.8,960,"#fbbf24")}
    {dot(128,57,1.5,1000,"#ea580c")}
    {dot(150,63,1.4,1030,"#c4b89a")}
  </>);

  // 💻 Tech: code brackets + gear + binary
  const techCluster = (<>
    {/* < > brackets */}
    <polyline points="83,64 78,68 83,72" style={sd(500,14,"#ea580c",2)} />
    <polyline points="97,64 102,68 97,72" style={sd(560,14,"#ea580c",2)} />
    {ln(87,78,93,58,620,"#c4b89a",1.2)}
    {/* gear */}
    {ring(118,67,8,680,"#c4b89a")}
    {ring(118,67,4,740,"#c4b89a")}
    {[0,45,90,135,180,225,270,315].map((deg,i)=>{
      const a=deg*Math.PI/180;
      return <line key={i} x1={118+9*Math.cos(a)} y1={67+9*Math.sin(a)} x2={118+11.5*Math.cos(a)} y2={67+11.5*Math.sin(a)} style={sd(780+i*20,3,"#c4b89a",1.4)} />;
    })}
    {/* binary dots */}
    {dot(136,60,1.6,920,"#ea580c")}
    {dot(140,60,1.6,940,"#c4b89a")}
    {dot(144,60,1.6,960,"#ea580c")}
    {dot(148,60,1.6,980,"#c4b89a")}
    {dot(136,65,1.6,1000,"#c4b89a")}
    {dot(140,65,1.6,1020,"#ea580c")}
    {dot(144,65,1.6,1040,"#c4b89a")}
    {dot(148,65,1.6,1060,"#ea580c")}
  </>);

  // ⏰ Time: clock + calendar + hourglass
  const timeCluster = (<>
    {/* clock */}
    {ring(90,66,11,500,"#c4b89a")}
    {ln(90,60,90,66,580,"#ea580c",1.8)}
    {ln(90,66,96,70,610,"#c4b89a",1.6)}
    {dot(90,66,1.5,660,"#ea580c")}
    {/* calendar */}
    <rect x="108" y="58" width="18" height="16" rx="1" style={sd(700,60,"#c4b89a",1.6)} />
    {ln(108,62,126,62,760,"#c4b89a",1.2)}
    {ln(113,58,113,56,780,"#c4b89a",1.4)}
    {ln(121,58,121,56,800,"#c4b89a",1.4)}
    {dot(112,67,1.4,840,"#ea580c")}
    {dot(117,67,1.4,860,"#c4b89a")}
    {dot(122,67,1.4,880,"#ea580c")}
    {dot(112,71,1.4,900,"#c4b89a")}
    {dot(117,71,1.4,920,"#ea580c")}
    {/* hourglass */}
    <polyline points="135,57 149,57 142,67 149,77 135,77 142,67 135,57" style={sd(960,60,"#fbbf24",1.6)} />
    {dot(142,67,2,1040,"#fbbf24")}
  </>);

  // 💪 Health: heartbeat line + dumbbell + leaf
  const healthCluster = (<>
    {/* heartbeat ECG */}
    <polyline points="78,68 86,68 89,60 92,76 95,63 98,68 108,68" style={sd(500,60,"#ea580c",1.8)} />
    {/* leaf */}
    <path d={`M118,76 C118,62 130,58 134,58 C134,62 130,74 118,76`} style={sd(680,30,"#22c55e",1.6)} />
    {ln(118,76,126,64,740,"#22c55e",1.2)}
    {/* dumbbell */}
    {ring(143,62,4,780,"#c4b89a")}
    {ring(155,62,4,820,"#c4b89a")}
    {ln(147,62,151,62,860,"#c4b89a",2)}
    {dot(126,72,1.5,900,"#22c55e")}
    {dot(136,68,1.5,930,"#fbbf24")}
    {dot(152,72,1.4,960,"#c4b89a")}
  </>);

  // 📚 Learning: open book + pencil + stars
  const learningCluster = (<>
    {/* open book */}
    {ln(80,78,80,60,500,"#c4b89a",1.6)}
    <path d={`M80,60 C86,57 96,58 102,60`} style={sd(560,30,"#c4b89a",1.4)} />
    <path d={`M80,78 C86,75 96,76 102,78`} style={sd(590,30,"#c4b89a",1.4)} />
    {ln(102,60,102,78,620,"#c4b89a",1.6)}
    {ln(82,65,100,65,660,"#c4b89a",1.1)}
    {ln(82,69,98,69,690,"#c4b89a",1.1)}
    {ln(82,73,96,73,720,"#c4b89a",1.1)}
    {/* pencil */}
    <polygon points="115,57 122,57 122,74 118.5,78 115,74" style={sd(760,50,"#fbbf24",1.6)} />
    {ln(115,74,122,74,820,"#fbbf24",1.4)}
    {dot(118.5,77,1.5,860,"#ea580c")}
    {/* stars */}
    {[[133,60],[142,58],[151,61],[147,70],[135,68]].map(([x,y],i)=>(
      <path key={i} d={`M${x},${y-3} L${x+1},${y-1} L${x+3},${y-1} L${x+1.5},${y+0.5} L${x+2},${y+3} L${x},${y+1.5} L${x-2},${y+3} L${x-1.5},${y+0.5} L${x-3},${y-1} L${x-1},${y-1} Z`}
        style={sd(900+i*60,20,i%2===0?"#fbbf24":"#ea580c",1.2)} />
    ))}
  </>);

  // 🎯 Brand: target + crown + megaphone
  const brandCluster = (<>
    {/* target */}
    {ring(88,67,11,500,"#ea580c")}
    {ring(88,67,6.5,560,"#ea580c")}
    {dot(88,67,2.5,640,"#ea580c")}
    {/* crown */}
    <polyline points="112,74 112,62 116,67 120,60 124,67 128,62 128,74" style={sd(700,50,"#fbbf24",2)} />
    {ln(112,74,128,74,760,"#fbbf24",2)}
    {/* megaphone */}
    <polygon points="136,62 136,72 144,76 144,58" style={sd(800,44,"#c4b89a",1.6)} />
    <rect x="131" y="64" width="5" height="8" rx="1" style={sd(860,26,"#c4b89a",1.6)} />
    {ln(144,66,150,62,900,"#c4b89a",1.4)}
    {ln(144,69,152,69,930,"#c4b89a",1.4)}
    {ln(144,72,150,76,960,"#c4b89a",1.4)}
    {dot(100,60,1.5,980,"#fbbf24")}
  </>);

  // 🏆 Success: trophy + star burst + checkmarks
  const successCluster = (<>
    {/* trophy cup */}
    <path d={`M88,58 h18 v14 a9 9 0 0 1-18 0 Z`} style={sd(500,60,"#fbbf24",2)} />
    {ln(91,72,89,78,580,"#fbbf24",1.6)}
    {ln(103,72,105,78,600,"#fbbf24",1.6)}
    {ln(87,78,107,78,640,"#fbbf24",2)}
    {/* handles */}
    <path d={`M88,62 Q82,65 82,69 Q82,73 88,75`} style={sd(680,20,"#c4b89a",1.4)} />
    <path d={`M106,62 Q112,65 112,69 Q112,73 106,75`} style={sd(710,20,"#c4b89a",1.4)} />
    {/* burst rays */}
    {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg,i)=>{
      const a=deg*Math.PI/180, x1=97+17*Math.cos(a), y1=67+17*Math.sin(a), x2=97+22*Math.cos(a), y2=67+22*Math.sin(a);
      return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} style={sd(760+i*25,5,"#fbbf24",1.2)} />;
    })}
    {/* checkmarks */}
    {chk(128,65,4,1080,"#22c55e")}
    {chk(140,65,4,1120,"#22c55e")}
    {dot(134,74,2,1160,"#fbbf24")}
    {dot(148,72,1.6,1180,"#ea580c")}
  </>);

  // ❌ Problem: cracked X + question marks + storm cloud
  const problemCluster = (<>
    {/* big X */}
    {ln(78,58,98,76,500,"#ea580c",2.2)}
    {ln(98,58,78,76,540,"#ea580c",2.2)}
    {/* cracks */}
    <path d={`M88,67 l-5,3 l4,2 l-3,4`} style={sd(620,14,"#c4b89a",1.2)} />
    {/* question marks */}
    <path d={`M112,60 Q112,56 116,56 Q120,56 120,60 Q120,63 116,64 L116,66`} style={sd(700,24,"#c4b89a",1.6)} />
    {dot(116,69,1.6,780,"#c4b89a")}
    <path d={`M128,62 Q128,59 131,59 Q134,59 134,62 Q134,64 131,65 L131,66`} style={sd(820,18,"#a8956a",1.4)} />
    {dot(131,68,1.4,880,"#a8956a")}
    {/* storm cloud */}
    <ellipse cx="142" cy="65" rx="9" ry="6" style={sd(900,30,"#94a3b8",1.6)} />
    <ellipse cx="148" cy="62" rx="6" ry="5" style={sd(940,22,"#94a3b8",1.4)} />
    {zap(145,73,5,980,"#fbbf24")}
    {dot(136,60,1.5,1040,"#94a3b8")}
  </>);

  // 🔵 Default: abstract shapes — calm and non-distracting
  const defaultCluster = (<>
    {ring(88,67,8,500)}
    {ring(108,65,5,580,"#ea580c")}
    {ln(78,78,108,58,640,"#d4c9a8",1.3)}
    {arw(120,75,148,62,700,"#c4b89a")}
    {dot(118,60,1.8,780,"#fbbf24")}
    {dot(134,70,1.5,820,"#ea580c")}
    {dot(148,75,1.4,860,"#c4b89a")}
    {chk(130,63,4.5,900)}
    {dot(148,58,1.4,960,"#fbbf24")}
  </>);

  const topicCluster = {
    money:    moneyCluster,
    growth:   growthCluster,
    social:   socialCluster,
    mindset:  mindsetCluster,
    tech:     techCluster,
    time:     timeCluster,
    health:   healthCluster,
    learning: learningCluster,
    brand:    brandCluster,
    success:  successCluster,
    problem:  problemCluster,
    default:  defaultCluster,
  }[topic];

  return (
    <svg key={animKey} viewBox="0 0 160 90" className="absolute inset-0 w-full h-full pointer-events-none">
      <style>{`
        @keyframes cf-draw { to { stroke-dashoffset: 0; } }
        @keyframes cf-pop  { 0%{opacity:0;transform:scale(0.2)} 60%{opacity:1;transform:scale(1.3)} 100%{opacity:1;transform:scale(1)} }
      `}</style>

      {/* ── LEFT MARGIN strip ── */}
      {dot(3,8,1.6,280,"#ea580c")}
      {dot(4,20,1.3,340,"#fbbf24")}
      {dot(3,32,1.5,400,"#ea580c")}
      {dot(4,44,1.4,460,"#fbbf24")}
      {dot(3,56,1.6,520,"#ea580c")}
      {dot(4,68,1.3,580,"#fbbf24")}
      {dot(3,80,1.5,640,"#ea580c")}

      {/* ── RIGHT MARGIN strip ── */}
      {dot(157,8,1.5,300,"#fbbf24")}
      {dot(156,20,1.4,360,"#ea580c")}
      {dot(157,32,1.6,420,"#fbbf24")}
      {dot(156,44,1.3,480,"#ea580c")}
      {dot(157,56,1.5,540,"#fbbf24")}
      {dot(156,68,1.4,600,"#ea580c")}
      {dot(157,80,1.6,660,"#fbbf24")}

      {/* ── BOTTOM STRIP (footer squiggles) ── */}
      {sqg(10,84,650)}
      {sqg(36,86,690)}
      {sqg(62,84,730)}
      {sqg(90,85,770)}
      {sqg(116,84,810)}
      {sqg(140,86,850)}

      {/* ── TOPIC ILLUSTRATION — bottom-right open area ── */}
      {topicCluster}

      {/* ── Pose accent ── */}
      {pose==="celebrating" && [30,48,66,84,102,120].map((x,i)=>(
        <line key={i} x1={x} y1={83} x2={x+4} y2={90}
          style={sd(1000+i*50,10,i%2===0?"#ea580c":"#fbbf24",1.8)} />
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
        <ScatterDoodles pose={scene.pose} caption={scene.caption} animKey={currentIndex} />

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
