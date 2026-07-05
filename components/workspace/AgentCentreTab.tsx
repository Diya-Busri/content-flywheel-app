"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Bot, Brain, Package, Pencil, BarChart2, FlaskConical, Target,
  Play, RefreshCw, X, Check, ChevronDown, Loader2,
  Sparkles, Zap, Lightbulb, AlertTriangle, TrendingUp,
  Clock, Activity, BookOpen, ArrowRight, Search,
  Sun, Calendar, Star,
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

interface DailyBrief {
  date: string;
  headline: string;
  prioritiesHtml: string;
  discoveries: string[];
  tasks: string[];
  warnings: string[];
  opportunities: string[];
  businessHealth: number;
  generatedAt: string;
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

const AGENT_COLORS: Record<AgentType, { bg: string; text: string; border: string; badge: string }> = {
  research:   { bg: "bg-blue-500/10",   text: "text-blue-600 dark:text-blue-400",   border: "border-blue-500/20",   badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  product:    { bg: "bg-green-500/10",  text: "text-green-600 dark:text-green-400", border: "border-green-500/20",  badge: "bg-green-500/15 text-green-700 dark:text-green-300" },
  content:    { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/20", badge: "bg-purple-500/15 text-purple-700 dark:text-purple-300" },
  analytics:  { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/20", badge: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  experiment: { bg: "bg-pink-500/10",   text: "text-pink-600 dark:text-pink-400",   border: "border-pink-500/20",   badge: "bg-pink-500/15 text-pink-700 dark:text-pink-300" },
  coach:      { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", border: "border-violet-500/20", badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
};

const DISCOVERY_TYPE_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  opportunity:    { icon: TrendingUp,    color: "text-green-500" },
  warning:        { icon: AlertTriangle, color: "text-amber-500" },
  insight:        { icon: Lightbulb,     color: "text-blue-500" },
  recommendation: { icon: Zap,           color: "text-purple-500" },
};

function fmtRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function nextRunIn(lastRunAt: string | null, rateLimitHours: number): string {
  if (!lastRunAt) return "Ready to run";
  const hoursElapsed = (Date.now() - new Date(lastRunAt).getTime()) / 3_600_000;
  const remaining = rateLimitHours - hoursElapsed;
  if (remaining <= 0) return "Ready to run";
  if (remaining < 1) return `${Math.round(remaining * 60)}m`;
  return `${remaining.toFixed(1)}h`;
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({
  agent,
  onToggle,
  onRun,
  running,
}: {
  agent: Agent;
  onToggle: (type: AgentType, enabled: boolean) => void;
  onRun: (type: AgentType) => void;
  running: boolean;
}) {
  const Icon = AGENT_ICONS[agent.agentType];
  const colors = AGENT_COLORS[agent.agentType];
  const ready = !agent.lastRunAt ||
    (Date.now() - new Date(agent.lastRunAt).getTime()) > agent.rateLimitHours * 3_600_000;

  return (
    <div className={`rounded-2xl border p-4 transition-all ${agent.isEnabled ? `${colors.bg} ${colors.border}` : "border-border bg-card opacity-50"}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${agent.isEnabled ? colors.bg : "bg-muted/60"}`}>
          <Icon className={`w-4 h-4 ${agent.isEnabled ? colors.text : "text-muted-foreground"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-foreground leading-tight">{agent.name}</p>
            <button
              onClick={() => onToggle(agent.agentType, !agent.isEnabled)}
              className={`shrink-0 w-9 h-5 rounded-full transition-colors relative ${agent.isEnabled ? "bg-purple-500" : "bg-muted"}`}
              title={agent.isEnabled ? "Disable agent" : "Enable agent"}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${agent.isEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{agent.description}</p>

          <div className="flex items-center gap-2 mt-2">
            {agent.lastRunAt ? (
              <span className="text-[9px] text-muted-foreground/60 flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5" />{fmtRelative(agent.lastRunAt)}
              </span>
            ) : (
              <span className="text-[9px] text-muted-foreground/40">Never run</span>
            )}
            {agent.lastDiscoveriesCount > 0 && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${colors.badge}`}>
                {agent.lastDiscoveriesCount} found
              </span>
            )}
            <button
              onClick={() => onRun(agent.agentType)}
              disabled={running || !agent.isEnabled}
              title={ready ? "Run agent now" : `Next run: ${nextRunIn(agent.lastRunAt, agent.rateLimitHours)}`}
              className={`ml-auto flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded-lg transition-colors ${running ? "opacity-50 cursor-not-allowed" : ready ? `${colors.bg} ${colors.text} hover:opacity-80` : "bg-muted/60 text-muted-foreground cursor-not-allowed"}`}
            >
              {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              {running ? "Running" : ready ? "Run" : nextRunIn(agent.lastRunAt, agent.rateLimitHours)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Discovery Card ───────────────────────────────────────────────────────────

function DiscoveryCard({
  discovery,
  onDismiss,
}: {
  discovery: Discovery;
  onDismiss: (id: string) => void;
}) {
  const [dismissing, setDismissing] = useState(false);
  const typeConfig = DISCOVERY_TYPE_CONFIG[discovery.discoveryType] ?? DISCOVERY_TYPE_CONFIG.insight!;
  const TypeIcon = typeConfig.icon;
  const agentColors = AGENT_COLORS[discovery.agentType];

  return (
    <div className="group flex items-start gap-3 py-3 border-b border-border/40 last:border-0">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${agentColors.bg}`}>
        <TypeIcon className={`w-3.5 h-3.5 ${typeConfig.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <p className="text-xs font-semibold text-foreground flex-1 leading-tight">{discovery.title}</p>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${agentColors.badge}`}>
            {discovery.agentType}
          </span>
        </div>
        {discovery.description && (
          <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">{discovery.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <div className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`w-1 h-1.5 rounded-full ${i < Math.round(discovery.confidence * 5) ? "bg-purple-500" : "bg-muted/40"}`} />
            ))}
          </div>
          <span className="text-[9px] text-muted-foreground/40">{fmtRelative(discovery.createdAt)}</span>
          {discovery.actionLabel && discovery.actionUrl && (
            <a href={discovery.actionUrl} className={`ml-auto flex items-center gap-0.5 text-[9px] font-semibold ${agentColors.text}`}>
              {discovery.actionLabel}<ArrowRight className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>
      <button
        onClick={async () => { setDismissing(true); await onDismiss(discovery.id); }}
        disabled={dismissing}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0 mt-1"
      >
        {dismissing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

// ─── Daily Brief Panel ────────────────────────────────────────────────────────

function DailyBriefPanel({ brief, onClose }: { brief: DailyBrief; onClose: () => void }) {
  const healthColor = brief.businessHealth >= 70 ? "text-green-500" : brief.businessHealth >= 40 ? "text-amber-500" : "text-red-500";

  return (
    <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-violet-500/5 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sun className="w-5 h-5 text-amber-500" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Daily Business Brief</p>
            <p className="text-xs text-muted-foreground/60">{new Date(brief.generatedAt).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Business Health</p>
            <p className={`text-xl font-black ${healthColor}`}>{brief.businessHealth}<span className="text-xs font-medium">/100</span></p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
      </div>

      <div>
        <p className="text-base font-bold text-foreground">{brief.headline}</p>
        <div className="text-xs text-muted-foreground mt-1 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: brief.prioritiesHtml }} />
      </div>

      {brief.opportunities.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-green-600 dark:text-green-400 mb-1.5">Opportunities</p>
          <ul className="space-y-1">
            {brief.opportunities.map((o, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                <TrendingUp className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />{o}
              </li>
            ))}
          </ul>
        </div>
      )}

      {brief.warnings.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1.5">Watch Out</p>
          <ul className="space-y-1">
            {brief.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />{w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {brief.tasks.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Today&apos;s Priorities</p>
          <ul className="space-y-1">
            {brief.tasks.map((t, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                <span className="w-4 h-4 rounded-full border border-purple-500/40 flex items-center justify-center text-[9px] font-bold text-purple-500 shrink-0 mt-0.5">{i + 1}</span>{t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AgentCentreTab() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAll, setRunningAll] = useState(false);
  const [runningAgent, setRunningAgent] = useState<AgentType | null>(null);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [activeFilter, setActiveFilter] = useState<AgentType | "all">("all");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [agentsRes, discoveriesRes, tasksRes] = await Promise.all([
        fetch("/api/agents"),
        fetch("/api/agents/discoveries?daysBack=7&limit=50"),
        fetch("/api/agents/tasks?status=pending&limit=30"),
      ]);
      const [agentsData, discoveriesData, tasksData] = await Promise.all([
        agentsRes.json() as Promise<Agent[]>,
        discoveriesRes.json() as Promise<Discovery[]>,
        tasksRes.json() as Promise<AgentTask[]>,
      ]);
      setAgents(Array.isArray(agentsData) ? agentsData : []);
      setDiscoveries(Array.isArray(discoveriesData) ? discoveriesData : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleToggle = useCallback(async (agentType: AgentType, isEnabled: boolean) => {
    setAgents(prev => prev.map(a => a.agentType === agentType ? { ...a, isEnabled } : a));
    await fetch("/api/agents", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentType, isEnabled }),
    }).catch(() => {});
  }, []);

  const handleRunAgent = useCallback(async (agentType: AgentType) => {
    setRunningAgent(agentType);
    await fetch("/api/agents/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentType, forceRun: true }),
    }).catch(() => {});
    // Wait for async run, then reload
    await new Promise(r => setTimeout(r, 4000));
    await load();
    setRunningAgent(null);
  }, [load]);

  const handleRunAll = useCallback(async () => {
    setRunningAll(true);
    await fetch("/api/agents/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forceRun: true }),
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 6000));
    await load();
    setRunningAll(false);
  }, [load]);

  const handleDismiss = useCallback(async (id: string) => {
    setDismissed(prev => new Set(Array.from(prev).concat(id)));
    await fetch("/api/agents/discoveries", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }, []);

  const handleCompleteTask = useCallback(async (id: string) => {
    setCompletedTasks(prev => new Set(Array.from(prev).concat(id)));
    await fetch("/api/agents/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "completed" }),
    }).catch(() => {});
  }, []);

  const handleGenerateBrief = useCallback(async () => {
    setGeneratingBrief(true);
    try {
      const res = await fetch("/api/agents/daily-review", { method: "POST" });
      const data = await res.json() as DailyBrief;
      setBrief(data);
      await load();
    } catch { /* ignore */ }
    setGeneratingBrief(false);
  }, [load]);

  const visibleDiscoveries = discoveries.filter(d =>
    !dismissed.has(d.id) &&
    (activeFilter === "all" || d.agentType === activeFilter),
  );
  const visibleTasks = tasks.filter(t => !completedTasks.has(t.id));
  const enabledCount = agents.filter(a => a.isEnabled).length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-500" />
            Agent Team
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {enabledCount} of {agents.length} agents active — continuously monitoring and improving your business.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} className="p-2 rounded-xl border border-border hover:bg-muted/60 transition-colors">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={handleGenerateBrief}
            disabled={generatingBrief}
            className="flex items-center gap-1.5 text-sm font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-2 rounded-xl hover:bg-amber-500/15 transition-colors disabled:opacity-50"
          >
            {generatingBrief ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sun className="w-4 h-4" />}
            {generatingBrief ? "Generating…" : "Daily Brief"}
          </button>
          <button
            onClick={handleRunAll}
            disabled={runningAll}
            className="flex items-center gap-1.5 text-sm font-semibold bg-purple-600 text-white px-3 py-2 rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {runningAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {runningAll ? "Running Agents…" : "Run All Agents"}
          </button>
        </div>
      </div>

      {/* Daily Brief */}
      {brief && <DailyBriefPanel brief={brief} onClose={() => setBrief(null)} />}

      {/* Agent grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 rounded-2xl border border-border bg-card animate-pulse" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {agents.map(agent => (
            <AgentCard
              key={agent.agentType}
              agent={agent}
              onToggle={handleToggle}
              onRun={handleRunAgent}
              running={runningAgent === agent.agentType || runningAll}
            />
          ))}
        </div>
      )}

      {/* Discoveries + Tasks in two columns */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Discoveries feed — 2/3 width */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Discoveries
              {visibleDiscoveries.length > 0 && (
                <span className="ml-1.5 bg-purple-500/15 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-full font-bold">
                  {visibleDiscoveries.length}
                </span>
              )}
            </p>
            <div className="flex items-center gap-1 flex-wrap ml-auto">
              {(["all", "research", "product", "content", "analytics", "experiment", "coach"] as const).map(f => {
                const count = f === "all"
                  ? visibleDiscoveries.length
                  : visibleDiscoveries.filter(d => d.agentType === f).length;
                if (f !== "all" && count === 0) return null;
                return (
                  <button key={f} onClick={() => setActiveFilter(f)}
                    className={`text-[9px] font-semibold px-2 py-1 rounded-lg transition-colors ${activeFilter === f ? "bg-purple-500/15 text-purple-600 dark:text-purple-400" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}>
                    {f === "all" ? "All" : f} {count > 0 ? `(${count})` : ""}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            {visibleDiscoveries.length === 0 ? (
              <div className="text-center py-10">
                <Bot className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No discoveries yet</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Run your agents to start finding opportunities</p>
                <button onClick={handleRunAll} disabled={runningAll}
                  className="mt-3 text-xs bg-purple-600 text-white px-3 py-1.5 rounded-xl font-semibold hover:bg-purple-700 transition-colors inline-flex items-center gap-1">
                  <Play className="w-3 h-3" />Run All Agents
                </button>
              </div>
            ) : (
              <div>
                {visibleDiscoveries.map(d => (
                  <DiscoveryCard key={d.id} discovery={d} onDismiss={handleDismiss} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tasks — 1/3 width */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Agent Tasks
            {visibleTasks.length > 0 && (
              <span className="ml-1.5 bg-purple-500/15 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-full font-bold">
                {visibleTasks.length}
              </span>
            )}
          </p>

          <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
            {visibleTasks.length === 0 ? (
              <div className="text-center py-6">
                <Check className="w-6 h-6 text-green-500 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">No pending tasks</p>
              </div>
            ) : (
              visibleTasks.map(task => {
                const agentColors = AGENT_COLORS[task.agentType as AgentType] ?? AGENT_COLORS.coach;
                return (
                  <div key={task.id} className="flex items-start gap-2.5 group py-2 border-b border-border/40 last:border-0">
                    <button
                      onClick={() => void handleCompleteTask(task.id)}
                      className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center shrink-0 mt-0.5 hover:border-green-500 hover:bg-green-500/10 transition-colors group"
                    >
                      <Check className="w-2.5 h-2.5 text-muted-foreground/0 group-hover:text-green-500 transition-colors" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground leading-tight">{task.title}</p>
                      {task.description && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${agentColors.badge}`}>
                          {task.agentType}
                        </span>
                        <span className="text-[9px] text-muted-foreground/40">P{task.priority}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
