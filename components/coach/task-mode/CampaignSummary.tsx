"use client";

import { Sparkles } from "lucide-react";
import { ASSET_TYPE_META, assetLabel } from "./asset-meta";
import type { ContentAssetType } from "@/db/schema/jarvis-schema";

/**
 * The one recurring visual anchor across all three Task Mode screens (plan,
 * review, results) — same eyebrow/headline/stat-chip layout, just fed
 * different data (planned counts, generated counts, saved counts). Keeping
 * this consistent is what makes the whole flow read as "one campaign"
 * instead of three unrelated screens.
 */
export function CampaignSummary({
  eyebrow,
  headline,
  subtext,
  counts,
  tone = "orange",
}: {
  eyebrow: string;
  headline: string;
  subtext?: string;
  counts: Partial<Record<ContentAssetType, number>>;
  tone?: "orange" | "green";
}) {
  const entries = (Object.entries(counts) as [ContentAssetType, number][]).filter(([, n]) => n > 0);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);

  const borderClass = tone === "green" ? "border-green-100 dark:border-green-900/40" : "border-orange-100 dark:border-orange-900/40";
  const gradientClass =
    tone === "green"
      ? "from-green-50 to-white dark:from-green-950/20 dark:to-[#141414]"
      : "from-orange-50 to-white dark:from-orange-950/20 dark:to-[#141414]";
  const eyebrowClass = tone === "green" ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400";
  const chipBorderClass = tone === "green" ? "border-green-200 dark:border-green-900/50" : "border-orange-200 dark:border-orange-900/50";
  const totalChipClass = tone === "green" ? "bg-green-600" : "bg-orange-500";
  const iconClass = tone === "green" ? "text-green-600 dark:text-green-400" : "text-orange-500";

  return (
    <div className={`rounded-xl border ${borderClass} bg-gradient-to-br ${gradientClass} p-5`}>
      <div className="flex items-center gap-1.5">
        <Sparkles className={`h-3.5 w-3.5 ${eyebrowClass}`} />
        <p className={`text-xs font-semibold uppercase tracking-wide ${eyebrowClass}`}>{eyebrow}</p>
      </div>
      <h2 className="mt-1.5 text-lg font-bold leading-snug text-gray-900 dark:text-white">{headline}</h2>
      {subtext && <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">{subtext}</p>}

      {entries.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {entries.map(([type, count]) => {
            const Icon = ASSET_TYPE_META[type].icon;
            return (
              <span
                key={type}
                className={`flex items-center gap-1.5 rounded-full border ${chipBorderClass} bg-white px-3 py-1.5 text-sm font-medium text-gray-700 dark:bg-[#0F0F0F] dark:text-gray-200`}
              >
                <Icon className={`h-3.5 w-3.5 ${iconClass}`} />
                {count}× {assetLabel(type, count)}
              </span>
            );
          })}
          {entries.length > 1 && (
            <span className={`flex items-center rounded-full ${totalChipClass} px-3 py-1.5 text-sm font-semibold text-white`}>
              {total} total
            </span>
          )}
        </div>
      )}
    </div>
  );
}
