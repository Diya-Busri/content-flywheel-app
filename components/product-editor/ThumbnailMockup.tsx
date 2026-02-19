"use client";

import React from "react";

const THUMB_WIDTH = 1600;
const THUMB_HEIGHT = 1200;
/** DALL-E 3 thumbnail sizes. */
const DALLE_HORIZONTAL = { width: 1792, height: 1024 };
const DALLE_VERTICAL = { width: 1024, height: 1792 };

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
  /** Orientation for aspect ratio: horizontal (1792x1024) or vertical (1024x1792). */
  orientation?: "horizontal" | "vertical";
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
  orientation = "horizontal",
  className = "",
  style = {},
  preview = true,
  innerRef,
}: ThumbnailMockupProps) {
  const dalleSize = orientation === "vertical" ? DALLE_VERTICAL : DALLE_HORIZONTAL;
  const sellingPoints = [
    sectionCount > 0 ? `✓ ${sectionCount} ${sectionCount === 1 ? "Chapter" : "Chapters"}` : "✓ Full Guide",
    "✓ Actionable Steps",
    "✓ Printable PDF",
    format?.toLowerCase().includes("workbook") ? "✓ Worksheets" : "✓ Instant Download",
  ].slice(0, 3);

  const isDalleMode = !!baseImageUrl;
  const width = isDalleMode ? dalleSize.width : (orientation === "vertical" ? DALLE_VERTICAL.width : THUMB_WIDTH);
  const height = isDalleMode ? dalleSize.height : (orientation === "vertical" ? DALLE_VERTICAL.height : THUMB_HEIGHT);

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
        {/* AI-generated background only; no text in the image */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${baseImageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        {/* Product title overlay: bottom-left, real HTML/CSS text, semi-transparent dark bar for readability */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "24px 32px 28px 32px",
            background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              display: "inline-block",
              maxWidth: "85%",
              padding: "14px 20px 14px 20px",
              background: "rgba(0,0,0,0.55)",
              borderRadius: 8,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 42,
                fontWeight: 700,
                lineHeight: 1.2,
                color: "#ffffff",
                letterSpacing: "-0.02em",
              }}
            >
              {productTitle}
            </h2>
          </div>
        </div>
        {/* Optional badge top-right */}
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
      </div>
    );
    if (preview) {
      const scale = 320 / width;
      return (
        <div style={{ width: 320, height: 320 * (height / width), overflow: "hidden", position: "relative", borderRadius: 8 }}>
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
