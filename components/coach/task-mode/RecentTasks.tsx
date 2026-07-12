"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TaskRunDTO } from "@/hooks/useTaskRun";

const STATUS_VARIANT: Record<string, string> = {
  completed: "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400",
  failed: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400",
  cancelled: "border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400",
  awaiting_approval: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-400",
};

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  planning: "Planning",
  running: "Running",
  awaiting_approval: "Awaiting approval",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function RecentTasks({ onOpen }: { onOpen: (runId: string) => void }) {
  const [runs, setRuns] = useState<TaskRunDTO[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/jarvis/runs")
      .then((res) => (res.ok ? res.json() : { runs: [] }))
      .then((data) => {
        if (!cancelled) setRuns(data.runs ?? []);
      })
      .catch(() => {
        if (!cancelled) setRuns([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (runs === null) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading recent tasks…
      </div>
    );
  }
  if (runs.length === 0) return null;

  return (
    <div className="w-full">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Recent tasks</p>
      <div className="space-y-1.5">
        {runs.slice(0, 5).map((run) => (
          <button
            key={run.id}
            type="button"
            onClick={() => onOpen(run.id)}
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm transition-colors hover:border-orange-300 hover:bg-orange-50 dark:border-gray-800 dark:bg-[#141414] dark:hover:border-orange-800 dark:hover:bg-orange-950/20"
          >
            <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-300">{run.goal}</span>
            <Badge variant="outline" className={`shrink-0 text-[10px] py-0 ${STATUS_VARIANT[run.status] ?? ""}`}>
              {STATUS_LABEL[run.status] ?? run.status}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  );
}
