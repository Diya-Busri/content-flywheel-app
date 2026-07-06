"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Bot, Brain, Package, Pencil, BarChart2, FlaskConical,
  Play, RefreshCw, X, Loader2, Sparkles, Zap, Lightbulb,
  AlertTriangle, TrendingUp, Clock, ArrowRight, Search,
  ChevronDown, Activity, CheckCircle2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentType = "research" | "product" | "content" | "analytics" | "experiment" | "coach";

interface Agent {
  agentType: AgentType;
  name: string;
  goal: string;
  description: string;
  emoji: string;
  rateLimitHours: number;
  isEnabled: boolean;
  lastRunAt: string | null;
  lastDiscoveriesCount: number;
}

interface Discovery {
  id: string;
  agentType: AgentType;
  discoveryType: "opportunity" | "warning" | "insight" | "recommendation";
  title: string;
  description: string | null;
  confidence: number;
  priority: number;
  isDismissed: boolean;
  actionType: string | null;
  actionLabel: string | null;
  actionUrl: string | null;
  createdAt: string;
}

interface AgentTask {
  id: string;
  agentType: AgentType;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENT_ICONS: Record<AgentType, React.ComponentType<{ className?: string }>> = {
  research:   Search,
  product:    Package,
  content:    Pencil,
  analytics:  BarChart2,
  experiment: FlaskConical,
  coach:      Brain,
};

const AGENT_COLORS: Record<AgentType, { bg: string; text: string; border: string }> = {
  research:   { bg: "bg-blue-500/10",   text: "text-blue-600 dark:text-blue-400",     border: "border-blue-500/20" },
  product:    { bg: "bg-green-500/10",  text: "text-green-600 dark:text-green-400",   border: "border-green-500/20" },
  content:    { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/20" },
  analytics:  { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/20" },
  experiment: { bg: "bg-pink-500/10",   text: "text-pink-600 dark:text-pink-400",     border: "border-pink-500/20" },
  coach:      { bg: "bg-teal-500/10",   text: "text-teal-600 dark:text-teal-400",     border: "border-teal-500/20" },
};

const DISCOVERY_STYLE: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  opportunity:    { icon: <TrendingUp className="w-3.5 h-3.5" />,    color: "text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20",  label: "Opportunity" },
  warning:        { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",  label: "Warning" },
  insight:        { icon: <Lightbulb className="w-3.5 h-3.5" />,    color: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20",      label: "Insight" },
  recommendation: { icon: <Zap className="w-3.5 h-3.5" />,          color: "text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20", label: "Action" },
};

function fmtRelative(dateStr: string | null): string {
  if (!dateStr) return "Never run";
  const diff = Date.now() - new Date(dateStr).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return "Just now";
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function getAgentStatus(agent: Agent): { label: string; dotColor: string; textColor: string; pulse: boolean } {
  if (!agent.isEnabled) return { label: "Off", dotColor: "bg-gray-400", textColor: "text-muted-foreground", pulse: false };
  if (!agent.lastRunAt) return { label: "Ready", dotColor: "bg-blue-500", textColor: "text-blue-500", pulse: false };
  const hrs = (Date.now() - new Date(agent.lastRunAt).getTime()) / 3600000;
  if (hrs < 1) return { label: "Active", dotColor: "bg-green-500", textColor: "text-green-500", pulse: true };
  if (hrs < agent.rateLimitHours) return { label: "Cooling down", dotColor: "bg-amber-500", textColor: "text-amber-500", pulse: false };
  return { label: "Ready", dotColor: "bg-blue-500", textColor: "text-blue-500", pulse: false };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AgentCentreTab() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAgent, setRunningAgent] = useState<AgentType | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [discoveryFilter, setDiscoveryFilter] = useState<string>("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [agentsRes, discRes, tasksRes] = await Promise.all([
        fetch("/api/agents"),
        fetch("/api/agents/discoveries?limit=50&daysBack=30"),
        fetch("/api/agents/tasks"),
      ]);
      if (agentsRes.ok) setAgents((await agentsRes.json()) as Agent[]);
      if (discRes.ok) {
        const data = await discRes.json() as unknown;
        setDiscoveries(Array.isArray(data) ? data as Discovery[] : []);
      }
      if (tasksRes.ok) {
        const data = await tasksRes.json() as unknown;
        setTasks(Array.isArray(data) ? data as AgentTask[] : []);
      }
    } catch {
      setFetchError("Failed to load agent data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const toggleAgent = async (agentType: AgentType, isEnabled: boolean) => {
    try {
      await fetch("/api/agents", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentType, isEnabled }) });
      setAgents(prev => prev.map(a => a.agentType === agentType ? { ...a, isEnabled } : a));
    } catch { /* silent */ }
  };

