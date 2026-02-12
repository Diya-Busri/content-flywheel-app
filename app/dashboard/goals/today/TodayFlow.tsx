"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { ProofModal } from "../[id]/ProofModal";

type Goal = {
  id: string;
  title: string;
  totalDays: number;
  currentDay: number;
  status: string;
};

type TodayTask = {
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
  { today: TodayTask[]; tomorrow: TodayTask[] }
>;

export default function TodayFlow() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasksByGoalId, setTasksByGoalId] = useState<TasksByGoalId>({});
  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [proofModalTask, setProofModalTask] = useState<{ goal: Goal; task: TodayTask } | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/goals/dashboard");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setGoals(data.goals ?? []);
      setTasksByGoalId(data.tasksByGoalId ?? {});
    } catch {
      setGoals([]);
      setTasksByGoalId({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const activeGoals = goals.filter((g) => g.status === "active");
  const goalsWithToday = activeGoals.filter(
    (g) => (tasksByGoalId[g.id]?.today?.length ?? 0) > 0
  );
  const totalMinutes = goalsWithToday.reduce(
    (sum, g) =>
      sum +
      (tasksByGoalId[g.id]?.today ?? []).reduce(
        (s, t) => s + (t.estimatedDuration ?? 0),
        0
      ),
    0
  );
  const totalLabel =
    totalMinutes < 60 ? `${totalMinutes} min` : `${(totalMinutes / 60).toFixed(1)} hours`;

  const handleToggle = (goal: Goal, task: TodayTask, currentCompleted: boolean) => {
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
        fetchData();
      })
      .catch(() => toast({ title: "Could not update task", variant: "destructive" }))
      .finally(() => setUpdatingTaskId(null));
  };

  const handleProofSubmit = async (payload: {
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
      if (!res.ok) throw new Error("Failed to submit");
      setProofModalTask(null);
      fetchData();
      toast({ title: "Proof accepted! Task complete ✓" });
    } catch {
      toast({ title: "Could not submit proof", variant: "destructive" });
    } finally {
      setUpdatingTaskId(null);
    }
  };

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
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </main>
    );
  }

  if (goalsWithToday.length === 0) {
    return (
      <main className="p-6 md:p-10 max-w-2xl mx-auto">
        <Link
          href="/dashboard/goals"
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-orange-500 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Goal Tracker
        </Link>
        <Card className="border-slate-200 dark:border-slate-700">
          <CardContent className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              No tasks for today. Start a goal or check back tomorrow.
            </p>
            <Button asChild className="bg-orange-500 hover:bg-orange-600">
              <Link href="/dashboard/goals">Go to Goal Tracker</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="p-6 md:p-10 max-w-2xl mx-auto">
      {proofModalTask && (
        <ProofModal
          open={!!proofModalTask}
          onOpenChange={(open) => !open && setProofModalTask(null)}
          taskDescription={proofModalTask.task.taskDescription}
          taskType={proofModalTask.task.taskType as "external" | "app_action" | undefined}
          category={proofModalTask.task.category}
          appLink={proofModalTask.task.appLink}
          onSubmit={handleProofSubmit}
        />
      )}

      <Link
        href="/dashboard/goals"
        className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-orange-500 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Goal Tracker
      </Link>

      <Card className="border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">
            Full Daily Schedule
          </CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Today&apos;s tasks across all goals ({totalLabel} total)
          </p>
        </CardHeader>
        <CardContent className="space-y-6 pt-0">
          {goalsWithToday.map((goal) => {
            const tasks = tasksByGoalId[goal.id]?.today ?? [];
            return (
              <div key={goal.id} className="space-y-3">
                <Link
                  href={`/dashboard/goals/${goal.id}`}
                  className="text-sm font-semibold text-slate-800 dark:text-slate-200 hover:text-orange-500 hover:underline block"
                >
                  {goal.title} (Day {goal.currentDay}/{goal.totalDays})
                </Link>
                <ul className="space-y-2">
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
                            handleToggle(goal, task, task.isCompleted)
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
        </CardContent>
      </Card>
    </main>
  );
}
