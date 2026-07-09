"use client";

/**
 * BusinessOSDashboard — Phase 6.0
 * ──────────────────────────────────────────────────────────────────────────────
 * Morning executive briefing card.
 * Shows: greeting, yesterday stats, platform deltas, best content, top lesson,
 * critical task count, growth score.
 *
 * Renders at the top of the project page (above MissionControlCard).
 */

import { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  ShoppingCart,
  FileText,
  Lightbulb,
  AlertTriangle,
  RefreshCw,
  Activity,
} from "lucide-react";
import type { DailyBriefing, PlatformDelta } from "@/db/schema/launch-schema";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

type Props = { launchId: string };

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

const PLATFORM_LABELS: Record<string, string> = {
  tiktok:    "TikTok",
  youtube:   "YouTube",
  instagram: "Instagram",
  linkedin:  "LinkedIn",
  x:         "X",
  email:     "Email",
  seo:       "SEO",
};

const SCORE_CONFIG: Record<DailyBriefing["growthScore"], { label: string; color: string; bg: string; dot: string }> = {
  strong:    { label: "Strong",    color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30",  dot: "bg-emerald-500" },
  improving: { label: "Improving", color: "text-blue-700 dark:text-blue-400",      bg: "bg-blue-50 dark:bg-blue-950/30",        dot: "bg-blue-500" },
  flat:      { label: "Flat",      color: "text-amber-700 dark:text-amber-400",    bg: "bg-amber-50 dark:bg-amber-950/30",      dot: "bg-amber-500" },
  declining: { label: "Declining", color: "text-red-700 dark:text-red-400",        bg: "bg-red-50 dark:bg-red-950/30",          dot: "bg-red-500 animate-pulse" },
};

function formatCurrency(amount: number, currency: string): string {
  const sym = currency === "gbp" ? "£" : currency === "eur" ? "€" : "$";
  return `${sym}${amount.toFixed(2)}`;
}

function DeltaArrow({ dir }: { dir: PlatformDelta["direction"] }) {
  if (dir === "up")   return <TrendingUp   className="h-3.5 w-3.5 text-emerald-500" />;
  if (dir === "down") return <TrendingDown className="h-3.5 w-3.5 text-red-500"    />;
  return <Minus className="h-3.5 w-3.5 text-gray-400" />;
}

/* ─── Component ──────────────────────────────────────────────────────────────── */

export function BusinessOSDashboard({ launchId }: Props) {
  const [briefing,  setBriefing]  = useState<DailyBriefing | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  async function load(force = false) {
    try {
      if (force) setRefreshing(true);
      else       setLoading(true);

      const url = `/api/projects/${launchId}/business-os${force ? "?refresh=1" : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setBriefing(data.briefing ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); }, [launchId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] bg-white dark:border-[#1E1E1E] dark:bg-[#111] p-5 animate-pulse">
        <div className="h-5 w-48 bg-gray-200 dark:bg-gray-800 rounded mb-3" />
        <div className="grid grid-cols-3 gap-3">
          {[0,1,2].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (error || !briefing) return null; // silent fail — don't block project page

  const score = SCORE_CONFIG[briefing.growthScore];

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white dark:border-[#1E1E1E] dark:bg-[#111] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#F0F0F0] dark:border-[#1E1E1E] bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {briefing.greeting} — Business OS
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Growth score badge */}
          <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${score.bg} ${score.color}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${score.dot}`} />
            {score.label}
          </div>
          <button
            onClick={() => void load(true)}
            disabled={refreshing}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 transition-opacity"
            title="Refresh briefing"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Stat strip */}
        <div className="grid grid-cols-3 gap-3">
          {/* Published yesterday */}
          <div className="rounded-lg border border-[#F0F0F0] dark:border-[#1E1E1E] bg-gray-50/50 dark:bg-[#0F0F0F]/50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <FileText className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Posted</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{briefing.publishedYesterday}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">yesterday</p>
          </div>

          {/* Revenue */}
          <div className="rounded-lg border border-[#F0F0F0] dark:border-[#1E1E1E] bg-gray-50/50 dark:bg-[#0F0F0F]/50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <ShoppingCart className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Revenue</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(briefing.revenue.amount, briefing.revenue.currency)}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">{briefing.revenue.sales} sale{briefing.revenue.sales !== 1 ? "s" : ""} yesterday</p>
          </div>

          {/* Critical tasks */}
          <div className={`rounded-lg border p-3 ${
            briefing.criticalTasks > 0
              ? "border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20"
              : "border-[#F0F0F0] dark:border-[#1E1E1E] bg-gray-50/50 dark:bg-[#0F0F0F]/50"
          }`}>
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className={`h-3.5 w-3.5 ${briefing.criticalTasks > 0 ? "text-red-500" : "text-gray-400"}`} />
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Actions</span>
            </div>
            <p className={`text-2xl font-bold ${briefing.criticalTasks > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>
              {briefing.criticalTasks + briefing.highTasks}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {briefing.criticalTasks} critical · {briefing.highTasks} high
            </p>
          </div>
        </div>

        {/* Platform deltas */}
        {briefing.platformDeltas.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Platform performance (7-day)
            </p>
            <div className="flex flex-wrap gap-2">
              {briefing.platformDeltas.map(d => (
                <div
                  key={d.platform}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                    d.direction === "up"   ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400" :
                    d.direction === "down" ? "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 text-red-700 dark:text-red-400" :
                    "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  <DeltaArrow dir={d.direction} />
                  <span className="font-medium">{PLATFORM_LABELS[d.platform] ?? d.platform}</span>
                  <span className="opacity-75">
                    {d.changePercent >= 0 ? "+" : ""}{d.changePercent}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom row — best content + top lesson */}
        <div className="grid grid-cols-2 gap-3">
          {briefing.bestContent && (
            <div className="rounded-lg border border-[#F0F0F0] dark:border-[#1E1E1E] bg-gray-50/50 dark:bg-[#0F0F0F]/50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Best — {PLATFORM_LABELS[briefing.bestContent.platform] ?? briefing.bestContent.platform}
                </span>
              </div>
              <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 leading-relaxed">
                {briefing.bestContent.content}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">
                {briefing.bestContent.value.toLocaleString()} views
              </p>
            </div>
          )}

          {briefing.topLesson && (
            <div className="rounded-lg border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-950/10 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Lightbulb className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Top Lesson</span>
              </div>
              <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-3 leading-relaxed">
                {briefing.topLesson}
              </p>
            </div>
          )}
        </div>

        {/* Growth score reason */}
        <p className="text-[11px] text-gray-500 dark:text-gray-400 italic">
          {briefing.growthScoreReason}
        </p>
      </div>
    </div>
  );
}
