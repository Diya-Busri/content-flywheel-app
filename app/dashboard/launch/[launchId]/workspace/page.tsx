/**
 * /dashboard/launch/[launchId]/workspace
 * ─────────────────────────────────────────────────────────────
 * AI Execution Workspace — Phase 1.7
 *
 * The post-completion destination after the AI pipeline runs.
 * Presents every completed stage as a self-contained review card.
 * Feels like reviewing work delivered by an AI team, not navigating software.
 *
 * Each card exposes:
 *   - Status  (Queued / Running / Complete / Failed)
 *   - AI summary of what was produced
 *   - Stage-specific preview widget (thumbnails, stats, checks)
 *   - View button  → relevant product/studio/store page
 *   - Edit button  → relevant tool for that asset type
 *   - Regenerate   → clears stage + downstream, redirects to execution page
 *   - Timestamp    → when that agent finished
 *
 * Built with <WorkspaceStageCard> which is reusable for the Phase 2
 * Project Dashboard.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft, Loader2, XCircle, Sparkles, CheckCircle2,
  AlertTriangle, Rocket, Cloud,
} from "lucide-react";

import {
  WorkspaceStageCard,
} from "@/components/execution-workspace/WorkspaceStageCard";
import type { WorkspaceCardStatus } from "@/components/execution-workspace/WorkspaceStageCard";
import { BehindTheBuildSection } from "@/components/execution-workspace/BehindTheBuildSection";
import { LaunchEngine } from "@/components/execution-workspace/LaunchEngine";
import { BusinessBrainPanel } from "@/components/execution-workspace/BusinessBrainPanel";
import { DesignAssetPanel } from "@/components/execution-workspace/DesignAssetPanel";
import type { LaunchStageResults, LaunchStatus } from "@/db/schema/launch-schema";

/* ─── Project shape (matches what GET /api/launch/[launchId] returns) ────────── */

interface LaunchProject {
  id:           string;
  goal:         string;
  status:       LaunchStatus;
  currentStage: string;
  progress:     number;
  stageResults: LaunchStageResults | null;
  createdAt:    string;
  updatedAt:    string;
}

/* ─── Stage config ───────────────────────────────────────────────────────────── */

interface StageConfig {
  id:          keyof LaunchStageResults;
  emoji:       string;
  label:       string;
  agentLabel:  string;
  description: string;
}

const STAGE_CONFIGS: StageConfig[] = [
  {
    id:          "research",
    emoji:       "🔍",
    label:       "Research",
    agentLabel:  "Research Agent",
    description: "Market analysis, audience profiling, and competitor intelligence",
  },
  {
    id:          "product",
    emoji:       "✍️",
    label:       "Product",
    agentLabel:  "Product Agent",
    description: "Complete digital product with sections, pricing, and descriptions",
  },
  {
    id:          "design",
    emoji:       "🎨",
    label:       "Design",
    agentLabel:  "Design Agent",
    description: "Product cover, 3D mockup, store thumbnail, and social preview",
  },
  {
    id:          "marketing",
    emoji:       "📣",
    label:       "Marketing",
    agentLabel:  "Marketing Agent",
    description: "Launch copy, social posts, email sequence, and SEO assets",
  },
  {
    id:          "store",
    emoji:       "🛍️",
    label:       "Store",
    agentLabel:  "Store Agent",
    description: "Assembled store listing with validation and readiness score",
  },
];

const DEMO_MODE_KEY = "cf_launch_demo_mode";

function readDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DEMO_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

/* ─── AI summary generator — derives from stageResults, no extra API call ───── */

