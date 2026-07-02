"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus, Check, GripVertical, X, ChevronDown, Bookmark, BookmarkCheck,
  Calendar, Tag, StickyNote, Target, ListTodo, ChevronLeft, ChevronRight,
  Trash2, Pencil, CheckCircle2, Search, AlertCircle, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkspaceTab = "todos" | "notes" | "calendar" | "goals";
type Priority = "high" | "medium" | "low";
type TodoFilter = "all" | "active" | "completed";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  priority: Priority;
  category?: string;
  dueDate?: string;
  createdAt: number;
}
interface SavedTask { id: string; text: string; priority: Priority; category?: string; }
interface Note { id: string; title: string; body: string; updatedAt: number; }
interface CalEvent { id: string; title: string; date: string; type: "post" | "launch" | "task" | "other"; platform?: string; }
interface Goal { id: string; label: string; target: number; current: number; unit: string; deadline?: string; color: string; }

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY: Record<Priority, { label: string; color: string; dot: string }> = {
  high:   { label: "High",   color: "text-red-500",    dot: "bg-red-500" },
  medium: { label: "Medium", color: "text-yellow-500", dot: "bg-yellow-500" },
  low:    { label: "Low",    color: "text-green-500",  dot: "bg-green-500" },
};
const CATEGORIES = [
  { id: "content",  name: "Content",  color: "bg-purple-500/20 text-purple-400", dot: "bg-purple-500" },
  { id: "admin",    name: "Admin",    color: "bg-blue-500/20 text-blue-400",     dot: "bg-blue-500" },
  { id: "growth",   name: "Growth",   color: "bg-green-500/20 text-green-400",   dot: "bg-green-500" },
  { id: "personal", name: "Personal", color: "bg-orange-500/20 text-orange-400", dot: "bg-orange-500" },
];
const CAL_TYPES = [
  { id: "post",   label: "Post",   color: "bg-purple-500" },
  { id: "launch", label: "Launch", color: "bg-orange-500" },
  { id: "task",   label: "Task",   color: "bg-blue-500" },
  { id: "other",  label: "Other",  color: "bg-gray-500" },
];
const DEFAULT_GOALS: Goal[] = [
  { id: "revenue", label: "Monthly Revenue", target: 1000, current: 0, unit: "£", color: "bg-orange-500", deadline: "" },
  { id: "creators", label: "Creators Onboarded", target: 10, current: 0, unit: "", color: "bg-purple-500", deadline: "" },
  { id: "products", label: "Products Listed", target: 25, current: 0, unit: "", color: "bg-blue-500", deadline: "" },
];
const STARTER_TASKS: { text: string; priority: Priority; category: string }[] = [
  { text: "Record and post one short-form video today", priority: "high", category: "content" },
  { text: "Reply to comments on last 3 posts", priority: "medium", category: "growth" },
  { text: "Set up your first digital product", priority: "high", category: "admin" },
  { text: "Share your store link on social media", priority: "medium", category: "growth" },
  { text: "Write your welcome email sequence", priority: "medium", category: "content" },
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
  const today = new Date(new Date().toDateString()).getTime();
  const t = new Date(d).getTime();
  return Math.round((t - today) / 86400000);
}
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// ─── Tab nav ──────────────────────────────────────────────────────────────────

