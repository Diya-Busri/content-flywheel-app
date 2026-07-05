"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Brain, Search, Pin, Star, Archive, Trash2, Plus, X,
  BookOpen, FlaskConical, BarChart2, Package, Pencil, Target,
  StickyNote, Sparkles, Loader2, ChevronDown, Check,
  Megaphone, TrendingUp, RefreshCw, DatabaseZap, Lightbulb,
  Zap, AlertTriangle, ArrowRight, Clock, Activity,
  ChevronRight, BarChart, Eye,
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

interface TimelineEvent {
  id: string;
  eventType: string;
  title: string;
  description: string | null;
  createdAt: string;
}

interface DashboardData {
  knowledgeScore: number;
  totalMemories: number;
  memoriesThisWeek: number;
  memoriesCreatedToday: number;
  patternsDetected: number;
  recommendationsAvailable: number;
  averageConfidence: number;
  categoryCounts: Record<string, number>;
  mostReferenced: { id: string; title: string; category: string; usageCount: number }[];
  patterns: Pattern[];
  recommendations: Recommendation[];
  timeline: TimelineEvent[];
  topMemories: { id: string; category: string; title: string; aiSummary: string | null; combinedScore: number; usageCount: number }[];
}

type ActiveView = "all" | "pinned" | "favourite" | "archived";

// ─── Category config ─────────────────────────────────────────────────────────

const CATEGORIES: Record<string, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  research:    { label: "Research",    Icon: Search },
  products:    { label: "Products",    Icon: Package },
  content:     { label: "Content",     Icon: Pencil },
  design:      { label: "Design",      Icon: Sparkles },
  analytics:   { label: "Analytics",   Icon: BarChart2 },
  experiments: { label: "Experiments", Icon: FlaskConical },
  brand:       { label: "Brand",       Icon: Megaphone },
  goals:       { label: "Goals",       Icon: Target },
  notes:       { label: "Notes",       Icon: StickyNote },
  coaching:    { label: "Coaching",    Icon: Brain },
};

