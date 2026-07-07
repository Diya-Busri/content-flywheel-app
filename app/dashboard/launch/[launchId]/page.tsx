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
  AlertTriangle, ExternalLink, Copy, Rocket,
} from "lucide-react";

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
   BUSINESS SUMMARY PANEL
   Shown when all agents complete.
══════════════════════════════════════════════════════════ */

interface BusinessSummaryProps {
  stageResults:  Record<string, unknown>;
  storeScore:    number;
  storeProductId: string;
  storeUrl:      string;
  router:        ReturnType<typeof import("next/navigation").useRouter>;
}

function BusinessSummaryPanel({
  stageResults, storeScore, storeProductId, storeUrl, router,
}: BusinessSummaryProps) {
  const research  = stageResults.research  as Record<string, unknown> | undefined;
  const product   = stageResults.product   as { productName?: string; productId?: string } | undefined;
  const design    = stageResults.design    as { assetsCount?: number } | undefined;
  const marketing = stageResults.marketing as Record<string, unknown> | undefined;

  const insights  = (research?.insights as unknown[] | undefined)?.length ?? 0;
  const opps      = (research?.productOpportunities as unknown[] | undefined)?.length ?? 0;
  const carousels = (marketing?.carousels as unknown[] | undefined)?.length ?? 0;
  const emails    = (marketing?.emails    as unknown[] | undefined)?.length ?? 0;
  const xPosts    = (marketing?.xPosts    as unknown[] | undefined)?.length ?? 0;
  const tiktoks   = (marketing?.tiktokHooks as unknown[] | undefined)?.length ?? 0;
  const marketingTotal = carousels + emails + xPosts + tiktoks + 9;

  const summaryItems = [
    { emoji: "🔍", label: "Research",          detail: `${insights} insights · ${opps} opportunities found` },
    { emoji: "✍️", label: "Product",           detail: `"${product?.productName ?? "Digital Product"}" created` },
    { emoji: "🎨", label: "Design Assets",     detail: `${design?.assetsCount ?? 4} images generated` },
    { emoji: "📣", label: "Marketing Campaign",detail: `${marketingTotal}+ assets — launch copy, social, email` },
    { emoji: "🛍️",label: "Store",             detail: `Readiness ${storeScore}% · all fields populated` },
  ];

  const productId = storeProductId || (product?.productId ?? "");

  const copyLink = () => {
    if (storeUrl) void navigator.clipboard.writeText(storeUrl);
  };

  return (
    <div className="mt-8 space-y-4">
      {/* Celebration header */}
      <div className="rounded-2xl border border-green-500/20 bg-green-500/[0.03] p-5 text-center">
        <div className="text-3xl mb-2">🎉</div>
        <h2 className="text-[16px] font-black text-foreground mb-1">Your business is ready to launch.</h2>
        <p className="text-[12px] text-muted-foreground">
          Every agent has finished. Your product, design, marketing, and store are all assembled.
        </p>
      </div>

      {/* Summary items */}
      <div className="rounded-xl border border-border/40 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border/40 bg-muted/10">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50">
            What was built
          </p>
        </div>
        <div className="divide-y divide-border/30">
          {summaryItems.map(item => (
            <div key={item.label} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-base shrink-0">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-foreground">{item.label}</p>
                <p className="text-[11px] text-muted-foreground/70 truncate">{item.detail}</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Next Actions */}
      <div className="rounded-xl border border-border/40 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border/40 bg-muted/10">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50">
            Next actions
          </p>
        </div>
        <div className="p-3 grid grid-cols-2 gap-2">
          {productId && (
            <button
              onClick={() => router.push(`/dashboard/products/${productId}`)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border/60 bg-card/60 hover:bg-muted/40 transition-colors text-left"
            >
              <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-[12px] font-semibold text-foreground">Review Product</span>
            </button>
          )}
          {productId && (
            <button
              onClick={() => router.push(`/dashboard/products/${productId}#publish`)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-orange-500/30 bg-orange-500/[0.05] hover:bg-orange-500/[0.08] transition-colors text-left"
            >
              <Rocket className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span className="text-[12px] font-semibold text-orange-500">Publish to Store</span>
            </button>
          )}
          {storeUrl && (
            <button
              onClick={() => window.open(storeUrl, "_blank")}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border/60 bg-card/60 hover:bg-muted/40 transition-colors text-left"
            >
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-[12px] font-semibold text-foreground">Preview Store Page</span>
            </button>
          )}
          {storeUrl && (
            <button
              onClick={copyLink}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border/60 bg-card/60 hover:bg-muted/40 transition-colors text-left"
            >
              <Copy className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-[12px] font-semibold text-foreground">Copy Link</span>
            </button>
          )}
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border/60 bg-card/60 hover:bg-muted/40 transition-colors text-left"
          >
            <Store className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-[12px] font-semibold text-foreground">Go to Dashboard</span>
          </button>
        </div>
      </div>
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

  /* ── Marketing campaign folder items (streamed live) ── */
  const [marketingFolderItems, setMarketingFolderItems] = useState<FolderAssetItem[]>([]);

  /* ── Store Agent: validation checks + readiness score (streamed live) ── */
  const [storeChecks,    setStoreChecks]    = useState<ValidationCheck[]>([]);
  const [storeScore,     setStoreScore]     = useState<number>(0);
  const [storeProductId, setStoreProductId] = useState<string>("");
  const [storeUrl,       setStoreUrl]       = useState<string>("");

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
        await stage.execute(ctx);

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

        {/* ── Business Summary — shown when all agents finish ── */}
        {overallStatus === "completed" && (
          <BusinessSummaryPanel
            stageResults={project.stageResults as Record<string, unknown> ?? {}}
            storeScore={storeScore}
            storeProductId={storeProductId}
            storeUrl={storeUrl}
            router={router}
          />
        )}

      </div>
    </div>
  );
}
