/**
 * /dashboard/projects/[launchId]
 * ──────────────────────────────────────────────────────────────────────────────
 * Single Project Dashboard — persistent view of one business.
 *
 * Sections:
 *  1. Header — project name, business stage, scores, dates
 *  2. Stats row — content count, store status
 *  3. Project Timeline — derived from stageResults.*completedAt fields
 *  4. Continue Building — contextual AI actions
 *  5. Project Sections — quick links to each AI pipeline output
 */
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft, Loader2, FolderOpen, CheckCircle2,
  Circle, ExternalLink, ArrowRight, Rocket, Brain,
  TrendingUp, Package, Palette, Megaphone, Store as StoreIcon,
  Search, RefreshCw, Film, BarChart2, Zap, Clock,
  Star, Play, Edit3,
} from "lucide-react";
import Link from "next/link";
import type { LaunchStageResults } from "@/db/schema/launch-schema";
import { GrowthDashboard } from "@/components/growth/GrowthDashboard";
import { WorkforcePanel } from "@/components/workforce/WorkforcePanel";
import { MissionControlCard } from "@/components/workforce/MissionControlCard";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

interface LaunchProject {
  id:           string;
  goal:         string;
  status:       string;
  currentStage: string;
  progress:     number;
  stageResults: LaunchStageResults | null;
  createdAt:    string;
  updatedAt:    string;
}

/* ─── Shared helpers ─────────────────────────────────────────────────────────── */

const STAGE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  building:       { bg: "bg-muted/40",      text: "text-muted-foreground", dot: "bg-muted-foreground/40" },
  launching:      { bg: "bg-blue-500/10",   text: "text-blue-400",         dot: "bg-blue-400" },
  first_visitors: { bg: "bg-amber-500/10",  text: "text-amber-400",        dot: "bg-amber-400" },
  first_sales:    { bg: "bg-orange-500/10", text: "text-orange-400",       dot: "bg-orange-400 animate-pulse" },
  growing:        { bg: "bg-green-500/10",  text: "text-green-400",        dot: "bg-green-400" },
  scaling:        { bg: "bg-purple-500/10", text: "text-purple-400",       dot: "bg-purple-400" },
};

const BUSINESS_STAGES = [
  { id: "building",       label: "Building",               minScore: 0  },
  { id: "launching",      label: "Launching",              minScore: 20 },
  { id: "first_visitors", label: "Getting First Visitors", minScore: 40 },
  { id: "first_sales",    label: "Getting First Sales",    minScore: 60 },
  { id: "growing",        label: "Growing",                minScore: 75 },
  { id: "scaling",        label: "Scaling",                minScore: 90 },
];

function calcScore(r: LaunchStageResults): number {
  let s = 0;
  if (r.research?.insights?.length) s += 20; else if (r.research) s += 10;
  if (r.product?.productId) s += 15;
  if (r.design) { const a = r.design.assetsCount ?? 0; s += a >= 3 ? 15 : a >= 1 ? 8 : 5; }
  if (r.marketing) {
    let m = 0;
    if (r.marketing.salesCopy)           m += 5;
    if (r.marketing.emails?.length)      m += 5;
    if (r.marketing.tiktokHooks?.length) m += 4;
    if (r.marketing.carousels?.length)   m += 3;
    if (r.marketing.xPosts?.length)      m += 3;
    s += Math.min(m, 20);
  }
  if (r.store) s += Math.round(((r.store.readinessScore ?? 0) / 100) * 30);
  return Math.min(s, 100);
}

function deriveStage(score: number) {
  return BUSINESS_STAGES.reduce((acc, s) => (score >= s.minScore ? s : acc), BUSINESS_STAGES[0]);
}

