"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Brain, Search, Pin, Star, Archive, Trash2, Plus, X,
  BookOpen, BarChart2, Package, Pencil, Target, StickyNote,
  Sparkles, Loader2, ChevronDown, TrendingUp, RefreshCw,
  Lightbulb, Zap, AlertTriangle, ArrowRight, Activity,
  Eye, BarChart,
} from "lucide-react";
import { Input } from "@/components/ui/input";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserMemoryEntry {
  id: string;
  category: string;
  type: string;
  title: string;
  content: string;
  aiSummary?: string | null;
  memoryType: "automatic" | "pinned" | "favourite" | "archived";
  source: string;
  usageCount: number;
  combinedScore: number;
  confidenceScore: number;
  createdAt: string;
  updatedAt: string;
}

interface Pattern {
  id: string;
  patternType: string;
  title: string;
  description: string;
  confidence: number;
  evidence: string[];
}

interface Recommendation {
  id: string;
  recType: string;
  title: string;
  description: string;
  priority: number;
  confidence: number;
  actionType: string | null;
}

interface DashboardData {
  knowledgeScore: number;
  totalMemories: number;
  memoriesThisWeek: number;
  patternsDetected: number;
  recommendationsAvailable: number;
  averageConfidence: number;
  categoryCounts: Record<string, number>;
  patterns: Pattern[];
  recommendations: Recommendation[];
  topMemories: { id: string; category: string; title: string; aiSummary: string | null; combinedScore: number; usageCount: number }[];
}

type ActiveView = "all" | "pinned" | "favourite" | "archived";

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES: Record<string, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  research:    { label: "Research",    Icon: Search },
  product:     { label: "Product",     Icon: Package },
  content:     { label: "Content",     Icon: Pencil },
  analytics:   { label: "Analytics",   Icon: BarChart2 },
  strategy:    { label: "Strategy",    Icon: Target },
  notes:       { label: "Notes",       Icon: StickyNote },
  general:     { label: "General",     Icon: Brain },
  book:        { label: "Books",       Icon: BookOpen },
};

const PATTERN_ICONS: Record<string, React.ReactNode> = {
  content_success:  <TrendingUp className="w-4 h-4 text-green-500" />,
  topic_trend:      <BarChart className="w-4 h-4 text-blue-500" />,
  engagement:       <Activity className="w-4 h-4 text-purple-500" />,
  product_market:   <Package className="w-4 h-4 text-orange-500" />,
  recurring_theme:  <RefreshCw className="w-4 h-4 text-teal-500" />,
};
const patternIcon = (type: string) => PATTERN_ICONS[type] ?? <Lightbulb className="w-4 h-4 text-amber-500" />;

