/**
 * /dashboard/projects/[launchId]
 * ──────────────────────────────────────────────────────────────────────────────
 * Single Project Dashboard — persistent view of one business.
 *
 * UX principles:
 *   1. What's happening now  → Project header + stage badge
 *   2. What happens next     → "Continue Building" actions + section completion dots
 *   3. What action to take   → Highlighted top recommendation
 */
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  FolderOpen, CheckCircle2, Circle,
  ExternalLink, ArrowRight, Rocket,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import type { LaunchStageResults } from "@/db/schema/launch-schema";
import { GrowthDashboard }          from "@/components/growth/GrowthDashboard";
import { WorkforcePanel }           from "@/components/workforce/WorkforcePanel";
import { MissionControlCard }       from "@/components/workforce/MissionControlCard";
import { NotificationPanel }        from "@/components/notifications/NotificationPanel";
import { BusinessOSDashboard }      from "@/components/business-os/BusinessOSDashboard";
import { AutonomousModeDashboard }  from "@/components/autonomous/AutonomousModeDashboard";
import { ApprovalInbox }            from "@/components/autonomous/ApprovalInbox";
import { CompanyActivityFeed }      from "@/components/autonomous/CompanyActivityFeed";
import { CEOBriefingCard }          from "@/components/autonomous/CEOBriefingCard";
import { PageHeader }               from "@/components/ui/page-header";
import { LoadingPage }              from "@/components/ui/loading-card";

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
  building:       { bg: "bg-gray-100 dark:bg-gray-800",      text: "text-gray-500 dark:text-gray-400",    dot: "bg-gray-400" },
  launching:      { bg: "bg-blue-50 dark:bg-blue-950/40",    text: "text-blue-600 dark:text-blue-400",    dot: "bg-blue-400" },
  first_visitors: { bg: "bg-amber-50 dark:bg-amber-950/30",  text: "text-amber-600 dark:text-amber-400",  dot: "bg-amber-400" },
  first_sales:    { bg: "bg-orange-50 dark:bg-orange-950/30",text: "text-orange-600 dark:text-orange-400",dot: "bg-orange-400 animate-pulse" },
  growing:        { bg: "bg-emerald-50 dark:bg-emerald-950/30",text:"text-emerald-600 dark:text-emerald-400",dot:"bg-emerald-400" },
  scaling:        { bg: "bg-violet-50 dark:bg-violet-950/30",text: "text-violet-600 dark:text-violet-400", dot: "bg-violet-400" },
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
      href: r.product.productId ? `/dashboard/digital-products/${r.product.productId}/edit` : undefined,
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

function buildContinueActions(r: LaunchStageResults, productId: string, launchId: string): ContinueAction[] {
  const actions: ContinueAction[] = [];

  if (r.brain?.recommendations?.length) {
    const topRec = r.brain.recommendations.find(rec => rec.priority === "high") ?? r.brain.recommendations[0];
    actions.push({
      id: "top_rec", emoji: "⚡",
      label: topRec.title,
      detail: "Top recommendation from Business Brain",
      href: topRec.actionHref?.replace("[id]", productId) ?? `/dashboard/launch/${launchId}/workspace`,
      highlight: true,
    });
  }

  if (productId) {
    actions.push({ id: "improve_product", emoji: "📦", label: "Improve Product", detail: "Edit content, pricing, or structure", href: `/dashboard/digital-products/${productId}/edit` });
  }

  actions.push({ id: "more_marketing", emoji: "📣", label: "Generate More Marketing", detail: "More hooks, carousels, and posts", href: "/dashboard/workspace?tab=content" });

  if (r.store?.productId) {
    actions.push({ id: "improve_store", emoji: "🛍️", label: "Improve Store", detail: "Update headline, description, or SEO", href: productId ? `/dashboard/digital-products/${productId}/edit#publish` : "/dashboard/store" });
  }

  actions.push({ id: "rerun_brain", emoji: "🧠", label: "Run Business Brain Again", detail: "Get fresh recommendations after improvements", href: `/dashboard/launch/${launchId}/workspace` });
  actions.push({ id: "research_again", emoji: "🔍", label: "Analyse Competition Again", detail: "Check if market conditions have changed", href: "/dashboard/workspace?tab=research" });

  if (productId) {
    actions.push({ id: "video", emoji: "🎬", label: "Create Product Video", detail: "Turn your product into a video guide", href: `/dashboard/video-guide/new` });
  }

  return actions.slice(0, 6);
}

