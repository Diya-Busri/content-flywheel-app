/**
 * WorkforcePanel — Phase 3.0
 * ──────────────────────────────────────────────────────────────────────────────
 * 6 AI workers displayed as employee cards.
 * Each worker shows: status, current/last/next task, history, controls.
 *
 * Workers are loaded from GET /api/projects/[launchId]/workforce.
 * Run Now → POST /api/projects/[launchId]/workforce/[workerId]/run
 * Pause/Resume → PATCH /api/projects/[launchId]/workforce
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, Play, Pause, Loader2, ChevronDown, ChevronUp,
  CheckCircle2, Clock, ArrowRight, Zap, Sparkles,
  Search, Package, Palette, Megaphone, Store as StoreIcon, TrendingUp,
  AlertCircle, RefreshCw,
} from "lucide-react";
import type { WorkerId, WorkerState, WorkforceData } from "@/db/schema/launch-schema";

/* ─── Worker metadata ────────────────────────────────────────────────────────── */

const WORKERS: Array<{
  id:           WorkerId;
  label:        string;
  emoji:        string;
  icon:         React.ComponentType<{ className?: string }>;
  color:        string;
  ringColor:    string;
  description:  string;
  responsibilities: string[];
}> = [
  {
    id:    "research",
    label: "Research",
    emoji: "🔍",
    icon:  Search,
    color: "text-blue-400",
    ringColor: "border-blue-500/30 bg-blue-500/[0.04]",
    description: "Monitors the market and finds growth opportunities",
    responsibilities: ["Find keyword opportunities", "Monitor competitors", "Track trends", "Suggest product improvements"],
  },
  {
    id:    "product",
    label: "Product",
    emoji: "📦",
    icon:  Package,
    color: "text-purple-400",
    ringColor: "border-purple-500/30 bg-purple-500/[0.04]",
    description: "Improves product quality and suggests enhancements",
    responsibilities: ["Review weak sections", "Generate bonus content", "Fix quality issues", "Suggest expansions"],
  },
  {
    id:    "design",
    label: "Design",
    emoji: "🎨",
    icon:  Palette,
    color: "text-pink-400",
    ringColor: "border-pink-500/30 bg-pink-500/[0.04]",
    description: "Creates visual concepts and briefs for new graphics",
    responsibilities: ["Brief new thumbnails", "Design seasonal covers", "Improve mockups", "Create social graphics"],
  },
  {
    id:    "marketing",
    label: "Marketing",
    emoji: "📣",
    icon:  Megaphone,
    color: "text-orange-400",
    ringColor: "border-orange-500/30 bg-orange-500/[0.04]",
    description: "Generates new content across every social channel",
    responsibilities: ["Generate TikTok hooks", "Create carousels", "Write emails", "Generate captions", "Create posts"],
  },
  {
    id:    "store",
    label: "Store",
    emoji: "🛍️",
    icon:  StoreIcon,
    color: "text-amber-400",
    ringColor: "border-amber-500/30 bg-amber-500/[0.04]",
    description: "Optimises your product page and listing performance",
    responsibilities: ["Improve SEO", "Refresh FAQs", "Improve CTAs", "Improve descriptions"],
  },
  {
    id:    "growth",
    label: "Growth",
    emoji: "📈",
    icon:  TrendingUp,
    color: "text-green-400",
    ringColor: "border-green-500/30 bg-green-500/[0.04]",
    description: "Runs regular health checks and tracks performance",
    responsibilities: ["Review analytics", "Review Business Brain", "Suggest experiments", "Track performance"],
  },
];

/* ─── Status badge ───────────────────────────────────────────────────────────── */

function StatusBadge({ worker }: { worker: WorkerState | undefined }) {
  if (!worker)                return <span className="inline-flex items-center gap-1 text-[9px] font-bold text-muted-foreground/40 bg-muted/20 px-2 py-0.5 rounded-full">IDLE</span>;
  if (worker.isRunning)       return <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />RUNNING</span>;
  if (worker.isPaused)        return <span className="inline-flex items-center gap-1 text-[9px] font-bold text-muted-foreground/50 bg-muted/20 px-2 py-0.5 rounded-full">PAUSED</span>;
  if (worker.lastActivity)    return <span className="inline-flex items-center gap-1 text-[9px] font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />ACTIVE</span>;
  return <span className="inline-flex items-center gap-1 text-[9px] font-bold text-muted-foreground/40 bg-muted/20 px-2 py-0.5 rounded-full">READY</span>;
}

