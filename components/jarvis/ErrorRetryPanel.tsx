"use client";

import { AlertOctagon, Loader2, RotateCcw, RotateCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { JarvisRunDTO } from "@/hooks/useJarvisRun";

/**
 * Shown whenever a run's status is "failed". Which phase failed determines
 * which retry action is offered — a failed step never falsely leaves the
 * run looking completed, and retrying always resumes the same run rather
 * than starting over from scratch.
 */
export function ErrorRetryPanel({
  run,
  onRetryPlan,
  onRetryGenerate,
  onRetryApprove,
  onStartNew,
  pending,
}: {
  run: JarvisRunDTO;
  onRetryPlan: () => void;
  onRetryGenerate: () => void;
  onRetryApprove: () => void;
  onStartNew: () => void;
  pending: boolean;
}) {
  const failedPhase: "plan" | "generate" | "save" = !run.plan
    ? "plan"
    : run.assets.length === 0
      ? "generate"
      : "save";

  const retryLabel =
    failedPhase === "plan" ? "Retry planning" : failedPhase === "generate" ? "Retry generating assets" : "Retry saving";
  const retryAction = failedPhase === "plan" ? onRetryPlan : failedPhase === "generate" ? onRetryGenerate : onRetryApprove;

  return (
    <Card className="border-red-200 dark:border-red-900/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertOctagon className="h-5 w-5 text-red-500" />
          <CardTitle className="text-base font-semibold text-red-700 dark:text-red-400">Something went wrong</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {run.error ?? "This run hit an unexpected error."}
        </p>
        <p className="text-xs text-gray-400">
          Nothing was saved to your library from this attempt. Retrying will pick up where it left off — it won&rsquo;t
          repeat steps that already succeeded.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onStartNew} disabled={pending} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Start new task instead
          </Button>
          <Button onClick={retryAction} disabled={pending} className="gap-2 bg-orange-500 hover:bg-orange-600">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
            {retryLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
