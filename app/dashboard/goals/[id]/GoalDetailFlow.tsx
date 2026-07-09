"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Flame, Lock, Loader2, CheckCircle2, ChevronRight, ExternalLink, Download, Share2, Trophy, Calendar, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  CATEGORY_CONFIG,
  formatCategoryDuration,
  TASK_CATEGORIES,
} from "@/lib/goals/categories";
import { ProofModal } from "./ProofModal";
import { TaskAIPanel } from "@/components/goals/TaskAIPanel";

type Goal = {
  id: string;
  title: string;
  targetDate?: string;
  totalDays: number;
  currentDay: number;
  streakCount: number;
  longestStreak: number;
  status: string;
  hasSkipToken?: boolean;
  startDate?: string;
};

type Task = {
  id: string;
  dayNumber: number;
  taskDescription: string;
  estimatedDuration?: number;
  howToComplete?: string;
  isCompleted: boolean;
  orderIndex?: number;
  taskType?: "external" | "app_action";
  appLink?: string;
  appLabel?: string;
  category?: string | null;
  proofRequired?: boolean;
  proofType?: string | null;
  proofUrl?: string | null;
  proofText?: string | null;
  proofSubmittedAt?: string | null;
  completedAt?: string | null;
};

function formatRelativeTime(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString();
}

function proofTypeLabel(proofType: string | null | undefined): string {
  switch (proofType) {
    case "screenshot":
    case "file":
      return "📸 Screenshot submitted";
    case "link":
      return "🔗 Link submitted";
    case "text":
      return "📝 Text submitted";
    default:
      return "Proof submitted";
  }
}

function parseWhereAndWhat(howToComplete: string): { where?: string; what?: string } {
  const out: { where?: string; what?: string } = {};
  howToComplete.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    const whereMatch = trimmed.match(/^Where:\s*(.+)/i);
    if (whereMatch) out.where = whereMatch[1].trim();
    const whatMatch = trimmed.match(/^(What|What you'll have):\s*(.+)/i);
    if (whatMatch) out.what = whatMatch[2].trim();
  });
  return out;
}

