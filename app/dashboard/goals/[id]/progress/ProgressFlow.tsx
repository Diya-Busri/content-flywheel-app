"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { CATEGORY_CONFIG, TASK_CATEGORIES } from "@/lib/goals/categories";

type Goal = {
  id: string;
  title: string;
  targetDate?: string;
  totalDays: number;
  currentDay: number;
  status: string;
};

type Task = {
  id: string;
  dayNumber: number;
  taskDescription: string;
  estimatedDuration?: number;
  isCompleted: boolean;
  orderIndex?: number;
  category?: string | null;
  proofType?: string | null;
  proofUrl?: string | null;
  proofText?: string | null;
  proofSubmittedAt?: string | null;
};

function formatDayDate(targetDate: string, totalDays: number, dayNumber: number): string {
  const target = new Date(targetDate);
  const start = new Date(target);
  start.setDate(target.getDate() - (totalDays - 1));
  const d = new Date(start);
  d.setDate(start.getDate() + (dayNumber - 1));
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatProofTime(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  return new Date(isoDate).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function textPreview(text: string | null | undefined, maxLen: number): string {
  if (!text || !text.trim()) return "";
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen) + "...";
}

export default function ProgressFlow({ goalId }: { goalId: string }) {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/goals/${goalId}`);
      if (!res.ok) throw new Error("Failed to load goal");
      const data = await res.json();
      setGoal(data.goal);
      setTasks(data.tasks ?? []);
    } catch {
      setGoal(null);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [goalId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <main className="p-6 md:p-10 max-w-2xl mx-auto">
        <Link
          href={`/dashboard/goals/${goalId}`}
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-orange-500 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Goal
        </Link>
        <div className="py-16 flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading progress...</p>
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

  const targetDate = goal.targetDate ?? "";
  const totalDays = goal.totalDays;
  const currentDay = goal.currentDay;

  const daysWithTasks: { dayNumber: number; tasks: Task[] }[] = [];
  for (let d = 1; d <= currentDay; d++) {
    const dayTasks = tasks
      .filter((t) => t.dayNumber === d)
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    if (dayTasks.length > 0) daysWithTasks.push({ dayNumber: d, tasks: dayTasks });
  }

  return (
    <main className="p-6 md:p-10 max-w-2xl mx-auto">
      <Link
        href={`/dashboard/goals/${goalId}`}
        className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-orange-500 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Goal
      </Link>

      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
          {goal.title}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Progress timeline • Day {currentDay} of {totalDays}
        </p>
      </header>

      {daysWithTasks.length === 0 ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-6 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            No completed days yet. Complete tasks and submit proof to see your progress here.
          </p>
        </div>
      ) : (
        <div className="space-y-0">
          {daysWithTasks.map(({ dayNumber, tasks: dayTasks }) => {
            const allComplete = dayTasks.every((t) => t.isCompleted);
            const completedCount = dayTasks.filter((t) => t.isCompleted).length;
            const pendingCount = dayTasks.length - completedCount;
            const dayLabel =
              dayNumber === currentDay && !allComplete
                ? "In Progress"
                : allComplete
                  ? "✓ Complete"
                  : "In Progress";

            return (
              <section
                key={dayNumber}
                className="border-t border-slate-200 dark:border-slate-700 first:border-t-0 pt-6 first:pt-0 pb-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                    DAY {dayNumber} — {formatDayDate(targetDate, totalDays, dayNumber)}{" "}
                    {dayLabel}
                  </h2>
                  {allComplete && (
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  )}
                </div>

                <div className="space-y-4 pl-0">
                  {dayTasks.map((task) => {
                    const cfg =
                      task.category && (TASK_CATEGORIES as readonly string[]).includes(task.category)
                        ? CATEGORY_CONFIG[task.category as keyof typeof CATEGORY_CONFIG]
                        : null;
                    const emoji = cfg ? cfg.emoji : "•";
                    const hasProof = !!task.proofSubmittedAt;

                    return (
                      <div
                        key={task.id}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-slate-400 dark:text-slate-500 mt-0.5">
                            {task.isCompleted ? "☑" : "☐"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-medium ${
                                task.isCompleted
                                  ? "text-slate-700 dark:text-slate-300"
                                  : "text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              {emoji} {task.taskDescription}
                              {task.estimatedDuration != null && task.estimatedDuration > 0 && (
                                <span className="text-slate-400 dark:text-slate-500 font-normal">
                                  {" "}
                                  ({task.estimatedDuration}min)
                                </span>
                              )}
                            </p>
                            {hasProof && (
                              <div className="mt-3 pl-0 space-y-2">
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                  Proof:
                                </p>
                                {task.proofType === "screenshot" && task.proofUrl && (
                                  <div className="rounded border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-900/50 inline-block">
                                    <img
                                      src={task.proofUrl}
                                      alt="Proof"
                                      className="h-24 w-auto max-w-full object-cover"
                                    />
                                  </div>
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
                                  <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                                    &quot;{textPreview(task.proofText, 120)}&quot;
                                  </p>
                                )}
                                {task.proofSubmittedAt && (
                                  <p className="text-xs text-slate-400 dark:text-slate-500">
                                    Submitted: {formatProofTime(task.proofSubmittedAt)}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {dayNumber === currentDay && pendingCount > 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 pl-4">
                    ☐ {pendingCount} more task{pendingCount === 1 ? "" : "s"} to complete...
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
