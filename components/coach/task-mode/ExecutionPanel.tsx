"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, X, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { TaskRunDTO, TaskStepDTO } from "@/hooks/useTaskRun";
import { EXECUTION_STAGES, latestStepByTool, stageStatus, timeAgo, type StageStatus } from "./stages";

/**
 * Renders nothing on first paint (server and client both), then fills in
 * "Started Xs ago" after mount and keeps it ticking. timeAgo() depends on
 * Date.now(), which differs between server-render time and client-hydration
 * time — computing it during the render that gets sent to the client would
 * be a classic Next.js hydration-mismatch source, so it's deliberately
 * deferred to a post-mount effect instead.
 */
function RelativeTime({ iso }: { iso: string }) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    setLabel(timeAgo(iso));
    const id = setInterval(() => setLabel(timeAgo(iso)), 5000);
    return () => clearInterval(id);
  }, [iso]);
  if (!label) return null;
  return <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">Started {label}</p>;
}

function StageIcon({ status }: { status: StageStatus }) {
  if (status === "completed") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white transition-colors duration-300">
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-orange-300 opacity-40 dark:bg-orange-700" />
        <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        </span>
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
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-300 transition-colors duration-300 dark:border-gray-700 dark:text-gray-600">
      <Circle className="h-2.5 w-2.5 fill-current" />
    </span>
  );
}

function Connector({ status }: { status: StageStatus }) {
  return (
    <div className="ml-3 flex h-4 w-px items-stretch">
      <div className={`w-full transition-colors duration-500 ${status === "completed" ? "bg-orange-400" : "bg-gray-200 dark:bg-gray-700"}`} />
    </div>
  );
}

function StageRow({
  status,
  label,
  caption,
  startedAt,
  error,
}: {
  status: StageStatus;
  label: string;
  caption?: string;
  startedAt?: string | null;
  error?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <StageIcon status={status} />
      <div className="min-w-0 pt-0.5">
        <p
          className={`text-sm font-medium transition-colors duration-300 ${
            status === "pending" ? "text-gray-400 dark:text-gray-600" : "text-gray-900 dark:text-gray-100"
          }`}
        >
          {label}
        </p>
        {caption && <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{caption}</p>}
        {status === "running" && startedAt && <RelativeTime iso={startedAt} />}
        {error && <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}

/**
 * Live execution panel. Maps the run's status + step history onto the 7
 * stages the user sees: Planning / Reading business memory / Analysing
 * product / Creating strategy / Generating assets / Waiting for approval /
 * Saving. Driven entirely by DB state (run + steps), so a page refresh
 * re-renders exactly where things left off.
 *
 * Presentational-only pass: same status logic as before, now shown as an
 * animated connected timeline with an overall progress bar instead of a
 * flat checklist, so it's easier to tell at a glance how far along things
 * are and what's happening right now.
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

  const stageStatuses = EXECUTION_STAGES.map((stage) => stageStatus(stage.tools, latest));

  const waitingApprovalStatus: StageStatus =
    run.status === "awaiting_approval"
      ? "running"
      : run.plan && (run.status === "running" || run.status === "completed" || (run.status === "failed" && run.assets.length > 0))
        ? "completed"
        : "pending";

  const allStatuses = [planningStatus, ...stageStatuses, waitingApprovalStatus];
  const completedCount = allStatuses.filter((s) => s === "completed").length;
  const progressPct = Math.round((completedCount / allStatuses.length) * 100);

  const runningIndex = allStatuses.findIndex((s) => s === "running");
  const runningLabel =
    runningIndex === 0
      ? "Planning"
      : runningIndex === allStatuses.length - 1
        ? "Waiting for approval"
        : runningIndex > 0
          ? EXECUTION_STAGES[runningIndex - 1]?.label
          : undefined;

  return (
    <Card className="border-gray-200 dark:border-gray-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold">Working on it</CardTitle>
          <span className="text-xs font-medium text-gray-400">{completedCount}/{allStatuses.length}</span>
        </div>
        <Progress value={progressPct} className="h-1.5" />
        {runningLabel && (
          <p className="text-xs text-orange-600 dark:text-orange-400">{runningLabel}…</p>
        )}
      </CardHeader>
      <CardContent className="space-y-0">
        <StageRow status={planningStatus} label="Planning" caption={`"${run.goal}"`} />
        <Connector status={planningStatus} />

        {EXECUTION_STAGES.map((stage, i) => {
          const status = stageStatuses[i]!;
          const step = stage.tools.map((t) => latest.get(t)).find((s): s is TaskStepDTO => Boolean(s));
          const failedStep = stage.tools
            .map((t) => latest.get(t))
            .find((s): s is TaskStepDTO => Boolean(s) && s!.status === "failed");
          return (
            <div key={stage.key}>
              <StageRow
                status={status}
                label={stage.label}
                startedAt={step?.startedAt}
                error={failedStep?.error ?? undefined}
              />
              <Connector status={status} />
            </div>
          );
        })}

        <StageRow status={waitingApprovalStatus} label="Waiting for approval" />
      </CardContent>
    </Card>
  );
}
