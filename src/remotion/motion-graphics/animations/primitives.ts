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

import { Easing, interpolate, spring } from "remotion";

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

// ─── Spring overshoot (the "watchable" upgrade) ────────────────────────────
//
// easedProgress() eases smoothly *to* its target and stops — reliable, but
// reads as "software." Real snap comes from overshooting past the target and
// springing back, which is what springOvershoot() gives you: a 0→~1.05-1.15→1
// curve instead of a flat 0→1. Use it to drive scale/position/rotation on
// entrances; keep opacity on easedProgress() (opacity overshooting past 1 is
// meaningless and just looks like a flicker).
//
// Built on Remotion's spring() rather than a hand-rolled curve because
// spring() already handles the "fit this into an exact number of frames" math
// via its `durationInFrames` option, and it's just as deterministic (a pure
// function of frame/fps/config) as everything else in this file.

export interface SpringOvershootConfig {
  /** Lower = more bounce/oscillation. Remotion default is 10. */
  damping?: number;
  /** Higher = feels heavier/slower to settle. Remotion default is 1. */
  mass?: number;
  /** Higher = snappier initial pop. Remotion default is 100. */
  stiffness?: number;
}

/**
 * 0 → overshoot → 1 progress, fit to settle within roughly `durationInFrames`.
 * `fps` must come from the calling component's useVideoConfig() — spring
 * physics are time-based, not just frame-count-based.
 */
export function springOvershoot(
  frame: number,
  startFrame: number,
  fps: number,
  durationInFrames: number,
  config: SpringOvershootConfig = {}
): number {
  return spring({
    frame: Math.max(frame - startFrame, 0),
    fps,
    durationInFrames: Math.max(durationInFrames, 1),
    config: { damping: 10, mass: 0.6, stiffness: 100, ...config },
  });
}

/** Recommended default spacing (in frames) between staggered items — e.g. words, characters, cards — in a cascading reveal. */
export const DEFAULT_STAGGER_FRAMES = 3;

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