const TABS: { id: WorkspaceTab; label: string; icon: React.ReactNode }[] = [
  { id: "todos",    label: "To-Do List",       icon: <ListTodo className="w-4 h-4" /> },
  { id: "notes",    label: "Notes",            icon: <StickyNote className="w-4 h-4" /> },
  { id: "calendar", label: "Content Calendar", icon: <Calendar className="w-4 h-4" /> },
  { id: "goals",    label: "Goals",            icon: <Target className="w-4 h-4" /> },
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
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">{activeCount} task{activeCount !== 1 ? "s" : ""} remaining</p>
        {overdueCount > 0 && (
          <span className="flex items-center gap-1 text-xs font-medium text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
            <AlertCircle className="w-3 h-3" />{overdueCount} overdue
          </span>
        )}
      </div>

      {todos.length > 0 && (
        <div className="mb-5">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>{completedCount} of {todos.length} done</span><span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Input */}
      <div className="mb-5 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addTodo()} placeholder="Add a task…" className="flex-1 pr-10" />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/50 font-mono pointer-events-none">⏎</span>
          </div>
          <Button onClick={() => addTodo()} size="icon"><Plus className="w-4 h-4" /></Button>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* Priority */}
          <div className="relative" ref={priorityRef}>
            <button onClick={() => setPriorityOpen(v => !v)} className="flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-input bg-background text-xs hover:bg-accent transition-colors">
              <span className={cn("w-2 h-2 rounded-full", PRIORITY[priority].dot)} />
              <span className={PRIORITY[priority].color}>{PRIORITY[priority].label}</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
            {priorityOpen && (
              <div className="absolute top-full mt-1 left-0 z-20 bg-popover border border-border rounded-md shadow-md min-w-[110px] py-1">
                {(["high","medium","low"] as Priority[]).map(p => (
                  <button key={p} onClick={() => { setPriority(p); setPriorityOpen(false); }} className={cn("flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent", priority === p && "font-medium")}>
                    <span className={cn("w-2 h-2 rounded-full", PRIORITY[p].dot)} /><span className={PRIORITY[p].color}>{PRIORITY[p].label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Due date */}
          <div className="relative" ref={dateRef}>
            <button onClick={() => setDateOpen(v => !v)} className={cn("flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs transition-colors", dueDate ? "border-primary/60 bg-primary/10 text-primary" : "border-input bg-background hover:bg-accent text-muted-foreground")}>
              <Calendar className="w-3 h-3" />{dueDate ? fmtDate(dueDate) : "Schedule"}
              {dueDate && <span onClick={e => { e.stopPropagation(); setDueDate(""); }} className="ml-0.5 hover:text-destructive"><X className="w-3 h-3" /></span>}
            </button>
            {dateOpen && (
              <div className="absolute top-full mt-1 left-0 z-20 bg-popover border border-border rounded-md shadow-md w-48 py-1">
                {[{ label: "Today", value: new Date().toISOString().slice(0,10) }, { label: "Tomorrow", value: new Date(Date.now()+86400000).toISOString().slice(0,10) }].map(opt => (
                  <button key={opt.label} onClick={() => { setDueDate(opt.value); setDateOpen(false); }} className={cn("flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent", dueDate === opt.value && "font-medium text-primary")}>
                    <Calendar className="w-3 h-3 text-muted-foreground" />{opt.label}
                  </button>
                ))}
                <div className="border-t border-border mt-1 pt-1 px-3 pb-1.5">
                  <p className="text-[10px] text-muted-foreground mb-1">Custom date</p>
                  <input type="date" value={dueDate} onChange={e => { setDueDate(e.target.value); setDateOpen(false); }} className="w-full h-7 px-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
              </div>
            )}
          </div>
          {/* Category */}
          <div className="relative" ref={categoryRef}>
            <button onClick={() => setCategoryOpen(v => !v)} className="flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-input bg-background text-xs hover:bg-accent transition-colors">
              <Tag className="w-3 h-3 text-muted-foreground" />
              <span className={category ? getCat(category)?.color.split(" ")[1] : "text-muted-foreground"}>{category ? getCat(category)?.name : "Category"}</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
            {categoryOpen && (
              <div className="absolute top-full mt-1 left-0 z-20 bg-popover border border-border rounded-md shadow-md min-w-[120px] py-1">
                <button onClick={() => { setCategory(""); setCategoryOpen(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent text-muted-foreground">None</button>
                {CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => { setCategory(cat.id); setCategoryOpen(false); }} className={cn("flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent", category === cat.id && "font-medium")}>
                    <span className={cn("w-2 h-2 rounded-full", cat.dot)} />{cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Saved */}
          <div className="relative ml-auto" ref={savedRef}>
            <button onClick={() => setSavedOpen(v => !v)} className={cn("flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs transition-colors", savedOpen ? "border-primary bg-primary/10 text-primary" : "border-input bg-background hover:bg-accent text-muted-foreground")}>
              <Bookmark className="w-3 h-3" />Saved{saved.length > 0 && <span className="ml-0.5 bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px]">{saved.length}</span>}
            </button>
            {savedOpen && (
              <div className="absolute top-full mt-1 right-0 z-20 bg-popover border border-border rounded-md shadow-md w-64 py-1">
                <p className="px-3 pt-1.5 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Saved Tasks</p>
                {saved.length === 0 ? <p className="px-3 py-2 text-xs text-muted-foreground">Bookmark a task to save it for quick re-use.</p> :
                  saved.map(st => { const cat = getCat(st.category); return (
                    <button key={st.id} onClick={() => { addTodo({ text: st.text, priority: st.priority, category: st.category }); setSavedOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-accent text-left">
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

      {/* Filters */}
      <div className="mb-4 space-y-2">
        <div className="flex gap-1">
          {(["all","active","completed"] as TodoFilter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={cn("px-3 py-1 rounded-md text-sm capitalize transition-colors", filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>{f}</button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setCatFilter("")} className={cn("px-2.5 py-0.5 rounded-full text-xs border transition-colors", !catFilter ? "border-primary text-primary" : "border-border text-muted-foreground hover:border-foreground")}>All</button>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setCatFilter(catFilter === cat.id ? "" : cat.id)} className={cn("flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs border transition-colors", catFilter === cat.id ? cn("border-transparent", cat.color) : "border-border text-muted-foreground hover:border-foreground")}>
              <span className={cn("w-1.5 h-1.5 rounded-full", cat.dot)} />{cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && todos.length === 0 && (
          <div className="py-8">
            <div className="text-center mb-5">
              <p className="text-sm font-medium text-foreground mb-1">Nothing here yet</p>
              <p className="text-xs text-muted-foreground">Add a task above, or pick one to get started:</p>
            </div>
            <div className="space-y-2">
              {STARTER_TASKS.map((t, i) => {
                const cat = getCat(t.category);
                return (
                  <button key={i} onClick={() => { setTodos(prev => [{ id: uid(), text: t.text, completed: false, priority: t.priority, category: t.category, createdAt: Date.now() }, ...prev]); }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-border hover:border-orange-500/40 hover:bg-orange-500/5 transition-all text-left group">
                    <Zap className="w-4 h-4 text-orange-500 shrink-0" />
                    <span className="flex-1 text-sm text-foreground">{t.text}</span>
                    {cat && <span className={cn("text-xs px-2 py-0.5 rounded-full shrink-0", cat.color)}>{cat.name}</span>}
                    <span className={cn("text-xs shrink-0", PRIORITY[t.priority].color)}>{PRIORITY[t.priority].label}</span>
                    <Plus className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {filtered.length === 0 && todos.length > 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {filter === "completed" ? "No completed tasks yet." : filter === "active" ? "All done! Nothing left." : "No tasks match this filter."}
          </div>
        )}
        {filtered.map(todo => {
          const cat = getCat(todo.category);
          const overdue = isOverdue(todo.dueDate) && !todo.completed;
          const isCompleting = completingIds.has(todo.id);
          const isSaved = saved.some(s => s.text === todo.text);
          return (
            <div key={todo.id} draggable onDragStart={() => setDragId(todo.id)} onDragOver={e => { e.preventDefault(); setDragOverId(todo.id); }} onDrop={() => handleDrop(todo.id)} onDragEnd={() => { setDragId(null); setDragOverId(null); }}
              className={cn("group flex items-center gap-3 p-3 rounded-lg border bg-card transition-all",
                dragOverId === todo.id && dragId !== todo.id ? "border-primary bg-accent" : "border-border",
                dragId === todo.id && "opacity-40", todo.completed && "opacity-60",
                overdue && "border-red-500/40 bg-red-500/5")}>
              <GripVertical className="w-4 h-4 text-muted-foreground/40 cursor-grab shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <button onClick={() => toggle(todo.id)} className={cn("shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200",
                todo.completed ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 hover:border-primary", isCompleting && "scale-125")}>
                {todo.completed && <Check className="w-3 h-3" strokeWidth={3} />}
              </button>
              <div className="flex-1 min-w-0">
                <span className={cn("text-sm", todo.completed && "line-through text-muted-foreground")}>{todo.text}</span>
                {(todo.dueDate || cat) && (
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {todo.dueDate && <span className={cn("text-xs flex items-center gap-0.5", overdue ? "text-red-400" : "text-muted-foreground")}>{overdue && "⚠ "}{fmtDate(todo.dueDate)}</span>}
                    {cat && <span className={cn("text-xs px-1.5 py-0.5 rounded-full", cat.color)}>{cat.name}</span>}
                  </div>
                )}
              </div>
              <span className={cn("text-xs shrink-0 flex items-center gap-1", PRIORITY[todo.priority].color)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", PRIORITY[todo.priority].dot)} />{PRIORITY[todo.priority].label}
              </span>
              <button onClick={() => toggleSaved(todo)} className={cn("shrink-0 transition-all", isSaved ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground")}>
                {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              </button>
              <button onClick={() => remove(todo.id)} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
            </div>
          );
        })}
      </div>
      {completedCount > 0 && (
        <div className="mt-4 flex justify-end">
          <button onClick={() => setTodos(prev => prev.filter(t => !t.completed))} className="text-xs text-muted-foreground hover:text-destructive transition-colors">Clear {completedCount} completed</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTES TAB
// ═══════════════════════════════════════════════════════════════════════════════

function NotesTab() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => { try { const n = localStorage.getItem("cf_notes"); if (n) { const parsed = JSON.parse(n); setNotes(parsed); if (parsed.length > 0) setActiveId(parsed[0].id); } } catch {} }, []);
  useEffect(() => { try { localStorage.setItem("cf_notes", JSON.stringify(notes)); } catch {} }, [notes]);

  const createNote = () => {
    const title = newTitle.trim() || "Untitled note";
    const note: Note = { id: uid(), title, body: "", updatedAt: Date.now() };
    setNotes(prev => [note, ...prev]);
    setActiveId(note.id);
    setNewTitle("");
  };
  const updateNote = (id: string, patch: Partial<Note>) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n));
  };
  const deleteNote = (id: string) => {
    setNotes(prev => { const next = prev.filter(n => n.id !== id); setActiveId(next[0]?.id ?? null); return next; });
  };

  const active = notes.find(n => n.id === activeId);
  const wordCount = active?.body.trim() ? active.body.trim().split(/\s+/).length : 0;
  const charCount = active?.body.length ?? 0;

  const filteredNotes = search.trim()
    ? notes.filter(n => n.title.toLowerCase().includes(search.toLowerCase()) || n.body.toLowerCase().includes(search.toLowerCase()))
    : notes;

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[400px]">
      {/* Sidebar */}
      <div className="w-56 shrink-0 flex flex-col gap-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes…" className="w-full h-8 pl-7 pr-3 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        {/* New note */}
        <div className="flex gap-2">
          <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && createNote()} placeholder="New note title…" className="flex-1 h-8 text-sm" />
          <Button size="icon" className="h-8 w-8 shrink-0" onClick={createNote}><Plus className="w-4 h-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {filteredNotes.length === 0 && (
            <p className="text-xs text-muted-foreground px-1 pt-2">
              {search ? "No notes match your search." : "No notes yet. Create one above."}
            </p>
          )}
          {filteredNotes.map(note => (
            <button key={note.id} onClick={() => setActiveId(note.id)} className={cn("w-full text-left px-3 py-2 rounded-lg border transition-colors group relative", activeId === note.id ? "bg-primary/10 border-primary/40 text-primary" : "bg-card border-border hover:bg-accent text-foreground")}>
              <p className="text-sm font-medium truncate pr-5">{note.title || "Untitled"}</p>
              {note.body && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{note.body.slice(0, 60)}</p>}
              <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(note.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
              <button onClick={e => { e.stopPropagation(); deleteNote(note.id); }} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Select or create a note</div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <input value={active.title} onChange={e => updateNote(active.id, { title: e.target.value })} className="flex-1 text-xl font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground" placeholder="Note title" />
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">{wordCount}w · {charCount}c</span>
                <span className="text-xs text-muted-foreground">Auto-saved</span>
              </div>
            </div>
            <textarea value={active.body} onChange={e => updateNote(active.id, { body: e.target.value })}
              className="flex-1 resize-none bg-card border border-border rounded-lg p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring leading-relaxed"
              placeholder="Start writing…" />
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTENT CALENDAR TAB
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

  // Build calendar grid (Mon-start)
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7; // Mon=0
  const days: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const eventsOn = (d: Date) => events.filter(e => e.date === fmt(d));
  const isToday = (d: Date) => fmt(d) === fmt(today);

  const addEvent = () => {
    if (!selectedDate || !newTitle.trim()) return;
    setEvents(prev => [...prev, { id: uid(), title: newTitle.trim(), date: selectedDate, type: newType, platform: newPlatform.trim() || undefined }]);
    setNewTitle(""); setNewPlatform(""); setAdding(false);
  };
  const removeEvent = (id: string) => setEvents(prev => prev.filter(e => e.id !== id));
  const typeColor = (t: string) => CAL_TYPES.find(c => c.id === t)?.color ?? "bg-gray-500";
  const typeTextColor = (t: string) => {
    const map: Record<string, string> = { post: "text-purple-400", launch: "text-orange-400", task: "text-blue-400", other: "text-gray-400" };
    return map[t] ?? "text-gray-400";
  };

  const selectedEvents = selectedDate ? events.filter(e => e.date === selectedDate) : [];

  // Upcoming events (next 14 days from today, sorted by date)
  const todayStr = fmt(today);
  const in14 = new Date(today); in14.setDate(in14.getDate() + 14);
  const upcomingEvents = events
    .filter(e => e.date >= todayStr && e.date <= fmt(in14))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  return (
    <div className="flex gap-6 flex-wrap lg:flex-nowrap">
      {/* Calendar grid */}
      <div className="flex-1 min-w-0">
        {/* Nav */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-accent transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <h3 className="font-semibold text-sm">{MONTHS[month]} {year}</h3>
          <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-accent transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map(d => <div key={d} className="text-[10px] text-center text-muted-foreground font-medium py-1">{d}</div>)}
        </div>
        {/* Cells */}
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
          {days.map((d, i) => {
            if (!d) return <div key={`pad-${i}`} className="bg-muted/30 h-20 p-1" />;
            const dayEvents = eventsOn(d);
            const dateStr = fmt(d);
            const isSelected = selectedDate === dateStr;
            return (
              <div key={dateStr} onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={cn("bg-card h-20 p-1 cursor-pointer hover:bg-accent transition-colors overflow-hidden", isSelected && "bg-primary/10 ring-1 ring-inset ring-primary/40")}>
                <p className={cn("text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full shrink-0", isToday(d) ? "bg-primary text-primary-foreground" : "text-foreground")}>{d.getDate()}</p>
                <div className="mt-0.5 space-y-0.5">
                  {dayEvents.slice(0, 2).map(ev => (
                    <p key={ev.id} className={cn("text-[9px] leading-tight truncate px-0.5 rounded font-medium", typeTextColor(ev.type))} title={ev.title}>
                      {ev.title}
                    </p>
                  ))}
                  {dayEvents.length > 2 && <p className="text-[9px] text-muted-foreground pl-0.5">+{dayEvents.length - 2}</p>}
                </div>
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex gap-3 mt-3 flex-wrap">
          {CAL_TYPES.map(t => (
            <span key={t.id} className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className={cn("w-2 h-2 rounded-full", t.color)} />{t.label}
            </span>
          ))}
        </div>
      </div>

      {/* Side panel */}
      <div className="w-64 shrink-0">
        {selectedDate ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm">{new Date(selectedDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</h4>
              <button onClick={() => setSelectedDate(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            {selectedEvents.length === 0 && !adding && <p className="text-xs text-muted-foreground mb-3">Nothing planned.</p>}
            <div className="space-y-2 mb-3">
              {selectedEvents.map(ev => (
                <div key={ev.id} className="flex items-start gap-2 p-2 rounded-lg border border-border bg-card group">
                  <span className={cn("w-2 h-2 rounded-full mt-1 shrink-0", typeColor(ev.type))} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ev.title}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{ev.type}{ev.platform ? ` · ${ev.platform}` : ""}</p>
                  </div>
                  <button onClick={() => removeEvent(ev.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
            {adding ? (
              <div className="space-y-2 p-3 rounded-lg border border-border bg-card">
                <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && addEvent()} placeholder="Title…" className="h-8 text-sm" autoFocus />
                <div className="flex gap-1 flex-wrap">
                  {CAL_TYPES.map(t => (
                    <button key={t.id} onClick={() => setNewType(t.id as CalEvent["type"])} className={cn("px-2 py-0.5 rounded-full text-xs border transition-colors", newType === t.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-foreground")}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <Input value={newPlatform} onChange={e => setNewPlatform(e.target.value)} placeholder="Platform (optional)" className="h-8 text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-8" onClick={addEvent}>Add</Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setAdding(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                <Plus className="w-3.5 h-3.5" />Add entry
              </button>
            )}
          </div>
        ) : (
          <div>
            <h4 className="font-semibold text-sm mb-3 text-foreground">Coming up</h4>
            {upcomingEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-28 text-center text-muted-foreground text-sm">
                <Calendar className="w-7 h-7 mb-2 opacity-30" />
                <p className="text-xs">Click a day to add entries</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map(ev => {
                  const d = new Date(ev.date + "T00:00:00");
                  const isEv = ev.date === todayStr;
                  const isTmrw = ev.date === new Date(Date.now()+86400000).toISOString().slice(0,10);
                  const label = isEv ? "Today" : isTmrw ? "Tomorrow" : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
                  return (
                    <div key={ev.id} onClick={() => setSelectedDate(ev.date)} className="flex items-start gap-2 p-2 rounded-lg border border-border bg-card cursor-pointer hover:bg-accent transition-colors group">
                      <span className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", typeColor(ev.type))} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{ev.title}</p>
                        <p className="text-[10px] text-muted-foreground">{label}{ev.platform ? ` · ${ev.platform}` : ""}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {upcomingEvents.length > 0 && (
              <p className="text-[10px] text-muted-foreground mt-3">Next 14 days · Click to edit</p>
            )}
          </div>
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
  const COLORS = ["bg-orange-500", "bg-purple-500", "bg-blue-500", "bg-green-500", "bg-red-500", "bg-pink-500"];
  const [newColor, setNewColor] = useState(COLORS[0]);

  useEffect(() => { try { const g = localStorage.getItem("cf_goals"); if (g) setGoals(JSON.parse(g)); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem("cf_goals", JSON.stringify(goals)); } catch {} }, [goals]);

  const updateGoal = (id: string, patch: Partial<Goal>) => setGoals(prev => prev.map(g => g.id === id ? { ...g, ...patch } : g));
  const deleteGoal = (id: string) => setGoals(prev => prev.filter(g => g.id !== id));
  const addGoal = () => {
    if (!newLabel.trim() || !newTarget) return;
    setGoals(prev => [...prev, { id: uid(), label: newLabel.trim(), target: Number(newTarget), current: 0, unit: newUnit.trim(), color: newColor, deadline: newDeadline || "" }]);
    setNewLabel(""); setNewTarget(""); setNewUnit(""); setNewDeadline(""); setAdding(false);
  };

  return (
    <div className="max-w-2xl space-y-4">
      {goals.map(goal => {
        const pct = Math.min(100, goal.target > 0 ? Math.round((goal.current / goal.target) * 100) : 0);
        const isEditing = editId === goal.id;
        const done = pct >= 100;
        const daysLeft = daysUntil(goal.deadline);
        const deadlineUrgent = daysLeft !== null && daysLeft <= 7 && !done;
        const deadlineOverdue = daysLeft !== null && daysLeft < 0 && !done;
        return (
          <div key={goal.id} className={cn("p-4 rounded-xl border bg-card transition-all", done ? "border-green-500/40 bg-green-500/5" : "border-border")}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("w-3 h-3 rounded-full shrink-0", goal.color)} />
                {isEditing ? (
                  <input value={goal.label} onChange={e => updateGoal(goal.id, { label: e.target.value })} className="font-semibold text-sm bg-transparent border-b border-border outline-none" />
                ) : (
                  <span className="font-semibold text-sm">{goal.label}</span>
                )}
                {done && <span className="text-xs font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">Done 🎉</span>}
                {!done && daysLeft !== null && (
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", deadlineOverdue ? "bg-red-500/10 text-red-400" : deadlineUrgent ? "bg-yellow-500/10 text-yellow-500" : "bg-muted text-muted-foreground")}>
                    {deadlineOverdue ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? "Due today" : `${daysLeft}d left`}
                  </span>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => setEditId(isEditing ? null : goal.id)} className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => deleteGoal(goal.id)} className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{goal.unit}{goal.current.toLocaleString()} of {goal.unit}{goal.target.toLocaleString()}</span>
                <span className={done ? "text-green-500 font-bold" : ""}>{pct}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-500", done ? "bg-green-500" : goal.color)} style={{ width: `${pct}%` }} />
              </div>
            </div>

            {/* Current value input */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-xs text-muted-foreground shrink-0">Current:</span>
              <div className="flex items-center gap-1">
                <button onClick={() => updateGoal(goal.id, { current: Math.max(0, goal.current - 1) })} className="w-6 h-6 rounded border border-border flex items-center justify-center text-sm hover:bg-accent transition-colors">−</button>
                <input type="number" value={goal.current} onChange={e => updateGoal(goal.id, { current: Math.max(0, Number(e.target.value)) })} className="w-20 h-6 text-center text-sm border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                <button onClick={() => updateGoal(goal.id, { current: goal.current + 1 })} className="w-6 h-6 rounded border border-border flex items-center justify-center text-sm hover:bg-accent transition-colors">+</button>
              </div>
              {isEditing && (
                <>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">Target:</span>
                  <input type="number" value={goal.target} onChange={e => updateGoal(goal.id, { target: Math.max(1, Number(e.target.value)) })} className="w-20 h-6 text-center text-sm border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                  <span className="text-xs text-muted-foreground">Unit:</span>
                  <input value={goal.unit} onChange={e => updateGoal(goal.id, { unit: e.target.value })} className="w-12 h-6 px-1 text-sm border border-border rounded bg-background focus:outline-none" placeholder="£" />
                  <span className="text-xs text-muted-foreground">Deadline:</span>
                  <input type="date" value={goal.deadline ?? ""} onChange={e => updateGoal(goal.id, { deadline: e.target.value })} className="h-6 px-1 text-xs border border-border rounded bg-background focus:outline-none" />
                </>
              )}
              {done && <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />}
            </div>

            {isEditing && (
              <div className="flex gap-1 mt-3">
                {COLORS.map(c => (
                  <button key={c} onClick={() => updateGoal(goal.id, { color: c })} className={cn("w-5 h-5 rounded-full transition-all", c, goal.color === c && "ring-2 ring-offset-1 ring-ring")} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Add goal */}
      {adding ? (
        <div className="p-4 rounded-xl border border-dashed border-border bg-card space-y-3">
          <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Goal label (e.g. Monthly Revenue)" className="h-8 text-sm" autoFocus />
          <div className="flex gap-2">
            <Input type="number" value={newTarget} onChange={e => setNewTarget(e.target.value)} placeholder="Target (e.g. 1000)" className="h-8 text-sm flex-1" />
            <Input value={newUnit} onChange={e => setNewUnit(e.target.value)} placeholder="Unit (£, #)" className="h-8 text-sm w-20" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Deadline:</span>
            <input type="date" value={newDeadline} onChange={e => setNewDeadline(e.target.value)} className="h-8 px-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring flex-1" />
          </div>
          <div className="flex gap-1.5">
            {COLORS.map(c => (
              <button key={c} onClick={() => setNewColor(c)} className={cn("w-5 h-5 rounded-full transition-all", c, newColor === c && "ring-2 ring-offset-1 ring-ring")} />
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-8" onClick={addGoal}>Add Goal</Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full py-3 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground transition-colors flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" />Add goal
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function WorkspacePage() {
  const [tab, setTab] = useState<WorkspaceTab>("todos");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Workspace</h1>
        <p className="text-sm text-muted-foreground mt-1">Your planning hub — tasks, notes, calendar, and goals in one place.</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px",
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border")}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "todos"    && <TodoTab />}
      {tab === "notes"    && <NotesTab />}
      {tab === "calendar" && <CalendarTab />}
      {tab === "goals"    && <GoalsTab />}
    </div>
  );
}