/* ─── Section quick links ────────────────────────────────────────────────────── */

interface SectionLink {
  id:       string;
  emoji:    string;
  label:    string;
  done:     boolean;
  href?:    string;
  external?: boolean;
}

function buildSectionLinks(r: LaunchStageResults, productId: string, storeUrl: string, launchId: string): SectionLink[] {
  return [
    { id: "research",  emoji: "🔍", label: "Research",        done: !!r.research, href: "/dashboard/workspace?tab=research" },
    { id: "product",   emoji: "📦", label: "Product",         done: !!r.product,  href: productId ? `/dashboard/digital-products/${productId}/edit` : undefined },
    { id: "design",    emoji: "🎨", label: "Design Assets",   done: !!r.design,   href: "/dashboard/design-studio" },
    { id: "marketing", emoji: "📣", label: "Marketing Content",done: !!r.marketing,href: "/dashboard/workspace?tab=content" },
    { id: "store",     emoji: "🛍️", label: "Store Listing",   done: !!r.store,    href: storeUrl || (productId ? `/dashboard/digital-products/${productId}/edit#publish` : undefined), external: !!storeUrl },
    { id: "brain",     emoji: "🧠", label: "Business Brain",  done: !!r.brain,    href: `/dashboard/launch/${launchId}/workspace` },
  ];
}

/* ─── Section label ──────────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3 mt-8 first:mt-0">
      {children}
    </p>
  );
}

/* ─── Error state ────────────────────────────────────────────────────────────── */

function ProjectError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-8 text-center max-w-sm">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Failed to load project</p>
        <p className="text-xs text-red-600/70 dark:text-red-400/60 mb-4">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onRetry}
            className="text-xs font-semibold text-red-600 dark:text-red-400 underline hover:no-underline"
          >
            Try again
          </button>
          <Link
            href="/dashboard/projects"
            className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            ← Back to Projects
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─── First-run state ────────────────────────────────────────────────────────── */

