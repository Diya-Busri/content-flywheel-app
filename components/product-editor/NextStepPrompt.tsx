"use client";

import { ArrowRight, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type NextStepPromptProps = {
  /** Emoji or short icon label */
  emoji?: string;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  /** Optional secondary link label */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Dismissible? Default true */
  dismissible?: boolean;
  className?: string;
};

/**
 * A subtle "next step" nudge card shown after a user completes an action.
 * Used between features to guide users through the product creation → promo video → marketing flow.
 */
export function NextStepPrompt({
  emoji = "💡",
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  dismissible = true,
  className = "",
}: NextStepPromptProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className={`relative rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 p-4 ${className}`}
    >
      {dismissible && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="flex gap-3 items-start pr-4">
        <span className="text-xl leading-none mt-0.5">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{title}</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">{description}</p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button
              size="sm"
              onClick={onAction}
              className="bg-amber-500 hover:bg-amber-600 text-white text-xs h-7 px-3 gap-1"
            >
              {actionLabel} <ArrowRight className="h-3 w-3" />
            </Button>
            {secondaryLabel && onSecondary && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onSecondary}
                className="text-xs h-7 px-2 text-amber-700 dark:text-amber-400 hover:text-amber-900 hover:bg-amber-100"
              >
                {secondaryLabel}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
