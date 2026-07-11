/**
 * Motion Graphics Studio — Transition Animations
 *
 * Entrance / exit / ambient wrapper components. Each wraps `children` and
 * applies a transform/opacity driven purely by useCurrentFrame(), so it can
 * be used on any scene element (text, image, video, icon) or on a whole
 * scene. Registered in ./index.ts under AnimationId values:
 *   fadeIn, fadeOut, slideLeft, slideRight, slideUp, slideDown,
 *   scaleIn, scaleOut, rotate, blurReveal, glowPulse, floating
 */

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  AnimationBaseProps,
  DEFAULT_DURATION,
  DEFAULT_START,
  EASE_OUT_EXPO,
  easedProgress,
  sineWave,
  springOvershoot,
} from "./primitives";

const wrapperStyle = (opacity: number, transform: string, extra?: React.CSSProperties): React.CSSProperties => ({
  opacity,
  transform,
  willChange: "transform, opacity",
  ...extra,
});

// ─── Fade In / Fade Out ─────────────────────────────────────────────────────

export const FadeIn: React.FC<AnimationBaseProps & { children: React.ReactNode }> = ({
  startFrame = DEFAULT_START,
  durationInFrames = DEFAULT_DURATION,
  className,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const opacity = easedProgress(frame, startFrame, durationInFrames);
  return (
    <div className={className} style={wrapperStyle(opacity, "none", style)}>
      {children}
    </div>
  );
};

export const FadeOut: React.FC<AnimationBaseProps & { children: React.ReactNode }> = ({
  startFrame = DEFAULT_START,
  durationInFrames = DEFAULT_DURATION,
  className,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const opacity = 1 - easedProgress(frame, startFrame, durationInFrames);
  return (
    <div className={className} style={wrapperStyle(opacity, "none", style)}>
      {children}
    </div>
  );
};

// ─── Slide (direction describes the movement direction of the entrance) ───

type SlideDirection = "left" | "right" | "up" | "down";

interface SlideProps extends AnimationBaseProps {
  children: React.ReactNode;
  /** Travel distance in pixels. */
  distance?: number;
  /** "in" (default) settles into place; "out" exits toward the same direction. */
  mode?: "in" | "out";
  /** Whether the entrance overshoots slightly past its resting position before settling (default true — ignored for mode="out", which always exits cleanly). */
  overshoot?: boolean;
}

function useSlideTransform(
  direction: SlideDirection,
  {
    startFrame = DEFAULT_START,
    durationInFrames = DEFAULT_DURATION,
    distance = 120,
    mode = "in",
    overshoot = true,
  }: SlideProps
) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Opacity always follows a clean eased curve — overshooting past 1 would
  // just read as a flicker, so it's kept separate from the position curve.
  const opacityT = easedProgress(frame, startFrame, durationInFrames);
  const positionT =
    mode === "in" && overshoot ? springOvershoot(frame, startFrame, fps, durationInFrames) : opacityT;
  const p = mode === "in" ? 1 - positionT : positionT; // overshoot on "in" briefly pushes p negative — settles past 0 and back

  const axis = direction === "left" || direction === "right" ? "X" : "Y";
  const sign =
    direction === "left" || direction === "up" ? 1 /* travels from + toward 0 */ : -1;

  const offset = sign * distance * p;
  const opacity = mode === "in" ? opacityT : 1 - opacityT;
  return { transform: `translate${axis}(${offset}px)`, opacity };
}

const makeSlide = (direction: SlideDirection, displayName: string) => {
  const Comp: React.FC<SlideProps> = (props) => {
    const { transform, opacity } = useSlideTransform(direction, props);
    return (
      <div className={props.className} style={wrapperStyle(opacity, transform, props.style)}>
        {props.children}
      </div>
    );
  };
  Comp.displayName = displayName;
  return Comp;
};

/** Enters from the right, settling leftward into place (or exits leftward when mode="out"). */
export const SlideLeft = makeSlide("left", "SlideLeft");
/** Enters from the left, settling rightward into place (or exits rightward when mode="out"). */
export const SlideRight = makeSlide("right", "SlideRight");
/** Enters from below, settling upward into place (or exits upward when mode="out"). */
export const SlideUp = makeSlide("up", "SlideUp");
/** Enters from above, settling downward into place (or exits downward when mode="out"). */
export const SlideDown = makeSlide("down", "SlideDown");

// ─── Scale In / Scale Out ───────────────────────────────────────────────────

interface ScaleProps extends AnimationBaseProps {
  children: React.ReactNode;
  fromScale?: number;
  toScale?: number;
  /** Whether the scale briefly overshoots toScale before settling — the "pop" that reads as snappy rather than merely smooth. Default true. */
  overshoot?: boolean;
}

export const ScaleIn: React.FC<ScaleProps> = ({
  startFrame = DEFAULT_START,
  durationInFrames = DEFAULT_DURATION,
  fromScale = 0.82,
  toScale = 1,
  overshoot = true,
  className,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = easedProgress(frame, startFrame, durationInFrames);
  const t = overshoot
    ? springOvershoot(frame, startFrame, fps, durationInFrames)
    : opacity;
  const scale = fromScale + (toScale - fromScale) * t;
  return (
    <div className={className} style={wrapperStyle(opacity, `scale(${scale})`, style)}>
      {children}
    </div>
  );
};

export const ScaleOut: React.FC<ScaleProps> = ({
  startFrame = DEFAULT_START,
  durationInFrames = DEFAULT_DURATION,
  fromScale = 1,
  toScale = 0.82,
  className,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const t = easedProgress(frame, startFrame, durationInFrames);
  const scale = fromScale + (toScale - fromScale) * t;
  return (
    <div className={className} style={wrapperStyle(1 - t, `scale(${scale})`, style)}>
      {children}
    </div>
  );
};

// ─── Rotate ─────────────────────────────────────────────────────────────────

interface RotateProps extends AnimationBaseProps {
  children: React.ReactNode;
  fromDeg?: number;
  toDeg?: number;
  /** When true, keeps spinning indefinitely after settling (e.g. loading badges). */
  continuous?: boolean;
  degPerSecond?: number;
  fps?: number;
  /** Whether the settle briefly overshoots toDeg before resting — off by default for continuous spins, on for one-off settles. */
  overshoot?: boolean;
}

export const Rotate: React.FC<RotateProps> = ({
  startFrame = DEFAULT_START,
  durationInFrames = DEFAULT_DURATION,
  fromDeg = -12,
  toDeg = 0,
  continuous = false,
  degPerSecond = 90,
  fps = 30,
  overshoot = true,
  className,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps: videoFps } = useVideoConfig();
  const opacity = easedProgress(frame, startFrame, durationInFrames);
  const t =
    overshoot && !continuous
      ? springOvershoot(frame, startFrame, videoFps, durationInFrames, { damping: 11, mass: 0.5, stiffness: 120 })
      : opacity;
  const settleDeg = fromDeg + (toDeg - fromDeg) * t;
  const continuousDeg = continuous
    ? ((Math.max(frame - startFrame, 0) / fps) * degPerSecond) % 360
    : 0;
  return (
    <div
      className={className}
      style={wrapperStyle(opacity, `rotate(${settleDeg + continuousDeg}deg)`, style)}
    >
      {children}
    </div>
  );
};

// ─── Blur Reveal ────────────────────────────────────────────────────────────

interface BlurRevealProps extends AnimationBaseProps {
  children: React.ReactNode;
  maxBlurPx?: number;
}

export const BlurReveal: React.FC<BlurRevealProps> = ({
  startFrame = DEFAULT_START,
  durationInFrames = DEFAULT_DURATION * 1.5,
  maxBlurPx = 22,
  className,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const t = easedProgress(frame, startFrame, durationInFrames, EASE_OUT_EXPO);
  const blur = maxBlurPx * (1 - t);
  return (
    <div
      className={className}
      style={{
        opacity: t,
        filter: `blur(${blur}px)`,
        willChange: "filter, opacity",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ─── Glow Pulse ─────────────────────────────────────────────────────────────

interface GlowPulseProps extends AnimationBaseProps {
  children: React.ReactNode;
  color?: string;
  periodInFrames?: number;
  minSpreadPx?: number;
  maxSpreadPx?: number;
}

export const GlowPulse: React.FC<GlowPulseProps> = ({
  startFrame = DEFAULT_START,
  color = "#F89520",
  periodInFrames = 60,
  minSpreadPx = 4,
  maxSpreadPx = 26,
  className,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const wave = (sineWave(Math.max(frame - startFrame, 0), periodInFrames) + 1) / 2; // 0..1
  const spread = minSpreadPx + (maxSpreadPx - minSpreadPx) * wave;
  return (
    <div
      className={className}
      style={{
        filter: `drop-shadow(0 0 ${spread}px ${color})`,
        willChange: "filter",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ─── Floating ───────────────────────────────────────────────────────────────

interface FloatingProps extends AnimationBaseProps {
  children: React.ReactNode;
  amplitudePx?: number;
  periodInFrames?: number;
}

export const Floating: React.FC<FloatingProps> = ({
  startFrame = DEFAULT_START,
  amplitudePx = 14,
  periodInFrames = 90,
  className,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const offset = sineWave(Math.max(frame - startFrame, 0), periodInFrames) * amplitudePx;
  return (
    <div
      className={className}
      style={wrapperStyle(1, `translateY(${offset}px)`, style)}
    >
      {children}
    </div>
  );
};
