"use client";

import type { ReactNode } from "react";
import type { ViralTemplateType } from "@/components/templates/ViralTemplatePreview";
import type { ViralVisualThemeTokens } from "@/lib/viral-visual-themes";

function baseShell(theme: ViralVisualThemeTokens, children: ReactNode, glow?: "intro" | "outro") {
  const glowStyle = glow === "intro" ? theme.introGlow : glow === "outro" ? theme.outroGlow : "none";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: theme.quizBg,
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {glowStyle !== "none" && (
        <div style={{ position: "absolute", inset: 0, background: glowStyle, pointerEvents: "none" }} />
      )}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          background: theme.quizTopBar,
          height: "0.4%",
          minHeight: 3,
        }}
      />
      {children}
    </div>
  );
}

/** Opening title card: format + topic + round count. */
export function ViralIntroSlide({
  theme,
  topic,
  contentType,
  roundCount,
  aspectRatio = "9:16",
}: {
  theme: ViralVisualThemeTokens;
  topic: string;
  contentType: ViralTemplateType;
  roundCount: number;
  aspectRatio?: "9:16" | "16:9";
}) {
  const isWide = aspectRatio === "16:9";
  const label = contentType === "quiz" ? "Trivia Quiz" : "Would You Rather";
  const sub =
    contentType === "quiz"
      ? `${roundCount} question${roundCount === 1 ? "" : "s"} — how many can you get?`
      : `${roundCount} tough choice${roundCount === 1 ? "" : "s"} — pick your side`;

  const displayTopic = topic.trim() || "Your topic";

  return baseShell(
    theme,
    <>
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          zIndex: 2,
        }}
      >
        <span
          style={{
            background: theme.introBadgeBg,
            color: theme.introBadgeColor,
            fontSize: isWide ? "clamp(9px,1.1vw,14px)" : "clamp(9px,1.4vw,13px)",
            fontWeight: 800,
            letterSpacing: "0.35em",
            textTransform: "uppercase",
            padding: "0.55em 1.4em",
            borderRadius: "999px",
            border: `1px solid ${theme.introBadgeBorder}`,
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          top: "24%",
          left: "7%",
          right: "7%",
          bottom: "18%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          zIndex: 2,
          gap: isWide ? "3%" : "4%",
        }}
      >
        <h1
          style={{
            color: "#fff",
            fontSize: isWide ? "clamp(20px,3.5vw,52px)" : "clamp(18px,5.2vw,40px)",
            fontWeight: 900,
            margin: 0,
            lineHeight: 1.15,
            textShadow: "0 4px 40px rgba(0,0,0,0.45)",
          }}
        >
          {displayTopic}
        </h1>
        <p
          style={{
            color: "rgba(255,255,255,0.72)",
            fontSize: isWide ? "clamp(12px,1.8vw,26px)" : "clamp(11px,2.4vw,20px)",
            fontWeight: 600,
            margin: 0,
            lineHeight: 1.4,
            maxWidth: "92%",
          }}
        >
          {sub}
        </p>
        <p
          style={{
            color: "rgba(255,255,255,0.4)",
            fontSize: isWide ? "clamp(10px,1.3vw,18px)" : "clamp(9px,1.6vw,15px)",
            fontWeight: 600,
            margin: "0.5em 0 0",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          Let&apos;s go →
        </p>
      </div>
    </>,
    "intro"
  );
}

/** Closing card: thanks + CTA (stronger than mid-break). */
export function ViralOutroSlide({
  theme,
  topic,
  contentType,
  aspectRatio = "9:16",
}: {
  theme: ViralVisualThemeTokens;
  topic: string;
  contentType: ViralTemplateType;
  aspectRatio?: "9:16" | "16:9";
}) {
  const isWide = aspectRatio === "16:9";
  const displayTopic = topic.trim();

  return baseShell(
    theme,
    <>
      <div
        style={{
          position: "absolute",
          top: "8%",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          zIndex: 2,
        }}
      >
        <span
          style={{
            background: theme.outroBadgeBg,
            color: theme.outroBadgeColor,
            fontSize: isWide ? "clamp(9px,1.1vw,14px)" : "clamp(9px,1.4vw,13px)",
            fontWeight: 800,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            padding: "0.5em 1.2em",
            borderRadius: "999px",
            border: `1px solid ${theme.outroBadgeBorder}`,
          }}
        >
          Outro
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          top: "22%",
          left: "7%",
          right: "7%",
          bottom: "14%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          zIndex: 2,
          gap: isWide ? "3.5%" : "4.5%",
        }}
      >
        <h2
          style={{
            color: "#fff",
            fontSize: isWide ? "clamp(22px,3.2vw,48px)" : "clamp(20px,4.8vw,38px)",
            fontWeight: 900,
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Thanks for playing!
        </h2>
        {displayTopic ? (
          <p
            style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: isWide ? "clamp(11px,1.5vw,22px)" : "clamp(10px,1.9vw,17px)",
              fontWeight: 500,
              margin: 0,
              lineHeight: 1.35,
            }}
          >
            {displayTopic}
          </p>
        ) : null}
        <p
          style={{
            color: "rgba(255,255,255,0.88)",
            fontSize: isWide ? "clamp(13px,1.9vw,28px)" : "clamp(12px,2.3vw,21px)",
            fontWeight: 600,
            margin: "0.25em 0 0",
            lineHeight: 1.45,
          }}
        >
          👍 Like · 🔁 Share · 🔔 Follow for more
        </p>
        <p
          style={{
            color: "rgba(255,255,255,0.42)",
            fontSize: isWide ? "clamp(10px,1.3vw,18px)" : "clamp(9px,1.5vw,15px)",
            fontWeight: 500,
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {contentType === "quiz" ? "Drop your score in the comments" : "Tell us what you’d pick in the comments"}
        </p>
      </div>
    </>,
    "outro"
  );
}
