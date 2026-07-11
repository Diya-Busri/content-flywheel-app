/**
 * Motion Graphics Studio — Animation Registry
 *
 * The single lookup table every other module uses to go from an AnimationId
 * (lib/motion-graphics/types.ts) to an actual React component:
 *   - src/remotion/motion-graphics/MotionGraphicsComposition.tsx uses it to
 *     render whatever animation a scene/element was configured with.
 *   - The Admin → Motion Graphics Studio → Animation Library tab uses it to
 *     render a live, looping <Player> preview + label/description for all
 *     31 animations, grouped by category.
 *   - The AI script-to-scenes step (lib/motion-graphics/ai-script-to-scenes.ts)
 *     validates the model's chosen animation ids against this registry's keys.
 *
 * `kind` tells a consumer how to invoke the component:
 *   "wrapper"    — takes `children` + timing props; wraps any scene element
 *                  (text/image/video/icon) to animate its entrance/exit or
 *                  apply a whole-frame camera effect.
 *   "textContent"— standalone, takes the element's text content directly
 *                  (typewriter/word/character reveal, counters, bars, loaders).
 *   "particle"   — standalone full-scene overlay effect, no content needed.
 *   "composite"  — standalone, opinionated multi-field block; its scene
 *                  element's `content` is a JSON-encoded config object
 *                  matching that component's own props.
 *   "background" — used only as a Scene's `background.value` when
 *                  background.type === "animated".
 */

import React from "react";
import type { AnimationCategory, AnimationId } from "@/lib/motion-graphics/types";
import {
  FadeIn,
  FadeOut,
  SlideLeft,
  SlideRight,
  SlideUp,
  SlideDown,
  ScaleIn,
  ScaleOut,
  Rotate,
  BlurReveal,
  GlowPulse,
  Floating,
} from "./transitions";
import {
  TypewriterText,
  WordByWordReveal,
  CharacterReveal,
  NumberCounter,
  ProgressBar,
  LoadingAnimation,
} from "./text-effects";
import { CameraZoom, Pan, Shake, Bounce } from "./camera-effects";
import { ParticleBurst, Confetti, SpotlightReveal } from "./particle-effects";
import {
  CardStack,
  Carousel,
  LogoReveal,
  CTAEnding,
  TimelineProgress,
  AnimatedBackground,
} from "./composite-elements";

export * from "./transitions";
export * from "./text-effects";
export * from "./camera-effects";
export * from "./particle-effects";
export * from "./composite-elements";
export * from "./primitives";

export type AnimationKind = "wrapper" | "textContent" | "particle" | "composite" | "background";

export interface AnimationRegistryEntry {
  id: AnimationId;
  label: string;
  category: AnimationCategory;
  kind: AnimationKind;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: React.ComponentType<any>;
  /** Sensible default config for both the Scene Editor form and the gallery preview. */
  defaultConfig: Record<string, unknown>;
}

