/**
 * Motion Graphics Studio — Particle & Celebratory Effects
 *
 * These are hand-rolled with deterministic per-particle trajectories rather
 * than an imperative canvas library (e.g. canvas-confetti, already a repo
 * dependency used elsewhere for one-off UI celebrations): Remotion renders
 * every frame as an independent, possibly out-of-order snapshot, so any
 * particle system used inside a composition must be a pure function of
 * (seed, particle index, frame) — an imperative rAF-driven canvas loop would
 * produce different, non-reproducible output per render and cannot be
 * captured frame-by-frame by the renderer.
 *
 * Registered in ./index.ts under AnimationId values:
 *   particleBurst, confetti, spotlightReveal
 */

import React from "react";
import { useCurrentFrame } from "remotion";
import {
  AnimationBaseProps,
  DEFAULT_ACCENT_COLORS,
  DEFAULT_START,
  clamp,
  seededRandom,
} from "./primitives";

// ─── Particle Burst ─────────────────────────────────────────────────────────
// Particles radiate outward from an origin point and fade out.

interface ParticleBurstProps extends AnimationBaseProps {
  count?: number;
  colors?: string[];
  originXPercent?: number;
  originYPercent?: number;
  seed?: number;
}

export const ParticleBurst: React.FC<ParticleBurstProps> = ({
  startFrame = DEFAULT_START,
  durationInFrames = 40,
  count = 24,
  colors = DEFAULT_ACCENT_COLORS,
  originXPercent = 50,
  originYPercent = 50,
  seed = 1,
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  if (local < 0 || local > durationInFrames) return null;
  const t = local / durationInFrames;

  const particles = Array.from({ length: count }, (_, i) => {
    const angle = seededRandom(seed, i * 2, 0, Math.PI * 2);
    const speed = seededRandom(seed, i * 2 + 1, 60, 220);
    const size = seededRandom(seed, i * 3, 6, 16);
    const color = colors[i % colors.length];
    const ease = 1 - Math.pow(1 - t, 2); // ease-out
    const dist = speed * ease;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    const opacity = clamp(1 - t * 1.15, 0, 1);
    return { x, y, size, color, opacity, key: i };
  });

  return (
    <div
      className={className}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", ...style }}
    >
      {particles.map((p) => (
        <div
          key={p.key}
          style={{
            position: "absolute",
            left: `${originXPercent}%`,
            top: `${originYPercent}%`,
            width: p.size,
            height: p.size,
            marginLeft: -p.size / 2,
            marginTop: -p.size / 2,
            borderRadius: "50%",
            background: p.color,
            opacity: p.opacity,
            transform: `translate(${p.x}px, ${p.y}px)`,
          }}
        />
      ))}
    </div>
  );
};

// ─── Confetti ───────────────────────────────────────────────────────────────
// Falling, tumbling rectangles — deterministic per-piece trajectory.

interface ConfettiProps extends AnimationBaseProps {
  count?: number;
  colors?: string[];
  seed?: number;
}

export const Confetti: React.FC<ConfettiProps> = ({
  startFrame = DEFAULT_START,
  durationInFrames = 100,
  count = 60,
  colors = DEFAULT_ACCENT_COLORS,
  seed = 2,
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  if (local < 0 || local > durationInFrames) return null;
  const t = local / durationInFrames;

  const pieces = Array.from({ length: count }, (_, i) => {
    const startX = seededRandom(seed, i * 5, 0, 100);
    const fallSpeed = seededRandom(seed, i * 5 + 1, 70, 130); // percent of frame height over full duration
    const sway = seededRandom(seed, i * 5 + 2, 8, 30);
    const swaySpeed = seededRandom(seed, i * 5 + 3, 2, 5);
    const rotSpeed = seededRandom(seed, i * 5 + 4, -540, 540);
    const size = seededRandom(seed, i * 7, 6, 12);
    const color = colors[i % colors.length];
    const delay = seededRandom(seed, i * 11, 0, 0.3); // stagger start slightly

    const pieceT = clamp((t - delay) / (1 - delay), 0, 1);
    const y = pieceT * fallSpeed; // percent
    const x = startX + Math.sin(pieceT * Math.PI * swaySpeed) * sway;
    const rotation = pieceT * rotSpeed;
    const opacity = pieceT <= 0 ? 0 : clamp(1.2 - pieceT, 0, 1);

    return { x, y, size, color, rotation, opacity, key: i };
  });

  return (
    <div
      className={className}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", ...style }}
    >
      {pieces.map((p) => (
        <div
          key={p.key}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size * 0.4,
            background: p.color,
            opacity: p.opacity,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  );
};

// ─── Spotlight Reveal ───────────────────────────────────────────────────────
// Radial mask expands from a point to reveal `children`.

interface SpotlightRevealProps extends AnimationBaseProps {
  children: React.ReactNode;
  originXPercent?: number;
  originYPercent?: number;
  shape?: "circle" | "ellipse";
}

export const SpotlightReveal: React.FC<SpotlightRevealProps> = ({
  startFrame = DEFAULT_START,
  durationInFrames = 30,
  originXPercent = 50,
  originYPercent = 50,
  shape = "circle",
  className,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const t = clamp((frame - startFrame) / Math.max(durationInFrames, 1), 0, 1);
  // Ease-out so it feels like it "pops" open rather than growing linearly
  const eased = 1 - Math.pow(1 - t, 3);
  const radius = eased * 150; // percent — 150% comfortably covers the whole frame from any origin

  return (
    <div
      className={className}
      style={{
        width: "100%",
        height: "100%",
        clipPath: `${shape}(${radius}% at ${originXPercent}% ${originYPercent}%)`,
        WebkitClipPath: `${shape}(${radius}% at ${originXPercent}% ${originYPercent}%)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
