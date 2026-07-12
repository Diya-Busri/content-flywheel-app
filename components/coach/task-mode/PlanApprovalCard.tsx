"use client";

import { useState } from "react";
import { HeartPulse, Lightbulb, AlertTriangle, Loader2, Zap, CircleCheck, CircleAlert, Flame } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TaskRunDTO } from "@/hooks/useTaskRun";
import { ASSET_TYPE_META, assetLabel } from "./asset-meta";
import { CampaignSummary } from "./CampaignSummary";
import type { ContentAssetType } from "@/db/schema/jarvis-schema";

/**
 * Approval gate 1: shows the strategy Task Mode built before it spends any AI
 * calls generating actual assets. If the plan flagged genuinely missing
 * information, those questions are asked here — answers are sent along with
 * the "Execute campaign" click, not before.
 *
 * Purely presentational rework of the same plan.* data the backend already
 * returns (objectiveSummary, offerAnalysis, assetPlan, missingInfo) — no new
 * fields, no new tool calls. "Business Health" = strengths/gaps, "Why I
 * chose this" = assetPlan angles/notes + recommendedAngles/urgencyIdeas.
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

  const plannedCounts = plan.assetPlan.reduce<Partial<Record<ContentAssetType, number>>>((acc, item) => {
    acc[item.assetType] = (acc[item.assetType] ?? 0) + item.count;
    return acc;
  }, {});

  const { strengths, gaps, recommendedAngles, urgencyIdeas } = plan.offerAnalysis;
  const hasBusinessHealth = strengths.length > 0 || gaps.length > 0;

  return (
    <div className="space-y-4">
      <CampaignSummary
        eyebrow="Campaign plan ready"
        headline={plan.objectiveSummary}
        counts={plannedCounts}
      />

      {hasBusinessHealth && (
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-orange-500" />
              <CardTitle className="text-base font-semibold">Business health</CardTitle>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              What&rsquo;s working, and what this campaign needs to work around.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {strengths.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-600 dark:text-green-400">Strengths</p>
                  {strengths.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900 dark:bg-green-950/20 dark:text-green-300"
                    >
                      <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              )}
              {gaps.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Gaps to address</p>
                  {gaps.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-300"
                    >
                      <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-gray-200 dark:border-gray-800">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-orange-500" />
            <CardTitle className="text-base font-semibold">Why I chose this</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {plan.assetPlan.map((item, i) => {
            const Icon = ASSET_TYPE_META[item.assetType].icon;
            return (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-gray-100 p-3 dark:border-gray-800">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-950/40">
                  <Icon className="h-4 w-4 text-orange-500" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {item.count}× {assetLabel(item.assetType, item.count)}
                  </p>
                  <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{item.angle}</p>
                  {item.notes && <p className="mt-0.5 text-xs text-gray-400">{item.notes}</p>}
                </div>
              </div>
            );
          })}

          {urgencyIdeas.length > 0 && (
            <div className="rounded-lg border border-orange-100 bg-orange-50/60 p-3 dark:border-orange-900/40 dark:bg-orange-950/10">
              <div className="mb-1 flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-orange-500" />
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400">Why now</p>
              </div>
              <ul className="space-y-0.5 text-sm text-gray-600 dark:text-gray-400">
                {urgencyIdeas.map((u, i) => <li key={i}>{u}</li>)}
              </ul>
            </div>
          )}

          {recommendedAngles.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Other angles considered</p>
              <div className="flex flex-wrap gap-1.5">
                {recommendedAngles.map((a, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-400"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {plan.missingInfo.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-900/50">
          <CardContent className="pt-5">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Quick check before I execute this</p>
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
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end pt-1">
        <Button
          onClick={() => onGenerate(Object.keys(answers).length > 0 ? answers : undefined)}
          disabled={pending || !canGenerate}
          size="lg"
          className="gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {pending ? "Executing campaign…" : "Execute Campaign"}
        </Button>
      </div>
    </div>
  );
}
