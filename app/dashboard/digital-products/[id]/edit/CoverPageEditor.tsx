"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { HexColorPicker } from "react-colorful";

export type OverlaySettings = {
  color: string;
  opacity: number;
};

export type CoverPageEditorProps = {
  overlaySettings: OverlaySettings;
  overlayColorToHex: (color: string) => string;
  updateOverlay: (key: "color" | "opacity", value: string | number) => void;
  hasBackgroundImage: boolean;
  onCopyBackgroundToBackCover: () => void;
  isDark?: boolean;
};

export function CoverPageEditor({
  overlaySettings,
  overlayColorToHex,
  updateOverlay,
  hasBackgroundImage,
  onCopyBackgroundToBackCover,
  isDark,
}: CoverPageEditorProps) {
  if (!hasBackgroundImage) return null;

  return (
    <>
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-[#2A2A2A]">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
          Cover background overlay
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          A semi-transparent layer between the background image and text so the cover stays readable.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 font-medium block mb-1.5">Overlay colour</label>
            <div className="[&_.react-colorful]:h-20 [&_.react-colorful]:w-full [&_.react-colorful]:rounded-lg">
              <HexColorPicker
                color={overlayColorToHex(overlaySettings.color)}
                onChange={(c) => updateOverlay("color", c)}
              />
            </div>
            <input
              type="text"
              value={overlayColorToHex(overlaySettings.color)}
              onChange={(e) => updateOverlay("color", e.target.value || "#ffffff")}
              className="w-full mt-2 p-2 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm text-gray-900 dark:text-white font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 font-medium block mb-1">
              Overlay opacity: {Math.round((overlaySettings.opacity ?? 0.9) * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={overlaySettings.opacity ?? 0.9}
              onChange={(e) => updateOverlay("opacity", parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-[#2A2A2A] rounded-lg accent-orange-500"
            />
          </div>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onCopyBackgroundToBackCover}
        className="w-full border-gray-200 dark:border-[#2A2A2A] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] mt-2"
      >
        Copy background to back cover
      </Button>
    </>
  );
}