function formatHowToComplete(text: string): React.ReactNode {
  return text.split(/\r?\n/).map((line, i) => {
    const trimmed = line.trim();
    const match = trimmed.match(/^(How|What|Where|What you'll have):\s*(.*)/i);
    if (match) {
      return (
        <span key={i} className="block mt-1 first:mt-0">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {match[1]}:
          </span>{" "}
          {match[2]}
        </span>
      );
    }
    return (
      <span key={i} className="block mt-1 first:mt-0">
        {trimmed || "\u00A0"}
      </span>
    );
  });
}

function formatTodayTime(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hrs}hr ${mins}min` : `${hrs}hr`;
}

function BlockProgressBar({
  value,
  blocks = 20,
  filledClassName = "bg-orange-500",
  emptyClassName = "bg-slate-200 dark:bg-slate-700",
}: {
  value: number;
  blocks?: number;
  filledClassName?: string;
  emptyClassName?: string;
}) {
  const pct = Math.min(100, Math.max(0, value));
  const filled = Math.round((pct / 100) * blocks);
  return (
    <div className="flex gap-0.5" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      {Array.from({ length: blocks }, (_, i) => (
        <div
          key={i}
          className={`h-2 w-full max-w-[8px] rounded-sm flex-1 ${i < filled ? filledClassName : emptyClassName}`}
        />
      ))}
    </div>
  );
}

type GoalDetailFlowProps = {
  goalId: string;
  initialGoal?: Goal | null;
  initialTasks?: Task[];
};

export default function GoalDetailFlow({ goalId, initialGoal = null, initialTasks }: GoalDetailFlowProps) {
  const [mounted, setMounted] = useState(false);
  const [goal, setGoal] = useState<Goal | null>(initialGoal ?? null);
  const [tasks, setTasks] = useState<Task[]>(initialTasks ?? []);
  const [loading, setLoading] = useState(!initialGoal);
  const [completing, setCompleting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [completedStreak, setCompletedStreak] = useState(0);
  const [justCompleted, setJustCompleted] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [expandedHowTo, setExpandedHowTo] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [proofModalTaskId, setProofModalTaskId] = useState<string | null>(null);
  const [viewProofTask, setViewProofTask] = useState<Task | null>(null);
  const [aiPanelTaskId, setAiPanelTaskId] = useState<string | null>(null);
  const [skippingDay, setSkippingDay] = useState(false);
  const { toast } = useToast();

  const fetchGoal = useCallback(async (isRetry = false) => {
    if (!goalId || goalId === "undefined" || goalId === "null") {
      setGoal(null);
      setTasks([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/goals/${goalId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 404 && !isRetry) {
          // Retry once after a short delay (e.g. goal just created, auth/session propagation)
          await new Promise((r) => setTimeout(r, 600));
          await fetchGoal(true);
          return;
        }
        console.error("[GoalDetailFlow] Failed to load goal", { goalId, status: res.status, error: data.error });
        setGoal(null);
        setTasks([]);
        setLoading(false);
        return;
      }
      setGoal(data.goal);
      setTasks(data.tasks ?? []);
    } catch (err) {
      console.error("[GoalDetailFlow] Fetch error", { goalId, err });
      setGoal(null);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [goalId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!initialGoal) fetchGoal();
  }, [fetchGoal, initialGoal]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchGoal();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [fetchGoal]);

  const graceCheckDoneRef = React.useRef(false);
  useEffect(() => {
    graceCheckDoneRef.current = false;
  }, [goalId]);
  useEffect(() => {
    if (!goal?.startDate || !goal?.currentDay || goal.status === "completed" || graceCheckDoneRef.current) return;
    const start = new Date(goal.startDate + "T00:00:00");
    const currentDayDate = new Date(start);
    currentDayDate.setDate(start.getDate() + goal.currentDay - 1);
    const now = new Date();
    const userToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentDayDateOnly = new Date(currentDayDate.getFullYear(), currentDayDate.getMonth(), currentDayDate.getDate());
    if (userToday <= currentDayDateOnly) return;
    const twoAM = new Date(userToday);
    twoAM.setHours(2, 0, 0, 0);
    if (now < twoAM) return;
    graceCheckDoneRef.current = true;
    fetch(`/api/goals/${goalId}/advance-past-grace`, { method: "POST" })
      .then((r) => { if (r.ok) fetchGoal(); })
      .catch(() => {});
  }, [goal?.id, goal?.startDate, goal?.currentDay, goal?.status, goalId, fetchGoal]);

  const updateTaskCompleted = async (taskId: string, isCompleted: boolean) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task?.proofRequired && !task.proofSubmittedAt && isCompleted) {
      setProofModalTaskId(taskId);
      return;
    }
    setUpdatingTaskId(taskId);
    try {
      const res = await fetch(`/api/goals/${goalId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted }),
      });
      if (!res.ok) throw new Error("Failed to update task");
      const updated = await res.json();
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t))
      );
    } catch {
      toast({ title: "Could not update task", variant: "destructive" });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const submitProofAndComplete = async (
    taskId: string,
    payload: { proofType: "screenshot" | "text" | "link" | "file"; proofUrl?: string | null; proofText?: string | null; proofValidationStatus?: "validated" | "validation_skipped" }
  ) => {
    setUpdatingTaskId(taskId);
    try {
      const res = await fetch(`/api/goals/${goalId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isCompleted: true,
          proofType: payload.proofType,
          proofUrl: payload.proofUrl ?? null,
          proofText: payload.proofText ?? null,
          proofValidationStatus: payload.proofValidationStatus ?? null,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit proof");
      const updated = await res.json();
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t))
      );
      setProofModalTaskId(null);
      toast({ title: "Proof accepted! Task complete ✓" });
    } catch {
      toast({ title: "Could not submit proof", variant: "destructive" });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const todayTasks = goal
    ? tasks.filter((t) => t.dayNumber === goal.currentDay)
    : [];
  const tomorrowTasks = goal
    ? tasks.filter((t) => t.dayNumber === goal.currentDay + 1)
    : [];
  const allTodayComplete =
    todayTasks.length > 0 &&
    todayTasks.every((t) => {
      if (!t.isCompleted) return false;
      if (t.proofRequired && !t.proofSubmittedAt) return false;
      return true;
    });
  const todayMinutes = todayTasks.reduce(
    (sum, t) => sum + (t.estimatedDuration ?? 0),
    0
  );
  const progressPct =
    goal && goal.totalDays > 0
      ? Math.min(100, ((goal.currentDay - 1) / goal.totalDays) * 100)
      : 0;
  const isComplete = goal?.status === "completed" || (goal && goal.currentDay > goal.totalDays);

  const todayByCategory = React.useMemo(() => {
    const map: Record<string, { tasks: Task[]; totalMinutes: number }> = {};
    for (const t of todayTasks) {
      const cat = t.category && (TASK_CATEGORIES as readonly string[]).includes(t.category) ? t.category : "other";
      if (!map[cat]) map[cat] = { tasks: [], totalMinutes: 0 };
      map[cat].tasks.push(t);
      map[cat].totalMinutes += t.estimatedDuration ?? 0;
    }
    return map;
  }, [todayTasks]);

  const todayFocusParts = React.useMemo(() => {
    const order = [...TASK_CATEGORIES, "other"] as const;
    return order
      .filter((cat) => todayByCategory[cat] && todayByCategory[cat].totalMinutes > 0)
      .map((cat) => {
        const cfg = cat === "other" ? null : CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG];
        const { totalMinutes } = todayByCategory[cat];
        const label = cfg ? `${cfg.emoji} ${cfg.shortLabel}` : "Other";
        return `${label} (${formatCategoryDuration(totalMinutes)})`;
      });
  }, [todayByCategory]);

  const categoryDisplayOrder = [...TASK_CATEGORIES, "other"];

  const categoriesWithTasksToday = React.useMemo(
    () =>
      categoryDisplayOrder.filter((cat) => (todayByCategory[cat]?.tasks.length ?? 0) > 0),
    [todayByCategory]
  );

  const tomorrowFocusParts = React.useMemo(() => {
    const order = [...TASK_CATEGORIES, "other"] as const;
    const seen = new Set<string>();
    const parts: string[] = [];
    for (const t of tomorrowTasks) {
      const cat = t.category && (TASK_CATEGORIES as readonly string[]).includes(t.category) ? t.category : "other";
      if (seen.has(cat)) continue;
      seen.add(cat);
      const cfg = cat === "other" ? null : CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG];
      parts.push(cfg ? `${cfg.emoji} ${cfg.shortLabel}` : "Other");
    }
    return parts;
  }, [tomorrowTasks]);

  const filteredCategoriesForDisplay = React.useMemo(() => {
    if (!categoryFilter) {
      return categoryDisplayOrder.filter((cat) => todayByCategory[cat]?.tasks.length);
    }
    return todayByCategory[categoryFilter]?.tasks.length
      ? [categoryFilter]
      : [];
  }, [categoryFilter, todayByCategory]);

  const visibleTaskCount =
    categoryFilter === null
      ? todayTasks.length
      : (todayByCategory[categoryFilter]?.tasks.length ?? 0);

  const weekDistribution = React.useMemo(() => {
    if (!goal?.targetDate || !goal.totalDays || tasks.length === 0) return null;
    const target = new Date(goal.targetDate);
    const startDate = new Date(target);
    startDate.setDate(target.getDate() - (goal.totalDays - 1));
    startDate.setHours(0, 0, 0, 0);
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekMonday = new Date(now);
    weekMonday.setDate(now.getDate() - daysFromMonday);
    weekMonday.setHours(0, 0, 0, 0);
    const weekSunday = new Date(weekMonday);
    weekSunday.setDate(weekMonday.getDate() + 6);
    weekSunday.setHours(23, 59, 59, 999);
    const dayNumbersInWeek: number[] = [];
    for (let d = 1; d <= goal.totalDays; d++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(startDate.getDate() + (d - 1));
      if (dayDate >= weekMonday && dayDate <= weekSunday) {
        dayNumbersInWeek.push(d);
      }
    }
    if (dayNumbersInWeek.length === 0) return null;
    const weekTasks = tasks.filter((t) => dayNumbersInWeek.includes(t.dayNumber));
    const byCategory: Record<string, number> = {};
    for (const t of weekTasks) {
      const cat = t.category && (TASK_CATEGORIES as readonly string[]).includes(t.category) ? t.category : "other";
      byCategory[cat] = (byCategory[cat] ?? 0) + (t.estimatedDuration ?? 0);
    }
    const totalMinutes = Object.values(byCategory).reduce((a, b) => a + b, 0);
    if (totalMinutes === 0) return null;
    const entries = Object.entries(byCategory)
      .map(([cat, mins]) => ({
        category: cat,
        minutes: mins,
        pct: Math.round((mins / totalMinutes) * 100),
        hoursLabel: (mins / 60).toFixed(1) + "hrs",
      }))
      .sort((a, b) => b.minutes - a.minutes);
    return { entries, totalMinutes };
  }, [goal?.targetDate, goal?.totalDays, tasks]);

  const [weekFocusOpen, setWeekFocusOpen] = useState(true);
  const [proofGalleryOpen, setProofGalleryOpen] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);

  const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

  const weeklyCalendarDays = React.useMemo(() => {
    if (!goal?.startDate || goal.status === "completed") return null;
    const startDateOnly = new Date(goal.startDate + "T12:00:00");
    const start = new Date(startDateOnly.getFullYear(), startDateOnly.getMonth(), startDateOnly.getDate());
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday);
    const msPerDay = 24 * 60 * 60 * 1000;
    return weekDayLabels.map((label, i) => {
      const date = new Date(weekMonday.getFullYear(), weekMonday.getMonth(), weekMonday.getDate() + i);
      const dayOffset = Math.round((date.getTime() - start.getTime()) / msPerDay);
      const goalDayNum = dayOffset + 1;
      const inRange = goalDayNum >= 1 && goalDayNum <= goal.totalDays;
      const dayTasks = inRange ? tasks.filter((t) => t.dayNumber === goalDayNum) : [];
      const isCompleted = inRange && goalDayNum < goal.currentDay;
      const isToday = inRange && goalDayNum === goal.currentDay;
      const isFuture = inRange && goalDayNum > goal.currentDay;
      return {
        label,
        date,
        goalDayNum: inRange ? goalDayNum : null,
        taskCount: dayTasks.length,
        isCompleted,
        isToday,
        isFuture,
      };
    });
  }, [goal?.startDate, goal?.totalDays, goal?.currentDay, goal?.status, tasks]);

  const proofsByDay = React.useMemo(() => {
    const withProof = tasks.filter((t) => t.proofSubmittedAt);
    if (withProof.length === 0) return [];
    const byDay: Record<number, Task[]> = {};
    for (const t of withProof) {
      if (!byDay[t.dayNumber]) byDay[t.dayNumber] = [];
      byDay[t.dayNumber].push(t);
    }
    return Object.entries(byDay)
      .map(([day, list]) => ({ day: Number(day), tasks: list }))
      .sort((a, b) => a.day - b.day);
  }, [tasks]);

  const handleCompleteDay = async () => {
    if (!goal || !allTodayComplete) return;
    setCompleting(true);
    try {
      const res = await fetch(`/api/goals/${goalId}/complete-day`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to complete day");
      setCompletedStreak(data.streakCount ?? goal.streakCount + 1);
      setJustCompleted(data.completed === true);
      setShowSuccess(true);
      await fetchGoal();
      setTimeout(() => setShowSuccess(false), 2500);
    } catch {
      toast({ title: "Could not complete day", variant: "destructive" });
    } finally {
      setCompleting(false);
    }
  };

  const handleSkipDay = async () => {
    if (!goal || !goal.hasSkipToken) return;
    setSkippingDay(true);
    try {
      const res = await fetch(`/api/goals/${goalId}/skip-day`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to skip day");
      await fetchGoal();
      toast({ title: "Day skipped", description: "Streak preserved. 1 skip per week — resets Monday." });
    } catch {
      toast({ title: "Could not skip day", variant: "destructive" });
    } finally {
      setSkippingDay(false);
    }
  };

  const completedTaskCount = tasks.filter((t) => t.isCompleted).length;
  const totalTaskCount = tasks.length;

  const handleDownloadReport = async () => {
    setDownloadingReport(true);
    try {
      const res = await fetch(`/api/goals/${goalId}/progress-report`);
      if (!res.ok) throw new Error("Failed to generate report");
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="?([^";]+)"?/);
      const name = match?.[1] ?? `goal-${goalId}-progress-report.html`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Report downloaded", description: "Open the file to view or print to PDF." });
    } catch {
      toast({ title: "Could not download report", variant: "destructive" });
    } finally {
      setDownloadingReport(false);
    }
  };

  const handleShareAchievement = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `I completed ${goal?.totalDays ?? 0}/${goal?.totalDays ?? 0} days on "${goal?.title ?? "my goal"}"! 🎉`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Goal completed on Content Flywheel",
          text,
          url,
        });
        toast({ title: "Shared!", description: "Thanks for sharing your achievement." });
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          copyFallback(url, text);
        }
      }
    } else {
      copyFallback(url, text);
    }
  };

  function copyFallback(url: string, text: string) {
    const str = `${text}\n${url}`;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(str).then(
        () => toast({ title: "Link copied", description: "Paste anywhere to share your achievement." }),
        () => toast({ title: "Could not copy", variant: "destructive" })
      );
    } else {
      toast({ title: "Share", description: str, variant: "default" });
    }
  }

  const now = new Date();
  const localHour = now.getHours();
  const inGraceWindow = mounted ? localHour < 2 : false;

  if (loading) {
    return (
      <main className="p-6 md:p-10 max-w-2xl mx-auto">
        <Link
          href="/dashboard/goals"
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-orange-500 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Goal Tracker
        </Link>
        <div className="py-16 flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading goal...</p>
        </div>
      </main>
    );
  }

  if (!goal) {
    return (
      <main className="p-6 md:p-10 max-w-2xl mx-auto">
        <Link
          href="/dashboard/goals"
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-orange-500 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Goal Tracker
        </Link>
        <p className="text-slate-600 dark:text-slate-400">Goal not found.</p>
      </main>
    );
  }

  if (!mounted) {
    return (
      <main className="p-6 md:p-10 max-w-2xl mx-auto">
        <Link
          href="/dashboard/goals"
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-orange-500 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Goal Tracker
        </Link>
        <div className="py-16 flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading goal...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 md:p-10 max-w-2xl mx-auto">
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-xl text-center max-w-sm mx-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4"
              >
                <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
              </motion.div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                Day complete! 🎉
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                {justCompleted
                  ? "You finished this goal. Great work!"
                  : `🔥 ${completedStreak}-day streak. See you tomorrow!`}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {proofModalTaskId && (() => {
        const task = tasks.find((t) => t.id === proofModalTaskId);
        if (!task) return null;
        return (
          <ProofModal
            open={!!proofModalTaskId}
            onOpenChange={(open) => !open && setProofModalTaskId(null)}
            taskDescription={task.taskDescription}
            taskType={task.taskType}
            category={task.category}
            appLink={task.appLink}
            onSubmit={(payload) =>
              submitProofAndComplete(proofModalTaskId, payload)
            }
          />
        );
      })()}

      <Dialog open={!!viewProofTask} onOpenChange={(open) => !open && setViewProofTask(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Proof</DialogTitle>
            {viewProofTask && (
              <p className="text-sm text-slate-600 dark:text-slate-400 font-normal">
                {viewProofTask.taskDescription}
              </p>
            )}
          </DialogHeader>
          {viewProofTask && (
            <div className="space-y-3">
              {viewProofTask.proofType === "screenshot" && viewProofTask.proofUrl && (
                <div className="rounded-lg border overflow-hidden bg-slate-50 dark:bg-slate-900/50">
                  <img
                    src={viewProofTask.proofUrl}
                    alt="Proof"
                    className="max-h-80 w-full object-contain"
                  />
                </div>
              )}
              {viewProofTask.proofType === "link" && viewProofTask.proofUrl && (
                <a
                  href={viewProofTask.proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-orange-600 dark:text-orange-400 hover:underline break-all"
                >
                  {viewProofTask.proofUrl}
                </a>
              )}
              {viewProofTask.proofType === "text" && viewProofTask.proofText && (
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {viewProofTask.proofText}
                </p>
              )}
              {viewProofTask.proofSubmittedAt && (
                <p className="text-xs text-slate-500 dark:text-slate-400" suppressHydrationWarning>
                  Submitted {new Date(viewProofTask.proofSubmittedAt).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Link
        href="/dashboard/goals"
        className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-orange-500 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Goal Tracker
      </Link>

      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
          {goal.title}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
          <span>Day {goal.currentDay} of {goal.totalDays}</span>
          <span className="flex items-center gap-1">
            <Flame className="w-4 h-4 text-orange-500" />
            {goal.streakCount}-day streak
          </span>
          <Link
            href={`/dashboard/goals/${goalId}/progress`}
            className="text-orange-600 dark:text-orange-400 hover:underline"
          >
            View All Progress
          </Link>
          <Link
            href={`/dashboard/goals/${goalId}/review`}
            className="text-orange-600 dark:text-orange-400 hover:underline"
          >
            Review This Week&apos;s Progress
          </Link>
          <Link
            href={`/dashboard/goals/${goalId}/review`}
            className="text-orange-600 dark:text-orange-400 hover:underline"
          >
            Review This Week&apos;s Progress
          </Link>
        </div>
      </header>

      {/* Weekly calendar view - 7 days at once */}
      {!isComplete && weeklyCalendarDays && (
        <div className="mb-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50">
            <Calendar className="w-4 h-4 text-orange-500 shrink-0" />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">This week</span>
          </div>
          <div className="grid grid-cols-7 gap-0">
            {weeklyCalendarDays.map((d) => (
              <div
                key={d.label}
                className={`flex flex-col items-center justify-center min-h-[72px] p-2 border-r border-slate-100 dark:border-slate-800 last:border-r-0 ${
                  d.isToday
                    ? "bg-orange-50 dark:bg-orange-950/30 border-t-2 border-t-orange-500"
                    : d.isCompleted
                      ? "bg-green-50/80 dark:bg-green-950/20"
                      : d.goalDayNum != null
                        ? "bg-slate-50/50 dark:bg-slate-800/30"
                        : "bg-slate-50/30 dark:bg-slate-900/20"
                }`}
              >
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{d.label}</span>
                {d.goalDayNum != null ? (
                  <>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      Day {d.goalDayNum}
                    </span>
                    {d.isCompleted && (
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-1 shrink-0" />
                    )}
                    {d.isToday && (
                      <span className="text-xs font-medium text-orange-600 dark:text-orange-400 mt-1">Today</span>
                    )}
                    {d.isFuture && d.taskCount > 0 && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">{d.taskCount} task{d.taskCount !== 1 ? "s" : ""}</span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500 mt-1">—</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress - block style */}
      {!isComplete && goal && (
        <div className="mb-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 px-4 py-4">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Overall Progress: Day {goal.currentDay}/{goal.totalDays} • {Math.round(progressPct)}%
              </p>
              <BlockProgressBar value={progressPct} blocks={20} filledClassName="bg-orange-500" />
            </div>
            {todayTasks.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Today&apos;s Progress: {todayTasks.filter((t) => t.isCompleted).length}/{todayTasks.length} tasks ({Math.round((todayTasks.filter((t) => t.isCompleted).length / todayTasks.length) * 100)}%)
                </p>
                <BlockProgressBar
                  value={(todayTasks.filter((t) => t.isCompleted).length / todayTasks.length) * 100}
                  blocks={16}
                  filledClassName={
                    todayTasks.every((t) => t.isCompleted) ? "bg-green-500" : "bg-orange-500"
                  }
                />
              </div>
            )}
          </div>
        </div>
      )}

      {!isComplete && todayTasks.length > 0 && inGraceWindow && !allTodayComplete && (
        <div className="mb-6 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Grace period:</strong> You have until 2:00 AM to complete today&apos;s tasks and keep your streak.
          </p>
        </div>
      )}

      {weekDistribution && (
        <Collapsible
          open={weekFocusOpen}
          onOpenChange={setWeekFocusOpen}
          className="mb-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30"
        >
          <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/30 rounded-lg transition-colors">
            <span>This Week&apos;s Focus</span>
            <ChevronRight
              className={`w-4 h-4 shrink-0 transition-transform ${weekFocusOpen ? "rotate-90" : ""}`}
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 pt-0">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                THIS WEEK&apos;S DISTRIBUTION — time per category (updates as you complete tasks)
              </p>
              <div className="space-y-3">
                {weekDistribution.entries.map(({ category, pct, hoursLabel }) => {
                  const cfg = category === "other" ? null : CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG];
                  const label = cfg ? `${cfg.emoji} ${cfg.label}` : "Other";
                  return (
                    <div key={category} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 text-sm text-slate-700 dark:text-slate-300">
                        {label}
                      </span>
                      <div className="flex-1 h-5 min-w-0 rounded bg-slate-200 dark:bg-slate-700 overflow-hidden flex">
                        <div
                          className="h-full rounded bg-orange-500 dark:bg-orange-500 transition-all duration-300"
                          style={{ width: `${pct}%`, minWidth: pct > 0 ? "4px" : 0 }}
                        />
                      </div>
                      <span className="w-24 shrink-0 text-right text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                        {pct}% ({hoursLabel})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {isComplete ? (
        <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="bg-gradient-to-b from-green-50 to-white dark:from-green-950/30 dark:to-slate-900 px-6 pt-8 pb-6 text-center">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mx-auto mb-4"
            >
              <Trophy className="w-10 h-10 text-green-600 dark:text-green-400" />
            </motion.div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
              You did it!
            </h2>
            <p className="text-lg font-semibold text-green-700 dark:text-green-300 mb-4">
              You completed {goal.totalDays}/{goal.totalDays} days
            </p>
            <p className="text-slate-600 dark:text-slate-400 text-sm max-w-sm mx-auto">
              {goal.title}
            </p>
          </div>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 py-3 px-4">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{goal.longestStreak}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Best streak (days)</p>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 py-3 px-4">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{completedTaskCount}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Tasks completed</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Button
                className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 gap-2"
                size="lg"
                onClick={handleDownloadReport}
                disabled={downloadingReport}
              >
                {downloadingReport ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download progress report
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2"
                size="lg"
                onClick={handleShareAchievement}
              >
                <Share2 className="w-4 h-4" />
                Share achievement
              </Button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              The report includes all tasks and proofs. Open the file in a browser and use Print → Save as PDF if you want a PDF.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="mb-6">
            {todayFocusParts.length > 0 && (
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                TODAY&apos;S FOCUS: {todayFocusParts.join(" • ")}
              </p>
            )}
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
              TODAY&apos;S TASKS ({formatTodayTime(todayMinutes)})
            </h2>
            {todayTasks.length > 0 && (
              <>
                <div className="flex flex-col gap-3 mt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCategoryFilter(null)}
                      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        categoryFilter === null
                          ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      }`}
                    >
                      All
                    </button>
                    {categoriesWithTasksToday.map((cat) => {
                      const cfg = cat === "other" ? null : CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG];
                      const label = cfg ? `${cfg.emoji} ${cfg.shortLabel}` : "Other";
                      const active = categoryFilter === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategoryFilter(cat)}
                          className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                            active
                              ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <Select
                    value={categoryFilter ?? "all"}
                    onValueChange={(v) => setCategoryFilter(v === "all" ? null : v)}
                  >
                    <SelectTrigger className="w-[180px] h-9 text-xs">
                      <SelectValue placeholder="Show all" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Show all</SelectItem>
                      {(TASK_CATEGORIES as readonly string[]).concat("other").map((cat) => {
                        const cfg = cat === "other" ? null : CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG];
                        const label = cfg ? `${cfg.emoji} ${cfg.shortLabel}` : "Other";
                        return (
                          <SelectItem key={cat} value={cat}>
                            {label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                {categoryFilter !== null && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    {visibleTaskCount} of {todayTasks.length} tasks visible
                  </p>
                )}
              </>
            )}
            <div className="space-y-4 mt-4">
              {filteredCategoriesForDisplay
                .map((cat) => {
                  const { tasks: catTasks, totalMinutes } = todayByCategory[cat];
                  const cfg = cat === "other" ? null : CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG];
                  const headerLabel = cfg ? `${cfg.emoji} ${cfg.label.toUpperCase()}` : "OTHER";
                  const sectionExpanded = !expandedCategories.has(cat);
                  return (
                    <Collapsible
                      key={cat}
                      open={sectionExpanded}
                      onOpenChange={(open) =>
                        setExpandedCategories((prev) => {
                          const next = new Set(prev);
                          if (open) next.delete(cat);
                          else next.add(cat);
                          return next;
                        })
                      }
                    >
                      <CollapsibleTrigger className="flex items-center justify-between w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-3 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50">
                        <span className="flex items-center gap-2">
                          <span className="text-slate-400 dark:text-slate-500 font-normal">
                            ━━━
                          </span>
                          {headerLabel} ({formatCategoryDuration(totalMinutes)})
                          <span className="text-slate-400 dark:text-slate-500 font-normal">
                            ━━━
                          </span>
                        </span>
                        <ChevronRight
                          className={`w-4 h-4 shrink-0 transition-transform ${sectionExpanded ? "rotate-90" : ""}`}
                        />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="space-y-3 mt-3 pl-1">
                          {catTasks.map((task) => {
                            const { where, what } = task.howToComplete
                              ? parseWhereAndWhat(task.howToComplete)
                              : { where: undefined, what: undefined };
                            const isAppTask = task.taskType === "app_action" && task.appLink;
                            const taskCatConfig = task.category ? CATEGORY_CONFIG[task.category as keyof typeof CATEGORY_CONFIG] : null;
                            return (
                              <Card
                                key={task.id}
                                className={
                                  isAppTask
                                    ? "border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/20"
                                    : "border-slate-200 dark:border-slate-800"
                                }
                              >
                                <CardContent className="py-4">
                                  <div className="flex items-start gap-4">
                                    <Checkbox
                                      checked={task.isCompleted}
                                      onCheckedChange={(checked) =>
                                        updateTaskCompleted(task.id, !!checked)
                                      }
                                      disabled={updatingTaskId === task.id}
                                      className="h-5 w-5 shrink-0 mt-0.5 rounded border-2 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                                    />
                                    <div className="flex-1 min-w-0 space-y-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span
                                          className={`text-base font-medium ${task.isCompleted ? "text-slate-500 dark:text-slate-400 line-through" : "text-slate-900 dark:text-white"}`}
                                        >
                                          {task.taskDescription}
                                          {task.isCompleted && " ✓"}
                                        </span>
                                        {task.estimatedDuration != null && task.estimatedDuration > 0 && (
                                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                            {task.estimatedDuration}min
                                          </span>
                                        )}
                                        {taskCatConfig && (
                                          <span
                                            className={`text-xs font-medium px-2 py-0.5 rounded ${taskCatConfig.badgeClass}`}
                                          >
                                            {taskCatConfig.emoji} {taskCatConfig.label}
                                          </span>
                                        )}
                                        {isAppTask && (
                                          <span className="text-xs font-medium text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/40 px-2 py-0.5 rounded">
                                            📱 Use Content Flywheel
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-slate-500 dark:text-slate-400" suppressHydrationWarning>
                                        {task.isCompleted
                                          ? `Completed ${formatRelativeTime(task.completedAt || task.proofSubmittedAt || undefined)}`
                                          : "External task"}
                                      </p>
                                      {task.proofRequired && !task.isCompleted && !task.proofSubmittedAt && (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="gap-1.5"
                                          onClick={() => setProofModalTaskId(task.id)}
                                          disabled={updatingTaskId === task.id}
                                        >
                                          Submit Proof to Complete
                                        </Button>
                                      )}
                                      {task.proofRequired && task.isCompleted && task.proofSubmittedAt && (
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="text-xs text-slate-600 dark:text-slate-300">
                                            {proofTypeLabel(task.proofType)}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => setViewProofTask(task)}
                                            className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline"
                                          >
                                            [View Proof]
                                          </button>
                                        </div>
                                      )}
                                      {isAppTask && task.appLink && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="gap-1.5 border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40"
                                          asChild
                                        >
                                          <a
                                            href={task.appLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={() => {
                                              if (!task.isCompleted) {
                                                updateTaskCompleted(task.id, true);
                                              }
                                            }}
                                          >
                                            <ExternalLink className="w-4 h-4" />
                                            {task.appLabel || "Open in App"}
                                          </a>
                                        </Button>
                                      )}
                                      {(where || what) && (
                                        <div className="flex flex-wrap gap-2">
                                          {where && (
                                            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-md">
                                              Where: {where}
                                            </span>
                                          )}
                                          {what && (
                                            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-md">
                                              What: {what}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {task.howToComplete && (
                                        <Collapsible
                                          open={expandedHowTo.has(task.id)}
                                          onOpenChange={(open) =>
                                            setExpandedHowTo((prev) => {
                                              const next = new Set(prev);
                                              if (open) next.add(task.id);
                                              else next.delete(task.id);
                                              return next;
                                            })
                                          }
                                        >
                                          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 w-fit">
                                            <ChevronRight
                                              className={`w-3 h-3 transition-transform ${expandedHowTo.has(task.id) ? "rotate-90" : ""}`}
                                            />
                                            How to complete
                                          </CollapsibleTrigger>
                                          <CollapsibleContent>
                                            <div className="text-xs text-slate-600 dark:text-slate-400 pl-4 border-l border-slate-200 dark:border-slate-700 mt-2 space-y-0.5">
                                              {formatHowToComplete(task.howToComplete)}
                                            </div>
                                          </CollapsibleContent>
                                        </Collapsible>
                                      )}
                                      {!task.isCompleted && (
                                        <button
                                          type="button"
                                          onClick={() => setAiPanelTaskId(task.id)}
                                          className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-500 hover:text-orange-400 transition-colors mt-1 w-fit"
                                        >
                                          <Sparkles className="w-3 h-3" />
                                          Need help?
                                        </button>
                                      )}
                                    </div>
                                    {updatingTaskId === task.id && (
                                      <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              {categoryFilter !== null && visibleTaskCount === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
                  No tasks in this category for today. Try &quot;All&quot; or another filter.
                </p>
              )}
              {categoryFilter === null && categoryDisplayOrder.every((cat) => !todayByCategory[cat]?.tasks.length) && (
                <div className="space-y-4">
                  {todayTasks.map((task) => {
                    const { where, what } = task.howToComplete
                      ? parseWhereAndWhat(task.howToComplete)
                      : { where: undefined, what: undefined };
                    const isAppTask = task.taskType === "app_action" && task.appLink;
                    const taskCatConfig = task.category ? CATEGORY_CONFIG[task.category as keyof typeof CATEGORY_CONFIG] : null;
                    return (
                      <Card
                        key={task.id}
                        className={
                          isAppTask
                            ? "border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/20"
                            : "border-slate-200 dark:border-slate-800"
                        }
                      >
                        <CardContent className="py-4">
                          <div className="flex items-start gap-4">
                            <Checkbox
                              checked={task.isCompleted}
                              onCheckedChange={(checked) =>
                                updateTaskCompleted(task.id, !!checked)
                              }
                              disabled={updatingTaskId === task.id}
                              className="h-5 w-5 shrink-0 mt-0.5 rounded border-2 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                            />
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`text-base font-medium ${task.isCompleted ? "text-slate-500 dark:text-slate-400 line-through" : "text-slate-900 dark:text-white"}`}
                                >
                                  {task.taskDescription}
                                  {task.isCompleted && " ✓"}
                                </span>
                                {task.estimatedDuration != null && task.estimatedDuration > 0 && (
                                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                    {task.estimatedDuration}min
                                  </span>
                                )}
                                {taskCatConfig && (
                                  <span
                                    className={`text-xs font-medium px-2 py-0.5 rounded ${taskCatConfig.badgeClass}`}
                                  >
                                    {taskCatConfig.emoji} {taskCatConfig.label}
                                  </span>
                                )}
                                {isAppTask && (
                                  <span className="text-xs font-medium text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/40 px-2 py-0.5 rounded">
                                    📱 Use Content Flywheel
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400" suppressHydrationWarning>
                                {task.isCompleted
                                  ? `Completed ${formatRelativeTime(task.completedAt || task.proofSubmittedAt || undefined)}`
                                  : "External task"}
                              </p>
                              {task.proofRequired && !task.isCompleted && !task.proofSubmittedAt && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={() => setProofModalTaskId(task.id)}
                                  disabled={updatingTaskId === task.id}
                                >
                                  Submit Proof to Complete
                                </Button>
                              )}
                              {task.proofRequired && task.isCompleted && task.proofSubmittedAt && (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-slate-600 dark:text-slate-300">
                                    {proofTypeLabel(task.proofType)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setViewProofTask(task)}
                                    className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline"
                                  >
                                    [View Proof]
                                  </button>
                                </div>
                              )}
                              {isAppTask && task.appLink && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40"
                                  asChild
                                >
                                  <a
                                    href={task.appLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => {
                                      if (!task.isCompleted) {
                                        updateTaskCompleted(task.id, true);
                                      }
                                    }}
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                    {task.appLabel || "Open in App"}
                                  </a>
                                </Button>
                              )}
                              {(where || what) && (
                                <div className="flex flex-wrap gap-2">
                                  {where && (
                                    <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-md">
                                      Where: {where}
                                    </span>
                                  )}
                                  {what && (
                                    <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-md">
                                      What: {what}
                                    </span>
                                  )}
                                </div>
                              )}
                              {task.howToComplete && (
                                <Collapsible
                                  open={expandedHowTo.has(task.id)}
                                  onOpenChange={(open) =>
                                    setExpandedHowTo((prev) => {
                                      const next = new Set(prev);
                                      if (open) next.add(task.id);
                                      else next.delete(task.id);
                                      return next;
                                    })
                                  }
                                >
                                  <CollapsibleTrigger className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 w-fit">
                                    <ChevronRight
                                      className={`w-3 h-3 transition-transform ${expandedHowTo.has(task.id) ? "rotate-90" : ""}`}
                                    />
                                    How to complete
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <div className="text-xs text-slate-600 dark:text-slate-400 pl-4 border-l border-slate-200 dark:border-slate-700 mt-2 space-y-0.5">
                                      {formatHowToComplete(task.howToComplete)}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              )}
                              {!task.isCompleted && (
                                <button
                                  type="button"
                                  onClick={() => setAiPanelTaskId(task.id)}
                                  className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-500 hover:text-orange-400 transition-colors mt-1 w-fit"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  Need help?
                                </button>
                              )}
                            </div>
                            {updatingTaskId === task.id && (
                              <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {allTodayComplete && todayTasks.length > 0 && (
            <div className="mb-6 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 text-center">
              <p className="text-lg font-semibold text-green-800 dark:text-green-200">
                Day complete! 🎉
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Tap below to advance and unlock tomorrow.
              </p>
            </div>
          )}

          {tomorrowTasks.length > 0 && (
            <section className="mb-8">
              {tomorrowFocusParts.length > 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 shrink-0" />
                  TOMORROW: {tomorrowFocusParts.join(" • ")}
                </p>
              )}
              <h2 className="text-lg font-semibold text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                TOMORROW (locked until today complete)
              </h2>
              <div className="relative">
                <div className="absolute inset-0 bg-slate-900/20 dark:bg-slate-950/40 rounded-lg pointer-events-none flex items-center justify-center z-10">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400 bg-white/90 dark:bg-slate-800/90 px-4 py-2 rounded-full shadow">
                    Complete today first
                  </span>
                </div>
                <div className="space-y-2 blur-sm select-none">
                  {tomorrowTasks.map((task) => (
                    <Card
                      key={task.id}
                      className="border-slate-200 dark:border-slate-700 opacity-80"
                    >
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm text-slate-600 dark:text-slate-400">
                          {task.taskDescription}
                        </CardTitle>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>
            </section>
          )}

          <Collapsible
            open={proofGalleryOpen}
            onOpenChange={setProofGalleryOpen}
            className="mb-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30"
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/30 rounded-lg transition-colors">
              <span>View Progress</span>
              {proofsByDay.length > 0 && (
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  {tasks.filter((t) => t.proofSubmittedAt).length} proof{tasks.filter((t) => t.proofSubmittedAt).length === 1 ? "" : "s"}
                </span>
              )}
              <ChevronRight
                className={`w-4 h-4 shrink-0 transition-transform ${proofGalleryOpen ? "rotate-90" : ""}`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 pt-0">
                {proofsByDay.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 py-2">
                    No proofs submitted yet. Complete tasks with proof to see your timeline here.
                  </p>
                ) : (
                  <div className="space-y-6">
                    {proofsByDay.map(({ day, tasks: dayTasks }) => (
                      <div key={day}>
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                          Day {day}
                        </h3>
                        <div className="space-y-3">
                          {dayTasks.map((task) => (
                            <div
                              key={task.id}
                              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-3"
                            >
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                                {task.taskDescription}
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                {task.proofType === "screenshot" && task.proofUrl && (
                                  <button
                                    type="button"
                                    onClick={() => setViewProofTask(task)}
                                    className="rounded overflow-hidden border border-slate-200 dark:border-slate-700 hover:opacity-90"
                                  >
                                    <img
                                      src={task.proofUrl}
                                      alt="Proof"
                                      className="h-20 w-auto object-cover"
                                    />
                                  </button>
                                )}
                                {task.proofType === "link" && task.proofUrl && (
                                  <a
                                    href={task.proofUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-orange-600 dark:text-orange-400 hover:underline break-all"
                                  >
                                    {task.proofUrl}
                                  </a>
                                )}
                                {task.proofType === "text" && task.proofText && (
                                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                                    {task.proofText}
                                  </p>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setViewProofTask(task)}
                                  className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline"
                                >
                                  View full proof
                                </button>
                              </div>
                              {task.proofSubmittedAt && (
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1" suppressHydrationWarning>
                                  {new Date(task.proofSubmittedAt).toLocaleString()}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {goal.hasSkipToken && todayTasks.length > 0 && !allTodayComplete && (
            <div className="mb-4">
              <Button
                variant="outline"
                className="w-full border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                size="lg"
                disabled={skippingDay}
                onClick={handleSkipDay}
              >
                {skippingDay ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                Skip day (1 per week)
              </Button>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 text-center">
                Life happens — use your weekly skip to keep your streak without completing today.
              </p>
            </div>
          )}

          <Button
            className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 gap-2"
            size="lg"
            disabled={!allTodayComplete || completing || todayTasks.length === 0}
            onClick={handleCompleteDay}
          >
            {completing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Complete Day
          </Button>
        </>
      )}

      {/* AI Execution Coach panel */}
      {(() => {
        const aiTask = aiPanelTaskId ? tasks.find((t) => t.id === aiPanelTaskId) : null;
        if (!aiTask || !goal) return null;
        const todayCompleted = todayTasks.filter((t) => t.isCompleted).length;
        return (
          <TaskAIPanel
            open={!!aiPanelTaskId}
            onClose={() => setAiPanelTaskId(null)}
            task={aiTask}
            goal={goal}
            completedTaskCount={todayCompleted}
            totalTaskCount={todayTasks.length}
          />
        );
      })()}
    </main>
  );
}
