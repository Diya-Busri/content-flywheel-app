"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { ChevronLeft, Check, Loader2, Sparkles, RefreshCw, Eye, Video, X, ImageIcon } from "lucide-react";

export type EditorToolbarProps = {
  productTitle: string;
  saving: boolean;
  lastSaved: Date | null;
  formatLastSaved: (date: Date) => string;
  isDark: boolean;
  onAutoDesignClick: () => void;
  onRegenerateDesign: () => void;
  onPreview: () => void;
  autoDesignLoading: boolean;
  regenerateDesignLoading: boolean;
  exportLabel: string;
  showCreatedBanner: boolean;
  onGenerateVideos: () => void;
  onDismissCreatedBanner: () => void;
  onGenerateImages: () => void;
  generateImagesLoading: boolean;
  generateImagesProgress?: { done: number; total: number } | null;
};

export function EditorToolbar({
  productTitle,
  saving,
  lastSaved,
  formatLastSaved,
  isDark,
  onAutoDesignClick,
  onRegenerateDesign,
  onPreview,
  autoDesignLoading,
  regenerateDesignLoading,
  exportLabel,
  showCreatedBanner,
  onGenerateVideos,
  onDismissCreatedBanner,
  onGenerateImages,
  generateImagesLoading,
  generateImagesProgress,
}: EditorToolbarProps) {
  return (
    <>
      <header
        className={`shrink-0 sticky top-0 z-40 border-b backdrop-blur-sm shadow-sm ${
          isDark ? "border-[#2A2A2A] bg-[#0F0F0F]/95" : "border-gray-200 bg-white/95"
        }`}
      >
        <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-6 px-4 md:px-6 h-14">
          <div className="flex items-center gap-6 min-w-0">
            <Link
              href="/dashboard/digital-products"
              className={`text-sm shrink-0 flex items-center gap-1 ${
                isDark ? "text-gray-400 hover:text-orange-500" : "text-gray-500 hover:text-orange-500"
              }`}
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </Link>
            <div
              className={`h-5 w-px hidden sm:block ${isDark ? "bg-[#2A2A2A]" : "bg-gray-200"}`}
            />
            <h1
              className={`text-base font-semibold truncate ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {productTitle}
            </h1>
            {saving ? (
              <span
                className={`flex items-center gap-1.5 text-xs shrink-0 ${
                  isDark ? "text-gray-400" : "text-gray-500"
                }`}
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
              </span>
            ) : lastSaved ? (
              <span
                className="flex items-center gap-1.5 text-xs text-emerald-600 shrink-0"
                title={lastSaved.toLocaleString()}
              >
                <Check className="w-3.5 h-3.5" /> Saved ✓ · {formatLastSaved(lastSaved)}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className={
                      isDark
                        ? "border-[#2A2A2A] text-gray-300 hover:bg-[#2A2A2A] hover:text-white"
                        : "border-gray-200 text-gray-700 hover:bg-gray-100"
                    }
                    onClick={onAutoDesignClick}
                    disabled={autoDesignLoading || regenerateDesignLoading}
                  >
                    {autoDesignLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline ml-1.5">Auto-Design</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Apply AI-suggested colours, fonts, and cover background
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className={
                      isDark
                        ? "border-[#2A2A2A] text-gray-300 hover:bg-[#2A2A2A] hover:text-white"
                        : "border-gray-200 text-gray-700 hover:bg-gray-100"
                    }
                    onClick={onRegenerateDesign}
                    disabled={regenerateDesignLoading}
                  >
                    {regenerateDesignLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline ml-1.5">Regenerate Design</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Apply a new AI-generated design (colours, fonts, cover image)
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className={
                      isDark
                        ? "border-[#2A2A2A] text-gray-300 hover:bg-[#2A2A2A] hover:text-white"
                        : "border-gray-200 text-gray-700 hover:bg-gray-100"
                    }
                    onClick={onGenerateImages}
                    disabled={generateImagesLoading || autoDesignLoading || regenerateDesignLoading}
                  >
                    {generateImagesLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {generateImagesProgress && (
                          <span className="ml-1.5 text-xs">{generateImagesProgress.done}/{generateImagesProgress.total}</span>
                        )}
                      </>
                    ) : (
                      <ImageIcon className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline ml-1.5">
                      {generateImagesLoading ? "Generating…" : "Generate Images"}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Auto-generate an AI image for each content page
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-gray-400 hover:text-white hover:bg-[#2A2A2A]"
                    onClick={onPreview}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Preview</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
              onClick={onPreview}
            >
              <Eye className="w-4 h-4" /> Export {exportLabel}
            </Button>
          </div>
        </div>
      </header>

      {showCreatedBanner && (
        <div
          className={`flex items-center justify-between gap-4 px-4 py-3 border-b ${
            isDark ? "bg-orange-500/10 border-orange-500/30" : "bg-orange-50 border-orange-200"
          }`}
        >
          <p
            className={`text-sm font-medium ${
              isDark ? "text-orange-200" : "text-orange-900"
            }`}
          >
            🎬 {productTitle} is ready! Now get a Video Creation Guide to promote it
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
              onClick={onGenerateVideos}
            >
              <Video className="w-3.5 h-3.5" /> Create Video Guide →
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={
                isDark
                  ? "text-orange-200 hover:bg-orange-500/20"
                  : "text-orange-800 hover:bg-orange-100"
              }
              onClick={onDismissCreatedBanner}
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
