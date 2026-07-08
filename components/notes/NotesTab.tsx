"use client";

/**
 * NotesTab — premium Notes workspace backed by the /api/notes DB routes.
 *
 * Features:
 *  • DB-backed (Postgres notes table) — survives page refresh, works cross-device
 *  • Auto-save: debounced 1.5 s after typing, indicator shows Saving… → Saved ✓
 *  • Sidebar: pinning, folder filter, tag pills, search highlighting, word count
 *  • Focus mode: fullscreen editor, sidebar hidden, distraction-free writing
 *  • Template picker on "New" button
 *  • localStorage migration: on first load migrates any existing cf_notes
 *  • All existing NoteEditor features: slash commands, floating bubble, ⌘K palette,
 *    tables, code blocks, checklists, @mentions, AI writing actions
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Pin, Trash2, Search, ChevronDown, StickyNote,
  Check, CheckCircle2, Clock, Loader2, Maximize2, Minimize2,
  Folder, Tag, X, ChevronRight, FileText, Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { NoteEditor } from "@/components/notes/NoteEditor";
import type { NoteRow } from "@/db/schema/notes-schema";

/* ─── Types ─────────────────────────────────────────────────────────────────── */

export type WorkspaceTab =
  | "dashboard" | "todos" | "notes" | "calendar" | "goals"
  | "research"  | "content" | "brain" | "agents" | "business";

type SaveStatus = "idle" | "saving" | "saved" | "error";

/* ─── Constants ──────────────────────────────────────────────────────────────── */

