/**
 * Motion Graphics Studio — Impact Combo Animations
 *
 * "Combo" wrapper animations that bundle several primitives (overshoot
 * scale, a landing glow flash, and a brief shake) into a single opinionated,
 * high-impact entrance — so the admin doesn't have to manually stack three
 * separate animations on one element to get something that reads as an
 * "impact" rather than a plain fade or slide.
 *
 * Registered in ./index.tsx under AnimationId value: punchIn
 */

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { AnimationBaseProps, DEFAULT_START, clamp, seededRandom, springOvershoot } from "./primitives";

interface PunchInProps extends AnimationBaseProps {
  children: React.ReactNode;
  color?: string;
  seed?: number;
  shakeIntensityPx?: number;
}

/**
 * A single, opinionated "hit" entrance: sharp scale-overshoot pop-in, a
 * bright glow flash right as it lands, and a brief decaying shake — the
 * combo that reads as an impact. Good for CTAs, stat reveals, and
 * scene-opening headlines that need to grab attention immediately.
 */
export const PunchIn: React.FC<PunchInProps> = ({
  startFrame = DEFAULT_START,
  durationInFrames = 24,
  color = "#F89520",
  seed = 3,
  shakeIntensityPx = 6,
  className,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(frame - startFrame, 0);

  // Sharp overshoot pop — punchier spring than the default ScaleIn.
  const pop = springOvershoot(frame, startFrame, fps, durationInFrames, {
    damping: 9,
    mass: 0.5,
    stiffness: 180,
  });
  const scale = 0.6 + 0.4 * pop;
  const opacity = clamp(local / Math.max(durationInFrames * 0.4, 1), 0, 1);

  // Glow flash — bright right on landing, fades out over the back half.
  const landingFrame = durationInFrames * 0.55;
  const glowT = clamp(1 - Math.abs(local - landingFrame) / (durationInFrames * 0.6), 0, 1);
  const glowSpread = glowT * 34;

  // Brief decaying shake, timed to land right when the pop overshoots —
  // seeded so it's a pure function of frame (safe for Remotion's
  // independent/out-of-order frame rendering).
  const shakeWindow = durationInFrames * 0.5;
  const shakeActive = local >= landingFrame - shakeWindow / 2 && local < landingFrame + shakeWindow / 2;
  const shakeDecay = shakeActive ? 1 - Math.abs(local - landingFrame) / (shakeWindow / 2) : 0;
  const dx = shakeActive ? seededRandom(seed, frame, -1, 1) * shakeIntensityPx * shakeDecay : 0;
  const dy = shakeActive ? seededRandom(seed + 1, frame, -1, 1) * shakeIntensityPx * shakeDecay : 0;

  return (
    <div
      className={className}
      style={{
        opacity,
        transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
        filter: glowT > 0.02 ? `drop-shadow(0 0 ${glowSpread}px ${color})` : undefined,
        willChange: "transform, opacity, filter",
        ...style,
      }}
    >
      {children}
    </div>
  );
};
