"use client";

import type { ViralVisualThemeTokens } from "@/lib/viral-visual-themes";

/**
 * End-card / retention CTA for viral Quiz & Would You Rather previews.
 * Matches themed grid aesthetic of ViralTemplatePreview.
 */

export function ViralCTASlide({
  theme,
  variant = "end",
  aspectRatio = "9:16",
}: {
  theme: ViralVisualThemeTokens;
  variant?: "mid" | "end";
  aspectRatio?: "9:16" | "16:9";
}) {
  const isWide = aspectRatio === "16:9";
  return (
    <div
      className="cta"
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
            background: theme.ctaBadgeBg,
            color: theme.ctaBadgeColor,
            fontSize: isWide ? "clamp(10px,1.2vw,16px)" : "clamp(10px,1.6vw,14px)",
            fontWeight: 800,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            padding: "0.5em 1.2em",
            borderRadius: "999px",
            border: `1px solid ${theme.ctaBadgeBorder}`,
          }}
        >
          {variant === "mid" ? "Keep watching" : "Thanks for watching"}
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          top: "28%",
          left: "8%",
          right: "8%",
          bottom: "18%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          zIndex: 2,
          gap: isWide ? "4%" : "5%",
        }}
      >
        <h2
          style={{
            color: "#fff",
            fontSize: isWide ? "clamp(22px,3.2vw,44px)" : "clamp(20px,4.5vw,36px)",
            fontWeight: 900,
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Enjoyed this?
        </h2>
        <p
          style={{
            color: "rgba(255,255,255,0.88)",
            fontSize: isWide ? "clamp(14px,2vw,28px)" : "clamp(13px,2.4vw,22px)",
            fontWeight: 600,
            margin: 0,
            lineHeight: 1.45,
          }}
        >
          👍 Like | 🔁 Share | 🔔 Follow for more
        </p>
        {variant === "end" && (
          <p
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: isWide ? "clamp(11px,1.4vw,18px)" : "clamp(10px,1.6vw,15px)",
              fontWeight: 500,
              margin: "0.5em 0 0",
              lineHeight: 1.4,
            }}
          >
            Comment your score below
          </p>
        )}
      </div>
    </div>
  );
}

/** Alias for retention end-card (same as ViralCTASlide). */
export function CTA(props: Parameters<typeof ViralCTASlide>[0]) {
  return <ViralCTASlide {...props} />;
}
