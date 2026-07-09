/**
 * GrowthDashboard — Phase 2.2
 * ──────────────────────────────────────────────────────────────────────────────
 * The AI growth operator panel for a project.
 * Auto-triggers a daily check on mount if >23h since last check.
 *
 * Shows:
 *  1. Status bar — health score + "Here's what I worked on while you were away"
 *  2. Business Goal — picker + progress bar
 *  3. Daily Checks — 6 system checks with ok/warning/missing status
 *  4. AI Tasks — specific pending work, mark done/skip
 *  5. Growth Feed — chronological observations
 *  6. Next Action — single highest-priority recommendation
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity, Loader2, RefreshCw, CheckCircle2, AlertTriangle,
  XCircle, ArrowRight, Target, Zap, ChevronDown, ChevronUp,
  Check, X, Clock, TrendingUp, Flag,
} from "lucide-react";
import type { GrowthData, GrowthAITask, ProjectGoal } from "@/db/schema/launch-schema";
import { GrowthModePanel } from "./GrowthModePanel";

/* ─── Props ─────────────────────────────────────────────────────────────────── */

interface GrowthDashboardProps {
  launchId:    string;
  initialData: GrowthData | undefined;
  productId:   string;
}

/* ─── Goal options ───────────────────────────────────────────────────────────── */

const GOAL_OPTIONS: Array<{
  type: ProjectGoal["type"]; label: string; target: number; unit: ProjectGoal["unit"];
}> = [
  { type: "first_sale",     label: "First Sale",        target: 1,    unit: "sales"       },
  { type: "10_sales",       label: "10 Sales",           target: 10,   unit: "sales"       },
  { type: "100_customers",  label: "100 Customers",      target: 100,  unit: "customers"   },
  { type: "100_revenue",    label: "£100 Revenue",       target: 100,  unit: "revenue_gbp" },
  { type: "1000_revenue",   label: "£1,000 Revenue",     target: 1000, unit: "revenue_gbp" },
  { type: "1000_visitors",  label: "1,000 Visitors",     target: 1000, unit: "visitors"    },
];

/* ─── Loading messages ───────────────────────────────────────────────────────── */

const LOADING_MESSAGES = [
  "Checking store status…",
  "Reviewing content pipeline…",
  "Scanning for SEO gaps…",
  "Analysing marketing coverage…",
  "Generating AI tasks…",
  "Building growth recommendations…",
];

/* ─── Status icon ────────────────────────────────────────────────────────────── */

function StatusIcon({ status }: { status: "ok" | "warning" | "missing" }) {
  if (status === "ok")      return <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />;
  if (status === "warning") return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
  return <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
}

/* ─── Category icon ──────────────────────────────────────────────────────────── */

const CATEGORY_COLORS: Record<GrowthAITask["category"], string> = {
  content:  "bg-pink-500/10 text-pink-400",
  seo:      "bg-emerald-500/10 text-emerald-400",
  store:    "bg-orange-500/10 text-orange-400",
  marketing:"bg-blue-500/10 text-blue-400",
  product:  "bg-purple-500/10 text-purple-400",
  analysis: "bg-amber-500/10 text-amber-400",
};

const PRIORITY_DOT: Record<"high"|"medium"|"low", string> = {
  high:   "bg-red-400",
  medium: "bg-amber-400",
  low:    "bg-muted-foreground/30",
};

/* ─── Health ring ────────────────────────────────────────────────────────────── */

