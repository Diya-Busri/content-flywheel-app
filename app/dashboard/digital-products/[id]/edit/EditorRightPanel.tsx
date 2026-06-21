"use client";

import React from "react";
import { X } from "lucide-react";

export type EditorRightPanelProps = {
  children: React.ReactNode;
  isDark: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

/**
 * Right sidebar for the product editor.
 * Desktop (md+): fixed-width sidebar in the normal document flow.
 * Mobile/tablet (<md): bottom sheet that slides up from the bottom of the screen.
 * Children are rendered exactly once regardless of breakpoint.
 */
export function EditorRightPanel({ children, isDark, mobileOpen = false, onMobileClose }: EditorRightPanelProps) {
  const darkBorder = isDark ? "border-[#2A2A2A]" : "border-gray-200";
  const darkBg = isDark ? "bg-[#1A1A1A]" : "bg-white";

  return (
    <>
      {/* Backdrop — mobile/tablet only, dims the canvas behind the sheet */}
      <div
        className={[
          "md:hidden fixed inset-0 bg-black/50 z-[55] transition-opacity duration-300",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
        onClick={onMobileClose}
        aria-hidden
      />

      {/*
        Mobile/tablet: bottom sheet (slides up from bottom)
        Desktop: right sidebar in document flow
      */}
      <aside
        className={[
          // ── Mobile: bottom sheet (auto height, max 80dvh) ──
          "fixed bottom-0 left-0 right-0 z-[60]",
          "flex flex-col",
          "rounded-t-2xl",
          // Show/hide
          mobileOpen
            ? "translate-y-0 max-h-[80dvh]"
            : "translate-y-full max-h-[80dvh]",
          "transition-transform duration-300 ease-out",
          // ── Desktop: right sidebar in normal flow ──
          "md:relative md:inset-auto md:rounded-none",
          "md:translate-y-0 md:max-h-none md:h-full",
          "md:flex md:w-[340px] md:shrink-0 md:border-l",
          darkBg,
          darkBorder,
        ].join(" ")}
      >
        {/* Handle + close row — mobile only */}
        <div className={`md:hidden shrink-0 flex flex-col border-b ${darkBorder}`}>
          {/* Drag handle */}
          <div className="flex justify-center pt-2.5 pb-1">
            <div className={`w-10 h-1 rounded-full ${isDark ? "bg-[#3A3A3A]" : "bg-gray-300"}`} />
          </div>
          {/* Close button row */}
          <div className="flex items-center justify-between px-4 pb-2.5">
            <span className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
              Edit
            </span>
            <button
              type="button"
              onClick={onMobileClose}
              className={`p-1.5 rounded-lg transition-colors ${
                isDark ? "text-gray-400 hover:bg-[#2A2A2A] hover:text-white" : "text-gray-500 hover:bg-gray-100"
              }`}
              aria-label="Close edit panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Panel content */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col md:overflow-hidden">
          {children}
        </div>
      </aside>
    </>
  );
}
