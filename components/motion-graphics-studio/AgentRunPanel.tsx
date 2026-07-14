"use client";

/**
 * AgentRunPanel — UI for the MG Agent Workflow.
 *
 * Correction 11: Shows 8 steps in a timeline. At plan approval shows the plan
 * card with editable fields. At storyboard approval shows the 5-scene
 * editable list (not a summary — real narration + on-screen text per scene).
 *
 * Correction 12: Storyboard approval redirects to the existing project editor
 * so there is only one editor. AgentRunPanel produces the same project shape
 * as Quick Generate.
 */

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  Pause,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RotateCcw,
  X,
} from "lucide-react";
import { useMgAgentRun } from "@/hooks/useMgAgentRun";
import type { MgRunWithSteps, MgRunStatus, MgPlan, MgPlanEdits } from "@/lib/motion-graphics/agent-types";
import { MG_UI_STEPS, MG_ACTIVE_STATUSES, MG_GATE_STATUSES, MG_TERMINAL_STATUSES } from "@/lib/motion-graphics/agent-types";
import type { StoryboardScene } from "@/lib/motion-graphics/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  initialPayload: {
    contentMode: string;
    sourceText: string;
    sourceUrl?: string;
    targetAudience?: string;
    mainOpinion?: string;
    desiredCta?: string;
    cfMention: string;
    videoDuration?: string;
    tone?: string;
    aspectRatio: string;
  };
  onCancel: () => void;
}

// ─── Step icon ────────────────────────────────────────────────────────────────

