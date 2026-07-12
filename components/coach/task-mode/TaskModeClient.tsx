"use client";

import { Suspense } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTaskRun } from "@/hooks/useTaskRun";
import { TaskGoalInput } from "./TaskGoalInput";
import { RecentTasks } from "./RecentTasks";
import { ExecutionPanel } from "./ExecutionPanel";
import { PlanApprovalCard } from "./PlanApprovalCard";
import { AssetApprovalScreen } from "./AssetApprovalScreen";
import { CampaignResultsScreen } from "./CampaignResultsScreen";
import { ErrorRetryPanel } from "./ErrorRetryPanel";

/**
 * AI Coach — Task Mode. Embedded inside app/dashboard/ai-coach (see
 * AICoachModeSwitcher.tsx), not a standalone page — this component owns no
 * page chrome of its own, just fills whatever panel it's given.
 *
 * All orchestration is server-side (lib/jarvis/*, /api/jarvis/*, unchanged
 * from the original standalone build) — this is purely the presentation
 * layer, driven entirely by useTaskRun's server-fetched state.
 */
function TaskModeContent() {
  const {
    run,
    steps,
    loading,
    actionPending,
    actionError,
    startRun,
    generateAssets,
    approveAssets,
    retryPlan,
    cancelRun,
    editAsset,
    startNewTask,
    openRun,
  } = useTaskRun();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pb-16">
        <TaskGoalInput onSubmit={(goal) => void startRun(goal)} pending={actionPending} error={actionError} />
        <RecentTasks onOpen={openRun} />
      </div>
    );
  }

  const canCancel = ["queued", "planning", "awaiting_approval"].includes(run.status);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6 sm:py-10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">&ldquo;{run.goal}&rdquo;</p>
        </div>
        {canCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void cancelRun()}
            disabled={actionPending}
            className="shrink-0 gap-1.5 text-gray-400 hover:text-red-500"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        )}
      </div>

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          {actionError}
        </div>
      )}

      {(run.status === "queued" || run.status === "planning" || run.status === "running") && (
        <ExecutionPanel run={run} steps={steps} />
      )}

      {run.status === "awaiting_approval" && run.currentGate === "plan_review" && (
        <>
          <ExecutionPanel run={run} steps={steps} />
          <PlanApprovalCard run={run} onGenerate={(answers) => void generateAssets(answers)} pending={actionPending} />
        </>
      )}

      {run.status === "awaiting_approval" && run.currentGate === "asset_review" && (
        <AssetApprovalScreen
          run={run}
          onApprove={(ids) => void approveAssets(ids)}
          onEditAsset={editAsset}
          pending={actionPending}
        />
      )}

      {run.status === "failed" && (
        <>
          <ExecutionPanel run={run} steps={steps} />
          <ErrorRetryPanel
            run={run}
            pending={actionPending}
            onRetryPlan={() => void retryPlan()}
            onRetryGenerate={() => void generateAssets()}
            onRetryApprove={() => void approveAssets()}
            onStartNew={startNewTask}
          />
        </>
      )}

      {run.status === "completed" && <CampaignResultsScreen run={run} onStartNew={startNewTask} />}

      {run.status === "cancelled" && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center dark:border-gray-800 dark:bg-gray-900/40">
          <p className="text-sm text-gray-500 dark:text-gray-400">This task was cancelled.</p>
          <Button onClick={startNewTask} variant="outline" className="mt-3">Start new task</Button>
        </div>
      )}
    </div>
  );
}

export function TaskModeClient() {
  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[#F9FAFB] dark:bg-[#0F0F0F]">
      <Suspense
        fallback={
          <div className="flex min-h-[50vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          </div>
        }
      >
        <TaskModeContent />
      </Suspense>
    </div>
  );
}
