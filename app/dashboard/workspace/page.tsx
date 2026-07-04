"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Check, GripVertical, X, ChevronDown, Bookmark, BookmarkCheck,
  Calendar, Tag, StickyNote, Target, ListTodo, ChevronLeft, ChevronRight,
  Trash2, Pencil, CheckCircle2, Search, AlertCircle, Zap, Bold, List,
  Heading2, Quote, FlaskConical, BarChart2, Megaphone, BookOpen, Brain,
  FileText, Lightbulb, ChevronUp, Loader2,
  Sparkles, Wand2, Video, Package, Pin, AlignLeft, Mic, Layers, Minus, Italic
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useWorkspaceAdmin } from "@/components/workspace-admin-context";
import { NoteEditor } from "@/components/notes/NoteEditor";

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkspaceTab = "todos" | "notes" | "calendar" | "goals"
  | "research" | "marketing-psychology" | "copywriting" | "content-ideas"
  | "analytics" | "distribution" | "experiments";
type Priority = "high" | "medium" | "low";
type TodoFilter = "all" | "active" | "completed";

interface Todo {
  id: string; text: string; completed: boolean; priority: Priority;
  category?: string; dueDate?: string; createdAt: number;
}
interface SavedTask { id: string; text: string; priority: Priority; category?: string; }
type NoteTag = "script" | "idea" | "research" | "strategy" | "personal";
interface Note { id: string; title: string; body: string; content?: string; updatedAt: number; tag?: NoteTag; pinned?: boolean; }
interface CalEvent { id: string; title: string; date: string; type: "post" | "launch" | "task" | "other"; platform?: string; }
interface Goal { id: string; label: string; target: number; current: number; unit: string; deadline?: string; color: string; }

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY: Record<Priority, { label: string; color: string; dot: string; bg: string }> = {
  high:   { label: "High",   color: "text-red-500",    dot: "bg-red-500",    bg: "bg-red-500/10" },
  medium: { label: "Medium", color: "text-yellow-500", dot: "bg-yellow-500", bg: "bg-yellow-500/10" },
  low:    { label: "Low",    color: "text-green-500",  dot: "bg-green-500",  bg: "bg-green-500/10" },
};
const CATEGORIES = [
  { id: "content",  name: "Content",  color: "bg-purple-500/15 text-purple-500 dark:text-purple-400", dot: "bg-purple-500" },
  { id: "admin",    name: "Admin",    color: "bg-blue-500/15 text-blue-500 dark:text-blue-400",       dot: "bg-blue-500" },
  { id: "growth",   name: "Growth",   color: "bg-green-500/15 text-green-500 dark:text-green-400",   dot: "bg-green-500" },
  { id: "personal", name: "Personal", color: "bg-orange-500/15 text-orange-500 dark:text-orange-400", dot: "bg-orange-500" },
];
const CAL_TYPES = [
  { id: "post",   label: "Post",   color: "bg-purple-500",  text: "text-purple-500 dark:text-purple-400",  bg: "bg-purple-500/10" },
  { id: "launch", label: "Launch", color: "bg-orange-500",  text: "text-orange-500",  bg: "bg-orange-500/10" },
  { id: "task",   label: "Task",   color: "bg-blue-500",    text: "text-blue-500 dark:text-blue-400",   bg: "bg-blue-500/10" },
  { id: "other",  label: "Other",  color: "bg-gray-400",    text: "text-gray-500",    bg: "bg-gray-500/10" },
];
const DEFAULT_GOALS: Goal[] = [
  { id: "revenue",  label: "Monthly Revenue",     target: 1000, current: 0, unit: "£", color: "#f97316", deadline: "" },
  { id: "creators", label: "Creators Onboarded",  target: 10,   current: 0, unit: "",  color: "#a855f7", deadline: "" },
  { id: "products", label: "Products Listed",     target: 25,   current: 0, unit: "",  color: "#3b82f6", deadline: "" },
];
const GOAL_COLORS = ["#f97316","#a855f7","#3b82f6","#10b981","#ef4444","#ec4899"];

