"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Check, Circle, GripVertical, Tag, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Priority = "high" | "medium" | "low";
type Filter = "all" | "active" | "completed";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  priority: Priority;
  createdAt: number;
}

const STORAGE_KEY = "cf_todos";

const priorityConfig: Record<Priority, { label: string; color: string; dot: string }> = {
  high:   { label: "High",   color: "text-red-500",    dot: "bg-red-500" },
  medium: { label: "Medium", color: "text-yellow-500", dot: "bg-yellow-500" },
  low:    { label: "Low",    color: "text-green-500",  dot: "bg-green-500" },
};

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function TodoPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [filter, setFilter] = useState<Filter>("all");
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const priorityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setTodos(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch {}
  }, [todos]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) {
        setPriorityOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const addTodo = () => {
    const text = input.trim();
    if (!text) return;
    setTodos(prev => [
      { id: generateId(), text, completed: false, priority, createdAt: Date.now() },
      ...prev,
    ]);
    setInput("");
    inputRef.current?.focus();
  };

  const toggle = (id: string) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const remove = (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  };

  const clearCompleted = () => {
    setTodos(prev => prev.filter(t => !t.completed));
  };

  const handleDragStart = (id: string) => setDragId(id);
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };
  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    setTodos(prev => {
      const items = [...prev];
      const fromIdx = items.findIndex(t => t.id === dragId);
      const toIdx = items.findIndex(t => t.id === targetId);
      const [moved] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, moved);
      return items;
    });
    setDragId(null);
    setDragOverId(null);
  };
  const handleDragEnd = () => { setDragId(null); setDragOverId(null); };

  const filtered = todos.filter(t => {
    if (filter === "active") return !t.completed;
    if (filter === "completed") return t.completed;
    return true;
  });

  const activeCount = todos.filter(t => !t.completed).length;
  const completedCount = todos.filter(t => t.completed).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">To-Do List</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {activeCount} task{activeCount !== 1 ? "s" : ""} remaining
        </p>
      </div>

      {/* Add task row */}
      <div className="flex gap-2 mb-6">
        {/* Priority picker */}
        <div className="relative" ref={priorityRef}>
          <button
            type="button"
            onClick={() => setPriorityOpen(v => !v)}
            className="flex items-center gap-1.5 h-10 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent transition-colors"
          >
            <span className={cn("w-2 h-2 rounded-full", priorityConfig[priority].dot)} />
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>
          {priorityOpen && (
            <div className="absolute top-full mt-1 left-0 z-10 bg-popover border border-border rounded-md shadow-md min-w-[110px] py-1">
              {(["high", "medium", "low"] as Priority[]).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { setPriority(p); setPriorityOpen(false); }}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent transition-colors",
                    priority === p && "font-medium"
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full", priorityConfig[p].dot)} />
                  <span className={priorityConfig[p].color}>{priorityConfig[p].label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <Input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addTodo()}
          placeholder="Add a task…"
          className="flex-1"
        />
        <Button onClick={addTodo} size="icon">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 border-b border-border pb-3">
        {(["all", "active", "completed"] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1 rounded-md text-sm capitalize transition-colors",
              filter === f
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Todo list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {filter === "completed" ? "No completed tasks yet." :
             filter === "active" ? "All done! Nothing left to do." :
             "Add your first task above."}
          </div>
        )}

        {filtered.map(todo => (
          <div
            key={todo.id}
            draggable
            onDragStart={() => handleDragStart(todo.id)}
            onDragOver={e => handleDragOver(e, todo.id)}
            onDrop={() => handleDrop(todo.id)}
            onDragEnd={handleDragEnd}
            className={cn(
              "group flex items-center gap-3 p-3 rounded-lg border border-border bg-card transition-all",
              dragOverId === todo.id && dragId !== todo.id && "border-primary bg-accent",
              dragId === todo.id && "opacity-40",
              todo.completed && "opacity-60"
            )}
          >
            {/* Drag handle */}
            <GripVertical className="w-4 h-4 text-muted-foreground/40 cursor-grab active:cursor-grabbing shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />

            {/* Check button */}
            <button
              type="button"
              onClick={() => toggle(todo.id)}
              className={cn(
                "shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                todo.completed
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/40 hover:border-primary"
              )}
            >
              {todo.completed && <Check className="w-3 h-3" strokeWidth={3} />}
            </button>

            {/* Text */}
            <span className={cn(
              "flex-1 text-sm",
              todo.completed && "line-through text-muted-foreground"
            )}>
              {todo.text}
            </span>

            {/* Priority badge */}
            <span className={cn("text-xs shrink-0 flex items-center gap-1", priorityConfig[todo.priority].color)}>
              <span className={cn("w-1.5 h-1.5 rounded-full", priorityConfig[todo.priority].dot)} />
              {priorityConfig[todo.priority].label}
            </span>

            {/* Delete */}
            <button
              type="button"
              onClick={() => remove(todo.id)}
              className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      {completedCount > 0 && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={clearCompleted}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Clear {completedCount} completed
          </button>
        </div>
      )}
    </div>
  );
}
