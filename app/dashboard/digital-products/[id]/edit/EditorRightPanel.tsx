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
 * Desktop (md+): fixed-width sidebar in the normal flow.
 * Mobile (<md): slides in as a full-height overlay from the right.
 * Children are rendered exactly once regardless of breakpoint.
 */
export function EditorRightPanel({ children, isDark, mobileOpen = false, onMobileClose }: EditorRightPanelProps) {
  const darkBorder = isDark ? "border-[#2A2A2A]" : "border-gray-200";
  const darkBg = isDark ? "bg-[#1A1A1A]" : "bg-white";

  return (
    <>
      {/* Backdrop — mobile only, behind the panel */}
      <div
        className={[
          "md:hidden fixed inset-0 bg-black/50 z-40 transition-opacity duration-300",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
        onClick={onMobileClose}
        aria-hidden
      />

      <aside
        className={[
          // Mobile: fixed overlay sliding from right
          "fixed inset-y-0 right-0 z-50 flex flex-col overflow-hidden transition-transform duration-300 ease-out",
          "w-[min(380px,100vw)]",
          mobileOpen ? "translate-x-0" : "translate-x-full",
          // Desktop: back to normal flow, no transform
          "md:relative md:inset-auto md:translate-x-0 md:z-auto md:flex md:w-[380px] md:shrink-0 md:border-l",
          darkBg,
          darkBorder,
        ].join(" ")}
      >
        {/* Mobile-only close bar */}
        <div className={`md:hidden flex items-center justify-between px-4 py-3 border-b shrink-0 ${darkBorder}`}>
          <span className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Edit Panel</span>
          <button
            type="button"
            onClick={onMobileClose}
            className={`p-1.5 rounded-lg transition-colors ${isDark ? "text-gray-400 hover:bg-[#2A2A2A] hover:text-white" : "text-gray-500 hover:bg-gray-100"}`}
            aria-label="Close edit panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Panel content — scrollable, rendered exactly once */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {children}
        </div>
      </aside>
    </>
  );
}