function StepIcon({
  state,
}: {
  state: "pending" | "running" | "completed" | "failed" | "gate" | "gate-active";
}) {
  if (state === "running") {
    return <Loader2 size={16} className="animate-spin text-orange-400" />;
  }
  if (state === "completed") {
    return <CheckCircle2 size={16} className="text-green-400" />;
  }
  if (state === "failed") {
    return <XCircle size={16} className="text-destructive" />;
  }
  if (state === "gate-active") {
    return <Pause size={16} className="text-orange-400" />;
  }
  if (state === "gate") {
    return <Pause size={16} className="text-muted-foreground/40" />;
  }
  return <Circle size={16} className="text-muted-foreground/40" />;
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function getStepState(
  uiStep: (typeof MG_UI_STEPS)[number],
  run: MgRunWithSteps | null,
  steps: MgRunWithSteps["steps"]
): "pending" | "running" | "completed" | "failed" | "gate" | "gate-active" {
  if (!run) return uiStep.isGate ? "gate" : "pending";

  const status = run.status as MgRunStatus;

  if (uiStep.isGate) {
    if (uiStep.gateType === undefined) {
      // "Complete" step
      return status === "completed" ? "gate-active" : "gate";
    }
    if (uiStep.gateType === "plan_review") {
      if (status === "awaiting_plan_approval") return "gate-active";
      const pastPlan = ["scripting","storyboarding","awaiting_storyboard_approval","saving","completed"].includes(status);
      return pastPlan ? "completed" : "gate";
    }
    if (uiStep.gateType === "storyboard_review") {
      if (status === "awaiting_storyboard_approval") return "gate-active";
      const pastStoryboard = ["saving","completed"].includes(status);
      return pastStoryboard ? "completed" : "gate";
    }
    return "gate";
  }

  const toolName = uiStep.toolName!;
  const toolStep = steps.findLast?.((s) => s.toolName === toolName)
    ?? steps.slice().reverse().find((s) => s.toolName === toolName);

  if (!toolStep) return "pending";
  if (toolStep.status === "completed") return "completed";
  if (toolStep.status === "running")   return "running";
  if (toolStep.status === "failed")    return "failed";
  return "pending";
}

function Timeline({ run, steps }: { run: MgRunWithSteps | null; steps: MgRunWithSteps["steps"] }) {
  return (
    <div className="space-y-2">
      {MG_UI_STEPS.map((step, i) => {
        const stepState = getStepState(step, run, steps);
        const isGate = step.isGate;
        const isActive = stepState === "running" || stepState === "gate-active";

        return (
          <div key={i} className="flex items-start gap-2.5">
            <div className="mt-0.5 flex-shrink-0">
              <StepIcon state={stepState} />
            </div>
            <div className={`text-sm ${
              isActive ? "text-foreground font-medium" :
              stepState === "completed" ? "text-foreground/70" :
              "text-muted-foreground"
            }`}>
              {step.label}
              {isGate && !step.gateType && stepState === "gate-active" && (
                <Badge className="ml-2 text-[10px] bg-green-500/15 text-green-400 border-green-500/30 border">
                  Done
                </Badge>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Plan approval card ────────────────────────────────────────────────────────

function PlanApprovalCard({
  plan,
  actionPending,
  onApprove,
}: {
  plan: MgPlan;
  actionPending: boolean;
  onApprove: (edits: MgPlanEdits) => void;
}) {
  const [angle, setAngle]     = useState(plan.recommendedAngle);
  const [hook, setHook]       = useState(plan.selectedHook);
  const [lesson, setLesson]   = useState(plan.mainLesson);
  const [cta, setCta]         = useState(plan.suggestedCta);
  const [cfLevel, setCfLevel] = useState(plan.cfIntegrationLevel);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4">
        <p className="text-xs font-semibold text-orange-400 mb-2">Source insight</p>
        <p className="text-sm text-foreground/80">{plan.analysis.coreProblem}</p>
        <p className="text-xs text-muted-foreground mt-1 italic">&ldquo;{plan.analysis.strongestQuote}&rdquo;</p>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Recommended angle <span className="text-muted-foreground">(editable)</span></Label>
          <Textarea
            value={angle}
            onChange={(e) => setAngle(e.target.value)}
            className="mt-1 min-h-[64px] text-sm"
          />
        </div>

        <div>
          <Label className="text-xs">Hook to use <span className="text-muted-foreground">(pick or edit)</span></Label>
          <div className="space-y-1.5 mt-1">
            {plan.hookOptions.map((h, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setHook(h)}
                className={`w-full text-left text-sm p-2.5 rounded-md border transition-all ${
                  hook === h
                    ? "border-orange-500 bg-orange-500/10"
                    : "border-border hover:border-orange-500/30"
                }`}
              >
                {hook === h && <CheckCircle2 size={12} className="inline text-orange-500 mr-1.5" />}
                {h}
              </button>
            ))}
          </div>
          <Input
            value={hook}
            onChange={(e) => setHook(e.target.value)}
            placeholder="Or type a custom hook…"
            className="mt-1.5 text-sm"
          />
        </div>

        <div>
          <Label className="text-xs">Main lesson</Label>
          <Input value={lesson} onChange={(e) => setLesson(e.target.value)} className="mt-1 text-sm" />
        </div>

        <div>
          <Label className="text-xs">Call to action</Label>
          <Input value={cta} onChange={(e) => setCta(e.target.value)} className="mt-1 text-sm" />
        </div>

        <div>
          <Label className="text-xs">Content Flywheel mention</Label>
          <Select value={cfLevel} onValueChange={(v) => setCfLevel(v as typeof cfLevel)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">Off — don&apos;t mention it</SelectItem>
              <SelectItem value="subtle">Subtle — only where natural</SelectItem>
              <SelectItem value="direct">Direct — clear CTA</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border border-muted p-3 text-xs text-muted-foreground space-y-1">
          <p>Estimated scenes: 5 &middot; Credit cost: {plan.estimatedCreditCost} credits</p>
          <p>Repurposing options: <span className="text-muted-foreground/60">Coming soon</span></p>
        </div>
      </div>

      <Button
        onClick={() =>
          onApprove({
            recommendedAngle:   angle,
            selectedHook:       hook,
            mainLesson:         lesson,
            suggestedCta:       cta,
            cfIntegrationLevel: cfLevel,
          })
        }
        disabled={actionPending || !angle || !hook}
        className="w-full"
      >
        {actionPending ? (
          <><Loader2 size={14} className="animate-spin mr-2" />Generating script &amp; storyboard…</>
        ) : (
          "Approve plan and generate storyboard"
        )}
      </Button>
    </div>
  );
}

// ─── Storyboard approval card ─────────────────────────────────────────────────

function StoryboardApprovalCard({
  shortForm,
  actionPending,
  onApprove,
}: {
  shortForm: { title: string; scenes: StoryboardScene[] };
  actionPending: boolean;
  onApprove: (scenes: StoryboardScene[]) => void;
}) {
  const [scenes, setScenes] = useState<StoryboardScene[]>(shortForm.scenes);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  function patchScene(idx: number, patch: Partial<StoryboardScene>) {
    setScenes((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s))
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-muted p-3">
        <p className="text-sm font-medium">{shortForm.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{scenes.length} scenes · edit below then approve</p>
      </div>

      {scenes.map((scene, idx) => {
        const duration = Math.round(scene.endTime - scene.startTime);
        const isExpanded = expandedIdx === idx;
        return (
          <div key={scene.id} className="rounded-lg border">
            <button
              type="button"
              className="w-full flex items-start gap-2.5 p-3 text-left"
              onClick={() => setExpandedIdx(isExpanded ? null : idx)}
            >
              <span className="text-xs font-mono text-muted-foreground mt-0.5 w-5 flex-shrink-0">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{scene.visualType} · {duration}s</p>
                <p className="text-sm truncate">{scene.narration}</p>
                {scene.onScreenText && (
                  <p className="text-xs text-orange-400 mt-0.5 truncate">&ldquo;{scene.onScreenText}&rdquo;</p>
                )}
              </div>
              {isExpanded ? <ChevronUp size={14} className="flex-shrink-0 text-muted-foreground mt-0.5" /> :
                            <ChevronDown size={14} className="flex-shrink-0 text-muted-foreground mt-0.5" />}
            </button>

            {isExpanded && (
              <div className="px-3 pb-3 space-y-2 border-t pt-3">
                <div>
                  <Label className="text-xs">Narration</Label>
                  <Textarea
                    value={scene.narration}
                    onChange={(e) => patchScene(idx, { narration: e.target.value })}
                    className="mt-1 text-sm min-h-[80px]"
                  />
                </div>
                <div>
                  <Label className="text-xs">On-screen text <span className="text-muted-foreground">(max 8 words)</span></Label>
                  <Input
                    value={scene.onScreenText}
                    onChange={(e) => patchScene(idx, { onScreenText: e.target.value })}
                    className="mt-1 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Duration (sec)</Label>
                    <Input
                      type="number"
                      min={2}
                      max={60}
                      value={duration}
                      onChange={(e) => {
                        const d = Math.max(2, Math.min(60, parseInt(e.target.value) || 5));
                        patchScene(idx, { endTime: scene.startTime + d });
                      }}
                      className="mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Visual type</Label>
                    <Input
                      value={scene.visualType}
                      readOnly
                      className="mt-1 text-sm bg-muted/30"
                    />
                  </div>
                </div>
                {scene.assetSuggestions.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Asset needed: {scene.assetSuggestions[0]}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      <Button
        onClick={() => onApprove(scenes)}
        disabled={actionPending}
        className="w-full"
      >
        {actionPending ? (
          <><Loader2 size={14} className="animate-spin mr-2" />Saving project…</>
        ) : (
          <>
            <ExternalLink size={14} className="mr-2" />
            Approve and open editor
          </>
        )}
      </Button>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export const AgentRunPanel: React.FC<Props> = ({ initialPayload, onCancel }) => {
  const router = useRouter();
  const {
    run,
    steps,
    loading,
    actionPending,
    actionError,
    startRun,
    approvePlan,
    approveStoryboard,
    cancelRun,
    retryRun,
    reset,
  } = useMgAgentRun();

  // Start the run automatically when the panel mounts
  const hasStarted = React.useRef(false);
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    void startRun(initialPayload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = run?.status as MgRunStatus | undefined;
  const isActive = status ? MG_ACTIVE_STATUSES.has(status) : false;
  const isGate   = status ? MG_GATE_STATUSES.has(status) : false;
  const isFailed  = status === "failed";
  const isCancelled = status === "cancelled";

  // When completed, redirect to the project editor
  useEffect(() => {
    if (status === "completed" && run?.projectId) {
      router.push(`/dashboard/admin/motion-graphics-studio/projects/${run.projectId}`);
    }
  }, [status, run?.projectId, router]);

  function handleCancel() {
    void cancelRun();
    onCancel();
    reset();
  }

  function handleApprovePlan(edits: MgPlanEdits) {
    void approvePlan(edits);
  }

  function handleApproveStoryboard(scenes: StoryboardScene[]) {
    void approveStoryboard(scenes).then((data) => {
      if (data?.projectUrl) {
        router.push(data.projectUrl as string);
      }
    });
  }

  return (
    <div className="max-w-xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Agent Workflow</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isActive   ? "Working…" :
             isFailed   ? "Failed — see error below" :
             isCancelled ? "Cancelled" :
             status === "awaiting_plan_approval" ? "Review the proposed content strategy" :
             status === "awaiting_storyboard_approval" ? "Review the generated storyboard" :
             loading ? "Starting…" : "Ready"}
          </p>
        </div>
        {!isActive && status !== "completed" && (
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <X size={14} />
          </Button>
        )}
      </div>

      {/* Network error */}
      {actionError && (
        <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/10 p-3">
          {actionError}
        </p>
      )}

      {/* Timeline */}
      {(run || loading) && (
        <Card>
          <CardContent className="p-4">
            <Timeline run={run} steps={steps} />
          </CardContent>
        </Card>
      )}

      {/* Run error */}
      {isFailed && run?.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 space-y-2">
          <p className="text-sm text-destructive">{run.error}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void retryRun()}>
              <RotateCcw size={12} className="mr-1.5" />
              Retry
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { reset(); onCancel(); }}>
              Start over
            </Button>
          </div>
        </div>
      )}

      {/* Plan approval */}
      {status === "awaiting_plan_approval" && run?.plan && (
        <PlanApprovalCard
          plan={run.plan}
          actionPending={actionPending}
          onApprove={handleApprovePlan}
        />
      )}

      {/* Storyboard approval */}
      {status === "awaiting_storyboard_approval" && run?.shortForm && (
        <StoryboardApprovalCard
          shortForm={run.shortForm}
          actionPending={actionPending}
          onApprove={handleApproveStoryboard}
        />
      )}

      {/* Cancel button (while active) */}
      {isActive && (
        <Button
          variant="outline"
          size="sm"
          className="text-muted-foreground"
          onClick={handleCancel}
        >
          Cancel
        </Button>
      )}
    </div>
  );
};
