"use client";

import { CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type ChecklistStep = {
  id: string;
  label: string;
  description: string;
  done: boolean;
  /** Tab value to switch to, or external href */
  tab?: string;
  href?: string;
  actionLabel?: string;
};

type ReadyToSellChecklistProps = {
  /** Product's marketingAssets fields */
  hasThumbnail: boolean;
  hasBookMockup: boolean;
  hasMarketingAssets: boolean;
  hasPromoVideo: boolean;
  /** Called when user wants to switch to a specific editor tab */
  onSwitchTab?: (tab: string) => void;
};

/**
 * A compact "Ready to Sell" checklist shown in the product editor sidebar.
 * Shows 5 steps from content → thumbnail → mockup → marketing → video.
 * Each step has a jump link to the relevant editor tab.
 */
export function ReadyToSellChecklist({
  hasThumbnail,
  hasBookMockup,
  hasMarketingAssets,
  hasPromoVideo,
  onSwitchTab,
}: ReadyToSellChecklistProps) {
  const steps: ChecklistStep[] = [
    {
      id: "content",
      label: "Content generated",
      description: "AI wrote your chapters and sections",
      done: true, // If they're in the editor, content exists
      tab: "content",
      actionLabel: "View content",
    },
    {
      id: "thumbnail",
      label: "Cover thumbnail",
      description: "Professional cover for your listing",
      done: hasThumbnail,
      tab: "marketing",
      actionLabel: hasThumbnail ? "Update" : "Generate",
    },
    {
      id: "mockup",
      label: "Book mockup",
      description: "Realistic product photo for ads & listings",
      done: hasBookMockup,
      tab: "marketing",
      actionLabel: hasBookMockup ? "View" : "Generate",
    },
    {
      id: "marketing",
      label: "Marketing copy",
      description: "Listing title, description & hashtags",
      done: hasMarketingAssets,
      tab: "marketing",
      actionLabel: hasMarketingAssets ? "Edit" : "Generate",
    },
    {
      id: "video",
      label: "Promo video",
      description: "Avatar video for TikTok & Reels",
      done: hasPromoVideo,
      tab: "videos",
      actionLabel: hasPromoVideo ? "View" : "Create",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const score = Math.round((doneCount / steps.length) * 100);
  const allDone = doneCount === steps.length;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {allDone ? "✅ Ready to Sell!" : "Ready to Sell"}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{doneCount} of {steps.length} steps complete</p>
        </div>
        {/* Progress ring */}
        <div className="relative flex items-center justify-center">
          <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90">
            <circle cx="22" cy="22" r="17" fill="none" stroke="#e5e7eb" strokeWidth="4" className="dark:stroke-slate-700" />
            <circle
              cx="22" cy="22" r="17"
              fill="none"
              stroke={allDone ? "#22c55e" : score >= 60 ? "#f59e0b" : "#f97316"}
              strokeWidth="4"
              strokeDasharray={`${(score / 100) * 2 * Math.PI * 17} ${2 * Math.PI * 17}`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute text-[10px] font-bold text-gray-700 dark:text-gray-300 rotate-90">{score}%</span>
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {steps.map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => step.tab && onSwitchTab?.(step.tab)}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left group"
          >
            {step.done ? (
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium ${step.done ? "text-gray-500 dark:text-gray-400 line-through" : "text-gray-900 dark:text-white"}`}>
                {step.label}
              </p>
              {!step.done && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5">{step.description}</p>
              )}
            </div>
            {!step.done && (
              <span className="text-[10px] font-semibold text-orange-500 group-hover:text-orange-600 flex items-center gap-0.5 shrink-0">
                {step.actionLabel} <ChevronRight className="w-3 h-3" />
              </span>
            )}
          </button>
        ))}
      </div>

      {allDone && (
        <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border-t border-green-100 dark:border-green-800/30">
          <p className="text-xs text-green-700 dark:text-green-400 font-medium text-center">
            🎉 Your product is ready to list on Gumroad, Etsy, or Stan Store!
          </p>
        </div>
      )}
    </div>
  );
}