function ProjectFirstRun({ goal, launchId }: { goal: string; launchId: string }) {
  const steps = [
    { emoji: "🔬", title: "Research",  desc: "AI validates your niche" },
    { emoji: "📦", title: "Product",   desc: "Product description + pricing" },
    { emoji: "🎨", title: "Design",    desc: "Covers, mockups, social previews" },
    { emoji: "📣", title: "Marketing", desc: "Hooks, emails, carousels" },
    { emoji: "🛍️", title: "Store",    desc: "Publish-ready listing" },
    { emoji: "🧠", title: "Brain",     desc: "Scores + recommendations" },
  ];

  return (
    <div className="rounded-2xl border border-[#E5E7EB] dark:border-[#1E1E1E] bg-white dark:bg-[#111] p-6 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-950/30 mb-4">
        <Rocket className="w-7 h-7 text-orange-500" />
      </div>
      <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">Your workspace is ready</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs mx-auto">
        Run your first AI execution to build everything for <span className="font-medium text-gray-700 dark:text-gray-300 italic">&quot;{goal}&quot;</span>
      </p>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
        {steps.map((s) => (
          <div key={s.title} className="rounded-xl bg-gray-50 dark:bg-gray-900 p-2">
            <div className="text-xl mb-1">{s.emoji}</div>
            <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{s.title}</p>
            <p className="text-[9px] text-gray-400 leading-snug mt-0.5 hidden sm:block">{s.desc}</p>
          </div>
        ))}
      </div>

      <Link
        href={`/dashboard/launch/${launchId}/workspace`}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors shadow-lg shadow-orange-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
      >
        <Rocket className="w-4 h-4" />
        Start Full AI Execution
      </Link>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────────── */

export default function ProjectDashboardPage() {
  const { launchId } = useParams<{ launchId: string }>();
  const router       = useRouter();

  const [project,   setProject]   = useState<LaunchProject | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey,  setRetryKey]  = useState(0);

  useEffect(() => {
    setLoadError(null);
    setProject(null);
    (async () => {
      try {
        const res = await fetch(`/api/launch/${launchId}`);
        if (!res.ok) throw new Error("Not found");
        setProject(await res.json() as LaunchProject);
      } catch {
        setLoadError("Could not load this project.");
      }
    })();
  }, [launchId, retryKey]);

  /* ── Error ── */
  if (loadError) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto">
        <PageHeader
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Projects", href: "/dashboard/projects" }, { label: "Project" }]}
          title="Project"
          border
        />
        <ProjectError message={loadError} onRetry={() => setRetryKey(k => k + 1)} />
      </div>
    );
  }

  /* ── Loading ── */
  if (!project) return <LoadingPage />;

  /* ── Derived state ── */
  const r          = project.stageResults ?? ({} as LaunchStageResults);
  const productId  = r.product?.productId ?? "";
  const storeUrl   = r.store?.storeUrl    ?? "";
  const hasData    = !!(r.research || r.product || r.design || r.marketing || r.store || r.brain);

  const businessScore = r.brain?.businessScore ?? calcScore(r);
  const launchScore   = r.brain?.launchScore   ?? null;
  const stage         = deriveStage(businessScore);
  const stageStyle    = STAGE_COLORS[stage.id] ?? STAGE_COLORS.building;
  const content       = countContent(r);
  const timeline      = buildTimeline(r, launchId);
  const continueActs  = hasData ? buildContinueActions(r, productId, launchId) : [];
  const sectionLinks  = buildSectionLinks(r, productId, storeUrl, launchId);

  const storeLabel      = storeUrl ? "Published" : r.store?.productId ? "Draft" : "Not built";
  const storeLabelColor = storeUrl ? "text-emerald-500" : r.store?.productId ? "text-amber-500" : "text-gray-400 dark:text-gray-600";

  const projectTitle = r.product?.productName ?? project.goal;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {/* ── Sticky page header ── */}
      <div className="sticky top-0 z-20 bg-[#F9FAFB] dark:bg-[#0F0F0F]">
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard",  href: "/dashboard" },
            { label: "Projects",   href: "/dashboard/projects" },
            { label: projectTitle },
          ]}
          title={projectTitle}
          subtitle={`${stage.label} · updated ${relTime(project.updatedAt)}`}
          border
          action={
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${stageStyle.bg} ${stageStyle.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${stageStyle.dot}`} />
                {stage.label}
              </span>
              <NotificationPanel launchId={launchId} />
            </div>
          }
        />
      </div>

      <div className="px-4 sm:px-6 md:px-8 py-6 max-w-3xl mx-auto pb-16">

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
          {[
            { label: "Business Score", value: String(businessScore), sub: "/100", color: "" },
            { label: "Launch Score",   value: launchScore !== null ? String(launchScore) : "—", sub: launchScore !== null ? "/100" : "", color: "" },
            { label: "Content",        value: String(content), sub: " pieces", color: "" },
            { label: "Store",          value: storeLabel, sub: "", color: storeLabelColor },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl border border-[#E5E7EB] dark:border-[#1E1E1E] bg-white dark:bg-[#111] px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-0.5">{stat.label}</p>
              <p className={`text-base font-black tabular-nums ${stat.color || "text-gray-900 dark:text-white"}`}>
                {stat.value}
                <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">{stat.sub}</span>
              </p>
            </div>
          ))}
        </div>

        {/* ── First-run state ── */}
        {!hasData && (
          <div className="mt-5">
            <ProjectFirstRun goal={project.goal} launchId={launchId} />
          </div>
        )}

        {/* ── AI Company ─────────────────────────────────────────── */}
        {hasData && (
          <>
            <SectionLabel>AI Company</SectionLabel>
            <BusinessOSDashboard launchId={launchId} />
            <AutonomousModeDashboard launchId={launchId} />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
              <CEOBriefingCard    launchId={launchId} />
              <CompanyActivityFeed launchId={launchId} />
            </div>

            <div className="mt-4">
              <ApprovalInbox launchId={launchId} />
            </div>
          </>
        )}

        {/* ── AI Workforce ── */}
        {hasData && (
          <>
            <SectionLabel>AI Workforce</SectionLabel>
            <MissionControlCard launchId={launchId} />
            <div className="mt-4">
              <GrowthDashboard launchId={launchId} initialData={r.growth} productId={productId} />
            </div>
            <div className="mt-4">
              <WorkforcePanel launchId={launchId} />
            </div>
          </>
        )}

        {/* ── Project progress ── */}
        {hasData && (
          <>
            <SectionLabel>Project Progress</SectionLabel>

            {/* Section links */}
            <div className="rounded-2xl border border-[#E5E7EB] dark:border-[#1E1E1E] bg-white dark:bg-[#111] overflow-hidden divide-y divide-[#F5F5F5] dark:divide-[#1A1A1A] mb-4">
              {sectionLinks.map(section => (
                <div key={section.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#151515] transition-colors">
                  <span className="text-base shrink-0">{section.emoji}</span>
                  <p className="flex-1 text-sm font-semibold text-gray-900 dark:text-white">{section.label}</p>
                  {section.done ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 shrink-0" />
                  )}
                  {section.href ? (
                    <a
                      href={section.href}
                      target={section.external ? "_blank" : undefined}
                      rel={section.external ? "noopener noreferrer" : undefined}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-500 hover:underline shrink-0 ml-1"
                    >
                      {section.done ? "View" : "Start"}
                      {section.external ? <ExternalLink className="w-2.5 h-2.5" /> : <ArrowRight className="w-2.5 h-2.5" />}
                    </a>
                  ) : (
                    <span className="text-[11px] text-gray-400 dark:text-gray-600 shrink-0 ml-1">Not started</span>
                  )}
                </div>
              ))}
            </div>

            {/* Timeline */}
            {timeline.length > 0 && (
              <div className="rounded-2xl border border-[#E5E7EB] dark:border-[#1E1E1E] bg-white dark:bg-[#111] overflow-hidden divide-y divide-[#F5F5F5] dark:divide-[#1A1A1A]">
                {timeline.map((event, i) => (
                  <div key={event.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="flex flex-col items-center shrink-0 mt-0.5">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      </div>
                      {i < timeline.length - 1 && <div className="w-px flex-1 bg-[#E5E7EB] dark:bg-[#1E1E1E] mt-1 min-h-[8px]" />}
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      {event.href ? (
                        <a href={event.href} className="text-sm font-semibold text-gray-900 dark:text-white hover:text-orange-500 transition-colors flex items-center gap-1">
                          {event.emoji} {event.label}
                          <ArrowRight className="w-3 h-3 shrink-0 opacity-40" />
                        </a>
                      ) : (
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{event.emoji} {event.label}</p>
                      )}
                      {event.detail && (
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{event.detail}</p>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 tabular-nums whitespace-nowrap mt-0.5">
                      {relTime(event.timestamp)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Continue Building ── */}
        {continueActs.length > 0 && (
          <>
            <SectionLabel>Continue Building</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {continueActs.map(action => (
                <Link
                  key={action.id}
                  href={action.href}
                  className={[
                    "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
                    action.highlight
                      ? "border-orange-500/30 bg-orange-500/[0.04] hover:bg-orange-500/[0.08] dark:border-orange-500/20 dark:bg-orange-500/[0.06]"
                      : "border-[#E5E7EB] dark:border-[#1E1E1E] bg-white dark:bg-[#111] hover:bg-gray-50 dark:hover:bg-[#151515]",
                  ].join(" ")}
                >
                  <span className="text-base shrink-0">{action.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold leading-none ${action.highlight ? "text-orange-500" : "text-gray-900 dark:text-white"}`}>
                      {action.label}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{action.detail}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 shrink-0 transition-colors" />
                </Link>
              ))}
            </div>
          </>
        )}

        {/* ── Department links ── */}
        {hasData && (
          <>
            <SectionLabel>Departments</SectionLabel>
            <div className="space-y-2">
              {[
                { href: `/dashboard/projects/${launchId}/marketing`, emoji: "📣", label: "Marketing Department",   sub: "7 AI managers — TikTok, Instagram, YouTube, X, LinkedIn, Email, SEO", color: "border-blue-500/20 bg-blue-500/[0.03] hover:bg-blue-500/[0.07] dark:border-blue-500/10" },
                { href: `/dashboard/projects/${launchId}/analytics`, emoji: "📊", label: "Analytics Intelligence", sub: "AI analyst — insights, daily reports, recommendations",                  color: "border-emerald-500/20 bg-emerald-500/[0.03] hover:bg-emerald-500/[0.07] dark:border-emerald-500/10" },
                { href: `/dashboard/projects/${launchId}/memory`,    emoji: "🧠", label: "Business Memory",        sub: "Everything the AI knows about your business — view and edit",           color: "border-violet-500/20 bg-violet-500/[0.03] hover:bg-violet-500/[0.07] dark:border-violet-500/10" },
              ].map(dept => (
                <Link
                  key={dept.href}
                  href={dept.href}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${dept.color}`}
                >
                  <span className="text-lg shrink-0">{dept.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{dept.label}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{dept.sub}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
                </Link>
              ))}
            </div>
          </>
        )}

        {/* ── View full workspace ── */}
        <div className="mt-8 text-center">
          <Link
            href={`/dashboard/launch/${launchId}/workspace`}
            className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            View full AI workspace
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

      </div>
    </div>
  );
}
