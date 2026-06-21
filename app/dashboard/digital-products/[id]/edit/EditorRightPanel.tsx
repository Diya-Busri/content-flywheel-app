"use client";

import React, { useCallback, useRef } from "react";
import {
  X,
  ChevronRight,
  BookOpen,
  Palette,
  ImageIcon,
  LayoutGrid,
  FileOutput,
  Megaphone,
  Sparkles,
} from "lucide-react";

export type EditorRightPanelProps = {
  children: React.ReactNode;
  isDark: boolean;
  /** Mobile bottom-sheet open state */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  /** Desktop: active tab */
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  /** Desktop: collapsed / expanded */
  desktopOpen?: boolean;
  onDesktopToggle?: () => void;
  /** Desktop: resizable width (px) */
  sidebarWidth?: number;
  onSidebarResize?: (w: number) => void;
};

const TABS = [
  { tab: "content",   Icon: BookOpen,   label: "Content"  },
  { tab: "design",    Icon: Palette,    label: "Design"   },
  { tab: "graphics",  Icon: ImageIcon,  label: "Graphics" },
  { tab: "layout",    Icon: LayoutGrid, label: "Layout"   },
  { tab: "export",    Icon: FileOutput, label: "Export"   },
  { tab: "marketing", Icon: Megaphone,  label: "Mktg"     },
  { tab: "ai",        Icon: Sparkles,   label: "AI"       },
] as const;

const MIN_WIDTH = 260;
const MAX_WIDTH = 600;

export function EditorRightPanel({
  children,
  isDark,
  mobileOpen = false,
  onMobileClose,
  activeTab = "content",
  onTabChange,
  desktopOpen = true,
  onDesktopToggle,
  sidebarWidth = 340,
  onSidebarResize,
}: EditorRightPanelProps) {
  const darkBorder = isDark ? "border-[#2A2A2A]" : "border-gray-200";
  const darkBg    = isDark ? "bg-[#1A1A1A]"    : "bg-white";
  const railBg    = isDark ? "bg-[#141414]"    : "bg-gray-50";

  // ── Drag-to-resize ──────────────────────────────────────────────────────────
  const dragging   = useRef(false);
  const startX     = useRef(0);
  const startWidth = useRef(sidebarWidth);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current   = true;
    startX.current     = e.clientX;
    startWidth.current = sidebarWidth;

    const onMove = (mv: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startX.current - mv.clientX; // drag left = wider
      const next  = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      onSidebarResize?.(next);
    };

    const onUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  }, [sidebarWidth, onSidebarResize]);

  return (
    <>
      {/* Backdrop — mobile only */}
      <div
        className={[
          "md:hidden fixed inset-0 bg-black/50 z-[55] transition-opacity duration-300",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
        onClick={onMobileClose}
        aria-hidden
      />

      {/* ── Mobile: bottom sheet ───────────────────────────────────────────── */}
      <aside
        className={[
          "fixed bottom-0 left-0 right-0 z-[60]",
          "flex flex-col",
          "rounded-t-2xl",
          mobileOpen
            ? "translate-y-0 max-h-[80dvh]"
            : "translate-y-full max-h-[80dvh]",
          "transition-transform duration-300 ease-out",
          "md:hidden",
          darkBg,
          darkBorder,
        ].join(" ")}
      >
        <div className={`shrink-0 flex flex-col border-b ${darkBorder}`}>
          <div className="flex justify-center pt-2.5 pb-1">
            <div className={`w-10 h-1 rounded-full ${isDark ? "bg-[#3A3A3A]" : "bg-gray-300"}`} />
          </div>
          <div className="flex items-center justify-between px-4 pb-2.5">
            <span className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Edit</span>
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
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {children}
        </div>
      </aside>

      {/* ── Desktop: collapsible + resizable sidebar ──────────────────────── */}
      <div
        className="hidden md:flex h-full shrink-0"
        style={{ width: desktopOpen ? sidebarWidth + 49 : 49 }}
      >
        {/* Panel content */}
        <div
          className={[
            "flex flex-col h-full border-l overflow-hidden transition-all duration-200",
            darkBg, darkBorder,
          ].join(" ")}
          style={{ width: desktopOpen ? sidebarWidth : 0, opacity: desktopOpen ? 1 : 0 }}
        >
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {children}
          </div>
        </div>

        {/* Drag handle — sits between panel and rail */}
        {desktopOpen && (
          <div
            onMouseDown={onMouseDown}
            className={`w-1 shrink-0 h-full cursor-col-resize transition-colors select-none ${
              isDark
                ? "bg-[#2A2A2A] hover:bg-orange-500/50"
                : "bg-gray-200 hover:bg-orange-400/50"
            }`}
          />
        )}

        {/* Icon rail — always visible */}
        <div
          className={[
            "w-12 shrink-0 h-full flex flex-col items-center border-l",
            railBg, darkBorder,
          ].join(" ")}
        >
          {/* Collapse toggle */}
          <button
            type="button"
            onClick={onDesktopToggle}
            title={desktopOpen ? "Collapse panel" : "Expand panel"}
            className={`mt-2 mb-1 p-1.5 rounded-lg transition-colors ${
              isDark
                ? "text-gray-500 hover:bg-white/10 hover:text-white"
                : "text-gray-400 hover:bg-gray-200 hover:text-gray-700"
            }`}
          >
            <ChevronRight
              className={`w-4 h-4 transition-transform duration-200 ${desktopOpen ? "rotate-180" : "rotate-0"}`}
            />
          </button>

          <div className={`w-8 h-px mb-1 ${isDark ? "bg-[#2A2A2A]" : "bg-gray-200"}`} />

          {/* Tab icons */}
          <div className="flex flex-col items-center gap-0.5 w-full px-1.5 overflow-y-auto py-1">
            {TABS.map(({ tab, Icon, label }) => {
              const active = activeTab === tab && desktopOpen;
              return (
                <button
                  key={tab}
                  type="button"
                  title={label}
                  onClick={() => {
                    if (active) {
                      onDesktopToggle?.();
                    } else {
                      onTabChange?.(tab);
                      if (!desktopOpen) onDesktopToggle?.();
                    }
                  }}
                  className={`flex flex-col items-center gap-0.5 py-2 w-full rounded-lg transition-colors ${
                    active
                      ? "bg-orange-500 text-white"
                      : isDark
                      ? "text-gray-500 hover:bg-white/10 hover:text-gray-200"
                      : "text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[8px] font-medium leading-none">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
