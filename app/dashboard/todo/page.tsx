"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Check, GripVertical, X, ChevronDown, Bookmark, BookmarkCheck, Calendar, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Priority = "high" | "medium" | "low";
type Filter = "all" | "active" | "completed";

interface Category {
  id: string;
  name: string;
  color: string;
  dot: string;
}

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  priority: Priority;
  category?: string;
  dueDate?: string;
  createdAt: number;
}

interface SavedTask {
  id: string;
  text: string;
  priority: Priority;
  category?: string;
}

const STORAGE_KEY = "cf_todos";
const SAVED_KEY = "cf_saved_tasks";

const PRIORITY: Record<Priority, { label: string; color: string; dot: string }> = {
  high:   { label: "High",   color: "text-red-500",    dot: "bg-red-500" },
  medium: { label: "Medium", color: "text-yellow-500", dot: "bg-yellow-500" },
  low:    { label: "Low",    color: "text-green-500",  dot: "bg-green-500" },
};

const CATEGORIES: Category[] = [
  { id: "content",  name: "Content",  color: "bg-purple-500/20 text-purple-400", dot: "bg-purple-500" },
  { id: "admin",    name: "Admin",    color: "bg-blue-500/20 text-blue-400",     dot: "bg-blue-500" },
  { id: "growth",   name: "Growth",   color: "bg-green-500/20 text-green-400",   dot: "bg-green-500" },
  { id: "personal", name: "Personal", color: "bg-orange-500/20 text-orange-400", dot: "bg-orange-500" },
];

function uid() { return Math.random().toString(36).slice(2, 10); }

function isOverdue(dueDate?: string) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

