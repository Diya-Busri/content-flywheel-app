"use client";

import React from "react";

export type EditorRightPanelProps = {
  children: React.ReactNode;
  isDark: boolean;
};

/**
 * Right sidebar for the product editor: fixed width, scrollable.
 * ProductEditor passes all panel content (back-cover block, text/section editors, tabs) as children.
 */
export function EditorRightPanel({ children, isDark }: EditorRightPanelProps) {
  return (
    <aside
      className={`w-[380px] shrink-0 border-l flex flex-col overflow-y-auto ${
        isDark ? "border-[#2A2A2A] bg-[#1A1A1A]" : "border-gray-200 bg-white"
      }`}
    >
      {children}
    </aside>
  );
}
