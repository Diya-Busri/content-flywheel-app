"use client";

/**
 * CompanyActivityFeed — Phase 7.0
 * ──────────────────────────────────────────────────────────────────────────────
 * Live feed of every action taken by every department.
 * Shows status badges, duration, and timestamps.
 * Auto-refreshes every 5s while a cycle is running.
 */

import { useEffect, useState, useCallback } from "react";
import {
  Activity,
  CheckCircle2,
  XCircle,
  SkipForward,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { ActivityEvent, AutonomousDepartment } from "@/db/schema/launch-schema";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

type Props = {
  launchId: string;
  /** If true, polls every 5s */
  live?: boolean;
};

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

const DEPT_DOT: Record<AutonomousDepartment, string> = {
  research:  "bg-blue-400",
  marketing: "bg-orange-400",
  design:    "bg-pink-400",
  analytics: "bg-emerald-400",
  learning:  "bg-violet-400",
  memory:    "bg-amber-400",
  system:    "bg-gray-400",
};

const DEPT_LABEL: Record<AutonomousDepartment, string> = {
  research:  "Research",
  marketing: "Marketing",
  design:    "Design",
  analytics: "Analytics",
  learning:  "Learning",
  memory:    "Memory",
  system:    "System",
};

function formatDuration(ms: number | undefined): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function StatusIcon({ status }: { status: ActivityEvent["status"] }) {
  if (status === "completed") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
  if (status === "failed")    return <XCircle      className="h-3.5 w-3.5 text-red-500 shrink-0" />;
  if (status === "skipped")   return <SkipForward  className="h-3.5 w-3.5 text-gray-400 shrink-0" />;
  return <Loader2 className="h-3.5 w-3.5 text-orange-400 animate-spin shrink-0" />;
}

/* ─── Component ──────────────────────────────────────────────────────────────── */

export function CompanyActivityFeed({ launchId, live = false }: Props) {
  const [events,   setEvents]   = useState<ActivityEvent[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<AutonomousDepartment | "all">("all");

  const load = useCallback(async () => {
    try {
      const dept = filter !== "all" ? `&department=${filter}` : "";
      const res  = await fetch(`/api/projects/${launchId}/activity?limit=100${dept}`);
      const data = await res.json() as { events: ActivityEvent[]; total: number };
      setEvents(data.events ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [launchId, filter]);

  useEffect(() => { void load(); }, [load]);

  // Live polling
  useEffect(() => {
    if (!live) return;
    const interval = setInterval(() => { void load(); }, 5000);
    return () => clearInterval(interval);
  }, [live, load]);

  const DEPTS: Array<AutonomousDepartment | "all"> = [
    "all", "research", "marketing", "analytics", "learning", "memory", "system",
  ];

  if (loading) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] dark:border-[#1E1E1E] bg-white dark:bg-[#111] p-5 animate-pulse">
        <div className="h-5 w-40 bg-gray-200 dark:bg-gray-800 rounded mb-4" />
        <div className="space-y-3">
          {[0,1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#E5E7EB] dark:border-[#1E1E1E] bg-white dark:bg-[#111] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#F0F0F0] dark:border-[#1E1E1E]">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Company Activity</span>
          <span className="text-[10px] text-gray-400">({total} events)</span>
        </div>
        {live && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        )}
        <button
          onClick={() => void load()}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Dept filter */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[#F0F0F0] dark:border-[#1E1E1E] overflow-x-auto">
        {DEPTS.map(dept => (
          <button
            key={dept}
            onClick={() => setFilter(dept)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
              filter === dept
                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {dept !== "all" && (
              <span className={`h-1.5 w-1.5 rounded-full ${DEPT_DOT[dept as AutonomousDepartment]}`} />
            )}
            {dept === "all" ? "All" : DEPT_LABEL[dept as AutonomousDepartment]}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="p-4">
        {events.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="h-8 w-8 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No activity yet. Run a cycle to see your AI company in action.
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {events.map((event, i) => (
              <div
                key={event.id}
                className={`flex items-start gap-3 py-2.5 ${
                  i < events.length - 1 ? "border-b border-[#F5F5F5] dark:border-[#1A1A1A]" : ""
                }`}
              >
                {/* Dept dot */}
                <div className="flex flex-col items-center mt-1.5">
                  <span className={`h-2 w-2 rounded-full ${DEPT_DOT[event.department]}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={event.status} />
                    <p className="text-xs text-gray-800 dark:text-gray-200 font-medium truncate">
                      {event.action}
                    </p>
                  </div>
                  {event.detail && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                      {event.detail}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      DEPT_DOT[event.department].replace("bg-", "text-").replace("-400", "-600")
                    } bg-gray-100 dark:bg-gray-800`}>
                      {DEPT_LABEL[event.department]}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatTime(event.timestamp)}</span>
                    {event.durationMs && (
                      <span className="text-[10px] text-gray-400">{formatDuration(event.durationMs)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
