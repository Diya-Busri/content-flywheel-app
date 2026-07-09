"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Brain, Search, Pin, Star, Archive, Trash2, Plus, X,
  BookOpen, FlaskConical, BarChart2, Package, Pencil, Target,
  StickyNote, Sparkles, Loader2, ChevronDown, Check,
  Megaphone, Clock, TrendingUp, RefreshCw, DatabaseZap,
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
  confidenceScore: number;
  createdAt: string;
  updatedAt: string;
}

type ActiveView = "all" | "pinned" | "favourite" | "archived";
type SaveState = "idle" | "saving" | "saved" | "error";

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

const SOURCE_LABELS: Record<string, string> = {
  coach:       "AI Coach",
  research:    "Research",
  analytics:   "Analytics",
  design:      "Design Studio",
  product:     "Product Studio",
  experiment:  "Experiments",
  marketplace: "Marketplace",
  notes:       "Notes",
  manual:      "Manual",
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

  const displayText = entry.aiSummary ?? entry.content;
  const isLong = displayText.length > 200;

  return (
    <div className={`group relative rounded-2xl border bg-card p-4 transition-all hover:border-purple-500/30 hover:shadow-sm ${isPinned ? "border-amber-400/50 bg-amber-500/5" : isFav ? "border-purple-400/50 bg-purple-500/5" : isArchived ? "border-border/40 opacity-60" : "border-border"}`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isPinned ? "bg-amber-500/15" : isFav ? "bg-purple-500/15" : "bg-muted/60"}`}>
          <CatIcon className={`w-3.5 h-3.5 ${isPinned ? "text-amber-600 dark:text-amber-400" : isFav ? "text-purple-500" : "text-muted-foreground"}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <p className="text-sm font-semibold text-foreground leading-tight flex-1 pr-2">{entry.title}</p>
            {isPinned && <Pin className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />}
            {isFav && <Star className="w-3 h-3 text-purple-500 fill-purple-500 shrink-0 mt-0.5" />}
          </div>

          {/* Summary / Content */}
          <div className="mt-1.5">
            <p className={`text-xs text-muted-foreground leading-relaxed ${!expanded && isLong ? "line-clamp-2" : ""}`}>
              {displayText}
            </p>
            {isLong && (
              <button onClick={() => setExpanded(e => !e)} className="text-[10px] text-purple-500 font-medium mt-0.5 flex items-center gap-0.5">
                {expanded ? "Show less" : "Show more"}
                <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[9px] font-medium bg-muted/60 px-1.5 py-0.5 rounded-full text-muted-foreground capitalize">
              {catMeta?.label ?? entry.category}
            </span>
            {entry.source && (
              <span className="text-[9px] text-muted-foreground/60">
                via {SOURCE_LABELS[entry.source] ?? entry.source}
              </span>
            )}
            {entry.usageCount > 0 && (
              <span className="text-[9px] text-purple-500/70 flex items-center gap-0.5">
                <TrendingUp className="w-2.5 h-2.5" />
                used {entry.usageCount}×
              </span>
            )}
            <span className="text-[9px] text-muted-foreground/40 ml-auto">{fmtRelative(entry.updatedAt)}</span>
          </div>
        </div>
      </div>

      {/* Action row — visible on hover */}
      <div className="flex items-center gap-1 mt-3 pt-2.5 border-t border-border/40 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onPin(entry.id, entry.memoryType)}
          className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-colors ${isPinned ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}
          title={isPinned ? "Unpin" : "Pin"}
        >
          <Pin className="w-3 h-3" />{isPinned ? "Pinned" : "Pin"}
        </button>
        <button
          onClick={() => onFavourite(entry.id, entry.memoryType)}
          className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-colors ${isFav ? "bg-purple-500/15 text-purple-600 dark:text-purple-400" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}
          title={isFav ? "Unfavourite" : "Favourite"}
        >
          <Star className="w-3 h-3" />{isFav ? "Saved" : "Save"}
        </button>
        <button
          onClick={() => onArchive(entry.id, entry.memoryType)}
          className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-colors ${isArchived ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}
          title={isArchived ? "Restore" : "Archive"}
        >
          <Archive className="w-3 h-3" />{isArchived ? "Restore" : "Archive"}
        </button>
        <button
          onClick={() => onDelete(entry.id)}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors ml-auto"
          title="Delete permanently"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Add Memory Form ──────────────────────────────────────────────────────────

function AddMemoryForm({ onSave, onCancel }: { onSave: (data: Partial<UserMemoryEntry>) => Promise<void>; onCancel: () => void }) {
  const [category, setCategory] = useState("notes");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ category, type: "note", title: title.trim(), content: content.trim(), source: "manual", memoryType: "pinned" });
      setTitle(""); setContent(""); setSaving(false); onCancel();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <DatabaseZap className="w-4 h-4 text-purple-500" />
        <span className="text-sm font-bold text-foreground">Add Memory</span>
        <button onClick={onCancel} className="ml-auto text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
      {/* Category picker */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(CATEGORIES).map(([key, meta]) => {
          const Icon = meta.Icon;
          return (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-colors ${category === key ? "bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}
            >
              <Icon className="w-3 h-3" />{meta.label}
            </button>
          );
        })}
      </div>
      <Input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="What do you want to remember?"
        className="text-sm"
        onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSubmit()}
      />
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Details, context, or notes... (optional)"
        rows={3}
        className="w-full text-sm bg-background border border-input rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500/50 text-foreground placeholder:text-muted-foreground"
      />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-xs text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted/60">Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={!title.trim() || saving}
          className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          {saving ? "Saving…" : "Save to Memory"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UserMemoryTab() {
  const [entries, setEntries] = useState<UserMemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [activeView, setActiveView] = useState<ActiveView>("all");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [searchResults, setSearchResults] = useState<UserMemoryEntry[] | null>(null);
  const [searching, setSearching] = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (activeCategory) params.set("category", activeCategory);
      if (activeView !== "all") params.set("memoryType", activeView);
      const res = await fetch(`/api/user-memory?${params}`);
      const data = await res.json() as UserMemoryEntry[];
      setEntries(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [activeCategory, activeView]);

  useEffect(() => { void load(); }, [load]);

  // ── Semantic search ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults(null); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch("/api/user-memory/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQ, limit: 20, excludeArchived: false }),
        });
        const data = await res.json() as UserMemoryEntry[];
        setSearchResults(Array.isArray(data) ? data : []);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 450);
    return () => clearTimeout(t);
  }, [searchQ]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const updateMemoryType = useCallback(async (id: string, newType: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, memoryType: newType as UserMemoryEntry["memoryType"] } : e));
    await fetch("/api/user-memory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, memoryType: newType }),
    }).catch(() => {});
  }, []);

  const handlePin = useCallback(async (id: string, current: string) => {
    await updateMemoryType(id, current === "pinned" ? "automatic" : "pinned");
  }, [updateMemoryType]);

  const handleFavourite = useCallback(async (id: string, current: string) => {
    await updateMemoryType(id, current === "favourite" ? "automatic" : "favourite");
  }, [updateMemoryType]);

  const handleArchive = useCallback(async (id: string, current: string) => {
    await updateMemoryType(id, current === "archived" ? "automatic" : "archived");
  }, [updateMemoryType]);

  const handleDelete = useCallback(async (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    await fetch(`/api/user-memory?id=${id}`, { method: "DELETE" }).catch(() => {});
  }, []);

  const handleSaveNew = useCallback(async (data: Partial<UserMemoryEntry>) => {
    setSaveState("saving");
    try {
      const res = await fetch("/api/user-memory/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data }),
      });
      const entry = await res.json() as UserMemoryEntry;
      setEntries(prev => [entry, ...prev]);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2000);
    }
  }, []);

  // ── Derived state ──────────────────────────────────────────────────────────
  const displayEntries = searchResults ?? entries;
  const totalByCategory = Object.keys(CATEGORIES).reduce<Record<string, number>>((acc, key) => {
    acc[key] = entries.filter(e => e.category === key).length;
    return acc;
  }, {});
  const pinnedCount = entries.filter(e => e.memoryType === "pinned").length;
  const favCount = entries.filter(e => e.memoryType === "favourite").length;

  const VIEWS: { key: ActiveView; label: string; count?: number }[] = [
    { key: "all",      label: "All",       count: entries.length },
    { key: "pinned",   label: "Pinned",    count: pinnedCount },
    { key: "favourite",label: "Saved",     count: favCount },
    { key: "archived", label: "Archived" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-500" />
            Your AI Memory
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Everything the AI has learned about your business — automatically captured and continuously improving.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            className="p-2 rounded-xl border border-border hover:bg-muted/60 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => setShowAddForm(s => !s)}
            className="flex items-center gap-1.5 text-sm font-semibold bg-purple-600 text-white px-3 py-2 rounded-xl hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />Add Memory
          </button>
        </div>
      </div>

      {/* Stats row */}
      {!loading && entries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total memories",      value: entries.length,                              color: "text-foreground" },
            { label: "Used by AI",          value: entries.filter(e => e.usageCount > 0).length, color: "text-purple-500" },
            { label: "Pinned / Saved",      value: pinnedCount + favCount,                      color: "text-amber-500" },
            { label: "Sources",             value: new Set(entries.map(e => e.source)).size,     color: "text-blue-500" },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-3 text-center">
              <p className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <AddMemoryForm
          onSave={handleSaveNew}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          placeholder="Search your memories semantically…"
          className="pl-9 pr-9"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
        {searchQ && !searching && (
          <button onClick={() => setSearchQ("")} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {!searchQ && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* View tabs */}
          <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1">
            {VIEWS.map(v => (
              <button
                key={v.key}
                onClick={() => setActiveView(v.key)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${activeView === v.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {v.label}{v.count !== undefined ? ` (${v.count})` : ""}
              </button>
            ))}
          </div>

          {/* Category filter chips */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setActiveCategory(null)}
              className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${!activeCategory ? "bg-purple-500/15 text-purple-600 dark:text-purple-400" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}
            >
              All categories
            </button>
            {Object.entries(CATEGORIES).filter(([key]) => totalByCategory[key] > 0).map(([key, meta]) => {
              const Icon = meta.Icon;
              return (
                <button
                  key={key}
                  onClick={() => setActiveCategory(activeCategory === key ? null : key)}
                  className={`flex items-center gap-1 text-[10px] font-medium px-2.5 py-1.5 rounded-lg transition-colors ${activeCategory === key ? "bg-purple-500/15 text-purple-600 dark:text-purple-400" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}
                >
                  <Icon className="w-3 h-3" />
                  {meta.label}
                  <span className="tabular-nums">{totalByCategory[key]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search result label */}
      {searchQ && searchResults !== null && (
        <p className="text-xs text-muted-foreground">
          {searching ? "Searching…" : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} for "${searchQ}"`}
        </p>
      )}

      {/* Empty state */}
      {!loading && displayEntries.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
            <Brain className="w-8 h-8 text-purple-500" />
          </div>
          {searchQ ? (
            <>
              <p className="text-sm font-semibold text-foreground">No memories found</p>
              <p className="text-xs text-muted-foreground mt-1">Try a different search or add a memory manually.</p>
            </>
          ) : entries.length === 0 ? (
            <>
              <p className="text-sm font-semibold text-foreground">Your memory is empty</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                As you use Content Flywheel — chat with the AI Coach, run research, create products — everything important gets saved here automatically.
              </p>
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-4 text-xs bg-purple-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-purple-700 transition-colors inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />Add your first memory
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">Nothing here</p>
              <p className="text-xs text-muted-foreground mt-1">Try a different filter or category.</p>
            </>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      )}

      {/* Entries grid */}
      {!loading && displayEntries.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {displayEntries.map(entry => (
            <MemoryCard
              key={entry.id}
              entry={entry}
              onPin={handlePin}
              onFavourite={handleFavourite}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Save feedback toast */}
      {saveState === "saved" && (
        <div className="fixed bottom-6 right-6 bg-purple-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <Check className="w-3.5 h-3.5" />Saved to memory
        </div>
      )}
    </div>
  );
}