const REC_PRIORITY: Record<number, { label: string; color: string }> = {
  1: { label: "Critical", color: "text-red-500 bg-red-500/10 border-red-500/20" },
  2: { label: "High",     color: "text-orange-500 bg-orange-500/10 border-orange-500/20" },
  3: { label: "Medium",   color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
  4: { label: "Low",      color: "text-green-500 bg-green-500/10 border-green-500/20" },
};
const recPriority = (p: number) => REC_PRIORITY[p] ?? REC_PRIORITY[4];

function fmtRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BusinessBrainTab() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [memories, setMemories] = useState<UserMemoryEntry[]>([]);
  const [dashLoading, setDashLoading] = useState(true);
  const [memLoading, setMemLoading] = useState(true);
  const [runningIntelligence, setRunningIntelligence] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>("all");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [libraryExpanded, setLibraryExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/intelligence/dashboard");
      if (res.ok) setDashboard((await res.json()) as DashboardData);
    } catch { /* silent */ }
    finally { setDashLoading(false); }
  }, []);

  const fetchMemories = useCallback(async (view: ActiveView, q: string, cat: string) => {
    setMemLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "40");
      if (view !== "all") params.set("memoryType", view);
      if (q) params.set("search", q);
      if (cat) params.set("category", cat);
      const res = await fetch(`/api/user-memory?${params.toString()}`);
      if (res.ok) {
        const data = await res.json() as { memories: UserMemoryEntry[] };
        setMemories(data.memories ?? []);
      }
    } catch {
      setError("Failed to load memories.");
    } finally { setMemLoading(false); }
  }, []);

  useEffect(() => { void fetchDashboard(); }, [fetchDashboard]);
  useEffect(() => {
    if (libraryExpanded) void fetchMemories(activeView, search, selectedCategory);
  }, [fetchMemories, libraryExpanded, activeView, search, selectedCategory]);

  const runIntelligence = async () => {
    setRunningIntelligence(true);
    try {
      await fetch("/api/intelligence/run", { method: "POST" });
      await fetchDashboard();
    } catch { /* silent */ }
    finally { setRunningIntelligence(false); }
  };

  const updateMemory = async (id: string, patch: Partial<Pick<UserMemoryEntry, "memoryType">>) => {
    try {
      await fetch(`/api/user-memory?id=${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      setMemories(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
    } catch { /* silent */ }
  };

  const deleteMemory = async (id: string) => {
    try {
      await fetch(`/api/user-memory?id=${id}`, { method: "DELETE" });
      setMemories(prev => prev.filter(m => m.id !== id));
    } catch { /* silent */ }
  };

  const patterns = dashboard?.patterns ?? [];
  const recommendations = (dashboard?.recommendations ?? []).sort((a, b) => a.priority - b.priority);
  const topMemories = dashboard?.topMemories ?? [];

  return (
    <div className="space-y-8 max-w-5xl">

      {/* ── Metric strip ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex flex-col gap-1.5 p-4 rounded-2xl border border-border bg-card">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Knowledge Score</p>
          <p className="text-3xl font-black text-orange-500 tabular-nums">
            {dashLoading ? "—" : `${dashboard?.knowledgeScore ?? 0}%`}
          </p>
          <p className="text-[10px] text-muted-foreground/40">{dashboard?.totalMemories ?? 0} entries total</p>
        </div>
        <div className="flex flex-col gap-1.5 p-4 rounded-2xl border border-border bg-card">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Patterns Found</p>
          <p className="text-3xl font-black text-blue-500 tabular-nums">
            {dashLoading ? "—" : (dashboard?.patternsDetected ?? 0)}
          </p>
          <p className="text-[10px] text-muted-foreground/40">learned from your data</p>
        </div>
        <div className="flex flex-col gap-1.5 p-4 rounded-2xl border border-border bg-card">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Recommendations</p>
          <p className="text-3xl font-black text-purple-500 tabular-nums">
            {dashLoading ? "—" : (dashboard?.recommendationsAvailable ?? 0)}
          </p>
          <p className="text-[10px] text-muted-foreground/40">strategic actions available</p>
        </div>
        <div className="flex flex-col gap-1.5 p-4 rounded-2xl border border-border bg-card">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">This Week</p>
          <p className="text-3xl font-black text-green-500 tabular-nums">
            {dashLoading ? "—" : `+${dashboard?.memoriesThisWeek ?? 0}`}
          </p>
          <p className="text-[10px] text-muted-foreground/40">new memories learned</p>
        </div>
      </div>

      {/* ── What Your Business Has Learned ───────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">What Your Business Has Learned</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Patterns detected across your research, content, and product activity</p>
          </div>
          <button onClick={() => void runIntelligence()} disabled={runningIntelligence}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-orange-500/40 transition-all disabled:opacity-50">
            {runningIntelligence ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {runningIntelligence ? "Analysing…" : "Run Analysis"}
          </button>
        </div>

        {dashLoading ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 rounded-2xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : patterns.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-dashed border-border">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
              <Brain className="w-6 h-6 text-blue-400" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">No patterns detected yet</p>
            <p className="text-xs text-muted-foreground mb-4">Use Research, AI Coach, and other features to build your business knowledge base. Patterns emerge automatically.</p>
            <button onClick={() => void runIntelligence()} className="text-xs font-semibold text-orange-500 hover:text-orange-600 flex items-center gap-1 mx-auto">
              <Sparkles className="w-3.5 h-3.5" />Run Intelligence Analysis
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {patterns.slice(0, 6).map(pattern => (
              <div key={pattern.id} className="p-4 rounded-2xl border border-border bg-card hover:border-blue-500/20 transition-colors">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                    {patternIcon(pattern.patternType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground leading-snug">{pattern.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-semibold text-blue-500 capitalize">{pattern.patternType.replace(/_/g, " ")}</span>
                      <span className="text-[10px] text-muted-foreground/50">{Math.round(pattern.confidence * 100)}% confidence</span>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{pattern.description}</p>
                {/* Confidence bar */}
                <div className="mt-3 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.round(pattern.confidence * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Strategic Recommendations ─────────────────────────────────────── */}
      <div>
        <div className="mb-4">
          <h3 className="text-sm font-bold text-foreground">Strategic Recommendations</h3>
          <p className="text-xs text-muted-foreground mt-0.5">AI-generated actions ranked by impact and urgency</p>
        </div>

        {dashLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl border border-border bg-card animate-pulse" />)}
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-8 rounded-2xl border border-dashed border-border">
            <Zap className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No recommendations yet — run the intelligence analysis to generate strategic actions.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recommendations.slice(0, 8).map(rec => {
              const pStyle = recPriority(rec.priority);
              return (
                <div key={rec.id} className="flex items-start gap-3 p-4 rounded-xl border border-border/60 bg-card hover:border-orange-500/20 transition-colors group">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border shrink-0 mt-0.5 ${pStyle.color}`}>
                    {pStyle.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground leading-snug mb-0.5">{rec.title}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{rec.description}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="h-1 w-8 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.round(rec.confidence * 100)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Most Referenced Knowledge ─────────────────────────────────────── */}
      {topMemories.length > 0 && (
        <div>
          <div className="mb-4">
            <h3 className="text-sm font-bold text-foreground">Most Referenced Knowledge</h3>
            <p className="text-xs text-muted-foreground mt-0.5">What your AI references most often when working for you</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topMemories.slice(0, 6).map(m => {
              const catConfig = CATEGORIES[m.category] ?? CATEGORIES.general;
              const CatIcon = catConfig.Icon;
              return (
                <div key={m.id} className="p-4 rounded-xl border border-border/60 bg-card hover:border-orange-500/20 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                      <CatIcon className="w-3.5 h-3.5 text-orange-500" />
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground capitalize">{catConfig.label}</span>
                    <span className="ml-auto flex items-center gap-0.5 text-[10px] text-muted-foreground/50">
                      <Eye className="w-3 h-3" />{m.usageCount}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-foreground leading-snug line-clamp-2">{m.title}</p>
                  {m.aiSummary && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{m.aiSummary}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Knowledge Library (collapsible) ──────────────────────────────── */}
      <div className="rounded-2xl border border-border overflow-hidden">
        <button
          onClick={() => setLibraryExpanded(v => !v)}
          className="w-full flex items-center justify-between gap-4 p-5 hover:bg-accent/40 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <Brain className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Knowledge Library</p>
              <p className="text-xs text-muted-foreground">{dashboard?.totalMemories ?? 0} entries · Browse and manage everything your business brain knows</p>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${libraryExpanded ? "rotate-180" : ""}`} />
        </button>

        {libraryExpanded && (
          <div className="border-t border-border p-5 space-y-5">
            {/* Search + filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search your knowledge…"
                  className="pl-8 h-9 text-xs"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {/* View filter */}
              <div className="flex items-center gap-1">
                {(["all", "pinned", "favourite", "archived"] as ActiveView[]).map(v => (
                  <button key={v} onClick={() => setActiveView(v)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                      activeView === v ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}>
                    {v}
                  </button>
                ))}
              </div>
              {/* Category filter */}
              <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
                className="h-9 px-2.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="">All categories</option>
                {Object.entries(CATEGORIES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>

            {/* Memory entries */}
            {memLoading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />Loading…
              </div>
            ) : error ? (
              <p className="text-sm text-red-500 py-4">{error}</p>
            ) : memories.length === 0 ? (
              <div className="text-center py-10">
                <Brain className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  {search ? "No entries match your search." : activeView !== "all" ? `No ${activeView} entries yet.` : "Your knowledge library is empty — it grows as you use Research, AI Coach, and other features."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {memories.map(mem => {
                  const catConfig = CATEGORIES[mem.category] ?? CATEGORIES.general;
                  const CatIcon = catConfig.Icon;
                  return (
                    <div key={mem.id} className="group flex items-start gap-3 p-3.5 rounded-xl border border-border/60 bg-background hover:border-orange-500/20 transition-colors">
                      <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <CatIcon className="w-3.5 h-3.5 text-orange-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 mb-0.5">
                          <p className="text-xs font-semibold text-foreground flex-1 leading-snug">{mem.title}</p>
                          <span className="text-[10px] text-muted-foreground/50 shrink-0">{fmtRelative(mem.updatedAt)}</span>
                        </div>
                        {mem.aiSummary && <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{mem.aiSummary}</p>}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[9px] font-semibold text-muted-foreground/50 capitalize">{catConfig.label}</span>
                          <span className="text-[9px] text-muted-foreground/30">·</span>
                          <span className="text-[9px] text-muted-foreground/50 capitalize">{mem.source.replace(/_/g, " ")}</span>
                          {mem.usageCount > 0 && (
                            <>
                              <span className="text-[9px] text-muted-foreground/30">·</span>
                              <span className="flex items-center gap-0.5 text-[9px] text-orange-500/70">
                                <Eye className="w-2.5 h-2.5" />{mem.usageCount}× referenced
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => void updateMemory(mem.id, { memoryType: mem.memoryType === "pinned" ? "automatic" : "pinned" })}
                          className={`p-1 rounded-lg transition-colors ${mem.memoryType === "pinned" ? "text-orange-500" : "text-muted-foreground hover:text-orange-500"}`}>
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => void updateMemory(mem.id, { memoryType: mem.memoryType === "favourite" ? "automatic" : "favourite" })}
                          className={`p-1 rounded-lg transition-colors ${mem.memoryType === "favourite" ? "text-amber-500" : "text-muted-foreground hover:text-amber-500"}`}>
                          <Star className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => void updateMemory(mem.id, { memoryType: mem.memoryType === "archived" ? "automatic" : "archived" })}
                          className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => void deleteMemory(mem.id)}
                          className="p-1 rounded-lg text-muted-foreground hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
