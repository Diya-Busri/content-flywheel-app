"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

type Goal = {
  id: string;
  title: string;
};

type Task = {
  id: string;
  dayNumber: number;
  taskDescription: string;
  proofType?: string;
  proofUrl?: string;
  proofText?: string;
  proofDescription?: string;
  proofSubmittedAt?: string;
  proofValidationStatus?: string;
};

type ReviewData = {
  goal: Goal;
  weekStartDate: string;
  tasks: Task[];
  honestyCheckedForWeek: boolean;
  checkedAt?: string;
};


function textPreview(text: string | null | undefined, maxLen: number): string {
  if (!text || !text.trim()) return "";
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen) + "...";
}

function isImageUrl(url: string | undefined): boolean {
  if (!url) return false;
  if (url.startsWith("data:image/")) return true;
  return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);
}

export default function ReviewFlow({ goalId }: { goalId: string }) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/goals/${goalId}/review`);
      if (!res.ok) throw new Error("Failed to load review");
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [goalId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleHonestyCheck = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/goals/${goalId}/review`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to save");
      const json = await res.json();
      setData((prev) =>
        prev
          ? { ...prev, honestyCheckedForWeek: true, checkedAt: json.checkedAt }
          : prev
      );
      toast({ title: "Thanks for your honesty. Keep it up! ✓" });
    } catch {
      toast({ title: "Could not save", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

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
          <p className="text-slate-600 dark:text-slate-400">Loading review...</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="p-6 md:p-10 max-w-2xl mx-auto">
        <Link
          href="/dashboard/goals"
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-orange-500 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Goal Tracker
        </Link>
        <p className="text-slate-600 dark:text-slate-400">Could not load review.</p>
      </main>
    );
  }

  const { goal, tasks, honestyCheckedForWeek } = data;

  const byDay: Record<number, Task[]> = {};
  for (const t of tasks) {
    if (!byDay[t.dayNumber]) byDay[t.dayNumber] = [];
    byDay[t.dayNumber].push(t);
  }
  const dayNumbers = Object.keys(byDay).map(Number).sort((a, b) => a - b);

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
          Weekly review • Proofs submitted this week
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-4 mb-8">
        <p className="text-base font-medium text-slate-800 dark:text-slate-200">
          Be honest: Did you actually complete these tasks?
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Review your proof submissions below. This adds psychological accountability—you&apos;re reflecting on your own work.
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-6 text-center mb-8">
          <p className="text-slate-600 dark:text-slate-400">
            No proofs submitted this week yet. Complete tasks and submit proof to see them here.
          </p>
        </div>
      ) : (
        <div className="space-y-6 mb-8">
          {dayNumbers.map((dayNum) => (
            <section
              key={dayNum}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 overflow-hidden"
            >
              <div className="px-4 py-3 bg-slate-100/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <h2 className="font-semibold text-slate-800 dark:text-slate-200">
                  Day {dayNum}
                </h2>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {byDay[dayNum].map((task) => {
                  const isSkipped = task.proofValidationStatus === "validation_skipped";
                  return (
                    <div
                      key={task.id}
                      className={`p-4 ${isSkipped ? "bg-amber-50/50 dark:bg-amber-950/20 border-l-4 border-l-amber-500" : ""}`}
                    >
                      <div className="flex gap-3">
                        {(task.proofType === "screenshot" || task.proofType === "file") &&
                        task.proofUrl &&
                        isImageUrl(task.proofUrl) ? (
                          <div className="shrink-0 rounded border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-900/50">
                            <img
                              src={task.proofUrl}
                              alt="Proof"
                              className="h-20 w-20 object-cover"
                            />
                          </div>
                        ) : null}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            {task.taskDescription}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            {task.proofDescription || task.proofText || textPreview(task.proofText, 80)}
                          </p>
                          {task.proofType === "link" && task.proofUrl && (
                            <a
                              href={task.proofUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-orange-600 dark:text-orange-400 hover:underline break-all mt-1 block"
                            >
                              {task.proofUrl}
                            </a>
                          )}
                          {isSkipped && (
                            <div className="flex items-center gap-1.5 mt-2 text-amber-700 dark:text-amber-400">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              <span className="text-xs font-medium">Validation skipped</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button
          onClick={handleHonestyCheck}
          disabled={honestyCheckedForWeek || submitting}
          className="w-full gap-2"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : honestyCheckedForWeek ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : null}
          {honestyCheckedForWeek
            ? "You confirmed honesty for this week ✓"
            : "Yes, I was honest this week"}
        </Button>
      </div>
    </main>
  );
}
