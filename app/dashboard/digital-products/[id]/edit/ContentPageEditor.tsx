"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

export type ContentSection = {
  id: string;
  title: string;
  content: string;
  contentHtml?: string;
  order: number;
  imageUrl?: string;
};

export type ContentPageEditorProps = {
  /** Only show "Full page colour" / "Text colour" when on a content page (not cover/back) */
  isOnContentPage: boolean;
  currentPageBackgroundColor: string | null;
  currentPageTextColor: string | null;
  persistCurrentPageBackground: (updates: {
    backgroundColor?: string | null;
    pageTextColor?: string | null;
  }) => void;
  recordUndo: () => void;
  recordUndoDebounced: () => void;
  sections: ContentSection[];
  onOpenEdit: (section: ContentSection) => void;
  onSetSectionToDeleteId: (id: string) => void;
  onAddSection: () => void;
  onRegenerateSectionFromTOC: (sectionId: string) => void;
  regeneratingSectionId: string | null;
  isDark?: boolean;
};

export function ContentPageEditor({
  isOnContentPage,
  currentPageBackgroundColor,
  currentPageTextColor,
  persistCurrentPageBackground,
  recordUndo,
  recordUndoDebounced,
  sections,
  onOpenEdit,
  onSetSectionToDeleteId,
  onAddSection,
  onRegenerateSectionFromTOC,
  regeneratingSectionId,
  isDark,
}: ContentPageEditorProps) {
  return (
    <div className="space-y-3">
      {isOnContentPage && (
        <div className="pb-3 border-b border-gray-200 dark:border-[#2A2A2A] space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Full page colour
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Background colour for this content page.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={currentPageBackgroundColor ?? "#ffffff"}
                onChange={(e) => {
                  recordUndo();
                  persistCurrentPageBackground({ backgroundColor: e.target.value });
                  recordUndoDebounced();
                }}
                className="h-9 w-14 cursor-pointer rounded border border-gray-200 bg-white p-0.5"
                aria-label="Full page colour"
              />
              <input
                type="text"
                value={currentPageBackgroundColor ?? "#ffffff"}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  const hex = raw.startsWith("#") ? raw : raw ? `#${raw}` : "";
                  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
                  recordUndo();
                  persistCurrentPageBackground({ backgroundColor: hex });
                  recordUndoDebounced();
                }}
                className="flex-1 min-w-0 p-2 rounded-lg border border-gray-200 dark:border-[#2A2A2A] text-sm font-mono text-gray-900 dark:text-white bg-white dark:bg-[#1A1A1A]"
                placeholder="#ffffff"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 border-gray-200 text-gray-600 hover:bg-gray-50 dark:hover:bg-[#2A2A2A]"
                onClick={() => {
                  recordUndo();
                  persistCurrentPageBackground({ backgroundColor: null });
                  recordUndoDebounced();
                }}
              >
                Clear
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Text colour
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Colour for all text on this page (title, heading, body).
            </p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={currentPageTextColor ?? "#1a1a1a"}
                onChange={(e) => {
                  recordUndo();
                  persistCurrentPageBackground({ pageTextColor: e.target.value });
                  recordUndoDebounced();
                }}
                className="h-9 w-14 cursor-pointer rounded border border-gray-200 bg-white p-0.5"
                aria-label="Page text colour"
              />
              <input
                type="text"
                value={currentPageTextColor ?? "#1a1a1a"}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  const hex = raw.startsWith("#") ? raw : raw ? `#${raw}` : "";
                  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
                  recordUndo();
                  persistCurrentPageBackground({ pageTextColor: hex });
                  recordUndoDebounced();
                }}
                className="flex-1 min-w-0 p-2 rounded-lg border border-gray-200 dark:border-[#2A2A2A] text-sm font-mono text-gray-900 dark:text-white bg-white dark:bg-[#1A1A1A]"
                placeholder="#1a1a1a"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 border-gray-200 text-gray-600 hover:bg-gray-50 dark:hover:bg-[#2A2A2A]"
                onClick={() => {
                  recordUndo();
                  persistCurrentPageBackground({ pageTextColor: null });
                  recordUndoDebounced();
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        Table of Contents
      </h3>
      {sections.map((section, i) => (
        <div
          key={section.id}
          className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-3 hover:border-gray-300 dark:hover:border-[#3A3A3A]"
        >
          <span className="text-sm text-gray-700 dark:text-gray-300 truncate min-w-0 flex-1">
            {i + 1}. {section.title}
          </span>
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-500 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => onRegenerateSectionFromTOC(section.id)}
              disabled={regeneratingSectionId !== null}
              aria-label="Regenerate section content"
              title="Regenerate section content"
            >
              {regeneratingSectionId === section.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-500 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/20"
              onClick={() => onOpenEdit(section)}
              aria-label="Edit section"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => onSetSectionToDeleteId(section.id)}
              disabled={sections.length <= 1}
              aria-label="Delete section"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full mt-2 border-gray-200 dark:border-[#2A2A2A] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#2A2A2A] gap-1.5"
        onClick={onAddSection}
      >
        <Plus className="w-3.5 h-3.5" /> Add New Section
      </Button>
    </div>
  );
}
