/**
 * Motion Graphics Studio — Text & Kinetic Typography Animations
 *
 * Registered in ./index.ts under AnimationId values:
 *   typewriterText, wordByWordReveal, characterReveal, numberCounter,
 *   progressBar, loadingAnimation
 */

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { AnimationBaseProps, DEFAULT_START, MOTION_FONT, clamp, easedProgress } from "./primitives";

const baseTextStyle: React.CSSProperties = {
  fontFamily: MOTION_FONT,
  fontWeight: 800,
  color: "#ffffff",
  margin: 0,
};

// ─── Typewriter Text ────────────────────────────────────────────────────────
// Classic "cursor typing" reveal — text is a single string that grows char
// by char, with a blinking caret.

interface TypewriterTextProps extends AnimationBaseProps {
  text: string;
  charsPerSecond?: number;
  showCursor?: boolean;
}

export const TypewriterText: React.FC<TypewriterTextProps> = ({
  text,
  startFrame = DEFAULT_START,
  charsPerSecond = 18,
  showCursor = true,
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elapsedSeconds = Math.max(frame - startFrame, 0) / fps;
  const visibleChars = clamp(Math.floor(elapsedSeconds * charsPerSecond), 0, text.length);
  const done = visibleChars >= text.length;
  const caretOn = !done ? Math.floor(frame / (fps / 2)) % 2 === 0 : false;

  return (
    <p className={className} style={{ ...baseTextStyle, fontSize: 56, ...style }}>
      {text.slice(0, visibleChars)}
      {showCursor && <span style={{ opacity: caretOn ? 1 : 0 }}>|</span>}
    </p>
  );
};

// ─── Word by Word Reveal ────────────────────────────────────────────────────
// Each word pops in individually (fade + small rise), staggered.

interface WordByWordProps extends AnimationBaseProps {
  text: string;
  wordsPerSecond?: number;
}

export const WordByWordReveal: React.FC<WordByWordProps> = ({
  text,
  startFrame = DEFAULT_START,
  wordsPerSecond = 3,
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.trim().split(/\s+/);
  const framesPerWord = fps / wordsPerSecond;

  return (
    <p
      className={className}
      style={{ ...baseTextStyle, fontSize: 56, display: "flex", flexWrap: "wrap", gap: "0 0.35em", ...style }}
    >
      {words.map((word, i) => {
        const wordStart = startFrame + i * framesPerWord;
        const t = easedProgress(frame, wordStart, framesPerWord * 0.9);
        return (
          <span
            key={`${i}-${word}`}
            style={{
              opacity: t,
              transform: `translateY(${(1 - t) * 18}px)`,
              display: "inline-block",
            }}
          >
            {word}
          </span>
        );
      })}
    </p>
  );
};

// ─── Character Reveal ───────────────────────────────────────────────────────
// Every character animates in individually (fade + scale), fast stagger —
// distinct from TypewriterText: all characters are laid out immediately,
// each simply animates its own opacity/scale rather than the string growing.

interface CharacterRevealProps extends AnimationBaseProps {
  text: string;
  charsPerSecond?: number;
}

export const CharacterReveal: React.FC<CharacterRevealProps> = ({
  text,
  startFrame = DEFAULT_START,
  charsPerSecond = 24,
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const framesPerChar = fps / charsPerSecond;

  return (
    <p className={className} style={{ ...baseTextStyle, fontSize: 56, ...style }}>
      {text.split("").map((char, i) => {
        const charStart = startFrame + i * framesPerChar;
        const t = easedProgress(frame, charStart, framesPerChar * 4);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: t,
              transform: `translateY(${(1 - t) * 10}px) scale(${0.6 + 0.4 * t})`,
            }}
          >
            {char === " " ? " " : char}
          </span>
        );
      })}
    </p>
  );
};

// ─── Number Counter ─────────────────────────────────────────────────────────

interface NumberCounterProps extends AnimationBaseProps {
  from?: number;
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

export const NumberCounter: React.FC<NumberCounterProps> = ({
  from = 0,
  to,
  startFrame = DEFAULT_START,
  durationInFrames = 60,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const t = easedProgress(frame, startFrame, durationInFrames);
  const value = from + (to - from) * t;
  return (
    <p className={className} style={{ ...baseTextStyle, fontSize: 72, ...style }}>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </p>
  );
};

// ─── Progress Bars ──────────────────────────────────────────────────────────

interface ProgressBarProps extends AnimationBaseProps {
  fromPercent?: number;
  toPercent?: number;
  color?: string;
  trackColor?: string;
  heightPx?: number;
  widthPx?: number;
  showLabel?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  startFrame = DEFAULT_START,
  durationInFrames = 60,
  fromPercent = 0,
  toPercent = 100,
  color = "#F89520",
  trackColor = "rgba(255,255,255,0.15)",
  heightPx = 14,
  widthPx = 480,
  showLabel = true,
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const t = easedProgress(frame, startFrame, durationInFrames, (x) => x); // linear feels more "real" for progress
  const percent = fromPercent + (toPercent - fromPercent) * t;
  return (
    <div className={className} style={{ width: widthPx, ...style }}>
      <div
        style={{
          width: "100%",
          height: heightPx,
          borderRadius: heightPx,
          background: trackColor,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: "100%",
            borderRadius: heightPx,
            background: color,
          }}
        />
      </div>
      {showLabel && (
        <p style={{ ...baseTextStyle, fontSize: 18, marginTop: 8, fontWeight: 600 }}>
          {Math.round(percent)}%
        </p>
      )}
    </div>
  );
};

// ─── Loading Animation ──────────────────────────────────────────────────────

interface LoadingAnimationProps extends AnimationBaseProps {
  variant?: "spinner" | "dots" | "bar";
  color?: string;
  sizePx?: number;
}

export const LoadingAnimation: React.FC<LoadingAnimationProps> = ({
  startFrame = DEFAULT_START,
  variant = "spinner",
  color = "#F89520",
  sizePx = 56,
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = Math.max(frame - startFrame, 0) / fps; // seconds elapsed, loops forever

  if (variant === "spinner") {
    const deg = (t * 360 * 1.2) % 360;
    return (
      <div
        className={className}
        style={{
          width: sizePx,
          height: sizePx,
          borderRadius: "50%",
          border: `${Math.max(sizePx / 12, 3)}px solid rgba(255,255,255,0.18)`,
          borderTopColor: color,
          transform: `rotate(${deg}deg)`,
          ...style,
        }}
      />
    );
  }

  if (variant === "bar") {
    const sweep = (Math.sin(t * Math.PI * 1.4) + 1) / 2; // 0..1 ping-pong
    return (
      <div
        className={className}
        style={{ width: sizePx * 3, height: sizePx / 6, borderRadius: 99, background: "rgba(255,255,255,0.15)", overflow: "hidden", ...style }}
      >
        <div
          style={{
            width: "35%",
            height: "100%",
            borderRadius: 99,
            background: color,
            transform: `translateX(${sweep * 190}%)`,
          }}
        />
      </div>
    );
  }

  // dots
  return (
    <div className={className} style={{ display: "flex", gap: sizePx / 4, ...style }}>
      {[0, 1, 2].map((i) => {
        const phase = (t * 2 - i * 0.22) % 1;
        const bounce = Math.max(0, Math.sin(phase * Math.PI));
        return (
          <div
            key={i}
            style={{
              width: sizePx / 3,
              height: sizePx / 3,
              borderRadius: "50%",
              background: color,
              transform: `translateY(${-bounce * (sizePx / 3)}px)`,
            }}
          />
        );
      })}
    </div>
  );
};

