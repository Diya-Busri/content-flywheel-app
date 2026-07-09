"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Star, Loader2, RefreshCw, Pencil, Check, Trash2, Copy, Wrench } from "lucide-react";
import { replaceProductTitleInText } from "@/lib/product-title";

const LENGTH_OPTIONS = [15, 30, 60, 90] as const;
export type LengthOption = (typeof LENGTH_OPTIONS)[number];

export const CHAR_LIMITS: Record<LengthOption, { hook: number; body: number; cta: number }> = {
  15: { hook: 50, body: 150, cta: 50 },
  30: { hook: 100, body: 300, cta: 100 },
  60: { hook: 150, body: 600, cta: 150 },
  90: { hook: 200, body: 900, cta: 200 },
};

export function getSectionRanges(totalSec: number): { hook: string; body: string; cta: string } {
  const hookEnd = Math.round(totalSec * 0.1) || 1;
  const bodyEnd = Math.round(totalSec * 0.85);
  return {
    hook: `0-${hookEnd} seconds`,
    body: `${hookEnd}-${bodyEnd} seconds`,
    cta: `${bodyEnd}-${totalSec} seconds`,
  };
}

export type SectionType = "hook" | "body" | "cta";

export type YouTubeMetricsData = {
  projectedViews?: string;
  retentionTarget?: string;
  monetizationFriendly?: boolean;
  adRevenuePer1k?: string;
  sponsorAppeal?: string;
  sponsorAppealNote?: string;
};

export interface ScriptData {
  id: string;
  title: string;
  isStarred: boolean;
  length: LengthOption;
  platforms: { tiktok: boolean; instagram: boolean; youtube: boolean };
  hook: string;
  body: string;
  cta: string;
  hookStrength: "Strong" | "Good" | "Weak";
  engagementPotential: "High" | "Medium" | "Low";
  conversionFocus: boolean;
  compliance: { tiktok: string; instagram: string; youtube: string };
  isSelected: boolean;
  isCustom?: boolean;
  isLengthUpdating?: boolean;
  /** YouTube-specific performance estimates (from script generation or defaults). */
  youtubeMetrics?: YouTubeMetricsData;
}

