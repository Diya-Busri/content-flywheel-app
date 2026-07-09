"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRankingFormatsForProductCount } from "@/lib/ugc/ranking-formats";

type RankingFormatSelectorProps = {
  productCount: number;
  selectedFormatId: string | null;
  onSelect: (formatId: string | null) => void;
};

/**
 * Configuration-driven. Reads formats from ranking-formats.ts.
 * No hardcoded format names or behavior.
 */
export function RankingFormatSelector({
  productCount,
  selectedFormatId,
  onSelect,
}: RankingFormatSelectorProps) {
  const formats = getRankingFormatsForProductCount(productCount);

  if (formats.length === 0) return null;

  return (
    <Card className="flex-shrink-0">
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium">Ranking format</CardTitle>
        <CardDescription className="text-xs">
          Drives script structure and video composition
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <select
          value={selectedFormatId ?? ""}
          onChange={(e) => onSelect(e.target.value || null)}
          className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm"
        >
          <option value="">Default (from template)</option>
          {formats.map((f) => (
            <option key={f.format_id} value={f.format_id}>
              {f.name}
            </option>
          ))}
        </select>
      </CardContent>
    </Card>
  );
}
