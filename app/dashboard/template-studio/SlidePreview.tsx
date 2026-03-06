"use client";

import React from "react";

export type SlidePreviewSlide = {
  heading?: string;
  body?: string;
  bg_color?: string;
};

export type FontStyle = "modern" | "elegant" | "bold" | "minimal";

const FONT_STYLE_CLASSES: Record<
  FontStyle,
  { heading: string; body: string }
> = {
  modern: { heading: "font-sans font-bold", body: "font-sans font-normal" },
  elegant: { heading: "font-serif font-bold", body: "font-serif font-light" },
  bold: { heading: "font-sans font-black", body: "font-sans font-medium" },
  minimal: { heading: "font-sans font-semibold", body: "font-sans font-light" },
};

export const SLIDE_DESIGN_SIZE = 1080;
const PREVIEW_SCALE = 0.25;
export const SLIDE_PREVIEW_SIZE = Math.round(SLIDE_DESIGN_SIZE * PREVIEW_SCALE);

export type SlidePreviewProps = {
  slide: SlidePreviewSlide;
  brandPrimary: string;
  brandSecondary: string;
  fontStyle: FontStyle;
  brandName?: string;
};

export const SlidePreview = React.forwardRef<HTMLDivElement, SlidePreviewProps>(
  function SlidePreview(
    {
      slide,
      brandPrimary,
      brandSecondary,
      fontStyle,
      brandName = "Brand",
    },
    ref
  ) {
    const size = SLIDE_DESIGN_SIZE;
    const fonts = FONT_STYLE_CLASSES[fontStyle] ?? FONT_STYLE_CLASSES.modern;
    const bg = slide.bg_color ?? brandPrimary;

    const inner = (
      <div
        ref={ref}
        className="relative flex flex-col justify-between overflow-hidden rounded-lg shadow-lg"
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          backgroundColor: bg,
          padding: size * 0.08,
        }}
      >
        <div className="flex flex-col gap-3 flex-1 justify-center">
          {slide.heading && (
            <h2
              className={`${fonts.heading} text-white leading-tight`}
              style={{
                fontSize: size * 0.08,
                lineHeight: 1.2,
                textShadow: "0 1px 2px rgba(0,0,0,0.2)",
              }}
            >
              {slide.heading}
            </h2>
          )}
          {slide.body && (
            <p
              className={`${fonts.body} text-white/95`}
              style={{
                fontSize: size * 0.045,
                lineHeight: 1.4,
                maxWidth: "100%",
                textShadow: "0 1px 1px rgba(0,0,0,0.15)",
              }}
            >
              {slide.body}
            </p>
          )}
        </div>
        <div
          className="text-right"
          style={{
            color: brandSecondary,
            fontSize: size * 0.03,
            fontWeight: 500,
            opacity: 0.9,
          }}
        >
          {brandName}
        </div>
      </div>
    );

    return (
      <div
        className="shrink-0 overflow-hidden rounded-lg"
        style={{
          width: SLIDE_PREVIEW_SIZE,
          height: SLIDE_PREVIEW_SIZE,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transform: `scale(${PREVIEW_SCALE})`,
            transformOrigin: "top left",
          }}
        >
          {inner}
        </div>
      </div>
    );
  }
);