function countContent(r: LaunchStageResults): number {
  const m = r.marketing;
  if (!m) return 0;
  return (
    (m.tiktokHooks?.length ?? 0) + (m.carousels?.length ?? 0) +
    (m.emails?.length ?? 0) + (m.xPosts?.length ?? 0) +
    (m.instagramCaptions?.length ?? 0) + (m.headlines?.length ?? 0) +
    (m.ctas?.length ?? 0) + (m.salesCopy ? 1 : 0) +
    (m.launchAnnouncement ? 1 : 0) + (m.faq?.length ?? 0)
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/* ─── Timeline builder ───────────────────────────────────────────────────────── */

interface TimelineEvent {
  id:        string;
  emoji:     string;
  label:     string;
  detail?:   string;
  timestamp: string;
  href?:     string;
}

function buildTimeline(r: LaunchStageResults, launchId: string): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  if (r.research?.completedAt) {
    events.push({
      id: "research", emoji: "🔍",
      label: "Market research completed",
      detail: `${r.research.insights?.length ?? 0} insights · ${r.research.keywords?.length ?? 0} keywords · ${r.research.competitorInsights?.length ?? 0} competitors`,
      timestamp: r.research.completedAt,
      href: "/dashboard/workspace?tab=research",
    });
  }

  if (r.product?.completedAt) {
    events.push({
      id: "product", emoji: "📦",
      label: `Product "${r.product.productName}" generated`,
      timestamp: r.product.completedAt,
      href: r.product.productId ? `/dashboard/products/${r.product.productId}` : undefined,
    });
  }

  if (r.design?.completedAt) {
    events.push({
      id: "design", emoji: "🎨",
      label: "Design assets created",
      detail: `${r.design.assetsCount ?? 0} assets — cover, mockup, thumbnail, social preview`,
      timestamp: r.design.completedAt,
      href: "/dashboard/design-studio",
    });
  }

  if (r.marketing?.completedAt) {
    events.push({
      id: "marketing", emoji: "📣",
      label: "Marketing campaign generated",
      detail: `${countContent(r)} assets — hooks, carousels, emails, social posts`,
      timestamp: r.marketing.completedAt,
      href: "/dashboard/workspace?tab=content",
    });
  }

  if (r.store?.completedAt) {
    events.push({
      id: "store", emoji: "🛍️",
      label: r.store.publishedAt ? "Store listing published" : "Store listing built",
      detail: r.store.readinessScore ? `${r.store.readinessScore}% readiness` : undefined,
      timestamp: r.store.publishedAt ?? r.store.completedAt,
      href: r.store.storeUrl ?? undefined,
    });
  }

  if (r.brain?.completedAt) {
    events.push({
      id: "brain", emoji: "🧠",
      label: "Business Brain review completed",
      detail: `Business Score ${r.brain.businessScore} · Launch Score ${r.brain.launchScore}`,
      timestamp: r.brain.completedAt,
      href: `/dashboard/launch/${launchId}/workspace`,
    });
  }

  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/* ─── Continue Building actions ──────────────────────────────────────────────── */

interface ContinueAction {
  id:     string;
  emoji:  string;
  label:  string;
  detail: string;
  href:   string;
  highlight?: boolean;
}

function buildContinueActions(
  r: LaunchStageResults,
  productId: string,
  launchId:  string,
): ContinueAction[] {
  const actions: ContinueAction[] = [];

  // Surface top Brain recommendation as primary action
  if (r.brain?.recommendations?.length) {
    const topRec = r.brain.recommendations.find(r => r.priority === "high") ?? r.brain.recommendations[0];
    actions.push({
      id:        "top_rec",
      emoji:     "⚡",
      label:     topRec.title,
      detail:    "Top recommendation from Business Brain",
      href:      topRec.actionHref?.replace("[id]", productId) ?? `/dashboard/launch/${launchId}/workspace`,
      highlight: true,
    });
  }

  // Core continue-building actions
  if (productId) {
    actions.push({
      id: "improve_product", emoji: "📦",
      label: "Improve Product",
      detail: "Edit content, pricing, or structure",
      href: `/dashboard/products/${productId}`,
    });
  }

  actions.push({
    id: "more_marketing", emoji: "📣",
    label: "Generate More Marketing",
    detail: "More hooks, carousels, and posts",
    href: "/dashboard/workspace?tab=content",
  });

  if (r.store?.productId) {
    actions.push({
      id: "improve_store", emoji: "🛍️",
      label: "Improve Store",
      detail: "Update headline, description, or SEO",
      href: productId ? `/dashboard/products/${productId}#publish` : "/dashboard/store",
    });
  }

  actions.push({
    id: "rerun_brain", emoji: "🧠",
    label: "Run Business Brain Again",
    detail: "Get fresh recommendations after improvements",
    href: `/dashboard/launch/${launchId}/workspace`,
  });

  actions.push({
    id: "research_again", emoji: "🔍",
    label: "Analyse Competition Again",
    detail: "Check if market conditions have changed",
    href: "/dashboard/workspace?tab=research",
  });

  actions.push({
    id: "seo", emoji: "🔎",
    label: "Improve SEO",
    detail: "Find new keywords and ranking opportunities",
    href: "/dashboard/workspace?tab=research",
  });

  if (productId) {
    actions.push({
      id: "video", emoji: "🎬",
      label: "Create Product Video",
      detail: "Turn your product into a video guide",
      href: `/dashboard/video-guide/new`,
    });
  }

  return actions.slice(0, 6);
}

/* ─── Section quick links ────────────────────────────────────────────────────── */

interface SectionLink {
  id:     string;
  emoji:  string;
  label:  string;
  done:   boolean;
  href?:  string;
  external?: boolean;
}

function buildSectionLinks(
  r: LaunchStageResults,
  productId: string,
  storeUrl:  string,
  launchId:  string,
): SectionLink[] {
  return [
    {
      id: "research", emoji: "🔍", label: "Research",
      done: !!r.research,
      href: "/dashboard/workspace?tab=research",
    },
    {
      id: "product", emoji: "📦", label: "Product",
      done: !!r.product,
      href: productId ? `/dashboard/products/${productId}` : undefined,
    },
    {
      id: "design", emoji: "🎨", label: "Design Assets",
      done: !!r.design,
      href: "/dashboard/design-studio",
    },
    {
      id: "marketing", emoji: "📣", label: "Marketing Content",
      done: !!r.marketing,
      href: "/dashboard/workspace?tab=content",
    },
    {
      id: "store", emoji: "🛍️", label: "Store Listing",
      done: !!r.store,
      href: storeUrl || (productId ? `/dashboard/products/${productId}#publish` : undefined),
      external: !!storeUrl,
    },
    {
      id: "brain", emoji: "🧠", label: "Business Brain",
      done: !!r.brain,
      href: `/dashboard/launch/${launchId}/workspace`,
    },
  ];
}

/* ─── Main page ──────────────────────────────────────────────────────────────── */

export default function ProjectDashboardPage() {
  const { launchId } = useParams<{ launchId: string }>();
  const router       = useRouter();

  const [project,   setProject]   = useState<LaunchProject | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/launch/${launchId}`);
        if (!res.ok) throw new Error("Not found");
        setProject(await res.json() as LaunchProject);
      } catch {
        setLoadError("Could not load this project.");
      }
    })();
  }, [launchId]);

  if (loadError) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <p className="text-[14px] text-muted-foreground mb-4">{loadError}</p>
          <button onClick={() => router.push("/dashboard/projects")}
            className="text-[13px] text-orange-500 hover:underline">
            ← Back to Projects
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

  const r         = project.stageResults ?? ({} as LaunchStageResults);
  const productId = r.product?.productId ?? "";
  const storeUrl  = r.store?.storeUrl    ?? "";

  const businessScore = r.brain?.businessScore ?? calcScore(r);
  const launchScore   = r.brain?.launchScore   ?? null;
  const stage         = deriveStage(businessScore);
  const stageStyle    = STAGE_COLORS[stage.id] ?? STAGE_COLORS.building;
  const content       = countContent(r);
  const timeline      = buildTimeline(r, launchId);
  const continueActs  = buildContinueActions(r, productId, launchId);
  const sectionLinks  = buildSectionLinks(r, productId, storeUrl, launchId);

  const storeLabel = storeUrl
    ? "Published" : r.store?.productId ? "Draft" : "Not built";
  const storeLabelColor = storeUrl
    ? "text-green-400" : r.store?.productId ? "text-amber-400" : "text-muted-foreground/40";

  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">

        {/* ── Back nav ── */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/dashboard/projects"
            className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Projects
          </Link>
          <div className="h-3 w-px bg-border/40" />
          <Link
            href={`/dashboard/launch/${launchId}/workspace`}
            className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Full Workspace
          </Link>
          <div className="h-3 w-px bg-border/40" />
          <Link
            href="/dashboard/launch"
            className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            New Execution
          </Link>
        </div>

        {/* ── Project header ── */}
        <div className="rounded-2xl border border-border/50 bg-card/60 p-5 mb-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
              <FolderOpen className="w-5 h-5 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-[18px] font-black text-foreground tracking-tight">
                  {r.product?.productName ?? project.goal}
                </h1>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${stageStyle.bg} ${stageStyle.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${stageStyle.dot}`} />
                  {stage.label}
                </span>
              </div>
              {r.product?.productName && r.product.productName !== project.goal && (
                <p className="text-[11px] text-muted-foreground/60 mb-2">Goal: {project.goal}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground/50">
                <span>Created {relTime(project.createdAt)}</span>
                <span>·</span>
                <span>Updated {relTime(project.updatedAt)}</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Business Score", value: String(businessScore), sub: "/100" },
              { label: "Launch Score",   value: launchScore !== null ? String(launchScore) : "—", sub: "/100" },
              { label: "Content Assets", value: String(content), sub: " pieces" },
              { label: "Store",          value: storeLabel, sub: "", color: storeLabelColor },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl bg-muted/20 px-3 py-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-0.5">{stat.label}</p>
                <p className={`text-[16px] font-black tabular-nums ${stat.color ?? "text-foreground"}`}>
                  {stat.value}
                  <span className="text-[10px] font-medium text-muted-foreground/40">{stat.sub}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Mission Control ── */}
        <MissionControlCard launchId={launchId} />

        {/* ── Growth Mode ── */}
        <GrowthDashboard
          launchId={launchId}
          initialData={r.growth}
          productId={productId}
        />

        {/* ── AI Workforce ── */}
        <WorkforcePanel launchId={launchId} />

        {/* ── Project Timeline ── */}
        {timeline.length > 0 && (
          <div className="mb-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">
              Project Timeline
            </p>
            <div className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden divide-y divide-border/30">
              {timeline.map((event, i) => (
                <div key={event.id} className="flex items-start gap-3 px-4 py-3">
                  {/* Dot + line */}
                  <div className="flex flex-col items-center shrink-0 mt-1">
                    <div className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                    </div>
                    {i < timeline.length - 1 && <div className="w-px flex-1 bg-border/30 mt-1 min-h-[8px]" />}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-1">
                    {event.href ? (
                      <a href={event.href} className="text-[12px] font-semibold text-foreground hover:text-orange-500 transition-colors flex items-center gap-1">
                        {event.emoji} {event.label}
                        <ArrowRight className="w-3 h-3 shrink-0 opacity-60" />
                      </a>
                    ) : (
                      <p className="text-[12px] font-semibold text-foreground">{event.emoji} {event.label}</p>
                    )}
                    {event.detail && (
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">{event.detail}</p>
                    )}
                  </div>
                  {/* Timestamp */}
                  <p className="text-[10px] text-muted-foreground/40 shrink-0 tabular-nums whitespace-nowrap">
                    {relTime(event.timestamp)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Continue Building ── */}
        <div className="mb-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">
            Continue Building
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {continueActs.map(action => (
              <Link
                key={action.id}
                href={action.href}
                className={[
                  "flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors",
                  action.highlight
                    ? "border-orange-500/30 bg-orange-500/[0.05] hover:bg-orange-500/[0.1]"
                    : "border-border/40 bg-card/60 hover:bg-muted/30",
                ].join(" ")}
              >
                <span className="text-base shrink-0">{action.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-[12px] font-bold leading-none ${action.highlight ? "text-orange-500" : "text-foreground"}`}>
                    {action.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">{action.detail}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        {/* ── Project Sections ── */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">
            Project Sections
          </p>
          <div className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden divide-y divide-border/30">
            {sectionLinks.map(section => (
              <div key={section.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-base shrink-0">{section.emoji}</span>
                <p className="flex-1 text-[12px] font-semibold text-foreground">{section.label}</p>
                {section.done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                )}
                {section.href ? (
                  <a
                    href={section.href}
                    target={section.external ? "_blank" : undefined}
                    rel={section.external ? "noopener noreferrer" : undefined}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-500 hover:underline shrink-0"
                  >
                    {section.done ? "View" : "Start"}
                    {section.external ? <ExternalLink className="w-2.5 h-2.5" /> : <ArrowRight className="w-2.5 h-2.5" />}
                  </a>
                ) : (
                  <span className="text-[10px] text-muted-foreground/30 shrink-0">Not started</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Business Memory link ── */}
        <div className="mt-5">
          <Link
            href={`/dashboard/projects/${launchId}/memory`}
            className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-purple-500/20 bg-purple-500/[0.03] hover:bg-purple-500/[0.07] transition-colors"
          >
            <span className="text-lg shrink-0">🧠</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-foreground">Business Memory</p>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                Everything the AI knows about your business — view and edit
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
          </Link>
        </div>

        {/* ── View full workspace ── */}
        <div className="mt-5 text-center">
          <Link
            href={`/dashboard/launch/${launchId}/workspace`}
            className="inline-flex items-center gap-2 text-[12px] font-semibold text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            View full AI workspace
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

      </div>
    </div>
  );
}
