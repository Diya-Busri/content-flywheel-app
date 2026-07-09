"use client";

/**
 * MemoryViewer
 * ──────────────────────────────────────────────────────────────────────────────
 * Full-page memory browser for a project's BusinessMemory.
 *
 * Features:
 *  — Category tabs (Brand / Audience / Products / Marketing / …)
 *  — Inline fact editing (click value to edit)
 *  — Add new fact per category
 *  — Delete individual facts
 *  — AI suggestions panel with Accept / Reject
 *  — "Extract from latest data" button (deterministic refresh)
 *  — "Ask AI to suggest" button (lightweight AI pass)
 *  — Source badges so user knows where each fact came from
 */

import { useState, useEffect, useCallback } from "react";
import {
  Brain, RefreshCw, Loader2, Plus, Trash2, Check, X,
  Sparkles, Edit3, ChevronDown, ChevronUp, Clock,
} from "lucide-react";
import type { BusinessMemory, MemoryFact, MemoryCategory } from "@/db/schema/launch-schema";

/* ─── Constants ──────────────────────────────────────────────────────────────── */

const CATEGORIES: Array<{
  id:          MemoryCategory;
  label:       string;
  emoji:       string;
  description: string;
}> = [
  { id: "brand",     label: "Brand",          emoji: "✨", description: "Name, headline, voice, positioning" },
  { id: "audience",  label: "Audience",        emoji: "👥", description: "Target buyers, objections, FAQs" },
  { id: "products",  label: "Products",        emoji: "📦", description: "What you sell, pricing, store URL" },
  { id: "marketing", label: "Marketing",       emoji: "📣", description: "Keywords, content library, channels" },
  { id: "launches",  label: "Launches",        emoji: "🚀", description: "Launch history and campaigns" },
  { id: "analytics", label: "Analytics",       emoji: "📊", description: "Scores, performance, growth" },
  { id: "ideas",     label: "Ideas",           emoji: "💡", description: "Future opportunities and experiments" },
  { id: "lessons",   label: "Lessons",         emoji: "🎓", description: "What worked, what didn't" },
  { id: "knowledge", label: "Knowledge",       emoji: "🧠", description: "Market research and competitor insights" },
];

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  auto:            { label: "auto",   color: "text-muted-foreground/40" },
  brain:           { label: "brain",  color: "text-purple-400/60" },
  mission_control: { label: "ceo ai", color: "text-orange-400/60" },
  user:            { label: "you",    color: "text-green-400/60" },
};

