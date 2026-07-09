"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Anchor } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type HookStyle =
  | ""
  | "pain_focused"
  | "desire_lifestyle"
  | "objection_handling"
  | "social_proof"
  | "authority_comparison"
  | "before_after"
  | "urgency_scarcity"
  | "vs_comparison"
  | "stack_duo"
  | "ranking_style"
  | "budget_vs_premium"
  | "stop_buying_x"
  | "top_3_tested"
  | "best_under_price";

export type HookTone = "" | "casual" | "professional" | "urgent" | "friendly";

const HOOK_STYLE_OPTIONS: { value: HookStyle; label: string }[] = [
  { value: "", label: "Any" },
  { value: "pain_focused", label: "Pain point" },
  { value: "desire_lifestyle", label: "Desire / lifestyle" },
  { value: "objection_handling", label: "Objection handling" },
  { value: "social_proof", label: "Social proof" },
  { value: "authority_comparison", label: "Authority" },
  { value: "before_after", label: "Before / after" },
  { value: "urgency_scarcity", label: "Urgency" },
  { value: "vs_comparison", label: "VS comparison (2+ products)" },
  { value: "stack_duo", label: "Stack duo (2+ products)" },
  { value: "ranking_style", label: "Ranking style (2+ products)" },
  { value: "budget_vs_premium", label: "Budget vs Premium (2+ products)" },
  { value: "stop_buying_x", label: "Stop buying X (2+ products)" },
  { value: "top_3_tested", label: "Top 3 tested (2+ products)" },
  { value: "best_under_price", label: "Best under £X (2+ products)" },
];

const TONE_OPTIONS: { value: HookTone; label: string }[] = [
  { value: "", label: "Default" },
  { value: "casual", label: "Casual" },
  { value: "professional", label: "Professional" },
  { value: "urgent", label: "Urgent" },
  { value: "friendly", label: "Friendly" },
];

type HookOptionsCardProps = {
  hookStyle: HookStyle;
  tone: HookTone;
  onHookStyleChange: (v: HookStyle) => void;
  onToneChange: (v: HookTone) => void;
};

export function HookOptionsCard({
  hookStyle,
  tone,
  onHookStyleChange,
  onToneChange,
}: HookOptionsCardProps) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Anchor className="w-4 h-4" />
          Hook options
        </CardTitle>
        <CardDescription className="text-xs">
          Hook style and tone
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <TooltipProvider>
          <div>
            <Tooltip>
              <TooltipTrigger asChild>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                  Hook style
                </label>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-[200px]">
                  Preferred marketing angle for script hooks. &quot;Any&quot; picks randomly.
                </p>
              </TooltipContent>
            </Tooltip>
            <select
              value={hookStyle}
              onChange={(e) => onHookStyleChange(e.target.value as HookStyle)}
              className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm"
            >
              {HOOK_STYLE_OPTIONS.map((o) => (
                <option key={o.value || "any"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Tooltip>
              <TooltipTrigger asChild>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                  Tone
                </label>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-[200px]">
                  Voice and vibe of the script. Used when generating variations.
                </p>
              </TooltipContent>
            </Tooltip>
            <select
              value={tone}
              onChange={(e) => onToneChange(e.target.value as HookTone)}
              className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm"
            >
              {TONE_OPTIONS.map((o) => (
                <option key={o.value || "default"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