function HealthRing({ score }: { score: number }) {
  const r    = 16;
  const circ = 2 * Math.PI * r;
  const off  = circ - (score / 100) * circ;
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f97316" : "#f87171";
  return (
    <div className="relative w-10 h-10 shrink-0">
      <svg className="-rotate-90 w-10 h-10" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={r} fill="none" stroke="currentColor" className="text-muted/20" strokeWidth="4" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[9px] font-black" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

export function GrowthDashboard({ launchId, initialData, productId }: GrowthDashboardProps) {
  const [data,       setData]       = useState<GrowthData>(initialData ?? {});
  const [status,     setStatus]     = useState<"idle"|"loading"|"complete"|"error">(
    initialData?.report ? "complete" : "idle"
  );
  const [msgIdx,     setMsgIdx]     = useState(0);
  const [error,      setError]      = useState<string|null>(null);
  const [tasksOpen,  setTasksOpen]  = useState(true);
  const [checksOpen, setChecksOpen] = useState(false);
  const [feedOpen,   setFeedOpen]   = useState(false);
  const [goalPicker, setGoalPicker] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);

  /* Auto-run if stale or never run */
  useEffect(() => {
    const lastChecked = initialData?.lastCheckedAt;
    const age = lastChecked ? Date.now() - new Date(lastChecked).getTime() : Infinity;
    if (age > 23 * 60 * 60 * 1000) {
      void runCheck(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Cycle loading messages */
  useEffect(() => {
    if (status !== "loading") return;
    const t = setInterval(() => setMsgIdx(i => (i + 1) % LOADING_MESSAGES.length), 2500);
    return () => clearInterval(t);
  }, [status]);

  const runCheck = useCallback(async (force = true) => {
    setStatus("loading");
    setError(null);
    setMsgIdx(0);
    try {
      const res = await fetch(`/api/projects/${launchId}/growth-check`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ force }),
      });
      if (!res.ok) throw new Error("Growth check failed");
      const json = await res.json() as { growth: GrowthData };
      setData(json.growth);
      setStatus("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  }, [launchId]);

  const markTask = useCallback(async (taskId: string, s: "done"|"skipped") => {
    setData(prev => ({
      ...prev,
      aiTasks: (prev.aiTasks ?? []).map(t => t.id === taskId ? { ...t, status: s } : t),
    }));
    await fetch(`/api/projects/${launchId}/tasks`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ taskId, status: s }),
    }).catch(() => {});
  }, [launchId]);

  const saveGoal = useCallback(async (option: typeof GOAL_OPTIONS[number]) => {
    setSavingGoal(true);
    try {
      const goal: ProjectGoal = { ...option, current: 0 };
      const res = await fetch(`/api/projects/${launchId}/goal`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(goal),
      });
      if (res.ok) {
        setData(prev => ({ ...prev, goal }));
        setGoalPicker(false);
      }
    } finally {
      setSavingGoal(false);
    }
  }, [launchId]);

  /* Derived */
  const pendingTasks  = (data.aiTasks ?? []).filter(t => t.status === "pending");
  const doneTasks     = (data.aiTasks ?? []).filter(t => t.status !== "pending");
  const lastChecked   = data.lastCheckedAt
    ? new Date(data.lastCheckedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : null;

  /* ── Loading ── */
  if (status === "loading") {
    return (
      <div className="mt-5">
        <GrowthHeader />
        <div className="rounded-2xl border border-green-500/20 bg-green-500/[0.03] p-6 flex flex-col items-center gap-3 text-center">
          <Activity className="w-6 h-6 text-green-400 animate-pulse" />
          <p className="text-[13px] font-bold text-foreground">Running daily check…</p>
          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-muted/30">
            <Loader2 className="w-3 h-3 text-green-400 animate-spin shrink-0" />
            <span className="text-[11px] text-foreground/70">{LOADING_MESSAGES[msgIdx]}</span>
          </div>
          <p className="text-[10px] text-muted-foreground/40">Usually takes 10–15 seconds</p>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (status === "error") {
    return (
      <div className="mt-5">
        <GrowthHeader />
        <div className="rounded-2xl border border-red-500/20 p-5 flex items-center gap-4">
          <XCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="flex-1 text-[12px] text-muted-foreground/70">{error}</p>
          <button onClick={() => void runCheck(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/40 hover:bg-muted/60 text-[11px] font-semibold transition-colors">
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const { report, aiTasks, feed, goal } = data;

  return (
    <div className="mt-5 space-y-4">

      <GrowthHeader onRerun={() => void runCheck(true)} lastChecked={lastChecked} />

      {/* ── Status bar ── */}
      {report && (
        <div className="rounded-2xl border border-green-500/20 bg-green-500/[0.03] p-4">
          <div className="flex items-start gap-4">
            <HealthRing score={report.healthScore} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[12px] font-black text-foreground">Business Health</p>
                {pendingTasks.length > 0 && (
                  <span className="text-[10px] font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded-full">
                    {pendingTasks.length} tasks pending
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground/70 leading-snug">{report.summary}</p>
            </div>
          </div>

          {/* Next Action */}
          {report.nextAction && (
            <a
              href={report.nextAction.href}
              className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="flex-1 text-[12px] font-bold text-white">{report.nextAction.label}</span>
              <ArrowRight className="w-3 h-3 text-white/70 shrink-0" />
            </a>
          )}
        </div>
      )}

      {/* ── Business Goal ── */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <p className="text-[12px] font-black text-foreground">Business Goal</p>
          </div>
          <button
            onClick={() => setGoalPicker(v => !v)}
            className="text-[10px] font-semibold text-orange-500 hover:underline"
          >
            {goal ? "Change" : "Set Goal"}
          </button>
        </div>

        {goal ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold text-foreground">{goal.label}</p>
              <p className="text-[11px] text-muted-foreground/60">
                {goal.current} / {goal.target} {goal.unit.replace("_", " ")}
              </p>
            </div>
            <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-green-500 transition-all duration-700"
                style={{ width: `${Math.min((goal.current / goal.target) * 100, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground/50">
              {goal.current === 0
                ? "The AI is building toward your first milestone."
                : `${Math.round((goal.current / goal.target) * 100)}% of the way there.`
              }
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground/50 italic">
            Set a goal so the AI can prioritise work toward it.
          </p>
        )}

        {/* Goal picker */}
        {goalPicker && (
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {GOAL_OPTIONS.map(opt => (
              <button
                key={opt.type}
                disabled={savingGoal}
                onClick={() => void saveGoal(opt)}
                className={[
                  "text-left px-3 py-2 rounded-xl border text-[11px] font-semibold transition-colors",
                  goal?.type === opt.type
                    ? "border-orange-500/40 bg-orange-500/10 text-orange-500"
                    : "border-border/40 bg-muted/20 text-foreground hover:border-orange-500/30 hover:bg-orange-500/[0.05]",
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── AI Tasks ── */}
      {(aiTasks ?? []).length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden">
          <button
            onClick={() => setTasksOpen(v => !v)}
            className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/20 transition-colors"
          >
            <Activity className="w-3.5 h-3.5 text-green-400 shrink-0" />
            <p className="flex-1 text-left text-[12px] font-black text-foreground">
              AI Tasks
            </p>
            <span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full">
              {pendingTasks.length} pending
            </span>
            {tasksOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/40" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40" />}
          </button>

          {tasksOpen && (
            <div className="border-t border-border/30 divide-y divide-border/20">
              {pendingTasks.map(task => (
                <TaskRow key={task.id} task={task} onMark={markTask} />
              ))}
              {doneTasks.length > 0 && (
                <div className="px-4 py-2">
                  <p className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider">
                    {doneTasks.length} completed / skipped
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Daily checks ── */}
      {report?.checks && report.checks.length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden">
          <button
            onClick={() => setChecksOpen(v => !v)}
            className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/20 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
            <p className="flex-1 text-left text-[12px] font-black text-foreground">Daily Checks</p>
            <span className="text-[10px] text-muted-foreground/40">
              {report.checks.filter(c => c.status === "ok").length}/{report.checks.length} passing
            </span>
            {checksOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/40" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40" />}
          </button>

          {checksOpen && (
            <div className="border-t border-border/30 divide-y divide-border/20">
              {report.checks.map(check => (
                <div key={check.id} className="flex items-start gap-3 px-4 py-2.5">
                  <StatusIcon status={check.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-foreground">{check.label}</p>
                    {check.detail && (
                      <p className="text-[10px] text-muted-foreground/50 leading-snug mt-0.5">{check.detail}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Growth Feed ── */}
      {(feed ?? []).length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden">
          <button
            onClick={() => setFeedOpen(v => !v)}
            className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/20 transition-colors"
          >
            <TrendingUp className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
            <p className="flex-1 text-left text-[12px] font-black text-foreground">Growth Feed</p>
            <span className="text-[10px] text-muted-foreground/40">{feed?.length} updates</span>
            {feedOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/40" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40" />}
          </button>

          {feedOpen && (
            <div className="border-t border-border/30 divide-y divide-border/20">
              {(feed ?? []).map(item => (
                <div key={item.id} className="flex items-start gap-3 px-4 py-2.5">
                  <span className="text-base shrink-0 leading-none mt-0.5">{item.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-foreground leading-snug">{item.text}</p>
                    {item.detail && (
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5 leading-snug">{item.detail}</p>
                    )}
                  </div>
                  <p className="text-[9px] text-muted-foreground/30 shrink-0 tabular-nums">
                    {new Date(item.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Phase 6: Autonomous Growth Tasks ── */}
      <GrowthModePanel launchId={launchId} />

    </div>
  );
}

/* ─── Task row ───────────────────────────────────────────────────────────────── */

function TaskRow({
  task, onMark,
}: {
  task: GrowthAITask;
  onMark: (id: string, s: "done"|"skipped") => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const handle = async (s: "done"|"skipped") => {
    setBusy(true);
    await onMark(task.id, s);
    setBusy(false);
  };

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className={`inline-flex shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${CATEGORY_COLORS[task.category]}`}>
        {task.category}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[task.priority]}`} />
          <p className="text-[11px] font-bold text-foreground leading-snug">{task.title}</p>
        </div>
        <p className="text-[10px] text-muted-foreground/60 leading-snug">{task.detail}</p>
        {task.actionHref && (
          <a href={task.actionHref} className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-orange-500 hover:underline">
            Start task <ArrowRight className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          disabled={busy}
          onClick={() => void handle("done")}
          title="Mark done"
          className="w-6 h-6 rounded-lg bg-green-500/10 hover:bg-green-500/20 flex items-center justify-center transition-colors"
        >
          <Check className="w-3 h-3 text-green-500" />
        </button>
        <button
          disabled={busy}
          onClick={() => void handle("skipped")}
          title="Skip"
          className="w-6 h-6 rounded-lg bg-muted/30 hover:bg-muted/50 flex items-center justify-center transition-colors"
        >
          <X className="w-3 h-3 text-muted-foreground/50" />
        </button>
      </div>
    </div>
  );
}

/* ─── Section header ─────────────────────────────────────────────────────────── */

function GrowthHeader({ onRerun, lastChecked }: { onRerun?: () => void; lastChecked?: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <Activity className="w-4 h-4 text-green-400 shrink-0" />
      <h2 className="text-[14px] font-black tracking-tight text-foreground">Growth Mode</h2>
      <div className="flex-1 h-px bg-border/30" />
      {lastChecked && (
        <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1">
          <Clock className="w-3 h-3" /> {lastChecked}
        </span>
      )}
      {onRerun && (
        <button
          onClick={onRerun}
          className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Re-check
        </button>
      )}
    </div>
  );
}