function buildSummary(stageId: keyof LaunchStageResults, results: LaunchStageResults): string {
  switch (stageId) {

    case "research": {
      const r       = results.research;
      if (!r) return "Research data not available.";
      const insights = r.insights?.length    ?? 0;
      const opps     = r.productOpportunities?.length ?? 0;
      const kws      = r.keywords?.length    ?? 0;
      const comps    = r.competitorInsights?.length ?? 0;
      return `Analysed your market across 9 research dimensions. Found ${insights} key insights, ${opps} product opportunities, and ${kws} keywords with commercial intent. ${comps > 0 ? `${comps} competitors profiled.` : ""}`;
    }

    case "product": {
      const p = results.product;
      if (!p) return "Product data not available.";
      return `Created "${p.productName}" — a complete digital product ready in your library. Includes structured sections, pricing guidance, and marketplace-ready description.`;
    }

    case "design": {
      const d = results.design;
      if (!d) return "Design data not available.";
      const count = d.assetsCount ?? 0;
      const parts = [
        d.coverUrl     && "product cover",
        d.mockupUrl    && "3D mockup",
        d.thumbnailUrl && "store thumbnail",
        d.socialUrl    && "social preview",
      ].filter(Boolean);
      return `Generated ${count} marketing asset${count !== 1 ? "s" : ""}: ${parts.join(", ")}. All images attached to your product and optimised for conversions.`;
    }

    case "marketing": {
      const m = results.marketing;
      if (!m) return "Marketing data not available.";
      const carousels = m.carousels?.length    ?? 0;
      const emails    = m.emails?.length       ?? 0;
      const tiktoks   = m.tiktokHooks?.length  ?? 0;
      const posts     = m.xPosts?.length       ?? 0;
      const total     = carousels + emails + tiktoks + posts + 9;
      return `Built a complete launch campaign — ${total}+ assets total. Includes launch copy, ${carousels} carousel${carousels !== 1 ? "s" : ""}, ${emails} email${emails !== 1 ? "s" : ""}, ${tiktoks} TikTok hooks, and ${posts} posts. SEO metadata written.`;
    }

    case "store": {
      const s = results.store;
      if (!s) return "Store data not available.";
      const score   = s.readinessScore ?? 0;
      const checks  = s.validationChecks?.length ?? 0;
      const passed  = s.validationChecks?.filter(c => c.status === "ok" || c.status === "fixed").length ?? 0;
      const label   = score >= 90 ? "Ready to publish" : score >= 70 ? "Almost ready" : "Needs attention";
      return `${label}. Store readiness ${score}% — ${passed} of ${checks} checks passed. All marketing assets attached to your listing. One click to publish.`;
    }

    default:
      return "";
  }
}

/* ─── Card status derived from project state ─────────────────────────────────── */

function deriveCardStatus(
  stageId: keyof LaunchStageResults,
  results: LaunchStageResults | null,
  projectStatus: LaunchStatus,
  projectCurrentStage: string,
): WorkspaceCardStatus {
  if (results?.[stageId]) return "complete";
  if (projectStatus === "failed" && projectCurrentStage === stageId) return "failed";
  if (projectStatus === "running" && projectCurrentStage === stageId) return "running";
  return "queued";
}

/* ─── Preview widgets (stage-specific) ──────────────────────────────────────── */

