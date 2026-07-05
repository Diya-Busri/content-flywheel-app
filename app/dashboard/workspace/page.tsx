"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Plus, Check, GripVertical, X, ChevronDown, Bookmark, BookmarkCheck,
  Calendar, Tag, StickyNote, Target, ListTodo, ChevronLeft, ChevronRight,
  Trash2, Pencil, CheckCircle2, Search, AlertCircle, Zap, List,
  Heading2, Quote, FlaskConical, BarChart2, Megaphone, BookOpen, Brain,
  FileText, Lightbulb, ChevronUp, Loader2,
  Pin, Minus, Copy, Clock,
  LayoutDashboard, Package, Sparkles, ArrowRight, TrendingUp, PlayCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useWorkspaceAdmin } from "@/components/workspace-admin-context";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { ResearchTab } from "@/components/workspace/ResearchTab";
import UserMemoryTab from "@/components/workspace/UserMemoryTab";

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkspaceTab = "dashboard" | "todos" | "notes" | "calendar" | "goals"
  | "research" | "memory" | "founder-os" | "marketing-psychology" | "copywriting" | "content-ideas"
  | "analytics" | "distribution" | "experiments";
type Priority = "high" | "medium" | "low";
type TodoFilter = "all" | "active" | "completed";

interface Subtask { id: string; text: string; completed: boolean; }
interface Todo {
  id: string; text: string; completed: boolean; priority: Priority;
  category?: string; dueDate?: string; createdAt: number;
  subtasks?: Subtask[];
  recurring?: "daily" | "weekly" | "monthly";
  duration?: number; // minutes
  notes?: string;
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

const DURATION_OPTIONS = [
  { value: 15, label: "15 min" }, { value: 30, label: "30 min" },
  { value: 45, label: "45 min" }, { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" }, { value: 120, label: "2 hours" },
  { value: 180, label: "3 hours" },
];

// ─── Knowledge Base helpers ───────────────────────────────────────────────────

const KB_AI_SUGGESTIONS: Record<string, { label: string; href: string }[]> = {
  "marketing-psychology": [
    { label: "Generate Headlines", href: "/dashboard/design-studio" },
    { label: "Inspire Landing Page Copy", href: "/dashboard/design-studio" },
    { label: "Create Hook from This", href: "/dashboard/workspace?tab=content-ideas" },
  ],
  "copywriting": [
    { label: "Turn into Product Description", href: "/dashboard/library?create=true" },
    { label: "Open Design Studio", href: "/dashboard/design-studio" },
    { label: "Ask AI Coach", href: "/dashboard/ai-coach" },
  ],
  "content-ideas": [
    { label: "Expand into Script", href: "/dashboard/workspace?tab=notes" },
    { label: "Build Video Guide", href: "/dashboard/design-studio?tab=video" },
    { label: "Add to Calendar", href: "/dashboard/workspace?tab=calendar" },
  ],
  "analytics": [
    { label: "Create Experiment", href: "/dashboard/workspace?tab=experiments" },
    { label: "Ask AI Coach for Next Steps", href: "/dashboard/ai-coach" },
  ],
  "distribution": [
    { label: "Build Promotion Strategy", href: "/dashboard/ai-coach" },
    { label: "Open Design Studio", href: "/dashboard/design-studio" },
  ],
  "experiments": [
    { label: "Get AI Analysis", href: "/dashboard/ai-coach" },
    { label: "Roll Out to Distribution", href: "/dashboard/workspace?tab=distribution" },
    { label: "Record in Analytics", href: "/dashboard/workspace?tab=analytics" },
  ],
};

const CATEGORY_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  "marketing-psychology": { label: "Mktg Psychology", icon: Brain },
  "copywriting":          { label: "Copywriting",     icon: FileText },
  "content-ideas":        { label: "Content Ideas",   icon: Lightbulb },
  "analytics":            { label: "Analytics",       icon: BarChart2 },
  "distribution":         { label: "Distribution",    icon: Megaphone },
  "experiments":          { label: "Experiments",     icon: FlaskConical },
  "research":             { label: "Research",        icon: BookOpen },
};

function tagColor(tag: string): string {
  const palette = [
    "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
    "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
  ];
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) % palette.length;
  return palette[Math.abs(h) % palette.length];
}

function fmtRelative(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function uid() { return Math.random().toString(36).slice(2, 10); }
function isOverdue(d?: string) { return !!d && new Date(d) < new Date(new Date().toDateString()); }
function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60); const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}
function getNextRecurringDate(date: string, r: "daily" | "weekly" | "monthly"): string {
  const d = new Date(date + "T12:00:00");
  if (r === "daily") d.setDate(d.getDate() + 1);
  else if (r === "weekly") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}
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
  { id: "dashboard", label: "Dashboard",        icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: "todos",    label: "To-Do List",        icon: <ListTodo className="w-4 h-4" /> },
  { id: "notes",    label: "Notes",             icon: <StickyNote className="w-4 h-4" /> },
  { id: "calendar", label: "Calendar",          icon: <Calendar className="w-4 h-4" /> },
  { id: "goals",    label: "Goals",             icon: <Target className="w-4 h-4" /> },
  { id: "research", label: "Research",          icon: <BookOpen className="w-4 h-4" /> },
  { id: "memory",   label: "AI Memory",         icon: <Sparkles className="w-4 h-4" /> },
];

const ADMIN_TABS: { id: WorkspaceTab; label: string; icon: React.ReactNode }[] = [
  { id: "founder-os",            label: "Founder OS",           icon: <Brain className="w-4 h-4" /> },
  { id: "marketing-psychology",  label: "Mktg Psychology",      icon: <Brain className="w-4 h-4" /> },
  { id: "copywriting",           label: "Copywriting",          icon: <FileText className="w-4 h-4" /> },
  { id: "content-ideas",         label: "Content Ideas",        icon: <Lightbulb className="w-4 h-4" /> },
  { id: "analytics",             label: "Analytics",            icon: <BarChart2 className="w-4 h-4" /> },
  { id: "distribution",          label: "Distribution",         icon: <Megaphone className="w-4 h-4" /> },
  { id: "experiments",           label: "Experiments",          icon: <FlaskConical className="w-4 h-4" /> },
];

// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

interface ActiveProduct { id: string; title: string; status: string; format?: string; updatedAt?: string; }

