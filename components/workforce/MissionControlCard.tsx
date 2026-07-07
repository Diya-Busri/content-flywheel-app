"use client";

/**
 * MissionControlCard
 * ──────────────────────────────────────────────────────────────────────────────
 * CEO AI card that sits at the top of every Project dashboard.
 *
 * Answers three strategic questions:
 *   1. What happened?         → briefing.yesterday
 *   2. What is happening now? → current focus + mission
 *   3. What should happen next? → today's assigned tasks
 *
 * Execution flow (Execute All Tasks):
 *   For each pending task → PATCH status=running → POST worker run with instruction
 *   → PATCH status=done/pending-on-error. Sequential, one worker at a time.
 */

import { useState, useEffect, useCallback } from "react";
import { Loader2, Play, RefreshCw, CheckCircle2, X, Clock, Zap, Target, ArrowRight, Upload, BarChart2, BookOpen, Trophy, TrendingUp, Lightbulb, FlaskConical, Edit3, TrendingDown, Compass, Megaphone, Package, Repeat2, MessageCircle } from "lucide-react";
import type { MissionControlData, MissionPlan, MissionTask, MissionFocus, MarketingDepartment, AnalyticsDepartment, GrowthTask, GrowthTaskType } from "@/db/schema/launch-schema";
import { LearningCard } from "@/components/analytics/AnalyticsDepartment";

/* ─── Props ──────────────────────────────────────────────────────────────────── */

interface Props {
  launchId: string;
}

/* ─── Constants ──────────────────────────────────────────────────────────────── */

const FOCUS_LABELS: Record<MissionFocus, string> = {
  launch:        "Launch",
  growth:        "Growth",
  optimisation:  "Optimisation",
  scaling:       "Scaling",
  maintenance:   "Maintenance",
};

const FOCUS_COLORS: Record<MissionFocus, { bg: string; text: string; dot: string }> = {
  launch:       { bg: "bg-blue-500/10",   text: "text-blue-400",   dot: "bg-blue-400" },
  growth:       { bg: "bg-green-500/10",  text: "text-green-400",  dot: "bg-green-400" },
  optimisation: { bg: "bg-amber-500/10",  text: "text-amber-400",  dot: "bg-amber-400" },
  scaling:      { bg: "bg-purple-500/10", text: "text-purple-400", dot: "bg-purple-400" },
  maintenance:  { bg: "bg-slate-500/10",  text: "text-slate-400",  dot: "bg-slate-400" },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  high:   { bg: "bg-red-500/10",    text: "text-red-400"    },
  medium: { bg: "bg-amber-500/10",  text: "text-amber-400"  },
  low:    { bg: "bg-slate-500/10",  text: "text-slate-400"  },
};

const WORKER_EMOJIS: Record<string, string> = {
  research:  "🔍",
  product:   "📦",
  design:    "🎨",
  marketing: "📣",
  store:     "🛍️",
  growth:    "📈",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ─── Sub-components ─────────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: MissionTask["status"] }) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-500/10 text-green-400">
        <CheckCircle2 className="w-2.5 h-2.5" /> Done
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-500/10 text-orange-400">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" /> Running
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-500/10 text-slate-400">
        <X className="w-2.5 h-2.5" /> Skipped
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-muted/30 text-muted-foreground/50">
      Pending
    </span>
  );
}

interface TaskRowProps {
  task:      MissionTask;
  isActive:  boolean;
  onSkip:    (id: string) => void;
  disabled:  boolean;
}

