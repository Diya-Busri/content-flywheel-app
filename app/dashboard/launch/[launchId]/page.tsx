/**
 * /dashboard/launch/[launchId]
 * ─────────────────────────────
 * Phase 1.1 — Orchestration skeleton only. No AI generation.
 *
 * Architecture:
 *   • PIPELINE_STAGES config array defines every stage.
 *   • Each stage has an `execute` slot (null in Phase 1.1).
 *   • Future phases fill `execute` per-stage to plug agents in
 *     without touching the UI layout.
 *   • State is persisted to DB via PATCH /api/launch/[launchId].
 */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Sparkles, Package, Palette, Megaphone, Store,
  Clock, CheckCircle2, XCircle, Loader2, ChevronLeft,
  PlugZap,
} from "lucide-react";
import type { LaunchStatus, LaunchStageId, LaunchStageResults } from "@/db/schema/launch-schema";

/* ─────────────────────────────────────────────────────────────
   Stage config
   Future phases: implement `execute` on each stage.
───────────────────────────────────────────────────────────── */
type StageStatus = "pending" | "queued" | "running" | "complete" | "error";

interface StageConfig {
  id:          LaunchStageId;
  label:       string;
  description: string;
  icon:        React.ElementType;
  /** Phase 1.1: null. Phase 1.2+: async fn that does the work. */
  execute:     ((ctx: ExecutionContext) => Promise<void>) | null;
}

interface ExecutionContext {
  launchId:    string;
  goal:        string;
  stageResults: LaunchStageResults;
  saveProgress: (patch: {
    currentStage?: LaunchStageId;
    progress?:     number;
    status?:       LaunchStatus;
    stageResults?: Partial<LaunchStageResults>;
  }) => Promise<void>;
}

const PIPELINE_STAGES: StageConfig[] = [
  {
    id:          "research",
    label:       "Research",
    description: "Market analysis, audience profiling, and competitor intelligence",
    icon:        Sparkles,
    execute:     null, // Phase 1.2: plug in Research agent
  },
  {
    id:          "product",
    label:       "Product",
    description: "Generate a complete digital product with sections and content",
    icon:        Package,
    execute:     null, // Phase 1.3: plug in Product agent
  },
  {
    id:          "design",
    label:       "Design",
    description: "Create carousel slides and visual social media assets",
    icon:        Palette,
    execute:     null, // Phase 1.4: plug in Design agent
  },
  {
    id:          "marketing",
    label:       "Marketing",
    description: "Write launch captions, email subject lines, and hashtag sets",
    icon:        Megaphone,
    execute:     null, // Phase 1.5: plug in Marketing agent
  },
  {
    id:          "store",
    label:       "Store",
    description: "List the product, configure pricing, and publish to your store",
    icon:        Store,
    execute:     null, // Phase 1.6: plug in Store agent
  },
];

/* Progress per stage index (0-based) when that stage completes */
const STAGE_PROGRESS = [20, 40, 60, 80, 100];

/* ─────────────────────────────────────────────────────────────
   DB project shape (subset we care about)
───────────────────────────────────────────────────────────── */
interface LaunchProject {
  id:           string;
  goal:         string;
  status:       LaunchStatus;
  currentStage: LaunchStageId;
  progress:     number;
  stageResults: LaunchStageResults | null;
  createdAt:    string;
}

/* ─────────────────────────────────────────────────────────────
   Status badge helpers
───────────────────────────────────────────────────────────── */
const STATUS_META: Record<LaunchStatus, { label: string; color: string }> = {
  queued:            { label: "Queued",           color: "bg-muted text-muted-foreground" },
  running:           { label: "Running",          color: "bg-blue-500/10 text-blue-500 border border-blue-500/20" },
  awaiting_approval: { label: "Needs Review",     color: "bg-amber-500/10 text-amber-500 border border-amber-500/20" },
  completed:         { label: "Complete",         color: "bg-green-500/10 text-green-500 border border-green-500/20" },
  failed:            { label: "Failed",           color: "bg-red-500/10 text-red-500 border border-red-500/20" },
};

const STAGE_STATUS_META: Record<StageStatus, { label: string; icon: React.ElementType; color: string }> = {
  pending:  { label: "Pending",  icon: Clock,        color: "text-muted-foreground/50" },
  queued:   { label: "Queued",   icon: Clock,        color: "text-muted-foreground" },
  running:  { label: "Running",  icon: Loader2,      color: "text-blue-500" },
  complete: { label: "Complete", icon: CheckCircle2, color: "text-green-500" },
  error:    { label: "Error",    icon: XCircle,      color: "text-red-500" },
};