const PATTERN_TYPE_COLORS: Record<string, string> = {
  content:   "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  product:   "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  design:    "bg-pink-500/15 text-pink-600 dark:text-pink-400",
  analytics: "bg-green-500/15 text-green-600 dark:text-green-400",
  behavior:  "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  pricing:   "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

const REC_TYPE_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  action:      { icon: Zap,           color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20" },
  insight:     { icon: Lightbulb,     color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  opportunity: { icon: TrendingUp,    color: "text-green-600 dark:text-green-400",  bg: "bg-green-500/10 border-green-500/20" },
  warning:     { icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-500/10 border-amber-500/20" },
};

const TIMELINE_ICONS: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  memory_saved:       { icon: DatabaseZap, color: "text-purple-500" },
  memory_merged:      { icon: Activity,    color: "text-blue-500" },
  pattern_detected:   { icon: Brain,       color: "text-violet-500" },
  recommendation_generated: { icon: Lightbulb, color: "text-amber-500" },
  score_updated:      { icon: BarChart,    color: "text-green-500" },
};

const SOURCE_LABELS: Record<string, string> = {
  coach: "AI Coach", research: "Research", analytics: "Analytics",
  design: "Design Studio", product: "Product Studio", experiment: "Experiments",
  marketplace: "Marketplace", notes: "Notes", manual: "Manual",
};

function fmtRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function ScoreRing({ score, size = 40 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circumference = 2 * Math.PI * r;
  const fill = circumference * (1 - score);
  const color = score >= 0.7 ? "#8b5cf6" : score >= 0.4 ? "#6366f1" : "#a1a1aa";
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={3} className="text-muted/30" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={circumference} strokeDashoffset={fill} strokeLinecap="round" />
    </svg>
  );
}

// ─── Intelligence Dashboard ───────────────────────────────────────────────────

function IntelligenceDashboard({
  data, onRunPipeline, running,
}: {
  data: DashboardData | null;
  onRunPipeline: () => void;
  running: boolean;
}) {
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [showAllTimeline, setShowAllTimeline] = useState(false);

  const handleDismiss = async (id: string) => {
    setDismissing(id);
    try {
      await fetch("/api/intelligence/recommendations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setDismissed(prev => new Set(Array.from(prev).concat(id)));
    } catch { /* ignore */ }
    setDismissing(null);
  };

  if (!data) {
    // API failed or returned no data — show empty state, NOT skeleton
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
          <Brain className="w-7 h-7 text-purple-500/60" />
        </div>
        <p className="text-sm font-semibold text-foreground">Intelligence unavailable</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
          Use the AI Coach, run research, or create products — the brain learns from everything automatically.
        </p>
        <button
          onClick={onRunPipeline}
          disabled={running}
          className="mt-4 inline-flex items-center gap-1.5 text-xs bg-purple-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
          {running ? "Analysing…" : "Analyse Now"}
        </button>
      </div>
    );
  }

  const activeRecs = data.recommendations.filter(r => !dismissed.has(r.id));
  const timeline = showAllTimeline ? data.timeline : data.timeline.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Knowledge Score — featured */}
        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-violet-500/5 p-4 flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 shrink-0">
            <ScoreRing score={data.knowledgeScore / 100} size={40} />
            <span className="absolute text-[9px] font-black text-foreground">{data.knowledgeScore}</span>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Knowledge Score</p>
            <p className="text-xs font-bold text-foreground">
              {data.knowledgeScore >= 70 ? "Strong" : data.knowledgeScore >= 40 ? "Growing" : "Early"}
            </p>
          </div>
        </div>

        {[
          { label: "Memories",       value: data.totalMemories,            sub: data.memoriesCreatedToday > 0 ? `+${data.memoriesCreatedToday} today` : `+${data.memoriesThisWeek} this week`, color: "text-foreground" },
          { label: "Patterns",       value: data.patternsDetected,         sub: "detected",                            color: "text-violet-500" },
          { label: "Suggestions",    value: data.recommendationsAvailable, sub: "waiting",                             color: "text-blue-500" },
          { label: "AI Confidence",  value: `${Math.round(data.averageConfidence * 100)}%`, sub: "average",            color: "text-green-500" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
            <p className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
            <p className="text-[9px] text-muted-foreground/50">{s.sub}</p>
          </div>
        ))}

        {/* Run pipeline button */}
        <button
          onClick={onRunPipeline}
          disabled={running}
          className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4 flex flex-col items-center justify-center gap-1.5 hover:bg-purple-500/10 transition-colors disabled:opacity-50 group"
        >
          {running
            ? <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
            : <Activity className="w-5 h-5 text-purple-500 group-hover:scale-110 transition-transform" />}
          <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 text-center">
            {running ? "Analysing…" : "Analyse Now"}
          </p>
        </button>
      </div>

      {/* Most Referenced */}
      {data.mostReferenced.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Most Referenced</p>
          <div className="flex flex-wrap gap-2">
            {data.mostReferenced.map(m => {
              const catMeta = CATEGORIES[m.category];
              const Icon = catMeta?.Icon ?? BookOpen;
              return (
                <div key={m.id} className="flex items-center gap-1.5 text-[10px] bg-muted/50 border border-border px-2.5 py-1.5 rounded-xl">
                  <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-foreground/80 font-medium truncate max-w-[140px]">{m.title}</span>
                  <span className="text-purple-500 font-bold shrink-0">{m.usageCount}×</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Patterns */}
      {data.patterns.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Detected Patterns</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.patterns.map(p => (
              <div key={p.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${PATTERN_TYPE_COLORS[p.patternType] ?? "bg-muted text-muted-foreground"}`}>
                      {p.patternType}
                    </span>
                  </div>
                  {/* Confidence indicator */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className={`w-1 h-2 rounded-full ${i < Math.round(p.confidence * 5) ? "bg-purple-500" : "bg-muted/40"}`} />
                    ))}
                  </div>
                </div>
                <p className="text-xs font-semibold text-foreground leading-tight">{p.title}</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">{p.description}</p>
                {p.evidence.length > 0 && (
                  <p className="text-[9px] text-muted-foreground/50 italic line-clamp-1">
                    {p.evidence[0]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {activeRecs.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">AI Suggestions</p>
          <div className="space-y-2">
            {activeRecs.map(r => {
              const config = REC_TYPE_CONFIG[r.recType] ?? REC_TYPE_CONFIG.insight;
              const Icon = config.icon;
              return (
                <div key={r.id} className={`rounded-xl border p-3 ${config.bg}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-background/60 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <p className="text-xs font-bold text-foreground flex-1">{r.title}</p>
                        <span className="text-[9px] font-bold text-muted-foreground/60 shrink-0">P{r.priority}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{r.description}</p>
                      {r.actionType && (
                        <button className={`mt-2 flex items-center gap-1 text-[10px] font-semibold ${config.color}`}>
                          Take action <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => handleDismiss(r.id)}
                      disabled={dismissing === r.id}
                      className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                    >
                      {dismissing === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Learning Timeline */}
      {data.timeline.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Learning Timeline</p>
            {data.timeline.length > 5 && (
              <button onClick={() => setShowAllTimeline(s => !s)} className="text-[10px] text-purple-500 font-medium">
                {showAllTimeline ? "Show less" : `Show all ${data.timeline.length}`}
              </button>
            )}
          </div>
          <div className="space-y-1">
            {timeline.map(event => {
              const { icon: EventIcon, color } = TIMELINE_ICONS[event.eventType] ?? TIMELINE_ICONS.memory_saved;
              return (
                <div key={event.id} className="flex items-start gap-2.5 py-1.5">
                  <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-muted/40`}>
                    <EventIcon className={`w-3 h-3 ${color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground/80 leading-tight">{event.title}</p>
                    {event.description && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{event.description}</p>
                    )}
                  </div>
                  <span className="text-[9px] text-muted-foreground/40 shrink-0 tabular-nums">{fmtRelative(event.createdAt)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Memory Card ─────────────────────────────────────────────────────────────

function MemoryCard({
  entry,
  onPin, onFavourite, onArchive, onDelete,
}: {
  entry: UserMemoryEntry;
  onPin: (id: string, current: string) => void;
  onFavourite: (id: string, current: string) => void;
  onArchive: (id: string, current: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const catMeta = CATEGORIES[entry.category];
  const CatIcon = catMeta?.Icon ?? BookOpen;
  const isPinned = entry.memoryType === "pinned";
  const isFav = entry.memoryType === "favourite";
  const isArchived = entry.memoryType === "archived";
  const score = entry.combinedScore ?? 0.5;

  const displayText = entry.aiSummary ?? entry.content;
  const isLong = displayText.length > 180;

  return (
    <div className={`group relative rounded-2xl border bg-card p-3.5 transition-all hover:border-purple-500/30 hover:shadow-sm ${isPinned ? "border-amber-400/40 bg-amber-500/5" : isFav ? "border-purple-400/40 bg-purple-500/5" : isArchived ? "border-border/40 opacity-60" : "border-border"}`}>
      {/* Score bar — top edge */}
      <div className="absolute top-0 left-3 right-3 h-0.5 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-purple-400 rounded-full transition-all"
          style={{ width: `${Math.round(score * 100)}%` }}
        />
      </div>

      <div className="flex items-start gap-2.5 mt-1">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isPinned ? "bg-amber-500/15" : isFav ? "bg-purple-500/15" : "bg-muted/60"}`}>
          <CatIcon className={`w-3.5 h-3.5 ${isPinned ? "text-amber-600 dark:text-amber-400" : isFav ? "text-purple-500" : "text-muted-foreground"}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1.5">
            <p className="text-xs font-semibold text-foreground leading-tight flex-1">{entry.title}</p>
            {isPinned && <Pin className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />}
            {isFav && <Star className="w-3 h-3 text-purple-500 fill-purple-500 shrink-0 mt-0.5" />}
          </div>

          <p className={`text-[10px] text-muted-foreground leading-relaxed mt-1 ${!expanded && isLong ? "line-clamp-2" : ""}`}>
            {displayText}
          </p>
          {isLong && (
            <button onClick={() => setExpanded(e => !e)} className="text-[9px] text-purple-500 mt-0.5 flex items-center gap-0.5">
              {expanded ? "Less" : "More"}<ChevronDown className={`w-2.5 h-2.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          )}

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[9px] bg-muted/60 px-1.5 py-0.5 rounded-full text-muted-foreground capitalize">
              {catMeta?.label ?? entry.category}
            </span>
            {entry.usageCount > 0 && (
              <span className="text-[9px] text-purple-500/70 flex items-center gap-0.5">
                <Eye className="w-2.5 h-2.5" />{entry.usageCount}×
              </span>
            )}
            <span className="text-[9px] text-muted-foreground/40 ml-auto tabular-nums">{fmtRelative(entry.updatedAt)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 mt-2.5 pt-2 border-t border-border/40 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onPin(entry.id, entry.memoryType)} className={`flex items-center gap-1 text-[9px] px-1.5 py-1 rounded-lg transition-colors ${isPinned ? "bg-amber-500/15 text-amber-600" : "text-muted-foreground hover:bg-muted/60"}`} title="Pin">
          <Pin className="w-2.5 h-2.5" />{isPinned ? "Pinned" : "Pin"}
        </button>
        <button onClick={() => onFavourite(entry.id, entry.memoryType)} className={`flex items-center gap-1 text-[9px] px-1.5 py-1 rounded-lg transition-colors ${isFav ? "bg-purple-500/15 text-purple-600" : "text-muted-foreground hover:bg-muted/60"}`} title="Save">
          <Star className="w-2.5 h-2.5" />{isFav ? "Saved" : "Save"}
        </button>
        <button onClick={() => onArchive(entry.id, entry.memoryType)} className={`flex items-center gap-1 text-[9px] px-1.5 py-1 rounded-lg transition-colors ${isArchived ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"}`} title="Archive">
          <Archive className="w-2.5 h-2.5" />{isArchived ? "Restore" : "Archive"}
        </button>
        <button onClick={() => onDelete(entry.id)} className="ml-auto text-muted-foreground hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-500/10">
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Add Memory Form ──────────────────────────────────────────────────────────

function AddMemoryForm({ onSave, onCancel }: { onSave: (data: Record<string, unknown>) => Promise<void>; onCancel: () => void }) {
  const [category, setCategory] = useState("notes");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Brain className="w-4 h-4 text-purple-500" />
        <span className="text-sm font-bold text-foreground">Add Knowledge</span>
        <button onClick={onCancel} className="ml-auto text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(CATEGORIES).map(([key, meta]) => {
          const Icon = meta.Icon;
          return (
            <button key={key} onClick={() => setCategory(key)}
              className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-colors ${category === key ? "bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}>
              <Icon className="w-3 h-3" />{meta.label}
            </button>
          );
        })}
      </div>
      <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="What should your Business Brain remember?" className="text-sm" onKeyDown={async e => { if (e.key === "Enter" && !e.shiftKey && title.trim()) { setSaving(true); await onSave({ category, type: "note", title, content, source: "manual", memoryType: "pinned" }); setSaving(false); onCancel(); }}} />
      <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Details, context, why it matters... (optional)" rows={3}
        className="w-full text-sm bg-background border border-input rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500/50 text-foreground placeholder:text-muted-foreground" />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-xs text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted/60">Cancel</button>
        <button onClick={async () => { if (!title.trim()) return; setSaving(true); await onSave({ category, type: "note", title, content, source: "manual", memoryType: "pinned" }); setSaving(false); onCancel(); }}
          disabled={!title.trim() || saving}
          className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
          {saving ? "Teaching Brain…" : "Teach Business Brain"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BusinessBrainTab() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [entries, setEntries] = useState<UserMemoryEntry[]>([]);
  const [memLoading, setMemLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [activeView, setActiveView] = useState<ActiveView>("all");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchResults, setSearchResults] = useState<UserMemoryEntry[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [activeSection, setActiveSection] = useState<"dashboard" | "memories">("dashboard");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load Dashboard ──────────────────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    try {
      const res = await fetch("/api/intelligence/dashboard");
      if (res.ok) setDashboard(await res.json() as DashboardData);
    } catch { /* ignore */ }
    setDashLoading(false);
  }, []);

  // ── Load Memories ──────────────────────────────────────────────────────────
  const loadMemories = useCallback(async () => {
    setMemLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (activeCategory) params.set("category", activeCategory);
      if (activeView !== "all") params.set("memoryType", activeView);
      const res = await fetch(`/api/user-memory?${params}`);
      const data = await res.json() as UserMemoryEntry[];
      // Sort by combined_score desc (already from DB, but ensure)
      setEntries(Array.isArray(data) ? [...data].sort((a, b) => (b.combinedScore ?? 0) - (a.combinedScore ?? 0)) : []);
    } catch { /* ignore */ }
    setMemLoading(false);
  }, [activeCategory, activeView]);

  useEffect(() => { void loadDashboard(); void loadMemories(); }, [loadDashboard, loadMemories]);

  // ── Semantic search ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults(null); return; }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch("/api/user-memory/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQ, limit: 20, excludeArchived: false }),
        });
        const raw = await res.json();
        setSearchResults(Array.isArray(raw) ? raw as UserMemoryEntry[] : []);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 450);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQ]);

  // ── Run Intelligence Pipeline ──────────────────────────────────────────────
  const handleRunPipeline = useCallback(async () => {
    setPipelineRunning(true);
    try {
      await fetch("/api/intelligence/run", { method: "POST" });
      // Wait 3 seconds for async ops then reload
      await new Promise(r => setTimeout(r, 3000));
      await loadDashboard();
    } catch { /* ignore */ }
    setPipelineRunning(false);
  }, [loadDashboard]);

  // ── Memory actions ─────────────────────────────────────────────────────────
  const updateMemoryType = useCallback(async (id: string, newType: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, memoryType: newType as UserMemoryEntry["memoryType"] } : e));
    await fetch("/api/user-memory", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, memoryType: newType }) }).catch(() => {});
  }, []);

  const handlePin = useCallback((id: string, c: string) => updateMemoryType(id, c === "pinned" ? "automatic" : "pinned"), [updateMemoryType]);
  const handleFavourite = useCallback((id: string, c: string) => updateMemoryType(id, c === "favourite" ? "automatic" : "favourite"), [updateMemoryType]);
  const handleArchive = useCallback((id: string, c: string) => updateMemoryType(id, c === "archived" ? "automatic" : "archived"), [updateMemoryType]);
  const handleDelete = useCallback(async (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    await fetch(`/api/user-memory?id=${id}`, { method: "DELETE" }).catch(() => {});
  }, []);

  const handleSaveNew = useCallback(async (data: Record<string, unknown>) => {
    const res = await fetch("/api/user-memory/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) { setShowAddForm(false); return; }
    const entry = await res.json() as UserMemoryEntry;
    if (entry?.id) setEntries(prev => [entry, ...prev]);
    setShowAddForm(false);
    void loadDashboard();
  }, [loadDashboard]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const displayEntries = searchResults ?? entries;
  const totalByCategory = Object.keys(CATEGORIES).reduce<Record<string, number>>((acc, key) => {
    acc[key] = entries.filter(e => e.category === key).length;
    return acc;
  }, {});
  const pinnedCount = entries.filter(e => e.memoryType === "pinned").length;
  const favCount = entries.filter(e => e.memoryType === "favourite").length;

  const VIEWS: { key: ActiveView; label: string; count?: number }[] = [
    { key: "all",       label: "All",     count: entries.length },
    { key: "pinned",    label: "Pinned",  count: pinnedCount },
    { key: "favourite", label: "Saved",   count: favCount },
    { key: "archived",  label: "Archived" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-500" />
            Business Brain
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            An AI that continuously learns your business — getting smarter with every interaction.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { void loadDashboard(); void loadMemories(); }} className="p-2 rounded-xl border border-border hover:bg-muted/60 transition-colors" title="Refresh">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={() => setShowAddForm(s => !s)} className="flex items-center gap-1.5 text-sm font-semibold bg-purple-600 text-white px-3 py-2 rounded-xl hover:bg-purple-700 transition-colors">
            <Plus className="w-4 h-4" />Teach Brain
          </button>
        </div>
      </div>

      {/* Section nav */}
      <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 w-fit">
        {([
          { key: "dashboard" as const, label: "Intelligence", icon: Activity },
          { key: "memories" as const,  label: "Knowledge",   icon: DatabaseZap },
        ]).map(s => {
          const Icon = s.icon;
          return (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${activeSection === s.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="w-3.5 h-3.5" />{s.label}
            </button>
          );
        })}
      </div>

      {/* Add form */}
      {showAddForm && <AddMemoryForm onSave={handleSaveNew} onCancel={() => setShowAddForm(false)} />}

      {/* Dashboard section */}
      {activeSection === "dashboard" && (
        dashLoading
          ? <div className="space-y-3 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-2xl border border-border bg-card" />)}</div>
          : <IntelligenceDashboard data={dashboard} onRunPipeline={handleRunPipeline} running={pipelineRunning} />
      )}

      {/* Knowledge browser section */}
      {activeSection === "memories" && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search your Business Brain semantically…" className="pl-9 pr-9" />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
            {searchQ && !searching && <button onClick={() => setSearchQ("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-muted-foreground hover:text-foreground" /></button>}
          </div>

          {!searchQ && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1">
                {VIEWS.map(v => (
                  <button key={v.key} onClick={() => setActiveView(v.key)}
                    className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all ${activeView === v.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    {v.label}{v.count !== undefined ? ` (${v.count})` : ""}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <button onClick={() => setActiveCategory(null)} className={`text-[10px] font-semibold px-2 py-1.5 rounded-lg transition-colors ${!activeCategory ? "bg-purple-500/15 text-purple-600 dark:text-purple-400" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}>
                  All
                </button>
                {Object.entries(CATEGORIES).filter(([key]) => totalByCategory[key] > 0).map(([key, meta]) => {
                  const Icon = meta.Icon;
                  return (
                    <button key={key} onClick={() => setActiveCategory(activeCategory === key ? null : key)}
                      className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded-lg transition-colors ${activeCategory === key ? "bg-purple-500/15 text-purple-600 dark:text-purple-400" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}>
                      <Icon className="w-3 h-3" />{meta.label} <span className="tabular-nums">{totalByCategory[key]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {searchQ && searchResults !== null && (
            <p className="text-xs text-muted-foreground">
              {searching ? "Searching…" : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} for "${searchQ}"`}
            </p>
          )}

          {!memLoading && displayEntries.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                <Brain className="w-8 h-8 text-purple-500" />
              </div>
              {entries.length === 0 ? (
                <>
                  <p className="text-sm font-semibold text-foreground">Business Brain is empty</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Start using the AI Coach, run research, or create products — everything important gets learned automatically.
                  </p>
                  <button onClick={() => setShowAddForm(true)} className="mt-4 text-xs bg-purple-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-purple-700 transition-colors inline-flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5" />Teach it something
                  </button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing matches this filter.</p>
              )}
            </div>
          )}

          {memLoading && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => <div key={i} className="h-28 rounded-2xl border border-border bg-card animate-pulse" />)}
            </div>
          )}

          {!memLoading && displayEntries.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayEntries.map(entry => (
                <MemoryCard key={entry.id} entry={entry}
                  onPin={handlePin} onFavourite={handleFavourite}
                  onArchive={handleArchive} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
