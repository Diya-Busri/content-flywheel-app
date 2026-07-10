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
  LaunchStatus, LaunchStageId, LaunchStageResults, StageValidation,
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
  stage:             StageConfig;
  status:            AgentStatus;
  steps:             AgentStep[];    // only shown when working
  agentProgress:     number;         // 0-100, only shown when working
  progressLabel:     string;
  isNextUp:          boolean;        // slight visual hint for the next pending agent
  completeSummary?:  string;
  errorMessage?:     string;
  validationResult?: StageValidation;
  onRetry?:          () => void;
  isRetrying?:       boolean;
  demoMode?:         boolean;
}

function AgentCard({
  stage, status, steps, agentProgress, progressLabel, isNextUp, completeSummary,
  errorMessage, validationResult, onRetry, isRetrying, demoMode = false,
}: AgentCardProps) {
  const [stepsExpanded, setStepsExpanded] = useState(true);

  const isWorking       = status === "working";
  const isComplete      = status === "complete";
  const isError         = status === "error";
  const isWaiting       = status === "waiting";
  const isNeedsAttention = status === "needs_attention";

  const borderCls =
    isWorking        ? "border-orange-500/40 shadow-sm shadow-orange-500/5"
    : isComplete     ? "border-green-500/25"
    : isNeedsAttention ? "border-amber-500/40"
    : isError        ? "border-red-500/25"
    : isNextUp       ? "border-border/80"
    :                  "border-border/40";

  const bgCls =
    isWorking        ? "bg-orange-500/[0.03]"
    : isComplete     ? "bg-green-500/[0.03]"
    : isNeedsAttention ? "bg-amber-500/[0.03]"
    : isError        ? "bg-red-500/[0.03]"
    :                  "bg-card/30";

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
          {isComplete ? "✅" : isNeedsAttention ? "⚠️" : isError ? "❌" : stage.emoji}
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
          {isNeedsAttention && validationResult && (
            <div className="mt-1 space-y-2">
              {/* Asset count badge */}
              <p className="text-[11px] text-amber-500 leading-snug">
                {validationResult.passedCount}/{validationResult.totalCount} assets verified
                {validationResult.requiredPass < validationResult.requiredTotal && (
                  <> · {validationResult.requiredTotal - validationResult.requiredPass} required {validationResult.requiredTotal - validationResult.requiredPass === 1 ? "check" : "checks"} failed</>
                )}
              </p>
              {/* Failed checks list */}
              {validationResult.checks.filter(c => c.status !== "pass").length > 0 && (
                <div className="space-y-1">
                  {validationResult.checks.filter(c => c.status !== "pass").map(c => (
                    <div key={c.id} className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                      <span className="text-[10px] text-amber-500/80 leading-snug">{c.reason ?? c.label}</span>
                    </div>
                  ))}
                </div>
              )}
              {onRetry && (
                <button
                  onClick={onRetry}
                  disabled={isRetrying}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-[11px] font-semibold text-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRetrying
                    ? <><Loader2 className="w-3 h-3 animate-spin" />Retrying…</>
                    : <><RefreshCw className="w-3 h-3" />Retry Failed Step</>}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Status badge */}
        <div className="shrink-0 flex items-center gap-1.5">
          {isWorking        && <Loader2       className="w-3.5 h-3.5 text-orange-500 animate-spin" />}
          {isComplete       && <CheckCircle2  className="w-3.5 h-3.5 text-green-500" />}
          {isNeedsAttention && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
          {isError          && <XCircle       className="w-3.5 h-3.5 text-red-400" />}
          {isWaiting        && <Clock         className="w-3.5 h-3.5 text-muted-foreground/30" />}
          <span className={[
            "text-[11px] font-semibold",
            isWorking        ? "text-orange-500"
            : isComplete     ? "text-green-500"
            : isNeedsAttention ? "text-amber-400"
            : isError        ? "text-red-400"
            :                  isNextUp ? "text-muted-foreground/50" : "text-muted-foreground/25",
          ].join(" ")}>
            {isWorking ? "Working" : isComplete ? "Complete" : isNeedsAttention ? "Needs Attention" : isError ? "Error" : "Waiting"}
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

/* ─── Plain-English error translation ───────────────────────────────────────
   Converts raw JS/network errors into messages a creator can act on.
   Falls back to the original message if nothing matches.
──────────────────────────────────────────────────────────────────────────── */
function friendlyError(raw: string, stageId?: string): string {
  const lower = raw.toLowerCase();

  // Network / timeout
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("signal timed out"))
    return "This step took too long to respond. Check your internet connection and try again.";
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("network request failed"))
    return "Couldn't reach the server — check your internet connection and retry.";
  if (lower.includes("503") || lower.includes("service unavailable"))
    return "The AI service is temporarily unavailable. Wait a moment and retry.";
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("too many requests"))
    return "Too many requests right now. Wait 30 seconds and retry.";
  if (lower.includes("401") || lower.includes("unauthorized"))
    return "Your session expired. Refresh the page and try again.";
  if (lower.includes("500") || lower.includes("internal server error"))
    return "Something went wrong on our end. Retry — it usually resolves itself.";

  // OpenAI / generation
  if (lower.includes("openai") && lower.includes("key"))
    return "AI is not configured. Contact support.";
  if (lower.includes("ai returned no sections") || lower.includes("no outline sections"))
    return "The AI didn't return any content. This is rare — retry and it will usually work.";
  if (lower.includes("insufficient content"))
    return "The AI produced very short content for a section. Retry to regenerate it.";
  if (lower.includes("json") || lower.includes("parse") || lower.includes("unexpected token"))
    return "The AI returned an unexpected response. Retry — it will usually work on the second attempt.";

  // Stage-specific
  if (stageId === "research" && (lower.includes("no product opportunit") || lower.includes("no insights")))
    return "Research didn't find enough data for your niche. Try a slightly broader goal and retry.";
  if (stageId === "product" && lower.includes("db insert failed"))
    return "Couldn't save the product to your library. Retry — this is usually a temporary glitch.";
  if (stageId === "design" && lower.includes("without generating any assets"))
    return "No design assets were created. Retry — the AI image service occasionally has brief outages.";
  if (stageId === "store" && lower.includes("no productid"))
    return "Couldn't link the product to your store. Make sure the Product stage completed first.";

  // Fallback — strip raw JS noise, keep it under 120 chars
  const cleaned = raw.replace(/^Error:\s*/i, "").replace(/\s+/g, " ").trim();
  return cleaned.length > 120 ? cleaned.slice(0, 117) + "…" : cleaned;
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
  const [stageErrors,      setStageErrors]      = useState<Record<number, string>>({});
  const [retryingIdx,      setRetryingIdx]      = useState<number | null>(null);
  /* ── Per-stage validation results (for needs_attention cards) ── */
  const [stageValidations, setStageValidations] = useState<Record<number, StageValidation | undefined>>({});

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
  const [resumedStageCount,   setResumedStageCount]   = useState(0);
  const [publishing,          setPublishing]          = useState(false);
  const [publishedOk,         setPublishedOk]         = useState(false);
  const [awaitingApproval,    setAwaitingApproval]    = useState(false);
  // Stores the Promise.resolve() that unblocks the pipeline after approval
  const approvalResolveRef = useRef<(() => void) | null>(null);

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
    // Redirect on both "completed" and "awaiting_approval" (partial success still goes to workspace).
    // "awaiting_approval" means some non-critical assets need attention but the launch is done.
    if (overallStatus !== "completed" && overallStatus !== "awaiting_approval") return;
    // Auto-save all stage summaries to the Founder Knowledge Base
    fetch(`/api/launch/${launchId}/save-to-library`, { method: "POST" }).catch(() => {});
    const seconds = demoMode ? 6 : 3;
    // Only show the demo reveal on a fully clean completion
    if (demoMode && overallStatus === "completed") setShowCompletionReveal(true);
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
          // "completed" transition is gated on validation — pipeline runner handles it
          if (patch.status && patch.status !== "completed") setOverallStatus(patch.status);
        } catch (err) {
          console.error("[saveProgress]", err);
        }
      },
    [launchId],
  );

  /* ── Pipeline runner ── */
  const runPipeline = useCallback(async (proj: LaunchProject, fromStageIdx = 0) => {
    // Deep-copy so we don't mutate the project prop
    const latestResultsRef = { current: { ...(proj.stageResults ?? {}) } };

    // Clear stale results for all stages from the retry point onward.
    // This ensures the skip-check below re-runs them instead of treating
    // partial/failed results as "complete".
    if (fromStageIdx > 0) {
      for (let j = fromStageIdx; j < PIPELINE_STAGES.length; j++) {
        const k = PIPELINE_STAGES[j]!.id as keyof LaunchStageResults;
        delete (latestResultsRef.current as Record<string, unknown>)[k];
      }
    }

    // Mark already-complete stages (resume case: any stage with saved results is shown as complete)
    const initialStatuses: AgentStatus[] = PIPELINE_STAGES.map((stage) => {
      const key = stage.id as keyof LaunchStageResults;
      return latestResultsRef.current[key] ? "complete" : "waiting";
    });
    setAgentStatuses(initialStatuses);

    // Pre-populate completion summaries + validations for stages we're about to skip
    {
      const r = latestResultsRef.current;
      const resumeSummaries: Record<number, string> = {};
      PIPELINE_STAGES.forEach((stage, i) => {
        if (!r[stage.id as keyof LaunchStageResults]) return;
        if (stage.id === "research" && r.research) {
          const insights = r.research.insights?.length ?? 0;
          const opps     = r.research.productOpportunities?.length ?? 0;
          resumeSummaries[i] = `${insights} insights · ${opps} product opportunities found`;
        } else if (stage.id === "product" && r.product) {
          {
            const name    = r.product.productName ?? "Product";
            const rp      = r.product as Record<string, unknown>;
            const fmt     = rp.format     as string | undefined;
            const price   = rp.pricePoint as string | undefined;
            const why     = rp.whyThisOne as string | undefined;
            const fmtStr  = fmt   ? ` · ${fmt.charAt(0).toUpperCase() + fmt.slice(1)}` : "";
            const priceStr = price ? ` · ${price}` : "";
            const whyStr  = why   ? ` — ${why.slice(0, 60)}${why.length > 60 ? "…" : ""}` : "";
            resumeSummaries[i] = `"${name}"${fmtStr}${priceStr}${whyStr}`;
          }
        } else if (stage.id === "design" && r.design) {
          const count = r.design.assetsCount ?? 0;
          resumeSummaries[i] = `${count} marketing asset${count !== 1 ? "s" : ""} generated · cover, mockup, thumbnail, social`;
        } else if (stage.id === "marketing" && r.marketing) {
          const carousels = r.marketing.carousels?.length ?? 0;
          const emails    = r.marketing.emails?.length ?? 0;
          const xPosts    = r.marketing.xPosts?.length ?? 0;
          const tiktoks   = r.marketing.tiktokHooks?.length ?? 0;
          const total     = carousels + emails + xPosts + tiktoks + 9;
          resumeSummaries[i] = `${total}+ assets · launch copy, ${carousels} carousels, ${emails} emails, ${xPosts + tiktoks} posts`;
        } else if (stage.id === "store" && r.store) {
          const score = r.store.readinessScore ?? 0;
          if (r.store.productId) setStoreProductId(r.store.productId);
          if (r.store.storeUrl)  setStoreUrl(r.store.storeUrl);
          resumeSummaries[i] = `Store Readiness ${score}% · ready to publish`;
        }
        // Restore stage validation badge
        const stageData = r[stage.id as keyof LaunchStageResults] as Record<string, unknown> | undefined;
        const validation = stageData?.validation as StageValidation | undefined;
        if (validation) setStageValidations(prev => ({ ...prev, [i]: validation }));
      });
      if (Object.keys(resumeSummaries).length > 0) {
        setCompletedSummaries(prev => ({ ...prev, ...resumeSummaries }));
        setResumedStageCount(Object.keys(resumeSummaries).length);
      }
    }

    const saveProgress = buildSaveProgress(latestResultsRef);

    let hasErrors = false;

    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      const stage = PIPELINE_STAGES[i]!;

      // Skip stages that already have saved results.
      // For explicit retries, data from fromStageIdx onward was cleared above, so those stages run.
      // For resume-from-failure (fromStageIdx=0), previously-completed stages are safely skipped.
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
        memory:       (proj.memory ?? undefined) as Record<string, unknown> | undefined,
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

        /* Stage complete — check validation result */
        const stageResultForVal = latestResultsRef.current[stage.id as keyof LaunchStageResults] as Record<string, unknown> | undefined;
        const valResult = stageResultForVal?.validation as StageValidation | undefined;
        const valStatus = valResult?.status;
        const agentFinalStatus: AgentStatus = valStatus === "needs_attention" ? "needs_attention" : "complete";
        setAgentStatuses(prev => prev.map((s, idx) => idx === i ? agentFinalStatus : s));
        if (valResult) setStageValidations(prev => ({ ...prev, [i]: valResult }));
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
          // ── Approval gate: pause pipeline and let the user review before continuing ──
          setActiveIdx(-1);
          setAwaitingApproval(true);
          await new Promise<void>(resolve => { approvalResolveRef.current = resolve; });
          setAwaitingApproval(false);
        } else if (stage.id === "product" && results.product) {
          const name   = results.product.productName ?? "Product";
          const fmt    = (results.product as Record<string, unknown>).format as string | undefined;
          const price  = (results.product as Record<string, unknown>).pricePoint as string | undefined;
          const why    = (results.product as Record<string, unknown>).whyThisOne as string | undefined;
          const fmtStr = fmt ? ` · ${fmt.charAt(0).toUpperCase() + fmt.slice(1)}` : "";
          const priceStr = price ? ` · ${price}` : "";
          const whyStr = why ? ` — ${why.slice(0, 60)}${why.length > 60 ? "…" : ""}` : "";
          setCompletedSummaries(prev => ({
            ...prev,
            [i]: `"${name}"${fmtStr}${priceStr}${whyStr}`,
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
        const raw = err instanceof Error ? err.message : String(err);
        const msg = friendlyError(raw, stage.id);
        console.error(`[pipeline] Stage ${stage.id} failed:`, raw);
        setAgentStatuses(prev => prev.map((s, idx) => idx === i ? "error" : s));
        setStageErrors(prev => ({ ...prev, [i]: msg }));
        hasErrors = true;
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

    /* ── After all stages: gate "completed" on all validations passing ── */
    const allResults = latestResultsRef.current;
    const hasNeedsAttention = PIPELINE_STAGES.some(s => {
      const r = allResults[s.id as keyof LaunchStageResults] as Record<string, unknown> | undefined;
      return (r?.validation as StageValidation | undefined)?.status === "needs_attention";
    });

    // If any stage errored OR any validation needs attention → awaiting_approval, not "completed"
    const finalStatus: LaunchStatus = (hasErrors || hasNeedsAttention) ? "awaiting_approval" : "completed";
    setOverallStatus(finalStatus);

    // Always write the final status to DB reliably — do NOT rely solely on the store agent's
    // saveProgress call (that PATCH can fail silently). Without this, a page refresh would
    // find status="running" and re-run the entire pipeline from scratch.
    if (hasErrors || hasNeedsAttention) {
      // Sync progress bar to store readiness to fix "100% vs 96%" inconsistency.
      const storeScore = (allResults.store as Record<string, unknown> | undefined)?.readinessScore as number | undefined;
      const syncedPct = storeScore ? Math.min(storeScore, 97) : 97;
      setOverallPct(syncedPct);
      await fetch(`/api/launch/${launchId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: "awaiting_approval", progress: syncedPct }),
      }).catch(() => {});
    } else {
      // Clean completion — explicitly write completed + 100 so refresh restores correctly.
      await fetch(`/api/launch/${launchId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: "completed", progress: 100 }),
      }).catch(() => {});
    }
  }, [buildSaveProgress, demoMode, launchId]);

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

      // runPipeline handles status reset internally via fromStageIdx
      await runPipeline(freshProj, fromIdx);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const msg = friendlyError(raw, PIPELINE_STAGES[fromIdx]?.id);
      console.error("[retry]", raw);
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

        /* Run the pipeline (only if not already completed or awaiting review).
         * "awaiting_approval" = all stages ran but some assets need attention —
         * restore the completed UI and redirect, don't re-run the pipeline. */
        if (data.status !== "completed" && data.status !== "awaiting_approval") {
          setPipelineActive(true);
          try {
            await runPipeline(data);
          } finally {
            setPipelineActive(false);
            setResumedStageCount(0);
          }
        } else {
          /* Already completed (or awaiting review) — restore completed UI from saved results */
          const saved = data.stageResults ?? {} as LaunchStageResults;
          const restoredValidations: Record<number, StageValidation | undefined> = {};
          const restoredStatuses: AgentStatus[] = PIPELINE_STAGES.map((stage, si) => {
            const key = stage.id as keyof LaunchStageResults;
            const r = saved[key] as Record<string, unknown> | undefined;
            const v = r?.validation as StageValidation | undefined;
            if (v) restoredValidations[si] = v;
            if (!r) return "waiting";
            return v?.status === "needs_attention" ? "needs_attention" : "complete";
          });
          setStageValidations(restoredValidations);
          setAgentStatuses(restoredStatuses);
          // For "awaiting_approval" use the stored progress (synced to store readiness).
          // For "completed" fall back to 100.
          setOverallPct(data.status === "awaiting_approval" ? (data.progress ?? 97) : 100);

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

      {/* ── Resume notice ── */}
      {pipelineActive && resumedStageCount > 0 && (
        <div className="sticky top-[38px] z-39 flex items-center gap-2 px-4 py-2 text-[11px] font-medium bg-sky-50 dark:bg-sky-950/60 border-b border-sky-200 dark:border-sky-800/50 text-sky-700 dark:text-sky-300">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M8 1a7 7 0 100 14A7 7 0 008 1zM6.75 5.25a.75.75 0 011.5 0v3.19l1.53 1.53a.75.75 0 01-1.06 1.06l-1.75-1.75A.75.75 0 016.75 8.75V5.25z" clipRule="evenodd"/>
          </svg>
          <span>
            Resumed from previous run — {resumedStageCount} stage{resumedStageCount !== 1 ? "s" : ""} already complete, continuing from where you left off
          </span>
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
                  validationResult={stageValidations[i]}
                  onRetry={status === "error" || status === "needs_attention" ? () => void retryFromStage(i) : undefined}
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

        {/* ── Approval gate — shown after Research, before Product ── */}
        {awaitingApproval && project && (() => {
          const r = project.stageResults?.research;
          const topOpp = r?.productOpportunities?.[0];
          const topInsight = r?.insights?.[0];
          const smartPrice = topOpp?.priceRange ?? "£37";
          return (
            <div className="mt-4 rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/8 via-amber-500/5 to-background p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🔍</span>
                <h3 className="text-[15px] font-black text-foreground">Research Complete — Review Before Building</h3>
              </div>
              {topOpp && (
                <div className="mb-4 p-3 rounded-xl bg-background/60 border border-border/50 text-left">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Recommended Product</p>
                  <p className="text-[14px] font-bold text-foreground">{topOpp.title}</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">{topOpp.description}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[11px] font-semibold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">{topOpp.type}</span>
                    <span className="text-[11px] font-semibold text-muted-foreground">{smartPrice}</span>
                  </div>
                </div>
              )}
              {topInsight && (
                <p className="text-[12px] text-muted-foreground mb-4 italic">
                  &ldquo;{topInsight.slice(0, 120)}{topInsight.length > 120 ? "…" : ""}&rdquo;
                </p>
              )}
              <p className="text-[12px] text-muted-foreground mb-4">
                The AI has identified your best product opportunity. Continue to generate your full digital product, or go back to adjust your goal.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => {
                    approvalResolveRef.current?.();
                    approvalResolveRef.current = null;
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-[14px] font-bold text-white transition-colors shadow-lg shadow-orange-500/20"
                >
                  <Package className="w-4 h-4" />
                  Build This Product
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => router.push("/dashboard/launch")}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-[13px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
                >
                  Start over with a new goal
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── Pipeline complete — success panel ── */}
        {overallStatus === "completed" && (
          <div className="mt-6 rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/8 via-emerald-500/5 to-orange-500/5 p-6 text-center">
            <div className="text-4xl mb-3">🚀</div>
            <h2 className="text-[18px] font-black text-foreground mb-1">Your product is live!</h2>
            <p className="text-[13px] text-muted-foreground mb-2 max-w-xs mx-auto leading-relaxed">
              Research, product, design assets, and marketing copy are all ready in your workspace.
            </p>
            {!publishedOk && (
              <p className="text-[11px] font-semibold text-green-600 dark:text-green-400 mb-5">
                {redirectCountdown !== null
                  ? `Opening workspace in ${redirectCountdown}s…`
                  : "Opening workspace…"}
              </p>
            )}
            {publishedOk && (
              <p className="text-[11px] font-semibold text-green-600 dark:text-green-400 mb-5">
                ✓ Published to your store!
              </p>
            )}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {/* One-click publish — makes product active on the native store */}
              {!publishedOk && (
                <button
                  disabled={publishing}
                  onClick={async () => {
                    setPublishing(true);
                    try {
                      const res = await fetch(`/api/launch/${launchId}/publish`, { method: "POST" });
                      if (res.ok) {
                        setPublishedOk(true);
                        if (storeUrl) {
                          // Redirect to store after a short delay
                          setTimeout(() => router.push(storeUrl), 1500);
                        }
                      }
                    } catch { /* non-fatal */ } finally {
                      setPublishing(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-[14px] font-bold text-white transition-colors shadow-lg shadow-green-600/20"
                >
                  {publishing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Rocket className="w-4 h-4" />
                  )}
                  {publishing ? "Publishing…" : "Publish to Store"}
                </button>
              )}
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
