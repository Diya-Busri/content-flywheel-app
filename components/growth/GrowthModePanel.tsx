"use client";

/**
 * GrowthModePanel — Phase 6
 * ──────────────────────────────────────────────────────────────────────────────
 * The autonomous growth system panel. Shown below the existing Phase 2.2
 * GrowthDashboard on the project page.
 *
 * Features:
 *  1. Status header — last review time, "Run Review" button
 *  2. Review summary — top opportunity + top problem from latest review
 *  3. Priority filter tabs — All / Critical / High / Medium / Low
 *  4. Task list — GrowthTaskCard for each task
 *  5. Review history accordion — log of all past reviews
 *
 * Auto-runs a manual review on mount if no reviews exist.
 */

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, Loader2, RefreshCw, ChevronDown, ChevronUp,
  Calendar, Sparkles, AlertCircle, History, Target,
} from "lucide-react";
import type {
  GrowthTask,
  GrowthReview,
  GrowthTaskPriority,
} from "@/db/schema/launch-schema";
import { GrowthTaskCard } from "./GrowthTaskCard";

/* ─── Filter tab config ──────────────────────────────────────────────────────── */

type FilterTab = "all" | GrowthTaskPriority;

const FILTER_TABS: Array<{ id: FilterTab; label: string }> = [
  { id: "all",      label: "All"      },
  { id: "critical", label: "Critical" },
  { id: "high",     label: "High"     },
  { id: "medium",   label: "Medium"   },
  { id: "low",      label: "Low"      },
];

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const REVIEW_TYPE_LABELS: Record<string, string> = {
  daily: "Daily Review", weekly: "Weekly Review", manual: "Manual Review",
};

/* ─── Props ──────────────────────────────────────────────────────────────────── */

interface GrowthModePanelProps {
  launchId: string;
}

/* ─── Component ──────────────────────────────────────────────────────────────── */

