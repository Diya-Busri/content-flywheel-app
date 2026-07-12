"use client";

import { TrendingUp, Rocket, CalendarDays, Sparkles } from "lucide-react";

const SUGGESTIONS = [
  { label: "Get more sales", icon: TrendingUp, goal: "Content Flywheel needs more sales. Create content for this week." },
  { label: "Launch a product", icon: Rocket, goal: "I'm launching a new product. Create content to promote the launch." },
  { label: "Create this week's content", icon: CalendarDays, goal: "Create a full week of content for my business." },
  { label: "Improve my offer", icon: Sparkles, goal: "Help me improve my offer and create content around the improvements." },
];

export function SuggestedGoals({ onPick, disabled }: { onPick: (goal: string) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      {SUGGESTIONS.map(({ label, icon: Icon, goal }) => (
        <button
          key={label}
          type="button"
          disabled={disabled}
          onClick={() => onPick(goal)}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-gray-700 transition-colors hover:border-orange-300 hover:bg-orange-50 disabled:pointer-events-none disabled:opacity-50 dark:border-gray-800 dark:bg-[#141414] dark:text-gray-200 dark:hover:border-orange-800 dark:hover:bg-orange-950/30"
        >
          <Icon className="h-4 w-4 shrink-0 text-orange-500" />
          <span className="truncate">{label}</span>
        </button>
      ))}
    </div>
  );
}
