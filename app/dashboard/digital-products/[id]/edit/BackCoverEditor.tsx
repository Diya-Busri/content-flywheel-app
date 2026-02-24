"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { HexColorPicker } from "react-colorful";

export type OverlaySettings = {
  color: string;
  opacity: number;
};

export type BackCoverSocialLinks = {
  tiktok?: string;
  instagram?: string;
  youtube?: string;
  facebook?: string;
};

export type BackCoverEditorProps = {
  /** Shown at top of right panel when on back page */
  backCoverSocialLinks: BackCoverSocialLinks;
  updateBackCoverSocialLink: (platform: keyof BackCoverSocialLinks, value: string) => void;
  backCoverWebsiteUrl: string;
  onWebsiteUrlChange: (value: string) => void;
  onWebsiteUrlBlur?: (value: string) => void;
  /** Overlay for back cover background */
  overlaySettings: OverlaySettings;
  overlayColorToHex: (color: string) => string;
  updateOverlay: (key: "color" | "opacity", value: string | number) => void;
  hasBackgroundImage: boolean;
  onCopyBackgroundToFrontCover: () => void;
  isDark?: boolean;
  /** When true, render the social/website block (top of panel) */
  showSocialBlock?: boolean;
  /** When true, render the overlay section and copy button (inside Design/Graphics tabs) */
  showOverlayAndCopy?: boolean;
};

export function BackCoverEditor({
  backCoverSocialLinks,
  updateBackCoverSocialLink,
  backCoverWebsiteUrl,
  onWebsiteUrlChange,
  onWebsiteUrlBlur,
  overlaySettings,
  overlayColorToHex,
  updateOverlay,
  hasBackgroundImage,
  onCopyBackgroundToFrontCover,
  isDark,
  showSocialBlock = true,
  showOverlayAndCopy = true,
}: BackCoverEditorProps) {
  const platforms = ["tiktok", "instagram", "youtube", "facebook"] as const;

  return (
    <>
      {showSocialBlock && (
        <div
          className={`p-4 border-b ${
            isDark ? "border-[#2A2A2A] bg-[#252525]" : "border-gray-200 bg-gray-50"
          }`}
        >
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Social Links
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Add URLs to show clickable social icons on the back cover. Icons are draggable and
            resizable on the canvas.
          </p>
          {platforms.map((platform) => (
            <div key={platform} className="mb-2">
              <label className="text-xs text-gray-600 dark:text-gray-400 font-medium block mb-1 capitalize">
                {platform}
              </label>
              <input
                type="url"
                value={backCoverSocialLinks[platform] ?? ""}
                onChange={(e) => updateBackCoverSocialLink(platform, e.target.value)}
                placeholder={`https://${platform}.com/...`}
                className={`w-full p-2 rounded-lg text-sm border ${
                  isDark
                    ? "bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder:text-gray-500"
                    : "bg-white border-gray-200 text-gray-900"
                }`}
              />
            </div>
          ))}
          <div className="mb-0">
            <label className="text-xs text-gray-600 dark:text-gray-400 font-medium block mb-1">
              Website URL
            </label>
            <input
              type="url"
              value={backCoverWebsiteUrl}
              onChange={(e) => onWebsiteUrlChange(e.target.value)}
              onBlur={(e) => onWebsiteUrlBlur?.(e.target.value)}
              placeholder="https://yoursite.com"
              className={`w-full p-2 rounded-lg text-sm border ${
                isDark
                  ? "bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder:text-gray-500"
                  : "bg-white border-gray-200 text-gray-900"
              }`}
            />
          </div>
        </div>
      )}

      {showOverlayAndCopy && hasBackgroundImage && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-[#2A2A2A]">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Back cover background overlay
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            A semi-transparent layer between the background image and text.
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 font-medium block mb-1.5">
                Overlay colour
              </label>
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
      )}

      {showOverlayAndCopy && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCopyBackgroundToFrontCover}
          className="w-full border-gray-200 dark:border-[#2A2A2A] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] mt-2"
        >
          Copy background to front cover
        </Button>
      )}
    </>
  );
}