function formatDate(dateStr?: string) {
  if (!dateStr) return null;
  const today = new Date(new Date().toDateString()).getTime();
  const d = new Date(dateStr).getTime();
  if (d === today) return "Today";
  if (d === today + 86400000) return "Tomorrow";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function TodoPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [saved, setSaved] = useState<SavedTask[]>([]);
  const [input, setInput] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [catFilter, setCatFilter] = useState("");
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const priorityRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const t = localStorage.getItem(STORAGE_KEY);
      if (t) setTodos(JSON.parse(t));
      const s = localStorage.getItem(SAVED_KEY);
      if (s) setSaved(JSON.parse(s));
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(todos)); } catch {}
  }, [todos]);

  useEffect(() => {
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(saved)); } catch {}
  }, [saved]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) setPriorityOpen(false);
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) setCategoryOpen(false);
      if (savedRef.current && !savedRef.current.contains(e.target as Node)) setSavedOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const addTodo = (overrides?: Partial<Pick<Todo, "text" | "priority" | "category">>) => {
    const text = (overrides?.text ?? input).trim();
    if (!text) return;
    setTodos(prev => [{
      id: uid(), text, completed: false,
      priority: overrides?.priority ?? priority,
      category: overrides?.category ?? (category || undefined),
      dueDate: dueDate || undefined,
      createdAt: Date.now(),
    }, ...prev]);
    setInput("");
    inputRef.current?.focus();
  };

  const toggle = (id: string) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    if (!todo.completed) {
      setCompletingIds(prev => new Set(prev).add(id));
      setTimeout(() => setCompletingIds(prev => { const s = new Set(prev); s.delete(id); return s; }), 500);
    }
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const remove = (id: string) => setTodos(prev => prev.filter(t => t.id !== id));

  const toggleSaved = (todo: Todo) => {
    const isSaved = saved.some(s => s.text === todo.text);
    if (isSaved) {
      setSaved(prev => prev.filter(s => s.text !== todo.text));
    } else {
      setSaved(prev => [...prev, { id: uid(), text: todo.text, priority: todo.priority, category: todo.category }]);
    }
  };

  const clearCompleted = () => setTodos(prev => prev.filter(t => !t.completed));

  const handleDragStart = (id: string) => setDragId(id);
  const handleDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverId(id); };
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
  const completedCount = todos.filter(t => t.completed).length;
  const progress = todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0;

  const getCat = (id?: string) => CATEGORIES.find(c => c.id === id);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">To-Do List</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {activeCount} task{activeCount !== 1 ? "s" : ""} remaining
        </p>
      </div>

      {/* Progress bar */}
      {todos.length > 0 && (
        <div className="mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>{completedCount} of {todos.length} done</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="mb-6 space-y-2">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addTodo()}
            placeholder="Add a task… press Enter to save"
            className="flex-1"
          />
          <Button onClick={() => addTodo()} size="icon">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Options row */}
        <div className="flex gap-2 flex-wrap items-center">
          {/* Priority */}
          <div className="relative" ref={priorityRef}>
            <button type="button" onClick={() => setPriorityOpen(v => !v)}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-input bg-background text-xs hover:bg-accent transition-colors">
              <span className={cn("w-2 h-2 rounded-full", PRIORITY[priority].dot)} />
              <span className={PRIORITY[priority].color}>{PRIORITY[priority].label}</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
            {priorityOpen && (
              <div className="absolute top-full mt-1 left-0 z-10 bg-popover border border-border rounded-md shadow-md min-w-[110px] py-1">
                {(["high", "medium", "low"] as Priority[]).map(p => (
                  <button key={p} type="button" onClick={() => { setPriority(p); setPriorityOpen(false); }}
                    className={cn("flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors", priority === p && "font-medium")}>
                    <span className={cn("w-2 h-2 rounded-full", PRIORITY[p].dot)} />
                    <span className={PRIORITY[p].color}>{PRIORITY[p].label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Due date */}
          <div className="relative flex items-center">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 pointer-events-none" />
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="h-8 pl-7 pr-2 text-xs rounded-md border border-input bg-background hover:bg-accent transition-colors focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>

          {/* Category */}
          <div className="relative" ref={categoryRef}>
            <button type="button" onClick={() => setCategoryOpen(v => !v)}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-input bg-background text-xs hover:bg-accent transition-colors">
              <Tag className="w-3 h-3 text-muted-foreground" />
              <span className={category ? getCat(category)?.color.split(" ")[1] : "text-muted-foreground"}>
                {category ? getCat(category)?.name : "Category"}
              </span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
            {categoryOpen && (
              <div className="absolute top-full mt-1 left-0 z-10 bg-popover border border-border rounded-md shadow-md min-w-[120px] py-1">
                <button onClick={() => { setCategory(""); setCategoryOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors text-muted-foreground">
                  None
                </button>
                {CATEGORIES.map(cat => (
                  <button key={cat.id} type="button" onClick={() => { setCategory(cat.id); setCategoryOpen(false); }}
                    className={cn("flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors", category === cat.id && "font-medium")}>
                    <span className={cn("w-2 h-2 rounded-full", cat.dot)} />
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Saved tasks dictionary */}
          <div className="relative ml-auto" ref={savedRef}>
            <button type="button" onClick={() => setSavedOpen(v => !v)}
              className={cn(
                "flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs transition-colors",
                savedOpen ? "border-primary bg-primary/10 text-primary" : "border-input bg-background hover:bg-accent text-muted-foreground"
              )}>
              <Bookmark className="w-3 h-3" />
              Saved{saved.length > 0 && <span className="ml-0.5 bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px]">{saved.length}</span>}
            </button>
            {savedOpen && (
              <div className="absolute top-full mt-1 right-0 z-10 bg-popover border border-border rounded-md shadow-md w-64 py-1">
                <p className="px-3 pt-1.5 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Saved Tasks</p>
                {saved.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">Bookmark a task to save it for quick re-use.</p>
                ) : (
                  saved.map(st => {
                    const cat = getCat(st.category);
                    return (
                      <button key={st.id} type="button"
                        onClick={() => { addTodo({ text: st.text, priority: st.priority, category: st.category }); setSavedOpen(false); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-accent transition-colors text-left">
                        <span className={cn("w-2 h-2 rounded-full shrink-0", PRIORITY[st.priority].dot)} />
                        <span className="truncate flex-1">{st.text}</span>
                        {cat && <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full shrink-0", cat.color)}>{cat.name}</span>}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 space-y-2">
        <div className="flex gap-1">
          {(["all", "active", "completed"] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("px-3 py-1 rounded-md text-sm capitalize transition-colors",
                filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setCatFilter("")}
            className={cn("px-2.5 py-0.5 rounded-full text-xs transition-colors border",
              !catFilter ? "border-primary text-primary" : "border-border text-muted-foreground hover:border-foreground")}>
            All
          </button>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setCatFilter(catFilter === cat.id ? "" : cat.id)}
              className={cn("flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs transition-colors border",
                catFilter === cat.id ? cn("border-transparent", cat.color) : "border-border text-muted-foreground hover:border-foreground")}>
              <span className={cn("w-1.5 h-1.5 rounded-full", cat.dot)} />
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {filter === "completed" ? "No completed tasks yet." :
             filter === "active" ? "All done! Nothing left to do." :
             "Add your first task above."}
          </div>
        )}

        {filtered.map(todo => {
          const cat = getCat(todo.category);
          const overdue = isOverdue(todo.dueDate) && !todo.completed;
          const isCompleting = completingIds.has(todo.id);
          const isSaved = saved.some(s => s.text === todo.text);

          return (
            <div key={todo.id} draggable
              onDragStart={() => handleDragStart(todo.id)}
              onDragOver={e => handleDragOver(e, todo.id)}
              onDrop={() => handleDrop(todo.id)}
              onDragEnd={() => { setDragId(null); setDragOverId(null); }}
              className={cn(
                "group flex items-center gap-3 p-3 rounded-lg border bg-card transition-all",
                dragOverId === todo.id && dragId !== todo.id ? "border-primary bg-accent" : "border-border",
                dragId === todo.id && "opacity-40",
                todo.completed && "opacity-60",
                overdue && "border-red-500/40 bg-red-500/5",
              )}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground/40 cursor-grab active:cursor-grabbing shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Checkbox */}
              <button type="button" onClick={() => toggle(todo.id)}
                className={cn(
                  "shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200",
                  todo.completed ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 hover:border-primary",
                  isCompleting && "scale-125",
                )}>
                {todo.completed && <Check className="w-3 h-3" strokeWidth={3} />}
              </button>

              {/* Text + meta */}
              <div className="flex-1 min-w-0">
                <span className={cn("text-sm", todo.completed && "line-through text-muted-foreground")}>
                  {todo.text}
                </span>
                {(todo.dueDate || cat) && (
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {todo.dueDate && (
                      <span className={cn("text-xs flex items-center gap-0.5", overdue ? "text-red-400" : "text-muted-foreground")}>
                        {overdue && "⚠ "}{formatDate(todo.dueDate)}
                      </span>
                    )}
                    {cat && (
                      <span className={cn("text-xs px-1.5 py-0.5 rounded-full", cat.color)}>
                        {cat.name}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Priority */}
              <span className={cn("text-xs shrink-0 flex items-center gap-1", PRIORITY[todo.priority].color)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", PRIORITY[todo.priority].dot)} />
                {PRIORITY[todo.priority].label}
              </span>

              {/* Bookmark */}
              <button type="button" onClick={() => toggleSaved(todo)}
                title={isSaved ? "Remove from saved" : "Save for quick re-use"}
                className={cn(
                  "shrink-0 transition-all",
                  isSaved ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                )}>
                {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              </button>

              {/* Delete */}
              <button type="button" onClick={() => remove(todo.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {completedCount > 0 && (
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={clearCompleted}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors">
            Clear {completedCount} completed
          </button>
        </div>
      )}
    </div>
  );
}
