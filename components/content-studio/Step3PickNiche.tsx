"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Check, ArrowRight, Filter } from "lucide-react";
import type { WizardData } from "./Step1AboutYou";
import type { VideoNicheItem } from "@/app/api/content-studio/generate-niches/route";
import { useContentStudio } from "@/app/dashboard/content-studio/create/ContentStudioContext";

type Props = {
  wizardData: WizardData;
  onNext: (data?: Partial<WizardData>) => void;
  onBack: () => void;
};

const SATURATION_MAP: Record<string, { emoji: string; label: string; className: string }> = {
  low: { emoji: "🟢", label: "Low Saturation", className: "text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/30" },
  medium: { emoji: "🟡", label: "Medium Saturation", className: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30" },
  high: { emoji: "🟠", label: "High Saturation", className: "text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/30" },
};

/** Parse "~500k" or "1.2M" to number for filtering. */
function parseViews(s: string): number {
  const t = (s || "").trim().replace(/~/g, "");
  const match = t.match(/^([\d.]+)\s*([kKmM])?$/);
  if (!match) return 0;
  let n = parseFloat(match[1]);
  const unit = (match[2] || "").toLowerCase();
  if (unit === "k") n *= 1_000;
  else if (unit === "m") n *= 1_000_000;
  return Math.round(n);
}

type SaturationFilter = "all" | "low" | "medium" | "high";
type ViewsFilter = "all" | "1M" | "500k" | "100k";
type SortOption = "opportunity" | "views" | "competition";

const VIEWS_THRESHOLDS: Record<ViewsFilter, number> = { all: 0, "1M": 1_000_000, "500k": 500_000, "100k": 100_000 };
const ONE_M = 1_000_000;

type UserSettings = {
  selected_niche: string | null;
  content_style: string | null;
  youtube_channels: Array<{ id: string; name: string; subscriber_count: number }>;
};

async function fetchUserContentSettings(): Promise<{
  selected_niche: string | null;
  content_style: string | null;
  youtube_channels: Array<{ id: string; name: string; subscriber_count: number }>;
  has_1m_subs: boolean;
} | null> {
  try {
    const res = await fetch("/api/content-studio/user-settings");
    const data = (await res.json().catch(() => ({}))) as UserSettings;
    const channels = data.youtube_channels ?? [];
    const has_1m_subs = channels.some((c) => (c?.subscriber_count ?? 0) >= ONE_M);
    return {
      selected_niche: data.selected_niche?.trim() || null,
      content_style: data.content_style ?? null,
      youtube_channels: channels,
      has_1m_subs,
    };
  } catch {
    return null;
  }
}

export function Step3PickNiche({ wizardData, onNext, onBack }: Props) {
  const router = useRouter();
  const { wizardData: contextWizardData, updateWizardData } = useContentStudio();
  const [niches, setNiches] = useState<VideoNicheItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saturationFilter, setSaturationFilter] = useState<SaturationFilter>("all");
  const [viewsFilter, setViewsFilter] = useState<ViewsFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("opportunity");
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [show1MBanner, setShow1MBanner] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settings = await fetchUserContentSettings();
      if (cancelled) return;
      if (settings?.selected_niche && !settings.has_1m_subs) {
        onNext({ selected_niche: settings.selected_niche });
        router.push("/dashboard/content-studio/create?step=4");
        return;
      }
      if (settings?.selected_niche && settings.has_1m_subs) {
        setShow1MBanner(true);
      }
      setInitialCheckDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [onNext, router]);

  useEffect(() => {
    if (!initialCheckDone) return;
    let cancelled = false;
    const topics = contextWizardData.topics ?? (wizardData as { topics?: string }).topics ?? "";
    const contentStyle = contextWizardData.content_style ?? (wizardData as { content_style?: string }).content_style ?? (wizardData as { contentStyle?: string }).contentStyle ?? "";

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/content-studio/generate-niches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topics,
            content_style: contentStyle || undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError((data.error as string) || "Failed to load niches");
          setNiches([]);
          return;
        }
        setNiches(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Something went wrong");
          setNiches([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialCheckDone, contextWizardData.topics, contextWizardData.content_style]);

  const savedNiche = (wizardData as { selected_niche?: string }).selected_niche ?? (wizardData as { selectedNiche?: string }).selectedNiche;
  useEffect(() => {
    if (niches.length > 0 && savedNiche && !selectedId) {
      const match = niches.find((n) => n.name === savedNiche);
      if (match) setSelectedId(match.id);
    }
  }, [niches, savedNiche, selectedId]);

  const filteredAndSorted = useMemo(() => {
    let list = niches.filter((n) => {
      if (saturationFilter !== "all" && n.saturation !== saturationFilter) return false;
      const views = parseViews(n.estimated_monthly_views);
      const minViews = VIEWS_THRESHOLDS[viewsFilter];
      if (minViews > 0 && views < minViews) return false;
      return true;
    });
    if (sortBy === "opportunity") {
      const order = { low: 0, medium: 1, high: 2 };
      list = [...list].sort((a, b) => order[a.saturation] - order[b.saturation]);
    } else if (sortBy === "views") {
      list = [...list].sort((a, b) => parseViews(b.estimated_monthly_views) - parseViews(a.estimated_monthly_views));
    } else {
      const order = { low: 0, medium: 1, high: 2 };
      list = [...list].sort((a, b) => order[a.saturation] - order[b.saturation]);
    }
    return list;
  }, [niches, saturationFilter, viewsFilter, sortBy]);

  const selectedNiche = selectedId ? niches.find((n) => n.id === selectedId) ?? niches.find((n) => n.name === selectedId) : null;
  const selectedName = selectedNiche?.name ?? selectedId;

  const handleSelect = (n: VideoNicheItem) => {
    setSelectedId(n.id);
  };

  const handleNext = async () => {
    if (!selectedName) return;
    try {
      await fetch("/api/content-studio/user-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selected_niche: selectedName,
          content_style: contextWizardData.content_style ?? (wizardData as { content_style?: string }).content_style ?? (wizardData as { contentStyle?: string }).contentStyle ?? null,
        }),
      });
    } catch {
      // continue to next step
    }
    console.log("Saving niche:", selectedName);
    await updateWizardData({
      selected_niche: selectedName,
      current_step: 4,
    });
    router.push("/dashboard/content-studio/create?step=4");
  };

  if (!initialCheckDone || loading) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Step 3 of 7 — Pick Your Niche</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">Filtered by your content style from Step 2</p>
        <div className="py-16 text-center">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            {!initialCheckDone ? "Checking your saved niche..." : "Analyzing trending niches..."}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Step 3 of 7 — Pick Your Niche</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">Filtered by your content style from Step 2</p>
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-4 text-red-700 dark:text-red-300 mb-6">
          {error}
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onBack} className="border-gray-300 dark:border-gray-600">
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Step 3 of 7 — Pick Your Niche</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8">Choose one niche to focus on (filtered by your content style)</p>

      {show1MBanner && (
        <div className="rounded-xl border border-green-500/40 bg-green-500/10 text-green-800 dark:text-green-200 px-4 py-3 mb-6">
          <p className="text-sm font-medium">
            🎉 You&apos;ve unlocked multi-channel mode! You can now manage multiple YouTube channels.
          </p>
        </div>
      )}

      {niches.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50 dark:bg-gray-800/50 p-4 mb-6">
            <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Saturation:</span>
            <select
              value={saturationFilter}
              onChange={(e) => setSaturationFilter(e.target.value as SaturationFilter)}
              className="rounded-lg bg-white dark:bg-gray-800 border border-[#E5E7EB] dark:border-[#2A2A2A] text-gray-900 dark:text-white text-xs px-3 py-1.5"
            >
              <option value="all">All</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 ml-2">Views:</span>
            <select
              value={viewsFilter}
              onChange={(e) => setViewsFilter(e.target.value as ViewsFilter)}
              className="rounded-lg bg-white dark:bg-gray-800 border border-[#E5E7EB] dark:border-[#2A2A2A] text-gray-900 dark:text-white text-xs px-3 py-1.5"
            >
              <option value="all">All</option>
              <option value="1M">1M+</option>
              <option value="500k">500k+</option>
              <option value="100k">100k+</option>
            </select>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 ml-2">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="rounded-lg bg-white dark:bg-gray-800 border border-[#E5E7EB] dark:border-[#2A2A2A] text-gray-900 dark:text-white text-xs px-3 py-1.5"
            >
              <option value="opportunity">Best opportunity</option>
              <option value="views">Most views</option>
              <option value="competition">Lowest competition</option>
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            {filteredAndSorted.map((n) => {
              const sat = SATURATION_MAP[n.saturation] ?? SATURATION_MAP.medium;
              const isSelected = n.id === selectedId || n.name === selectedId;
              const cardClass = isSelected
                ? "border-orange-500 bg-orange-500/5 dark:bg-orange-500/10"
                : "border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-orange-500/50 bg-white dark:bg-gray-800";
              return (
                <Card key={n.id} className={`transition-all ${cardClass}`}>
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{n.name}</h3>
                      <span className={`text-xs font-medium px-2 py-1 rounded-md border ${sat.className}`}>
                        {sat.emoji} {sat.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <span>{n.estimated_monthly_views} views/month</span>
                      <span>{n.trend === "rising" ? "📈 Rising" : "➡️ Stable"}</span>
                    </div>
                    {n.angles?.length > 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Angles:</span>{" "}
                        {n.angles.map((a, i) => (
                          <span key={i}>
                            <span className="inline-block px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 mr-1 mb-1">
                              {a}
                            </span>
                          </span>
                        ))}
                      </p>
                    )}
                    {n.why_it_works && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Why this works:</span> {n.why_it_works}
                      </p>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant={isSelected ? "default" : "outline"}
                      className={
                        isSelected
                          ? "bg-orange-500 hover:bg-orange-600 text-white gap-2"
                          : "border-orange-500/50 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 gap-2"
                      }
                      onClick={() => handleSelect(n)}
                    >
                      {isSelected ? <Check className="w-4 h-4" /> : null}
                      Select This Niche
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredAndSorted.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">No niches match your filters. Try changing them.</p>
          )}
        </>
      )}

      <div className="flex justify-between items-center pt-4">
        <Button type="button" variant="outline" onClick={onBack} className="border-[#E5E7EB] dark:border-[#2A2A2A]">
          Back
        </Button>
        {selectedName && (
          <Button
            type="button"
            onClick={handleNext}
            className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
          >
            Next: Pick Trending Topic
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
