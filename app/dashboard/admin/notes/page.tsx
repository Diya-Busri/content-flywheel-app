"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Loader2, Pin, PinOff, Trash2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Note = {
  id: string;
  content: string;
  tag: string | null;
  pinned: string | null;
  createdAt: string;
  updatedAt: string;
};

const TAG_OPTIONS = ["general", "idea", "todo", "bug", "follow-up"] as const;

const TAG_CONFIG: Record<string, { pill: string; dot: string; label: string }> = {
  general:     { pill: "bg-slate-500/15 text-slate-300 border-slate-500/25",  dot: "bg-slate-400",   label: "General" },
  idea:        { pill: "bg-purple-500/15 text-purple-300 border-purple-500/25", dot: "bg-purple-400", label: "Idea" },
  todo:        { pill: "bg-orange-500/15 text-orange-300 border-orange-500/25", dot: "bg-orange-400", label: "Todo" },
  bug:         { pill: "bg-red-500/15 text-red-300 border-red-500/25",          dot: "bg-red-400",    label: "Bug" },
  "follow-up": { pill: "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",       dot: "bg-cyan-400",   label: "Follow-up" },
};

function timeAgo(dateStr: string) {
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

export default function AdminNotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [draftTag, setDraftTag] = useState("general");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/admin/notes")
      .then((r) => r.json())
      .then((data) => { setNotes(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return notes.filter((n) => {
      const matchesTag = !activeTag || n.tag === activeTag;
      const matchesSearch = !search.trim() || n.content.toLowerCase().includes(search.toLowerCase());
      return matchesTag && matchesSearch;
    });
  }, [notes, activeTag, search]);

  const pinned = filtered.filter((n) => n.pinned === "true");
  const unpinned = filtered.filter((n) => n.pinned !== "true");

  // Tag counts for filter chips
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of notes) {
      const t = n.tag ?? "general";
      counts[t] = (counts[t] ?? 0) + 1;
    }
    return counts;
  }, [notes]);

  const addNote = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draft.trim(), tag: draftTag }),
    });
    const created = await res.json() as Note;
    setNotes((prev) => [created, ...prev]);
    setDraft("");
    setSaving(false);
    textareaRef.current?.focus();
  };

  const deleteNote = async (id: string) => {
    await fetch(`/api/admin/notes/${id}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const togglePin = async (note: Note) => {
    const newPinned = note.pinned === "true" ? "false" : "true";
    const res = await fetch(`/api/admin/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: newPinned }),
    });
    const updated = await res.json() as Note;
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  };

  const saveEdit = async (id: string) => {
    if (!editContent.trim()) return;
    const res = await fetch(`/api/admin/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editContent.trim() }),
    });
    const updated = await res.json() as Note;
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    setEditingId(null);
  };

  const NoteCard = ({ note }: { note: Note }) => {
    const isPinned = note.pinned === "true";
    const tag = note.tag ?? "general";
    const cfg = TAG_CONFIG[tag] ?? TAG_CONFIG.general;
    const isEditing = editingId === note.id;

    return (
      <div className={`group rounded-xl border p-4 space-y-3 transition-all duration-150 ${
        isPinned
          ? "border-orange-500/40 bg-orange-500/5 shadow-[0_0_0_1px_rgba(249,115,22,0.15)]"
          : "border-border bg-card hover:border-border/80 hover:bg-card/80"
      }`}>
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isPinned && <Pin className="w-3 h-3 text-orange-400 shrink-0" />}
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cfg.pill}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => togglePin(note)}
              className={`p-1.5 rounded-lg transition-colors ${isPinned ? "text-orange-400 hover:bg-orange-500/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
              title={isPinned ? "Unpin" : "Pin to top"}
            >
              {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => deleteNote(note.id)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[80px] text-sm bg-background"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditingId(null);
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEdit(note.id);
              }}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveEdit(note.id)} className="bg-orange-500 hover:bg-orange-600 text-white h-7 text-xs">Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 text-xs">Cancel</Button>
            </div>
          </div>
        ) : (
          <p
            className="text-sm text-foreground whitespace-pre-wrap leading-relaxed cursor-text select-text"
            onClick={() => { setEditingId(note.id); setEditContent(note.content); }}
            title="Click to edit"
          >
            {note.content}
          </p>
        )}

        {/* Footer */}
        <p className="text-[11px] text-muted-foreground/60">{timeAgo(note.updatedAt)}</p>
      </div>
    );
  };

  const usedTags = TAG_OPTIONS.filter((t) => tagCounts[t]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Notes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Private scratchpad — only visible to you
            {!loading && notes.length > 0 && (
              <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded-full font-medium">{notes.length}</span>
            )}
          </p>
        </div>
      </div>

      {/* Compose */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <Textarea
          ref={textareaRef}
          placeholder="Write a note… (⌘↵ to save)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote(); }}
          className="min-h-[80px] bg-background resize-none text-sm focus-visible:ring-orange-500/50"
        />
        <div className="flex items-center gap-3">
          <Select value={draftTag} onValueChange={setDraftTag}>
            <SelectTrigger className="w-36 h-8 text-xs bg-background">
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${TAG_CONFIG[draftTag]?.dot ?? "bg-slate-400"}`} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TAG_OPTIONS.map((t) => (
                <SelectItem key={t} value={t} className="text-xs">
                  <span className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${TAG_CONFIG[t].dot}`} />
                    {TAG_CONFIG[t].label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-auto mr-2">{draft.length > 0 ? `${draft.length} chars` : ""}</span>
          <Button
            onClick={addNote}
            disabled={!draft.trim() || saving}
            className="h-8 bg-orange-500 hover:bg-orange-600 text-white text-xs px-4"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Plus className="w-3.5 h-3.5 mr-1" />Add note</>}
          </Button>
        </div>
      </div>

      {/* Search + tag filters */}
      {!loading && notes.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-background"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {usedTags.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveTag(null)}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                  !activeTag ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/40"
                }`}
              >
                All
              </button>
              {usedTags.map((t) => {
                const cfg = TAG_CONFIG[t];
                const isActive = activeTag === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setActiveTag(isActive ? null : t)}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1.5 ${
                      isActive ? cfg.pill + " !border-current" : "border-border text-muted-foreground hover:border-foreground/40"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                    <span className="opacity-60">{tagCounts[t]}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Notes list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-2xl">📝</p>
          <p className="text-sm font-medium text-foreground">No notes yet</p>
          <p className="text-xs text-muted-foreground">Add your first note above to get started</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 space-y-1">
          <p className="text-sm text-muted-foreground">No notes match your search</p>
          <button type="button" onClick={() => { setSearch(""); setActiveTag(null); }} className="text-xs text-orange-400 hover:underline">Clear filters</button>
        </div>
      ) : (
        <div className="space-y-6">
          {pinned.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Pin className="w-3 h-3" /> Pinned · {pinned.length}
              </p>
              {pinned.map((n) => <NoteCard key={n.id} note={n} />)}
            </div>
          )}
          {unpinned.length > 0 && (
            <div className="space-y-3">
              {pinned.length > 0 && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes · {unpinned.length}</p>
              )}
              {unpinned.map((n) => <NoteCard key={n.id} note={n} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
