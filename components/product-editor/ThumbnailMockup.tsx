"use client";

import React from "react";

const THUMB_WIDTH = 1600;
const THUMB_HEIGHT = 1200;
/** DALL-E 3 thumbnail size (landscape). */
const DALLE_THUMB_WIDTH = 1792;
const DALLE_THUMB_HEIGHT = 1024;

export type ThumbnailTemplateId = "modern-gradient" | "clean-minimal" | "bold-dark" | "lifestyle";

export const THUMBNAIL_TEMPLATES: { id: ThumbnailTemplateId; label: string }[] = [
  { id: "modern-gradient", label: "Modern Gradient" },
  { id: "clean-minimal", label: "Clean Minimal" },
  { id: "bold-dark", label: "Bold & Dark" },
  { id: "lifestyle", label: "Lifestyle" },
];

type ThumbnailMockupProps = {
  productTitle: string;
  format: string;
  sectionCount: number;
  accentColor: string;
  template: ThumbnailTemplateId;
  /** When set, use this as the full background (DALL-E image) and render only title/badges overlay. */
  baseImageUrl?: string | null;
  className?: string;
  style?: React.CSSProperties;
  /** When true, render in a small preview container. When false, render at full size for capture. */
  preview?: boolean;
  innerRef?: React.RefObject<HTMLDivElement | null>;
};

export function ThumbnailMockup({
  productTitle,
  format,
  sectionCount,
  accentColor,
  template,
  baseImageUrl = null,
  className = "",
  style = {},
  preview = true,
  innerRef,
}: ThumbnailMockupProps) {
  const sellingPoints = [
    sectionCount > 0 ? `✓ ${sectionCount} ${sectionCount === 1 ? "Chapter" : "Chapters"}` : "✓ Full Guide",
    "✓ Actionable Steps",
    "✓ Printable PDF",
    format?.toLowerCase().includes("workbook") ? "✓ Worksheets" : "✓ Instant Download",
  ].slice(0, 3);

  const isDalleMode = !!baseImageUrl;
  const width = isDalleMode ? DALLE_THUMB_WIDTH : THUMB_WIDTH;
  const height = isDalleMode ? DALLE_THUMB_HEIGHT : THUMB_HEIGHT;

  const containerStyle: React.CSSProperties = {
    width,
    height,
    position: "relative",
    overflow: "hidden",
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    ...style,
  };

  /** When no DALL-E image yet, show placeholder instead of old CSS mockup. */
  if (!isDalleMode) {
    const placeholderInner = (
      <div
        ref={innerRef}
        style={{
          ...containerStyle,
          background: "linear-gradient(145deg, #e5e7eb 0%, #f3f4f6 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6b7280",
          fontSize: 16,
          fontWeight: 500,
          textAlign: "center",
          padding: 32,
        }}
        className={className}
      >
        Choose a style and click Generate Thumbnail to create an AI image
      </div>
    );
    if (preview) {
      const scale = 320 / width;
      return (
        <div style={{ width: 320, height: 320 * (height / width), overflow: "hidden", position: "relative", borderRadius: 8, border: "2px dashed #d1d5db" }}>
          <div style={{ position: "absolute", top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            {placeholderInner}
          </div>
        </div>
      );
    }
    return placeholderInner;
  }

  if (isDalleMode) {
    const dalleInner = (
      <div ref={innerRef} style={containerStyle} className={className}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${baseImageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        {/* Subtle gradient overlay so text is readable on any background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, rgba(0,0,0,0.5) 0%, transparent 50%, transparent 70%, rgba(0,0,0,0.35) 100%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 32,
            right: 32,
            padding: "10px 20px",
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.15em",
            borderRadius: 6,
          }}
        >
          DIGITAL DOWNLOAD
        </div>
        <div
          style={{
            position: "absolute",
            left: 80,
            right: 80,
            bottom: 80,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 56,
              fontWeight: 800,
              lineHeight: 1.15,
              color: "#fff",
              letterSpacing: "-0.02em",
              marginBottom: 24,
              textShadow: "0 2px 20px rgba(0,0,0,0.5)",
            }}
          >
            {productTitle}
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {sellingPoints.map((text) => (
              <span
                key={text}
                style={{
                  display: "inline-block",
                  padding: "10px 18px",
                  background: "rgba(255,255,255,0.2)",
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 600,
                  borderRadius: 8,
                  textShadow: "0 1px 4px rgba(0,0,0,0.3)",
                }}
              >
                {text}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
    if (preview) {
      const scale = 320 / DALLE_THUMB_WIDTH;
      return (
        <div style={{ width: 320, height: 320 * (DALLE_THUMB_HEIGHT / DALLE_THUMB_WIDTH), overflow: "hidden", position: "relative", borderRadius: 8 }}>
          <div style={{ position: "absolute", top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            {dalleInner}
          </div>
        </div>
      );
    }
    return dalleInner;
  }

  return null;
}
