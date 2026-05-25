"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Pin, PinOff, Trash2, Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
const TAG_COLORS: Record<string, string> = {
  general: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  idea: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  todo: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  bug: "bg-red-500/10 text-red-400 border-red-500/20",
  "follow-up": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminNotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [draftTag, setDraftTag] = useState("general");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/admin/notes")
      .then((r) => r.json())
      .then((data) => { setNotes(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const pinned = notes.filter((n) => n.pinned === "true");
  const unpinned = notes.filter((n) => n.pinned !== "true");

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
  };

  const deleteNote = async (id: string) => {
    await fetch(`/api/admin/notes/${id}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const togglePin = async (note: Note) => {
    const pinned = note.pinned === "true" ? "false" : "true";
    const res = await fetch(`/api/admin/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
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
    const isEditing = editingId === note.id;

    return (
      <div className={`rounded-xl border p-4 space-y-2 transition-colors ${isPinned ? "border-orange-500/40 bg-orange-500/5" : "border-border bg-card"}`}>
        <div className="flex items-start justify-between gap-2">
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${TAG_COLORS[tag] ?? TAG_COLORS.general}`}>
            {tag}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => togglePin(note)}
              className={`p-1.5 rounded-lg transition-colors ${isPinned ? "text-orange-400 hover:bg-orange-500/10" : "text-muted-foreground hover:bg-muted"}`}
              title={isPinned ? "Unpin" : "Pin"}
            >
              {isPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
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
            className="text-sm text-foreground whitespace-pre-wrap cursor-pointer hover:text-orange-400 transition-colors"
            onClick={() => { setEditingId(note.id); setEditContent(note.content); }}
            title="Click to edit"
          >
            {note.content}
          </p>
        )}

        <p className="text-[11px] text-muted-foreground">{timeAgo(note.updatedAt)}</p>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notes</h1>
        <p className="text-sm text-muted-foreground mt-1">Private scratchpad — only visible to you</p>
      </div>

      {/* Compose */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <Textarea
          ref={textareaRef}
          placeholder="Write a note... (⌘Enter to save)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote(); }}
          className="min-h-[80px] bg-background resize-none text-sm"
        />
        <div className="flex items-center gap-3">
          <Select value={draftTag} onValueChange={setDraftTag}>
            <SelectTrigger className="w-36 h-8 text-xs bg-background">
              <Tag className="w-3 h-3 mr-1 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TAG_OPTIONS.map((t) => (
                <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={addNote}
            disabled={!draft.trim() || saving}
            className="ml-auto h-8 bg-orange-500 hover:bg-orange-600 text-white text-xs px-4"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Plus className="w-3.5 h-3.5 mr-1" />Add note</>}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : notes.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">No notes yet. Add your first one above.</p>
      ) : (
        <div className="space-y-6">
          {pinned.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Pin className="w-3 h-3" /> Pinned
              </p>
              {pinned.map((n) => <NoteCard key={n.id} note={n} />)}
            </div>
          )}
          {unpinned.length > 0 && (
            <div className="space-y-3">
              {pinned.length > 0 && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">All notes</p>
              )}
              {unpinned.map((n) => <NoteCard key={n.id} note={n} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
