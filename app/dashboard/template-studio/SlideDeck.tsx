"use client";

import React from "react";
import {
  SlidePreview,
  SLIDE_PREVIEW_SIZE,
  type SlidePreviewSlide,
  type FontStyle,
} from "./SlidePreview";

export type SlideDeckProps = {
  slides: SlidePreviewSlide[];
  brandPrimary: string;
  brandSecondary: string;
  fontStyle: FontStyle;
  brandName?: string;
  slideRefs: React.RefObject<(HTMLDivElement | null)[]>;
};

export function SlideDeck({
  slides,
  brandPrimary,
  brandSecondary,
  fontStyle,
  brandName,
  slideRefs,
}: SlideDeckProps) {
  return (
    <div className="w-full overflow-x-auto overflow-y-hidden pb-2">
      <div
        className="flex gap-4"
        style={{
          minHeight: SLIDE_PREVIEW_SIZE + 8,
          paddingBottom: 4,
        }}
      >
        {slides.map((slide, index) => (
          <SlidePreview
            key={index}
            ref={(el) => {
              if (slideRefs.current) slideRefs.current[index] = el;
            }}
            slide={slide}
            brandPrimary={brandPrimary}
            brandSecondary={brandSecondary}
            fontStyle={fontStyle}
            brandName={brandName}
          />
        ))}
      </div>
    </div>
  );
}
