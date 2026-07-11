/**
 * Motion Graphics Studio — Camera-Style Animations
 *
 * Whole-frame motion effects, typically wrapped around a scene's background
 * media (image/video) to simulate camera work (Ken Burns zoom/pan) or applied
 * to any element for emphasis (shake, bounce).
 *
 * Registered in ./index.ts under AnimationId values:
 *   cameraZoom, pan, shake, bounce
 */

import React from "react";
import { useCurrentFrame } from "remotion";
import {
  AnimationBaseProps,
  DEFAULT_START,
  EASE_IN_OUT,
  easedProgress,
  seededRandom,
} from "./primitives";

// ─── Camera Zoom (Ken Burns) ────────────────────────────────────────────────

interface CameraZoomProps extends AnimationBaseProps {
  children: React.ReactNode;
  fromScale?: number;
  toScale?: number;
}

export const CameraZoom: React.FC<CameraZoomProps> = ({
  startFrame = DEFAULT_START,
  durationInFrames = 150,
  fromScale = 1,
  toScale = 1.15,
  className,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const t = easedProgress(frame, startFrame, durationInFrames, EASE_IN_OUT);
  const scale = fromScale + (toScale - fromScale) * t;
  return (
    <div
      className={className}
      style={{ width: "100%", height: "100%", overflow: "hidden", ...style }}
    >
      <div style={{ width: "100%", height: "100%", transform: `scale(${scale})`, willChange: "transform" }}>
        {children}
      </div>
    </div>
  );
};

// ─── Pan ────────────────────────────────────────────────────────────────────

interface PanProps extends AnimationBaseProps {
  children: React.ReactNode;
  direction?: "left" | "right" | "up" | "down";
  distancePercent?: number;
}

export const Pan: React.FC<PanProps> = ({
  startFrame = DEFAULT_START,
  durationInFrames = 150,
  direction = "left",
  distancePercent = 8,
  className,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const t = easedProgress(frame, startFrame, durationInFrames, EASE_IN_OUT);
  const axis = direction === "left" || direction === "right" ? "X" : "Y";
  const sign = direction === "right" || direction === "down" ? 1 : -1;
  const offset = sign * distancePercent * t;
  return (
    <div
      className={className}
      style={{ width: "112%", height: "112%", position: "relative", left: "-6%", top: "-6%", overflow: "hidden", ...style }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: `translate${axis}(${offset}%)`,
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
};

// ─── Shake ──────────────────────────────────────────────────────────────────
// Deterministic jitter — seeded per-frame so re-renders and out-of-order
// frame rendering always produce the same shake pattern.

interface ShakeProps extends AnimationBaseProps {
  children: React.ReactNode;
  intensityPx?: number;
  seed?: number;
}

export const Shake: React.FC<ShakeProps> = ({
  startFrame = DEFAULT_START,
  durationInFrames = 15,
  intensityPx = 8,
  seed = 7,
  className,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const active = frame >= startFrame && frame < startFrame + durationInFrames;
  const decay = active ? 1 - (frame - startFrame) / durationInFrames : 0;
  const dx = active ? seededRandom(seed, frame, -1, 1) * intensityPx * decay : 0;
  const dy = active ? seededRandom(seed + 1, frame, -1, 1) * intensityPx * decay : 0;
  return (
    <div className={className} style={{ transform: `translate(${dx}px, ${dy}px)`, ...style }}>
      {children}
    </div>
  );
};

// ─── Bounce ─────────────────────────────────────────────────────────────────
// Deterministic decaying-sine bounce (no remotion spring() needed — a plain
// closed-form curve is simpler to reason about and just as smooth).

interface BounceProps extends AnimationBaseProps {
  children: React.ReactNode;
  heightPx?: number;
  bounces?: number;
}

export const Bounce: React.FC<BounceProps> = ({
  startFrame = DEFAULT_START,
  durationInFrames = 30,
  heightPx = 32,
  bounces = 2.5,
  className,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const t = Math.min(Math.max((frame - startFrame) / Math.max(durationInFrames, 1), 0), 1);
  // decaying |sin| gives a natural "drop and settle" bounce
  const decay = Math.exp(-3 * t);
  const bounce = Math.abs(Math.sin(t * Math.PI * bounces)) * decay;
  const offsetY = -bounce * heightPx;
  return (
    <div className={className} style={{ transform: `translateY(${offsetY}px)`, ...style }}>
      {children}
    </div>
  );
};