const NOTE_TAGS: Record<NoteTag, { label: string; pill: string; dot: string }> = {
  script:   { label: "Script",   pill: "bg-purple-500/15 text-purple-500 dark:text-purple-400 border-purple-500/20",  dot: "bg-purple-500" },
  idea:     { label: "Idea",     pill: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",      dot: "bg-amber-500" },
  research: { label: "Research", pill: "bg-blue-500/15 text-blue-500 dark:text-blue-400 border-blue-500/20",          dot: "bg-blue-500" },
  strategy: { label: "Strategy", pill: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20",      dot: "bg-green-500" },
  personal: { label: "Personal", pill: "bg-pink-500/15 text-pink-500 dark:text-pink-400 border-pink-500/20",          dot: "bg-pink-500" },
};

const NOTE_TEMPLATES: Record<string, { label: string; emoji: string; title: string; body: string; tag: NoteTag }> = {
  blank: {
    label: "Blank", emoji: "📄", title: "", body: "", tag: "idea",
  },
  "hook-script": {
    label: "Hook Script", emoji: "🎬", tag: "script",
    title: "Hook Script",
    body: "## Hook\n\n\n## Problem\n\n\n## Solution / Transition\n\n\n## CTA\n\n",
  },
  "content-idea": {
    label: "Content Idea", emoji: "💡", tag: "idea",
    title: "Content Idea",
    body: "## Angle\n\n\n## Hook options\n- \n- \n- \n\n## Key points\n- \n- \n\n## CTA\n\n",
  },
  "strategy-brief": {
    label: "Strategy Brief", emoji: "📊", tag: "strategy",
    title: "Strategy Brief",
    body: "## Goal\n\n\n## Target audience\n\n\n## Key message\n\n\n## Channels\n\n\n## Success metrics\n\n",
  },
};
const STARTER_TASKS: { text: string; priority: Priority; category: string }[] = [
  { text: "Record and post one short-form video today",  priority: "high",   category: "content" },
  { text: "Reply to comments on your last 3 posts",       priority: "medium", category: "growth" },
  { text: "Set up your first digital product",           priority: "high",   category: "admin" },
  { text: "Share your store link on social media",       priority: "medium", category: "growth" },
  { text: "Write your welcome email sequence",           priority: "medium", category: "content" },
];

function uid() { return Math.random().toString(36).slice(2, 10); }
function isOverdue(d?: string) { return !!d && new Date(d) < new Date(new Date().toDateString()); }
function fmtDate(d?: string) {
  if (!d) return null;
  const today = new Date(new Date().toDateString()).getTime();
  const t = new Date(d).getTime();
  if (t === today) return "Today";
  if (t === today + 86400000) return "Tomorrow";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function daysUntil(d?: string): number | null {
  if (!d) return null;
  return Math.round((new Date(d).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
}
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// ─── Circular ring ─────────────────────────────────────────────────────────────

function RingProgress({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-200 dark:text-gray-700" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s cubic-bezier(.4,0,.2,1)" }} />
    </svg>
  );
}

// ─── Tab nav ──────────────────────────────────────────────────────────────────

const TABS: { id: WorkspaceTab; label: string; icon: React.ReactNode }[] = [
  { id: "todos",    label: "To-Do List",       icon: <ListTodo className="w-4 h-4" /> },
  { id: "notes",    label: "Notes",            icon: <StickyNote className="w-4 h-4" /> },
  { id: "calendar", label: "Content Calendar", icon: <Calendar className="w-4 h-4" /> },
  { id: "goals",    label: "Goals",            icon: <Target className="w-4 h-4" /> },
];

const ADMIN_TABS: { id: WorkspaceTab; label: string; icon: React.ReactNode }[] = [
  { id: "research",              label: "Research",             icon: <BookOpen className="w-4 h-4" /> },
  { id: "marketing-psychology",  label: "Mktg Psychology",      icon: <Brain className="w-4 h-4" /> },
  { id: "copywriting",           label: "Copywriting",          icon: <FileText className="w-4 h-4" /> },
  { id: "content-ideas",         label: "Content Ideas",        icon: <Lightbulb className="w-4 h-4" /> },
  { id: "analytics",             label: "Analytics",            icon: <BarChart2 className="w-4 h-4" /> },
  { id: "distribution",          label: "Distribution",         icon: <Megaphone className="w-4 h-4" /> },
  { id: "experiments",           label: "Experiments",          icon: <FlaskConical className="w-4 h-4" /> },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TO-DO TAB
// ═══════════════════════════════════════════════════════════════════════════════

function TodoTab() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [saved, setSaved] = useState<SavedTask[]>([]);
  const [input, setInput] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("");
  const [filter, setFilter] = useState<TodoFilter>("all");
  const [catFilter, setCatFilter] = useState("");
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const priorityRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const t = localStorage.getItem("cf_todos"); if (t) setTodos(JSON.parse(t));
      const s = localStorage.getItem("cf_saved_tasks"); if (s) setSaved(JSON.parse(s));
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem("cf_todos", JSON.stringify(todos)); } catch {} }, [todos]);
  useEffect(() => { try { localStorage.setItem("cf_saved_tasks", JSON.stringify(saved)); } catch {} }, [saved]);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) setPriorityOpen(false);
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) setCategoryOpen(false);
      if (savedRef.current && !savedRef.current.contains(e.target as Node)) setSavedOpen(false);
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) setDateOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addTodo = (overrides?: Partial<Pick<Todo, "text"|"priority"|"category">>) => {
    const text = (overrides?.text ?? input).trim();
    if (!text) return;
    setTodos(prev => [{ id: uid(), text, completed: false, priority: overrides?.priority ?? priority, category: overrides?.category ?? (category || undefined), dueDate: dueDate || undefined, createdAt: Date.now() }, ...prev]);
    setInput(""); inputRef.current?.focus();
  };
  const toggle = (id: string) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    if (!todo.completed) { setCompletingIds(prev => new Set(prev).add(id)); setTimeout(() => setCompletingIds(prev => { const s = new Set(prev); s.delete(id); return s; }), 500); }
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };
  const remove = (id: string) => setTodos(prev => prev.filter(t => t.id !== id));
  const toggleSaved = (todo: Todo) => {
    const isSaved = saved.some(s => s.text === todo.text);
    if (isSaved) setSaved(prev => prev.filter(s => s.text !== todo.text));
    else setSaved(prev => [...prev, { id: uid(), text: todo.text, priority: todo.priority, category: todo.category }]);
  };
  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    setTodos(prev => {
      const items = [...prev];
      const from = items.findIndex(t => t.id === dragId);
      const to = items.findIndex(t => t.id === targetId);
      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved);
      return items;
    });
    setDragId(null); setDragOverId(null);
  };

  const filtered = todos.filter(t => {
    if (filter === "active" && t.completed) return false;
    if (filter === "completed" && !t.completed) return false;
    if (catFilter && t.category !== catFilter) return false;
    return true;
  });
  const activeCount = todos.filter(t => !t.completed).length;
  const overdueCount = todos.filter(t => !t.completed && isOverdue(t.dueDate)).length;
  const completedCount = todos.filter(t => t.completed).length;
  const progress = todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0;
  const getCat = (id?: string) => CATEGORIES.find(c => c.id === id);

  return (
    <div className="max-w-2xl">
      {/* Stats row */}
      {todos.length > 0 && (
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1">
            <div className="h-2 flex-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">{completedCount}/{todos.length}</span>
          </div>
          {overdueCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-red-500 bg-red-500/10 px-2.5 py-1 rounded-full">
              <AlertCircle className="w-3 h-3" />{overdueCount} overdue
            </span>
          )}
        </div>
      )}

      {/* Input row */}
      <div className="mb-4 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addTodo()} placeholder="Add a task… press Enter to save" className="flex-1 pr-10 h-10" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/40 font-mono pointer-events-none hidden sm:block">⏎</span>
          </div>
          <Button onClick={() => addTodo()} size="icon" className="h-10 w-10 bg-orange-500 hover:bg-orange-600 text-white shrink-0"><Plus className="w-4 h-4" /></Button>
        </div>

        {/* Toolbar row */}
        <div className="flex gap-2 flex-wrap items-center">
          {/* Priority */}
          <div className="relative" ref={priorityRef}>
            <button onClick={() => setPriorityOpen(v => !v)} className={cn("flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs transition-all", PRIORITY[priority].bg, "border-transparent", PRIORITY[priority].color)}>
              <span className={cn("w-2 h-2 rounded-full", PRIORITY[priority].dot)} />{PRIORITY[priority].label}
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
            {priorityOpen && (
              <div className="absolute top-full mt-1 left-0 z-20 bg-popover border border-border rounded-xl shadow-lg min-w-[110px] py-1">
                {(["high","medium","low"] as Priority[]).map(p => (
                  <button key={p} onClick={() => { setPriority(p); setPriorityOpen(false); }} className={cn("flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-accent rounded-md mx-1 w-[calc(100%-8px)]", priority === p && "font-semibold")}>
                    <span className={cn("w-2 h-2 rounded-full", PRIORITY[p].dot)} /><span className={PRIORITY[p].color}>{PRIORITY[p].label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Due date */}
          <div className="relative" ref={dateRef}>
            <button onClick={() => setDateOpen(v => !v)} className={cn("flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs transition-all", dueDate ? "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400" : "border-border bg-background hover:bg-accent text-muted-foreground")}>
              <Calendar className="w-3 h-3" />{dueDate ? fmtDate(dueDate) : "Date"}
              {dueDate && <button onClick={e => { e.stopPropagation(); setDueDate(""); }} className="ml-0.5 hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>}
            </button>
            {dateOpen && (
              <div className="absolute top-full mt-1 left-0 z-20 bg-popover border border-border rounded-xl shadow-lg w-48 py-1">
                {[{ label: "Today", value: new Date().toISOString().slice(0,10) }, { label: "Tomorrow", value: new Date(Date.now()+86400000).toISOString().slice(0,10) }].map(opt => (
                  <button key={opt.label} onClick={() => { setDueDate(opt.value); setDateOpen(false); }} className={cn("flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-accent", dueDate === opt.value && "font-medium text-orange-500")}>
                    <Calendar className="w-3 h-3 text-muted-foreground" />{opt.label}
                  </button>
                ))}
                <div className="border-t border-border mt-1 pt-1.5 px-3 pb-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Custom date</p>
                  <input type="date" value={dueDate} onChange={e => { setDueDate(e.target.value); setDateOpen(false); }} className="w-full h-7 px-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
              </div>
            )}
          </div>

          {/* Category */}
          <div className="relative" ref={categoryRef}>
            <button onClick={() => setCategoryOpen(v => !v)} className={cn("flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs transition-all", category ? cn(getCat(category)?.color, "border-transparent") : "border-border bg-background hover:bg-accent text-muted-foreground")}>
              <Tag className="w-3 h-3" />
              {category ? getCat(category)?.name : "Label"}
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
            {categoryOpen && (
              <div className="absolute top-full mt-1 left-0 z-20 bg-popover border border-border rounded-xl shadow-lg min-w-[130px] py-1">
                <button onClick={() => { setCategory(""); setCategoryOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-accent text-muted-foreground">None</button>
                {CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => { setCategory(cat.id); setCategoryOpen(false); }} className={cn("flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-accent", category === cat.id && "font-semibold")}>
                    <span className={cn("w-2 h-2 rounded-full", cat.dot)} />{cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Saved templates */}
          <div className="relative ml-auto" ref={savedRef}>
            <button onClick={() => setSavedOpen(v => !v)} className={cn("flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs transition-all", savedOpen ? "border-orange-500/40 bg-orange-500/10 text-orange-500" : "border-border bg-background hover:bg-accent text-muted-foreground")}>
              <Bookmark className="w-3 h-3" />Saved
              {saved.length > 0 && <span className="ml-0.5 bg-orange-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">{saved.length}</span>}
            </button>
            {savedOpen && (
              <div className="absolute top-full mt-1 right-0 z-20 bg-popover border border-border rounded-xl shadow-lg w-68 py-1 min-w-[260px]">
                <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Saved Tasks</p>
                {saved.length === 0 ? <p className="px-3 py-3 text-xs text-muted-foreground">Bookmark a task to save it for re-use.</p> :
                  saved.map(st => { const cat = getCat(st.category); return (
                    <button key={st.id} onClick={() => { addTodo({ text: st.text, priority: st.priority, category: st.category }); setSavedOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-accent text-left transition-colors">
                      <span className={cn("w-2 h-2 rounded-full shrink-0", PRIORITY[st.priority].dot)} />
                      <span className="truncate flex-1">{st.text}</span>
                      {cat && <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full shrink-0", cat.color)}>{cat.name}</span>}
                    </button>
                  );})
                }
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter tabs — single row */}
      <div className="mb-4 flex items-center gap-1 flex-wrap">
        {(["all","active","completed"] as TodoFilter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all", filter === f ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
            {f === "all" ? `All (${todos.length})` : f === "active" ? `Active (${activeCount})` : `Done (${completedCount})`}
          </button>
        ))}
        <div className="w-px h-4 bg-border mx-1" />
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setCatFilter(catFilter === cat.id ? "" : cat.id)} className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all", catFilter === cat.id ? cn(cat.color, "border-transparent") : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
            <span className={cn("w-1.5 h-1.5 rounded-full", cat.dot)} />{cat.name}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {filtered.length === 0 && todos.length === 0 && (
          <div>
            <div className="mb-4 p-4 rounded-2xl bg-gradient-to-br from-orange-500/8 to-amber-500/8 border border-orange-500/15">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-orange-500" />
                <p className="text-sm font-bold text-foreground">Get started — pick a task</p>
              </div>
              <p className="text-xs text-muted-foreground">Or type your own above.</p>
            </div>
            <div className="space-y-2">
              {STARTER_TASKS.map((t, i) => {
                const cat = getCat(t.category);
                return (
                  <button key={i} onClick={() => setTodos(prev => [{ id: uid(), text: t.text, completed: false, priority: t.priority, category: t.category, createdAt: Date.now() }, ...prev])}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-border hover:border-orange-500/40 hover:bg-orange-500/5 transition-all text-left group">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", PRIORITY[t.priority].dot)} />
                    <span className="flex-1 text-sm text-foreground">{t.text}</span>
                    {cat && <span className={cn("text-xs px-2 py-0.5 rounded-full shrink-0", cat.color)}>{cat.name}</span>}
                    <Plus className="w-4 h-4 text-muted-foreground/40 group-hover:text-orange-500 shrink-0 transition-colors" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {filtered.length === 0 && todos.length > 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {filter === "completed" ? "No completed tasks yet." : filter === "active" ? "🎉 All done! Nothing left to do." : "No tasks match this filter."}
          </div>
        )}
        {filtered.map(todo => {
          const cat = getCat(todo.category);
          const overdue = isOverdue(todo.dueDate) && !todo.completed;
          const isCompleting = completingIds.has(todo.id);
          const isSaved = saved.some(s => s.text === todo.text);
          return (
            <div key={todo.id} draggable onDragStart={() => setDragId(todo.id)} onDragOver={e => { e.preventDefault(); setDragOverId(todo.id); }} onDrop={() => handleDrop(todo.id)} onDragEnd={() => { setDragId(null); setDragOverId(null); }}
              className={cn("group flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-card transition-all duration-150",
                dragOverId === todo.id && dragId !== todo.id ? "border-orange-500/40 bg-orange-500/5" : "border-border",
                dragId === todo.id && "opacity-40 scale-[0.98]",
                todo.completed && "opacity-50",
                overdue && !todo.completed && "border-red-500/30 bg-red-500/5")}>
              <GripVertical className="w-4 h-4 text-muted-foreground/30 cursor-grab shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <button onClick={() => toggle(todo.id)} className={cn("shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200",
                todo.completed ? "border-green-500 bg-green-500 text-white" : "border-muted-foreground/30 hover:border-orange-500",
                isCompleting && "scale-125")}>
                {todo.completed && <Check className="w-3 h-3" strokeWidth={3} />}
              </button>
              <div className="flex-1 min-w-0">
                <span className={cn("text-sm font-medium", todo.completed ? "line-through text-muted-foreground" : "text-foreground")}>{todo.text}</span>
                {(todo.dueDate || cat) && (
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {todo.dueDate && <span className={cn("text-xs flex items-center gap-0.5 font-medium", overdue ? "text-red-400" : "text-muted-foreground")}>{overdue && "⚠ "}{fmtDate(todo.dueDate)}</span>}
                    {cat && <span className={cn("text-xs px-1.5 py-0.5 rounded-full", cat.color)}>{cat.name}</span>}
                  </div>
                )}
              </div>
              <span className={cn("text-xs shrink-0 flex items-center gap-1 font-medium", PRIORITY[todo.priority].color)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", PRIORITY[todo.priority].dot)} />
              </span>
              <button onClick={() => toggleSaved(todo)} className={cn("shrink-0 transition-all", isSaved ? "opacity-100 text-orange-500" : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-orange-500")}>
                {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              </button>
              <button onClick={() => remove(todo.id)} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"><X className="w-4 h-4" /></button>
            </div>
          );
        })}
      </div>
      {completedCount > 0 && (
        <div className="mt-4 flex justify-end">
          <button onClick={() => setTodos(prev => prev.filter(t => !t.completed))} className="text-xs text-muted-foreground hover:text-red-500 transition-colors">Clear {completedCount} completed</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTES TAB
// ═══════════════════════════════════════════════════════════════════════════════

type FontSize = "sm" | "base" | "lg";
type FontFamily = "sans" | "mono";

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function cleanPreview(body: string): string {
  return body
    .replace(/^#+\s/gm, "")
    .replace(/\*\*/g, "")
    .replace(/_/g, "")
    .replace(/^>\s/gm, "")
    .replace(/^-\s/gm, "")
    .replace(/`/g, "")
    .replace(/\n+/g, " ")
    .trim();
}

const AI_WRITING_ACTIONS = new Set(["improve-writing", "expand-idea", "summarise", "shorten", "rewrite"]);

const AI_ACTIONS: { id: string; label: string; icon: JSX.Element; nav?: boolean }[] = [
  { id: "improve-writing",    label: "Improve Writing",          icon: <Wand2 className="w-3 h-3" /> },
  { id: "expand-idea",        label: "Expand Idea",              icon: <Sparkles className="w-3 h-3" /> },
  { id: "summarise",          label: "Summarise",                icon: <AlignLeft className="w-3 h-3" /> },
  { id: "turn-into-script",   label: "Turn into Script",         icon: <Mic className="w-3 h-3" />, nav: true },
  { id: "turn-into-carousel", label: "Turn into Carousel",       icon: <Layers className="w-3 h-3" />, nav: true },
  { id: "turn-into-video",    label: "Turn into Video Guide",    icon: <Video className="w-3 h-3" />, nav: true },
  { id: "turn-into-product",  label: "Turn into Digital Product",icon: <Package className="w-3 h-3" />, nav: true },
];

function NotesTab() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [tagFilter, setTagFilter] = useState<NoteTag | "">("");
  const [fontSize, setFontSize] = useState<FontSize>("base");
  const [fontFamily, setFontFamily] = useState<FontFamily>("sans");
  const [copied, setCopied] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [autoSaved, setAutoSaved] = useState(false);
  const [showConnected, setShowConnected] = useState(true);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    try {
      const n = localStorage.getItem("cf_notes");
      if (n) {
        const parsed = JSON.parse(n) as Note[];
        setNotes(parsed);
        if (parsed.length > 0) setActiveId(parsed[0].id);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (isFirstLoad.current) { isFirstLoad.current = false; return; }
    try { localStorage.setItem("cf_notes", JSON.stringify(notes)); } catch {}
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setAutoSaved(true);
    autoSaveTimer.current = setTimeout(() => setAutoSaved(false), 2000);
  }, [notes]);

  const createNote = (templateKey = "blank") => {
    const tpl = NOTE_TEMPLATES[templateKey] ?? NOTE_TEMPLATES.blank;
    const note: Note = { id: uid(), title: tpl.title || "Untitled note", body: tpl.body, updatedAt: Date.now(), tag: tpl.tag };
    setNotes(prev => [note, ...prev]);
    setActiveId(note.id);
    setShowTemplates(false);
  };

  const updateNote = (id: string, patch: Partial<Note>) =>
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n));

  const deleteNote = (id: string) =>
    setNotes(prev => { const next = prev.filter(n => n.id !== id); setActiveId(next[0]?.id ?? null); return next; });

  const duplicateNote = (note: Note) => {
    const copy: Note = { ...note, id: uid(), title: `${note.title} (copy)`, updatedAt: Date.now() };
    setNotes(prev => [copy, ...prev]);
    setActiveId(copy.id);
  };

  const togglePin = (id: string) =>
    setNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned, updatedAt: n.updatedAt } : n));

  const copyToClipboard = async () => {
    if (!active) return;
    const text = `# ${active.title}\n\n${active.body}`;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  const handleAiAction = async (actionId: string, selectedText?: string, replaceCallback?: (result: string) => void) => {
    if (!active) return;
    if (AI_WRITING_ACTIONS.has(actionId)) {
      setAiLoading(actionId);
      const textToSend = selectedText || active.body;
      try {
        const res = await fetch("/api/notes/ai-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: actionId, title: active.title, body: textToSend }),
        });
        const json = await res.json() as { result?: string; error?: string };
        if (json.result) {
          if (replaceCallback) {
            // Selection-level replacement
            replaceCallback(json.result);
          } else {
            // Full note replacement
            updateNote(active.id, { body: json.result, content: undefined });
          }
        }
      } catch {}
      finally { setAiLoading(null); }
      return;
    }
    // Navigation actions — prefill via sessionStorage
    const prefill = JSON.stringify({ title: active.title, body: active.body });
    try { sessionStorage.setItem("note_prefill", prefill); } catch {}
    if (actionId === "turn-into-script" || actionId === "turn-into-video") {
      router.push("/dashboard/video-guide/new");
    } else if (actionId === "turn-into-carousel") {
      router.push("/dashboard/design-studio");
    } else if (actionId === "turn-into-product") {
      router.push("/dashboard/library");
    }
  };

  const active = notes.find(n => n.id === activeId);
  const words = active?.body.trim() ? active.body.trim().split(/\s+/).length : 0;
  const readTime = Math.max(1, Math.ceil(words / 200));

  // Backlinks: other notes that mention this note by ID via @mention
  const backlinks = active ? notes.filter(n => {
    if (n.id === active.id) return false;
    if (!n.content) return false;
    try {
      const json = JSON.parse(n.content) as { content?: { content?: { type?: string; attrs?: { id?: string } }[] }[] };
      return JSON.stringify(json).includes(`"id":"${active.id}"`);
    } catch { return false; }
  }) : [];

  // Related: same tag, different note
  const relatedByTag = active?.tag ? notes.filter(n => n.id !== active.id && n.tag === active.tag).slice(0, 5) : [];
  const hasConnections = backlinks.length > 0 || relatedByTag.length > 0;

  const sorted = [...notes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.updatedAt - a.updatedAt;
  });
  const filteredNotes = sorted.filter(n => {
    const q = search.toLowerCase();
    if (q && !n.title.toLowerCase().includes(q) && !n.body.toLowerCase().includes(q)) return false;
    if (tagFilter && n.tag !== tagFilter) return false;
    return true;
  });

  const FONT_SIZES: Record<FontSize, string> = { sm: "text-sm", base: "text-base", lg: "text-lg" };
  const FONT_FAMILIES: Record<FontFamily, string> = { sans: "font-sans", mono: "font-mono" };

  // Ref list for @mention
  const noteRefs = notes.map(n => ({ id: n.id, title: n.title }));

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[500px] rounded-2xl border border-border overflow-hidden shadow-sm">

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <div className="w-[272px] shrink-0 flex flex-col bg-muted/20 dark:bg-[#0A0A0A] border-r border-border">

        {/* Sidebar header */}
        <div className="px-4 pt-4 pb-3 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">Notes</p>
              <p className="text-[10px] text-muted-foreground mt-px">{notes.length} saved</p>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowTemplates(v => !v)}
                className="flex items-center gap-1.5 h-8 px-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />New
                <ChevronDown className={cn("w-3 h-3 opacity-70 transition-transform duration-150", showTemplates && "rotate-180")} />
              </button>
              {showTemplates && (
                <div className="absolute top-full mt-1.5 right-0 z-30 bg-popover border border-border rounded-xl shadow-xl py-1 min-w-[188px] overflow-hidden">
                  {Object.entries(NOTE_TEMPLATES).map(([key, tpl]) => (
                    <button key={key} onClick={() => createNote(key)}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-accent transition-colors">
                      <span className="text-base leading-none">{tpl.emoji}</span>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{tpl.label}</p>
                        {key !== "blank" && <p className="text-[10px] text-muted-foreground capitalize">{tpl.tag}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notes…"
              className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-border bg-background/60 focus:outline-none focus:ring-1 focus:ring-orange-400/50 placeholder:text-muted-foreground/50 transition-shadow"
            />
          </div>

          {/* Tag filter */}
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setTagFilter("")}
              className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all",
                tagFilter === "" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/50")}>
              All
            </button>
            {(Object.keys(NOTE_TAGS) as NoteTag[]).map(tag => (
              <button key={tag} onClick={() => setTagFilter(t => t === tag ? "" : tag)}
                className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all",
                  tagFilter === tag ? NOTE_TAGS[tag].pill : "border-border text-muted-foreground hover:border-foreground/50")}>
                {NOTE_TAGS[tag].label}
              </button>
            ))}
          </div>
        </div>

        {/* Note list */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-px">
          {filteredNotes.length === 0 ? (
            <div className="py-12 text-center px-4">
              <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <StickyNote className="w-5 h-5 text-muted-foreground/30" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                {search || tagFilter ? "No matches found" : "No notes yet"}
              </p>
              {!search && !tagFilter && (
                <button onClick={() => createNote()}
                  className="mt-2 text-[11px] text-orange-500 hover:underline font-medium">
                  Create your first note
                </button>
              )}
            </div>
          ) : filteredNotes.map(note => {
            const isActive = activeId === note.id;
            const preview = cleanPreview(note.body).slice(0, 100);
            return (
              <button key={note.id} onClick={() => setActiveId(note.id)}
                className={cn(
                  "w-full text-left px-3 py-3 rounded-xl border transition-all duration-150 group relative",
                  isActive
                    ? "bg-white dark:bg-[#1C1C1C] border-orange-400/40 shadow-sm shadow-orange-500/5"
                    : "bg-transparent border-transparent hover:bg-white/70 dark:hover:bg-white/5 hover:border-border/60 hover:shadow-sm"
                )}>
                {/* Left accent bar */}
                <div className={cn(
                  "absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full transition-all duration-150",
                  isActive
                    ? note.tag ? NOTE_TAGS[note.tag].dot : "bg-orange-500"
                    : "bg-transparent group-hover:bg-border/60"
                )} />

                <div className="pl-1.5">
                  <div className="flex items-start gap-1.5 mb-1">
                    {note.pinned && <Pin className="w-3 h-3 text-orange-400 shrink-0 mt-0.5" />}
                    <p className={cn(
                      "text-[13px] font-semibold leading-snug truncate transition-colors pr-8",
                      isActive ? "text-foreground" : "text-foreground/80 group-hover:text-foreground"
                    )}>
                      {note.title || "Untitled"}
                    </p>
                  </div>

                  {preview && (
                    <p className="text-[11px] text-muted-foreground/60 line-clamp-2 leading-relaxed mb-1.5">
                      {preview}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-1">
                    <div>
                      {note.tag ? (
                        <span className={cn("inline-block px-1.5 py-px rounded-full text-[9px] font-bold border", NOTE_TAGS[note.tag].pill)}>
                          {NOTE_TAGS[note.tag].label}
                        </span>
                      ) : <span />}
                    </div>
                    <span className="text-[10px] text-muted-foreground/40 shrink-0">
                      {formatRelativeTime(note.updatedAt)}
                    </span>
                  </div>
                </div>

                {/* Hover actions */}
                <div className="absolute top-2.5 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <button onClick={e => { e.stopPropagation(); togglePin(note.id); }}
                    title={note.pinned ? "Unpin" : "Pin"}
                    className={cn(
                      "w-6 h-6 rounded-md flex items-center justify-center transition-colors",
                      note.pinned ? "text-orange-500 bg-orange-500/10" : "text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10"
                    )}>
                    <Pin className="w-3 h-3" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); deleteNote(note.id); }}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground/50">{notes.length} note{notes.length !== 1 ? "s" : ""}</p>
          {notes.length > 0 && (
            <p className="text-[10px] text-muted-foreground/40">
              {notes.reduce((acc, n) => acc + (n.body ? n.body.trim().split(/\s+/).length : 0), 0).toLocaleString()} words
            </p>
          )}
        </div>
      </div>

      {/* ── Editor ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-card dark:bg-[#0F0F0F] overflow-hidden">
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 p-10">
            <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center">
              <StickyNote className="w-7 h-7 text-muted-foreground/30" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground mb-1.5">Your workspace awaits</p>
              <p className="text-sm text-muted-foreground max-w-xs">Pick a note from the list or start fresh with a template</p>
            </div>
            <div className="flex flex-col gap-2 items-stretch w-64 mt-1">
              {Object.entries(NOTE_TEMPLATES).slice(0, 3).map(([key, tpl]) => (
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
            {/* ── AI Action Bar ─────────────────────────────────────────────── */}
            <div className="px-6 py-2.5 border-b border-border/50 bg-gradient-to-r from-orange-500/[0.03] to-amber-500/[0.03] dark:from-orange-500/[0.06] dark:to-amber-500/[0.06] shrink-0">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-px">
                <div className="flex items-center gap-1.5 shrink-0 mr-0.5">
                  <Sparkles className="w-3 h-3 text-orange-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500/80">AI</span>
                  <div className="w-px h-3.5 bg-orange-500/20 ml-0.5" />
                </div>
                {AI_ACTIONS.map(action => (
                  <button
                    key={action.id}
                    onClick={() => handleAiAction(action.id)}
                    disabled={!!aiLoading}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap border transition-all duration-150 shrink-0",
                      aiLoading === action.id
                        ? "bg-orange-500/10 border-orange-500/30 text-orange-500"
                        : "border-border/70 text-muted-foreground hover:text-foreground hover:border-orange-400/50 hover:bg-orange-500/5 disabled:opacity-40 disabled:cursor-not-allowed"
                    )}>
                    {aiLoading === action.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : action.icon
                    }
                    {action.label}
                    {action.nav && aiLoading !== action.id && (
                      <ChevronRight className="w-2.5 h-2.5 opacity-40 ml-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Note header ───────────────────────────────────────────────── */}
            <div className="px-8 pt-6 pb-4 border-b border-border/40 shrink-0">
              <input
                value={active.title}
                onChange={e => updateNote(active.id, { title: e.target.value })}
                className="w-full text-2xl font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/30 leading-tight mb-3"
                placeholder="Untitled note"
              />

              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <span className="text-[11px] text-muted-foreground/60">
                  Last edited {formatRelativeTime(active.updatedAt)}
                </span>
                {autoSaved && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
                    <Check className="w-3 h-3" /> Auto saved
                  </span>
                )}
                {words > 0 && (
                  <span className="text-[11px] text-muted-foreground/40">
                    {words} words · {readTime} min read
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 flex-wrap">
                  {(Object.keys(NOTE_TAGS) as NoteTag[]).map(tag => (
                    <button key={tag} onClick={() => updateNote(active.id, { tag: active.tag === tag ? undefined : tag })}
                      className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all",
                        active.tag === tag ? NOTE_TAGS[tag].pill : "border-border text-muted-foreground/50 hover:border-foreground/30")}>
                      {NOTE_TAGS[tag].label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Font size */}
                  <div className="flex items-center gap-px bg-muted/40 rounded-lg p-0.5">
                    {([["sm", "text-[10px]"], ["base", "text-[12px]"], ["lg", "text-[14px]"]] as [FontSize, string][]).map(([s, cls]) => (
                      <button key={s} onClick={() => setFontSize(s)}
                        className={cn("px-1.5 py-0.5 rounded-md font-bold leading-none transition-colors", cls,
                          fontSize === s ? "bg-orange-500/15 text-orange-500" : "text-muted-foreground hover:text-foreground")}>A</button>
                    ))}
                  </div>
                  {/* Font family */}
                  <button onClick={() => setFontFamily(f => f === "sans" ? "mono" : "sans")}
                    className={cn("px-2 py-1 rounded-lg text-[10px] font-bold transition-colors",
                      fontFamily === "mono" ? "bg-orange-500/15 text-orange-500" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
                    {fontFamily === "mono" ? "Mono" : "Aa"}
                  </button>
                  <div className="w-px h-4 bg-border/60 mx-0.5" />
                  {hasConnections && (
                    <button onClick={() => setShowConnected(v => !v)}
                      title="Toggle Connected Notes panel"
                      className={cn("px-2 py-1 rounded-lg text-[10px] font-bold border transition-all",
                        showConnected ? "bg-orange-500/10 border-orange-400/40 text-orange-500" : "border-border text-muted-foreground hover:text-foreground")}>
                      Links {backlinks.length + relatedByTag.length > 0 ? `(${backlinks.length + relatedByTag.length})` : ""}
                    </button>
                  )}
                  <button onClick={copyToClipboard} title="Copy as markdown"
                    className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all",
                      copied ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : "border-border text-muted-foreground hover:text-foreground hover:bg-accent")}>
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <button onClick={() => duplicateNote(active)} title="Duplicate"
                    className="w-8 h-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all flex items-center justify-center">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteNote(active.id)} title="Delete note"
                    className="w-8 h-8 rounded-lg border border-border text-muted-foreground hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/5 transition-all flex items-center justify-center">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Editor + Connected Notes ───────────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden">

              {/* Rich text editor */}
              <NoteEditor
                key={active.id}
                content={active.content ?? active.body}
                isLegacy={!active.content && !!active.body}
                onUpdate={(jsonStr, text) => {
                  updateNote(active.id, { content: jsonStr, body: text });
                }}
                allNotes={noteRefs}
                noteId={active.id}
                fontSize={FONT_SIZES[fontSize]}
                fontFamily={FONT_FAMILIES[fontFamily]}
                onAiAction={(actionId, selectedText, replaceCallback) => {
                  handleAiAction(actionId, selectedText, replaceCallback);
                }}
                placeholder="Start writing… type / for commands, @ to link a note"
              />

              {/* ── Connected Notes Panel ──────────────────────────────── */}
              {showConnected && hasConnections && (
                <div className="w-[220px] shrink-0 border-l border-border/50 bg-muted/10 dark:bg-[#0A0A0A] flex flex-col overflow-hidden">
                  <div className="px-4 pt-3 pb-2 border-b border-border/40">
                    <p className="text-[11px] font-bold text-foreground">Connected Notes</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-4">
                    {backlinks.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1.5">Referenced By</p>
                        <div className="space-y-1">
                          {backlinks.map(note => (
                            <button key={note.id} onClick={() => setActiveId(note.id)}
                              className="w-full flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors text-left group">
                              <span className="text-orange-500 text-[10px] mt-0.5 shrink-0">↙</span>
                              <div className="min-w-0">
                                <p className="text-[12px] font-medium text-foreground truncate group-hover:text-orange-500 transition-colors">{note.title || "Untitled"}</p>
                                <p className="text-[10px] text-muted-foreground/50">{formatRelativeTime(note.updatedAt)}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {relatedByTag.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1.5">Same Tag</p>
                        <div className="space-y-1">
                          {relatedByTag.map(note => (
                            <button key={note.id} onClick={() => setActiveId(note.id)}
                              className="w-full flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors text-left group">
                              <span className="text-muted-foreground/50 text-[10px] mt-0.5 shrink-0">→</span>
                              <div className="min-w-0">
                                <p className="text-[12px] font-medium text-foreground truncate group-hover:text-orange-500 transition-colors">{note.title || "Untitled"}</p>
                                <p className="text-[10px] text-muted-foreground/50">{formatRelativeTime(note.updatedAt)}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// CALENDAR TAB
// ═══════════════════════════════════════════════════════════════════════════════

function CalendarTab() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<CalEvent["type"]>("post");
  const [newPlatform, setNewPlatform] = useState("");

  useEffect(() => { try { const e = localStorage.getItem("cf_cal_events"); if (e) setEvents(JSON.parse(e)); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem("cf_cal_events", JSON.stringify(events)); } catch {} }, [events]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const days: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const eventsOn = (d: Date) => events.filter(e => e.date === fmt(d));
  const isToday = (d: Date) => fmt(d) === fmt(today);
  const calType = (id: string) => CAL_TYPES.find(t => t.id === id) ?? CAL_TYPES[3];

  const addEvent = () => {
    if (!selectedDate || !newTitle.trim()) return;
    setEvents(prev => [...prev, { id: uid(), title: newTitle.trim(), date: selectedDate, type: newType, platform: newPlatform.trim() || undefined }]);
    setNewTitle(""); setNewPlatform(""); setAdding(false);
  };
  const removeEvent = (id: string) => setEvents(prev => prev.filter(e => e.id !== id));

  const selectedEvents = selectedDate ? events.filter(e => e.date === selectedDate) : [];
  const todayStr = fmt(today);
  const in14 = new Date(today); in14.setDate(in14.getDate() + 14);
  const upcomingEvents = events.filter(e => e.date >= todayStr && e.date <= fmt(in14)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);

  return (
    <div className="flex gap-5 flex-wrap lg:flex-nowrap">
      {/* Calendar grid */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-accent transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <h3 className="font-bold text-base">{MONTHS[month]} {year}</h3>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-accent transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {DAYS.map(d => <div key={d} className="text-[10px] text-center text-muted-foreground font-semibold py-1 uppercase tracking-wide">{d}</div>)}
        </div>

        <div className="grid grid-cols-7 border-t border-l border-border rounded-lg overflow-hidden">
          {days.map((d, i) => {
            if (!d) return <div key={`pad-${i}`} className="border-b border-r border-border bg-muted/20 h-20 sm:h-24" />;
            const dayEvents = eventsOn(d);
            const dateStr = fmt(d);
            const isSelected = selectedDate === dateStr;
            const hasDomEvents = dayEvents.length > 0;
            return (
              <div key={dateStr} onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={cn("border-b border-r border-border h-20 sm:h-24 p-1.5 cursor-pointer transition-all duration-150 overflow-hidden",
                  isSelected ? "bg-orange-500/10 ring-inset ring-1 ring-orange-500/40" : hasDomEvents ? "bg-purple-500/5 hover:bg-purple-500/10" : "hover:bg-accent")}>
                <p className={cn("text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full", isToday(d) ? "bg-orange-500 text-white" : "text-foreground")}>{d.getDate()}</p>
                <div className="mt-0.5 space-y-px">
                  {dayEvents.slice(0, 2).map(ev => (
                    <div key={ev.id} className={cn("flex items-center gap-1 px-1 py-px rounded text-[9px] font-semibold leading-tight truncate", calType(ev.type).text, calType(ev.type).bg)}>
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && <p className="text-[9px] text-muted-foreground pl-1">+{dayEvents.length - 2}</p>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-4 mt-3 flex-wrap">
          {CAL_TYPES.map(t => (
            <span key={t.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("w-2 h-2 rounded-full", t.color)} />{t.label}
            </span>
          ))}
        </div>
      </div>

      {/* Side panel */}
      <div className="w-72 shrink-0 space-y-3">
        {selectedDate ? (
          <>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm">{new Date(selectedDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</h4>
              <button onClick={() => setSelectedDate(null)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><X className="w-4 h-4" /></button>
            </div>

            {selectedEvents.length === 0 && !adding && (
              <p className="text-xs text-muted-foreground py-1">Nothing planned for this day.</p>
            )}

            <div className="space-y-2">
              {selectedEvents.map(ev => {
                const t = calType(ev.type);
                return (
                  <div key={ev.id} className="flex items-start gap-2.5 p-3 rounded-xl border border-border bg-card group">
                    <span className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", t.color)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{ev.title}</p>
                      <p className={cn("text-xs capitalize font-medium", t.text)}>{ev.type}{ev.platform ? ` · ${ev.platform}` : ""}</p>
                    </div>
                    <button onClick={() => removeEvent(ev.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                );
              })}
            </div>

            {adding ? (
              <div className="space-y-2 p-3 rounded-xl border border-border bg-card">
                <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && addEvent()} placeholder="What's happening?" className="h-8 text-sm" autoFocus />
                <div className="flex gap-1 flex-wrap">
                  {CAL_TYPES.map(t => (
                    <button key={t.id} onClick={() => setNewType(t.id as CalEvent["type"])} className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border transition-all", newType === t.id ? cn(t.text, t.bg, "border-transparent") : "border-border text-muted-foreground hover:border-foreground")}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <Input value={newPlatform} onChange={e => setNewPlatform(e.target.value)} placeholder="Platform (TikTok, IG…)" className="h-8 text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-8 bg-orange-500 hover:bg-orange-600 text-white" onClick={addEvent}>Save</Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setAdding(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs font-semibold text-orange-500 hover:text-orange-600 transition-colors">
                <Plus className="w-3.5 h-3.5" />Add to this day
              </button>
            )}
          </>
        ) : (
          <>
            <h4 className="font-bold text-sm text-foreground">Coming up</h4>
            {upcomingEvents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-5 text-center space-y-2">
                <Calendar className="w-8 h-8 mx-auto text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">No events in the next 14 days</p>
                <p className="text-[11px] text-muted-foreground/60">Click any day to schedule a post or launch</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map(ev => {
                  const d = new Date(ev.date + "T00:00:00");
                  const isEv = ev.date === todayStr;
                  const isTmrw = ev.date === new Date(Date.now()+86400000).toISOString().slice(0,10);
                  const label = isEv ? "Today" : isTmrw ? "Tomorrow" : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
                  const t = calType(ev.type);
                  return (
                    <button key={ev.id} onClick={() => setSelectedDate(ev.date)} className="w-full flex items-start gap-2.5 p-2.5 rounded-xl border border-border bg-card hover:bg-accent transition-colors text-left group">
                      <span className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", t.color)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate text-foreground">{ev.title}</p>
                        <p className={cn("text-[10px] font-medium", t.text)}>{label}{ev.platform ? ` · ${ev.platform}` : ""}</p>
                      </div>
                    </button>
                  );
                })}
                <p className="text-[10px] text-muted-foreground/60 pt-1">Next 14 days · Click to edit</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GOALS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function GoalsTab() {
  const [goals, setGoals] = useState<Goal[]>(DEFAULT_GOALS);
  const [editId, setEditId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [newColor, setNewColor] = useState(GOAL_COLORS[0]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateInput, setUpdateInput] = useState("");

  useEffect(() => { try { const g = localStorage.getItem("cf_goals"); if (g) setGoals(JSON.parse(g)); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem("cf_goals", JSON.stringify(goals)); } catch {} }, [goals]);

  const updateGoal = (id: string, patch: Partial<Goal>) => setGoals(prev => prev.map(g => g.id === id ? { ...g, ...patch } : g));
  const deleteGoal = (id: string) => setGoals(prev => prev.filter(g => g.id !== id));
  const addGoal = () => {
    if (!newLabel.trim() || !newTarget) return;
    setGoals(prev => [...prev, { id: uid(), label: newLabel.trim(), target: Number(newTarget), current: 0, unit: newUnit.trim(), color: newColor, deadline: newDeadline || "" }]);
    setNewLabel(""); setNewTarget(""); setNewUnit(""); setNewDeadline(""); setAdding(false);
  };
  const startUpdate = (goal: Goal) => { setUpdatingId(goal.id); setUpdateInput(String(goal.current)); };
  const commitUpdate = (id: string) => {
    const val = parseFloat(updateInput);
    if (!isNaN(val)) updateGoal(id, { current: Math.max(0, val) });
    setUpdatingId(null); setUpdateInput("");
  };

  return (
    <div className="max-w-3xl">
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        {goals.map(goal => {
          const pct = Math.min(100, goal.target > 0 ? Math.round((goal.current / goal.target) * 100) : 0);
          const isEditing = editId === goal.id;
          const isUpdating = updatingId === goal.id;
          const done = pct >= 100;
          const daysLeft = daysUntil(goal.deadline);
          const deadlineOverdue = daysLeft !== null && daysLeft < 0 && !done;
          const deadlineUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && !done;

          return (
            <div key={goal.id} className={cn("rounded-2xl border p-5 transition-all", done ? "border-green-500/30 bg-green-500/5" : "border-border bg-card hover:border-gray-300 dark:hover:border-gray-600")}>
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <input value={goal.label} onChange={e => updateGoal(goal.id, { label: e.target.value })}
                      className="font-bold text-sm bg-transparent border-b border-border outline-none w-full text-foreground" />
                  ) : (
                    <p className="font-bold text-sm text-foreground">{goal.label}</p>
                  )}
                  {!done && daysLeft !== null && (
                    <span className={cn("inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1",
                      deadlineOverdue ? "bg-red-500/10 text-red-500" : deadlineUrgent ? "bg-yellow-500/10 text-yellow-500" : "bg-muted text-muted-foreground")}>
                      {deadlineOverdue ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? "Due today" : `${daysLeft}d left`}
                    </span>
                  )}
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <button onClick={() => setEditId(isEditing ? null : goal.id)} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-accent transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteGoal(goal.id)} className="text-muted-foreground hover:text-red-500 p-1.5 rounded-lg hover:bg-accent transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              {/* Ring + stats */}
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <RingProgress pct={pct} color={done ? "#22c55e" : goal.color} size={72} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={cn("text-lg font-black leading-none", done ? "text-green-500" : "text-foreground")}>{pct}%</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-2xl font-black text-foreground leading-none mb-1">
                    {goal.unit}{goal.current.toLocaleString()}
                    <span className="text-sm font-normal text-muted-foreground ml-1">/ {goal.unit}{goal.target.toLocaleString()}</span>
                  </p>
                  {done ? (
                    <div className="flex items-center gap-1.5 mt-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-xs font-bold text-green-500">Goal reached! 🎉</span>
                    </div>
                  ) : (
                    <div className="mt-2">
                      {isUpdating ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={updateInput}
                            onChange={e => setUpdateInput(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") commitUpdate(goal.id); if (e.key === "Escape") { setUpdatingId(null); setUpdateInput(""); } }}
                            className="w-24 h-7 px-2 text-sm border border-orange-500/40 rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-orange-500"
                            autoFocus
                          />
                          <button onClick={() => commitUpdate(goal.id)} className="text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 px-2.5 py-1 rounded-lg transition-colors">Set</button>
                          <button onClick={() => { setUpdatingId(null); setUpdateInput(""); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => startUpdate(goal)} className="text-xs font-semibold text-muted-foreground hover:text-orange-500 border border-border hover:border-orange-500/40 px-2.5 py-1 rounded-lg transition-all">
                          Update progress
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Edit controls */}
              {isEditing && (
                <div className="mt-4 pt-4 border-t border-border space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide font-semibold">Target</p>
                      <input type="number" value={goal.target} onChange={e => updateGoal(goal.id, { target: Math.max(1, Number(e.target.value)) })}
                        className="w-full h-8 px-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                    </div>
                    <div className="w-20">
                      <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide font-semibold">Unit</p>
                      <input value={goal.unit} onChange={e => updateGoal(goal.id, { unit: e.target.value })}
                        className="w-full h-8 px-2 text-sm border border-border rounded-lg bg-background focus:outline-none" placeholder="£" />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide font-semibold">Deadline</p>
                    <input type="date" value={goal.deadline ?? ""} onChange={e => updateGoal(goal.id, { deadline: e.target.value })}
                      className="h-8 px-2 text-sm border border-border rounded-lg bg-background focus:outline-none w-full" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide font-semibold">Color</p>
                    <div className="flex gap-1.5">
                      {GOAL_COLORS.map(c => (
                        <button key={c} onClick={() => updateGoal(goal.id, { color: c })}
                          className={cn("w-6 h-6 rounded-full transition-all", goal.color === c && "ring-2 ring-offset-2 ring-ring")}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add goal */}
      {adding ? (
        <div className="p-5 rounded-2xl border border-dashed border-border bg-card space-y-3">
          <p className="text-sm font-bold text-foreground">New Goal</p>
          <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Goal label (e.g. Monthly Revenue)" className="h-9" autoFocus />
          <div className="flex gap-2">
            <Input type="number" value={newTarget} onChange={e => setNewTarget(e.target.value)} placeholder="Target (e.g. 1000)" className="h-9 flex-1" />
            <Input value={newUnit} onChange={e => setNewUnit(e.target.value)} placeholder="Unit (£, #)" className="h-9 w-24" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Deadline (optional)</p>
            <input type="date" value={newDeadline} onChange={e => setNewDeadline(e.target.value)} className="h-9 px-3 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring w-full" />
          </div>
          <div className="flex gap-2">
            {GOAL_COLORS.map(c => (
              <button key={c} onClick={() => setNewColor(c)} className={cn("w-6 h-6 rounded-full transition-all", newColor === c && "ring-2 ring-offset-2 ring-ring")} style={{ backgroundColor: c }} />
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-9 bg-orange-500 hover:bg-orange-600 text-white font-semibold" onClick={addGoal}>Add Goal</Button>
            <Button size="sm" variant="outline" className="h-9" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full py-3.5 rounded-2xl border border-dashed border-border text-sm font-semibold text-muted-foreground hover:text-orange-500 hover:border-orange-500/40 hover:bg-orange-500/5 transition-all flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" />Add a new goal
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOUNDER OS — SHARED TYPES & REUSABLE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

interface FounderEntry {
  id: string;
  category: string;
  type: string;
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface TypeOption { value: string; label: string }

interface EntryFormProps {
  types: TypeOption[];
  onSave: (data: { type: string; title: string; content: string; metadata?: Record<string, unknown> }) => void;
  onCancel: () => void;
  initial?: Partial<FounderEntry>;
  titlePlaceholder?: string;
  contentPlaceholder?: string;
  extraFields?: (
    type: string,
    metadata: Record<string, unknown>,
    setMeta: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
  ) => React.ReactNode;
}

function FounderWorkspaceEntryForm({
  types, onSave, onCancel, initial, titlePlaceholder, contentPlaceholder, extraFields,
}: EntryFormProps) {
  const [type, setType] = useState(initial?.type ?? types[0]?.value ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [meta, setMeta] = useState<Record<string, unknown>>((initial?.metadata ?? {}) as Record<string, unknown>);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({ type, title: title.trim(), content: content.trim(), metadata: meta });
  };

  return (
    <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-4 space-y-3">
      {/* Type selector */}
      {types.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {types.map(t => (
            <button key={t.value} onClick={() => setType(t.value)}
              className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                type === t.value
                  ? "bg-orange-500 text-white border-orange-500"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-orange-400")}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      <Input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder={titlePlaceholder ?? "Title…"}
        className="h-9"
        autoFocus
        onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSave()}
      />
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder={contentPlaceholder ?? "Notes, details, or context…"}
        rows={3}
        className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {extraFields?.(type, meta, setMeta)}
      <div className="flex gap-2">
        <Button size="sm" className="h-8 bg-orange-500 hover:bg-orange-600 text-white font-semibold flex-1" onClick={handleSave}>
          {initial?.id ? "Save changes" : "Add entry"}
        </Button>
        <Button size="sm" variant="outline" className="h-8" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

interface EntryCardProps {
  entry: FounderEntry;
  onDelete: (id: string) => void;
  onEdit: (entry: FounderEntry) => void;
  typeLabel?: string;
  renderMeta?: (meta: Record<string, unknown> | null) => React.ReactNode;
}

function FounderWorkspaceEntryCard({ entry, onDelete, onEdit, typeLabel, renderMeta }: EntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2 hover:border-orange-500/30 transition-colors">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {typeLabel && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/10 text-orange-500 border border-orange-500/20 uppercase tracking-wide">
                {typeLabel}
              </span>
            )}
            <p className="text-sm font-semibold text-foreground">{entry.title}</p>
          </div>
          {entry.content && (
            <p className={cn("text-sm text-muted-foreground mt-1 whitespace-pre-wrap", !expanded && "line-clamp-2")}>
              {entry.content}
            </p>
          )}
          {entry.content && entry.content.length > 100 && (
            <button onClick={() => setExpanded(v => !v)} className="mt-0.5 text-[11px] text-orange-500 hover:underline flex items-center gap-0.5">
              {expanded ? <><ChevronUp className="w-3 h-3" />Less</> : <><ChevronDown className="w-3 h-3" />More</>}
            </button>
          )}
          {renderMeta?.(entry.metadata)}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onEdit(entry)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(entry.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface SectionProps {
  category: string;
  types: TypeOption[];
  heading: string;
  description: string;
  titlePlaceholder?: string;
  contentPlaceholder?: string;
  extraFields?: EntryFormProps["extraFields"];
  renderMeta?: EntryCardProps["renderMeta"];
}

function FounderWorkspaceSection({
  category, types, heading, description, titlePlaceholder, contentPlaceholder, extraFields, renderMeta,
}: SectionProps) {
  const [entries, setEntries] = useState<FounderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FounderEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/founder-workspace?category=${encodeURIComponent(category)}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json() as FounderEntry[];
      setEntries(data);
    } catch {
      setError("Could not load entries");
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleSave = async (data: { type: string; title: string; content: string; metadata?: Record<string, unknown> }) => {
    try {
      if (editingEntry) {
        const res = await fetch("/api/founder-workspace", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingEntry.id, ...data }),
        });
        if (!res.ok) throw new Error("Failed to update");
        const updated = await res.json() as FounderEntry;
        setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
        setEditingEntry(null);
      } else {
        const res = await fetch("/api/founder-workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, ...data }),
        });
        if (!res.ok) throw new Error("Failed to create");
        const created = await res.json() as FounderEntry;
        setEntries(prev => [...prev, created]);
        setShowForm(false);
      }
    } catch {
      setError("Failed to save entry");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this entry?")) return;
    try {
      await fetch(`/api/founder-workspace?id=${id}`, { method: "DELETE" });
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch {
      setError("Failed to delete");
    }
  };

  const handleEdit = (entry: FounderEntry) => {
    setEditingEntry(entry);
    setShowForm(false);
  };

  const typeLabel = (type: string) => types.find(t => t.value === type)?.label;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">{heading}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        {!showForm && !editingEntry && (
          <Button size="sm" className="h-8 bg-orange-500 hover:bg-orange-600 text-white shrink-0" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />Add
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-500 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
          <button className="ml-auto underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {showForm && !editingEntry && (
        <FounderWorkspaceEntryForm
          types={types}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
          titlePlaceholder={titlePlaceholder}
          contentPlaceholder={contentPlaceholder}
          extraFields={extraFields}
        />
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin" />Loading…
        </div>
      ) : entries.length === 0 && !showForm ? (
        <button onClick={() => setShowForm(true)}
          className="w-full py-8 rounded-2xl border border-dashed border-border text-sm text-muted-foreground hover:text-orange-500 hover:border-orange-500/40 hover:bg-orange-500/5 transition-all flex flex-col items-center gap-2">
          <Plus className="w-5 h-5" />
          <span>Add your first entry</span>
        </button>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => (
            editingEntry?.id === entry.id ? (
              <FounderWorkspaceEntryForm
                key={entry.id}
                types={types}
                onSave={handleSave}
                onCancel={() => setEditingEntry(null)}
                initial={entry}
                titlePlaceholder={titlePlaceholder}
                contentPlaceholder={contentPlaceholder}
                extraFields={extraFields}
              />
            ) : (
              <FounderWorkspaceEntryCard
                key={entry.id}
                entry={entry}
                onDelete={handleDelete}
                onEdit={handleEdit}
                typeLabel={typeLabel(entry.type)}
                renderMeta={renderMeta}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOUNDER OS — 7 ADMIN TAB COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function ResearchTab() {
  return (
    <div className="max-w-2xl space-y-8">
      <FounderWorkspaceSection
        category="research"
        types={[
          { value: "insight", label: "Market Insight" },
          { value: "competitor", label: "Competitor" },
          { value: "icp", label: "ICP Note" },
          { value: "trend", label: "Trend" },
        ]}
        heading="Market Research"
        description="Insights, competitor notes, ICP observations, and trends you want to remember."
        titlePlaceholder="e.g. TikTok nurse niche — high demand, low supply of PDF planners"
        contentPlaceholder="Detailed notes, source, context…"
        extraFields={(type, meta, setMeta) => (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Source / URL (optional)</label>
            <Input
              value={typeof meta.source === "string" ? meta.source : ""}
              onChange={e => setMeta({ ...meta, source: e.target.value })}
              placeholder="https://…"
              className="h-8 text-xs"
            />
          </div>
        )}
        renderMeta={meta => meta?.source ? (
          <a href={String(meta.source)} target="_blank" rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-orange-500 hover:underline truncate max-w-full">
            {String(meta.source)}
          </a>
        ) : null}
      />
    </div>
  );
}

function MarketingPsychologyTab() {
  return (
    <div className="max-w-2xl space-y-8">
      <FounderWorkspaceSection
        category="marketing-psychology"
        types={[
          { value: "trigger", label: "Trigger" },
          { value: "principle", label: "Principle" },
          { value: "behavior", label: "Buyer Behavior" },
          { value: "framework", label: "Framework" },
        ]}
        heading="Marketing Psychology"
        description="Psychological triggers, buyer behaviors, and conversion principles that inform your strategy."
        titlePlaceholder="e.g. Loss aversion — fear of losing beats desire to gain"
        contentPlaceholder="How this applies to your product or audience…"
        extraFields={(_type, meta, setMeta) => (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Real-world example (optional)</label>
            <Input
              value={typeof meta.example === "string" ? meta.example : ""}
              onChange={e => setMeta({ ...meta, example: e.target.value })}
              placeholder="e.g. 'Only 3 left' on the product page increased conversions"
              className="h-8 text-xs"
            />
          </div>
        )}
        renderMeta={meta => meta?.example ? (
          <p className="mt-1 text-[11px] text-muted-foreground italic">Example: {String(meta.example)}</p>
        ) : null}
      />
    </div>
  );
}

function CopywritingTab() {
  return (
    <div className="max-w-2xl space-y-8">
      <FounderWorkspaceSection
        category="copywriting"
        types={[
          { value: "headline", label: "Headline" },
          { value: "formula", label: "Formula" },
          { value: "power-word", label: "Power Words" },
          { value: "template", label: "Template" },
          { value: "framework", label: "Framework" },
        ]}
        heading="Copywriting Bank"
        description="Headline formulas, frameworks, power words, and reusable copy templates."
        titlePlaceholder="e.g. PAS — Problem / Agitate / Solve"
        contentPlaceholder="The formula, template, or word list with notes on when to use it…"
      />
    </div>
  );
}

function ContentIdeasTab() {
  return (
    <div className="max-w-2xl space-y-8">
      <FounderWorkspaceSection
        category="content-ideas"
        types={[
          { value: "hook", label: "Hook" },
          { value: "angle", label: "Angle" },
          { value: "script", label: "Script" },
          { value: "viral-format", label: "Viral Format" },
          { value: "series", label: "Series Idea" },
        ]}
        heading="Content Ideas"
        description="Hooks, angles, scripts, viral formats, and series concepts to batch-create."
        titlePlaceholder="e.g. 'The reason your meal prep fails has nothing to do with motivation'"
        contentPlaceholder="Full idea, script outline, or angle description…"
        extraFields={(_type, meta, setMeta) => (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Platform (optional)</label>
            <Input
              value={typeof meta.platform === "string" ? meta.platform : ""}
              onChange={e => setMeta({ ...meta, platform: e.target.value })}
              placeholder="e.g. TikTok, Instagram, Pinterest"
              className="h-8 text-xs"
            />
          </div>
        )}
        renderMeta={meta => meta?.platform ? (
          <span className="mt-1 inline-block px-2 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground font-medium">
            {String(meta.platform)}
          </span>
        ) : null}
      />
    </div>
  );
}

function AnalyticsTab() {
  return (
    <div className="max-w-2xl space-y-8">
      <FounderWorkspaceSection
        category="analytics"
        types={[
          { value: "win", label: "Win" },
          { value: "miss", label: "Miss" },
          { value: "insight", label: "Insight" },
          { value: "ab-result", label: "A/B Result" },
        ]}
        heading="Analytics & Learnings"
        description="What's working, what's not, key metrics, and A/B test results."
        titlePlaceholder="e.g. TikTok hook style A doubled watch time vs. style B"
        contentPlaceholder="What happened, what you measured, what you'll do differently…"
        extraFields={(_type, meta, setMeta) => (
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Metric (optional)</label>
              <Input
                value={typeof meta.metric === "string" ? meta.metric : ""}
                onChange={e => setMeta({ ...meta, metric: e.target.value })}
                placeholder="e.g. CTR, Revenue, Views"
                className="h-8 text-xs"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Value (optional)</label>
              <Input
                value={typeof meta.value === "string" ? meta.value : ""}
                onChange={e => setMeta({ ...meta, value: e.target.value })}
                placeholder="e.g. 4.2%, £340, 18k"
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}
        renderMeta={meta => (meta?.metric || meta?.value) ? (
          <div className="mt-1 flex gap-2 flex-wrap">
            {meta.metric ? <span className="text-[11px] text-muted-foreground">{String(meta.metric)}</span> : null}
            {meta.value ? <span className="text-[11px] font-semibold text-foreground">{String(meta.value)}</span> : null}
          </div>
        ) : null}
      />
    </div>
  );
}

const DISTRIBUTION_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  testing: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  paused: "bg-gray-500/10 text-muted-foreground border-border",
};

function DistributionTab() {
  return (
    <div className="max-w-2xl space-y-8">
      <FounderWorkspaceSection
        category="distribution"
        types={[
          { value: "channel", label: "Channel" },
          { value: "partnership", label: "Partnership" },
          { value: "traffic-source", label: "Traffic Source" },
          { value: "strategy", label: "Strategy" },
        ]}
        heading="Distribution"
        description="Channels, partnerships, traffic sources, and distribution strategies."
        titlePlaceholder="e.g. TikTok → link in bio → Gumroad funnel"
        contentPlaceholder="How this distribution channel works, what content drives it, results so far…"
        extraFields={(_type, meta, setMeta) => (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Status</label>
            <div className="flex gap-1.5">
              {(["active", "testing", "paused"] as const).map(s => (
                <button key={s} onClick={() => setMeta({ ...meta, status: s })}
                  className={cn("px-2.5 py-1 rounded-full text-xs font-medium border capitalize transition-all",
                    meta.status === s ? DISTRIBUTION_STATUS_COLORS[s] : "border-border text-muted-foreground hover:border-orange-400")}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        renderMeta={meta => meta?.status ? (
          <span className={cn("mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize",
            DISTRIBUTION_STATUS_COLORS[String(meta.status)] ?? "bg-muted text-muted-foreground border-border")}>
            {String(meta.status)}
          </span>
        ) : null}
      />
    </div>
  );
}

const EXPERIMENT_STATUS_COLORS: Record<string, string> = {
  running: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  complete: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  failed: "bg-red-500/10 text-red-500 border-red-500/20",
};

function ExperimentsTab() {
  return (
    <div className="max-w-2xl space-y-8">
      <FounderWorkspaceSection
        category="experiments"
        types={[{ value: "experiment", label: "Experiment" }]}
        heading="Experiments"
        description="Hypotheses, tests, and results. Treat the business like a lab."
        titlePlaceholder="Hypothesis: e.g. Adding a freebie to the bio link will lift product page visits"
        contentPlaceholder="What you're testing, how you're measuring it, what you learned…"
        extraFields={(_type, meta, setMeta) => (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <div className="flex gap-1.5">
                {(["running", "complete", "failed"] as const).map(s => (
                  <button key={s} onClick={() => setMeta({ ...meta, status: s })}
                    className={cn("px-2.5 py-1 rounded-full text-xs font-medium border capitalize transition-all",
                      meta.status === s ? EXPERIMENT_STATUS_COLORS[s] : "border-border text-muted-foreground hover:border-orange-400")}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Result (fill in when complete)</label>
              <Input
                value={typeof meta.result === "string" ? meta.result : ""}
                onChange={e => setMeta({ ...meta, result: e.target.value })}
                placeholder="e.g. CTR went from 1.2% to 3.8% — confirmed, rolling out"
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}
        renderMeta={meta => (
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            {meta?.status ? (
              <span className={cn("inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize",
                EXPERIMENT_STATUS_COLORS[String(meta.status)] ?? "bg-muted text-muted-foreground border-border")}>
                {String(meta.status)}
              </span>
            ) : null}
            {meta?.result ? (
              <span className="text-[11px] text-muted-foreground italic">{String(meta.result)}</span>
            ) : null}
          </div>
        )}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function WorkspacePage() {
  const isAdmin = useWorkspaceAdmin();
  const [tab, setTab] = useState<WorkspaceTab>("todos");

  const tabDesc: Record<WorkspaceTab, string> = {
    todos:                "Stay on top of your daily content tasks",
    notes:                "Capture ideas, scripts, and notes",
    calendar:             "Plan and schedule your content drops",
    goals:                "Track revenue, growth, and product targets",
    "research":           "Market insights, competitor notes, and ICP observations",
    "marketing-psychology": "Psychological triggers and buyer behavior principles",
    "copywriting":        "Headline formulas, frameworks, and reusable copy templates",
    "content-ideas":      "Hooks, angles, scripts, and viral content formats",
    "analytics":          "What's working, what's not, and key metric learnings",
    "distribution":       "Channels, partnerships, and traffic source strategies",
    "experiments":        "Hypotheses, active tests, and documented results",
  };

  return (
    <div className="p-6 max-w-none">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          {isAdmin ? "Founder OS" : "Workspace"}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{tabDesc[tab]}</p>
      </div>

      {/* Tab nav */}
      <div className="border-b border-border mb-6 overflow-x-auto">
        <div className="flex gap-1">
          {/* Standard tabs */}
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap -mb-px",
                tab === t.id ? "border-orange-500 text-orange-500" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border")}>
              {t.icon}{t.label}
            </button>
          ))}

          {/* Admin-only divider + tabs */}
          {isAdmin && (
            <>
              <div className="w-px bg-border mx-2 self-stretch my-1.5" />
              {ADMIN_TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={cn("flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap -mb-px",
                    tab === t.id ? "border-orange-500 text-orange-500" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border")}>
                  {t.icon}{t.label}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Standard tab content */}
      {tab === "todos"    && <TodoTab />}
      {tab === "notes"    && <NotesTab />}
      {tab === "calendar" && <CalendarTab />}
      {tab === "goals"    && <GoalsTab />}

      {/* Admin-only tab content */}
      {isAdmin && tab === "research"              && <ResearchTab />}
      {isAdmin && tab === "marketing-psychology"  && <MarketingPsychologyTab />}
      {isAdmin && tab === "copywriting"           && <CopywritingTab />}
      {isAdmin && tab === "content-ideas"         && <ContentIdeasTab />}
      {isAdmin && tab === "analytics"             && <AnalyticsTab />}
      {isAdmin && tab === "distribution"          && <DistributionTab />}
      {isAdmin && tab === "experiments"           && <ExperimentsTab />}
    </div>
  );
}
