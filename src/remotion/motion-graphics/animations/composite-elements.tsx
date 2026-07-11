/**
 * Motion Graphics Studio — Composite Elements
 *
 * Higher-level, opinionated building blocks composed from the primitive
 * transitions above — the kind of "whole moment" a template author drops
 * into a scene rather than assembling from scratch each time.
 *
 * Registered in ./index.ts under AnimationId values:
 *   cardStack, carousel, logoReveal, ctaEnding, timelineProgress,
 *   animatedBackground
 */

import React from "react";
import { Img, useCurrentFrame, useVideoConfig } from "remotion";
import {
  AnimationBaseProps,
  DEFAULT_START,
  MOTION_FONT,
  clamp,
  easedProgress,
  sineWave,
} from "./primitives";

// ─── Card Stack Animation ───────────────────────────────────────────────────
// Cards fan out from a stacked pile and settle, staggered.

interface CardStackProps extends AnimationBaseProps {
  items: React.ReactNode[];
  staggerFrames?: number;
  cardWidth?: number;
  cardHeight?: number;
  fanDeg?: number;
}

export const CardStack: React.FC<CardStackProps> = ({
  items,
  startFrame = DEFAULT_START,
  durationInFrames = 24,
  staggerFrames = 8,
  cardWidth = 260,
  cardHeight = 340,
  fanDeg = 10,
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const mid = (items.length - 1) / 2;

  return (
    <div
      className={className}
      style={{ position: "relative", width: cardWidth, height: cardHeight, ...style }}
    >
      {items.map((item, i) => {
        const cardStart = startFrame + i * staggerFrames;
        const t = easedProgress(frame, cardStart, durationInFrames);
        const targetRot = (i - mid) * fanDeg;
        const targetX = (i - mid) * (cardWidth * 0.28);
        const rot = targetRot * t;
        const x = targetX * t;
        const y = (1 - t) * 40;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.4 + 0.6 * t,
              transform: `translate(${x}px, ${y}px) rotate(${rot}deg)`,
              transformOrigin: "50% 100%",
              zIndex: i,
              borderRadius: 16,
              boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
              overflow: "hidden",
              background: "#111",
            }}
          >
            {item}
          </div>
        );
      })}
    </div>
  );
};

// ─── Carousel Animation ─────────────────────────────────────────────────────
// Cycles through items, one visible at a time, sliding horizontally.

interface CarouselProps extends AnimationBaseProps {
  items: React.ReactNode[];
  durationPerItemInFrames?: number;
  transitionFrames?: number;
}