export const ANIMATION_REGISTRY: Record<AnimationId, AnimationRegistryEntry> = {
  fadeIn: {
    id: "fadeIn",
    label: "Fade In",
    category: "transition",
    kind: "wrapper",
    description: "Element fades from transparent to fully visible.",
    Component: FadeIn,
    defaultConfig: { durationInFrames: 20 },
  },
  fadeOut: {
    id: "fadeOut",
    label: "Fade Out",
    category: "transition",
    kind: "wrapper",
    description: "Element fades from visible to transparent.",
    Component: FadeOut,
    defaultConfig: { durationInFrames: 20 },
  },
  slideLeft: {
    id: "slideLeft",
    label: "Slide Left",
    category: "transition",
    kind: "wrapper",
    description: "Enters from the right, settling into place moving left.",
    Component: SlideLeft,
    defaultConfig: { durationInFrames: 22, distance: 120 },
  },
  slideRight: {
    id: "slideRight",
    label: "Slide Right",
    category: "transition",
    kind: "wrapper",
    description: "Enters from the left, settling into place moving right.",
    Component: SlideRight,
    defaultConfig: { durationInFrames: 22, distance: 120 },
  },
  slideUp: {
    id: "slideUp",
    label: "Slide Up",
    category: "transition",
    kind: "wrapper",
    description: "Enters from below, settling into place moving up.",
    Component: SlideUp,
    defaultConfig: { durationInFrames: 22, distance: 120 },
  },
  slideDown: {
    id: "slideDown",
    label: "Slide Down",
    category: "transition",
    kind: "wrapper",
    description: "Enters from above, settling into place moving down.",
    Component: SlideDown,
    defaultConfig: { durationInFrames: 22, distance: 120 },
  },
  scaleIn: {
    id: "scaleIn",
    label: "Scale In",
    category: "transition",
    kind: "wrapper",
    description: "Grows from slightly smaller than full size, with a fade.",
    Component: ScaleIn,
    defaultConfig: { durationInFrames: 20, fromScale: 0.82, toScale: 1 },
  },
  scaleOut: {
    id: "scaleOut",
    label: "Scale Out",
    category: "transition",
    kind: "wrapper",
    description: "Shrinks slightly while fading out.",
    Component: ScaleOut,
    defaultConfig: { durationInFrames: 20, fromScale: 1, toScale: 0.82 },
  },
  rotate: {
    id: "rotate",
    label: "Rotate",
    category: "transition",
    kind: "wrapper",
    description: "Settles from a slight tilt into level, with an optional continuous spin.",
    Component: Rotate,
    defaultConfig: { durationInFrames: 20, fromDeg: -12, toDeg: 0, continuous: false },
  },
  blurReveal: {
    id: "blurReveal",
    label: "Blur Reveal",
    category: "transition",
    kind: "wrapper",
    description: "Resolves from a heavy blur into sharp focus.",
    Component: BlurReveal,
    defaultConfig: { durationInFrames: 30, maxBlurPx: 22 },
  },
  glowPulse: {
    id: "glowPulse",
    label: "Glow Pulse",
    category: "transition",
    kind: "wrapper",
    description: "Ambient, continuously pulsing glow — good for CTAs and badges.",
    Component: GlowPulse,
    defaultConfig: { periodInFrames: 60, color: "#F89520" },
  },
  floating: {
    id: "floating",
    label: "Floating",
    category: "transition",
    kind: "wrapper",
    description: "Gentle, continuous up/down drift — keeps static elements feeling alive.",
    Component: Floating,
    defaultConfig: { amplitudePx: 14, periodInFrames: 90 },
  },
  typewriterText: {
    id: "typewriterText",
    label: "Typewriter Text",
    category: "text",
    kind: "textContent",
    description: "Text is typed out character by character with a blinking cursor.",
    Component: TypewriterText,
    defaultConfig: { charsPerSecond: 18, showCursor: true },
  },
  wordByWordReveal: {
    id: "wordByWordReveal",
    label: "Word by Word Reveal",
    category: "text",
    kind: "textContent",
    description: "Each word pops in individually, left to right.",
    Component: WordByWordReveal,
    defaultConfig: { wordsPerSecond: 3 },
  },
  characterReveal: {
    id: "characterReveal",
    label: "Character Reveal",
    category: "text",
    kind: "textContent",
    description: "Every character fades and rises in individually, fast stagger.",
    Component: CharacterReveal,
    defaultConfig: { charsPerSecond: 24 },
  },
  numberCounter: {
    id: "numberCounter",
    label: "Number Counter",
    category: "text",
    kind: "textContent",
    description: "Counts up (or down) from one number to another.",
    Component: NumberCounter,
    defaultConfig: { from: 0, to: 100, durationInFrames: 60, decimals: 0 },
  },
  progressBar: {
    id: "progressBar",
    label: "Progress Bars",
    category: "text",
    kind: "textContent",
    description: "An animated fill bar with an optional percent label.",
    Component: ProgressBar,
    defaultConfig: { durationInFrames: 60, fromPercent: 0, toPercent: 100, color: "#F89520" },
  },
  loadingAnimation: {
    id: "loadingAnimation",
    label: "Loading Animation",
    category: "text",
    kind: "textContent",
    description: "A continuously looping spinner, dots, or indeterminate bar.",
    Component: LoadingAnimation,
    defaultConfig: { variant: "spinner", color: "#F89520" },
  },
  cameraZoom: {
    id: "cameraZoom",
    label: "Camera Zoom",
    category: "camera",
    kind: "wrapper",
    description: "Ken Burns-style slow zoom applied to a background image/video.",
    Component: CameraZoom,
    defaultConfig: { durationInFrames: 150, fromScale: 1, toScale: 1.15 },
  },
  pan: {
    id: "pan",
    label: "Pan",
    category: "camera",
    kind: "wrapper",
    description: "Slow camera pan across a background image/video.",
    Component: Pan,
    defaultConfig: { durationInFrames: 150, direction: "left", distancePercent: 8 },
  },
  shake: {
    id: "shake",
    label: "Shake",
    category: "camera",
    kind: "wrapper",
    description: "Short, decaying jitter for emphasis or impact.",
    Component: Shake,
    defaultConfig: { durationInFrames: 15, intensityPx: 8 },
  },
  bounce: {
    id: "bounce",
    label: "Bounce",
    category: "camera",
    kind: "wrapper",
    description: "A settling, decaying bounce — good for icons and buttons.",
    Component: Bounce,
    defaultConfig: { durationInFrames: 30, heightPx: 32, bounces: 2.5 },
  },
  particleBurst: {
    id: "particleBurst",
    label: "Particle Burst",
    category: "particle",
    kind: "particle",
    description: "A radial burst of particles from a point — deterministic, render-safe.",
    Component: ParticleBurst,
    defaultConfig: { durationInFrames: 40, count: 24 },
  },
  confetti: {
    id: "confetti",
    label: "Confetti",
    category: "particle",
    kind: "particle",
    description: "Falling, tumbling confetti pieces — deterministic, render-safe.",
    Component: Confetti,
    defaultConfig: { durationInFrames: 100, count: 60 },
  },
  spotlightReveal: {
    id: "spotlightReveal",
    label: "Spotlight Reveal",
    category: "particle",
    kind: "wrapper",
    description: "A radial mask expands from a point to reveal the element beneath.",
    Component: SpotlightReveal,
    defaultConfig: { durationInFrames: 30, shape: "circle" },
  },
  cardStack: {
    id: "cardStack",
    label: "Card Stack Animation",
    category: "composite",
    kind: "composite",
    description: "A stacked pile of cards fans out and settles, staggered.",
    Component: CardStack,
    defaultConfig: { staggerFrames: 8, cardWidth: 260, cardHeight: 340 },
  },
  carousel: {
    id: "carousel",
    label: "Carousel Animation",
    category: "composite",
    kind: "composite",
    description: "Cycles through a list of items, one at a time, sliding horizontally.",
    Component: Carousel,
    defaultConfig: { durationPerItemInFrames: 60, transitionFrames: 14 },
  },
  logoReveal: {
    id: "logoReveal",
    label: "Logo Reveal",
    category: "composite",
    kind: "composite",
    description: "Scale + glow + diagonal shine sweep, tuned for brand logos.",
    Component: LogoReveal,
    defaultConfig: { durationInFrames: 36, widthPx: 280, glow: true },
  },
  ctaEnding: {
    id: "ctaEnding",
    label: "CTA Ending",
    category: "composite",
    kind: "composite",
    description: "An opinionated end-card: headline, subheadline, and a pulsing button.",
    Component: CTAEnding,
    defaultConfig: { durationInFrames: 24, accentColor: "#F89520" },
  },
  timelineProgress: {
    id: "timelineProgress",
    label: "Timeline Progress",
    category: "composite",
    kind: "composite",
    description: "A horizontal step tracker (e.g. \"Step 2 of 4\") for tutorial scenes.",
    Component: TimelineProgress,
    defaultConfig: { durationInFrames: 20, accentColor: "#F89520" },
  },
  animatedBackground: {
    id: "animatedBackground",
    label: "Animated Backgrounds",
    category: "composite",
    kind: "background",
    description: "A continuously looping background — gradient shift, grid, or waves.",
    Component: AnimatedBackground,
    defaultConfig: { variant: "gradientShift", colorA: "#0f0c29", colorB: "#302b63" },
  },
};

export const ANIMATION_IDS = Object.keys(ANIMATION_REGISTRY) as AnimationId[];

export const ANIMATION_CATEGORIES: { id: AnimationCategory; label: string }[] = [
  { id: "transition", label: "Transitions" },
  { id: "text", label: "Text Effects" },
  { id: "camera", label: "Camera" },
  { id: "particle", label: "Particles" },
  { id: "composite", label: "Composite Elements" },
];

export function animationsByCategory(category: AnimationCategory): AnimationRegistryEntry[] {
  return ANIMATION_IDS.map((id) => ANIMATION_REGISTRY[id]).filter((a) => a.category === category);
}