function WorkspaceDashboard({ onTabChange }: { onTabChange: (tab: WorkspaceTab) => void }) {
  const router = useRouter();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [goals, setGoals] = useState<Goal[]>(DEFAULT_GOALS);
  const [activeProduct, setActiveProduct] = useState<ActiveProduct | null>(null);
  const [productLoading, setProductLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  // Load local data
  useEffect(() => {
    try { const t = localStorage.getItem("cf_todos"); if (t) setTodos(JSON.parse(t) as Todo[]); } catch {}
    try { const n = localStorage.getItem("cf_notes"); if (n) setNotes(JSON.parse(n) as Note[]); } catch {}
    try { const g = localStorage.getItem("cf_goals"); if (g) setGoals(JSON.parse(g) as Goal[]); } catch {}
  }, []);

  // Fetch most recent product
  useEffect(() => {
    fetch("/api/products")
      .then(r => r.ok ? r.json() : { products: [] })
      .then(({ products }) => {
        const p = (products as ActiveProduct[]).find(p => p.status !== "archived") ?? null;
        setActiveProduct(p);
      })
      .catch(() => {})
      .finally(() => setProductLoading(false));
  }, []);

  // Derived data
  const today = new Date().toISOString().slice(0, 10);
  const activeTodos = todos.filter(t => !t.completed);
  const todayTodos = activeTodos.filter(t => !t.dueDate || t.dueDate <= today);
  const highPriorityTodos = [...todayTodos].sort((a, b) => {
    const ord: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
    return ord[a.priority] - ord[b.priority];
  }).slice(0, 5);
  const overdueCount = activeTodos.filter(t => t.dueDate && t.dueDate < today).length;
  const completedToday = todos.filter(t => t.completed).length;
  const totalToday = todos.length;
  const progressPct = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;
  const goalAvgPct = goals.length > 0
    ? Math.round(goals.reduce((sum, g) => sum + Math.min(100, g.target > 0 ? (g.current / g.target) * 100 : 0), 0) / goals.length)
    : 0;

  const recentNotes = [...notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);

  // Recent Activity feed — merge note edits + task events, sorted by timestamp
  const activityFeed = useMemo(() => {
    const events: { ts: number; icon: string; label: string; text: string; badge?: string; onClick: () => void }[] = [];
    // Note events — last 8 by updatedAt
    [...notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8).forEach(n => {
      events.push({
        ts: n.updatedAt, icon: "📝", label: "Note",
        text: n.title || "Untitled",
        badge: n.tag,
        onClick: () => { try { sessionStorage.setItem("cf_open_note", n.id); } catch {} onTabChange("notes"); },
      });
    });
    // Task events — last 8 by createdAt
    [...todos].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8).forEach(t => {
      events.push({
        ts: t.createdAt,
        icon: t.completed ? "✅" : "⬜",
        label: t.completed ? "Completed" : "Task added",
        text: t.text,
        badge: t.priority,
        onClick: () => onTabChange("todos"),
      });
    });
    return events.sort((a, b) => b.ts - a.ts).slice(0, 12);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, todos]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();
  const dateStr = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  // AI recommendations based on data
  const recommendations: { icon: string; text: string; action?: string; tab?: WorkspaceTab; href?: string }[] = [];
  if (overdueCount > 0) recommendations.push({ icon: "⚠️", text: `${overdueCount} task${overdueCount > 1 ? "s are" : " is"} overdue — tackle these first today.`, tab: "todos" });
  if (activeTodos.length === 0) recommendations.push({ icon: "✅", text: "All tasks done! Add new tasks to keep your momentum going.", tab: "todos" });
  if (notes.length === 0) recommendations.push({ icon: "📝", text: "Start a note — capture your ideas before they disappear.", tab: "notes" });
  if (goals.every(g => g.current === 0)) recommendations.push({ icon: "🎯", text: "Update your goal progress to stay motivated and on track.", tab: "goals" });
  if (!activeProduct && !productLoading) recommendations.push({ icon: "📦", text: "You have no active product. Create your first digital product now!", href: "/dashboard/digital-products/create-from-research" });
  if (activeProduct?.status === "draft") recommendations.push({ icon: "🚀", text: `"${activeProduct.title}" is still a draft — finish and publish it!`, href: `/dashboard/digital-products/${activeProduct.id}/edit` });
  if (recommendations.length === 0) recommendations.push({ icon: "✨", text: "You're doing great! Research a new niche to find your next product opportunity.", tab: "research" });

  // AI Plan My Day
  const handlePlanDay = async () => {
    setPlanLoading(true); setPlanError(null); setPlan(null);
    const taskList = highPriorityTodos.map(t => `- [${t.priority}] ${t.text}${t.dueDate ? ` (due ${t.dueDate})` : ""}`).join("\n");
    const goalList = goals.map(g => `${g.label}: ${g.current}/${g.target} ${g.unit}`).join(", ");
    const productInfo = activeProduct ? `Active product: "${activeProduct.title}" (${activeProduct.status})` : "No active product";
    const prompt = `You are a productivity coach for a digital creator and online entrepreneur. Based on their current situation, create a focused daily action plan.

Current data:
Tasks (${activeTodos.length} active, ${overdueCount} overdue):
${taskList || "No tasks yet"}
Goals: ${goalList || "None set"}
${productInfo}
Notes: ${notes.length} saved

Create a concise, motivating daily action plan with 3-5 prioritised actions. Format as a numbered list. Be direct and specific. Keep each item to 1 sentence. End with one motivational sentence.`;

    try {
      const res = await fetch("/api/research/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: prompt, mode: "plan" }),
      });
      const json = await res.json() as { summary?: string; error?: string };
      if (json.summary) setPlan(json.summary);
      else if (json.error) setPlanError(json.error);
      else setPlanError("No plan returned.");
    } catch {
      setPlanError("Could not generate plan. Try again.");
    } finally { setPlanLoading(false); }
  };

  const QUICK_ACTIONS: { label: string; emoji: string; desc: string; onClick: () => void }[] = [
    { label: "Create Product", emoji: "📦", desc: "Start from research", onClick: () => router.push("/dashboard/digital-products/create-from-research") },
    { label: "AI Research", emoji: "🔍", desc: "Find opportunities", onClick: () => onTabChange("research") },
    { label: "New Note", emoji: "📝", desc: "Capture an idea", onClick: () => onTabChange("notes") },
    { label: "Add Task", emoji: "✅", desc: "Plan your work", onClick: () => onTabChange("todos") },
    { label: "Design Studio", emoji: "🎨", desc: "Create visuals", onClick: () => router.push("/dashboard/design-studio") },
    { label: "Content Calendar", emoji: "📅", desc: "Schedule posts", onClick: () => onTabChange("calendar") },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* ── Greeting header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-foreground">{greeting} 👋</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{dateStr}</p>
        </div>
        <button
          onClick={handlePlanDay}
          disabled={planLoading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all hover:from-orange-600 hover:to-amber-600 disabled:opacity-60"
        >
          {planLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {planLoading ? "Planning your day…" : "✨ Plan My Day"}
        </button>
      </div>

      {/* ── AI Daily Plan ───────────────────────────────────────────────── */}
      {(plan || planError) && (
        <div className={cn("rounded-2xl border p-5", plan ? "border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-amber-500/5" : "border-red-500/30 bg-red-500/5")}>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-orange-500" />
            <p className="text-sm font-bold text-foreground">Your AI Plan for Today</p>
            <button onClick={() => { setPlan(null); setPlanError(null); }} className="ml-auto text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
          </div>
          {plan && <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{plan}</div>}
          {planError && <p className="text-sm text-red-500">{planError}</p>}
        </div>
      )}

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Active tasks */}
        <button onClick={() => onTabChange("todos")}
          className="flex flex-col gap-1.5 p-4 rounded-2xl border border-border bg-card hover:border-blue-500/30 hover:bg-blue-500/5 transition-all text-left group">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Active Tasks</p>
          <p className="text-3xl font-black text-blue-500 tabular-nums">{activeTodos.length}</p>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
            <ListTodo className="w-3 h-3" /><span>To-Do List →</span>
          </div>
        </button>

        {/* Notes */}
        <button onClick={() => onTabChange("notes")}
          className="flex flex-col gap-1.5 p-4 rounded-2xl border border-border bg-card hover:border-amber-500/30 hover:bg-amber-500/5 transition-all text-left group">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Notes</p>
          <p className="text-3xl font-black text-amber-500 tabular-nums">{notes.length}</p>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
            <StickyNote className="w-3 h-3" /><span>Notes →</span>
          </div>
        </button>

        {/* Goals avg */}
        <button onClick={() => onTabChange("goals")}
          className="flex flex-col gap-1.5 p-4 rounded-2xl border border-border bg-card hover:border-green-500/30 hover:bg-green-500/5 transition-all text-left group">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Avg Goal</p>
          <p className={cn("text-3xl font-black tabular-nums", goalAvgPct >= 100 ? "text-green-500" : goalAvgPct >= 50 ? "text-orange-500" : "text-foreground")}>
            {goalAvgPct}%
          </p>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
            <Target className="w-3 h-3" /><span>Goals →</span>
          </div>
        </button>

        {/* Done today */}
        <button onClick={() => onTabChange("todos")}
          className="flex flex-col gap-1.5 p-4 rounded-2xl border border-border bg-card hover:border-orange-500/30 hover:bg-orange-500/5 transition-all text-left group">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Done Today</p>
          <p className="text-3xl font-black text-orange-500 tabular-nums">{completedToday}</p>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
            <CheckCircle2 className="w-3 h-3" /><span>{progressPct}% complete →</span>
          </div>
        </button>
      </div>

      {/* ── Quick actions ────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {QUICK_ACTIONS.map(a => (
            <button key={a.label} onClick={a.onClick}
              className="flex flex-col items-start gap-1.5 p-3.5 rounded-2xl border border-border bg-card hover:border-orange-500/30 hover:bg-orange-500/5 transition-all text-left group">
              <span className="text-xl">{a.emoji}</span>
              <div>
                <p className="text-xs font-bold text-foreground group-hover:text-orange-500 transition-colors">{a.label}</p>
                <p className="text-[10px] text-muted-foreground">{a.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main 2-col grid ──────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-5 gap-6">

        {/* LEFT: Today's Focus + Goals */}
        <div className="lg:col-span-3 space-y-6">

          {/* Today's Focus */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-orange-500" />
                <p className="text-sm font-bold text-foreground">Today&apos;s Focus</p>
                {overdueCount > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
                    <AlertCircle className="w-2.5 h-2.5" />{overdueCount} overdue
                  </span>
                )}
              </div>
              <button onClick={() => onTabChange("todos")} className="text-[11px] text-orange-500 hover:text-orange-600 font-semibold flex items-center gap-1">
                All tasks <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Progress bar */}
            {totalToday > 0 && (
              <div className="mb-4 flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                </div>
                <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">{completedToday}/{totalToday} done</span>
              </div>
            )}

            {highPriorityTodos.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-3">No tasks yet — what will you tackle today?</p>
                <button onClick={() => onTabChange("todos")} className="text-xs font-semibold text-orange-500 hover:text-orange-600 flex items-center gap-1 mx-auto">
                  <Plus className="w-3.5 h-3.5" />Add your first task
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {highPriorityTodos.map(todo => {
                  const cat = CATEGORIES.find(c => c.id === todo.category);
                  const overdue = todo.dueDate && todo.dueDate < today;
                  return (
                    <div key={todo.id} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-background transition-colors",
                      overdue ? "border-red-500/20 bg-red-500/5" : "border-border/60 hover:border-border")}>
                      <span className={cn("w-2 h-2 rounded-full shrink-0", PRIORITY[todo.priority].dot)} />
                      <span className="flex-1 text-sm text-foreground truncate">{todo.text}</span>
                      {cat && <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full shrink-0", cat.color)}>{cat.name}</span>}
                      {todo.dueDate && <span className={cn("text-[10px] font-medium shrink-0", overdue ? "text-red-400" : "text-muted-foreground")}>{fmtDate(todo.dueDate)}</span>}
                    </div>
                  );
                })}
                {activeTodos.length > 5 && (
                  <button onClick={() => onTabChange("todos")} className="text-xs text-muted-foreground hover:text-orange-500 transition-colors pt-1">
                    +{activeTodos.length - 5} more tasks →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Goals */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-orange-500" />
                <p className="text-sm font-bold text-foreground">Goals</p>
              </div>
              <button onClick={() => onTabChange("goals")} className="text-[11px] text-orange-500 hover:text-orange-600 font-semibold flex items-center gap-1">
                Manage <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-3">
              {goals.map(goal => {
                const pct = Math.min(100, goal.target > 0 ? Math.round((goal.current / goal.target) * 100) : 0);
                const done = pct >= 100;
                return (
                  <div key={goal.id} className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <RingProgress pct={pct} color={done ? "#22c55e" : goal.color} size={48} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] font-black" style={{ color: done ? "#22c55e" : goal.color }}>{pct}%</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{goal.label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: done ? "#22c55e" : goal.color }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">{goal.unit}{goal.current.toLocaleString()} / {goal.unit}{goal.target.toLocaleString()}</span>
                      </div>
                    </div>
                    {done && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: Active Product + Notes */}
        <div className="lg:col-span-2 space-y-6">

          {/* Active Product */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-orange-500" />
                <p className="text-sm font-bold text-foreground">Active Project</p>
              </div>
              <button onClick={() => router.push("/dashboard/library")} className="text-[11px] text-orange-500 hover:text-orange-600 font-semibold flex items-center gap-1">
                Library <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            {productLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />Loading…
              </div>
            ) : activeProduct ? (
              <div>
                <div className="p-4 rounded-xl border border-border bg-background hover:border-orange-500/30 hover:bg-orange-500/5 transition-colors cursor-pointer" onClick={() => router.push(`/dashboard/digital-products/${activeProduct.id}/edit`)}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-foreground leading-snug">{activeProduct.title}</p>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
                      activeProduct.status === "complete" ? "bg-green-500/10 text-green-600 dark:text-green-400" :
                      activeProduct.status === "draft" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground")}>
                      {activeProduct.status}
                    </span>
                  </div>
                  {activeProduct.format && <p className="text-[11px] text-muted-foreground capitalize">{activeProduct.format}</p>}
                  <div className="mt-3 flex gap-2">
                    {activeProduct.status === "draft" ? (
                      <button onClick={e => { e.stopPropagation(); router.push(`/dashboard/digital-products/${activeProduct.id}/edit`); }}
                        className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors">
                        Continue editing →
                      </button>
                    ) : (
                      <button onClick={e => { e.stopPropagation(); router.push(`/dashboard/design-studio`); }}
                        className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 transition-colors">
                        Create visuals →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-3">
                  <Package className="w-5 h-5 text-muted-foreground/40" />
                </div>
                <p className="text-xs text-muted-foreground mb-3">No active product yet</p>
                <button onClick={() => router.push("/dashboard/digital-products/create-from-research")}
                  className="text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-xl transition-colors">
                  Create your first product →
                </button>
              </div>
            )}
          </div>

          {/* Recent Notes */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-orange-500" />
                <p className="text-sm font-bold text-foreground">Recent Notes</p>
              </div>
              <button onClick={() => onTabChange("notes")} className="text-[11px] text-orange-500 hover:text-orange-600 font-semibold flex items-center gap-1">
                All notes <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            {recentNotes.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-xs text-muted-foreground mb-3">No notes yet — capture your first idea</p>
                <button onClick={() => onTabChange("notes")} className="text-xs font-semibold text-orange-500 hover:text-orange-600 flex items-center gap-1 mx-auto">
                  <Plus className="w-3.5 h-3.5" />New note
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentNotes.map(note => {
                  const preview = cleanPreview(note.body).slice(0, 80);
                  return (
                    <button key={note.id}
                      onClick={() => {
                        try { sessionStorage.setItem("cf_open_note", note.id); } catch {}
                        onTabChange("notes");
                      }}
                      className="w-full text-left p-3 rounded-xl border border-border/60 bg-background hover:border-orange-500/30 hover:bg-orange-500/5 transition-colors group">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-xs font-semibold text-foreground truncate group-hover:text-orange-500 transition-colors">{note.title || "Untitled"}</p>
                        {note.tag && <span className={cn("text-[9px] font-bold px-1.5 py-px rounded-full border shrink-0", NOTE_TAGS[note.tag as NoteTag]?.pill)}>{NOTE_TAGS[note.tag as NoteTag]?.label}</span>}
                      </div>
                      {preview && <p className="text-[11px] text-muted-foreground line-clamp-1">{preview}</p>}
                      <p className="text-[10px] text-muted-foreground/40 mt-1">{formatRelativeTime(note.updatedAt)}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── AI Recommendations ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-amber-500/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-orange-500" />
          <p className="text-sm font-bold text-foreground">AI Recommendations</p>
          <span className="text-[10px] font-medium text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">Based on your activity</span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {recommendations.map((rec, i) => (
            <button key={i}
              onClick={() => {
                if (rec.href) router.push(rec.href);
                else if (rec.tab) onTabChange(rec.tab);
              }}
              className={cn("flex items-start gap-3 p-3.5 rounded-xl border bg-background text-left transition-all group",
                (rec.href || rec.tab) ? "hover:border-orange-500/30 hover:bg-orange-500/5 cursor-pointer" : "cursor-default border-border/60")}
            >
              <span className="text-lg shrink-0 leading-none mt-0.5">{rec.icon}</span>
              <p className="text-xs text-foreground/80 group-hover:text-foreground transition-colors leading-relaxed">{rec.text}</p>
              {(rec.href || rec.tab) && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-orange-500 shrink-0 mt-0.5 ml-auto transition-colors" />}
            </button>
          ))}
        </div>
      </div>

      {/* ── Recent Activity ──────────────────────────────────────────────── */}
      {activityFeed.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <Clock className="w-4 h-4 text-orange-500" />
            <p className="text-sm font-bold text-foreground">Recent Activity</p>
            <span className="ml-auto text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {activityFeed.length} event{activityFeed.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Timeline */}
          <div className="relative pl-2">
            {/* Vertical line */}
            <div className="absolute left-[18px] top-2 bottom-2 w-px bg-border/50 pointer-events-none" />

            <div className="space-y-0.5">
              {activityFeed.map((ev, i) => (
                <button
                  key={i}
                  onClick={ev.onClick}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent transition-colors text-left group"
                >
                  {/* Timeline node */}
                  <div className="w-5 h-5 rounded-full bg-background border border-border/80 flex items-center justify-center shrink-0 z-10 group-hover:border-orange-500/50 transition-colors">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500/50 group-hover:bg-orange-500 transition-colors" />
                  </div>

                  {/* Emoji */}
                  <span className="text-sm leading-none shrink-0">{ev.icon}</span>

                  {/* Label + text */}
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 block leading-none mb-0.5">{ev.label}</span>
                    <p className="text-xs text-foreground/80 group-hover:text-foreground transition-colors truncate">{ev.text}</p>
                  </div>

                  {/* Badge */}
                  {ev.badge && (
                    <span className="text-[9px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full shrink-0 capitalize">
                      {ev.badge}
                    </span>
                  )}

                  {/* Time */}
                  <span className="text-[10px] text-muted-foreground/40 shrink-0 tabular-nums">
                    {formatRelativeTime(ev.ts)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [subInput, setSubInput] = useState<Record<string, string>>({});
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
    if (!todo.completed) {
      setCompletingIds(prev => new Set(prev).add(id));
      setTimeout(() => setCompletingIds(prev => { const s = new Set(prev); s.delete(id); return s; }), 500);
      // Recurring: auto-create next instance
      if (todo.recurring && todo.dueDate) {
        const nextDate = getNextRecurringDate(todo.dueDate, todo.recurring);
        setTodos(prev => [...prev, { ...todo, id: uid(), completed: false, dueDate: nextDate, subtasks: todo.subtasks?.map(s => ({ ...s, completed: false })), createdAt: Date.now() }]);
      }
    }
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };
  const remove = (id: string) => { setTodos(prev => prev.filter(t => t.id !== id)); if (expandedId === id) setExpandedId(null); };
  const updateTodo = (id: string, patch: Partial<Todo>) => setTodos(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  const toggleSaved = (todo: Todo) => {
    const isSaved = saved.some(s => s.text === todo.text);
    if (isSaved) setSaved(prev => prev.filter(s => s.text !== todo.text));
    else setSaved(prev => [...prev, { id: uid(), text: todo.text, priority: todo.priority, category: todo.category }]);
  };
  const addSubtask = (todoId: string, text: string) => {
    if (!text.trim()) return;
    const todo = todos.find(t => t.id === todoId);
    updateTodo(todoId, { subtasks: [...(todo?.subtasks ?? []), { id: uid(), text: text.trim(), completed: false }] });
    setSubInput(prev => ({ ...prev, [todoId]: "" }));
  };
  const toggleSubtask = (todoId: string, subId: string) => {
    const todo = todos.find(t => t.id === todoId);
    if (!todo?.subtasks) return;
    updateTodo(todoId, { subtasks: todo.subtasks.map(s => s.id === subId ? { ...s, completed: !s.completed } : s) });
  };
  const removeSubtask = (todoId: string, subId: string) => {
    const todo = todos.find(t => t.id === todoId);
    if (!todo?.subtasks) return;
    updateTodo(todoId, { subtasks: todo.subtasks.filter(s => s.id !== subId) });
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
                  <button key={p} onClick={() => { setPriority(p); setPriorityOpen(false); }} className={cn("flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-accent", priority === p && "font-semibold")}>
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

      {/* Filter tabs */}
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
      <div className="space-y-1.5">
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
          const isExpanded = expandedId === todo.id;
          const subDone = todo.subtasks?.filter(s => s.completed).length ?? 0;
          const subTotal = todo.subtasks?.length ?? 0;

          return (
            <div key={todo.id}>
              {/* Task row */}
              <div
                draggable
                onDragStart={() => setDragId(todo.id)}
                onDragOver={e => { e.preventDefault(); setDragOverId(todo.id); }}
                onDrop={() => handleDrop(todo.id)}
                onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                className={cn("group flex items-center gap-2.5 px-3 py-2.5 bg-card border transition-all duration-150",
                  isExpanded ? "rounded-t-xl border-b-0" : "rounded-xl",
                  dragOverId === todo.id && dragId !== todo.id ? "border-orange-500/40 bg-orange-500/5" : "border-border",
                  dragId === todo.id && "opacity-40 scale-[0.98]",
                  todo.completed && "opacity-50",
                  overdue && !todo.completed && "border-red-500/30 bg-red-500/5")}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground/30 cursor-grab shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                {/* Checkbox */}
                <button onClick={() => toggle(todo.id)} className={cn("shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200",
                  todo.completed ? "border-green-500 bg-green-500 text-white" : "border-muted-foreground/30 hover:border-orange-500",
                  isCompleting && "scale-125")}>
                  {todo.completed && <Check className="w-3 h-3" strokeWidth={3} />}
                </button>

                {/* Main content — click to expand */}
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : todo.id)}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={cn("text-sm font-medium leading-snug", todo.completed ? "line-through text-muted-foreground" : "text-foreground")}>{todo.text}</span>
                    {todo.recurring && (
                      <span className="text-[10px] bg-blue-500/10 text-blue-500 dark:text-blue-400 px-1.5 py-px rounded-full font-medium">🔁 {todo.recurring}</span>
                    )}
                    {todo.duration && (
                      <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-px rounded-full font-medium">⏱ {fmtDuration(todo.duration)}</span>
                    )}
                  </div>
                  {(todo.dueDate || cat || subTotal > 0) && (
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {todo.dueDate && <span className={cn("text-[11px] flex items-center gap-0.5 font-medium", overdue ? "text-red-400" : "text-muted-foreground")}>{overdue && "⚠ "}{fmtDate(todo.dueDate)}</span>}
                      {cat && <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", cat.color)}>{cat.name}</span>}
                      {subTotal > 0 && <span className="text-[10px] text-muted-foreground font-medium">{subDone}/{subTotal} subtasks</span>}
                    </div>
                  )}
                  {subTotal > 0 && (
                    <div className="mt-1 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden max-w-[160px]">
                      <div className="h-full bg-orange-500 rounded-full transition-all duration-300" style={{ width: `${Math.round(subDone / subTotal * 100)}%` }} />
                    </div>
                  )}
                </div>

                {/* Priority dot */}
                <span className={cn("w-2 h-2 rounded-full shrink-0", PRIORITY[todo.priority].dot)} />

                {/* Expand chevron */}
                <button onClick={() => setExpandedId(isExpanded ? null : todo.id)}
                  className={cn("shrink-0 transition-all text-muted-foreground/40 hover:text-muted-foreground opacity-0 group-hover:opacity-100", isExpanded && "opacity-100 rotate-90")}>
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Bookmark */}
                <button onClick={() => toggleSaved(todo)} className={cn("shrink-0 transition-all", isSaved ? "opacity-100 text-orange-500" : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-orange-500")}>
                  {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                </button>

                {/* Delete */}
                <button onClick={() => remove(todo.id)} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* ── Expanded detail panel ─────────────────────────────────────── */}
              {isExpanded && (
                <div className="border border-t-0 border-border rounded-b-xl bg-card px-4 pb-4 pt-3 space-y-3">

                  {/* Editable title */}
                  <input
                    value={todo.text}
                    onChange={e => updateTodo(todo.id, { text: e.target.value })}
                    className="w-full text-sm font-semibold text-foreground bg-transparent border-b border-border focus:outline-none focus:border-orange-500 pb-1 transition-colors"
                  />

                  {/* Meta selects row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Priority */}
                    <select value={todo.priority} onChange={e => updateTodo(todo.id, { priority: e.target.value as Priority })}
                      className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer">
                      <option value="high">🔴 High</option>
                      <option value="medium">🟡 Medium</option>
                      <option value="low">🟢 Low</option>
                    </select>
                    {/* Due date */}
                    <input type="date" value={todo.dueDate ?? ""} onChange={e => updateTodo(todo.id, { dueDate: e.target.value || undefined })}
                      className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer" />
                    {/* Duration */}
                    <select value={todo.duration ?? ""} onChange={e => updateTodo(todo.id, { duration: e.target.value ? Number(e.target.value) : undefined })}
                      className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer">
                      <option value="">⏱ Duration</option>
                      {DURATION_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                    {/* Recurring */}
                    <select value={todo.recurring ?? ""} onChange={e => updateTodo(todo.id, { recurring: (e.target.value as "daily" | "weekly" | "monthly") || undefined })}
                      className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer">
                      <option value="">🔁 Repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                    {/* Category */}
                    <select value={todo.category ?? ""} onChange={e => updateTodo(todo.id, { category: e.target.value || undefined })}
                      className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer">
                      <option value="">🏷 Label</option>
                      {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  {/* Notes */}
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Notes / Link</p>
                    <textarea
                      value={todo.notes ?? ""}
                      onChange={e => updateTodo(todo.id, { notes: e.target.value || undefined })}
                      placeholder="Add notes, a link, or context…"
                      rows={2}
                      className="w-full text-xs text-foreground bg-background border border-border rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-none placeholder:text-muted-foreground/50"
                    />
                  </div>

                  {/* Subtasks */}
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-semibold">Subtasks</p>
                    <div className="space-y-1 mb-2">
                      {(todo.subtasks ?? []).map(sub => (
                        <div key={sub.id} className="flex items-center gap-2 group/sub py-0.5">
                          <button onClick={() => toggleSubtask(todo.id, sub.id)}
                            className={cn("w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0",
                              sub.completed ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground/30 hover:border-orange-500")}>
                            {sub.completed && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                          </button>
                          <span className={cn("flex-1 text-xs", sub.completed ? "line-through text-muted-foreground" : "text-foreground")}>{sub.text}</span>
                          <button onClick={() => removeSubtask(todo.id, sub.id)}
                            className="opacity-0 group-hover/sub:opacity-100 text-muted-foreground hover:text-red-500 transition-all shrink-0">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={subInput[todo.id] ?? ""}
                        onChange={e => setSubInput(prev => ({ ...prev, [todo.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === "Enter") addSubtask(todo.id, subInput[todo.id] ?? ""); }}
                        placeholder="Add subtask… press Enter"
                        className="flex-1 text-xs bg-background border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                      />
                      <button onClick={() => addSubtask(todo.id, subInput[todo.id] ?? "")}
                        className="shrink-0 w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 transition-colors">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
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

function NotesTab({ onTabChange }: { onTabChange?: (tab: WorkspaceTab) => void }) {
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
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const [showConnected, setShowConnected] = useState(true);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    try {
      const n = localStorage.getItem("cf_notes");
      const parsed = n ? (JSON.parse(n) as Note[]) : [];
      // Check for note_from_research prefill (from Research tab)
      let prefillNote: Note | null = null;
      let openId: string | null = null;
      try {
        const raw = sessionStorage.getItem("note_from_research");
        if (raw) {
          const { title, body, tag } = JSON.parse(raw) as { title: string; body: string; tag: NoteTag };
          prefillNote = { id: uid(), title, body, updatedAt: Date.now(), tag };
          sessionStorage.removeItem("note_from_research");
        }
      } catch {}
      // Check for cf_open_note (from Global Search — open a specific note)
      if (!prefillNote) {
        try {
          const target = sessionStorage.getItem("cf_open_note");
          if (target) { openId = target; sessionStorage.removeItem("cf_open_note"); }
        } catch {}
      }
      const all = prefillNote ? [prefillNote, ...parsed] : parsed;
      if (all.length > 0) {
        setNotes(all);
        if (openId && all.some(note => note.id === openId)) {
          setActiveId(openId);
        } else {
          setActiveId(all[0].id);
        }
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

  const handleSummarize = async () => {
    if (!active || !active.body.trim()) return;
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/notes/ai-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "summarise", title: active.title, body: active.body }),
      });
      const json = await res.json() as { result?: string; error?: string };
      if (json.result) setAiSummary(json.result);
    } catch {}
    finally { setSummaryLoading(false); }
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
          if (replaceCallback) replaceCallback(json.result);
          else updateNote(active.id, { body: json.result, content: undefined });
        }
      } catch {}
      finally { setAiLoading(null); }
      return;
    }
    // Navigation / convert actions
    const prefill = JSON.stringify({ title: active.title, body: active.body });
    try { sessionStorage.setItem("note_prefill", prefill); } catch {}
    if (actionId === "turn-into-research") {
      try { sessionStorage.setItem("note_to_research", JSON.stringify({ topic: active.title, context: active.body })); } catch {}
      onTabChange?.("research");
    } else if (actionId === "turn-into-script" || actionId === "turn-into-video") {
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

            {/* ── AI Actions bar ─────────────────────────────────────────────── */}
            <div className="px-8 py-2 border-b border-border/40 shrink-0 flex items-center gap-1.5 flex-wrap bg-muted/10 dark:bg-[#0A0A0A]">
              {/* AI write actions */}
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mr-0.5">AI</span>
              <button
                onClick={handleSummarize}
                disabled={summaryLoading || !active.body.trim()}
                className={cn("flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium border transition-all",
                  aiSummary ? "bg-orange-500/10 text-orange-500 border-orange-500/30" : "border-border text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40")}>
                {summaryLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {summaryLoading ? "Summarising…" : aiSummary ? "Re-summarise" : "Summarise"}
              </button>
              <button
                onClick={() => handleAiAction("rewrite")}
                disabled={!!aiLoading || !active.body.trim()}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all disabled:opacity-40">
                {aiLoading === "rewrite" ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
                Rewrite
              </button>
              <button
                onClick={() => handleAiAction("expand-idea")}
                disabled={!!aiLoading || !active.body.trim()}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all disabled:opacity-40">
                {aiLoading === "expand-idea" ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronUp className="w-3 h-3" />}
                Expand
              </button>

              <div className="w-px h-4 bg-border/60 mx-0.5" />

              {/* Convert to actions */}
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mr-0.5">Convert to</span>
              <button
                onClick={() => handleAiAction("turn-into-research")}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
                🔬 Research
              </button>
              <button
                onClick={() => handleAiAction("turn-into-product")}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
                📦 Product
              </button>
              <button
                onClick={() => handleAiAction("turn-into-carousel")}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
                🎠 Carousel
              </button>
              <button
                onClick={() => handleAiAction("turn-into-video")}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
                🎬 Video Script
              </button>

              {aiSummary && (
                <button onClick={() => setAiSummary(null)} className="ml-auto h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent transition-all" title="Hide summary">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* ── AI Summary panel ───────────────────────────────────────────── */}
            {aiSummary && (
              <div className="px-8 py-3 border-b border-orange-500/20 bg-gradient-to-r from-orange-500/5 to-amber-500/5 shrink-0">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-orange-500 mb-1.5">AI Summary</p>
                    <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{aiSummary}</p>
                  </div>
                  <button onClick={() => setAiSummary(null)} className="shrink-0 text-muted-foreground/30 hover:text-muted-foreground transition-colors mt-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

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
  aiSummary?: string | null;
  usageCount?: number | null;
  source?: string | null;
  confidenceScore?: number | null;
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
  onPin: (entry: FounderEntry, pinned: boolean) => void;
  onTagsChange: (entry: FounderEntry, tags: string[]) => void;
  onDuplicate: (entry: FounderEntry) => void;
  typeLabel?: string;
  renderMeta?: (meta: Record<string, unknown> | null) => React.ReactNode;
  isRecentlySaved?: boolean;
  category: string;
  allEntries?: FounderEntry[];
}

function FounderWorkspaceEntryCard({
  entry, onDelete, onEdit, onPin, onTagsChange, onDuplicate,
  typeLabel, renderMeta, isRecentlySaved, category, allEntries = [],
}: EntryCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(!!isRecentlySaved);
  const [showRelated, setShowRelated] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);

  const meta = entry.metadata ?? {};
  const tags = (meta.tags as string[] | undefined) ?? [];
  const pinned = (meta.pinned as boolean | undefined) ?? false;
  const suggestions = KB_AI_SUGGESTIONS[category] ?? [];

  // Related: other entries with ≥1 shared tag (cross-section, same loaded pool)
  const relatedEntries = tags.length > 0
    ? allEntries.filter(e => {
        if (e.id === entry.id) return false;
        const eTags = (e.metadata?.tags as string[] | undefined) ?? [];
        return eTags.some(t => tags.includes(t));
      }).slice(0, 3)
    : [];

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !tags.includes(t)) onTagsChange(entry, [...tags, t]);
    setTagInput("");
    setAddingTag(false);
  };
  const removeTag = (tag: string) => onTagsChange(entry, tags.filter(t => t !== tag));

  useEffect(() => { if (addingTag) tagInputRef.current?.focus(); }, [addingTag]);

  const wasEdited = entry.updatedAt && entry.createdAt && entry.updatedAt !== entry.createdAt;

  return (
    <div className={cn(
      "rounded-xl border bg-card p-4 space-y-3 transition-all",
      pinned
        ? "border-orange-500/40 bg-orange-500/[0.02]"
        : "border-border hover:border-orange-500/30",
    )}>
      {/* ── Header ── */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {pinned && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-orange-500 uppercase tracking-wide">
                <Pin className="w-2.5 h-2.5 fill-current" />Pinned
              </span>
            )}
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
          {entry.content && entry.content.length > 120 && (
            <button onClick={() => setExpanded(v => !v)} className="mt-0.5 text-[11px] text-orange-500 hover:underline flex items-center gap-0.5">
              {expanded ? <><ChevronUp className="w-3 h-3" />Less</> : <><ChevronDown className="w-3 h-3" />More</>}
            </button>
          )}
          {renderMeta?.(entry.metadata)}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => onPin(entry, !pinned)}
            title={pinned ? "Unpin" : "Pin to top"}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              pinned ? "text-orange-500 hover:bg-orange-500/10" : "text-muted-foreground hover:bg-accent hover:text-orange-500",
            )}
          >
            <Pin className={cn("w-3.5 h-3.5", pinned && "fill-current")} />
          </button>
          <button onClick={() => onDuplicate(entry)} title="Duplicate" className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onEdit(entry)} title="Edit" className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(entry.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Tags ── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {tags.map(tag => (
          <span key={tag} className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border", tagColor(tag))}>
            {tag}
            <button onClick={() => removeTag(tag)} className="ml-0.5 hover:opacity-60 leading-none">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        {addingTag ? (
          <input
            ref={tagInputRef}
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); addTag(); }
              if (e.key === "Escape") { setAddingTag(false); setTagInput(""); }
            }}
            onBlur={addTag}
            placeholder="tag name…"
            className="h-5 w-24 px-2 rounded-full border border-orange-500/40 bg-orange-500/5 text-[10px] font-medium focus:outline-none text-orange-600"
          />
        ) : (
          <button
            onClick={() => setAddingTag(true)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-dashed border-border text-muted-foreground hover:border-orange-500/40 hover:text-orange-500 transition-colors"
          >
            <Tag className="w-2.5 h-2.5" />tag
          </button>
        )}
      </div>

      {/* ── Footer: dates + toggles ── */}
      <div className="flex items-center justify-between border-t border-border pt-2 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Created {fmtRelative(entry.createdAt)}
          </span>
          {wasEdited && <span>Edited {fmtRelative(entry.updatedAt)}</span>}
        </div>
        <div className="flex items-center gap-3">
          {relatedEntries.length > 0 && (
            <button onClick={() => setShowRelated(v => !v)} className="flex items-center gap-1 hover:text-foreground transition-colors">
              {relatedEntries.length} related
              <ChevronDown className={cn("w-3 h-3 transition-transform", showRelated && "rotate-180")} />
            </button>
          )}
          {suggestions.length > 0 && (
            <button
              onClick={() => setShowAISuggestions(v => !v)}
              className={cn("flex items-center gap-1 transition-colors", showAISuggestions ? "text-orange-500" : "hover:text-foreground")}
            >
              <Zap className="w-3 h-3" />AI actions
            </button>
          )}
        </div>
      </div>

      {/* ── Related Entries ── */}
      {showRelated && relatedEntries.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Related Entries</p>
          {relatedEntries.map(rel => {
            const relTags = (rel.metadata?.tags as string[] | undefined) ?? [];
            const shared = relTags.filter(t => tags.includes(t));
            return (
              <div key={rel.id} className="flex items-center gap-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-muted text-muted-foreground uppercase">
                  {(CATEGORY_LABELS[rel.category]?.label ?? rel.category).replace("-", " ")}
                </span>
                <span className="text-xs text-foreground flex-1 truncate">{rel.title}</span>
                {shared.length > 0 && (
                  <span className="shrink-0 text-[9px] text-muted-foreground">#{shared[0]}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── AI Suggestions ── */}
      {showAISuggestions && suggestions.length > 0 && (
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3 space-y-2">
          <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wide flex items-center gap-1">
            <Zap className="w-3 h-3" />What to do with this
          </p>
          <div className="flex gap-2 flex-wrap">
            {suggestions.map(s => (
              <button
                key={s.href + s.label}
                onClick={() => router.push(s.href)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-foreground hover:border-orange-500/40 hover:bg-orange-500/5 transition-all"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
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
  const [recentlySavedId, setRecentlySavedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQ, setSearchQ] = useState("");

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
        setEntries(prev => [created, ...prev]);
        setShowForm(false);
        setRecentlySavedId(created.id);
        setTimeout(() => setRecentlySavedId(null), 30000);
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

  const handleEdit = (entry: FounderEntry) => { setEditingEntry(entry); setShowForm(false); };

  const handlePin = async (entry: FounderEntry, pinned: boolean) => {
    const newMeta = { ...(entry.metadata ?? {}), pinned };
    try {
      const res = await fetch("/api/founder-workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, metadata: newMeta }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json() as FounderEntry;
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
    } catch { setError("Failed to update pin"); }
  };

  const handleTagsChange = async (entry: FounderEntry, tags: string[]) => {
    const newMeta = { ...(entry.metadata ?? {}), tags };
    try {
      const res = await fetch("/api/founder-workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, metadata: newMeta }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json() as FounderEntry;
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
    } catch { setError("Failed to update tags"); }
  };

  const handleDuplicate = async (entry: FounderEntry) => {
    try {
      const res = await fetch("/api/founder-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          type: entry.type,
          title: `${entry.title} (copy)`,
          content: entry.content,
          metadata: { ...(entry.metadata ?? {}), pinned: false },
        }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json() as FounderEntry;
      setEntries(prev => [created, ...prev]);
    } catch { setError("Failed to duplicate"); }
  };

  const typeLabel = (type: string) => types.find(t => t.value === type)?.label;

  // Sort: pinned first, then newest first
  const sorted = [...entries].sort((a, b) => {
    const ap = (a.metadata?.pinned as boolean) ?? false;
    const bp = (b.metadata?.pinned as boolean) ?? false;
    if (ap && !bp) return -1;
    if (!ap && bp) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const filtered = sorted
    .filter(e => typeFilter === "all" || e.type === typeFilter)
    .filter(e => !searchQ || e.title.toLowerCase().includes(searchQ.toLowerCase()) || e.content.toLowerCase().includes(searchQ.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-foreground">{heading}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Inline search */}
          {entries.length > 2 && !showForm && !editingEntry && (
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search…"
                className="pl-7 pr-2 h-8 text-xs rounded-xl border border-border bg-background focus:outline-none focus:border-orange-400 transition-colors w-36"
              />
            </div>
          )}
          {!showForm && !editingEntry && (
            <Button size="sm" className="h-8 bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setShowForm(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" />Add
            </Button>
          )}
        </div>
      </div>

      {/* Type filter chips */}
      {types.length > 1 && entries.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setTypeFilter("all")}
            className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
              typeFilter === "all" ? "bg-orange-500 text-white border-orange-500" : "border-border text-muted-foreground hover:border-orange-400 hover:text-foreground")}
          >
            All
          </button>
          {types.map(t => (
            <button key={t.value} onClick={() => setTypeFilter(t.value)}
              className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                typeFilter === t.value ? "bg-orange-500 text-white border-orange-500" : "border-border text-muted-foreground hover:border-orange-400 hover:text-foreground")}>
              {t.label}
            </button>
          ))}
        </div>
      )}

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
      ) : filtered.length === 0 && !showForm ? (
        <button onClick={() => setShowForm(true)}
          className="w-full py-8 rounded-2xl border border-dashed border-border text-sm text-muted-foreground hover:text-orange-500 hover:border-orange-500/40 hover:bg-orange-500/5 transition-all flex flex-col items-center gap-2">
          <Plus className="w-5 h-5" />
          <span>Add your first entry</span>
        </button>
      ) : (
        <div className="space-y-2">
          {filtered.map(entry => (
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
                onPin={handlePin}
                onTagsChange={handleTagsChange}
                onDuplicate={handleDuplicate}
                typeLabel={typeLabel(entry.type)}
                renderMeta={renderMeta}
                isRecentlySaved={entry.id === recentlySavedId}
                category={category}
                allEntries={entries}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOUNDER OS — OVERVIEW HUB + REDESIGNED TABS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Founder OS Overview ─────────────────────────────────────────────────────

function FounderOSOverview({ onTabChange }: { onTabChange: (tab: WorkspaceTab) => void }) {
  const [allEntries, setAllEntries] = useState<FounderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/founder-workspace")
      .then(r => r.ok ? r.json() : [])
      .then((data: FounderEntry[]) => setAllEntries(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const CATS = Object.entries(CATEGORY_LABELS) as [string, { label: string; icon: React.ComponentType<{ className?: string }> }][];
  const countByCategory = CATS.reduce<Record<string, number>>((acc, [id]) => {
    acc[id] = allEntries.filter(e => e.category === id).length;
    return acc;
  }, {});
  const totalEntries = allEntries.length;
  const recentEntries = [...allEntries]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);
  const runningExperiments = allEntries.filter(
    e => e.category === "experiments" && (e.metadata?.status as string) === "running"
  );
  const inFlightIdeas = allEntries.filter(
    e => e.category === "content-ideas" &&
      !["posted", "performed-well"].includes((e.metadata?.status as string) ?? "idea")
  );

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <Brain className="w-5 h-5 text-orange-500" />
            Founder OS
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            The brain of Content Flywheel — knowledge, experiments, and systems in one place
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/60 border border-border text-sm">
          <span className="font-black text-foreground tabular-nums">{loading ? "…" : totalEntries}</span>
          <span className="text-muted-foreground text-xs">knowledge items</span>
        </div>
      </div>

      {/* Knowledge Base stats — one tile per section */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Knowledge Base</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {CATS.map(([id, meta]) => {
            const CatIcon = meta.icon;
            const count = countByCategory[id] ?? 0;
            return (
              <button key={id} onClick={() => onTabChange(id as WorkspaceTab)}
                className="flex flex-col gap-3 p-4 rounded-2xl border border-border bg-card hover:border-orange-500/30 hover:bg-orange-500/5 transition-all text-left group">
                <div className="flex items-start justify-between">
                  <div className="w-8 h-8 rounded-xl bg-muted/60 flex items-center justify-center group-hover:bg-orange-500/10 transition-colors">
                    <CatIcon className="w-4 h-4 text-muted-foreground group-hover:text-orange-500 transition-colors" />
                  </div>
                  <span className="text-xl font-black text-foreground tabular-nums">{loading ? "…" : count}</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground/80 group-hover:text-foreground transition-colors leading-tight">{meta.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{count === 0 ? "Empty — add first" : `${count} item${count !== 1 ? "s" : ""}`}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Knowledge Pipeline */}
      {(() => {
        const withSummary = allEntries.filter(e => !!e.aiSummary).length;
        const withUsage   = allEntries.filter(e => (e.usageCount ?? 0) > 0).length;
        const highValue   = allEntries.filter(e => (e.usageCount ?? 0) >= 3).length;
        const pipelineStages = [
          { label: "Captured",      count: totalEntries,  Icon: BookOpen,   bg: "bg-slate-500/10",  color: "text-slate-500"  },
          { label: "AI Summarised", count: withSummary,   Icon: Sparkles,   bg: "bg-purple-500/10", color: "text-purple-500" },
          { label: "Searchable",    count: withSummary,   Icon: Search,     bg: "bg-blue-500/10",   color: "text-blue-500"   },
          { label: "Coach Uses",    count: withUsage,     Icon: Brain,      bg: "bg-orange-500/10", color: "text-orange-500" },
          { label: "High-Value",    count: highValue,     Icon: TrendingUp, bg: "bg-green-500/10",  color: "text-green-500"  },
        ] as const;

        const SOURCE_META: Record<string, { label: string; bar: string }> = {
          manual:     { label: "Manual",   bar: "bg-slate-400"  },
          research:   { label: "Research", bar: "bg-purple-500" },
          coach:      { label: "Coach",    bar: "bg-blue-500"   },
          analytics:  { label: "Analytics",bar: "bg-green-500"  },
          experiment: { label: "Experiment",bar:"bg-orange-500" },
        };
        const sourceCounts = Object.entries(SOURCE_META).map(([src, meta]) => ({
          ...meta,
          src,
          count: allEntries.filter(e => (e.source ?? "manual") === src).length,
        }));
        const maxSrc = Math.max(...sourceCounts.map(s => s.count), 1);
        const topReferenced = [...allEntries]
          .filter(e => (e.usageCount ?? 0) > 0)
          .sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0))
          .slice(0, 5);

        return (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Knowledge Pipeline</p>
            <div className="rounded-2xl border border-border bg-card p-5">
              {/* Pipeline flow */}
              <div className="flex items-start overflow-x-auto pb-2 gap-0">
                {pipelineStages.map((stage, idx) => (
                  <div key={stage.label} className="flex items-start shrink-0">
                    <div className="flex flex-col items-center min-w-[90px] px-2">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${stage.bg}`}>
                        <stage.Icon className={`w-4 h-4 ${stage.color}`} />
                      </div>
                      <span className="text-base font-black tabular-nums text-foreground">
                        {loading ? "…" : stage.count}
                      </span>
                      <span className="text-[9px] text-muted-foreground text-center leading-tight mt-0.5">{stage.label}</span>
                    </div>
                    {idx < pipelineStages.length - 1 && (
                      <div className="flex items-center pt-4 shrink-0">
                        <div className="w-5 h-px bg-border" />
                        <ChevronRight className="w-3 h-3 text-muted-foreground/40 -ml-1" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Source breakdown + most referenced */}
              <div className="mt-4 pt-4 border-t border-border grid sm:grid-cols-2 gap-6">
                {/* Source breakdown */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">By Source</p>
                  <div className="space-y-2">
                    {sourceCounts.map(s => (
                      <div key={s.src} className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-16 truncate">{s.label}</span>
                        <div className="flex-1 h-1.5 bg-muted/60 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${s.bar}`}
                            style={{ width: `${Math.round((s.count / maxSrc) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-foreground tabular-nums w-3 text-right">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Most referenced by AI */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Most Referenced by AI</p>
                  {loading ? (
                    <div className="text-xs text-muted-foreground animate-pulse">Loading…</div>
                  ) : topReferenced.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No entries referenced yet — the Coach will populate this as it uses your knowledge.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {topReferenced.map(e => (
                        <div key={e.id} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                          <span className="text-xs text-foreground/80 flex-1 truncate">{e.title}</span>
                          <span className="text-[10px] font-bold text-orange-500 tabular-nums">
                            {e.usageCount}×
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Status snapshot — 3 panels */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Running Experiments */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            {runningExperiments.length > 0 && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />}
            <FlaskConical className="w-4 h-4 text-blue-500" />
            <p className="text-sm font-bold text-foreground">Running Experiments</p>
            <span className="ml-auto text-sm font-black text-blue-500 tabular-nums">{loading ? "…" : runningExperiments.length}</span>
          </div>
          {loading ? (
            <div className="text-xs text-muted-foreground animate-pulse">Loading…</div>
          ) : runningExperiments.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground">No experiments running.</p>
              <button onClick={() => onTabChange("experiments")} className="mt-2 text-xs text-orange-500 font-semibold">Start an experiment →</button>
            </div>
          ) : (
            <div className="space-y-1">
              {runningExperiments.slice(0, 5).map(e => (
                <button key={e.id} onClick={() => onTabChange("experiments")}
                  className="w-full text-left text-xs text-foreground/80 py-1.5 px-2 rounded-lg hover:bg-accent transition-colors truncate block">
                  {e.title}
                </button>
              ))}
              {runningExperiments.length > 5 && (
                <button onClick={() => onTabChange("experiments")} className="text-xs text-orange-500 font-semibold pt-1 block">
                  +{runningExperiments.length - 5} more →
                </button>
              )}
            </div>
          )}
          <button onClick={() => onTabChange("experiments")} className="mt-4 text-xs text-orange-500 hover:text-orange-600 font-semibold flex items-center gap-1">
            Open lab <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Ideas in Pipeline */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-bold text-foreground">Ideas in Pipeline</p>
            <span className="ml-auto text-sm font-black text-amber-500 tabular-nums">{loading ? "…" : inFlightIdeas.length}</span>
          </div>
          {loading ? (
            <div className="text-xs text-muted-foreground animate-pulse">Loading…</div>
          ) : inFlightIdeas.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground">No ideas in progress.</p>
              <button onClick={() => onTabChange("content-ideas")} className="mt-2 text-xs text-orange-500 font-semibold">Open idea board →</button>
            </div>
          ) : (
            <div className="space-y-1">
              {inFlightIdeas.slice(0, 5).map(e => (
                <button key={e.id} onClick={() => onTabChange("content-ideas")}
                  className="w-full flex items-center gap-2 text-left py-1.5 px-2 rounded-lg hover:bg-accent transition-colors">
                  <span className="text-xs text-foreground/80 flex-1 truncate">{e.title}</span>
                  {!!e.metadata?.status && (
                    <span className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full capitalize shrink-0">
                      {String(e.metadata.status).replace("-", " ")}
                    </span>
                  )}
                </button>
              ))}
              {inFlightIdeas.length > 5 && (
                <button onClick={() => onTabChange("content-ideas")} className="text-xs text-orange-500 font-semibold pt-1 block">
                  +{inFlightIdeas.length - 5} more →
                </button>
              )}
            </div>
          )}
          <button onClick={() => onTabChange("content-ideas")} className="mt-4 text-xs text-orange-500 hover:text-orange-600 font-semibold flex items-center gap-1">
            Open board <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Recently Added */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-bold text-foreground">Recently Added</p>
          </div>
          {loading ? (
            <div className="text-xs text-muted-foreground animate-pulse">Loading…</div>
          ) : recentEntries.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground">Start capturing knowledge to Founder OS</p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentEntries.map(e => {
                const catMeta = CATEGORY_LABELS[e.category];
                const CatIcon = catMeta?.icon ?? BookOpen;
                return (
                  <button key={e.id} onClick={() => onTabChange(e.category as WorkspaceTab)}
                    className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-accent transition-colors text-left group">
                    <CatIcon className="w-3 h-3 text-muted-foreground/50 group-hover:text-orange-500 shrink-0 transition-colors" />
                    <span className="text-xs text-foreground/80 flex-1 truncate group-hover:text-foreground transition-colors">{e.title}</span>
                    <span className="text-[10px] text-muted-foreground/40 shrink-0 tabular-nums">{fmtRelative(e.createdAt)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Content Ideas Kanban ─────────────────────────────────────────────────────

const CONTENT_IDEA_STAGES = [
  { status: "idea",           label: "💡 Idea",           color: "text-slate-500",                        bg: "bg-slate-500/10",  dot: "bg-slate-400" },
  { status: "researching",    label: "🔬 Researching",    color: "text-purple-600 dark:text-purple-400",  bg: "bg-purple-500/10", dot: "bg-purple-400" },
  { status: "writing",        label: "✍️ Writing",         color: "text-blue-600 dark:text-blue-400",      bg: "bg-blue-500/10",   dot: "bg-blue-400" },
  { status: "recording",      label: "🎬 Recording",      color: "text-orange-600 dark:text-orange-400",  bg: "bg-orange-500/10", dot: "bg-orange-400" },
  { status: "posted",         label: "📤 Posted",         color: "text-green-600 dark:text-green-400",    bg: "bg-green-500/10",  dot: "bg-green-400" },
  { status: "performed-well", label: "🏆 Performed Well", color: "text-amber-600 dark:text-amber-400",    bg: "bg-amber-500/10",  dot: "bg-amber-400" },
] as const;

const CONTENT_IDEA_TYPES = [
  { value: "hook",         label: "Hook" },
  { value: "angle",        label: "Angle" },
  { value: "script",       label: "Script" },
  { value: "viral-format", label: "Viral Format" },
  { value: "series",       label: "Series Idea" },
];

function ContentIdeasKanbanTab() {
  const [entries, setEntries] = useState<FounderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FounderEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [activeStage, setActiveStage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/founder-workspace?category=content-ideas")
      .then(r => r.ok ? r.json() : [])
      .then((data: FounderEntry[]) => setEntries(data))
      .catch(() => setError("Could not load ideas"))
      .finally(() => setLoading(false));
  }, []);

  const moveStage = async (entry: FounderEntry, newStatus: string) => {
    const newMeta = { ...(entry.metadata ?? {}), status: newStatus };
    try {
      const res = await fetch("/api/founder-workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, metadata: newMeta }),
      });
      const updated = await res.json() as FounderEntry;
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
    } catch { setError("Failed to update status"); }
  };

  const handleSave = async (data: { type: string; title: string; content: string; metadata?: Record<string, unknown> }) => {
    try {
      if (editingEntry) {
        const res = await fetch("/api/founder-workspace", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingEntry.id, ...data }),
        });
        const updated = await res.json() as FounderEntry;
        setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
        setEditingEntry(null);
      } else {
        const res = await fetch("/api/founder-workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: "content-ideas", ...data }),
        });
        const created = await res.json() as FounderEntry;
        setEntries(prev => [created, ...prev]);
        setShowForm(false);
      }
    } catch { setError("Failed to save idea"); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this idea?")) return;
    try {
      await fetch(`/api/founder-workspace?id=${id}`, { method: "DELETE" });
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch { setError("Failed to delete"); }
  };

  const filtered = entries.filter(e =>
    !searchQ || e.title.toLowerCase().includes(searchQ.toLowerCase()) || e.content.toLowerCase().includes(searchQ.toLowerCase())
  );
  const stagesToShow = activeStage ? CONTENT_IDEA_STAGES.filter(s => s.status === activeStage) : CONTENT_IDEA_STAGES;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            Content Ideas Board
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Move ideas from concept to published — click arrows to advance stage</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search ideas…"
              className="pl-7 pr-3 h-8 text-xs rounded-xl border border-border bg-background focus:outline-none focus:border-orange-400 w-40" />
          </div>
          <Button size="sm" className="h-8 bg-orange-500 hover:bg-orange-600 text-white shrink-0" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />New Idea
          </Button>
        </div>
      </div>

      {/* Stage filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setActiveStage(null)}
          className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
            !activeStage ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground")}>
          All · {filtered.length}
        </button>
        {CONTENT_IDEA_STAGES.map(stage => {
          const count = filtered.filter(e => (e.metadata?.status ?? "idea") === stage.status).length;
          return (
            <button key={stage.status} onClick={() => setActiveStage(activeStage === stage.status ? null : stage.status)}
              className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                activeStage === stage.status
                  ? `${stage.bg} ${stage.color} border-current`
                  : "border-border text-muted-foreground hover:text-foreground")}>
              <span className={cn("w-1.5 h-1.5 rounded-full", stage.dot)} />
              {stage.label.split(" ").slice(1).join(" ")} · {count}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-500 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5" />{error}
          <button className="ml-auto underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {showForm && (
        <FounderWorkspaceEntryForm
          types={CONTENT_IDEA_TYPES}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
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
        />
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin" />Loading ideas…
        </div>
      ) : (
        <div className={cn("grid gap-3", activeStage ? "grid-cols-1 max-w-sm" : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-6")}>
          {stagesToShow.map(stage => {
            const stageEntries = filtered.filter(e => (e.metadata?.status ?? "idea") === stage.status);
            const stageIdx = CONTENT_IDEA_STAGES.findIndex(s => s.status === stage.status);
            return (
              <div key={stage.status} className="rounded-2xl border border-border bg-muted/20 p-3 min-h-[140px]">
                <div className="flex items-center justify-between mb-3">
                  <p className={cn("text-[10px] font-black uppercase tracking-widest", stage.color)}>{stage.label}</p>
                  {stageEntries.length > 0 && (
                    <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded-full tabular-nums", stage.bg, stage.color)}>
                      {stageEntries.length}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {stageEntries.map(entry => (
                    editingEntry?.id === entry.id ? (
                      <FounderWorkspaceEntryForm
                        key={entry.id}
                        types={CONTENT_IDEA_TYPES}
                        onSave={handleSave}
                        onCancel={() => setEditingEntry(null)}
                        initial={entry}
                        titlePlaceholder="Idea title…"
                        contentPlaceholder="Details…"
                      />
                    ) : (
                      <div key={entry.id}
                        className="bg-background border border-border/60 rounded-xl p-3 group hover:border-orange-500/30 hover:shadow-sm transition-all">
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="text-[9px] font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                            {CONTENT_IDEA_TYPES.find(t => t.value === entry.type)?.label ?? entry.type}
                          </span>
                          {(entry.metadata?.pinned as boolean) && <Pin className="w-2.5 h-2.5 text-orange-500 fill-current ml-auto" />}
                        </div>
                        <p className="text-xs font-semibold text-foreground leading-snug line-clamp-3">{entry.title}</p>
                        {!!entry.metadata?.platform && (
                          <span className="mt-1.5 inline-block text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                            {String(entry.metadata.platform)}
                          </span>
                        )}
                        <div className="flex items-center gap-0.5 mt-2 pt-2 border-t border-border/40">
                          {stageIdx > 0 && (
                            <button onClick={() => moveStage(entry, CONTENT_IDEA_STAGES[stageIdx - 1].status)}
                              title={`Move to ${CONTENT_IDEA_STAGES[stageIdx - 1].label}`}
                              className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                              <ChevronLeft className="w-3 h-3" />
                            </button>
                          )}
                          <div className="flex-1" />
                          <button onClick={() => setEditingEntry(entry)}
                            className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={() => handleDelete(entry.id)}
                            className="p-1 rounded-md hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100">
                            <Trash2 className="w-3 h-3" />
                          </button>
                          {stageIdx < CONTENT_IDEA_STAGES.length - 1 && (
                            <button onClick={() => moveStage(entry, CONTENT_IDEA_STAGES[stageIdx + 1].status)}
                              title={`Move to ${CONTENT_IDEA_STAGES[stageIdx + 1].label}`}
                              className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-orange-500">
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  ))}
                </div>
                {stageEntries.length === 0 && (
                  <div className="py-4 text-center">
                    <p className="text-[10px] text-muted-foreground/30">Empty</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Experiments Business Lab ─────────────────────────────────────────────────

const EXPERIMENT_LAB_STAGES = [
  { status: "running",  label: "🔬 Running",    color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-500/10",  border: "border-blue-500/30" },
  { status: "won",      label: "🏆 Won",         color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10", border: "border-green-500/30" },
  { status: "failed",   label: "❌ Failed",      color: "text-red-500",                        bg: "bg-red-500/10",   border: "border-red-500/30" },
  { status: "archived", label: "📦 Archived",    color: "text-muted-foreground",               bg: "bg-muted",        border: "border-border" },
] as const;

function ExperimentsLabTab() {
  const [entries, setEntries] = useState<FounderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FounderEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetch("/api/founder-workspace?category=experiments")
      .then(r => r.ok ? r.json() : [])
      .then((data: FounderEntry[]) => setEntries(data))
      .catch(() => setError("Could not load experiments"))
      .finally(() => setLoading(false));
  }, []);

  const EXP_TYPES = [{ value: "experiment", label: "Experiment" }];

  const handleSave = async (data: { type: string; title: string; content: string; metadata?: Record<string, unknown> }) => {
    try {
      if (editingEntry) {
        const res = await fetch("/api/founder-workspace", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingEntry.id, ...data }),
        });
        const updated = await res.json() as FounderEntry;
        setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
        setEditingEntry(null);
      } else {
        const res = await fetch("/api/founder-workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: "experiments", ...data }),
        });
        const created = await res.json() as FounderEntry;
        setEntries(prev => [created, ...prev]);
        setShowForm(false);
      }
    } catch { setError("Failed to save"); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this experiment?")) return;
    try {
      await fetch(`/api/founder-workspace?id=${id}`, { method: "DELETE" });
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch { setError("Failed to delete"); }
  };

  const filtered = entries.filter(e => {
    const q = searchQ.toLowerCase();
    const matchQ = !q || e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q);
    const matchS = statusFilter === "all" || (e.metadata?.status ?? "running") === statusFilter;
    return matchQ && matchS;
  });

  const counts = EXPERIMENT_LAB_STAGES.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = entries.filter(e => (e.metadata?.status ?? "running") === s.status).length;
    return acc;
  }, {});

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-blue-500" />
            Business Lab
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Treat the business like a lab — every hypothesis is a chance to learn</p>
        </div>
        <Button size="sm" className="h-8 bg-orange-500 hover:bg-orange-600 text-white shrink-0" onClick={() => setShowForm(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" />New Experiment
        </Button>
      </div>

      {/* Status stat tiles */}
      <div className="grid grid-cols-4 gap-3">
        {EXPERIMENT_LAB_STAGES.map(stage => (
          <button key={stage.status}
            onClick={() => setStatusFilter(statusFilter === stage.status ? "all" : stage.status)}
            className={cn("flex flex-col gap-1 p-3.5 rounded-2xl border transition-all text-left",
              statusFilter === stage.status
                ? `${stage.bg} ${stage.border} ${stage.color}`
                : "border-border bg-card hover:border-orange-500/20 hover:bg-orange-500/5")}>
            <span className={cn("text-2xl font-black tabular-nums", statusFilter === stage.status ? stage.color : "text-foreground")}>
              {counts[stage.status] ?? 0}
            </span>
            <span className={cn("text-[10px] font-semibold", statusFilter === stage.status ? stage.color : "text-muted-foreground")}>
              {stage.label}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search experiments…"
          className="pl-8 pr-3 h-8 w-full text-xs rounded-xl border border-border bg-background focus:outline-none focus:border-orange-400 transition-colors" />
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-500 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5" />{error}
          <button className="ml-auto underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {showForm && (
        <FounderWorkspaceEntryForm
          types={EXP_TYPES}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
          titlePlaceholder="Hypothesis: e.g. Adding urgency to the CTA will lift conversions by 20%"
          contentPlaceholder="What you're testing, how you're measuring it, what you expect…"
          extraFields={(_type, meta, setMeta) => (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Goal / Success metric</label>
                  <Input
                    value={typeof meta.goal === "string" ? meta.goal : ""}
                    onChange={e => setMeta({ ...meta, goal: e.target.value })}
                    placeholder="e.g. +20% CTR on bio link"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                  <div className="flex gap-1">
                    {EXPERIMENT_LAB_STAGES.slice(0, 3).map(s => (
                      <button key={s.status} onClick={() => setMeta({ ...meta, status: s.status })}
                        className={cn("flex-1 py-1 rounded-lg text-[10px] font-bold border capitalize transition-all",
                          meta.status === s.status
                            ? `${s.bg} ${s.border} ${s.color}`
                            : "border-border text-muted-foreground hover:border-orange-400")}>
                        {s.status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Result (fill in when done)</label>
                <Input
                  value={typeof meta.result === "string" ? meta.result : ""}
                  onChange={e => setMeta({ ...meta, result: e.target.value })}
                  placeholder="e.g. CTR went from 1.2% to 3.8% — rolling out"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}
        />
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin" />Loading experiments…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <FlaskConical className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">
            {searchQ || statusFilter !== "all"
              ? "No experiments match your filter"
              : "No experiments yet — start treating the business like a lab"}
          </p>
          {!showForm && (
            <Button size="sm" onClick={() => setShowForm(true)} className="bg-orange-500 hover:bg-orange-600 text-white">
              + Run First Experiment
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {EXPERIMENT_LAB_STAGES
            .filter(s => filtered.some(e => (e.metadata?.status ?? "running") === s.status))
            .map(stage => {
              const stageEntries = filtered.filter(e => (e.metadata?.status ?? "running") === stage.status);
              return (
                <div key={stage.status}>
                  <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl mb-2", stage.bg)}>
                    <span className={cn("text-xs font-black", stage.color)}>{stage.label}</span>
                    <span className={cn("text-xs font-black ml-auto tabular-nums", stage.color)}>{stageEntries.length}</span>
                  </div>
                  <div className="space-y-2">
                    {stageEntries.map(entry => (
                      editingEntry?.id === entry.id ? (
                        <FounderWorkspaceEntryForm
                          key={entry.id}
                          types={EXP_TYPES}
                          onSave={handleSave}
                          onCancel={() => setEditingEntry(null)}
                          initial={entry}
                          titlePlaceholder="Hypothesis…"
                          contentPlaceholder="Details…"
                        />
                      ) : (
                        <div key={entry.id}
                          className={cn("rounded-2xl border p-4 group hover:shadow-sm transition-all bg-card", stage.border)}>
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold text-foreground leading-snug flex-1">{entry.title}</p>
                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setEditingEntry(entry)}
                                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDelete(entry.id)}
                                className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-500">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          {entry.content && (
                            <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-2">{entry.content}</p>
                          )}
                          <div className="flex items-center gap-3 mt-3 flex-wrap">
                            {!!entry.metadata?.goal && (
                              <span className="text-[11px] text-muted-foreground">🎯 {String(entry.metadata.goal)}</span>
                            )}
                            {!!entry.metadata?.result && (
                              <span className={cn("text-[11px] font-semibold", stage.color)}>
                                📊 {String(entry.metadata.result)}
                              </span>
                            )}
                            <span className="ml-auto text-[10px] text-muted-foreground/40 tabular-nums">{fmtRelative(entry.createdAt)}</span>
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOUNDER OS — REMAINING ADMIN TAB COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ResearchTab is now imported from @/components/workspace/ResearchTab
// — it renders the AI Research Assistant experience

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

// ContentIdeasTab is replaced by ContentIdeasKanbanTab above

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

// ExperimentsTab is replaced by ExperimentsLabTab above

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL KNOWLEDGE BASE SEARCH
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GlobalWorkspaceSearch ───────────────────────────────────────────────────

interface WorkspaceSearchResult {
  id: string;
  type: "note" | "task" | "goal" | "product";
  title: string;
  preview?: string;
  badge?: string;
  onClick: () => void;
}

const SEARCH_TYPE_META: Record<
  WorkspaceSearchResult["type"],
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  note:    { label: "Notes",    icon: StickyNote, color: "text-amber-500" },
  task:    { label: "Tasks",    icon: ListTodo,   color: "text-blue-500" },
  goal:    { label: "Goals",    icon: Target,     color: "text-green-500" },
  product: { label: "Products", icon: Package,    color: "text-purple-500" },
};

function GlobalWorkspaceSearch({
  onClose,
  onTabChange,
}: {
  onClose: () => void;
  onTabChange: (tab: WorkspaceTab) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<{ id: string; title: string; status: string }[]>([]);

  // Load local data once on mount (component mounts fresh each time modal opens)
  const [localNotes] = useState<Note[]>(() => {
    try { return JSON.parse(localStorage.getItem("cf_notes") ?? "[]") as Note[]; } catch { return []; }
  });
  const [localTodos] = useState<Todo[]>(() => {
    try { return JSON.parse(localStorage.getItem("cf_todos") ?? "[]") as Todo[]; } catch { return []; }
  });
  const [localGoals] = useState<Goal[]>(() => {
    try { return JSON.parse(localStorage.getItem("cf_goals") ?? "[]") as Goal[]; } catch { return []; }
  });

  useEffect(() => {
    inputRef.current?.focus();
    fetch("/api/products")
      .then(r => r.ok ? r.json() : { products: [] })
      .then((data: { products?: { id: string; title: string; status: string }[] }) =>
        setProducts(data.products ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const q = query.trim().toLowerCase();

  const results: WorkspaceSearchResult[] = useMemo(() => {
    const res: WorkspaceSearchResult[] = [];

    // Notes — search title + body
    localNotes
      .filter(n => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
      .slice(0, 5)
      .forEach(n => {
        const bodyPreview = n.body.replace(/[#*`>\[\]_]/g, "").trim().slice(0, 80);
        res.push({
          id: n.id, type: "note",
          title: n.title || "Untitled Note",
          preview: bodyPreview || undefined,
          badge: n.tag,
          onClick: () => {
            try { sessionStorage.setItem("cf_open_note", n.id); } catch {}
            onTabChange("notes");
            onClose();
          },
        });
      });

    // Tasks — active only, search text
    localTodos
      .filter(t => !t.completed && (!q || t.text.toLowerCase().includes(q)))
      .slice(0, 5)
      .forEach(t => res.push({
        id: t.id, type: "task",
        title: t.text,
        badge: t.priority,
        onClick: () => { onTabChange("todos"); onClose(); },
      }));

    // Goals
    localGoals
      .filter(g => !q || g.label.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach(g => res.push({
        id: g.id, type: "goal",
        title: g.label,
        preview: `${g.current} / ${g.target} ${g.unit}`,
        onClick: () => { onTabChange("goals"); onClose(); },
      }));

    // Products
    products
      .filter(p => !q || p.title.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach(p => res.push({
        id: p.id, type: "product",
        title: p.title,
        badge: p.status,
        onClick: () => { router.push("/dashboard/library"); onClose(); },
      }));

    return res;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, localNotes, localTodos, localGoals, products]);

  // Group by type in a fixed display order
  const typeOrder: WorkspaceSearchResult["type"][] = ["note", "task", "goal", "product"];
  const groups = results.reduce<Partial<Record<WorkspaceSearchResult["type"], WorkspaceSearchResult[]>>>(
    (acc, r) => { (acc[r.type] ??= []).push(r); return acc; },
    {}
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-background border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search notes, tasks, goals, products…"
            className="flex-1 text-sm bg-transparent focus:outline-none text-foreground placeholder:text-muted-foreground"
          />
          <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[62vh] overflow-y-auto">
          {results.length === 0 ? (
            <div className="py-12 text-center">
              <Search className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {q ? `No results for "${query}"` : "Start typing to search your workspace…"}
              </p>
              {!q && (localNotes.length + localTodos.length + localGoals.length === 0) && (
                <p className="text-xs text-muted-foreground/60 mt-1">Add notes, tasks, and goals to get started</p>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {typeOrder
                .filter(type => groups[type] && groups[type]!.length > 0)
                .map(type => {
                  const meta = SEARCH_TYPE_META[type];
                  const Icon = meta.icon;
                  const items = groups[type]!;
                  return (
                    <div key={type}>
                      {/* Section header */}
                      <div className="flex items-center gap-2 px-2 py-1.5 mb-0.5">
                        <Icon className={cn("w-3 h-3", meta.color)} />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          {meta.label}
                        </span>
                        <span className="ml-auto text-[10px] text-muted-foreground">{items.length}</span>
                      </div>

                      {/* Items */}
                      <div className="space-y-0.5">
                        {items.map(result => (
                          <button
                            key={result.id}
                            onClick={result.onClick}
                            className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-accent transition-colors text-left group"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground group-hover:text-orange-500 transition-colors truncate">
                                {result.title}
                              </p>
                              {result.preview && (
                                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                  {result.preview}
                                </p>
                              )}
                            </div>
                            {result.badge && (
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full shrink-0 capitalize mt-0.5">
                                {result.badge}
                              </span>
                            )}
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-orange-400 shrink-0 mt-0.5 transition-colors" />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground/50">
          <span>↵ Open</span>
          <span>Esc Close</span>
          <span className="ml-auto">{results.length} result{results.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  );
}

// ─── GlobalKBSearch ───────────────────────────────────────────────────────────

interface GlobalKBSearchProps {
  onClose: () => void;
  onTabChange: (tab: WorkspaceTab) => void;
}

function GlobalKBSearch({ onClose, onTabChange }: GlobalKBSearchProps) {
  const [query, setQuery] = useState("");
  const [allEntries, setAllEntries] = useState<FounderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    fetch("/api/founder-workspace")
      .then(r => r.ok ? r.json() : [])
      .then((data: FounderEntry[]) => setAllEntries(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Keyboard: Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const results = q.length < 1
    ? allEntries
    : allEntries.filter(e => {
        const tags = ((e.metadata?.tags as string[] | undefined) ?? []).join(" ");
        return (
          e.title.toLowerCase().includes(q) ||
          e.content.toLowerCase().includes(q) ||
          tags.includes(q)
        );
      });

  // Group by category
  const grouped = results.reduce<Record<string, FounderEntry[]>>((acc, e) => {
    (acc[e.category] ??= []).push(e);
    return acc;
  }, {});
  const cats = Object.keys(grouped);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-background border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search your knowledge base…"
            className="flex-1 text-sm bg-transparent focus:outline-none text-foreground placeholder:text-muted-foreground"
          />
          <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[62vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />Loading knowledge base…
            </div>
          ) : cats.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {q.length >= 1 ? `No entries matching "${query}"` : "Your knowledge base is empty — add entries in any tab"}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {cats.map(cat => {
                const info = CATEGORY_LABELS[cat];
                const CatIcon = info?.icon ?? BookOpen;
                const catEntries = grouped[cat];
                return (
                  <div key={cat}>
                    {/* Section header */}
                    <div className="flex items-center gap-2 px-2 py-1.5 mb-0.5">
                      <CatIcon className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                        {info?.label ?? cat}
                      </span>
                      <span className="ml-auto text-[10px] text-muted-foreground">{catEntries.length}</span>
                    </div>

                    {/* Entries */}
                    {catEntries.slice(0, 5).map(entry => {
                      const entryTags = (entry.metadata?.tags as string[] | undefined) ?? [];
                      const isPinned = (entry.metadata?.pinned as boolean) ?? false;
                      return (
                        <button
                          key={entry.id}
                          onClick={() => { onTabChange(cat as WorkspaceTab); onClose(); }}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {isPinned && <Pin className="w-2.5 h-2.5 text-orange-500 fill-current shrink-0" />}
                            <span className="text-sm font-medium text-foreground truncate">{entry.title}</span>
                            {entryTags.length > 0 && (
                              <div className="flex items-center gap-1 ml-auto shrink-0">
                                {entryTags.slice(0, 2).map(t => (
                                  <span key={t} className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-muted text-muted-foreground">{t}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          {entry.content && (
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{entry.content}</p>
                          )}
                        </button>
                      );
                    })}

                    {catEntries.length > 5 && (
                      <button
                        onClick={() => { onTabChange(cat as WorkspaceTab); onClose(); }}
                        className="w-full px-3 py-1 text-[11px] text-orange-500 hover:underline text-left"
                      >
                        +{catEntries.length - 5} more in {info?.label ?? cat} →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">{results.length} {results.length === 1 ? "entry" : "entries"} across all sections</span>
          <span className="text-[10px] text-muted-foreground">Click to jump to section</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function WorkspacePage() {
  const isAdmin = useWorkspaceAdmin();
  const [tab, setTab] = useState<WorkspaceTab>("dashboard");
  const [searchOpen, setSearchOpen] = useState(false);    // Global workspace search (all users)
  const [kbSearchOpen, setKbSearchOpen] = useState(false); // KB search (admins only)
  const [todoCount, setTodoCount] = useState(0);

  // Keep tab badge count fresh whenever the user switches tabs
  useEffect(() => {
    try {
      const raw = localStorage.getItem("cf_todos");
      const arr = raw ? (JSON.parse(raw) as { completed: boolean }[]) : [];
      setTodoCount(arr.filter(t => !t.completed).length);
    } catch {}
  }, [tab]);

  const tabDesc: Record<WorkspaceTab, string> = {
    dashboard:            "Your execution hub — tasks, goals, projects and AI recommendations",
    todos:                "Stay on top of your daily content tasks",
    notes:                "Capture ideas, scripts, and notes",
    calendar:             "Plan and schedule your content drops",
    goals:                "Track revenue, growth, and product targets",
    "research":           "AI Business Analyst — discover opportunities, understand markets, take action",
    "memory":             "Your personal AI memory — everything the platform has learned about your business",
    "founder-os":         "Your internal OS — the memory and intelligence layer for Content Flywheel",
    "marketing-psychology": "Psychological triggers and buyer behavior principles",
    "copywriting":        "Headline formulas, frameworks, and reusable copy templates",
    "content-ideas":      "Hooks, angles, scripts, and viral content formats",
    "analytics":          "What's working, what's not, and key metric learnings",
    "distribution":       "Channels, partnerships, and traffic source strategies",
    "experiments":        "Hypotheses, active tests, and documented results",
  };

  // Cmd+K / Ctrl+K — global workspace search for all users
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(v => !v); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="p-6 max-w-none">
      {/* Global Workspace Search — all users */}
      {searchOpen && (
        <GlobalWorkspaceSearch
          onClose={() => setSearchOpen(false)}
          onTabChange={t => { setTab(t); setSearchOpen(false); }}
        />
      )}
      {/* Knowledge Base Search — admins only */}
      {kbSearchOpen && isAdmin && (
        <GlobalKBSearch
          onClose={() => setKbSearchOpen(false)}
          onTabChange={t => { setTab(t); setKbSearchOpen(false); }}
        />
      )}

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isAdmin ? "Founder OS" : "Workspace"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{tabDesc[tab]}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:border-orange-500/40 hover:text-foreground transition-all bg-background"
          >
            <Search className="w-3.5 h-3.5" />
            Search workspace
            <kbd className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-muted">⌘K</kbd>
          </button>
          {isAdmin && (
            <button
              onClick={() => setKbSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:border-orange-500/40 hover:text-foreground transition-all bg-background"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Knowledge Base
            </button>
          )}
        </div>
      </div>

      {/* Tab nav */}
      <div className="border-b border-border mb-6 overflow-x-auto">
        <div className="flex gap-1">
          {/* Standard tabs */}
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap -mb-px",
                tab === t.id ? "border-orange-500 text-orange-500" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border")}>
              {t.icon}
              {t.label}
              {t.id === "todos" && todoCount > 0 && (
                <span className={cn(
                  "text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none tabular-nums",
                  tab === "todos" ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground"
                )}>
                  {todoCount > 99 ? "99+" : todoCount}
                </span>
              )}
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
      {tab === "dashboard" && <WorkspaceDashboard onTabChange={setTab} />}
      {tab === "todos"    && <TodoTab />}
      {tab === "notes"    && <NotesTab onTabChange={setTab} />}
      {tab === "calendar" && <CalendarTab />}
      {tab === "goals"    && <GoalsTab />}

      {tab === "research" && <ResearchTab onTabChange={(t: string) => setTab(t as WorkspaceTab)} />}
      {tab === "memory"   && <UserMemoryTab />}

      {/* Admin-only tab content */}
      {isAdmin && tab === "founder-os"             && <FounderOSOverview onTabChange={setTab} />}
      {isAdmin && tab === "marketing-psychology"  && <MarketingPsychologyTab />}
      {isAdmin && tab === "copywriting"           && <CopywritingTab />}
      {isAdmin && tab === "content-ideas"         && <ContentIdeasKanbanTab />}
      {isAdmin && tab === "analytics"             && <AnalyticsTab />}
      {isAdmin && tab === "distribution"          && <DistributionTab />}
      {isAdmin && tab === "experiments"           && <ExperimentsLabTab />}
    </div>
  );
}