export function GrowthModePanel({ launchId }: GrowthModePanelProps) {
  const [tasks,       setTasks]       = useState<GrowthTask[]>([]);
  const [reviews,     setReviews]     = useState<GrowthReview[]>([]);
  const [filter,      setFilter]      = useState<FilterTab>("all");
  const [running,     setRunning]     = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loaded,      setLoaded]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  /* ── Fetch ── */
  const fetchData = useCallback(async () => {
    try {
      const res  = await fetch(`/api/projects/${launchId}/growth`);
      const json = await res.json() as { tasks: GrowthTask[]; reviews: GrowthReview[] };
      setTasks(json.tasks ?? []);
      setReviews(json.reviews ?? []);
    } catch { /* silent */ }
    setLoaded(true);
  }, [launchId]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  /* ── Auto-run on first load if no reviews ── */
  useEffect(() => {
    if (loaded && reviews.length === 0 && !running) {
      void handleRunReview();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  /* ── Run review ── */
  const handleRunReview = useCallback(async (type = "manual") => {
    setRunning(true);
    setError(null);
    try {
      const res  = await fetch(`/api/projects/${launchId}/growth`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error("Review failed");
      const json = await res.json() as { review: GrowthReview; newTasks: GrowthTask[] };
      setReviews(prev => [json.review, ...prev]);
      setTasks(prev  => [...prev, ...json.newTasks]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed — try again");
    }
    setRunning(false);
  }, [launchId]);

  /* ── Update task ── */
  const handleUpdate = useCallback(async (taskId: string, status: "done" | "dismissed") => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    await fetch(`/api/projects/${launchId}/growth`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ taskId, status }),
    }).catch(() => {});
  }, [launchId]);

  /* ── Derived ── */
  const activeTasks  = tasks.filter(t => t.status === "pending" || t.status === "in_progress");
  const resolvedCount = tasks.filter(t => t.status === "done" || t.status === "dismissed").length;
  const latestReview = reviews[0];

  const filteredTasks = filter === "all"
    ? activeTasks
    : activeTasks.filter(t => t.priority === filter);

  const criticalCount = activeTasks.filter(t => t.priority === "critical").length;
  const highCount     = activeTasks.filter(t => t.priority === "high").length;

  /* ── Loading state ── */
  if (!loaded) {
    return (
      <div className="mt-3 rounded-2xl border border-green-500/15 p-5 flex items-center gap-3">
        <Loader2 className="w-4 h-4 text-green-400 animate-spin shrink-0" />
        <p className="text-[12px] text-muted-foreground/60">Loading growth tasks…</p>
      </div>
    );
  }

  /* ── Running state (first-time review) ── */
  if (running && reviews.length === 0) {
    return (
      <div className="mt-3 rounded-2xl border border-green-500/20 bg-green-500/[0.03] p-6 flex flex-col items-center gap-3 text-center">
        <TrendingUp className="w-6 h-6 text-green-400 animate-pulse" />
        <p className="text-[13px] font-bold text-foreground">Running first growth review…</p>
        <p className="text-[11px] text-muted-foreground/50">Analysing your Business Memory, analytics, and content pipeline</p>
        <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-muted/30">
          <Loader2 className="w-3 h-3 text-green-400 animate-spin shrink-0" />
          <span className="text-[11px] text-foreground/70">Generating evidence-based recommendations…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">

      {/* ── Section header ── */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-green-400 shrink-0" />
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/50">Autonomous Growth Tasks</p>
        <div className="flex-1 h-px bg-border/30" />
        {latestReview && (
          <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1">
            <History className="w-3 h-3" />
            {REVIEW_TYPE_LABELS[latestReview.type] ?? "Review"} {relTime(latestReview.runAt)}
          </span>
        )}
        <button
          onClick={() => void handleRunReview("manual")}
          disabled={running}
          className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-40"
        >
          {running
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <RefreshCw className="w-3 h-3" />}
          Run review
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <p className="text-[11px] text-red-400">{error}</p>
        </div>
      )}

      {/* ── Latest review summary ── */}
      {latestReview && (latestReview.topOpportunity || latestReview.topProblem) && (
        <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-2">
          <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-wider">Last review summary</p>
          <p className="text-[12px] text-foreground/80 leading-relaxed">{latestReview.summary}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            {latestReview.topOpportunity && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-green-500/5 border border-green-500/15">
                <Target className="w-3 h-3 text-green-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[9px] font-bold text-green-400 uppercase tracking-wider mb-0.5">Top Opportunity</p>
                  <p className="text-[11px] text-foreground/70 leading-snug">{latestReview.topOpportunity}</p>
                </div>
              </div>
            )}
            {latestReview.topProblem && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-red-500/5 border border-red-500/15">
                <AlertCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[9px] font-bold text-red-400 uppercase tracking-wider mb-0.5">Top Problem</p>
                  <p className="text-[11px] text-foreground/70 leading-snug">{latestReview.topProblem}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Task list ── */}
      <div className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden">
        {/* Filter bar */}
        <div className="flex items-center gap-1 px-4 py-2.5 border-b border-border/30 flex-wrap">
          {FILTER_TABS.map(tab => {
            const count = tab.id === "all"
              ? activeTasks.length
              : activeTasks.filter(t => t.priority === tab.id).length;
            if (tab.id !== "all" && count === 0) return null;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={[
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors",
                  filter === tab.id
                    ? tab.id === "critical" ? "bg-red-500/15 text-red-400"
                    : tab.id === "high"     ? "bg-orange-500/15 text-orange-400"
                    : tab.id === "medium"   ? "bg-amber-500/15 text-amber-400"
                    : "bg-muted/30 text-foreground"
                    : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/20",
                ].join(" ")}
              >
                {tab.label}
                <span className={`text-[9px] px-1 py-0.5 rounded-full ${filter === tab.id ? "bg-white/10" : "bg-muted/20"}`}>
                  {count}
                </span>
              </button>
            );
          })}

          {/* Alert badges */}
          <div className="ml-auto flex items-center gap-1">
            {criticalCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[9px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                {criticalCount} critical
              </span>
            )}
            {highCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 text-[9px] font-bold">
                {highCount} high
              </span>
            )}
          </div>
        </div>

        {/* Task rows */}
        {filteredTasks.length === 0 ? (
          <div className="px-4 py-8 text-center">
            {running ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 text-green-400 animate-spin" />
                <p className="text-[12px] text-muted-foreground/50">Running growth review…</p>
              </div>
            ) : activeTasks.length === 0 ? (
              <>
                <Sparkles className="w-7 h-7 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-[12px] text-muted-foreground/40">All caught up!</p>
                <p className="text-[10px] text-muted-foreground/30 mt-1">No pending tasks — run a review to generate new recommendations</p>
              </>
            ) : (
              <>
                <p className="text-[12px] text-muted-foreground/40">No {filter} priority tasks</p>
                <button onClick={() => setFilter("all")} className="text-[10px] text-orange-500 hover:underline mt-1">
                  Show all tasks
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {filteredTasks.map(task => (
              <GrowthTaskCard key={task.id} task={task} onUpdate={handleUpdate} />
            ))}
          </div>
        )}

        {/* Resolved count footer */}
        {resolvedCount > 0 && (
          <div className="px-4 py-2 border-t border-border/20 bg-muted/5">
            <p className="text-[10px] text-muted-foreground/30">
              {resolvedCount} task{resolvedCount !== 1 ? "s" : ""} resolved
            </p>
          </div>
        )}
      </div>

      {/* ── Review history ── */}
      {reviews.length > 1 && (
        <div className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden">
          <button
            onClick={() => setHistoryOpen(v => !v)}
            className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/20 transition-colors"
          >
            <History className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
            <p className="flex-1 text-left text-[12px] font-bold text-foreground">Review History</p>
            <span className="text-[10px] text-muted-foreground/40">{reviews.length} reviews</span>
            {historyOpen
              ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/40" />
              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40" />}
          </button>

          {historyOpen && (
            <div className="border-t border-border/30 divide-y divide-border/20">
              {reviews.slice(0, 10).map(review => (
                <div key={review.id} className="flex items-start gap-3 px-4 py-3">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-[11px] font-bold text-foreground">
                        {REVIEW_TYPE_LABELS[review.type] ?? review.type}
                      </p>
                      <span className="text-[10px] text-muted-foreground/40">{relTime(review.runAt)}</span>
                      {review.tasksGenerated > 0 && (
                        <span className="text-[9px] font-bold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full">
                          +{review.tasksGenerated} tasks
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 leading-relaxed">{review.summary}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