function SectionBlock({
  label,
  text,
  limit,
  onEdit,
  onRegenerate,
}: {
  label: string;
  text: string;
  limit: number;
  onEdit: () => void;
  onRegenerate?: () => void;
}) {
  return (
    <div>
      <Label className="text-xs text-gray-700 dark:text-gray-400">{label}</Label>
      <div className="mt-1 p-3 rounded-md bg-gray-100 dark:bg-[#0F0F0F] border border-gray-200 dark:border-[#2A2A2A] min-h-[80px]">
        <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{text}</p>
      </div>
      <p className="text-xs text-gray-700 dark:text-gray-400 mt-1">
        Character count: {text.length}/{limit}
      </p>
      <div className="flex flex-wrap gap-2 mt-1">
        {onRegenerate && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-gray-700 dark:text-[#A0A0A0] hover:text-gray-900 dark:hover:text-white"
            onClick={onRegenerate}
          >
            <RefreshCw className="w-3 h-3 mr-1" /> Regenerate
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-gray-700 dark:text-[#A0A0A0] hover:text-gray-900 dark:hover:text-white"
          onClick={onEdit}
        >
          <Pencil className="w-3 h-3 mr-1" /> Edit
        </Button>
      </div>
    </div>
  );
}

export interface ScriptCardProps {
  script: ScriptData;
  productName?: string;
  onUpdate: (u: Partial<ScriptData>) => void;
  onToggleSelect: () => void;
  onOpenEdit: (scriptId: string, section: SectionType) => void;
  charLimits: { hook: number; body: number; cta: number };
  globalLengthSec: number;
  isRegenerating?: boolean;
  /** Optional: show YouTube badge, watch time, and SEO score */
  youtubeOptimized?: boolean;
  estimatedWatchTime?: string;
  seoScore?: string;
  onRegenerateSection?: (section: SectionType) => void;
  subscriberCount?: number | null;
  niche?: string | null;
}

export function ScriptCard({
  script,
  productName,
  onUpdate,
  onToggleSelect,
  onOpenEdit,
  charLimits,
  globalLengthSec,
  isRegenerating,
  youtubeOptimized,
  estimatedWatchTime,
  seoScore,
  subscriberCount,
  niche,
  onRegenerateSection,
}: ScriptCardProps) {
  const ym = script.youtubeMetrics;
  const showYouTubeMetrics = youtubeOptimized && (ym || true);
  const subsLabel = subscriberCount != null ? `${subscriberCount.toLocaleString()} subs` : "channel size";
  const nicheLabel = (niche?.trim() || "general") || "general";
  const sectionRanges = getSectionRanges(globalLengthSec);
  return (
    <Card
      className={`relative border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#1A1A1A] overflow-hidden transition-all ${script.isSelected ? "ring-2 ring-orange-500" : ""}`}
    >
      {isRegenerating && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50/90 dark:bg-[#1A1A1A]/90 rounded-lg">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      )}
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base text-gray-900 dark:text-white">{script.title}</CardTitle>
            {script.isSelected && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/40">
                ⭐ Selected
              </span>
            )}
            {youtubeOptimized && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30">
                YouTube optimized
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {globalLengthSec}s · same for all scripts
            {estimatedWatchTime && ` · ${estimatedWatchTime}`}
            {seoScore != null && seoScore !== "" && ` · SEO: ${seoScore}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onUpdate({ isStarred: !script.isStarred })}
          className="p-1"
        >
          <Star
            className={`w-5 h-5 ${script.isStarred ? "fill-orange-500 text-orange-500" : "text-gray-600 dark:text-gray-400"}`}
          />
        </button>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <Label className="text-xs text-gray-700 dark:text-gray-400">PLATFORM</Label>
          <div className="flex gap-3 mt-1">
            <label className="flex items-center gap-1.5 cursor-pointer text-gray-900 dark:text-[#E0E0E0]">
              <Checkbox
                checked={script.platforms.tiktok}
                onCheckedChange={(c) =>
                  onUpdate({ platforms: { ...script.platforms, tiktok: !!c } })
                }
              />
              <span>TikTok</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-gray-900 dark:text-[#E0E0E0]">
              <Checkbox
                checked={script.platforms.instagram}
                onCheckedChange={(c) =>
                  onUpdate({ platforms: { ...script.platforms, instagram: !!c } })
                }
              />
              <span>Instagram</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-gray-900 dark:text-[#E0E0E0]">
              <Checkbox
                checked={script.platforms.youtube}
                onCheckedChange={(c) =>
                  onUpdate({ platforms: { ...script.platforms, youtube: !!c } })
                }
              />
              <span>YouTube</span>
            </label>
          </div>
        </div>
        <SectionBlock
          label={`HOOK (${sectionRanges.hook})`}
          text={replaceProductTitleInText(script.hook, productName ?? undefined)}
          limit={charLimits.hook}
          onEdit={() => onOpenEdit(script.id, "hook")}
          onRegenerate={onRegenerateSection ? () => onRegenerateSection("hook") : undefined}
        />
        <SectionBlock
          label={`BODY (${sectionRanges.body})`}
          text={replaceProductTitleInText(script.body, productName ?? undefined)}
          limit={charLimits.body}
          onEdit={() => onOpenEdit(script.id, "body")}
          onRegenerate={onRegenerateSection ? () => onRegenerateSection("body") : undefined}
        />
        <SectionBlock
          label={`CTA (${sectionRanges.cta})`}
          text={replaceProductTitleInText(script.cta, productName ?? undefined)}
          limit={charLimits.cta}
          onEdit={() => onOpenEdit(script.id, "cta")}
          onRegenerate={onRegenerateSection ? () => onRegenerateSection("cta") : undefined}
        />
        <div className="pt-2 border-t border-gray-200 dark:border-[#2A2A2A] space-y-1">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-400">
            Estimated Performance
          </p>
          <p className="text-xs text-gray-700 dark:text-[#E0E0E0]">
            Hook strength: ⭐⭐⭐⭐⭐ ({script.hookStrength})
          </p>
          <p className="text-xs text-gray-700 dark:text-[#E0E0E0]">
            Engagement: {script.engagementPotential} · Conversion:{" "}
            {script.conversionFocus ? "Sales-optimized" : "—"}
          </p>
        </div>
        {showYouTubeMetrics && (
          <div className="pt-2 border-t border-gray-200 dark:border-[#2A2A2A] space-y-1">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-400">
              ESTIMATED YOUTUBE PERFORMANCE
            </p>
            <p className="text-xs text-gray-700 dark:text-[#E0E0E0]">
              Projected views (first 7 days): {ym?.projectedViews ?? "5k–15k"}
            </p>
            <p className="text-xs text-gray-700 dark:text-[#E0E0E0]">
              Retention rate target: {ym?.retentionTarget ?? "45–60%"}
            </p>
            <p className="text-xs text-gray-700 dark:text-[#E0E0E0]">
              Monetization-friendly: {ym?.monetizationFriendly !== false ? "✅ Yes" : "—"}
            </p>
            <p className="text-xs text-gray-700 dark:text-[#E0E0E0]">
              Ad revenue potential: {ym?.adRevenuePer1k ?? "£8–25"} per 1k views
            </p>
            <p className="text-xs text-gray-700 dark:text-[#E0E0E0]">
              Sponsor appeal: {ym?.sponsorAppeal ?? "Medium"}
              {ym?.sponsorAppealNote ? ` (${ym.sponsorAppealNote})` : " (good for brand deals)"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1.5">
              These estimates based on: Channel size ({subsLabel}), Niche ({nicheLabel}), Script structure (hook strength, watch time optimization).
            </p>
          </div>
        )}
        <div className="pt-2 border-t border-gray-200 dark:border-[#2A2A2A] space-y-1">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-400">Compliance Check</p>
          <p className="text-xs text-gray-700 dark:text-[#E0E0E0]">TikTok: {script.compliance.tiktok}</p>
          <p className="text-xs text-gray-700 dark:text-[#E0E0E0]">
            Instagram: {script.compliance.instagram}
          </p>
          <p className="text-xs text-gray-700 dark:text-[#E0E0E0]">
            YouTube: {script.compliance.youtube}
          </p>
          {(script.compliance.tiktok.includes("Consider") ||
            script.compliance.instagram.includes("Consider") ||
            script.compliance.youtube.includes("Consider")) && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-7 text-xs gap-1 border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-[#A0A0A0]"
            >
              <Wrench className="w-3 h-3" /> Auto-fix
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            size="sm"
            className={
              script.isSelected
                ? "bg-orange-500 hover:bg-orange-600"
                : "border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-[#A0A0A0]"
            }
            onClick={onToggleSelect}
          >
            <Check className="w-3.5 h-3.5 mr-1" /> Select This Script
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-[#A0A0A0]"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Discard
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-[#A0A0A0]"
          >
            <Copy className="w-3.5 h-3.5 mr-1" /> Duplicate
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
