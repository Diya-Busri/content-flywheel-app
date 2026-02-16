"use client";

import { UGC_TEMPLATES } from "@/lib/ugc/templates";
import {
  RANKING_TEMPLATES,
  getRankingTemplatesForProductCount,
} from "@/lib/ugc/ranking-templates";

type TemplateSelectorProps = {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** When 2+, show Ranking / Top List templates */
  productCount?: number;
};

export function TemplateSelector({ selectedId, onSelect, productCount = 1 }: TemplateSelectorProps) {
  const rankingTemplates =
    productCount >= 2 ? getRankingTemplatesForProductCount(productCount) : [];

  const isRankingSelected = rankingTemplates.some((t) => t.id === selectedId);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
          Standard
        </p>
        <div className="grid grid-cols-2 gap-2">
          {UGC_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(selectedId === t.id ? null : t.id)}
              className={`rounded-lg border-2 p-3 text-left transition-colors ${
                selectedId === t.id && !isRankingSelected
                  ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30 ring-2 ring-orange-200 dark:ring-orange-800"
                  : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-10 h-10 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-lg ${
                    selectedId === t.id && !isRankingSelected ? "bg-orange-200 dark:bg-orange-900" : ""
                  }`}
                >
                  {t.energy === "hype" ? "🔥" : t.energy === "aesthetic" ? "✨" : "💬"}
                </span>
                <div>
                  <p className="font-medium text-sm text-slate-900 dark:text-white">{t.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t.duration}s · {t.energy}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {rankingTemplates.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
            Ranking / Top List
          </p>
          <div className="grid grid-cols-2 gap-2">
            {rankingTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelect(selectedId === t.id ? null : t.id)}
                className={`rounded-lg border-2 p-3 text-left transition-colors ${
                  selectedId === t.id
                    ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30 ring-2 ring-orange-200 dark:ring-orange-800"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-10 h-10 rounded bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-lg">
                    🏆
                  </span>
                  <div>
                    <p className="font-medium text-sm text-slate-900 dark:text-white">{t.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.totalDurationSeconds}s · {t.minProducts}-{t.maxProducts} products
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