function getSourceDisplay(source: string) {
  if (source.startsWith("worker:")) {
    return { label: source.replace("worker:", ""), color: "text-blue-400/60" };
  }
  return SOURCE_LABELS[source] ?? { label: source, color: "text-muted-foreground/40" };
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/* ─── Subcomponents ──────────────────────────────────────────────────────────── */

interface FactRowProps {
  fact:     MemoryFact;
  onSave:   (fact: MemoryFact) => void;
  onDelete: (id: string) => void;
}

function FactRow({ fact, onSave, onDelete }: FactRowProps) {
  const [editing, setEditing]   = useState(false);
  const [editVal, setEditVal]   = useState(fact.value);
  const [editLabel, setEditLabel] = useState(fact.label);
  const src = getSourceDisplay(fact.source);

  function save() {
    if (editVal.trim() && editLabel.trim()) {
      onSave({ ...fact, label: editLabel.trim(), value: editVal.trim() });
    }
    setEditing(false);
  }

  function cancel() {
    setEditVal(fact.value);
    setEditLabel(fact.label);
    setEditing(false);
  }

  return (
    <div className={[
      "group flex items-start gap-3 px-4 py-3 rounded-xl transition-colors",
      editing ? "bg-muted/20" : "hover:bg-muted/10",
    ].join(" ")}>
      {editing ? (
        <div className="flex-1 space-y-1.5">
          <input
            className="w-full bg-muted/30 border border-border/40 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-foreground focus:outline-none focus:border-orange-500/40"
            value={editLabel}
            onChange={e => setEditLabel(e.target.value)}
            placeholder="Label"
          />
          <textarea
            className="w-full bg-muted/30 border border-border/40 rounded-lg px-3 py-2 text-[12px] text-foreground resize-none focus:outline-none focus:border-orange-500/40 min-h-[60px]"
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={save}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors">
              <Check className="w-3 h-3" /> Save
            </button>
            <button onClick={cancel}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-muted/20 text-muted-foreground/60 hover:bg-muted/30 transition-colors">
              <X className="w-3 h-3" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wide">
                {fact.label}
              </p>
              {fact.confirmedByUser && (
                <span className="text-[9px] text-green-400/60 font-bold">✓ confirmed</span>
              )}
              <span className={`text-[9px] font-medium ml-auto ${src.color}`}>{src.label}</span>
            </div>
            <p className="text-[12px] text-foreground leading-relaxed break-words">{fact.value}</p>
            <p className="text-[9px] text-muted-foreground/30 mt-0.5">{relTime(fact.updatedAt)}</p>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={() => setEditing(true)}
              className="p-1.5 rounded-lg hover:bg-muted/20 text-muted-foreground/40 hover:text-foreground transition-colors"
              title="Edit">
              <Edit3 className="w-3 h-3" />
            </button>
            <button onClick={() => onDelete(fact.id)}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground/30 hover:text-red-400 transition-colors"
              title="Delete">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

interface AddFactFormProps {
  category: MemoryCategory;
  onAdd:    (label: string, value: string) => void;
}

function AddFactForm({ category: _category, onAdd }: AddFactFormProps) {
  const [open,  setOpen]  = useState(false);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");

  function submit() {
    if (label.trim() && value.trim()) {
      onAdd(label.trim(), value.trim());
      setLabel("");
      setValue("");
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border/30 text-[11px] text-muted-foreground/40 hover:text-muted-foreground/70 hover:border-border/50 transition-colors w-full"
      >
        <Plus className="w-3.5 h-3.5" /> Add a fact
      </button>
    );
  }

  return (
    <div className="border border-border/30 rounded-xl p-4 bg-muted/10 space-y-2">
      <input
        className="w-full bg-muted/30 border border-border/40 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-foreground focus:outline-none focus:border-orange-500/40"
        value={label}
        onChange={e => setLabel(e.target.value)}
        placeholder="Label (e.g. Tone of Voice)"
        autoFocus
      />
      <textarea
        className="w-full bg-muted/30 border border-border/40 rounded-lg px-3 py-2 text-[12px] text-foreground resize-none focus:outline-none focus:border-orange-500/40 min-h-[60px]"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Value"
      />
      <div className="flex gap-2">
        <button onClick={submit}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors">
          <Check className="w-3 h-3" /> Add
        </button>
        <button onClick={() => { setOpen(false); setLabel(""); setValue(""); }}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-muted/20 text-muted-foreground/60 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ─── Suggestions Panel ──────────────────────────────────────────────────────── */

interface SuggestionsPanelProps {
  suggestions: BusinessMemory["suggestions"];
  onAccept:    (id: string) => void;
  onReject:    (id: string) => void;
}

function SuggestionsPanel({ suggestions, onAccept, onReject }: SuggestionsPanelProps) {
  const [open, setOpen] = useState(true);
  if (!suggestions?.length) return null;

  return (
    <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.03] overflow-hidden mb-5">
      <button
        className="flex items-center justify-between w-full px-5 py-4"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <p className="text-[12px] font-bold text-foreground">
            AI Suggestions
          </p>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/10 text-purple-400">
            {suggestions.length}
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground/40" /> : <ChevronDown className="w-4 h-4 text-muted-foreground/40" />}
      </button>

      {open && (
        <div className="border-t border-border/30 divide-y divide-border/20">
          {suggestions.map(s => (
            <div key={s.id} className="flex items-start gap-3 px-5 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wide">{s.label}</p>
                  <span className="text-[9px] text-purple-400/60 font-medium">{s.source}</span>
                </div>
                <p className="text-[12px] text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground/40 mt-0.5 italic">{s.reason}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                <button
                  onClick={() => onAccept(s.id)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                >
                  <Check className="w-3 h-3" /> Remember
                </button>
                <button
                  onClick={() => onReject(s.id)}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground/30 hover:text-red-400 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

interface Props {
  launchId: string;
}

export function MemoryViewer({ launchId }: Props) {
  const [memory,      setMemory]      = useState<BusinessMemory | null>(null);
  const [activeTab,   setActiveTab]   = useState<MemoryCategory>("brand");
  const [loading,     setLoading]     = useState(true);
  const [extracting,  setExtracting]  = useState(false);
  const [suggesting,  setSuggesting]  = useState(false);

  /* ── Fetch ── */
  const fetchMemory = useCallback(async () => {
    const res  = await fetch(`/api/projects/${launchId}/memory`);
    const json = await res.json() as { memory: BusinessMemory };
    setMemory(json.memory);
    setLoading(false);
  }, [launchId]);

  useEffect(() => { fetchMemory(); }, [fetchMemory]);

  /* ── Extract ── */
  async function runExtract(aiSuggest = false) {
    if (aiSuggest) setSuggesting(true); else setExtracting(true);
    try {
      const res  = await fetch(`/api/projects/${launchId}/memory/extract`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ aiSuggest }),
      });
      const json = await res.json() as { memory: BusinessMemory };
      setMemory(json.memory);
    } finally {
      setExtracting(false);
      setSuggesting(false);
    }
  }

  /* ── Upsert fact ── */
  async function upsertFact(category: MemoryCategory, key: string, label: string, value: string) {
    const res  = await fetch(`/api/projects/${launchId}/memory`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "upsert", category, key, label, value }),
    });
    const json = await res.json() as { memory: BusinessMemory };
    setMemory(json.memory);
  }

  /* ── Delete fact ── */
  async function deleteFact(factId: string) {
    const res  = await fetch(`/api/projects/${launchId}/memory`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "delete", factId }),
    });
    const json = await res.json() as { memory: BusinessMemory };
    setMemory(json.memory);
  }

  /* ── Save edited fact ── */
  async function saveFact(fact: MemoryFact) {
    await upsertFact(fact.category, fact.key, fact.label, fact.value);
  }

  /* ── Add new fact ── */
  async function addFact(label: string, value: string) {
    const key = label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    await upsertFact(activeTab, `user_${key}_${Date.now()}`, label, value);
  }

  /* ── Suggestion actions ── */
  async function handleSuggestion(suggestionId: string, action: "accept" | "reject") {
    const res  = await fetch(`/api/projects/${launchId}/memory/suggestions`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ suggestionId, action }),
    });
    const json = await res.json() as { memory: BusinessMemory };
    setMemory(json.memory);
  }

  /* ── Render ── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const facts       = memory?.facts ?? [];
  const activeFacts = facts.filter(f => f.category === activeTab);
  const totalFacts  = facts.length;
  const activeCat   = CATEGORIES.find(c => c.id === activeTab)!;

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
            <Brain className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400/70">
              Business Memory
            </p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">
              {totalFacts} facts stored
              {memory?.lastExtractedAt && (
                <> · Updated <Clock className="w-3 h-3 inline mx-0.5" />{relTime(memory.lastExtractedAt)}</>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => runExtract(false)}
            disabled={extracting}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-muted-foreground/60 hover:text-foreground hover:bg-muted/20 transition-colors disabled:opacity-40"
          >
            {extracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Extract
          </button>
          <button
            onClick={() => runExtract(true)}
            disabled={suggesting}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-purple-400/70 hover:text-purple-400 hover:bg-purple-500/10 transition-colors disabled:opacity-40"
          >
            {suggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            AI Suggest
          </button>
        </div>
      </div>

      {/* ── AI Suggestions ── */}
      <SuggestionsPanel
        suggestions={memory?.suggestions}
        onAccept={id => handleSuggestion(id, "accept")}
        onReject={id => handleSuggestion(id, "reject")}
      />

      {/* ── Category tabs ── */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mb-5">
        {CATEGORIES.map(cat => {
          const count = facts.filter(f => f.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={[
                "flex flex-col items-center gap-1 px-2 py-2 rounded-xl border text-center transition-colors",
                activeTab === cat.id
                  ? "border-orange-500/30 bg-orange-500/[0.07] text-orange-400"
                  : "border-border/30 bg-card/60 text-muted-foreground/50 hover:bg-muted/20",
              ].join(" ")}
            >
              <span className="text-base">{cat.emoji}</span>
              <span className="text-[9px] font-bold uppercase tracking-wide">{cat.label}</span>
              {count > 0 && (
                <span className={[
                  "text-[8px] font-bold px-1.5 py-0.5 rounded-full",
                  activeTab === cat.id ? "bg-orange-500/20 text-orange-400" : "bg-muted/30 text-muted-foreground/40",
                ].join(" ")}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Category content ── */}
      <div className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden">
        {/* Category header */}
        <div className="px-5 py-4 border-b border-border/30 flex items-center gap-3">
          <span className="text-xl">{activeCat.emoji}</span>
          <div>
            <p className="text-[13px] font-bold text-foreground">{activeCat.label}</p>
            <p className="text-[11px] text-muted-foreground/50">{activeCat.description}</p>
          </div>
          <span className="ml-auto text-[10px] text-muted-foreground/30">{activeFacts.length} facts</span>
        </div>

        {/* Facts list */}
        {activeFacts.length > 0 ? (
          <div className="divide-y divide-border/20 p-2">
            {activeFacts.map(fact => (
              <FactRow
                key={fact.id}
                fact={fact}
                onSave={saveFact}
                onDelete={deleteFact}
              />
            ))}
          </div>
        ) : (
          <div className="px-5 py-8 text-center">
            <p className="text-[12px] text-muted-foreground/40">
              No {activeCat.label.toLowerCase()} facts yet.
            </p>
            <p className="text-[11px] text-muted-foreground/30 mt-1">
              Run Extract to pull from your latest project data, or add facts manually below.
            </p>
          </div>
        )}

        {/* Add fact */}
        <div className="p-4 border-t border-border/30">
          <AddFactForm category={activeTab} onAdd={addFact} />
        </div>
      </div>
    </div>
  );
}