  const runAgent = async (agentType: AgentType) => {
    setRunningAgent(agentType);
    try {
      await fetch("/api/agents/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentType }) });
      await fetchAll();
    } catch { /* silent */ }
    setRunningAgent(null);
  };

  const runAllAgents = async () => {
    setRunningAll(true);
    try {
      await Promise.all(
        agents.filter(a => a.isEnabled).map(a =>
          fetch("/api/agents/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentType: a.agentType }) })
        )
      );
      await fetchAll();
    } catch { /* silent */ }
    setRunningAll(false);
  };

  const dismissDiscovery = async (id: string) => {
    try {
      await fetch("/api/agents/discoveries", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      setDiscoveries(prev => prev.filter(d => d.id !== id));
    } catch { /* silent */ }
  };

  const filteredDiscoveries = discoveries.filter(d =>
    discoveryFilter === "all" || d.discoveryType === discoveryFilter
  );

  const completedTasks = tasks.filter(t => t.status === "completed");
  const pendingTasks   = tasks.filter(t => t.status !== "completed");
  const activeAgents   = agents.filter(a => a.isEnabled).length;
  const lastRunTime    = agents.reduce((latest, a) => {
    if (!a.lastRunAt) return latest;
    return !latest || new Date(a.lastRunAt) > new Date(latest) ? a.lastRunAt : latest;
  }, null as string | null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading your team…</p>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground mb-1">Could not load agents</p>
          <p className="text-xs text-muted-foreground mb-4">{fetchError}</p>
          <button onClick={() => void fetchAll()} className="text-xs font-semibold text-orange-500 hover:text-orange-600 flex items-center gap-1 mx-auto">
            <RefreshCw className="w-3.5 h-3.5" />Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">

      {/* ── Team header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-base font-bold text-foreground">Your AI Team</h2>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
              <Activity className="w-3 h-3" />{activeAgents} active
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {lastRunTime ? `Last activity ${fmtRelative(lastRunTime)}` : "No runs yet — activate your team below"}
            {discoveries.length > 0 && ` · ${discoveries.length} discoveries in the last 30 days`}
          </p>
        </div>
        <button
          onClick={() => void runAllAgents()}
          disabled={runningAll || activeAgents === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-60"
        >
          {runningAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {runningAll ? "Running team…" : "Run All Agents"}
        </button>
      </div>

      {/* ── Agent team cards ─────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map(agent => {
          const AgentIcon = AGENT_ICONS[agent.agentType];
          const colors = AGENT_COLORS[agent.agentType];
          const status = getAgentStatus(agent);
          const isRunning = runningAgent === agent.agentType;

          return (
            <div key={agent.agentType}
              className={`rounded-2xl border bg-card p-5 flex flex-col gap-4 transition-all hover:shadow-sm ${colors.border} ${!agent.isEnabled ? "opacity-60" : ""}`}>
              {/* Card header: avatar + name + toggle */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl ${colors.bg} flex items-center justify-center shrink-0`}>
                    <AgentIcon className={`w-5 h-5 ${colors.text}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-foreground">{agent.name}</p>
                      <span className="relative flex shrink-0">
                        <span className={`w-2 h-2 rounded-full ${status.dotColor}`} />
                        {status.pulse && <span className={`absolute w-2 h-2 rounded-full ${status.dotColor} animate-ping opacity-75`} />}
                      </span>
                    </div>
                    <p className={`text-[10px] font-semibold ${status.textColor}`}>{status.label}</p>
                  </div>
                </div>
                {/* Enable/disable toggle */}
                <button onClick={() => void toggleAgent(agent.agentType, !agent.isEnabled)}
                  className={`w-9 h-5 rounded-full transition-colors shrink-0 relative ${agent.isEnabled ? "bg-orange-500" : "bg-muted-foreground/30"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${agent.isEnabled ? "left-4" : "left-0.5"}`} />
                </button>
              </div>

              {/* Role description */}
              <p className="text-xs text-muted-foreground leading-relaxed">{agent.goal}</p>

              {/* Stats */}
              <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{fmtRelative(agent.lastRunAt)}</span>
                </div>
                {agent.lastDiscoveriesCount > 0 && (
                  <div className={`flex items-center gap-1 font-semibold ${colors.text}`}>
                    <Sparkles className="w-3 h-3" />
                    <span>{agent.lastDiscoveriesCount} found last run</span>
                  </div>
                )}
              </div>

              {/* Run button */}
              <button
                onClick={() => void runAgent(agent.agentType)}
                disabled={isRunning || !agent.isEnabled}
                className={`flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 ${colors.bg} ${colors.text} border ${colors.border} hover:opacity-80`}
              >
                {isRunning ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Running…</> : <><Play className="w-3.5 h-3.5" />Run now</>}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Discoveries feed ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-foreground">Discoveries</h3>
            {filteredDiscoveries.length > 0 && (
              <span className="text-[10px] font-bold text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded-full">
                {filteredDiscoveries.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["all", "opportunity", "warning", "insight", "recommendation"] as const).map(f => (
              <button key={f} onClick={() => setDiscoveryFilter(f)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                  discoveryFilter === f
                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}>
                {f === "all" ? `All (${discoveries.length})` : f}
              </button>
            ))}
          </div>
        </div>

        {filteredDiscoveries.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-dashed border-border">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
              <Bot className="w-6 h-6 text-purple-400" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">No discoveries yet</p>
            <p className="text-xs text-muted-foreground mb-4">Run your agents to start finding opportunities, warnings, and insights</p>
            <button onClick={() => void runAllAgents()} disabled={runningAll || activeAgents === 0}
              className="text-xs font-semibold text-orange-500 hover:text-orange-600 flex items-center gap-1 mx-auto disabled:opacity-50">
              <Sparkles className="w-3.5 h-3.5" />Run All Agents
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredDiscoveries.map(d => {
              const AgentIcon = AGENT_ICONS[d.agentType] ?? Bot;
              const agentColors = AGENT_COLORS[d.agentType] ?? AGENT_COLORS.research;
              const discStyle = DISCOVERY_STYLE[d.discoveryType] ?? DISCOVERY_STYLE.insight;
              return (
                <div key={d.id} className="group flex items-start gap-3 p-4 rounded-xl border border-border/60 bg-card hover:border-border transition-colors">
                  {/* Discovery type badge */}
                  <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border shrink-0 mt-0.5 ${discStyle.color}`}>
                    {discStyle.icon}
                    <span>{discStyle.label}</span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1">
                      <p className="text-xs font-semibold text-foreground flex-1 leading-snug">{d.title}</p>
                      <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 capitalize ${agentColors.bg} ${agentColors.text}`}>
                        <AgentIcon className="w-2.5 h-2.5" />
                        {d.agentType}
                      </span>
                    </div>
                    {d.description && <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{d.description}</p>}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-[10px] text-muted-foreground/50">
                        {new Date(d.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                      <div className="flex items-center gap-1">
                        <div className="h-1 w-12 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.round(d.confidence * 100)}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground/50">{Math.round(d.confidence * 100)}% confidence</span>
                      </div>
                      {d.actionLabel && d.actionUrl && (
                        <a href={d.actionUrl} className="text-[10px] font-semibold text-orange-500 hover:text-orange-600 flex items-center gap-0.5">
                          {d.actionLabel} <ArrowRight className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                  <button onClick={() => void dismissDiscovery(d.id)}
                    className="opacity-0 group-hover:opacity-100 shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-all mt-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Work history ─────────────────────────────────────────────────── */}
      {(completedTasks.length > 0 || pendingTasks.length > 0) && (
        <div>
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="text-sm font-bold text-foreground">Work History</h3>
            <button onClick={() => setShowCompleted(v => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCompleted ? "rotate-180" : ""}`} />
              {showCompleted ? "Hide" : "Show"} completed ({completedTasks.length})
            </button>
          </div>

          {pendingTasks.length > 0 && (
            <div className="space-y-2 mb-3">
              {pendingTasks.slice(0, 5).map(task => {
                const AgentIcon = AGENT_ICONS[task.agentType] ?? Bot;
                const agentColors = AGENT_COLORS[task.agentType] ?? AGENT_COLORS.research;
                return (
                  <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card">
                    <div className={`w-6 h-6 rounded-lg ${agentColors.bg} flex items-center justify-center shrink-0`}>
                      <AgentIcon className={`w-3.5 h-3.5 ${agentColors.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{task.title}</p>
                      {task.description && <p className="text-[10px] text-muted-foreground truncate">{task.description}</p>}
                    </div>
                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full capitalize shrink-0">
                      {task.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {showCompleted && completedTasks.length > 0 && (
            <div className="space-y-1.5">
              {completedTasks.slice(0, 10).map(task => {
                const AgentIcon = AGENT_ICONS[task.agentType] ?? Bot;
                const agentColors = AGENT_COLORS[task.agentType] ?? AGENT_COLORS.research;
                return (
                  <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-background/50 opacity-70">
                    <div className={`w-6 h-6 rounded-lg ${agentColors.bg} flex items-center justify-center shrink-0`}>
                      <AgentIcon className={`w-3.5 h-3.5 ${agentColors.text}`} />
                    </div>
                    <p className="text-xs text-foreground/70 flex-1 truncate">{task.title}</p>
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
