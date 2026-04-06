"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Target,
  Plus,
  Loader2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Flame,
  Trash2,
  ClipboardList,
  ShieldCheck,
  MoreVertical,
  Pencil,
  Pause,
  Play,
  Trophy,
  Download,
  Archive,
  ExternalLink,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import CreateGoalDialog from "./CreateGoalDialog";
import { ProofModal } from "./[id]/ProofModal";

type Goal = {
  id: string;
  title: string;
  description?: string;
  targetDate: string;
  totalDays: number;
  currentDay: number;
  status: string;
  streakCount: number;
  longestStreak: number;
  createdAt: string;
  updatedAt?: string;
};

type UpcomingTask = {
  id: string;
  taskDescription: string;
  estimatedDuration?: number;
  isCompleted: boolean;
  dayNumber: number;
  proofRequired?: boolean;
  proofSubmittedAt?: string | null;
  taskType?: string;
  appLink?: string | null;
  category?: string | null;
};

type TasksByGoalId = Record<
  string,
  { today: UpcomingTask[]; tomorrow: UpcomingTask[]; completedDays?: number[] }
>;

export default function GoalsFlow() {
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasksByGoalId, setTasksByGoalId] = useState<TasksByGoalId>({});
  const [loading, setLoading] = useState(true);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [createGoalOpen, setCreateGoalOpen] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [archivingGoalId, setArchivingGoalId] = useState<string | null>(null);
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);
  const [regeneratingGoalId, setRegeneratingGoalId] = useState<string | null>(null);
  const [goalToEdit, setGoalToEdit] = useState<Goal | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);
  const [proofModalTask, setProofModalTask] = useState<{ goal: Goal; task: UpcomingTask } | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const dailyScheduleRef = useRef<HTMLDivElement>(null);
  const activeSectionRef = useRef<HTMLDivElement>(null);
  const bestStreakCardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const fetchGoals = async (skipAutoAdvance = false) => {
    setLoading(true);
    try {
      const res = await fetch("/api/goals/dashboard");
      if (!res.ok) throw new Error("Failed to load goals");
      const data = await res.json();
      const fetchedGoals: Goal[] = data.goals ?? [];
      setGoals(fetchedGoals);
      setTasksByGoalId(data.tasksByGoalId ?? {});

      // Auto-advance goals that haven't been updated today (after 2am grace period)
      if (!skipAutoAdvance) {
        const now = new Date();
        const todayStr = now.toLocaleDateString("en-CA"); // YYYY-MM-DD local
        const isAfterGrace = now.getHours() >= 2;
        if (isAfterGrace) {
          const stale = fetchedGoals.filter((g) => {
            if (g.status !== "active" || g.currentDay >= g.totalDays) return false;
            const lastUpdated = new Date(g.updatedAt ?? g.createdAt);
            return lastUpdated.toLocaleDateString("en-CA") < todayStr;
          });
          if (stale.length > 0) {
            await Promise.all(
              stale.map((g) => fetch(`/api/goals/${g.id}/advance-past-grace`, { method: "POST" }))
            );
            // Re-fetch with skipAutoAdvance to avoid infinite loop
            void fetchGoals(true);
            return;
          }
        }
      }
    } catch {
      setGoals([]);
      setTasksByGoalId({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const activeGoals = goals.filter((g) => g.status === "active" || g.status === "paused");
  const completedGoals = goals.filter((g) => g.status === "completed");

  const overallStats = {
    activeCount: activeGoals.length,
    bestStreak: goals.length > 0 ? Math.max(...goals.map((g) => g.longestStreak), 0) : 0,
    totalDaysCompleted: activeGoals.reduce((sum, g) => sum + Math.max(0, g.currentDay - 1), 0),
    totalDaysAllTime:
      activeGoals.reduce((sum, g) => sum + Math.max(0, g.currentDay - 1), 0) +
      completedGoals.reduce((sum, g) => sum + g.totalDays, 0),
    thisWeekLabel: "—",
    totalTodayTasks: activeGoals.reduce(
      (sum, g) => sum + (tasksByGoalId[g.id]?.today.length ?? 0),
      0
    ),
    completedToday: activeGoals.reduce(
      (sum, g) =>
        sum + (tasksByGoalId[g.id]?.today.filter((t) => t.isCompleted).length ?? 0),
      0
    ),
  };

  const goalWithBestStreak =
    activeGoals.length > 0
      ? [...activeGoals].sort((a, b) => b.longestStreak - a.longestStreak)[0]
      : null;

  const sortedActiveGoals = [...activeGoals].sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const activeOnlyForToday = activeGoals.filter((g) => g.status === "active");
  const upcomingTasksFlat = activeOnlyForToday.flatMap((goal) => {
    const tasks = tasksByGoalId[goal.id];
    if (!tasks) return [];
    const today = (tasks.today ?? []).map((t) => ({ ...t, goal, dayLabel: "Today" as const }));
    const tomorrow = (tasks.tomorrow ?? []).map((t) => ({ ...t, goal, dayLabel: "Tomorrow" as const }));
    return [...today, ...tomorrow];
  });

  if (loading) {
    return (
      <main className="p-6 md:p-10 max-w-5xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-orange-500 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </Link>
        <div className="py-16 flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading goals...</p>
        </div>
      </main>
    );
  }

  const handleCreateGoalSuccess = (goalId: string) => {
    fetchGoals();
    router.push(`/dashboard/goals/${goalId}`);
  };

  const handleDeleteGoal = async () => {
    if (!goalToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/goals/${goalToDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setGoalToDelete(null);
      fetchGoals();
      toast({ title: "Goal deleted" });
    } catch {
      toast({ title: "Could not delete goal", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleArchiveGoal = async (goal: Goal) => {
    setArchivingGoalId(goal.id);
    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      if (!res.ok) throw new Error("Failed to archive");
      fetchGoals();
      toast({ title: "Goal archived", description: "It’s been moved out of the completed list." });
    } catch {
      toast({ title: "Could not archive goal", variant: "destructive" });
    } finally {
      setArchivingGoalId(null);
    }
  };

  const handleDownloadReport = async (goalId: string) => {
    setDownloadingReportId(goalId);
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
      setDownloadingReportId(null);
    }
  };

  const handleRegenerateTasks = async (goal: Goal) => {
    setRegeneratingGoalId(goal.id);
    try {
      const res = await fetch(`/api/goals/${goal.id}/regenerate-tasks`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to regenerate");
      fetchGoals();
      toast({ title: "Tasks regenerated!", description: `${data.inserted ?? 0} new tasks created for remaining days.` });
    } catch (e) {
      toast({ title: "Could not regenerate tasks", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setRegeneratingGoalId(null);
    }
  };

  const openEditModal = (goal: Goal) => {
    setGoalToEdit(goal);
    setEditTitle(goal.title);
    setEditDescription(goal.description ?? "");
  };

  const handleSaveEdit = async () => {
    if (!goalToEdit || !editTitle.trim()) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/goals/${goalToEdit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim(), description: editDescription.trim() || null }),
      });
      if (!res.ok) throw new Error("Failed to update");
      fetchGoals();
      setGoalToEdit(null);
      toast({ title: "Goal updated" });
    } catch {
      toast({ title: "Could not update goal", variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleTodayTask = (goal: Goal, task: UpcomingTask, currentCompleted: boolean) => {
    if (task.proofRequired && !task.proofSubmittedAt && currentCompleted === false) {
      setProofModalTask({ goal, task });
      return;
    }
    setUpdatingTaskId(task.id);
    fetch(`/api/goals/${goal.id}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCompleted: !currentCompleted }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to update");
        fetchGoals();
      })
      .catch(() => toast({ title: "Could not update task", variant: "destructive" }))
      .finally(() => setUpdatingTaskId(null));
  };

  const handleProofSubmitFromCombined = async (payload: {
    proofType: "screenshot" | "text" | "link" | "file";
    proofUrl?: string | null;
    proofText?: string | null;
    proofValidationStatus?: "validated" | "validation_skipped";
  }) => {
    if (!proofModalTask) return;
    setUpdatingTaskId(proofModalTask.task.id);
    try {
      const res = await fetch(
        `/api/goals/${proofModalTask.goal.id}/tasks/${proofModalTask.task.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isCompleted: true,
            proofType: payload.proofType,
            proofUrl: payload.proofUrl ?? null,
            proofText: payload.proofText ?? null,
            proofValidationStatus: payload.proofValidationStatus ?? null,
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to submit proof");
      setProofModalTask(null);
      fetchGoals();
      toast({ title: "Proof accepted! Task complete ✓" });
    } catch {
      toast({ title: "Could not submit proof", variant: "destructive" });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // STATE 1: Empty state – landing with dark theme (same as library)
  if (goals.length === 0) {
    return (
      <main className="min-h-screen bg-[#F9FAFB] dark:bg-[#0F0F0F] text-gray-900 dark:text-white">
        <CreateGoalDialog
          open={createGoalOpen}
          onOpenChange={setCreateGoalOpen}
          onSuccess={handleCreateGoalSuccess}
        />
        <div className="p-6 md:p-10 max-w-4xl mx-auto">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-orange-500 dark:hover:text-orange-400 mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </Link>

          {/* Hero – center-aligned */}
          <section className="text-center py-16 md:py-24">
            <h1 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
              Set Goals. Stay Accountable. Build Consistently.
            </h1>
            <p className="text-gray-600 dark:text-slate-400 text-lg md:text-xl max-w-xl mx-auto mb-10">
              Break big targets into daily actions. Track progress with proof. Never skip a day.
            </p>
            <Button
              size="lg"
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2 text-base px-8 py-6 h-auto rounded-lg"
              onClick={() => setCreateGoalOpen(true)}
            >
              <Target className="w-5 h-5" />
              Create Your First Goal
            </Button>
          </section>

          {/* Icon grid visual */}
          <section className="flex justify-center gap-6 py-8 md:py-12">
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-gray-200 dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 text-orange-500 dark:text-orange-400">
              <ClipboardList className="w-7 h-7" />
            </div>
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-gray-200 dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 text-orange-500 dark:text-orange-400">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-gray-200 dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 text-orange-500 dark:text-orange-400">
              <Flame className="w-7 h-7" />
            </div>
          </section>

          {/* Benefit cards */}
          <section className="grid gap-4 sm:grid-cols-3 mt-8 md:mt-12 pb-16">
            <Card className="border-[#E5E7EB] dark:border-slate-800 bg-white dark:bg-slate-900/50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <ClipboardList className="w-5 h-5 text-orange-400 shrink-0" />
                  <CardTitle className="text-base text-gray-900 dark:text-white">
                    Daily Tasks
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  AI breaks goals into actionable daily steps
                </p>
              </CardContent>
            </Card>
            <Card className="border-[#E5E7EB] dark:border-slate-800 bg-white dark:bg-slate-900/50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-5 h-5 text-orange-400 shrink-0" />
                  <CardTitle className="text-base text-gray-900 dark:text-white">
                    Proof Required
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  Submit evidence of completion — no cheating
                </p>
              </CardContent>
            </Card>
            <Card className="border-[#E5E7EB] dark:border-slate-800 bg-white dark:bg-slate-900/50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="w-5 h-5 text-orange-400 shrink-0" />
                  <CardTitle className="text-base text-gray-900 dark:text-white">
                    Streak Tracking
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  Build momentum with consecutive days
                </p>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    );
  }

  // STATE 2: Has goals
  const handlePauseResume = async (goal: Goal) => {
    const nextStatus = goal.status === "paused" ? "active" : "paused";
    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Failed to update");
      fetchGoals();
      toast({ title: nextStatus === "paused" ? "Goal paused" : "Goal resumed" });
    } catch {
      toast({ title: "Could not update goal", variant: "destructive" });
    }
  };

  return (
    <main className="p-6 md:p-10 max-w-5xl mx-auto">
      <CreateGoalDialog
        open={createGoalOpen}
        onOpenChange={setCreateGoalOpen}
        onSuccess={handleCreateGoalSuccess}
      />
      {proofModalTask && (
        <ProofModal
          open={!!proofModalTask}
          onOpenChange={(open) => !open && setProofModalTask(null)}
          taskDescription={proofModalTask.task.taskDescription}
          taskType={proofModalTask.task.taskType as "external" | "app_action" | undefined}
          category={proofModalTask.task.category}
          appLink={proofModalTask.task.appLink}
          onSubmit={handleProofSubmitFromCombined}
        />
      )}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-orange-500 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </Link>

      {/* Header: title + stats row + New Goal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Goal Tracker
          </h1>
          {activeGoals.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-slate-600 dark:text-slate-400">
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {overallStats.activeCount} active goal{overallStats.activeCount !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-orange-500" />
                Longest streak: {overallStats.bestStreak} days
              </span>
              <span>
                {overallStats.totalDaysCompleted} days completed this month
              </span>
            </div>
          )}
        </div>
        <Button
          className="bg-orange-500 hover:bg-orange-600 text-white gap-2 shrink-0"
          onClick={() => setCreateGoalOpen(true)}
        >
          <Plus className="w-4 h-4" />
          New Goal
        </Button>
      </div>

      {/* Stats widget – 4 metric cards */}
      {goals.length > 0 && (
        <TooltipProvider>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => activeSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
                  className="flex flex-col items-start gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-orange-500" />
                    Active Goals
                  </span>
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {overallStats.activeCount}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                You have {overallStats.activeCount} goal{overallStats.activeCount !== 1 ? "s" : ""} in progress
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => bestStreakCardRef.current?.scrollIntoView({ behavior: "smooth" })}
                  className="flex flex-col items-start gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-orange-500" />
                    Best Streak
                  </span>
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {overallStats.bestStreak} days
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                Your longest unbroken streak across all goals
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="flex flex-col items-start gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-default"
                >
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Total Days
                  </span>
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {overallStats.totalDaysAllTime} days
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                Cumulative completed days all-time
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => toast({ title: "Coming soon", description: "Week view will show days completed this week (Mon–Sun)." })}
                  className="flex flex-col items-start gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-orange-500" />
                    This Week
                  </span>
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {overallStats.thisWeekLabel}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                Days completed this week (Mon–Sun)
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      )}

      {activeGoals.length > 0 ? (
        <>
          {(() => {
            const goalsWithToday = activeOnlyForToday.filter(
              (g) => (tasksByGoalId[g.id]?.today?.length ?? 0) > 0
            );
            const showCombinedToday = goalsWithToday.length >= 2;
            const todayCombinedTotalMinutes = showCombinedToday
              ? goalsWithToday.reduce(
                  (sum, g) =>
                    sum +
                    (tasksByGoalId[g.id]?.today ?? []).reduce(
                      (s, t) => s + (t.estimatedDuration ?? 0),
                      0
                    ),
                  0
                )
              : 0;
            const totalHours =
              todayCombinedTotalMinutes < 60
                ? `${todayCombinedTotalMinutes} min`
                : `${(todayCombinedTotalMinutes / 60).toFixed(1)} hours`;
            return showCombinedToday ? (
              <Card className="mb-8 border-slate-200 dark:border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
                    TODAY&apos;S TASKS ACROSS ALL GOALS ({totalHours} total)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-0">
                  {goalsWithToday.map((goal) => {
                    const tasks = tasksByGoalId[goal.id]?.today ?? [];
                    return (
                      <div key={goal.id} className="space-y-2">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {goal.title} (Day {goal.currentDay}/{goal.totalDays})
                        </p>
                        <ul className="space-y-1.5">
                          {tasks.map((task) => {
                            const duration =
                              task.estimatedDuration != null && task.estimatedDuration > 0
                                ? ` (${task.estimatedDuration}min)`
                                : "";
                            const isUpdating = updatingTaskId === task.id;
                            return (
                              <li
                                key={task.id}
                                className="flex items-center gap-3 text-sm"
                              >
                                <Checkbox
                                  checked={task.isCompleted}
                                  onCheckedChange={() =>
                                    handleToggleTodayTask(goal, task, task.isCompleted)
                                  }
                                  disabled={isUpdating}
                                  className="rounded border-2 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                                />
                                <span
                                  className={
                                    task.isCompleted
                                      ? "text-slate-500 dark:text-slate-400 line-through"
                                      : "text-slate-800 dark:text-slate-200"
                                  }
                                >
                                  {task.taskDescription}
                                  {duration}
                                  {task.isCompleted && " ✓"}
                                </span>
                                {isUpdating && (
                                  <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                  <div className="pt-2">
                    <Button variant="link" className="px-0 text-orange-600 dark:text-orange-400 h-auto" asChild>
                      <Link href="/dashboard/goals/today">
                        View Full Daily Schedule →
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null;
          })()}

          <div ref={activeSectionRef} className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mb-8">
            {sortedActiveGoals.map((goal) => {
              const progressPct =
                goal.totalDays > 0 ? Math.min(100, Math.round((goal.currentDay / goal.totalDays) * 100)) : 0;
              const todayTasks = tasksByGoalId[goal.id]?.today ?? [];
              const todayComplete = todayTasks.filter((t) => t.isCompleted).length;
              const isBestStreakGoal = goalWithBestStreak?.id === goal.id;
              return (
                <div key={goal.id} ref={isBestStreakGoal ? bestStreakCardRef : undefined}>
                <Card
                  className="border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-slate-900 dark:text-white truncate">
                      {goal.title}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      Day {goal.currentDay} of {goal.totalDays}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col gap-4 pt-0">
                    <div>
                      <Progress value={progressPct} className="h-2 bg-slate-200 dark:bg-slate-700" />
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                        {progressPct}%
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                      <Flame className="w-4 h-4 text-orange-500 shrink-0" />
                      {goal.streakCount}-day streak
                    </div>
                    {/* Streak heatmap — last 30 days */}
                    {(() => {
                      const completedSet = new Set(tasksByGoalId[goal.id]?.completedDays ?? []);
                      const totalShown = Math.min(goal.totalDays, 30);
                      const startDay = Math.max(1, goal.currentDay - totalShown + 1);
                      const days = Array.from({ length: goal.currentDay - startDay + 1 }, (_, i) => startDay + i);
                      if (days.length === 0) return null;
                      return (
                        <div className="flex flex-wrap gap-[3px]">
                          {days.map((d) => (
                            <TooltipProvider key={d} delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`w-3 h-3 rounded-sm ${
                                      completedSet.has(d)
                                        ? "bg-orange-500"
                                        : d < goal.currentDay
                                        ? "bg-slate-200 dark:bg-slate-700"
                                        : "bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600"
                                    }`}
                                  />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  Day {d} {completedSet.has(d) ? "✓ Done" : d < goal.currentDay ? "Missed" : "Today"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                        </div>
                      );
                    })()}
                    {todayTasks.length > 0 && (
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        TODAY: {todayComplete}/{todayTasks.length} tasks complete
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-auto pt-2">
                      <Button variant="default" size="sm" className="flex-1 bg-orange-500 hover:bg-orange-600" asChild>
                        <Link href={`/dashboard/goals/${goal.id}`}>
                          Continue Today
                        </Link>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label="Goal menu">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/goals/${goal.id}/progress`}>
                              <BarChart3 className="w-4 h-4 mr-2" />
                              View Progress
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditModal(goal)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit Goal
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleRegenerateTasks(goal)}
                            disabled={regeneratingGoalId === goal.id || goal.status === "completed"}
                          >
                            {regeneratingGoalId === goal.id
                              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              : <RefreshCw className="w-4 h-4 mr-2" />}
                            Regenerate Tasks
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handlePauseResume(goal)}>
                            {goal.status === "paused" ? (
                              <><Play className="w-4 h-4 mr-2" /> Resume</>
                            ) : (
                              <><Pause className="w-4 h-4 mr-2" /> Pause Goal</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                            onClick={() => {
                              setGoalToDelete(goal);
                              setDeleteConfirmChecked(false);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Goal
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
                </div>
              );
            })}
          </div>

          {upcomingTasksFlat.length > 0 && (
            <div ref={dailyScheduleRef}>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Upcoming tasks
              </h2>
              <Card className="border-slate-200 dark:border-slate-700 mb-12">
                <CardContent className="p-0">
                  <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                    {upcomingTasksFlat.slice(0, 15).map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm ${t.isCompleted ? "text-slate-500 dark:text-slate-400 line-through" : "text-slate-800 dark:text-slate-200"}`}>
                            {t.taskDescription}
                            {t.estimatedDuration != null && t.estimatedDuration > 0 && (
                              <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">
                                ({t.estimatedDuration}min)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {t.goal.title} • {t.dayLabel}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/goals/${t.goal.id}`}>
                            Continue
                          </Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {upcomingTasksFlat.length > 15 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 px-4 py-2 border-t border-slate-200 dark:border-slate-700">
                      +{upcomingTasksFlat.length - 15} more — open a goal to see all
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      ) : (
        <Card className="border-slate-200 dark:border-slate-800 mb-12">
          <CardContent className="py-8 text-center">
            <p className="text-slate-600 dark:text-slate-400 mb-4">No active goals right now.</p>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
              onClick={() => setCreateGoalOpen(true)}
            >
              <Plus className="w-4 h-4" />
              New Goal
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={!!goalToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setGoalToDelete(null);
            setDeleteConfirmChecked(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {goalToDelete?.title ?? "goal"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all tasks and proof. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center space-x-2 py-3">
            <Checkbox
              id="delete-confirm"
              checked={deleteConfirmChecked}
              onCheckedChange={(checked) => setDeleteConfirmChecked(checked === true)}
            />
            <Label htmlFor="delete-confirm" className="text-sm font-normal cursor-pointer">
              I understand this is permanent
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteGoal();
              }}
              disabled={deleting || !deleteConfirmChecked}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete Goal"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!goalToEdit} onOpenChange={(open) => !open && setGoalToEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-goal-title">Title</Label>
              <Input
                id="edit-goal-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Goal title"
                className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-goal-desc">Description (optional)</Label>
              <Textarea
                id="edit-goal-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="What do you want to achieve?"
                rows={3}
                className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGoalToEdit(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={savingEdit || !editTitle.trim()}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {completedGoals.length > 0 && (
        <Collapsible open={completedOpen} onOpenChange={setCompletedOpen} className="mt-8">
          <Card className="border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors rounded-lg">
                <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  Completed Goals ({completedGoals.length})
                </span>
                {completedOpen ? (
                  <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 p-4 pt-0 border-t border-slate-200 dark:border-slate-700">
                {completedGoals.map((goal) => {
                  const progressPct =
                    goal.totalDays > 0 ? Math.min(100, Math.round((goal.currentDay / goal.totalDays) * 100)) : 100;
                  const completedDate = goal.targetDate
                    ? new Date(goal.targetDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : null;
                  const isDownloading = downloadingReportId === goal.id;
                  const isArchiving = archivingGoalId === goal.id;
                  return (
                    <Card
                      key={goal.id}
                      className="border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/50"
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base text-slate-600 dark:text-slate-400 truncate flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                          {goal.title}
                        </CardTitle>
                        {completedDate && (
                          <CardDescription className="text-sm text-slate-500 dark:text-slate-500">
                            Completed {completedDate}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-3 pt-0">
                        <div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {goal.currentDay}/{goal.totalDays} days • {progressPct}%
                          </p>
                          <Progress value={progressPct} className="h-2 mt-1 bg-slate-200 dark:bg-slate-700" />
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-500 flex items-center gap-1.5">
                          <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                          {goal.longestStreak}-day streak achieved
                        </p>
                        <div className="flex flex-wrap gap-2 pt-2">
                          <Button variant="outline" size="sm" className="gap-1.5" asChild>
                            <Link href={`/dashboard/goals/${goal.id}`}>
                              <ExternalLink className="w-3.5 h-3.5" />
                              View Details
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => handleDownloadReport(goal.id)}
                            disabled={isDownloading}
                          >
                            {isDownloading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            Download Report
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                            onClick={() => handleArchiveGoal(goal)}
                            disabled={isArchiving}
                          >
                            {isArchiving ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Archive className="w-3.5 h-3.5" />
                            )}
                            Archive
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </main>
  );
}
