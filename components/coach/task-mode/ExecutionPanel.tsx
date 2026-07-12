"use client";

import { Check, Loader2, X, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TaskRunDTO, TaskStepDTO } from "@/hooks/useTaskRun";
import { EXECUTION_STAGES, latestStepByTool, stageStatus, type StageStatus } from "./stages";

function StageIcon({ status }: { status: StageStatus }) {
  if (status === "completed") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white">
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
        <X className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-300 dark:border-gray-700 dark:text-gray-600">
      <Circle className="h-2.5 w-2.5 fill-current" />
    </span>
  );
}

/**
 * Live execution panel. Maps the run's status + step history onto the 7
 * stages the user sees: Planning / Reading business memory / Analysing
 * product / Creating strategy / Generating assets / Waiting for approval /
 * Saving. Driven entirely by DB state (run + steps), so a page refresh
 * re-renders exactly where things left off.
 */
export function ExecutionPanel({ run, steps }: { run: TaskRunDTO; steps: TaskStepDTO[] }) {
  const latest = latestStepByTool(steps);

  const planningStatus: StageStatus =
    run.status === "queued"
      ? "pending"
      : run.status === "planning"
        ? "running"
        : run.status === "failed" && !run.plan
          ? "failed"
          : "completed";

  const waitingApprovalStatus: StageStatus =
    run.status === "awaiting_approval"
      ? "running"
      : run.plan && (run.status === "running" || run.status === "completed" || (run.status === "failed" && run.assets.length > 0))
        ? "completed"
        : "pending";

  return (
    <Card className="border-gray-200 dark:border-gray-800">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Working on it</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <StageIcon status={planningStatus} />
          <div className="min-w-0 pt-0.5">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Planning</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">&ldquo;{run.goal}&rdquo;</p>
          </div>
        </div>

        {EXECUTION_STAGES.map((stage) => {
          const status = stageStatus(stage.tools, latest);
          const failedStep = stage.tools
            .map((t) => latest.get(t))
            .find((s): s is TaskStepDTO => Boolean(s) && s!.status === "failed");
          return (
            <div key={stage.key} className="flex items-start gap-3">
              <StageIcon status={status} />
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{stage.label}</p>
                {failedStep?.error && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{failedStep.error}</p>
                )}
              </div>
            </div>
          );
        })}

        <div className="flex items-start gap-3">
          <StageIcon status={waitingApprovalStatus} />
          <div className="min-w-0 pt-0.5">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Waiting for approval</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
