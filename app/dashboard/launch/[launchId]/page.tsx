/**
 * /dashboard/launch/[launchId] — AI Execution Dashboard
 * ───────────────────────────────────────────────────────
 * Phase 1.6: All 5 agents live — Research, Product, Design, Marketing, Store.
 *
 * Architecture:
 *   • PIPELINE_STAGES config defines every agent slot.
 *   • All slots are wired — the pipeline is complete.
 *   • The pipeline runner iterates stages, skips null slots,
 *     and passes an ExecutionContext to each agent.
 *   • Agent Cards show live steps + per-stage progress.
 *   • Design steps carry imageUrl — images appear live as each renders.
 *   • Marketing streams folder-asset events — campaign folder view updates live.
 *   • Store Agent streams validation checks + readiness score live.
 *   • On completion: Business Summary + Next Actions panel appears.
 */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Sparkles, Package, Palette, Megaphone, Store,
  CheckCircle2, XCircle, Loader2, ChevronLeft,
  Clock, PlugZap, ChevronDown, ChevronUp,
  AlertTriangle, Rocket, RefreshCw, ArrowRight,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

import { runLaunchResearchAgent }   from "@/lib/agents/launch-research-agent";
import { runLaunchProductAgent }    from "@/lib/agents/launch-product-agent";
import { runLaunchDesignAgent }     from "@/lib/agents/launch-design-agent";
import { runLaunchMarketingAgent }  from "@/lib/agents/launch-marketing-agent";
import { runLaunchStoreAgent }      from "@/lib/agents/launch-store-agent";
import type {
  ExecutionContext, AgentStep, AgentStatus, SaveProgressPatch,
  FolderAssetItem, ValidationCheck,
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
    execute:     runLaunchProductAgent,  // ← Phase 1.3: wired
  },
  {
    id:          "design",
    emoji:       "🎨",
    label:       "Design",
    agentLabel:  "Design Agent",
    description: "Generate product cover, mockup, thumbnail, and social preview",
    icon:        Palette,
    execute:     runLaunchDesignAgent,  // ← Phase 1.4: wired
  },
  {
    id:          "marketing",
    emoji:       "📣",
    label:       "Marketing",
    agentLabel:  "Marketing Agent",
    description: "Generate full launch campaign: copy, social posts, and email sequences",
    icon:        Megaphone,
    execute:     runLaunchMarketingAgent,  // ← Phase 1.5: wired
  },
  {
    id:          "store",
    emoji:       "🛍️",
    label:       "Store",
    agentLabel:  "Store Agent",
    description: "Assemble store listing, validate readiness, and prepare for launch",
    icon:        Store,
    execute:     runLaunchStoreAgent,  // ← Phase 1.6: wired
  },
];

/* ─── Overall progress: each stage occupies a 20% slice ── */
const STAGE_OVERALL_RANGE: [number, number][] = [
  [0, 20], [20, 40], [40, 60], [60, 80], [80, 100],
];

const DEMO_MODE_KEY = "cf_launch_demo_mode";
const DEMO_STAGE_MIN_MS = [4600, 5200, 5600, 5000, 4800];

