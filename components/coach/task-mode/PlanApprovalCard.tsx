"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, Loader2, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { TaskRunDTO } from "@/hooks/useTaskRun";

const ASSET_TYPE_LABEL: Record<string, string> = {
  video_script: "Video scripts",
  carousel: "Carousel posts",
  email: "Email",
};

/**
 * Approval gate 1: shows the strategy Task Mode built before it spends any AI
 * calls generating actual assets. If the plan flagged genuinely missing
 * information, those questions are asked here — answers are sent along with
 * the "Generate assets" click, not before.
 */
export function PlanApprovalCard({
  run,
  onGenerate,
  pending,
}: {
  run: TaskRunDTO;
  onGenerate: (answers?: Record<string, string>) => void;
  pending: boolean;
}) {
  const plan = run.plan;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  if (!plan) return null;

  const missingRequired = plan.missingInfo.filter((q) => !answers[q.key]?.trim());
  const canGenerate = missingRequired.length === 0;

  return (
    <Card className="border-gray-200 dark:border-gray-800">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-orange-500" />
          <CardTitle className="text-base font-semibold">Here&rsquo;s the plan</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-gray-700 dark:text-gray-300">{plan.objectiveSummary}</p>

        {plan.offerAnalysis.strengths.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Strengths</p>
            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              {plan.offerAnalysis.strengths.map((s, i) => (
                <li key={i} className="flex gap-2"><span className="text-orange-500">•</span>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {plan.offerAnalysis.gaps.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Gaps to address</p>
            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              {plan.offerAnalysis.gaps.map((s, i) => (
                <li key={i} className="flex gap-2"><span className="text-orange-500">•</span>{s}</li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">This will generate</p>
          <div className="flex flex-wrap gap-2">
            {plan.assetPlan.map((item, i) => (
              <Badge key={i} variant="outline" className="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-400">
                {item.count}× {ASSET_TYPE_LABEL[item.assetType] ?? item.assetType}
              </Badge>
            ))}
          </div>
          <div className="mt-2 space-y-1">
            {plan.assetPlan.map((item, i) => (
              <p key={i} className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium">{ASSET_TYPE_LABEL[item.assetType] ?? item.assetType}:</span> {item.angle}
              </p>
            ))}
          </div>
        </div>

        {plan.missingInfo.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">A few things needed first</p>
            </div>
            <div className="space-y-3">
              {plan.missingInfo.map((q) => (
                <div key={q.key}>
                  <label className="mb-1 block text-sm text-gray-700 dark:text-gray-300">{q.question}</label>
                  <Input
                    value={answers[q.key] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                    placeholder={q.placeholder}
                    disabled={pending}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button
            onClick={() => onGenerate(Object.keys(answers).length > 0 ? answers : undefined)}
            disabled={pending || !canGenerate}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
            {pending ? "Generating…" : "Generate assets"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
