/**
 * Motion Graphics Studio — Animation Primitives
 *
 * Shared, dependency-free helpers used by every component in
 * src/remotion/motion-graphics/animations/*.tsx.
 *
 * Self-contained (no "@/" imports), matching the convention already used by
 * src/remotion/engine/VideoEngineComposition.tsx, so Remotion's webpack
 * bundler can resolve this module without alias configuration.
 *
 * IMPORTANT — determinism:
 * Remotion renders frames independently and may render them out of order or
 * across multiple worker processes. Every animation MUST be a pure function
 * of `frame` (and the seed values below). Never use Math.random(), Date.now(),
 * useState/useEffect-based accumulation, or anything else that isn't a pure
 * function of the current frame — otherwise particle effects, shakes, etc.
 * will flicker or produce different output per render.
 */

import { Easing, interpolate } from "remotion";

// ─── Deterministic pseudo-random ───────────────────────────────────────────

/** mulberry32 — tiny, fast, deterministic PRNG. Same seed always → same sequence. */
export function mulberry32(seed: number): () => number {
  let t = seed;
  return function next() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic pseudo-random float in [min, max), stable per (seed, index). */
export function seededRandom(seed: number, index: number, min = 0, max = 1): number {
  const rand = mulberry32(seed * 100003 + index * 9973);
  return min + rand() * (max - min);
}

// ─── Easing / math helpers ──────────────────────────────────────────────────

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Smooth, slightly-overshooting ease-out — the default feel across the library. */
export const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

/** 0 → 1 progress of `frame` between startFrame and startFrame + durationInFrames, clamped. */
export function localProgress(frame: number, startFrame: number, durationInFrames: number): number {
  return clamp((frame - startFrame) / Math.max(durationInFrames, 1), 0, 1);
}

/** Eased 0 → 1 progress, convenience wrapper around interpolate + localProgress. */
export function easedProgress(
  frame: number,
  startFrame: number,
  durationInFrames: number,
  easing: (t: number) => number = EASE_OUT_EXPO
): number {
  return interpolate(localProgress(frame, startFrame, durationInFrames), [0, 1], [0, 1], {
    easing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/** Continuous, looping sine wave — for ambient effects (float, glow, background motion). */
export function sineWave(frame: number, periodInFrames: number, phase = 0): number {
  return Math.sin((frame / periodInFrames) * Math.PI * 2 + phase);
}

// ─── Shared prop shapes ─────────────────────────────────────────────────────

/** Common knobs every animation component accepts. See lib/motion-graphics/types.ts BaseAnimationProps. */
export interface AnimationBaseProps {
  /** Frame (relative to the enclosing Sequence) the animation begins on. */
  startFrame?: number;
  /** How long the animation's own motion takes, in frames. */
  durationInFrames?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const DEFAULT_START = 0;
export const DEFAULT_DURATION = 20; // ~0.67s @ 30fps — snappy default for entrances/exits

/** Standard palette used across particle/celebratory effects when no colors[] is supplied. */
export const DEFAULT_ACCENT_COLORS = ["#F89520", "#FDB846", "#60a5fa", "#a78bfa", "#34d399", "#ffffff"];

export const MOTION_FONT = "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif";