export const NOTE_TAGS: Record<string, { label: string; pill: string; dot: string; color: string }> = {
  idea:      { label: "Idea",      pill: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",  dot: "bg-yellow-500",  color: "#eab308" },
  script:    { label: "Script",    pill: "bg-blue-500/10 text-blue-600 border-blue-500/20",        dot: "bg-blue-500",    color: "#3b82f6" },
  research:  { label: "Research",  pill: "bg-purple-500/10 text-purple-600 border-purple-500/20",  dot: "bg-purple-500",  color: "#a855f7" },
  strategy:  { label: "Strategy",  pill: "bg-green-500/10 text-green-600 border-green-500/20",     dot: "bg-green-500",   color: "#22c55e" },
  personal:  { label: "Personal",  pill: "bg-pink-500/10 text-pink-600 border-pink-500/20",        dot: "bg-pink-500",    color: "#ec4899" },
};

const NOTE_TEMPLATES: Record<string, {
  label: string; emoji: string; title: string; body: string; tag?: string; folder?: string;
}> = {
  blank:     { label: "Blank note",        emoji: "📄", title: "Untitled",            body: "", tag: undefined },
  idea:      { label: "Idea capture",      emoji: "💡", title: "New idea",            body: "", tag: "idea" },
  script:    { label: "Script outline",    emoji: "🎬", title: "Script outline",      body: "", tag: "script" },
  research:  { label: "Research notes",    emoji: "🔬", title: "Research notes",      body: "", tag: "research" },
  strategy:  { label: "Strategy plan",     emoji: "🎯", title: "Strategy plan",       body: "", tag: "strategy" },
  meeting:   { label: "Meeting notes",     emoji: "📋", title: "Meeting notes",       body: "", tag: "personal" },
};

const AI_WRITING_ACTIONS = new Set([
  "fix-grammar", "improve-writing", "continue-writing", "rewrite",
  "expand-idea", "shorten", "summarise", "change-tone",
  "extract-action-items", "turn-into-blog-post", "turn-into-email", "turn-into-thread",
]);

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function uid() { return Math.random().toString(36).slice(2, 12); }

function formatRelativeTime(date: Date | string): string {
  const ms = typeof date === "string" ? Date.parse(date) : date.getTime();
  const diff = (Date.now() - ms) / 1000;
  if (diff < 60)         return "just now";
  if (diff < 3600)       return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)      return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)     return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function cleanPreview(text: string): string {
  return text
    .replace(/[#*_~`[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Highlight search query in text */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-orange-400/30 text-inherit rounded-sm">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

/* ─── Folder panel ───────────────────────────────────────────────────────────── */

const BUILTIN_FOLDERS = ["Inbox", "Ideas", "Scripts", "Projects", "Archive"];

/* ─── NotesTab ───────────────────────────────────────────────────────────────── */

interface NotesTabProps {
  onTabChange?: (tab: WorkspaceTab) => void;
}

export function NotesTab({ onTabChange }: NotesTabProps) {
  const router = useRouter();

  // ── Note list state ──────────────────────────────────────────────────────────
  const [notes, setNotes]         = useState<NoteRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeId, setActiveId]   = useState<string | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [search, setSearch]               = useState("");
  const [tagFilter, setTagFilter]         = useState<string>("");
  const [folderFilter, setFolderFilter]   = useState<string>("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const [focusMode, setFocusMode]         = useState(false);
  const [saveStatus, setSaveStatus]       = useState<SaveStatus>("idle");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // ── Save debounce ────────────────────────────────────────────────────────────
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMigrated = useRef(false);

  /* ── Load notes from DB on mount ────────────────────────────────────────── */
  useEffect(() => {
    void loadNotes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadNotes() {
    setLoading(true);
    try {
      const res  = await fetch("/api/notes");
      const json = await res.json() as { notes?: NoteRow[] };
      const rows = json.notes ?? [];

      // ── Migrate localStorage notes (run once) ────────────────────────────
      if (!isMigrated.current) {
        isMigrated.current = true;
        try {
          const raw = localStorage.getItem("cf_notes");
          if (raw) {
            const old = JSON.parse(raw) as Array<{
              id: string; title: string; body: string; content?: string;
              updatedAt: number; tag?: string; pinned?: boolean;
            }>;
            const existingIds = new Set(rows.map(r => r.id));
            const toMigrate = old.filter(n => !existingIds.has(n.id));
            for (const n of toMigrate) {
              // Parse TipTap JSON if available
              let content: Record<string, unknown> | null = null;
              if (n.content?.trimStart().startsWith("{")) {
                try { content = JSON.parse(n.content) as Record<string, unknown>; } catch {}
              }
              const r = await fetch("/api/notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title:    n.title || "Untitled",
                  content:  content,
                  body:     n.body || "",
                  tags:     n.tag ? [n.tag] : [],
                  isPinned: n.pinned ?? false,
                }),
              });
              const { note } = await r.json() as { note?: NoteRow };
              if (note) rows.unshift(note);
            }
            if (toMigrate.length > 0) {
              localStorage.removeItem("cf_notes");
            }
          }
        } catch { /* migration is best-effort */ }
      }

      setNotes(rows);

      // Auto-open: check sessionStorage handoffs
      let openId: string | null = null;
      try {
        const target = sessionStorage.getItem("cf_open_note");
        if (target) { openId = target; sessionStorage.removeItem("cf_open_note"); }
      } catch {}

      // research → note handoff: create a new note with prefill
      try {
        const raw = sessionStorage.getItem("note_from_research");
        if (raw) {
          const { title, content, body, tag } = JSON.parse(raw) as {
            title: string; content?: string; body: string; tag?: string;
          };
          sessionStorage.removeItem("note_from_research");
          let tipTapContent: Record<string, unknown> | null = null;
          if (content?.trimStart().startsWith("{")) {
            try { tipTapContent = JSON.parse(content) as Record<string, unknown>; } catch {}
          }
          const r = await fetch("/api/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, content: tipTapContent, body, tags: tag ? [tag] : [] }),
          });
          const { note } = await r.json() as { note?: NoteRow };
          if (note) {
            setNotes(prev => [note, ...prev]);
            setActiveId(note.id);
            return;
          }
        }
      } catch {}

      if (openId && rows.some(r => r.id === openId)) {
        setActiveId(openId);
      } else if (rows.length > 0 && !activeId) {
        setActiveId(rows[0]?.id ?? null);
      }
    } catch {
      /* show empty state */
    } finally {
      setLoading(false);
    }
  }

  /* ── Create note ────────────────────────────────────────────────────────── */
  const createNote = useCallback(async (templateKey = "blank") => {
    const tpl = NOTE_TEMPLATES[templateKey] ?? NOTE_TEMPLATES.blank!;
    const optimisticId = uid();
    const optimistic: NoteRow = {
      id:         optimisticId,
      userId:     "",
      title:      tpl.title || "Untitled",
      content:    null,
      body:       tpl.body || "",
      folder:     tpl.folder ?? folderFilter || null,
      tags:       tpl.tag ? [tpl.tag] : [],
      isPinned:   false,
      isArchived: false,
      deletedAt:  null,
      wordCount:  0,
      aiSummary:  null,
      createdAt:  new Date(),
      updatedAt:  new Date(),
    };
    setNotes(prev => [optimistic, ...prev]);
    setActiveId(optimisticId);
    setShowTemplates(false);

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:  tpl.title || "Untitled",
          body:   tpl.body || "",
          tags:   tpl.tag ? [tpl.tag] : [],
          folder: folderFilter || null,
        }),
      });
      const { note } = await res.json() as { note?: NoteRow };
      if (note) {
        // Replace optimistic entry with real DB row
        setNotes(prev => prev.map(n => n.id === optimisticId ? note : n));
        setActiveId(note.id);
      }
    } catch {
      setNotes(prev => prev.filter(n => n.id !== optimisticId));
    }
  }, [folderFilter]);

  /* ── Save (debounced) ───────────────────────────────────────────────────── */
  const scheduleAutoSave = useCallback((id: string, patch: {
    title?: string;
    content?: Record<string, unknown> | null;
    body?: string;
    tags?: string[];
    folder?: string | null;
    isPinned?: boolean;
  }) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch(`/api/notes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("error");
      }
    }, 1500);
  }, []);

  /* ── Update note locally + schedule save ────────────────────────────────── */
  const updateNote = useCallback((id: string, patch: {
    title?: string;
    content?: Record<string, unknown> | null;
    body?: string;
    tags?: string[];
    folder?: string | null;
    isPinned?: boolean;
  }) => {
    setNotes(prev => prev.map(n =>
      n.id === id
        ? { ...n, ...patch, updatedAt: new Date() }
        : n
    ));
    scheduleAutoSave(id, patch);
  }, [scheduleAutoSave]);

  /* ── Delete note ────────────────────────────────────────────────────────── */
  const deleteNote = useCallback(async (id: string) => {
    setNotes(prev => {
      const next = prev.filter(n => n.id !== id);
      setActiveId(next[0]?.id ?? null);
      return next;
    });
    setConfirmDelete(null);
    await fetch(`/api/notes/${id}`, { method: "DELETE" }).catch(() => {});
  }, []);

  /* ── Toggle pin ─────────────────────────────────────────────────────────── */
  const togglePin = useCallback((id: string) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    const isPinned = !note.isPinned;
    updateNote(id, { isPinned });
  }, [notes, updateNote]);

  /* ── Toggle tag ─────────────────────────────────────────────────────────── */
  const toggleTag = useCallback((id: string, tag: string) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    const tags = note.tags ?? [];
    const next = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag];
    updateNote(id, { tags: next });
  }, [notes, updateNote]);

  /* ── Duplicate ──────────────────────────────────────────────────────────── */
  const duplicateNote = useCallback(async (note: NoteRow) => {
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title:   `${note.title} (copy)`,
        content: note.content,
        body:    note.body,
        tags:    note.tags,
        folder:  note.folder,
      }),
    });
    const { note: newNote } = await res.json() as { note?: NoteRow };
    if (newNote) {
      setNotes(prev => [newNote, ...prev]);
      setActiveId(newNote.id);
    }
  }, []);

  /* ── AI action handler ──────────────────────────────────────────────────── */
  const handleAiAction = useCallback(async (
    actionId: string,
    selectedText: string,
    replaceCallback: (result: string) => void,
  ) => {
    const note = notes.find(n => n.id === activeId);
    if (!note) return;

    if (AI_WRITING_ACTIONS.has(actionId)) {
      const textToSend = actionId === "continue-writing" ? note.body : (selectedText || note.body);
      try {
        const res  = await fetch("/api/notes/ai-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: actionId, title: note.title, body: textToSend }),
        });
        const json = await res.json() as { result?: string };
        if (json.result) {
          if (actionId === "continue-writing") {
            // Append to body — replaceCallback with empty clears bubble loading
            updateNote(note.id, { body: note.body.trim() + "\n\n" + json.result });
            replaceCallback("");
          } else {
            replaceCallback(json.result);
          }
        } else {
          replaceCallback("");
        }
      } catch { replaceCallback(""); }
      return;
    }

    // Navigation actions
    const prefill = JSON.stringify({ title: note.title, body: note.body });
    try { sessionStorage.setItem("note_prefill", prefill); } catch {}
    if (actionId === "turn-into-research") {
      try { sessionStorage.setItem("note_to_research", JSON.stringify({ topic: note.title, context: note.body })); } catch {}
      onTabChange?.("research");
    } else if (actionId === "turn-into-video" || actionId === "turn-into-script") {
      router.push("/dashboard/content-studio/create/video-guide");
    } else if (actionId === "turn-into-carousel") {
      router.push("/dashboard/design-studio");
    } else if (actionId === "turn-into-product") {
      router.push("/dashboard/digital-products/create");
    }
  }, [notes, activeId, updateNote, onTabChange, router]);

  /* ── Derived ────────────────────────────────────────────────────────────── */
  const active = notes.find(n => n.id === activeId);

  const sorted = [...notes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const filteredNotes = sorted.filter(n => {
    const q = search.toLowerCase();
    if (q && !n.title.toLowerCase().includes(q) && !n.body.toLowerCase().includes(q)) return false;
    if (tagFilter && !(n.tags ?? []).includes(tagFilter)) return false;
    if (folderFilter && n.folder !== folderFilter) return false;
    return true;
  });

  const allFolders = Array.from(new Set(notes.map(n => n.folder).filter(Boolean))) as string[];
  const noteRefs   = notes.map(n => ({ id: n.id, title: n.title }));
  const words      = active?.body.trim() ? active.body.trim().split(/\s+/).length : 0;
  const readTime   = Math.max(1, Math.ceil(words / 200));

  /* ── Save status icon ───────────────────────────────────────────────────── */
  const SaveIndicator = () => {
    if (saveStatus === "saving") return (
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
        <Loader2 className="w-3 h-3 animate-spin" /> Saving…
      </span>
    );
    if (saveStatus === "saved") return (
      <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
        <CheckCircle2 className="w-3 h-3" /> Saved
      </span>
    );
    if (saveStatus === "error") return (
      <span className="flex items-center gap-1 text-[11px] text-red-500">
        <X className="w-3 h-3" /> Error saving
      </span>
    );
    return null;
  };

  /* ── Render ─────────────────────────────────────────────────────────────── */

  // Focus mode: full-screen overlay
  if (focusMode && active) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* Focus mode header */}
        <div className="flex items-center justify-between px-8 py-3 border-b border-border/30 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-foreground truncate max-w-[400px]">
              {active.title || "Untitled"}
            </span>
            <SaveIndicator />
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground/50">
            <span>{words.toLocaleString()} words · {readTime} min read</span>
            <button
              onClick={() => setFocusMode(false)}
              className="flex items-center gap-1.5 px-3 h-7 rounded-lg border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Minimize2 className="w-3 h-3" /> Exit focus
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="px-[max(3rem,calc(50%-360px))] pt-8 pb-2 shrink-0">
          <input
            value={active.title}
            onChange={e => updateNote(active.id, { title: e.target.value })}
            className="w-full text-4xl font-black bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/20 leading-tight"
            placeholder="Untitled"
          />
        </div>

        {/* Editor */}
        <div className="flex-1 min-h-0 overflow-hidden px-[max(0px,calc(50%-380px))]">
          <NoteEditor
            key={active.id}
            noteId={active.id}
            content={active.content ? JSON.stringify(active.content) : active.body}
            isLegacy={!active.content}
            allNotes={noteRefs}
            onUpdate={(json, text) => updateNote(active.id, {
              content: JSON.parse(json) as Record<string, unknown>,
              body: text,
            })}
            onAiAction={handleAiAction}
            className="h-full"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[520px] rounded-2xl border border-border overflow-hidden shadow-sm">

      {/* ──────────────── SIDEBAR ──────────────────────────────────────────── */}
      <div className="w-[272px] shrink-0 flex flex-col bg-muted/20 dark:bg-[#0A0A0A] border-r border-border">

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border space-y-3">

          {/* Title + New button */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">Notes</p>
              <p className="text-[10px] text-muted-foreground/60 mt-px">
                {loading ? "Loading…" : `${notes.length} note${notes.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowTemplates(v => !v)}
                className="flex items-center gap-1.5 h-8 px-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New
                <ChevronDown className={cn("w-3 h-3 opacity-70 transition-transform duration-150", showTemplates && "rotate-180")} />
              </button>
              {showTemplates && (
                <div className="absolute top-full mt-1.5 right-0 z-30 bg-popover border border-border rounded-xl shadow-xl py-1 min-w-[196px] overflow-hidden">
                  {Object.entries(NOTE_TEMPLATES).map(([key, tpl]) => (
                    <button key={key} onClick={() => createNote(key)}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-accent transition-colors">
                      <span className="text-base leading-none">{tpl.emoji}</span>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{tpl.label}</p>
                        {tpl.tag && <p className="text-[10px] text-muted-foreground capitalize">{tpl.tag}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notes…"
              className="w-full h-8 pl-8 pr-8 text-xs rounded-lg border border-border bg-background/60 focus:outline-none focus:ring-1 focus:ring-orange-400/50 placeholder:text-muted-foreground/40 transition-shadow"
            />
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 hover:text-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Folder filter */}
          {(allFolders.length > 0 || BUILTIN_FOLDERS.length > 0) && (
            <div className="relative" ref={undefined}>
              <button
                onClick={() => setShowFolderMenu(v => !v)}
                className="flex items-center gap-1.5 w-full h-7 px-2.5 rounded-lg border border-border text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Folder className="w-3 h-3 shrink-0" />
                <span className="flex-1 text-left truncate">{folderFilter || "All folders"}</span>
                <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
              </button>
              {showFolderMenu && (
                <div className="absolute top-full mt-1 left-0 right-0 z-30 bg-popover border border-border rounded-xl shadow-xl py-1 overflow-hidden">
                  <button onClick={() => { setFolderFilter(""); setShowFolderMenu(false); }}
                    className={cn("w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left hover:bg-accent transition-colors",
                      !folderFilter && "text-orange-500 font-semibold")}>
                    All folders
                  </button>
                  {[...new Set([...BUILTIN_FOLDERS, ...allFolders])].map(f => (
                    <button key={f} onClick={() => { setFolderFilter(f); setShowFolderMenu(false); }}
                      className={cn("w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left hover:bg-accent transition-colors",
                        folderFilter === f && "text-orange-500 font-semibold")}>
                      <Folder className="w-3 h-3 shrink-0" />
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tag filter pills */}
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setTagFilter("")}
              className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all",
                tagFilter === ""
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/50"
              )}>
              All
            </button>
            {Object.entries(NOTE_TAGS).map(([key, tag]) => (
              <button key={key} onClick={() => setTagFilter(t => t === key ? "" : key)}
                className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all",
                  tagFilter === key ? tag.pill : "border-border text-muted-foreground hover:border-foreground/50"
                )}>
                {tag.label}
              </button>
            ))}
          </div>
        </div>

        {/* Note list */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-px">
          {loading ? (
            <div className="py-12 flex flex-col items-center gap-3">
              <Loader2 className="w-5 h-5 text-muted-foreground/30 animate-spin" />
              <p className="text-xs text-muted-foreground/50">Loading notes…</p>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="py-12 text-center px-4">
              <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <StickyNote className="w-5 h-5 text-muted-foreground/30" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                {search || tagFilter || folderFilter ? "No matches found" : "No notes yet"}
              </p>
              {!search && !tagFilter && !folderFilter && (
                <button onClick={() => createNote()}
                  className="mt-2 text-[11px] text-orange-500 hover:underline font-medium">
                  Create your first note
                </button>
              )}
            </div>
          ) : filteredNotes.map(note => {
            const isActive  = activeId === note.id;
            const noteTags  = (note.tags ?? []).filter(t => t in NOTE_TAGS);
            const firstTag  = noteTags[0];
            const tagMeta   = firstTag ? NOTE_TAGS[firstTag] : null;
            const preview   = cleanPreview(note.body).slice(0, 100);
            const wc        = note.wordCount ?? 0;

            return (
              <button
                key={note.id}
                onClick={() => setActiveId(note.id)}
                className={cn(
                  "w-full text-left px-3 py-3 rounded-xl border transition-all duration-150 group relative",
                  isActive
                    ? "bg-white dark:bg-[#1C1C1C] border-orange-400/40 shadow-sm shadow-orange-500/5"
                    : "bg-transparent border-transparent hover:bg-white/70 dark:hover:bg-white/5 hover:border-border/60 hover:shadow-sm"
                )}
              >
                {/* Left accent bar */}
                <div className={cn(
                  "absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full transition-all duration-150",
                  isActive
                    ? tagMeta ? tagMeta.dot : "bg-orange-500"
                    : "bg-transparent group-hover:bg-border/60"
                )} />

                <div className="pl-1.5">
                  <div className="flex items-start gap-1.5 mb-0.5">
                    {note.isPinned && <Pin className="w-3 h-3 text-orange-400 shrink-0 mt-0.5" />}
                    <p className={cn(
                      "text-[13px] font-semibold leading-snug truncate transition-colors pr-10",
                      isActive ? "text-foreground" : "text-foreground/80 group-hover:text-foreground"
                    )}>
                      {search
                        ? highlightText(note.title || "Untitled", search)
                        : (note.title || "Untitled")}
                    </p>
                  </div>

                  {preview && (
                    <p className="text-[11px] text-muted-foreground/55 line-clamp-2 leading-relaxed mb-1.5">
                      {search ? highlightText(preview, search) : preview}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      {tagMeta && (
                        <span className={cn("inline-block px-1.5 py-px rounded-full text-[9px] font-bold border", tagMeta.pill)}>
                          {tagMeta.label}
                        </span>
                      )}
                      {note.folder && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground/50">
                          <Folder className="w-2.5 h-2.5" />{note.folder}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {wc > 0 && (
                        <span className="text-[9px] text-muted-foreground/35">{wc}w</span>
                      )}
                      <span className="text-[10px] text-muted-foreground/40">
                        {formatRelativeTime(note.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hover actions */}
                <div className="absolute top-2.5 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={e => { e.stopPropagation(); togglePin(note.id); }}
                    title={note.isPinned ? "Unpin" : "Pin"}
                    className={cn(
                      "w-6 h-6 rounded-md flex items-center justify-center transition-colors",
                      note.isPinned
                        ? "text-orange-500 bg-orange-500/10"
                        : "text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10"
                    )}>
                    <Pin className="w-3 h-3" />
                  </button>
                  {confirmDelete === note.id ? (
                    <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                      <button onClick={() => deleteNote(note.id)}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={() => setConfirmDelete(null)}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDelete(note.id); }}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground/50">
            {notes.length} note{notes.length !== 1 ? "s" : ""}
          </p>
          <p className="text-[10px] text-muted-foreground/40">
            {notes.reduce((acc, n) => acc + (n.wordCount ?? 0), 0).toLocaleString()} words
          </p>
        </div>
      </div>

      {/* ──────────────── EDITOR PANEL ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-card dark:bg-[#0F0F0F] overflow-hidden">
        {!active ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 p-10">
            <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center">
              <StickyNote className="w-7 h-7 text-muted-foreground/30" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground mb-1.5">Your workspace awaits</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Pick a note from the list or start fresh with a template
              </p>
            </div>
            <div className="flex flex-col gap-2 items-stretch w-60 mt-1">
              {Object.entries(NOTE_TEMPLATES).slice(0, 4).map(([key, tpl]) => (
                <button key={key} onClick={() => createNote(key)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border hover:border-orange-400/50 hover:bg-orange-500/5 transition-all text-sm font-medium text-muted-foreground hover:text-foreground group">
                  <span className="text-base">{tpl.emoji}</span>
                  <span>{tpl.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">

            {/* ── Note header ─────────────────────────────────────────────── */}
            <div className="px-8 pt-6 pb-3 border-b border-border/40 shrink-0">

              {/* Title */}
              <input
                value={active.title}
                onChange={e => updateNote(active.id, { title: e.target.value })}
                className="w-full text-2xl font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/20 leading-tight mb-3"
                placeholder="Untitled"
              />

              {/* Meta bar */}
              <div className="flex items-center justify-between flex-wrap gap-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(active.updatedAt)}
                  </span>
                  <span className="text-[11px] text-muted-foreground/40">
                    {words.toLocaleString()} words · {readTime} min read
                  </span>
                  <SaveIndicator />
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Focus mode */}
                  <button
                    onClick={() => setFocusMode(true)}
                    title="Focus mode (distraction-free)"
                    className="flex items-center gap-1 h-6 px-2 rounded-md text-[10px] text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors border border-transparent hover:border-border/50"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>Focus</span>
                  </button>

                  {/* Duplicate */}
                  <button
                    onClick={() => duplicateNote(active)}
                    title="Duplicate note"
                    className="flex items-center gap-1 h-6 px-2 rounded-md text-[10px] text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors border border-transparent hover:border-border/50"
                  >
                    <FileText className="w-3 h-3" />
                    <span>Duplicate</span>
                  </button>
                </div>
              </div>

              {/* Tag row */}
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                {/* Folder chip */}
                <div className="relative group/folder">
                  <button className="flex items-center gap-1 h-5 px-2 rounded-full border border-border/60 text-[10px] text-muted-foreground/60 hover:text-foreground hover:border-border transition-colors">
                    <Folder className="w-2.5 h-2.5" />
                    {active.folder || "No folder"}
                  </button>
                  <div className="absolute top-full mt-1 left-0 z-20 hidden group-hover/folder:block bg-popover border border-border rounded-xl shadow-xl py-1 min-w-[140px]">
                    {["", ...BUILTIN_FOLDERS, ...allFolders.filter(f => !BUILTIN_FOLDERS.includes(f))].map(f => (
                      <button key={f || "__none"} onClick={() => updateNote(active.id, { folder: f || null })}
                        className={cn("w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left hover:bg-accent transition-colors",
                          active.folder === (f || null) && "text-orange-500 font-semibold")}>
                        {f || "No folder"}
                        {active.folder === (f || null) && <Check className="w-3 h-3 ml-auto shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tag chips */}
                <div className="relative group/tags">
                  <button className="flex items-center gap-1 h-5 px-2 rounded-full border border-border/60 text-[10px] text-muted-foreground/60 hover:text-foreground hover:border-border transition-colors">
                    <Tag className="w-2.5 h-2.5" />
                    {(active.tags ?? []).length === 0 ? "Add tag" : "Tags"}
                  </button>
                  <div className="absolute top-full mt-1 left-0 z-20 hidden group-hover/tags:block bg-popover border border-border rounded-xl shadow-xl py-1 min-w-[140px]">
                    {Object.entries(NOTE_TAGS).map(([key, tag]) => {
                      const active_ = (active.tags ?? []).includes(key);
                      return (
                        <button key={key} onClick={() => toggleTag(active.id, key)}
                          className={cn("w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left hover:bg-accent transition-colors",
                            active_ && "font-semibold")}>
                          <span className={cn("w-2 h-2 rounded-full shrink-0", tag.dot)} />
                          {tag.label}
                          {active_ && <Check className="w-3 h-3 ml-auto shrink-0 text-orange-500" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Existing tag pills */}
                {(active.tags ?? []).filter(t => t in NOTE_TAGS).map(t => {
                  const meta = NOTE_TAGS[t]!;
                  return (
                    <span key={t} className={cn("inline-flex items-center gap-1 px-2 py-px rounded-full text-[10px] font-semibold border", meta.pill)}>
                      {meta.label}
                      <button onClick={() => toggleTag(active.id, t)} className="opacity-60 hover:opacity-100 transition-opacity">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  );
                })}

                {/* Pin toggle */}
                <button
                  onClick={() => togglePin(active.id)}
                  className={cn(
                    "flex items-center gap-1 h-5 px-2 rounded-full border text-[10px] transition-colors",
                    active.isPinned
                      ? "border-orange-400/40 text-orange-500 bg-orange-500/8"
                      : "border-border/60 text-muted-foreground/60 hover:text-foreground hover:border-border"
                  )}
                >
                  <Pin className="w-2.5 h-2.5" />
                  {active.isPinned ? "Pinned" : "Pin"}
                </button>
              </div>

              {/* AI quick actions */}
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                {[
                  { id: "turn-into-research",  label: "→ Research",  icon: "🔬" },
                  { id: "turn-into-carousel",  label: "→ Design",    icon: "🎨" },
                  { id: "turn-into-video",     label: "→ Video",     icon: "🎬" },
                  { id: "turn-into-product",   label: "→ Product",   icon: "📦" },
                ].map(a => (
                  <button key={a.id}
                    onClick={() => handleAiAction(a.id, "", () => {})}
                    className="flex items-center gap-1 h-5 px-2 rounded-full border border-border/50 text-[10px] text-muted-foreground/60 hover:text-foreground hover:border-orange-400/50 hover:bg-orange-500/5 transition-colors">
                    <span>{a.icon}</span>
                    {a.label}
                  </button>
                ))}
                <span className="text-[10px] text-muted-foreground/30 ml-1">· select text for AI rewrites</span>
              </div>
            </div>

            {/* ── TipTap Editor ────────────────────────────────────────────── */}
            <NoteEditor
              key={active.id}
              noteId={active.id}
              content={active.content ? JSON.stringify(active.content) : active.body}
              isLegacy={!active.content && !!active.body}
              allNotes={noteRefs}
              onUpdate={(json, text) => updateNote(active.id, {
                content: JSON.parse(json) as Record<string, unknown>,
                body: text,
              })}
              onAiAction={handleAiAction}
              className="flex-1 min-h-0"
            />
          </div>
        )}
      </div>
    </div>
  );
}