function ResearchPreview({ r }: { r: NonNullable<LaunchStageResults["research"]> }) {
  const insights = r.insights?.slice(0, 3) ?? [];
  const keywords = r.keywords?.slice(0, 4) ?? [];
  return (
    <div className="space-y-3">
      {insights.length > 0 && (
        <div className="space-y-1.5">
          {insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px]">
              <Sparkles className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
              <span className="text-muted-foreground/70 leading-snug line-clamp-2">{insight}</span>
            </div>
          ))}
        </div>
      )}
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {keywords.map(kw => (
            <span key={kw.term} className="px-2 py-0.5 rounded-full bg-muted/60 text-[10px] font-medium text-muted-foreground">
              {kw.term}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}


function MarketingPreview({ m }: { m: NonNullable<LaunchStageResults["marketing"]> }) {
  const carouselCount = m.carousels?.length ?? 0;
  const emailCount    = m.emails?.length ?? 0;
  const socialCount   = (m.xPosts?.length ?? 0) + (m.tiktokHooks?.length ?? 0);
  const totalAssets   = carouselCount + emailCount + socialCount + 9;

  return (
    <div className="space-y-2">
      {/* Polished pack card */}
      <div className="rounded-xl border border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-amber-500/5 px-4 py-3.5 flex items-center gap-3">
        <div className="text-2xl shrink-0">🎠</div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-foreground">Carousel Pack Generated</p>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5 leading-snug">
            Hooks, captions, slide structure and design direction ready.
          </p>
        </div>
        <span className="shrink-0 text-[10px] font-bold text-orange-500 bg-orange-500/10 px-2 py-1 rounded-full">
          {carouselCount} slides
        </span>
      </div>

      {/* Summary strip */}
      <div className="rounded-lg border border-border/40 overflow-hidden divide-y divide-border/30">
        <div className="flex items-center gap-3 px-3 py-2">
          <span className="text-sm shrink-0">🚀</span>
          <span className="flex-1 text-[11px] font-medium text-foreground/80">Launch Campaign</span>
          <span className="text-[10px] text-muted-foreground/60">copy, headlines, FAQ, CTAs</span>
          <span className="text-[10px] font-bold text-foreground/70 tabular-nums shrink-0">9+</span>
        </div>
        <div className="flex items-center gap-3 px-3 py-2">
          <span className="text-sm shrink-0">📧</span>
          <span className="flex-1 text-[11px] font-medium text-foreground/80">Email Sequence</span>
          <span className="text-[10px] text-muted-foreground/60">full nurture flow</span>
          <span className="text-[10px] font-bold text-foreground/70 tabular-nums shrink-0">{emailCount}+</span>
        </div>
        <div className="flex items-center gap-3 px-3 py-2">
          <span className="text-sm shrink-0">📱</span>
          <span className="flex-1 text-[11px] font-medium text-foreground/80">Social Posts</span>
          <span className="text-[10px] text-muted-foreground/60">hooks, threads, short-form</span>
          <span className="text-[10px] font-bold text-foreground/70 tabular-nums shrink-0">{socialCount}+</span>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/50 px-1">
        {totalAssets}+ assets total · view full campaign in Workspace
      </p>
    </div>
  );
}

function StorePreview({ s }: { s: NonNullable<LaunchStageResults["store"]> }) {
  const score = s.readinessScore ?? 0;
  const checks = s.validationChecks ?? [];
  const ok = checks.filter(c => c.status === "ok" || c.status === "fixed").length;
  const warning = checks.filter(c => c.status === "warning").length;
  const missing = checks.filter(c => c.status === "missing").length;

  const ringColor = score >= 90 ? "#22c55e" : score >= 70 ? "#fbbf24" : "#f87171";
  const circumference = 2 * Math.PI * 20;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex items-center gap-4">
      {/* Score ring */}
      <div className="relative w-12 h-12 shrink-0">
        <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" className="text-muted/30" strokeWidth="4" />
          <circle cx="24" cy="24" r="20" fill="none" stroke={ringColor} strokeWidth="4"
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-black tabular-nums" style={{ color: ringColor }}>{score}%</span>
        </div>
      </div>

      {/* Check summary */}
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
          <span className="text-[11px] text-muted-foreground/70">{ok} passed</span>
        </div>
        {warning > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="text-[11px] text-muted-foreground/70">{warning} need attention</span>
          </div>
        )}
        {missing > 0 && (
          <div className="flex items-center gap-1.5">
            <XCircle className="w-3 h-3 text-red-400 shrink-0" />
            <span className="text-[11px] text-muted-foreground/70">{missing} missing</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────────── */

export default function ExecutionWorkspacePage() {
  const { launchId } = useParams<{ launchId: string }>();
  const router       = useRouter();

  const [project,        setProject]        = useState<LaunchProject | null>(null);
  const [loadError,      setLoadError]      = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [showDemoReveal, setShowDemoReveal] = useState(false);

  /* ── Load project (with retry) ── */
  const [loadReason,   setLoadReason]   = useState<string | null>(null);
  const [retryCount,   setRetryCount]   = useState(0);
  const MAX_RETRIES = 3;

  const loadProject = useCallback(async (attempt = 1) => {
    console.log(`[workspace] Loading project (attempt ${attempt})`, { launchId });
    try {
      const res = await fetch(`/api/launch/${launchId}`);

      if (!res.ok) {
        let reason = `Server returned ${res.status}`;
        try {
          const body = await res.json() as { error?: string };
          if (body.error) reason = body.error;
        } catch { /* ignore parse error */ }

        const mapped =
          res.status === 401 ? "Not signed in — please refresh and sign in again."
          : res.status === 404 ? "Workspace not found. It may have been deleted."
          : res.status === 403 ? "You don't have permission to view this workspace."
          : res.status >= 500  ? `Server error (${res.status}) — please retry.`
          : `Request failed: ${reason}`;

        console.error("[workspace] Load failed", { status: res.status, reason: mapped, attempt });
        throw new Error(mapped);
      }

      const data = await res.json() as LaunchProject;
      console.log("[workspace] Loaded successfully", { id: data.id, status: data.status });
      setProject(data);
      setLoadError(null);
      setLoadReason(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[workspace] Error", { message, attempt });

      if (attempt < MAX_RETRIES) {
        const delay = attempt * 1500;
        console.log(`[workspace] Retrying in ${delay}ms…`);
        setTimeout(() => void loadProject(attempt + 1), delay);
      } else {
        setLoadError("Failed to load Behind the Build.");
        setLoadReason(message);
      }
    }
  }, [launchId]);

  useEffect(() => {
    void loadProject(1);
  }, [loadProject]);

  useEffect(() => {
    if (!isComplete || !readDemoMode()) return;
    setShowDemoReveal(true);
    const timeout = setTimeout(() => setShowDemoReveal(false), 2000);
    return () => clearTimeout(timeout);
  }, [isComplete]);

  /* ── Regenerate handler ── */
  const handleRegenerate = useCallback(async (stageId: string) => {
    setRegeneratingId(stageId);
    try {
      const res = await fetch(`/api/launch/${launchId}/regenerate`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ stage: stageId }),
      });
      if (!res.ok) throw new Error("Regenerate failed");
      // Redirect to execution page — it will detect the cleared stage and re-run
      router.push(`/dashboard/launch/${launchId}`);
    } catch (err) {
      console.error("[workspace/regenerate]", err);
      setRegeneratingId(null);
    }
  }, [launchId, router]);

  /* ─────────────────── */

  if (loadError) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* Error card */}
          <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-foreground">{loadError}</p>
                <p className="text-[12px] text-muted-foreground/60 mt-0.5">
                  This workspace could not be loaded.
                </p>
              </div>
            </div>

            {/* Reason */}
            {loadReason && (
              <div className="mb-5 rounded-lg bg-muted/20 border border-border/40 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-1">Reason</p>
                <p className="text-[12px] text-muted-foreground/80 leading-snug">{loadReason}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setLoadError(null);
                  setLoadReason(null);
                  void loadProject(1);
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-foreground hover:bg-foreground/90 text-[13px] font-bold text-background transition-colors"
              >
                <AlertTriangle className="w-4 h-4" />
                Retry
              </button>

              <button
                onClick={() => router.push(`/dashboard/launch/${launchId}`)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-border/60 bg-card/60 hover:bg-muted/40 text-[13px] font-semibold text-foreground/70 transition-colors"
              >
                Return to Launch
              </button>

              <button
                onClick={() => router.push("/dashboard/projects")}
                className="text-center text-[12px] text-muted-foreground/60 hover:text-foreground/60 transition-colors mt-1"
              >
                View all launches →
              </button>
            </div>

            {/* Logs note */}
            <p className="text-[10px] text-muted-foreground/40 mt-4 text-center">
              Check browser console for detailed logs · Your content is safe in the database
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto mb-3" />
          <p className="text-[12px] text-muted-foreground/60">Loading workspace…</p>
        </div>
      </div>
    );
  }

  const results    = project.stageResults ?? {} as LaunchStageResults;
  const productId  = results.product?.productId ?? "";
  const storeUrl   = results.store?.storeUrl ?? "";
  // Both "completed" and "awaiting_approval" mean the pipeline finished and the workspace is ready.
  // "awaiting_approval" = pipeline ran successfully but some optional assets need attention.
  const isComplete = project.status === "completed" || project.status === "awaiting_approval";

  /* Derive overall progress display */
  const completedCount = STAGE_CONFIGS.filter(s => results[s.id]).length;
  const progressLabel  =
    isComplete       ? "All agents finished"
    : completedCount > 0 ? `${completedCount} of ${STAGE_CONFIGS.length} agents complete`
    :                      "Pipeline not yet started";

  return (
    <div className="min-h-dvh bg-background">
      {showDemoReveal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 px-6 backdrop-blur-2xl cf-demo-soft-reveal">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-emerald-400/25 bg-card/90 p-10 text-center shadow-2xl shadow-emerald-500/25">
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
            <p className="mx-auto mt-4 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
              Research, product, design, marketing and store prepared.
            </p>
            <div className="mx-auto mt-6 h-1 max-w-[200px] overflow-hidden rounded-full bg-muted/40">
              <div className="h-full w-full rounded-full bg-gradient-to-r from-orange-400 via-amber-300 to-emerald-300 cf-demo-progress-shimmer" />
            </div>
          </div>
        </div>
      )}
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">

        {/* ── Back nav ── */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => router.push(`/dashboard/launch/${launchId}`)}
            className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Pipeline
          </button>
          <div className="h-3 w-px bg-border/40" />
          <button
            onClick={() => router.push("/dashboard/launch")}
            className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            New launch
          </button>
          <div className="h-3 w-px bg-border/40" />
          <button
            onClick={() => router.push("/dashboard/projects")}
            className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            All launches
          </button>
          <div className="ml-auto flex items-center gap-1.5 text-[11px] text-emerald-500/70">
            <Cloud className="w-3 h-3" />
            Auto-saved
          </div>
        </div>

        {/* ── Header ── */}
        <div className="mb-8">
          {/* Completion banner */}
          {isComplete && (
            <div className="rounded-2xl border border-green-500/20 bg-green-500/[0.03] px-5 py-4 mb-6 flex items-center gap-4">
              <div className="text-2xl shrink-0">🎉</div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-foreground">Your business is ready to launch.</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Every AI agent has finished. Review the work below, then publish to your store.
                </p>
              </div>
              {storeUrl && productId && (
                <a
                  href={`/dashboard/digital-products/${productId}/edit#publish`}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-[12px] font-bold text-white transition-colors"
                >
                  <Rocket className="w-3.5 h-3.5" />
                  Publish
                </a>
              )}
            </div>
          )}

          {/* Project goal */}
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1">
                Execution Goal
              </p>
              <h1 className="text-[18px] sm:text-xl font-bold text-foreground leading-snug">
                {project.goal}
              </h1>
            </div>
          </div>

          {/* Progress strip */}
          <div className="mt-5 flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {STAGE_CONFIGS.map(s => (
                <div
                  key={s.id}
                  className={[
                    "w-2 h-2 rounded-full transition-colors",
                    results[s.id]  ? "bg-green-500"
                    : project.currentStage === s.id ? "bg-orange-500 animate-pulse"
                    :               "bg-muted/50",
                  ].join(" ")}
                  title={s.label}
                />
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground/60">{progressLabel}</span>
          </div>
        </div>

        {/* ── Stage cards ── */}
        <div className="space-y-4">
          {STAGE_CONFIGS.map(stage => {
            const status = deriveCardStatus(
              stage.id, results, project.status, project.currentStage,
            );

            const stageResult = results[stage.id];
            const summary     = stageResult
              ? buildSummary(stage.id, results)
              : undefined;

            /* Derive View + Edit URLs per stage */
            let viewHref:    string | undefined;
            let editHref:    string | undefined;
            let externalView = false;

            if (stage.id === "research" && stageResult) {
              viewHref = "/dashboard/workspace?tab=research";
              editHref = `/dashboard/launch/${launchId}?regenerate=research`;
            }
            if (stage.id === "product" && productId) {
              viewHref = `/dashboard/digital-products/${productId}/edit`;
              editHref = `/dashboard/digital-products/${productId}/edit`;
            }
            if (stage.id === "design" && productId) {
              viewHref = `/dashboard/digital-products/${productId}/edit`;
              editHref = `/dashboard/digital-products/${productId}/edit`;
            }
            if (stage.id === "marketing" && stageResult) {
              viewHref = "/dashboard/workspace?tab=content";
              editHref = "/dashboard/workspace?tab=content";
            }
            if (stage.id === "store" && storeUrl) {
              viewHref    = storeUrl;
              externalView = true;
              editHref    = productId ? `/dashboard/digital-products/${productId}/edit#publish` : undefined;
            }

            /* Stage-specific preview widget */
            let previewNode: React.ReactNode = null;
            if (status === "complete" && stageResult) {
              if (stage.id === "research" && results.research)
                previewNode = <ResearchPreview r={results.research} />;
              if (stage.id === "design" && results.design && productId)
                previewNode = <DesignAssetPanel design={results.design} productId={productId} launchId={launchId} />;
              if (stage.id === "marketing" && results.marketing)
                previewNode = <MarketingPreview m={results.marketing} />;
              if (stage.id === "store"    && results.store)
                previewNode = <StorePreview s={results.store} />;
            }

            /* completedAt from the result */
            const completedAt = stageResult
              ? (stageResult as Record<string, unknown>).completedAt as string | undefined
              : undefined;

            return (
              <WorkspaceStageCard
                key={stage.id}
                id={stage.id}
                emoji={stage.emoji}
                label={stage.label}
                agentLabel={stage.agentLabel}
                description={stage.description}
                status={status}
                summary={summary}
                completedAt={completedAt}
                viewHref={viewHref}
                externalView={externalView}
                editHref={editHref}
                onRegenerate={() => void handleRegenerate(stage.id)}
                isRegenerating={regeneratingId === stage.id}
              >
                {previewNode}
              </WorkspaceStageCard>
            );
          })}
        </div>

        {/* ── Launch Engine — replaces simple "Next steps" buttons ── */}
        {isComplete && (
          <LaunchEngine
            launchId={launchId}
            productId={productId}
            storeUrl={storeUrl}
            results={results}
          />
        )}

        {/* ── Business Brain — auto-triggered founder review ── */}
        {isComplete && (
          <BusinessBrainPanel
            launchId={launchId}
            productId={productId}
            storeUrl={storeUrl}
            goal={project.goal}
            initialBrain={results.brain}
          />
        )}

        {/* ── Behind the Build (optional creator content pack) ── */}
        {isComplete && (
          <BehindTheBuildSection
            launchId={launchId}
            goal={project.goal}
            existing={results.behindTheBuild}
          />
        )}

      </div>
    </div>
  );
}
