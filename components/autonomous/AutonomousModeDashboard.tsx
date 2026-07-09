"use client";

/**
 * AutonomousModeDashboard — Phase 7.0
 * ──────────────────────────────────────────────────────────────────────────────
 * Control panel for the autonomous company mode.
 * Shows ON/OFF toggle, current phase, last run, next run, and a Run Now button.
 */

import { useEffect, useState, useCallback } from "react";
import {
  Cpu,
  Play,
  Pause,
  RotateCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import type { AutonomousMode, AutonomousPhase } from "@/db/schema/launch-schema";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

type Props = {
  launchId: string;
  /** Called when a cycle starts so parent can poll activity */
  onCycleStart?: () => void;
};

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

const PHASE_LABELS: Record<AutonomousPhase, string> = {
  idle:      "Idle",
  research:  "Research",
  marketing: "Marketing",
  design:    "Design",
  analytics: "Analytics",
  learning:  "Learning",
  memory:    "Memory",
  briefing:  "Briefing",
  complete:  "Complete",
  error:     "Error",
};

const DEPT_ORDER: AutonomousPhase[] = [
  "research", "marketing", "analytics", "learning", "memory", "briefing",
];

function isRunning(phase: AutonomousPhase | undefined): boolean {
  return DEPT_ORDER.slice(0, -1).includes(phase as AutonomousPhase) ||
    phase === "briefing";
}

function formatRelative(iso: string | undefined): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hrs  = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0)  return `${days}d ago`;
  if (hrs > 0)   return `${hrs}h ago`;
  if (mins > 0)  return `${mins}m ago`;
  return "Just now";
}

function formatDatetime(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ─── Phase pipeline strip ───────────────────────────────────────────────────── */

function PipelineStrip({ currentPhase }: { currentPhase: AutonomousPhase | undefined }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {DEPT_ORDER.map((phase, i) => {
        const isPast    = currentPhase && DEPT_ORDER.indexOf(currentPhase) > i;
        const isCurrent = currentPhase === phase;
        const isComplete = currentPhase === "complete";

        return (
          <div key={phase} className="flex items-center gap-1">
            <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${
              isComplete || isPast
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                : isCurrent
                ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 animate-pulse"
                : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
            }`}>
              {(isComplete || isPast) && <CheckCircle2 className="h-2.5 w-2.5" />}
              {isCurrent && <RotateCw className="h-2.5 w-2.5 animate-spin" />}
              {PHASE_LABELS[phase]}
            </div>
            {i < DEPT_ORDER.length - 1 && (
              <ChevronRight className="h-3 w-3 text-gray-300 dark:text-gray-600" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────────────── */

export function AutonomousModeDashboard({ launchId, onCycleStart }: Props) {
  const [mode,    setMode]    = useState<AutonomousMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [toggling, setToggling] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`/api/projects/${launchId}/autonomous`);
      const data = await res.json() as { mode: AutonomousMode };
      setMode(data.mode);
    } catch {
      // Silent — don't crash the page
    } finally {
      setLoading(false);
    }
  }, [launchId]);

  useEffect(() => { void load(); }, [load]);

  // Poll while a cycle is running
  useEffect(() => {
    if (!mode) return;
    if (!isRunning(mode.currentPhase)) return;

    const interval = setInterval(() => { void load(); }, 4000);
    return () => clearInterval(interval);
  }, [mode, load]);

  async function toggleEnabled() {
    if (!mode) return;
    setToggling(true);
    try {
      const res  = await fetch(`/api/projects/${launchId}/autonomous`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ enabled: !mode.enabled }),
      });
      const data = await res.json() as { mode: AutonomousMode };
      setMode(data.mode);
      toast({
        title:       data.mode.enabled ? "Autonomous Mode ON" : "Autonomous Mode OFF",
        description: data.mode.enabled
          ? "Your AI company will run its daily cycle automatically."
          : "Daily cycles paused. You can still run manually.",
      });
    } catch {
      toast({ title: "Error", description: "Could not update mode", variant: "destructive" });
    } finally {
      setToggling(false);
    }
  }

  async function runNow() {
    setRunning(true);
    try {
      const res = await fetch(`/api/projects/${launchId}/autonomous/run`, { method: "POST" });
      if (res.status === 409) {
        toast({ title: "Already running", description: "A cycle is already in progress." });
        return;
      }
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Cycle started", description: "Your AI company is now working..." });
      onCycleStart?.();
      // Refresh mode after a beat
      setTimeout(() => { void load(); }, 1500);
    } catch {
      toast({ title: "Error", description: "Could not start cycle", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] dark:border-[#1E1E1E] bg-white dark:bg-[#111] p-5 animate-pulse">
        <div className="h-5 w-48 bg-gray-200 dark:bg-gray-800 rounded mb-3" />
        <div className="h-8 w-full bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
    );
  }

  if (!mode) return null;

  const cycleRunning = isRunning(mode.currentPhase);
  const hasError     = mode.currentPhase === "error";

  return (
    <div className="rounded-xl border border-[#E5E7EB] dark:border-[#1E1E1E] bg-white dark:bg-[#111] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#F0F0F0] dark:border-[#1E1E1E] bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20">
        <div className="flex items-center gap-2">
          <Cpu className={`h-4 w-4 ${mode.enabled ? "text-violet-500" : "text-gray-400"}`} />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            Autonomous Company
          </span>
          {mode.enabled && (
            <span className="flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-950/40 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-400">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />
              Active
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Run Now */}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5 border-violet-200 dark:border-violet-900/40 text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30"
            disabled={running || cycleRunning}
            onClick={() => void runNow()}
          >
            {cycleRunning
              ? <RotateCw className="h-3 w-3 animate-spin" />
              : <Play className="h-3 w-3" />}
            {cycleRunning ? "Running…" : "Run Now"}
          </Button>

          {/* Toggle */}
          <button
            onClick={() => void toggleEnabled()}
            disabled={toggling}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              mode.enabled ? "bg-violet-500" : "bg-gray-300 dark:bg-gray-600"
            } ${toggling ? "opacity-50" : ""}`}
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
              mode.enabled ? "translate-x-4" : "translate-x-0.5"
            }`} />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Pipeline strip */}
        <PipelineStrip currentPhase={mode.currentPhase} />

        {/* Error state */}
        {hasError && mode.lastError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-3">
            <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-red-700 dark:text-red-400">Last cycle failed</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{mode.lastError}</p>
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-[#F0F0F0] dark:border-[#1E1E1E] bg-gray-50/50 dark:bg-[#0F0F0F]/50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <RotateCw className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Cycles</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{mode.cycleCount}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">total runs</p>
          </div>

          <div className="rounded-lg border border-[#F0F0F0] dark:border-[#1E1E1E] bg-gray-50/50 dark:bg-[#0F0F0F]/50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Last Run</span>
            </div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{formatRelative(mode.lastRunAt)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{formatDatetime(mode.lastRunAt)}</p>
          </div>

          <div className="rounded-lg border border-[#F0F0F0] dark:border-[#1E1E1E] bg-gray-50/50 dark:bg-[#0F0F0F]/50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              {mode.enabled
                ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                : <Pause className="h-3.5 w-3.5 text-gray-400" />}
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Schedule</span>
            </div>
            <p className="text-sm font-bold text-gray-900 dark:text-white capitalize">{mode.schedule}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {mode.enabled ? "Next: " + formatRelative(mode.nextRunAt) : "Paused"}
            </p>
          </div>
        </div>

        {!mode.enabled && !cycleRunning && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-950/10 px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Autonomous mode is off. Enable it to run the daily company cycle automatically, or use Run Now to trigger manually.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
