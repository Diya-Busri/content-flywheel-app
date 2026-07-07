/**
 * /dashboard/launch/[launchId] — AI Execution Dashboard
 * ───────────────────────────────────────────────────────
 * Phase 1.2: Research agent wired and running live.
 *
 * Architecture:
 *   • PIPELINE_STAGES config defines every agent slot.
 *   • `execute` is null for un-wired stages (Phase 1.3+).
 *   • The pipeline runner iterates stages, skips null slots,
 *     and passes an ExecutionContext to each agent.
 *   • Agent Cards show live steps + per-stage progress.
 *   • Future phases: fill `execute` for Product, Design, Marketing, Store.
 */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Sparkles, Package, Palette, Megaphone, Store,
  CheckCircle2, XCircle, Loader2, ChevronLeft,
  Clock, PlugZap, ChevronDown, ChevronUp,
} from "lucide-react";

import { runLaunchResearchAgent } from "@/lib/agents/launch-research-agent";
import type {
  ExecutionContext, AgentStep, AgentStatus, SaveProgressPatch,
} from "@/lib/agents/types";
import type {
  LaunchStatus, LaunchStageId, LaunchStageResults,
} from "@/db/schema/launch-schema";

/* ═══════════════════════════════════════════════════════════
   PIPELINE CONFIG
   ─────────────────────────────────────────────────────────
   To wire a new agent: set execute = yourAgentFn
   The UI never changes — only this config changes.
══════════════════════════════════════════════════════════ */

interface StageConfig {
  id:          LaunchStageId;
  emoji:       string;
  label:       string;
  agentLabel:  string;     // "Research Agent", "Product Agent", etc.
  description: string;
  icon:        React.ElementType;
  execute:     ((ctx: ExecutionContext) => Promise<void>) | null;
}

const PIPELINE_STAGES: StageConfig[] = [
  {
    id:          "research",
    emoji:       "🔍",
    label:       "Research",
    agentLabel:  "Research Agent",
    description: "Market analysis, audience profiling, and competitor intelligence",
    icon:        Sparkles,
    execute:     runLaunchResearchAgent,  // ← Phase 1.2: wired
  },
  {
    id:          "product",
    emoji:       "✍️",
    label:       "Product",
    agentLabel:  "Product Agent",
    description: "Generate a complete digital product with sections and content",
    icon:        Package,
    execute:     null,  // Phase 1.3
  },
  {
    id:          "design",
    emoji:       "🎨",
    label:       "Design",
    agentLabel:  "Design Agent",
    description: "Create carousel slides and visual social media assets",
    icon:        Palette,
    execute:     null,  // Phase 1.4
  },
  {
    id:          "marketing",
    emoji:       "📣",
    label:       "Marketing",
    agentLabel:  "Marketing Agent",
    description: "Write launch captions, email subjects, and hashtag sets",
    icon:        Megaphone,
    execute:     null,  // Phase 1.5
  },
  {
    id:          "store",
    emoji:       "🛍️",
    label:       "Store",
    agentLabel:  "Store Agent",
    description: "List the product, configure pricing, and publish to your store",
    icon:        Store,
    execute:     null,  // Phase 1.6
  },
];

/* ─── Overall progress: each stage occupies a 20% slice ── */
const STAGE_OVERALL_RANGE: [number, number][] = [
  [0, 20], [20, 40], [40, 60], [60, 80], [80, 100],
];

/* ═══════════════════════════════════════════════════════════
   DB PROJECT SHAPE
══════════════════════════════════════════════════════════ */
interface LaunchProject {
  id:           string;
  goal:         string;
  status:       LaunchStatus;
  currentStage: LaunchStageId;
  progress:     number;
  stageResults: LaunchStageResults | null;
  createdAt:    string;
}

/* ═══════════════════════════════════════════════════════════
   STATUS HELPERS
══════════════════════════════════════════════════════════ */
const LAUNCH_STATUS_META: Record<LaunchStatus, { label: string; cls: string }> = {
  queued:            { label: "Queued",       cls: "bg-muted text-muted-foreground" },
  running:           { label: "Running",      cls: "bg-blue-500/10 text-blue-500 border border-blue-500/20" },
  awaiting_approval: { label: "Needs Review", cls: "bg-amber-500/10 text-amber-500 border border-amber-500/20" },
  completed:         { label: "Complete",     cls: "bg-green-500/10 text-green-500 border border-green-500/20" },
  failed:            { label: "Failed",       cls: "bg-red-500/10 text-red-500 border border-red-500/20" },
};