/* ─── Relative time ──────────────────────────────────────────────────────────── */

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ─── Worker card ────────────────────────────────────────────────────────────── */

function WorkerCard({
  meta, worker, launchId, onUpdate,
}: {
  meta:     typeof WORKERS[0];
  worker:   WorkerState | undefined;
  launchId: string;
  onUpdate: (id: WorkerId, state: WorkerState) => void;
}) {
  const [expanded,  setExpanded]  = useState(false);
  const [running,   setRunning]   = useState(false);
  const [toggling,  setToggling]  = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const isPaused    = worker?.isPaused ?? false;
  const isRunning   = worker?.isRunning ?? running;
  const lastActivity = worker?.lastActivity;
  const nextTask    = worker?.nextTask ?? meta.responsibilities[0];
  const history     = worker?.history ?? [];

  const handleRun = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${launchId}/workforce/${meta.id}/run`, {
        method: "POST",
      });
      const json = await res.json() as { worker?: WorkerState; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Run failed");
      if (json.worker) onUpdate(meta.id, json.worker);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setRunning(false);
    }
  }, [launchId, meta.id, onUpdate]);

  const handleTogglePause = useCallback(async () => {
    setToggling(true);
    try {
      const res = await fetch(`/api/projects/${launchId}/workforce`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ workerId: meta.id, isPaused: !isPaused }),
      });
      const json = await res.json() as { worker?: WorkerState };
      if (json.worker) onUpdate(meta.id, json.worker);
    } finally {
      setToggling(false);
    }
  }, [launchId, meta.id, isPaused, onUpdate]);

  const Icon = meta.icon;

  return (
    <div className={[
      "rounded-2xl border transition-all",
      isPaused ? "border-border/30 bg-card/40 opacity-60" : `${meta.ringColor} border`,
    ].join(" ")}>

      {/* ── Card header ── */}
      <div className="flex items-start gap-3 p-4">
        {/* Avatar */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPaused ? "bg-muted/30" : "bg-muted/20"}`}>
          <Icon className={`w-5 h-5 ${isPaused ? "text-muted-foreground/40" : meta.color}`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-[13px] font-black text-foreground">{meta.label} Worker</p>
            <StatusBadge worker={worker} />
          </div>
          <p className="text-[10px] text-muted-foreground/50 leading-snug mb-2">{meta.description}</p>

          {/* Current task */}
          {isRunning && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-blue-500/10 mb-2">
              <Loader2 className="w-3 h-3 text-blue-400 animate-spin shrink-0" />
              <p className="text-[11px] font-semibold text-blue-400 truncate">
                {worker?.currentTask ?? `Running ${meta.responsibilities[0].toLowerCase()}…`}
              </p>
            </div>
          )}

          {/* Task timeline row */}
          {!isRunning && (
            <div className="grid grid-cols-2 gap-2 mb-2">
              {lastActivity && (
                <div className="rounded-lg bg-muted/15 px-2.5 py-1.5">
                  <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground/40 mb-0.5">Last</p>
                  <p className="text-[10px] font-semibold text-foreground leading-snug">{lastActivity.label}</p>
                  <p className="text-[9px] text-muted-foreground/40">{relTime(lastActivity.completedAt)}</p>
                </div>
              )}
              <div className="rounded-lg bg-muted/15 px-2.5 py-1.5">
                <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground/40 mb-0.5">Next</p>
                <p className="text-[10px] font-semibold text-foreground leading-snug">{nextTask}</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-red-500/10 mb-2">
              <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
              <p className="text-[10px] text-red-400">{error}</p>
            </div>
          )}

          {/* Actions row */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleRun()}
              disabled={isRunning || isPaused || toggling}
              className={[
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all",
                isRunning || isPaused
                  ? "bg-muted/20 text-muted-foreground/30 cursor-not-allowed"
                  : "bg-orange-500 hover:bg-orange-600 text-white shadow-sm shadow-orange-500/20",
              ].join(" ")}
            >
              {isRunning ? (
                <><Loader2 className="w-3 h-3 animate-spin" />Working…</>
              ) : (
                <><Zap className="w-3 h-3" />Run Now</>
              )}
            </button>

            <button
              onClick={() => void handleTogglePause()}
              disabled={isRunning || toggling}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-muted-foreground/60 hover:text-foreground bg-muted/20 hover:bg-muted/40 transition-all"
            >
              {toggling ? <Loader2 className="w-3 h-3 animate-spin" /> :
               isPaused ? <><Play className="w-3 h-3" />Resume</> : <><Pause className="w-3 h-3" />Pause</>}
            </button>

            {history.length > 0 && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground/40 hover:text-foreground transition-colors"
              >
                History
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Design briefs ── */}
      {worker?.designBriefs && worker.designBriefs.length > 0 && (
        <div className="border-t border-border/30 px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40 mb-2">Queued Briefs</p>
          <div className="space-y-1.5">
            {worker.designBriefs.slice(0, 3).map(b => (
              <div key={b.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/15">
                <span className="text-xs shrink-0 leading-none mt-0.5">{b.type === "social" ? "📱" : b.type === "thumbnail" ? "🖼️" : b.type === "cover" ? "🎯" : "📦"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-foreground leading-snug">{b.description}</p>
                  <p className="text-[9px] text-muted-foreground/40 mt-0.5">{b.style}</p>
                </div>
                <a href="/dashboard/design-studio" className="shrink-0 text-[9px] font-bold text-pink-400 hover:underline">Generate</a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Product suggestions ── */}
      {worker?.productSuggestions && worker.productSuggestions.length > 0 && (
        <div className="border-t border-border/30 px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40 mb-2">Improvements</p>
          <div className="space-y-1.5">
            {worker.productSuggestions.slice(0, 3).map(s => (
              <div key={s.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/15">
                <span className={`shrink-0 mt-0.5 text-[8px] font-bold px-1 py-0.5 rounded ${
                  s.priority === "high" ? "bg-red-400/20 text-red-400" :
                  s.priority === "medium" ? "bg-amber-400/20 text-amber-400" :
                  "bg-muted/30 text-muted-foreground/50"
                }`}>{s.priority.toUpperCase()}</span>
                <p className="text-[10px] font-semibold text-foreground leading-snug">{s.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── History ── */}
      {expanded && history.length > 0 && (
        <div className="border-t border-border/30 px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40 mb-2">Activity</p>
          <div className="space-y-2">
            {history.slice(0, 8).map(h => (
              <div key={h.id} className="flex items-start gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-foreground leading-snug">{h.label}</p>
                  {h.detail && <p className="text-[9px] text-muted-foreground/50">{h.detail}</p>}
                </div>
                <span className="text-[9px] text-muted-foreground/30 shrink-0 tabular-nums">{relTime(h.completedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main panel ─────────────────────────────────────────────────────────────── */

interface WorkforcePanelProps {
  launchId: string;
}

export function WorkforcePanel({ launchId }: WorkforcePanelProps) {
  const [workforce, setWorkforce] = useState<WorkforceData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${launchId}/workforce`)
      .then(r => r.ok ? r.json() as Promise<{ workforce: WorkforceData }> : Promise.reject("Failed"))
      .then(d => { setWorkforce(d.workforce); setLoading(false); })
      .catch(() => { setError("Could not load workforce."); setLoading(false); });
  }, [launchId]);

  const handleUpdate = useCallback((id: WorkerId, state: WorkerState) => {
    setWorkforce(prev => {
      if (!prev) return prev;
      return { workers: { ...prev.workers, [id]: state } };
    });
  }, []);

  /* ── Summary stats ── */
  const activeCount  = workforce ? WORKERS.filter(w => !workforce.workers[w.id]?.isPaused).length : 0;
  const runningCount = workforce ? WORKERS.filter(w => workforce.workers[w.id]?.isRunning).length  : 0;
  const totalRuns    = workforce
    ? WORKERS.reduce((sum, w) => sum + (workforce.workers[w.id]?.history?.length ?? 0), 0)
    : 0;

  return (
    <div className="mt-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-orange-500 shrink-0" />
        <h2 className="text-[14px] font-black tracking-tight text-foreground">AI Workforce</h2>
        <div className="flex-1 h-px bg-border/30" />
        {!loading && !error && (
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              {activeCount} active
            </span>
            {runningCount > 0 && (
              <span className="flex items-center gap-1 text-blue-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                {runningCount} running
              </span>
            )}
            {totalRuns > 0 && <span>{totalRuns} tasks completed</span>}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-red-500/20 text-[12px] text-muted-foreground/60">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          {error}
        </div>
      )}

      {workforce && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {WORKERS.map(meta => (
            <WorkerCard
              key={meta.id}
              meta={meta}
              worker={workforce.workers[meta.id]}
              launchId={launchId}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}

      {/* Footer note */}
      {workforce && (
        <p className="mt-3 text-center text-[10px] text-muted-foreground/30">
          Workers append to existing content — they never regenerate from scratch.
        </p>
      )}
    </div>
  );
}