const DEMO_THINKING: Record<LaunchStageId, string[]> = {
  research: [
    "Researching niche signals...",
    "Finding audience pain points...",
    "Scanning competitor gaps...",
    "Ranking product opportunities...",
  ],
  product: [
    "Choosing the strongest product angle...",
    "Building the product structure...",
    "Writing sections from research...",
    "Preparing the product for your library...",
  ],
  design: [
    "Creating visual directions...",
    "Rendering launch assets...",
    "Checking cover and thumbnail fit...",
    "Packaging editable design files...",
  ],
  marketing: [
    "Writing conversion copy...",
    "Creating social launch assets...",
    "Drafting email sequences...",
    "Organising campaign folders...",
  ],
  store: [
    "Assembling the store listing...",
    "Attaching product assets...",
    "Validating launch readiness...",
    "Preparing final launch handoff...",
  ],
  complete: ["Launch ready."],
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function readDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DEMO_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

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
    <div className="py-0.5">
      <div className="flex items-start gap-2">
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
      {/* Image preview — appears when Design Agent streams asset-done */}
      {step.imageUrl && step.status === "done" && (
        <div className="ml-5 mt-1.5 mb-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={step.imageUrl}
            alt={step.label}
            className="rounded-lg border border-border/40 object-cover shadow-sm"
            style={{ maxHeight: 140, maxWidth: "100%", display: "block" }}
          />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MARKETING FOLDER VIEW
   Shows 3 collapsible campaign folders that fill up live.
══════════════════════════════════════════════════════════ */

const FOLDER_CONFIG = [
  { category: "launch" as const, emoji: "🚀", label: "Launch Campaign"   },
  { category: "social" as const, emoji: "📱", label: "Social Media"       },
  { category: "email"  as const, emoji: "📧", label: "Email Marketing"    },
];

function MarketingFolderView({ items }: { items: FolderAssetItem[] }) {
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set(["launch", "social", "email"]));

  const toggle = (cat: string) =>
    setOpenFolders(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });

  return (
    <div className="mt-2 space-y-1.5 pl-1">
      {FOLDER_CONFIG.map(({ category, emoji, label }) => {
        const folderItems = items.filter(it => it.category === category);
        const isOpen      = openFolders.has(category);
        const count       = folderItems.length;

        return (
          <div key={category} className="rounded-lg border border-border/40 overflow-hidden">
            {/* Folder header */}
            <button
              onClick={() => toggle(category)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-muted/20 hover:bg-muted/40 transition-colors"
            >
              <span className="text-base leading-none">{emoji}</span>
              <span className="flex-1 text-[12px] font-semibold text-left text-foreground/80">{label}</span>
              {count > 0 && (
                <span className="text-[10px] font-bold text-muted-foreground/60 bg-muted/60 rounded px-1.5 py-0.5">
                  {count}
                </span>
              )}
              {isOpen
                ? <ChevronUp   className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />}
            </button>

            {/* Folder items */}
            {isOpen && (
              <div className="divide-y divide-border/30">
                {folderItems.length === 0 ? (
                  <div className="px-3 py-2.5 flex items-center gap-2">
                    <Loader2 className="w-3 h-3 text-muted-foreground/30 animate-spin shrink-0" />
                    <span className="text-[11px] text-muted-foreground/40">Generating...</span>
                  </div>
                ) : (
                  folderItems.map(item => (
                    <div key={item.id} className="px-3 py-2">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-foreground/80 truncate">{item.label}</p>
                          {item.preview && (
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5 leading-relaxed line-clamp-2">
                              {item.preview}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STORE READINESS PANEL
   Live validation checklist + animated score circle.
══════════════════════════════════════════════════════════ */

function ReadinessScorePanel({ score, checks }: { score: number; checks: ValidationCheck[] }) {
  const statusIcon = (s: ValidationCheck["status"]) => {
    if (s === "ok"   || s === "fixed")   return <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />;
    if (s === "warning")                  return <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />;
    return <XCircle className="w-3 h-3 text-red-400 shrink-0" />;
  };

  const scoreColor =
    score >= 90 ? "text-green-500"
    : score >= 70 ? "text-amber-400"
    :               "text-red-400";

  const ringColor =
    score >= 90 ? "#22c55e"
    : score >= 70 ? "#fbbf24"
    :               "#f87171";

  const circumference = 2 * Math.PI * 28; // r=28
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="mt-2 rounded-lg border border-border/40 overflow-hidden">
      {/* Score header */}
      <div className="flex items-center gap-4 px-4 py-3 bg-muted/10">
        {/* Score circle */}
        <div className="relative shrink-0 w-16 h-16">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor"
              className="text-muted/30" strokeWidth="5" />
            <circle cx="32" cy="32" r="28" fill="none"
              stroke={ringColor} strokeWidth="5"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-[13px] font-black tabular-nums ${scoreColor}`}>{score}%</span>
          </div>
        </div>
        <div>
          <p className="text-[13px] font-bold text-foreground">Store Readiness</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {score >= 90
              ? "Ready to publish 🚀"
              : score >= 70
                ? "Almost there — a few things to fix"
                : "Needs attention before publishing"}
          </p>
        </div>
      </div>

      {/* Check list */}
      {checks.length > 0 && (
        <div className="divide-y divide-border/30">
          {checks.map(check => (
            <div key={check.id} className="flex items-start gap-2.5 px-4 py-2">
              <div className="mt-0.5">{statusIcon(check.status)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-foreground/80">{check.label}</p>
                {check.detail && (
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{check.detail}</p>
                )}
              </div>
              <span className={[
                "text-[9px] font-bold uppercase tracking-wide shrink-0 mt-0.5",
                check.status === "ok"      ? "text-green-500"
                : check.status === "fixed"   ? "text-blue-400"
                : check.status === "warning" ? "text-amber-400"
                :                              "text-red-400",
              ].join(" ")}>
                {check.status === "fixed" ? "Auto-fixed" : check.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Streaming placeholder */}
      {checks.length === 0 && (
        <div className="px-4 py-3 flex items-center gap-2">
          <Loader2 className="w-3 h-3 text-muted-foreground/30 animate-spin shrink-0" />
          <span className="text-[11px] text-muted-foreground/40">Validating...</span>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   NOTE: BusinessSummaryPanel removed in Phase 1.7.
   Post-completion UI now lives at:
     /dashboard/launch/[launchId]/workspace
   The execution page auto-redirects there on completion.
══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   AGENT CARD
══════════════════════════════════════════════════════════ */
interface AgentCardProps {
  stage:           StageConfig;
  status:          AgentStatus;
  steps:           AgentStep[];    // only shown when working
  agentProgress:   number;         // 0-100, only shown when working
  progressLabel:   string;
  isNextUp:        boolean;        // slight visual hint for the next pending agent
  completeSummary?: string;
  errorMessage?:   string;
  onRetry?:        () => void;
  isRetrying?:     boolean;
  demoMode?:       boolean;
}

function AgentCard({
  stage, status, steps, agentProgress, progressLabel, isNextUp, completeSummary,
  errorMessage, onRetry, isRetrying, demoMode = false,
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
    <div className={[
      "relative overflow-hidden rounded-xl border transition-all duration-500",
      borderCls,
      bgCls,
      demoMode && isWorking ? "cf-demo-pulse-glow" : "",
    ].join(" ")}>
      {demoMode && isWorking && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/80 to-transparent cf-demo-shimmer" />
          <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-orange-500/10 to-transparent cf-demo-scan-line" />
        </div>
      )}
      {/* ── Card header ── */}
      <div className="relative flex items-center gap-3 px-4 py-3">
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
            <div className="mt-1 space-y-2">
              <p className="text-[11px] text-red-400 leading-snug">
                {errorMessage ?? "Agent failed — please retry"}
              </p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  disabled={isRetrying}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-[11px] font-semibold text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRetrying
                    ? <><Loader2 className="w-3 h-3 animate-spin" />Retrying…</>
                    : <><RefreshCw className="w-3 h-3" />Retry {stage.agentLabel}</>}
                </button>
              )}
            </div>
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
            <div className="relative h-1 bg-muted/50 rounded-full overflow-hidden">
              <div
                className={[
                  "h-full rounded-full transition-all ease-out",
                  demoMode ? "bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 duration-1000 cf-demo-progress-shimmer" : "bg-orange-500 duration-500",
                ].join(" ")}
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

  /* ── Marketing campaign folder items (streamed live) ── */
  const [marketingFolderItems, setMarketingFolderItems] = useState<FolderAssetItem[]>([]);

  /* ── Store Agent: validation checks + readiness score (streamed live) ── */
  const [storeChecks,    setStoreChecks]    = useState<ValidationCheck[]>([]);
  const [storeScore,     setStoreScore]     = useState<number>(0);
  const [storeProductId, setStoreProductId] = useState<string>("");
  const [storeUrl,       setStoreUrl]       = useState<string>("");

  /* ── Per-stage error messages ── */
  const [stageErrors,  setStageErrors]  = useState<Record<number, string>>({});
  const [retryingIdx,  setRetryingIdx]  = useState<number | null>(null);

  /* ── Overall progress ── */
  const [overallPct, setOverallPct] = useState<number>(0);
  const [overallStatus, setOverallStatus] = useState<LaunchStatus>("queued");

  /* ── Route-leave guard ── */
  const [pipelineActive,    setPipelineActive]    = useState(false);
  const [leaveConfirmOpen,  setLeaveConfirmOpen]  = useState(false);

  /* ── Auto-redirect to workspace on pipeline completion ── */
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const [demoMode, setDemoMode] = useState(() => readDemoMode());
  const [demoThinkingIdx, setDemoThinkingIdx] = useState(0);
  const [showCompletionReveal, setShowCompletionReveal] = useState(false);

  useEffect(() => {
    setDemoMode(readDemoMode());
    const handleDemoMode = (event: Event) => {
      const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
      setDemoMode(typeof enabled === "boolean" ? enabled : readDemoMode());
    };
    window.addEventListener("cf:launch-demo-mode", handleDemoMode);
    return () => window.removeEventListener("cf:launch-demo-mode", handleDemoMode);
  }, []);

  useEffect(() => {
    if (!demoMode || activeIdx < 0) {
      setDemoThinkingIdx(0);
      return;
    }
    const interval = setInterval(() => {
      const stageId = PIPELINE_STAGES[activeIdx]?.id ?? "complete";
      const count = DEMO_THINKING[stageId]?.length ?? 1;
      setDemoThinkingIdx(i => (i + 1) % count);
    }, 1800);
    return () => clearInterval(interval);
  }, [activeIdx, demoMode]);

  useEffect(() => {
    if (overallStatus !== "completed") return;
    // Auto-save all stage summaries to the Founder Knowledge Base
    fetch(`/api/launch/${launchId}/save-to-library`, { method: "POST" }).catch(() => {});
    const seconds = demoMode ? 6 : 3;
    if (demoMode) setShowCompletionReveal(true);
    setRedirectCountdown(seconds);
    const interval = setInterval(() => {
      setRedirectCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          router.push(`/dashboard/launch/${launchId}/workspace`);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [overallStatus, launchId, router, demoMode]);

  /* ── Warn on tab close / hard refresh while pipeline is running ── */
  useEffect(() => {
    if (!pipelineActive) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [pipelineActive]);

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
          // Marketing Agent: stream campaign folder assets live
          ...(stage.id === "marketing" ? {
            onFolderAsset: (item: FolderAssetItem) => {
              setMarketingFolderItems(prev => [...prev, item]);
            },
          } : {}),
          // Store Agent: stream validation checks + score live
          ...(stage.id === "store" ? {
            onValidationCheck: (check: ValidationCheck) => {
              setStoreChecks(prev => [...prev, check]);
            },
            onReadinessScore: (score: number, checks: ValidationCheck[]) => {
              setStoreScore(score);
              setStoreChecks(checks);
            },
          } : {}),
        },
        saveProgress,
      };

      try {
        // Clear any previous error for this stage on retry
        setStageErrors(prev => { const n = { ...prev }; delete n[i]; return n; });

        await Promise.all([
          stage.execute(ctx),
          demoMode ? sleep(DEMO_STAGE_MIN_MS[i] ?? 4800) : Promise.resolve(),
        ]);

        /* Stage complete */
        setAgentStatuses(prev => prev.map((s, idx) => idx === i ? "complete" : s));
        setOverallPct(to);

        /* Collect a brief completion summary for the card */
        const results = latestResultsRef.current;
        if (stage.id === "research" && results.research) {
          const insights = results.research.insights?.length ?? 0;
          const opps     = results.research.productOpportunities?.length ?? 0;
          setCompletedSummaries(prev => ({
            ...prev,
            [i]: `${insights} insights · ${opps} product opportunities found`,
          }));
        } else if (stage.id === "product" && results.product) {
          const name = results.product.productName ?? "Product";
          setCompletedSummaries(prev => ({
            ...prev,
            [i]: `"${name}" created · ready in Digital Products`,
          }));
        } else if (stage.id === "design" && results.design) {
          const count = results.design.assetsCount ?? 0;
          setCompletedSummaries(prev => ({
            ...prev,
            [i]: `${count} marketing asset${count !== 1 ? "s" : ""} generated · cover, mockup, thumbnail, social`,
          }));
        } else if (stage.id === "marketing" && results.marketing) {
          const carousels = results.marketing.carousels?.length ?? 0;
          const emails    = results.marketing.emails?.length ?? 0;
          const xPosts    = results.marketing.xPosts?.length ?? 0;
          const tiktoks   = results.marketing.tiktokHooks?.length ?? 0;
          const total     = carousels + emails + xPosts + tiktoks + 9;
          setCompletedSummaries(prev => ({
            ...prev,
            [i]: `${total}+ assets · launch copy, ${carousels} carousels, ${emails} emails, ${xPosts + tiktoks} posts`,
          }));
        } else if (stage.id === "store" && results.store) {
          const score = results.store.readinessScore ?? 0;
          setStoreProductId(results.store.productId ?? "");
          setStoreUrl(results.store.storeUrl ?? "");
          setCompletedSummaries(prev => ({
            ...prev,
            [i]: `Store Readiness ${score}% · ready to publish`,
          }));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[pipeline] Stage ${stage.id} failed:`, msg);
        setAgentStatuses(prev => prev.map((s, idx) => idx === i ? "error" : s));
        setStageErrors(prev => ({ ...prev, [i]: msg }));
        // Persist failed status to DB so page reloads show correct state
        await fetch(`/api/launch/${launchId}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ status: "failed" }),
        }).catch(() => {});
        // Continue to next stage — later stages may still succeed
        continue;
      }
    }
  }, [buildSaveProgress, demoMode]);

  /* ── Retry a failed stage (and everything downstream) ── */
  const retryFromStage = useCallback(async (fromIdx: number) => {
    setRetryingIdx(fromIdx);
    setStageErrors(prev => { const n = { ...prev }; delete n[fromIdx]; return n; });

    try {
      // Re-fetch project to get latest stageResults
      const res = await fetch(`/api/launch/${launchId}`);
      if (!res.ok) throw new Error("Could not reload project");
      const freshProj = await res.json() as LaunchProject;
      setProject(freshProj);

      // Restore running status so the header badge updates
      await fetch(`/api/launch/${launchId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: "running" }),
      }).catch(() => {});
      setOverallStatus("running");

      // Reset statuses from the retry point onward (keep completed stages intact)
      setAgentStatuses(prev => prev.map((s, idx) =>
        idx === fromIdx ? "waiting" : idx > fromIdx && s !== "complete" ? "waiting" : s
      ));

      await runPipeline(freshProj);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[retry]", msg);
      setStageErrors(prev => ({ ...prev, [fromIdx]: msg }));
    } finally {
      setRetryingIdx(null);
    }
  }, [launchId, runPipeline]);

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
          setPipelineActive(true);
          try {
            await runPipeline(data);
          } finally {
            setPipelineActive(false);
          }
        } else {
          /* Already completed — restore completed UI from saved results */
          const saved = data.stageResults ?? {} as LaunchStageResults;
          const restoredStatuses: AgentStatus[] = PIPELINE_STAGES.map(stage => {
            const key = stage.id as keyof LaunchStageResults;
            return saved[key] ? "complete" : "waiting";
          });
          setAgentStatuses(restoredStatuses);
          setOverallPct(100);

          /* Restore per-card completion summaries */
          const summaries: Record<number, string> = {};
          PIPELINE_STAGES.forEach((stage, i) => {
            if (stage.id === "research" && saved.research) {
              const insights = saved.research.insights?.length ?? 0;
              const opps     = saved.research.productOpportunities?.length ?? 0;
              summaries[i]   = `${insights} insights · ${opps} product opportunities found`;
            } else if (stage.id === "product" && saved.product) {
              const name   = saved.product.productName ?? "Product";
              summaries[i] = `"${name}" created · ready in Digital Products`;
            } else if (stage.id === "design" && saved.design) {
              const count  = saved.design.assetsCount ?? 0;
              summaries[i] = `${count} marketing asset${count !== 1 ? "s" : ""} generated · cover, mockup, thumbnail, social`;
            } else if (stage.id === "marketing" && saved.marketing) {
              const carousels = saved.marketing.carousels?.length ?? 0;
              const emails    = saved.marketing.emails?.length ?? 0;
              const xPosts    = saved.marketing.xPosts?.length ?? 0;
              const tiktoks   = saved.marketing.tiktokHooks?.length ?? 0;
              const total     = carousels + emails + xPosts + tiktoks + 9;
              summaries[i]    = `${total}+ assets · launch copy, ${carousels} carousels, ${emails} emails, ${xPosts + tiktoks} posts`;
            } else if (stage.id === "store" && saved.store) {
              const score  = saved.store.readinessScore ?? 0;
              setStoreProductId(saved.store.productId ?? "");
              setStoreUrl(saved.store.storeUrl ?? "");
              summaries[i] = `Store Readiness ${score}% · ready to publish`;
            }
          });
          setCompletedSummaries(summaries);
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
  const activeStage = activeIdx >= 0 ? PIPELINE_STAGES[activeIdx] : null;
  const activeThinking = activeStage
    ? DEMO_THINKING[activeStage.id]?.[demoThinkingIdx % (DEMO_THINKING[activeStage.id]?.length || 1)]
    : "Preparing launch pipeline...";

  return (
    <div className="relative min-h-dvh bg-background">
      {demoMode && (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div className="absolute left-1/2 top-[-18rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="absolute bottom-[-16rem] right-[-10rem] h-[30rem] w-[30rem] rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="absolute left-[12%] top-[22%] h-1.5 w-1.5 rounded-full bg-orange-300/60 cf-demo-particle-one" />
          <div className="absolute right-[18%] top-[34%] h-1 w-1 rounded-full bg-amber-200/60 cf-demo-particle-two" />
          <div className="absolute left-[22%] bottom-[26%] h-1 w-1 rounded-full bg-emerald-200/50 cf-demo-particle-three" />
        </div>
      )}

      {/* ── Pipeline-active warning banner ── */}
      {pipelineActive && (
        <div className="sticky top-0 z-40 flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-medium bg-amber-50 dark:bg-amber-950/70 border-b border-amber-200 dark:border-amber-700/50 text-amber-800 dark:text-amber-200">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-amber-600 dark:text-amber-400" />
          <span>AI pipeline is running — keep this tab open for live updates</span>
        </div>
      )}

      {/* ── Leave confirmation ── */}
      <ConfirmDialog
        open={leaveConfirmOpen}
        onOpenChange={setLeaveConfirmOpen}
        title="Leave while AI is running?"
        description="The pipeline will stop and you may lose progress. You can restart from the Projects page, but completed stages won't re-run."
        confirmLabel="Leave anyway"
        cancelLabel="Stay here"
        variant="warning"
        onConfirm={() => { setLeaveConfirmOpen(false); router.push("/dashboard/launch"); }}
      />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8 sm:py-12">

        {/* Back nav */}
        <button
          onClick={() => {
            if (pipelineActive) { setLeaveConfirmOpen(true); return; }
            router.push("/dashboard/launch");
          }}
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
            <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={[
                  "h-full rounded-full transition-all ease-out",
                  demoMode ? "bg-gradient-to-r from-orange-400 via-amber-300 to-emerald-400 duration-1000 cf-demo-progress-shimmer" : "bg-orange-500 duration-700",
                ].join(" ")}
                style={{ width: `${overallPct}%` }}
              />
            </div>
          </div>

          {demoMode && activeStage && overallStatus !== "completed" && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-background/70 px-4 py-3 shadow-2xl shadow-orange-500/10 backdrop-blur-xl cf-demo-soft-reveal">
              <div className="flex items-center gap-3">
                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-orange-400/25 bg-orange-500/10">
                  <activeStage.icon className="h-4 w-4 text-orange-400" />
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/40 animate-pulse" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-orange-400/80">
                    AI agents communicating
                  </p>
                  <p className="mt-0.5 truncate text-[13px] font-semibold text-foreground">
                    {activeThinking}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-1.5">
                  {[0, 1, 2].map(dot => (
                    <span
                      key={dot}
                      className="h-1.5 w-1.5 rounded-full bg-orange-300/70"
                      style={{ animation: `cf-demo-dot 1.2s ease-in-out ${dot * 0.16}s infinite` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Agent cards ── */}
        <div className="space-y-2 mb-8">
          {PIPELINE_STAGES.map((stage, i) => {
            const status = agentStatuses[i] ?? "waiting";
            const isNextUp = status === "waiting" &&
              agentStatuses.slice(0, i).every(s => s === "complete" || s === "waiting") &&
              i === (agentStatuses.findIndex(s => s !== "complete") ?? i);

            const showFolders =
              stage.id === "marketing" &&
              (status === "working" || status === "complete") &&
              marketingFolderItems.length > 0;

            const showReadiness =
              stage.id === "store" &&
              (status === "working" || status === "complete");

            return (
              <div key={stage.id}>
                <AgentCard
                  stage={stage}
                  status={status}
                  steps={i === activeIdx ? currentSteps : []}
                  agentProgress={i === activeIdx ? agentProgress : 0}
                  progressLabel={i === activeIdx ? agentPLabel : ""}
                  isNextUp={isNextUp}
                  completeSummary={completedSummaries[i]}
                  errorMessage={stageErrors[i]}
                  onRetry={status === "error" ? () => void retryFromStage(i) : undefined}
                  isRetrying={retryingIdx === i}
                  demoMode={demoMode}
                />
                {showFolders && (
                  <MarketingFolderView items={marketingFolderItems} />
                )}
                {showReadiness && (
                  <ReadinessScorePanel score={storeScore} checks={storeChecks} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Pipeline complete — success panel ── */}
        {overallStatus === "completed" && (
          <div className="mt-6 rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/8 via-emerald-500/5 to-orange-500/5 p-6 text-center">
            <div className="text-4xl mb-3">🚀</div>
            <h2 className="text-[18px] font-black text-foreground mb-1">Your product is live!</h2>
            <p className="text-[13px] text-muted-foreground mb-2 max-w-xs mx-auto leading-relaxed">
              Research, product, design assets, and marketing copy are all ready in your workspace.
            </p>
            <p className="text-[11px] font-semibold text-green-600 dark:text-green-400 mb-5">
              {redirectCountdown !== null
                ? `Opening workspace in ${redirectCountdown}s…`
                : "Opening workspace…"}
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={() => router.push(`/dashboard/launch/${launchId}/workspace`)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-[14px] font-bold text-white transition-colors shadow-lg shadow-orange-500/20"
              >
                <Rocket className="w-4 h-4" />
                Open Workspace
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => router.push("/dashboard/projects")}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-[13px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
              >
                View all projects
              </button>
            </div>
          </div>
        )}

      </div>

      {demoMode && showCompletionReveal && overallStatus === "completed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-6 backdrop-blur-xl cf-demo-soft-reveal">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-emerald-400/20 bg-card/80 p-8 text-center shadow-2xl shadow-emerald-500/20">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300 to-transparent cf-demo-shimmer" />
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10 cf-demo-pulse-glow">
              <Rocket className="h-7 w-7 text-emerald-300" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-emerald-300/80">
              Launch Ready
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-foreground">
              Your AI launch is built.
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              Research, product, design, marketing, and store setup are ready for review.
            </p>
            <div className="mx-auto mt-6 h-1.5 max-w-xs overflow-hidden rounded-full bg-muted/50">
              <div className="h-full w-full rounded-full bg-gradient-to-r from-orange-400 via-amber-300 to-emerald-300 cf-demo-progress-shimmer" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