/* ═══════════════════════════════════════════════════════════
   STEP LINE — single checklist item inside the agent card
══════════════════════════════════════════════════════════ */
function StepLine({ step }: { step: AgentStep }) {
  return (
    <div className="flex items-start gap-2 py-0.5">
      <div className="mt-[2px] shrink-0">
        {step.status === "done" ? (
          <CheckCircle2 className="w-3 h-3 text-green-500" />
        ) : step.status === "running" ? (
          <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
        ) : step.status === "error" ? (
          <XCircle className="w-3 h-3 text-red-400" />
        ) : (
          <div className="w-3 h-3 rounded-full border border-muted-foreground/20 bg-muted/30" />
        )}
      </div>
      <span className={[
        "text-[11px] leading-snug",
        step.status === "done"    ? "text-foreground/80"
        : step.status === "running" ? "text-foreground font-medium"
        : step.status === "error"   ? "text-red-400 line-through"
        : "text-muted-foreground/40",
      ].join(" ")}>
        {step.label}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   AGENT CARD
══════════════════════════════════════════════════════════ */
interface AgentCardProps {
  stage:         StageConfig;
  status:        AgentStatus;
  steps:         AgentStep[];    // only shown when working
  agentProgress: number;         // 0-100, only shown when working
  progressLabel: string;
  isNextUp:      boolean;        // slight visual hint for the next pending agent
  completeSummary?: string;
}

function AgentCard({
  stage, status, steps, agentProgress, progressLabel, isNextUp, completeSummary,
}: AgentCardProps) {
  const [stepsExpanded, setStepsExpanded] = useState(true);

  const isWorking  = status === "working";
  const isComplete = status === "complete";
  const isError    = status === "error";
  const isWaiting  = status === "waiting";

  const borderCls =
    isWorking  ? "border-orange-500/40 shadow-sm shadow-orange-500/5"
    : isComplete ? "border-green-500/25"
    : isError    ? "border-red-500/25"
    : isNextUp   ? "border-border/80"
    :              "border-border/40";

  const bgCls =
    isWorking  ? "bg-orange-500/[0.03]"
    : isComplete ? "bg-green-500/[0.03]"
    : isError    ? "bg-red-500/[0.03]"
    :              "bg-card/30";

  return (
    <div className={`rounded-xl border transition-all duration-300 ${borderCls} ${bgCls}`}>
      {/* ── Card header ── */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Emoji / status icon */}
        <span className={[
          "text-lg leading-none shrink-0",
          isWaiting && !isNextUp ? "opacity-30 grayscale" : "",
        ].join(" ")}>
          {isComplete ? "✅" : isError ? "❌" : stage.emoji}
        </span>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <span className={[
            "text-[13px] font-bold",
            isWaiting && !isNextUp ? "text-muted-foreground/40"
            : isComplete           ? "text-foreground"
            :                        "text-foreground",
          ].join(" ")}>
            {stage.agentLabel}
          </span>
          {isComplete && completeSummary && (
            <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">{completeSummary}</p>
          )}
          {isWaiting && (
            <p className={[
              "text-[11px] mt-0.5",
              isNextUp ? "text-muted-foreground/60" : "text-muted-foreground/30",
            ].join(" ")}>
              {isNextUp
                ? `Next up — waiting for ${PIPELINE_STAGES.find(s => s.execute !== null)?.agentLabel ?? "Research Agent"}`
                : "Waiting for previous agents"}
            </p>
          )}
          {isError && (
            <p className="text-[11px] text-red-400 mt-0.5">Failed — check console for details</p>
          )}
        </div>

        {/* Status badge */}
        <div className="shrink-0 flex items-center gap-1.5">
          {isWorking && <Loader2 className="w-3.5 h-3.5 text-orange-500 animate-spin" />}
          {isComplete && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
          {isError    && <XCircle className="w-3.5 h-3.5 text-red-400" />}
          {isWaiting  && <Clock className="w-3.5 h-3.5 text-muted-foreground/30" />}
          <span className={[
            "text-[11px] font-semibold",
            isWorking  ? "text-orange-500"
            : isComplete ? "text-green-500"
            : isError    ? "text-red-400"
            :              isNextUp ? "text-muted-foreground/50" : "text-muted-foreground/25",
          ].join(" ")}>
            {isWorking ? "Working" : isComplete ? "Complete" : isError ? "Error" : "Waiting"}
          </span>
          {isWorking && steps.length > 0 && (
            <button
              onClick={() => setStepsExpanded(p => !p)}
              className="ml-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              {stepsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* ── Live steps (only when working and expanded) ── */}
      {isWorking && stepsExpanded && steps.length > 0 && (
        <div className="px-4 pb-3 border-t border-border/40 pt-3 space-y-0.5">
          {steps.map(step => (
            <StepLine key={step.id} step={step} />
          ))}

          {/* Per-agent progress bar */}
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/50">{progressLabel}</span>
              <span className="text-[10px] font-semibold text-muted-foreground/70">{agentProgress}%</span>
            </div>
            <div className="h-1 bg-muted/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all duration-500"
                style={{ width: `${agentProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Agent slot indicator (waiting) ── */}
      {isWaiting && !isNextUp && stage.execute === null && (
        <div className="px-4 pb-3 flex items-center gap-1.5">
          <PlugZap className="w-3 h-3 text-muted-foreground/20" />
          <span className="text-[10px] text-muted-foreground/25">Agent slot — Phase {
            PIPELINE_STAGES.findIndex(s => s.id === stage.id) + 2
          }</span>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════ */
export default function LaunchExecutionPage() {
  const { launchId } = useParams<{ launchId: string }>();
  const router       = useRouter();

  /* ── Page state ── */
  const [project,      setProject]      = useState<LaunchProject | null>(null);
  const [loadError,    setLoadError]    = useState<string | null>(null);

  /* ── Per-agent state ── */
  const [agentStatuses,  setAgentStatuses]  = useState<AgentStatus[]>(PIPELINE_STAGES.map(() => "waiting"));
  const [activeIdx,      setActiveIdx]      = useState<number>(-1);
  const [currentSteps,   setCurrentSteps]   = useState<AgentStep[]>([]);
  const [agentProgress,  setAgentProgress]  = useState<number>(0);
  const [agentPLabel,    setAgentPLabel]    = useState<string>("");
  const [completedSummaries, setCompletedSummaries] = useState<Record<number, string>>({});

  /* ── Overall progress ── */
  const [overallPct, setOverallPct] = useState<number>(0);
  const [overallStatus, setOverallStatus] = useState<LaunchStatus>("queued");

  const hasRunRef = useRef(false);

  /* ── saveProgress: PATCH DB + update local latestResults ── */
  const buildSaveProgress = useCallback(
    (latestResultsRef: { current: LaunchStageResults }) =>
      async (patch: SaveProgressPatch) => {
        try {
          await fetch(`/api/launch/${launchId}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(patch),
          });
          if (patch.stageResults) {
            latestResultsRef.current = { ...latestResultsRef.current, ...patch.stageResults };
          }
          if (patch.progress !== undefined) setOverallPct(patch.progress);
          if (patch.status)                setOverallStatus(patch.status);
        } catch (err) {
          console.error("[saveProgress]", err);
        }
      },
    [launchId],
  );

  /* ── Pipeline runner ── */
  const runPipeline = useCallback(async (proj: LaunchProject) => {
    const latestResultsRef = { current: proj.stageResults ?? {} };

    // Mark already-complete stages (resume case)
    const initialStatuses: AgentStatus[] = PIPELINE_STAGES.map(stage => {
      const key = stage.id as keyof LaunchStageResults;
      return latestResultsRef.current[key] ? "complete" : "waiting";
    });
    setAgentStatuses(initialStatuses);

    const saveProgress = buildSaveProgress(latestResultsRef);

    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      const stage = PIPELINE_STAGES[i]!;

      // Skip already-complete stages
      const key = stage.id as keyof LaunchStageResults;
      if (latestResultsRef.current[key]) continue;

      // Skip un-wired stages (no execute fn yet)
      if (!stage.execute) continue;

      /* ── Start this stage ── */
      setActiveIdx(i);
      setCurrentSteps([]);
      setAgentProgress(0);
      setAgentPLabel("Starting...");
      setAgentStatuses(prev => prev.map((s, idx) => idx === i ? "working" : s));

      const [from, to] = STAGE_OVERALL_RANGE[i] ?? [0, 100];

      const ctx: ExecutionContext = {
        launchId:     proj.id,
        goal:         proj.goal,
        stageResults: latestResultsRef.current,
        callbacks: {
          onStep:     setCurrentSteps,
          onProgress: (pct, label) => {
            setAgentProgress(pct);
            setAgentPLabel(label);
            // Map agent-internal 0-100 → stage slice of overall 0-100
            const overall = Math.round(from + (pct / 100) * (to - from));
            setOverallPct(overall);
          },
        },
        saveProgress,
      };

      try {
        await stage.execute(ctx);

        /* Stage complete */
        setAgentStatuses(prev => prev.map((s, idx) => idx === i ? "complete" : s));
        setOverallPct(to);

        /* Collect a brief completion summary for the card */
        const research = latestResultsRef.current.research;
        if (stage.id === "research" && research) {
          const insights = research.insights?.length ?? 0;
          const opps     = research.productOpportunities?.length ?? 0;
          setCompletedSummaries(prev => ({
            ...prev,
            [i]: `${insights} insights · ${opps} product opportunities found`,
          }));
        }
      } catch (err) {
        console.error(`[pipeline] Stage ${stage.id} failed:`, err);
        setAgentStatuses(prev => prev.map((s, idx) => idx === i ? "error" : s));
        break;
      }
    }
  }, [buildSaveProgress]);

  /* ── Load project + kick off pipeline ── */
  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    (async () => {
      try {
        const res = await fetch(`/api/launch/${launchId}`);
        if (!res.ok) throw new Error("Not found");
        const data = await res.json() as LaunchProject;
        setProject(data);
        setOverallStatus(data.status);
        setOverallPct(data.progress ?? 0);

        /* Transition queued → running */
        if (data.status === "queued") {
          await fetch(`/api/launch/${launchId}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ status: "running", currentStage: "research" }),
          });
          setOverallStatus("running");
        }

        /* Run the pipeline (only if not already completed) */
        if (data.status !== "completed") {
          await runPipeline(data);
        }
      } catch {
        setLoadError("Could not load this execution. It may not exist.");
      }
    })();
  }, [launchId, runPipeline]);

  /* ─────────────────────────────────────────────────── */

  if (loadError) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <XCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <p className="text-[14px] text-muted-foreground">{loadError}</p>
          <button
            onClick={() => router.push("/dashboard/launch")}
            className="mt-4 text-[13px] text-orange-500 hover:underline"
          >
            ← New execution
          </button>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusMeta = LAUNCH_STATUS_META[overallStatus];

  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">

        {/* Back nav */}
        <button
          onClick={() => router.push("/dashboard/launch")}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ChevronLeft className="w-4 h-4" />
          New execution
        </button>

        {/* ── Header ── */}
        <div className="mb-8">
          <div className="flex items-start gap-3 mb-5">
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1">
                Goal
              </p>
              <h1 className="text-[17px] sm:text-lg font-bold text-foreground leading-snug">
                {project.goal}
              </h1>
            </div>
            <span className={`shrink-0 mt-0.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${statusMeta.cls}`}>
              {statusMeta.label}
            </span>
          </div>

          {/* Overall progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {activeIdx >= 0
                  ? `${PIPELINE_STAGES[activeIdx]?.agentLabel ?? "Agent"} working...`
                  : overallPct >= 100
                    ? "All done"
                    : "Preparing pipeline..."}
              </span>
              <span className="text-[11px] font-bold text-foreground tabular-nums">
                {overallPct}%
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all duration-700"
                style={{ width: `${overallPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Agent cards ── */}
        <div className="space-y-2 mb-8">
          {PIPELINE_STAGES.map((stage, i) => {
            const status = agentStatuses[i] ?? "waiting";
            const isNextUp = status === "waiting" &&
              agentStatuses.slice(0, i).every(s => s === "complete" || s === "waiting") &&
              i === (agentStatuses.findIndex(s => s !== "complete") ?? i);

            return (
              <AgentCard
                key={stage.id}
                stage={stage}
                status={status}
                steps={i === activeIdx ? currentSteps : []}
                agentProgress={i === activeIdx ? agentProgress : 0}
                progressLabel={i === activeIdx ? agentPLabel : ""}
                isNextUp={isNextUp}
                completeSummary={completedSummaries[i]}
              />
            );
          })}
        </div>

        {/* ── Phase note ── */}
        {agentStatuses.some(s => s === "complete") &&
          agentStatuses.some(s => s === "waiting") && (
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex items-start gap-3">
              <PlugZap className="w-4 h-4 text-muted-foreground/40 mt-0.5 shrink-0" />
              <div>
                <p className="text-[12px] font-semibold text-foreground mb-0.5">
                  Phase 1.2 complete — Research Agent running
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Research results are saved to the pipeline. Product, Design, Marketing,
                  and Store agents will connect in the next phases without any UI changes.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