/* ─────────────────────────────────────────────────────────────
   Stage card component
───────────────────────────────────────────────────────────── */
function StageCard({
  stage, index, status, isActive, agentSlotFilled,
}: {
  stage:          StageConfig;
  index:          number;
  status:         StageStatus;
  isActive:       boolean;
  agentSlotFilled: boolean;
}) {
  const Icon       = stage.icon;
  const meta       = STAGE_STATUS_META[status];
  const StatusIcon = meta.icon;

  return (
    <div className={[
      "relative rounded-xl border transition-all duration-300",
      isActive
        ? "border-orange-500/40 bg-orange-500/5 shadow-sm shadow-orange-500/5"
        : status === "complete"
          ? "border-green-500/20 bg-green-500/5"
          : "border-border bg-card/50",
    ].join(" ")}>

      {/* Stage number connector line */}
      {index > 0 && (
        <div className="absolute -top-px left-7 w-px h-px">
          {/* visual handled by gap spacing */}
        </div>
      )}

      <div className="flex items-start gap-4 p-4">

        {/* Step number + icon */}
        <div className={[
          "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border transition-colors",
          status === "complete"
            ? "bg-green-500/10 border-green-500/30"
            : isActive
              ? "bg-orange-500/10 border-orange-500/30"
              : "bg-muted/50 border-border",
        ].join(" ")}>
          <Icon className={[
            "w-5 h-5",
            status === "complete" ? "text-green-500"
              : isActive ? "text-orange-500"
              : "text-muted-foreground/40",
          ].join(" ")} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[13px] font-bold text-foreground">{stage.label}</span>
            <span className="text-[10px] font-semibold text-muted-foreground/40">Stage {index + 1}</span>
          </div>
          <p className="text-[12px] text-muted-foreground leading-snug">{stage.description}</p>

          {/* Agent slot indicator */}
          <div className="mt-2 flex items-center gap-1.5">
            <PlugZap className="w-3 h-3 text-muted-foreground/30" />
            <span className="text-[10px] text-muted-foreground/40">
              {agentSlotFilled ? "Agent connected" : "Agent slot — available in next phase"}
            </span>
          </div>
        </div>

        {/* Status badge */}
        <div className={`shrink-0 flex items-center gap-1 pt-0.5 ${meta.color}`}>
          <StatusIcon className={`w-3.5 h-3.5 ${status === "running" ? "animate-spin" : ""}`} />
          <span className="text-[11px] font-semibold">{meta.label}</span>
        </div>

      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────────── */
export default function LaunchExecutionPage() {
  const { launchId } = useParams<{ launchId: string }>();
  const router       = useRouter();

  const [project,      setProject]      = useState<LaunchProject | null>(null);
  const [stageStatuses, setStageStatuses] = useState<StageStatus[]>(
    PIPELINE_STAGES.map(() => "pending")
  );
  const [loadError,    setLoadError]    = useState<string | null>(null);
  const hasStarted = useRef(false);

  /* ── Persist progress to DB ── */
  const saveProgress = useCallback(async (patch: {
    currentStage?: LaunchStageId;
    progress?:     number;
    status?:       LaunchStatus;
    stageResults?: Partial<LaunchStageResults>;
  }) => {
    try {
      await fetch(`/api/launch/${launchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch (err) {
      console.error("[saveProgress]", err);
    }
  }, [launchId]);

  /* ── Load project ── */
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    (async () => {
      try {
        const res = await fetch(`/api/launch/${launchId}`);
        if (!res.ok) throw new Error("Project not found");
        const data = await res.json() as LaunchProject;
        setProject(data);

        // Transition queued → running
        if (data.status === "queued") {
          await saveProgress({ status: "running", currentStage: "research" });
          setProject((p) => p ? { ...p, status: "running", currentStage: "research" } : p);
        }

        // Restore existing stage statuses from DB
        restoreStageStatuses(data);

      } catch {
        setLoadError("Could not load this execution. It may not exist or you may not have access.");
      }
    })();
  }, [launchId, saveProgress]);

  /* ── Restore stage statuses when resuming ── */
  const restoreStageStatuses = (data: LaunchProject) => {
    const stageIds = PIPELINE_STAGES.map((s) => s.id);
    const currentIdx = stageIds.indexOf(data.currentStage);
    const statuses: StageStatus[] = PIPELINE_STAGES.map((s, i) => {
      if (data.stageResults?.[s.id as keyof LaunchStageResults]) return "complete";
      if (i === currentIdx && data.status === "running")             return "queued";
      return "pending";
    });
    setStageStatuses(statuses);
  };

  /* ── Derived values ── */
  const currentStageIdx = project
    ? PIPELINE_STAGES.findIndex((s) => s.id === project.currentStage)
    : 0;

  const overallProgress = project?.progress ?? 0;
  const statusMeta = project ? STATUS_META[project.status] : STATUS_META["queued"];

  /* ── Loading state ── */
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
            ← Back to Launch
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

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1">
                Goal
              </p>
              <h1 className="text-[18px] sm:text-xl font-bold text-foreground leading-snug">
                {project.goal}
              </h1>
            </div>
            <span className={`shrink-0 mt-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${statusMeta.color}`}>
              {statusMeta.label}
            </span>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                Stage {Math.min(currentStageIdx + 1, PIPELINE_STAGES.length)} of {PIPELINE_STAGES.length}
                {" · "}{PIPELINE_STAGES[currentStageIdx]?.label ?? "Complete"}
              </span>
              <span className="text-[11px] font-semibold text-foreground">{overallProgress}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all duration-700"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stage cards */}
        <div className="space-y-2 mb-8">
          {PIPELINE_STAGES.map((stage, i) => (
            <StageCard
              key={stage.id}
              stage={stage}
              index={i}
              status={stageStatuses[i]}
              isActive={i === currentStageIdx && project.status === "running"}
              agentSlotFilled={stage.execute !== null}
            />
          ))}
        </div>

        {/* Phase 1.1 info banner */}
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <PlugZap className="w-4 h-4 text-muted-foreground/50 mt-0.5 shrink-0" />
            <div>
              <p className="text-[12px] font-semibold text-foreground mb-0.5">
                Phase 1.1 — Orchestration layer ready
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                The execution pipeline, DB persistence, and stage architecture are in place.
                Each stage above is a slot — AI agents will plug in during the next phases
                without any changes to this page.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
