"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Cpu, Target, TrendingUp, AlertTriangle, Lightbulb, Zap,
  BarChart2, Brain, FlaskConical, Search, Package, Pencil,
  Plus, X, Loader2, Check, RefreshCw, ChevronRight, ArrowRight,
  Bot, Activity, Clock, Star, Circle,
} from "lucide-react";
import { Input } from "@/components/ui/input";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HealthDimension {
  key: string;
  name: string;
  score: number;
  label: string;
  description: string;
}

interface BusinessHealthScore {
  overall: number;
  grade: "A" | "B" | "C" | "D" | "F";
  dimensions: HealthDimension[];
  lastCalculatedAt: string;
}

interface OrchestratorDecision {
  id: string;
  title: string;
  description: string | null;
  reasoning: string | null;
  priority: number;
  goalAlignment: string | null;
  isActioned: boolean;
  createdAt: string;
}

interface OrchestratorState {
  healthScore: BusinessHealthScore;
  decisions: OrchestratorDecision[];
  lastRunAt: string | null;
  hoursUntilNextRun: number;
}

interface BusinessGoal {
  id: string;
  goalType: string;
  title: string;
  target: number;
  current: number;
  unit: string;
  deadline: string | null;
  createdAt: string;
}

interface RadarSignal {
  id: string;
  source: "agent" | "intelligence" | "pattern";
  agentType?: string;
  signalType: string;
  title: string;
  description: string | null;
  confidence: number;
  priority: number;
  radarScore: number;
  actionType?: string | null;
  actionLabel?: string | null;
  actionUrl?: string | null;
  createdAt: string;
  canDismiss: boolean;
}

interface AgentStatus {
  agentType: string;
  name: string;
  emoji: string;
  isEnabled: boolean;
  lastRunAt: string | null;
  lastDiscoveriesCount: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GOAL_TYPES: Record<string, { label: string; unit: string; icon: React.ComponentType<{ className?: string }> }> = {
  revenue:      { label: "Monthly Revenue",  unit: "£",  icon: TrendingUp },
  products:     { label: "Products",         unit: "",   icon: Package },
  content:      { label: "Content Pieces",   unit: "",   icon: Pencil },
  followers:    { label: "Followers",        unit: "",   icon: Star },
  email_list:   { label: "Email Subscribers", unit: "",  icon: Zap },
  experiments:  { label: "Experiments",      unit: "",   icon: FlaskConical },
  custom:       { label: "Custom Goal",      unit: "",   icon: Target },
};

const SIGNAL_TYPE_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  opportunity:    { icon: TrendingUp,    color: "text-green-500" },
  warning:        { icon: AlertTriangle, color: "text-amber-500" },
  insight:        { icon: Lightbulb,     color: "text-blue-500" },
  recommendation: { icon: Zap,           color: "text-purple-500" },
  pattern:        { icon: Brain,         color: "text-violet-500" },
};

const SOURCE_COLORS: Record<string, string> = {
  agent:        "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  intelligence: "bg-purple-500/15 text-purple-600 dark:text-purple-300",
  pattern:      "bg-violet-500/15 text-violet-600 dark:text-violet-300",
};

const GRADE_COLORS: Record<string, string> = {
  A: "text-green-500",
  B: "text-blue-500",
  C: "text-amber-500",
  D: "text-orange-500",
  F: "text-red-500",
};

const DIM_COLORS: Record<string, string> = {
  knowledge:   "bg-violet-500",
  content:     "bg-purple-500",
  products:    "bg-blue-500",
  analytics:   "bg-green-500",
  experiments: "bg-pink-500",
  agents:      "bg-orange-500",
  goals:       "bg-amber-500",
};

function fmtRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtDeadline(deadlineStr: string | null): string {
  if (!deadlineStr) return "";
  const days = Math.ceil((new Date(deadlineStr).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "Overdue";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days}d left`;
}

// ─── Health Score Bar ─────────────────────────────────────────────────────────

function HealthScoreBar({ health, loading }: { health: BusinessHealthScore | null; loading: boolean }) {
  if (loading || !health) {
    return <div className="rounded-2xl border border-border bg-card p-5 animate-pulse h-32" />;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12">
            <svg viewBox="0 0 48 48" className="-rotate-90 w-12 h-12">
              <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/20" />
              <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4"
                className={GRADE_COLORS[health.grade]}
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - health.overall / 100)}`}
                strokeLinecap="round" />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-sm font-black ${GRADE_COLORS[health.grade]}`}>
              {health.grade}
            </span>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Business Health Score</p>
            <p className="text-3xl font-black text-foreground tabular-nums">{health.overall}<span className="text-base font-semibold text-muted-foreground">/100</span></p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground/40 text-right">
          Updated {fmtRelative(health.lastCalculatedAt)}
        </p>
      </div>

      <div className="space-y-1.5">
        {health.dimensions.map(dim => (
          <div key={dim.key} className="flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground w-32 shrink-0 truncate">{dim.name}</p>
            <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${DIM_COLORS[dim.key] ?? "bg-purple-500"}`}
                style={{ width: `${dim.score}%` }}
              />
            </div>
            <p className="text-[10px] font-bold text-muted-foreground w-6 text-right tabular-nums">{dim.score}</p>
            <p className={`text-[9px] font-semibold w-24 ${dim.score >= 65 ? "text-green-500" : dim.score >= 35 ? "text-amber-500" : "text-red-500"}`}>
              {dim.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Decision Card ────────────────────────────────────────────────────────────

function DecisionCard({ decision, onAction }: {
  decision: OrchestratorDecision;
  onAction: (id: string) => void;
}) {
  const [actioning, setActioning] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-xl border p-3.5 transition-all ${decision.isActioned ? "border-border/40 opacity-40" : "border-border bg-card hover:border-purple-500/30"}`}>
      <div className="flex items-start gap-2.5">
        <div className="w-5 h-5 rounded-full bg-purple-500/15 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[9px] font-black text-purple-500">{decision.priority}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground leading-tight">{decision.title}</p>
          {decision.description && (
            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">{decision.description}</p>
          )}
          {decision.reasoning && (
            <button onClick={() => setExpanded(e => !e)} className="text-[9px] text-purple-500 mt-0.5">
              {expanded ? "Hide reasoning" : "Why this?"}
            </button>
          )}
          {expanded && decision.reasoning && (
            <p className="text-[10px] text-muted-foreground/70 mt-1 italic leading-relaxed border-l-2 border-purple-500/30 pl-2">
              {decision.reasoning}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {decision.goalAlignment && (
              <span className="text-[9px] bg-green-500/10 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full">
                → {decision.goalAlignment}
              </span>
            )}
            {!decision.isActioned && (
              <button
                onClick={async () => { setActioning(true); onAction(decision.id); }}
                disabled={actioning}
                className="ml-auto flex items-center gap-1 text-[9px] font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 transition-colors"
              >
                {actioning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Mark done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({ goal, onDelete, onUpdate }: {
  goal: BusinessGoal;
  onDelete: (id: string) => void;
  onUpdate: (id: string, current: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [currentVal, setCurrentVal] = useState(String(goal.current));
  const pct = Math.min(100, Math.round((goal.current / Math.max(goal.target, 1)) * 100));
  const meta = GOAL_TYPES[goal.goalType];
  const Icon = meta?.icon ?? Target;
  const deadline = fmtDeadline(goal.deadline);

  const circumference = 2 * Math.PI * 18;
  const strokeDash = circumference * (1 - pct / 100);

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0 group">
      {/* Progress ring */}
      <div className="relative w-10 h-10 shrink-0">
        <svg viewBox="0 0 40 40" className="-rotate-90 w-10 h-10">
          <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/20" />
          <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="3"
            className={pct >= 100 ? "text-green-500" : pct >= 50 ? "text-blue-500" : "text-purple-500"}
            strokeDasharray={circumference} strokeDashoffset={strokeDash} strokeLinecap="round" />
        </svg>
        <Icon className="absolute inset-0 m-auto w-3.5 h-3.5 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">{goal.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {editing ? (
            <form onSubmit={e => { e.preventDefault(); const n = parseFloat(currentVal); if (!isNaN(n)) onUpdate(goal.id, n); setEditing(false); }} className="flex items-center gap-1">
              <input type="number" value={currentVal} onChange={e => setCurrentVal(e.target.value)}
                className="w-16 text-[10px] bg-background border border-purple-500/40 rounded px-1.5 py-0.5 text-foreground focus:outline-none"
                autoFocus />
              <button type="submit" className="text-[9px] text-green-500 font-bold">✓</button>
              <button type="button" onClick={() => setEditing(false)} className="text-[9px] text-muted-foreground">✕</button>
            </form>
          ) : (
            <button onClick={() => setEditing(true)} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              {goal.unit}{goal.current} / {goal.unit}{goal.target}
            </button>
          )}
          <span className={`text-[9px] font-bold tabular-nums ${pct >= 100 ? "text-green-500" : "text-muted-foreground/60"}`}>{pct}%</span>
          {deadline && (
            <span className={`text-[9px] ml-auto ${deadline === "Overdue" ? "text-red-500" : "text-muted-foreground/50"}`}>{deadline}</span>
          )}
        </div>
      </div>

      <button onClick={() => onDelete(goal.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 shrink-0">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Add Goal Form ────────────────────────────────────────────────────────────

function AddGoalForm({ onSave, onCancel }: {
  onSave: (data: { goalType: string; title: string; target: number; unit: string; deadline?: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [goalType, setGoalType] = useState("revenue");
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("£");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  const meta = GOAL_TYPES[goalType];
  useEffect(() => {
    setTitle(meta?.label ?? "");
    setUnit(meta?.unit ?? "");
  }, [goalType, meta]);

  return (
    <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3 space-y-2 mt-2">
      <div className="flex flex-wrap gap-1">
        {Object.entries(GOAL_TYPES).map(([key, m]) => {
          const Icon = m.icon;
          return (
            <button key={key} onClick={() => setGoalType(key)}
              className={`flex items-center gap-1 text-[9px] font-medium px-1.5 py-1 rounded-lg transition-colors ${goalType === key ? "bg-purple-500/20 text-purple-600 border border-purple-500/30" : "bg-muted/60 text-muted-foreground"}`}>
              <Icon className="w-2.5 h-2.5" />{m.label}
            </button>
          );
        })}
      </div>
      <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Goal title" className="text-xs h-7" />
      <div className="flex gap-2">
        <Input value={target} onChange={e => setTarget(e.target.value)} placeholder="Target" type="number" className="text-xs h-7 w-24" />
        <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="Unit (£, #...)" className="text-xs h-7 w-20" />
        <Input value={deadline} onChange={e => setDeadline(e.target.value)} type="date" className="text-xs h-7 flex-1" />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-xs text-muted-foreground px-2 py-1 hover:bg-muted/60 rounded-lg">Cancel</button>
        <button
          onClick={async () => {
            const t = parseFloat(target);
            if (!title.trim() || isNaN(t)) return;
            setSaving(true);
            await onSave({ goalType, title, target: t, unit, deadline: deadline || undefined });
            setSaving(false);
            onCancel();
          }}
          disabled={saving || !title.trim() || !target}
          className="text-xs bg-purple-600 text-white px-3 py-1 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Add Goal
        </button>
      </div>
    </div>
  );
}

// ─── Radar Signal Row ─────────────────────────────────────────────────────────

function RadarSignalRow({ signal, onDismiss }: {
  signal: RadarSignal;
  onDismiss: (id: string, source: string) => void;
}) {
  const [dismissing, setDismissing] = useState(false);
  const typeConfig = SIGNAL_TYPE_CONFIG[signal.signalType] ?? SIGNAL_TYPE_CONFIG.insight!;
  const TypeIcon = typeConfig.icon;
  const sourceBadge = SOURCE_COLORS[signal.source] ?? "bg-muted text-muted-foreground";

  return (
    <div className="flex items-start gap-2.5 py-2.5 border-b border-border/30 last:border-0 group">
      {/* Radar score bar on left edge */}
      <div className="w-0.5 self-stretch rounded-full shrink-0" style={{
        background: `linear-gradient(to bottom, ${signal.radarScore > 0.7 ? "#22c55e" : signal.radarScore > 0.4 ? "#8b5cf6" : "#6b7280"}, transparent)`,
      }} />

      <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-muted/40">
        <TypeIcon className={`w-3 h-3 ${typeConfig.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1.5">
          <p className="text-xs font-semibold text-foreground flex-1 leading-tight">{signal.title}</p>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${sourceBadge}`}>
            {signal.agentType ?? signal.source}
          </span>
        </div>
        {signal.description && (
          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{signal.description}</p>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`w-1 h-1.5 rounded-full ${i < Math.round(signal.confidence * 5) ? "bg-purple-500" : "bg-muted/30"}`} />
            ))}
          </div>
          <span className="text-[9px] text-muted-foreground/40 tabular-nums">{fmtRelative(signal.createdAt)}</span>
          {signal.actionLabel && signal.actionUrl && (
            <a href={signal.actionUrl} className="ml-auto flex items-center gap-0.5 text-[9px] font-bold text-purple-500">
              {signal.actionLabel}<ArrowRight className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>
      {signal.canDismiss && (
        <button
          onClick={async () => { setDismissing(true); onDismiss(signal.id, signal.source); }}
          disabled={dismissing}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0 mt-1"
        >
          {dismissing ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
        </button>
      )}
    </div>
  );
}

// ─── AI Team Status ───────────────────────────────────────────────────────────

function AITeamStatus({ agents }: { agents: AgentStatus[] }) {
  return (
    <div className="space-y-1.5">
      {agents.map(agent => {
        const isReady = !agent.lastRunAt ||
          (Date.now() - new Date(agent.lastRunAt).getTime()) > 6 * 3_600_000;
        return (
          <div key={agent.agentType} className="flex items-center gap-2 py-1.5">
            <span className="text-sm">{agent.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-foreground truncate">{agent.name}</p>
              <p className="text-[9px] text-muted-foreground/60">
                {agent.lastRunAt ? fmtRelative(agent.lastRunAt) : "Never run"}
                {agent.lastDiscoveriesCount > 0 && ` · ${agent.lastDiscoveriesCount} found`}
              </p>
            </div>
            <div className={`w-2 h-2 rounded-full shrink-0 ${!agent.isEnabled ? "bg-muted" : isReady ? "bg-amber-400" : "bg-green-400"}`} title={!agent.isEnabled ? "Disabled" : isReady ? "Ready" : "Active"} />
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BusinessOSTab() {
  const [orchestrator, setOrchestrator] = useState<OrchestratorState | null>(null);
  const [goals, setGoals] = useState<BusinessGoal[]>([]);
  const [radar, setRadar] = useState<RadarSignal[]>([]);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [dismissedSignals, setDismissedSignals] = useState<Set<string>>(new Set());
  const [actionedDecisions, setActionedDecisions] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orchRes, goalsRes, radarRes, agentsRes] = await Promise.all([
        fetch("/api/orchestrator"),
        fetch("/api/business-goals"),
        fetch("/api/opportunity-radar?limit=25"),
        fetch("/api/agents"),
      ]);
      const [orchData, goalsData, radarData, agentsData] = await Promise.all([
        orchRes.json() as Promise<OrchestratorState>,
        goalsRes.json() as Promise<BusinessGoal[]>,
        radarRes.json() as Promise<RadarSignal[]>,
        agentsRes.json() as Promise<AgentStatus[]>,
      ]);
      setOrchestrator(orchData);
      setGoals(Array.isArray(goalsData) ? goalsData : []);
      setRadar(Array.isArray(radarData) ? radarData : []);
      setAgents(Array.isArray(agentsData) ? agentsData : []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleRunOrchestrator = useCallback(async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/orchestrator", { method: "POST" });
      const data = await res.json() as OrchestratorState;
      setOrchestrator(data);
    } catch { /* ignore */ }
    setRunning(false);
  }, []);

  const handleActionDecision = useCallback(async (id: string) => {
    setActionedDecisions(prev => new Set(Array.from(prev).concat(id)));
    await fetch("/api/orchestrator", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }, []);

  const handleAddGoal = useCallback(async (data: Parameters<React.ComponentProps<typeof AddGoalForm>["onSave"]>[0]) => {
    const res = await fetch("/api/business-goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const goal = await res.json() as BusinessGoal;
    setGoals(prev => [goal, ...prev]);
    setShowAddGoal(false);
  }, []);

  const handleUpdateGoalCurrent = useCallback(async (id: string, current: number) => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, current } : g));
    await fetch("/api/business-goals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, current }),
    }).catch(() => {});
  }, []);

  const handleDeleteGoal = useCallback(async (id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
    await fetch(`/api/business-goals?id=${id}`, { method: "DELETE" }).catch(() => {});
  }, []);

  const handleDismissSignal = useCallback(async (id: string, source: string) => {
    setDismissedSignals(prev => new Set(Array.from(prev).concat(id)));
    await fetch("/api/opportunity-radar", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, source }),
    }).catch(() => {});
  }, []);

  const visibleDecisions = (orchestrator?.decisions ?? []).filter(d => !actionedDecisions.has(d.id));
  const visibleSignals = radar.filter(s => !dismissedSignals.has(s.id));

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <Cpu className="w-5 h-5 text-purple-500" />
            Business OS
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your autonomous business operating system — continuously analysing, prioritising, and optimising.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} className="p-2 rounded-xl border border-border hover:bg-muted/60 transition-colors">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={handleRunOrchestrator}
            disabled={running}
            className="flex items-center gap-1.5 text-sm font-semibold bg-purple-600 text-white px-3 py-2 rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            {running ? "Analysing…" : "Run Analysis"}
          </button>
        </div>
      </div>

      {/* Business Health Score */}
      <HealthScoreBar health={orchestrator?.healthScore ?? null} loading={loading} />

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left: Decisions + Radar (2/3) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Orchestrator Decisions */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Today&apos;s Decisions
              </p>
              {orchestrator && orchestrator.hoursUntilNextRun > 0 && (
                <span className="text-[9px] text-muted-foreground/40 flex items-center gap-0.5 ml-auto">
                  <Clock className="w-2.5 h-2.5" />Next refresh in {orchestrator.hoursUntilNextRun.toFixed(1)}h
                </span>
              )}
            </div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl border border-border bg-card animate-pulse" />)}
              </div>
            ) : visibleDecisions.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-6 text-center">
                <Cpu className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No decisions yet</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Run Analysis to generate your prioritised action plan</p>
              </div>
            ) : (
              <div className="space-y-2">
                {visibleDecisions.map(d => (
                  <DecisionCard key={d.id} decision={d} onAction={handleActionDecision} />
                ))}
              </div>
            )}
          </div>

          {/* Opportunity Radar */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Opportunity Radar
              </p>
              {visibleSignals.length > 0 && (
                <span className="text-[9px] bg-purple-500/15 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-full font-bold">
                  {visibleSignals.length}
                </span>
              )}
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              {loading ? (
                <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-muted/30 rounded animate-pulse" />)}</div>
              ) : visibleSignals.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No signals yet — run your agents to populate the radar</p>
                </div>
              ) : (
                visibleSignals.map(s => (
                  <RadarSignalRow key={s.id} signal={s} onDismiss={handleDismissSignal} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Goals + AI Team (1/3) */}
        <div className="space-y-5">
          {/* Business Goals */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex-1">
                Business Goals
              </p>
              <button onClick={() => setShowAddGoal(s => !s)} className="text-[9px] font-bold text-purple-500 flex items-center gap-0.5">
                <Plus className="w-3 h-3" />Add
              </button>
            </div>
            {showAddGoal && (
              <AddGoalForm onSave={handleAddGoal} onCancel={() => setShowAddGoal(false)} />
            )}
            <div className="rounded-2xl border border-border bg-card p-3">
              {loading ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-muted/30 rounded animate-pulse" />)}</div>
              ) : goals.length === 0 ? (
                <div className="text-center py-5">
                  <Target className="w-5 h-5 text-muted-foreground/30 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Set goals to direct your agents</p>
                  <button onClick={() => setShowAddGoal(true)} className="mt-1.5 text-[9px] font-bold text-purple-500">Add first goal</button>
                </div>
              ) : (
                goals.map(g => (
                  <GoalCard key={g.id} goal={g} onDelete={handleDeleteGoal} onUpdate={handleUpdateGoalCurrent} />
                ))
              )}
            </div>
          </div>

          {/* AI Team Status */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">AI Team</p>
            <div className="rounded-2xl border border-border bg-card p-3">
              {agents.length === 0 && !loading ? (
                <p className="text-xs text-muted-foreground text-center py-3">No agents loaded</p>
              ) : loading ? (
                <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-8 bg-muted/30 rounded animate-pulse" />)}</div>
              ) : (
                <AITeamStatus agents={agents} />
              )}
              <div className="mt-2 pt-2 border-t border-border/40">
                <div className="flex items-center gap-2 text-[9px] text-muted-foreground/40">
                  <span className="flex items-center gap-0.5"><div className="w-2 h-2 rounded-full bg-green-400" />Active</span>
                  <span className="flex items-center gap-0.5"><div className="w-2 h-2 rounded-full bg-amber-400" />Ready</span>
                  <span className="flex items-center gap-0.5"><div className="w-2 h-2 rounded-full bg-muted" />Disabled</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