function TaskRow({ task, isActive, onSkip, disabled }: TaskRowProps) {
  const pColor = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.low;

  return (
    <div className={[
      "flex items-start gap-3 px-4 py-3 transition-colors",
      isActive ? "bg-orange-500/[0.05]" : "",
    ].join(" ")}>
      {/* Worker emoji */}
      <span className="text-base shrink-0 mt-0.5">{WORKER_EMOJIS[task.workerId] ?? "🤖"}</span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <p className="text-[12px] font-bold text-foreground">{task.workerLabel}</p>
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${pColor.bg} ${pColor.text}`}>
            {task.priority}
          </span>
          <StatusBadge status={task.status} />
        </div>
        <p className="text-[11px] text-muted-foreground/70 leading-relaxed">{task.instruction}</p>
        <p className="text-[10px] text-muted-foreground/40 mt-0.5">{task.reason}</p>
      </div>

      {/* Skip button */}
      {task.status === "pending" && !disabled && (
        <button
          onClick={() => onSkip(task.id)}
          className="shrink-0 text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors mt-1"
          title="Skip this task"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/* ─── Pipeline Status sub-component ─────────────────────────────────────────── */

interface PipelineStatusProps {
  launchId: string;
}

type PipelineStats = {
  pendingApproval: number;
  publishedToday:  number;
  analysedToday:   number;
  totalLessons:    number;
  bestWin?:        string;
  biggestProblem?: string;
};

function PipelineStatus({ launchId }: PipelineStatusProps) {
  const [stats,   setStats]   = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [mktRes, anlRes] = await Promise.all([
          fetch(`/api/projects/${launchId}/marketing-dept`),
          fetch(`/api/projects/${launchId}/analytics`),
        ]);
        const mkt = await mktRes.json()  as { marketingDept: MarketingDepartment | null };
        const anl = await anlRes.json()  as { analyticsDept: AnalyticsDepartment | null };

        const dept    = mkt.marketingDept;
        const anlDept = anl.analyticsDept;

        const todayStr = new Date().toISOString().slice(0, 10);

        // Queue: items waiting for approval across all managers
        let pendingApproval = 0;
        let publishedToday  = 0;
        if (dept) {
          for (const mgr of Object.values(dept.managers)) {
            if (!mgr) continue;
            pendingApproval += (mgr.publishQueue ?? []).filter(q => q.status === "queued").length;
            publishedToday  += (mgr.publishedItems ?? []).filter(p => p.publishedAt.startsWith(todayStr)).length;
          }
        }

        // Analytics
        const analysedToday = anlDept?.posts.filter(
          p => p.analysedAt?.startsWith(todayStr),
        ).length ?? 0;
        const totalLessons  = anlDept?.lessons?.length ?? 0;

        // Latest report highlights
        const latestReport = anlDept?.reports?.[0];
        const bestWin      = latestReport?.biggestWin?.reason ?? undefined;
        const biggestProblem = latestReport?.biggestProblem?.description ?? undefined;

        setStats({ pendingApproval, publishedToday, analysedToday, totalLessons, bestWin, biggestProblem });
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, [launchId]);

  if (loading) {
    return (
      <div className="px-5 py-3 border-b border-border/20">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/30">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading pipeline status…
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const statItems = [
    {
      icon: <Upload className="w-3.5 h-3.5" />,
      label: "Pending approval",
      value: stats.pendingApproval,
      color: stats.pendingApproval > 0 ? "text-orange-400" : "text-muted-foreground/40",
      bg:    stats.pendingApproval > 0 ? "bg-orange-500/10" : "bg-muted/10",
    },
    {
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      label: "Published today",
      value: stats.publishedToday,
      color: stats.publishedToday > 0 ? "text-green-400" : "text-muted-foreground/40",
      bg:    stats.publishedToday > 0 ? "bg-green-500/10" : "bg-muted/10",
    },
    {
      icon: <BarChart2 className="w-3.5 h-3.5" />,
      label: "Analysed today",
      value: stats.analysedToday,
      color: stats.analysedToday > 0 ? "text-blue-400" : "text-muted-foreground/40",
      bg:    stats.analysedToday > 0 ? "bg-blue-500/10" : "bg-muted/10",
    },
    {
      icon: <BookOpen className="w-3.5 h-3.5" />,
      label: "Total lessons",
      value: stats.totalLessons,
      color: stats.totalLessons > 0 ? "text-purple-400" : "text-muted-foreground/40",
      bg:    stats.totalLessons > 0 ? "bg-purple-500/10" : "bg-muted/10",
    },
  ];

  return (
    <div className="px-5 py-3 border-b border-border/20">
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2">
        Pipeline Status
      </p>
      <div className="grid grid-cols-4 gap-2">
        {statItems.map(item => (
          <div key={item.label} className={`rounded-lg p-2 ${item.bg}`}>
            <div className={`flex items-center gap-1 mb-1 ${item.color}`}>
              {item.icon}
            </div>
            <p className={`text-[16px] font-bold leading-none ${item.color}`}>{item.value}</p>
            <p className="text-[9px] text-muted-foreground/40 mt-0.5 leading-tight">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Best win / biggest problem */}
      {(stats.bestWin || stats.biggestProblem) && (
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {stats.bestWin && (
            <div className="flex items-start gap-1.5 rounded-lg bg-green-500/5 border border-green-500/10 px-2.5 py-2">
              <Trophy className="w-3 h-3 text-green-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wide text-green-400/70">Best win</p>
                <p className="text-[10px] text-muted-foreground/60 leading-snug">{stats.bestWin.slice(0, 80)}</p>
              </div>
            </div>
          )}
          {stats.biggestProblem && (
            <div className="flex items-start gap-1.5 rounded-lg bg-red-500/5 border border-red-500/10 px-2.5 py-2">
              <Zap className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wide text-red-400/70">Opportunity</p>
                <p className="text-[10px] text-muted-foreground/60 leading-snug">{stats.biggestProblem.slice(0, 80)}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Growth Tasks Strip ─────────────────────────────────────────────────────── */

const GROWTH_TYPE_ICONS: Partial<Record<GrowthTaskType, React.ReactNode>> = {
  content_idea:    <Lightbulb className="w-3 h-3" />,
  ab_test:         <FlaskConical className="w-3 h-3" />,
  improve_copy:    <Edit3 className="w-3 h-3" />,
  fix_declining:   <TrendingDown className="w-3 h-3" />,
  new_opportunity: <Compass className="w-3 h-3" />,
  campaign:        <Megaphone className="w-3 h-3" />,
  product_improve: <Package className="w-3 h-3" />,
  repost:          <Repeat2 className="w-3 h-3" />,
  engagement:      <MessageCircle className="w-3 h-3" />,
};

function GrowthTasksStrip({ launchId }: { launchId: string }) {
  const [tasks,   setTasks]   = useState<GrowthTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${launchId}/growth`)
      .then(r => r.json())
      .then((d: { tasks?: GrowthTask[] }) => { setTasks(d.tasks ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [launchId]);

  if (loading) return null;

  const active   = tasks.filter(t => t.status === "pending" || t.status === "in_progress");
  const critical = active.filter(t => t.priority === "critical");
  const high     = active.filter(t => t.priority === "high");
  const topTasks = [...critical, ...high].slice(0, 3);

  if (!topTasks.length) return null;

  return (
    <div className="px-5 py-3 border-b border-border/20">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="w-3 h-3 text-green-400 shrink-0" />
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
          Growth Tasks
        </p>
        <div className="flex items-center gap-1 ml-auto">
          {critical.length > 0 && (
            <span className="text-[9px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full">
              {critical.length} critical
            </span>
          )}
          {high.length > 0 && (
            <span className="text-[9px] font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded-full">
              {high.length} high
            </span>
          )}
          {active.length > 3 && (
            <span className="text-[9px] text-muted-foreground/40">
              +{active.length - 3} more
            </span>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        {topTasks.map(task => (
          <div key={task.id} className="flex items-center gap-2">
            <div className={[
              "w-5 h-5 rounded flex items-center justify-center shrink-0",
              task.priority === "critical" ? "bg-red-500/10 text-red-400"
              : "bg-orange-500/10 text-orange-400",
            ].join(" ")}>
              {GROWTH_TYPE_ICONS[task.type] ?? <TrendingUp className="w-3 h-3" />}
            </div>
            <p className="flex-1 text-[11px] text-foreground/80 leading-snug truncate">{task.title}</p>
            <span className={[
              "text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0",
              task.priority === "critical" ? "bg-red-500/10 text-red-400" : "bg-orange-500/10 text-orange-400",
            ].join(" ")}>
              {task.priority}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

export function MissionControlCard({ launchId }: Props) {
  const [mc,           setMc]           = useState<MissionControlData | null>(null);
  const [loadState,    setLoadState]    = useState<"idle" | "loading" | "generating" | "error">("loading");
  const [executing,    setExecuting]    = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  /* ── Fetch existing MC data ─────────────────────────────────────────────── */
  const fetchMC = useCallback(async () => {
    try {
      const res  = await fetch(`/api/projects/${launchId}/mission-control`);
      const json = await res.json() as { missionControl: MissionControlData | null };
      return json.missionControl;
    } catch {
      return null;
    }
  }, [launchId]);

  /* ── Generate/refresh plan ──────────────────────────────────────────────── */
  const generatePlan = useCallback(async (force = false) => {
    setLoadState("generating");
    try {
      const res  = await fetch(`/api/projects/${launchId}/mission-control/run`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ force }),
      });
      const json = await res.json() as { missionControl: MissionControlData };
      setMc(json.missionControl);
      setLoadState("idle");
    } catch {
      setLoadState("error");
    }
  }, [launchId]);

  /* ── On mount: fetch, then auto-generate if stale ───────────────────────── */
  useEffect(() => {
    (async () => {
      const existing = await fetchMC();
      if (existing) {
        setMc(existing);
        /* Auto-regenerate if plan is from a previous day */
        if (!existing.currentPlan || existing.currentPlan.date !== today()) {
          await generatePlan(false);
        } else {
          setLoadState("idle");
        }
      } else {
        await generatePlan(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchId]);

  /* ── Patch task status ──────────────────────────────────────────────────── */
  const patchTask = useCallback(async (taskId: string, status: MissionTask["status"]) => {
    await fetch(`/api/projects/${launchId}/mission-control/tasks`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ taskId, status }),
    });
    setMc(prev => {
      if (!prev?.currentPlan) return prev;
      const now = new Date().toISOString();
      return {
        ...prev,
        currentPlan: {
          ...prev.currentPlan,
          tasks: prev.currentPlan.tasks.map(t =>
            t.id === taskId
              ? { ...t, status, completedAt: status === "done" || status === "skipped" ? now : t.completedAt }
              : t
          ),
        },
      };
    });
  }, [launchId]);

  /* ── Skip a task ────────────────────────────────────────────────────────── */
  const skipTask = useCallback(async (taskId: string) => {
    await patchTask(taskId, "skipped");
  }, [patchTask]);

  /* ── Execute all pending tasks sequentially ─────────────────────────────── */
  const executeAll = useCallback(async () => {
    if (!mc?.currentPlan || executing) return;
    const pending = mc.currentPlan.tasks.filter(t => t.status === "pending");
    if (!pending.length) return;

    setExecuting(true);
    for (const task of pending) {
      setActiveTaskId(task.id);
      await patchTask(task.id, "running");
      try {
        const res = await fetch(
          `/api/projects/${launchId}/workforce/${task.workerId}/run`,
          {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ instruction: task.instruction }),
          },
        );
        if (!res.ok) throw new Error(`Worker failed: ${res.status}`);
        await patchTask(task.id, "done");
      } catch {
        await patchTask(task.id, "pending");
      }
    }
    setActiveTaskId(null);
    setExecuting(false);
    /* Refresh MC data to reflect completed tasks */
    const fresh = await fetchMC();
    if (fresh) setMc(fresh);
  }, [mc, executing, launchId, patchTask, fetchMC]);

  /* ── Render ─────────────────────────────────────────────────────────────── */

  if (loadState === "loading" || (loadState === "generating" && !mc)) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/60 p-5 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
            <Target className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50">
              Mission Control
            </p>
            <p className="text-[12px] text-muted-foreground/60 mt-0.5 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {loadState === "generating" ? "CEO AI is reviewing your business…" : "Loading…"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loadState === "error" && !mc) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] p-5 mb-5">
        <p className="text-[12px] text-muted-foreground/60 mb-2">Could not load Mission Control.</p>
        <button
          onClick={() => generatePlan(true)}
          className="text-[11px] font-semibold text-orange-500 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const plan     = mc?.currentPlan;
  const briefing = mc?.briefing;
  const focus    = mc?.focus ?? plan?.focus;
  const focusStyle = focus ? (FOCUS_COLORS[focus] ?? FOCUS_COLORS.growth) : FOCUS_COLORS.growth;

  const pendingCount = plan?.tasks.filter(t => t.status === "pending").length ?? 0;
  const doneCount    = plan?.tasks.filter(t => t.status === "done").length ?? 0;
  const allDone      = plan ? pendingCount === 0 && doneCount > 0 : false;

  return (
    <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-b from-orange-500/[0.03] to-card/60 overflow-hidden mb-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
            <Target className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500/70">
              Mission Control
            </p>
            {focus && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${focusStyle.bg} ${focusStyle.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${focusStyle.dot}`} />
                  {FOCUS_LABELS[focus]} Mode
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mc?.lastRunAt && (
            <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {relTime(mc.lastRunAt)}
            </span>
          )}
          <button
            onClick={() => generatePlan(true)}
            disabled={loadState === "generating" || executing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-muted-foreground/60 hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-40"
            title="Re-plan"
          >
            {loadState === "generating"
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <RefreshCw className="w-3 h-3" />}
            Re-plan
          </button>
        </div>
      </div>

      {/* ── Briefing ── */}
      {briefing && (
        <div className="px-5 pb-4 border-b border-border/30">
          <p className="text-[13px] font-semibold text-foreground mb-3 leading-snug">
            {briefing.greeting}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* What happened? */}
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-1.5">
                What happened
              </p>
              <ul className="space-y-1">
                {briefing.yesterday.slice(0, 3).map((item, i) => (
                  <li key={i} className="text-[10px] text-muted-foreground/60 flex items-start gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-green-500/60 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* What's happening now? */}
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-1.5">
                Happening now
              </p>
              <ul className="space-y-1">
                {briefing.today.slice(0, 2).map((item, i) => (
                  <li key={i} className="text-[10px] text-muted-foreground/60 flex items-start gap-1.5">
                    <ArrowRight className="w-3 h-3 text-orange-400/60 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* What's next? */}
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-1.5">
                What's next
              </p>
              {plan && (
                <div>
                  <p className="text-[10px] font-semibold text-foreground">{plan.mission}</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">{plan.missionReason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Pipeline Status ── */}
      <PipelineStatus launchId={launchId} />

      {/* ── Learning Card ── */}
      <div className="px-5 py-3 border-b border-border/20">
        <LearningCard launchId={launchId} />
      </div>

      {/* ── Growth Tasks ── */}
      <GrowthTasksStrip launchId={launchId} />

      {/* ── Tasks ── */}
      {plan && (
        <>
          <div className="px-5 py-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                Today&apos;s assigned tasks
              </p>
              {plan.focusReason && (
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">{plan.focusReason}</p>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40 shrink-0">
              <span>{doneCount}/{plan.tasks.length} done</span>
              {plan.estimatedMinutes > 0 && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    ~{plan.estimatedMinutes}min
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="border-t border-border/30 divide-y divide-border/20">
            {plan.tasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                isActive={activeTaskId === task.id}
                onSkip={skipTask}
                disabled={executing}
              />
            ))}
          </div>

          {/* ── Execute All / Done state ── */}
          <div className="px-5 py-4 border-t border-border/30">
            {allDone ? (
              <div className="flex items-center gap-2 text-[12px] text-green-400 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                All tasks complete. Excellent work today.
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={executeAll}
                  disabled={executing || pendingCount === 0}
                  className={[
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all",
                    executing || pendingCount === 0
                      ? "bg-muted/20 text-muted-foreground/40 cursor-not-allowed"
                      : "bg-orange-500 text-white hover:bg-orange-600 shadow-[0_0_20px_rgba(249,115,22,0.3)]",
                  ].join(" ")}
                >
                  {executing
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Running workers…</>
                    : <><Zap className="w-4 h-4" /> Execute All Tasks</>}
                </button>
                {pendingCount > 0 && !executing && (
                  <p className="text-[11px] text-muted-foreground/50">
                    {pendingCount} task{pendingCount !== 1 ? "s" : ""} pending
                  </p>
                )}
                {plan.estimatedImpact && !executing && (
                  <p className="text-[10px] text-muted-foreground/40 ml-auto text-right hidden sm:block max-w-xs">
                    {plan.estimatedImpact}
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Empty / no plan ── */}
      {!plan && loadState === "idle" && (
        <div className="px-5 pb-5">
          <p className="text-[12px] text-muted-foreground/50 mb-3">
            No plan yet. Generate your first daily business review.
          </p>
          <button
            onClick={() => generatePlan(true)}
            disabled={loadState === "generating"}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors"
          >
            <Play className="w-4 h-4" />
            Run Mission Control
          </button>
        </div>
      )}

    </div>
  );
}