export const Carousel: React.FC<CarouselProps> = ({
  items,
  startFrame = DEFAULT_START,
  durationPerItemInFrames = 60,
  transitionFrames = 14,
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const local = Math.max(frame - startFrame, 0);
  const index = Math.floor(local / durationPerItemInFrames) % items.length;
  const withinItem = local % durationPerItemInFrames;
  const isTransitioningOut = withinItem > durationPerItemInFrames - transitionFrames;

  const enterT = clamp(withinItem / transitionFrames, 0, 1);
  const exitT = isTransitioningOut
    ? clamp((withinItem - (durationPerItemInFrames - transitionFrames)) / transitionFrames, 0, 1)
    : 0;

  const translateX = (1 - enterT) * 60 - exitT * 60;
  const opacity = clamp(enterT, 0, 1) * (1 - exitT);

  return (
    <div className={className} style={{ position: "relative", overflow: "hidden", ...style }}>
      <div style={{ transform: `translateX(${translateX}%)`, opacity }}>{items[index]}</div>
    </div>
  );
};

// ─── Logo Reveal ────────────────────────────────────────────────────────────

interface LogoRevealProps extends AnimationBaseProps {
  logoUrl: string;
  widthPx?: number;
  glow?: boolean;
}

export const LogoReveal: React.FC<LogoRevealProps> = ({
  logoUrl,
  startFrame = DEFAULT_START,
  durationInFrames = 36,
  widthPx = 280,
  glow = true,
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const t = easedProgress(frame, startFrame, durationInFrames);
  const scale = 0.7 + 0.3 * t;
  const shineX = clamp((frame - startFrame - durationInFrames * 0.6) / (durationInFrames * 0.6), 0, 1);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: widthPx,
        opacity: t,
        transform: `scale(${scale})`,
        filter: glow ? `drop-shadow(0 0 ${20 * t}px rgba(248,149,32,0.55))` : undefined,
        overflow: "hidden",
        ...style,
      }}
    >
      <Img src={logoUrl} style={{ width: "100%", display: "block" }} />
      {/* diagonal shine sweep */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${-40 + shineX * 180}%`,
          width: "30%",
          background: "linear-gradient(75deg, transparent, rgba(255,255,255,0.55), transparent)",
          transform: "skewX(-20deg)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

// ─── CTA Ending ─────────────────────────────────────────────────────────────

interface CTAEndingProps extends AnimationBaseProps {
  headline: string;
  subheadline?: string;
  buttonText?: string;
  accentColor?: string;
}

export const CTAEnding: React.FC<CTAEndingProps> = ({
  headline,
  subheadline,
  buttonText,
  accentColor = "#F89520",
  startFrame = DEFAULT_START,
  durationInFrames = 24,
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const t = easedProgress(frame, startFrame, durationInFrames);
  const pulse = (sineWave(Math.max(frame - startFrame - durationInFrames, 0), 40) + 1) / 2;

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
        opacity: t,
        transform: `translateY(${(1 - t) * 30}px)`,
        ...style,
      }}
    >
      <p style={{ fontFamily: MOTION_FONT, fontWeight: 900, fontSize: 64, color: "#fff", textAlign: "center", margin: 0 }}>
        {headline}
      </p>
      {subheadline && (
        <p style={{ fontFamily: MOTION_FONT, fontWeight: 500, fontSize: 28, color: "rgba(255,255,255,0.75)", textAlign: "center", margin: 0 }}>
          {subheadline}
        </p>
      )}
      {buttonText && (
        <div
          style={{
            marginTop: 12,
            padding: "18px 44px",
            borderRadius: 100,
            background: accentColor,
            color: "#111",
            fontFamily: MOTION_FONT,
            fontWeight: 800,
            fontSize: 26,
            boxShadow: `0 0 ${20 + pulse * 24}px ${accentColor}aa`,
          }}
        >
          {buttonText}
        </div>
      )}
    </div>
  );
};

// ─── Timeline Progress ──────────────────────────────────────────────────────
// Horizontal stepper — e.g. for tutorial scenes ("Step 2 of 4").

interface TimelineProgressProps extends AnimationBaseProps {
  steps: string[];
  currentStepIndex: number;
  accentColor?: string;
}

export const TimelineProgress: React.FC<TimelineProgressProps> = ({
  steps,
  currentStepIndex,
  accentColor = "#F89520",
  startFrame = DEFAULT_START,
  durationInFrames = 20,
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const t = easedProgress(frame, startFrame, durationInFrames);

  return (
    <div className={className} style={{ display: "flex", alignItems: "center", opacity: t, ...style }}>
      {steps.map((step, i) => {
        const done = i < currentStepIndex;
        const active = i === currentStepIndex;
        const color = done || active ? accentColor : "rgba(255,255,255,0.25)";
        return (
          <React.Fragment key={i}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: active ? 18 : 12,
                  height: active ? 18 : 12,
                  borderRadius: "50%",
                  background: color,
                  boxShadow: active ? `0 0 16px ${accentColor}` : undefined,
                }}
              />
              <p style={{ fontFamily: MOTION_FONT, fontSize: 14, color: "rgba(255,255,255,0.7)", margin: 0, whiteSpace: "nowrap" }}>
                {step}
              </p>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? accentColor : "rgba(255,255,255,0.2)", margin: "0 8px 22px" }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── Animated Backgrounds ───────────────────────────────────────────────────
// Full-bleed, continuously looping backgrounds for SceneBackground type "animated".

interface AnimatedBackgroundProps extends AnimationBaseProps {
  variant?: "gradientShift" | "grid" | "waves";
  colorA?: string;
  colorB?: string;
}

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  variant = "gradientShift",
  colorA = "#0f0c29",
  colorB = "#302b63",
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  if (variant === "grid") {
    const shift = (frame * 0.6) % 64;
    return (
      <div
        className={className}
        style={{
          position: "absolute",
          inset: 0,
          background: `${colorA}`,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          backgroundPosition: `${shift}px ${shift}px`,
          ...style,
        }}
      />
    );
  }

  if (variant === "waves") {
    const phase = frame * 0.04;
    const bands = 5;
    return (
      <div className={className} style={{ position: "absolute", inset: 0, background: colorA, overflow: "hidden", ...style }}>
        {Array.from({ length: bands }).map((_, i) => {
          const y = height * (0.2 + i * 0.18) + Math.sin(phase + i) * 24;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: y,
                height: 2,
                background: `${colorB}55`,
                transform: `translateY(${Math.sin(phase * 1.3 + i * 1.7) * 20}px)`,
              }}
            />
          );
        })}
      </div>
    );
  }

  // gradientShift (default) — slowly rotating angle + drifting stops
  const angle = (frame * 0.3) % 360;
  const drift = (sineWave(frame, 240) + 1) / 2; // 0..1
  return (
    <div
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width,
        height,
        background: `linear-gradient(${angle}deg, ${colorA} ${10 + drift * 20}%, ${colorB} ${70 - drift * 20}%)`,
        ...style,
      }}
    />
  );
};
