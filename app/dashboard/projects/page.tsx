/**
 * /dashboard/projects — Launch History
 * ──────────────────────────────────────────────────────────────────────────────
 * Every AI launch you've ever run, permanently saved as cards.
 * Primary CTA: "Open Workspace" → /dashboard/launch/[id]/workspace
 * Secondary:   gear icon → /dashboard/projects/[id] (project operations)
 */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FolderOpen, Plus, Rocket, TrendingUp, Clock,
  CheckCircle2, Circle, AlertTriangle, ExternalLink,
  LayoutGrid, List, Settings2, Layers,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingCard } from "@/components/ui/loading-card";
import { PageHeader } from "@/components/ui/page-header";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

interface Project {
  id:            string;
  goal:          string;
  projectName:   string;
  status:        string;
  businessScore: number;
  launchScore:   number | null;
  businessStage: { id: string; label: string };
  contentCount:  number;
  storeStatus:   "published" | "draft" | "not_built";
  storeUrl:      string | null;
  productId:     string | null;
  thumbnailUrl:  string | null;
  hasResearch:   boolean;
  hasProduct:    boolean;
  hasDesign:     boolean;
  hasMarketing:  boolean;
  hasStore:      boolean;
  hasBrain:      boolean;
  createdAt:     string;
  updatedAt:     string;
}

/* ─── Configs ────────────────────────────────────────────────────────────────── */

const STAGE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  building:       { bg: "bg-gray-100 dark:bg-gray-800",       text: "text-gray-500 dark:text-gray-400",    dot: "bg-gray-400" },
  launching:      { bg: "bg-blue-50 dark:bg-blue-950/40",     text: "text-blue-600 dark:text-blue-400",    dot: "bg-blue-400" },
  first_visitors: { bg: "bg-amber-50 dark:bg-amber-950/30",   text: "text-amber-600 dark:text-amber-400",  dot: "bg-amber-400" },
  first_sales:    { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-600 dark:text-orange-400",dot: "bg-orange-400 animate-pulse" },
  growing:        { bg: "bg-emerald-50 dark:bg-emerald-950/30",text:"text-emerald-600 dark:text-emerald-400",dot:"bg-emerald-400" },
  scaling:        { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-600 dark:text-violet-400", dot: "bg-violet-400" },
};

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs  = Math.floor(mins / 60);
  if (hrs  < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function completionPercent(p: Project): number {
  const flags = [p.hasResearch, p.hasProduct, p.hasDesign, p.hasMarketing, p.hasStore, p.hasBrain];
  return Math.round((flags.filter(Boolean).length / flags.length) * 100);
}

/* ─── Stage dots ─────────────────────────────────────────────────────────────── */

function StageDots({ project }: { project: Project }) {
  const stages = [
    { key: "research",  done: project.hasResearch  },
    { key: "product",   done: project.hasProduct   },
    { key: "design",    done: project.hasDesign    },
    { key: "marketing", done: project.hasMarketing },
    { key: "store",     done: project.hasStore     },
  ];
  return (
    <div className="flex items-center gap-1">
      {stages.map(({ key, done }) => (
        done
          ? <CheckCircle2 key={key} className="h-3 w-3 text-emerald-500" />
          : <Circle       key={key} className="h-3 w-3 text-gray-300 dark:text-gray-600" />
      ))}
    </div>
  );
}

/* ─── Thumbnail or fallback icon ─────────────────────────────────────────────── */

function ProjectThumbnail({ url, size = "md" }: { url: string | null; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-10 h-10" : "w-full aspect-[4/3]";
  if (url) {
    return (
      <div className={`${dim} rounded-xl overflow-hidden bg-muted/20 shrink-0`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className={`${size === "sm" ? "w-10 h-10" : "w-9 h-9"} rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0`}>
      <FolderOpen className="w-4.5 h-4.5 text-orange-500" />
    </div>
  );
}

/* ─── Project card — grid view ───────────────────────────────────────────────── */

function ProjectCardGrid({ project }: { project: Project }) {
  const stage   = STAGE_COLORS[project.businessStage.id] ?? STAGE_COLORS.building;
  const pct     = completionPercent(project);

  return (
    <div className="rounded-2xl border border-[#E5E7EB] dark:border-[#1E1E1E] bg-white dark:bg-[#111] hover:border-orange-200 dark:hover:border-orange-500/30 hover:shadow-md transition-all duration-150 flex flex-col overflow-hidden group">

      {/* Thumbnail strip */}
      {project.thumbnailUrl ? (
        <div className="relative h-32 bg-muted/10 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={project.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/40 to-transparent" />
          {/* Stage badge on image */}
          <span className={`absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold backdrop-blur-sm ${stage.bg} ${stage.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${stage.dot} shrink-0`} />
            {project.businessStage.label}
          </span>
        </div>
      ) : (
        /* No image — small icon header */
        <div className="px-4 pt-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0 group-hover:bg-orange-500/15 transition-colors">
            <FolderOpen className="w-4.5 h-4.5 text-orange-500" />
          </div>
          <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${stage.bg} ${stage.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${stage.dot} shrink-0`} />
            {project.businessStage.label}
          </span>
        </div>
      )}

      {/* Body */}
      <div className="px-4 pt-3 pb-4 flex flex-col gap-3 flex-1">

        {/* Title + timestamp */}
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug line-clamp-2">
            {project.projectName}
          </p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
            <Clock className="inline w-2.5 h-2.5 mr-0.5" />
            {relativeTime(project.updatedAt)}
          </p>
        </div>

        {/* Stage completion dots */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <StageDots project={project} />
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 tabular-nums">{pct}%</span>
          </div>
          <div className="h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto pt-1">
          <Link
            href={`/dashboard/launch/${project.id}/workspace`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold transition-colors shadow-sm shadow-orange-500/20"
          >
            <Layers className="w-3 h-3" />
            Open Workspace
          </Link>
          <Link
            href={`/dashboard/projects/${project.id}`}
            title="Project operations & analytics"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] bg-transparent hover:bg-muted/50 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </Link>
          {project.storeUrl && (
            <a
              href={project.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="View store"
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] bg-transparent hover:bg-muted/50 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Project row — list view ────────────────────────────────────────────────── */

function ProjectRow({ project }: { project: Project }) {
  const stage = STAGE_COLORS[project.businessStage.id] ?? STAGE_COLORS.building;
  const pct   = completionPercent(project);

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-[#E5E7EB] dark:border-[#1E1E1E] bg-white dark:bg-[#111] hover:border-orange-200 dark:hover:border-orange-500/30 hover:shadow-sm transition-all group">

      {/* Thumbnail or icon */}
      <ProjectThumbnail url={project.thumbnailUrl} size="sm" />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{project.projectName}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="h-1 w-24 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] text-gray-400 tabular-nums">{pct}%</span>
        </div>
      </div>

      {/* Stage badge */}
      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${stage.bg} ${stage.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${stage.dot}`} />
          {project.businessStage.label}
        </span>
      </div>

      {/* Timestamp */}
      <div className="flex items-center gap-1 text-[10px] text-gray-400 shrink-0">
        <Clock className="h-3 w-3" />
        {relativeTime(project.updatedAt)}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Link
          href={`/dashboard/launch/${project.id}/workspace`}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold transition-colors"
        >
          <Layers className="w-3 h-3" />
          <span className="hidden sm:inline">Workspace</span>
        </Link>
        <Link
          href={`/dashboard/projects/${project.id}`}
          title="Project operations"
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-muted/50 transition-colors"
        >
          <Settings2 className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

/* ─── Rich empty state ───────────────────────────────────────────────────────── */

function ProjectsEmptyState() {
  const steps = [
    { emoji: "🔬", title: "Research",  desc: "AI validates your niche and finds opportunities" },
    { emoji: "📦", title: "Build",     desc: "Product, design, and marketing generated in minutes" },
    { emoji: "📈", title: "Grow",      desc: "Autonomous AI company keeps working after launch" },
  ];

  return (
    <div className="py-12 px-4 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-950/30 mb-5">
        <Rocket className="w-8 h-8 text-orange-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
        Launch your first AI project
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
        Every launch is permanently saved here. AI researchers, designers, and marketers all work together — and their work stays forever.
      </p>

      <div className="grid grid-cols-3 gap-3 mt-8 mb-8 max-w-lg mx-auto">
        {steps.map((step) => (
          <div key={step.title} className="rounded-xl border border-[#E5E7EB] dark:border-[#1E1E1E] bg-white dark:bg-[#111] p-3 text-left">
            <div className="text-2xl mb-2">{step.emoji}</div>
            <p className="text-xs font-bold text-gray-900 dark:text-white">{step.title}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{step.desc}</p>
          </div>
        ))}
      </div>

      <Link
        href="/dashboard/launch"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors shadow-lg shadow-orange-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
      >
        <Rocket className="w-4 h-4" />
        Start First Launch
      </Link>
    </div>
  );
}

/* ─── Loading skeleton ───────────────────────────────────────────────────────── */

function ProjectsSkeleton({ view }: { view: "grid" | "list" }) {
  if (view === "list") {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-[#E5E7EB] dark:border-[#1E1E1E] bg-white dark:bg-[#111] animate-pulse">
            <div className="h-10 w-10 rounded-xl bg-gray-200 dark:bg-gray-800 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-48 bg-gray-200 dark:bg-gray-800 rounded" />
              <div className="h-1 w-24 bg-gray-200 dark:bg-gray-800 rounded" />
            </div>
            <div className="h-5 w-20 bg-gray-200 dark:bg-gray-800 rounded-full hidden sm:block" />
            <div className="h-3 w-12 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-7 w-24 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <LoadingCard key={i} lines={3} />
      ))}
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────────── */

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [view,     setView]     = useState<"grid" | "list">("grid");

  const loadProjects = () => {
    setLoading(true);
    setError(null);
    fetch("/api/projects")
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then((data: { projects: Project[] }) => setProjects(data.projects))
      .catch(() => setError("Could not load projects."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadProjects(); }, []);

  const growing   = projects.filter(p => ["growing", "scaling"].includes(p.businessStage.id)).length;
  const launching = projects.filter(p => ["launching", "first_visitors", "first_sales"].includes(p.businessStage.id)).length;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Launch History" }]}
        title="Launch History"
        subtitle={projects.length > 0 ? `${projects.length} AI launch${projects.length !== 1 ? "es" : ""} — all permanently saved` : "Every AI launch, permanently saved"}
        border
        action={
          <Link
            href="/dashboard/launch"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors shadow-sm shadow-orange-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Launch</span>
            <span className="sm:hidden">New</span>
          </Link>
        }
      />

      <div className="px-4 sm:px-6 md:px-8 py-6 max-w-5xl mx-auto space-y-6 pb-12">

        {/* Summary strip */}
        {!loading && projects.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total",     value: projects.length, icon: <FolderOpen className="w-3.5 h-3.5 text-orange-500" /> },
              { label: "Growing",   value: growing,         icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> },
              { label: "Launching", value: launching,       icon: <Rocket className="w-3.5 h-3.5 text-blue-500" /> },
            ].map(({ label, value, icon }) => (
              <div key={label} className="rounded-xl border border-[#E5E7EB] dark:border-[#1E1E1E] bg-white dark:bg-[#111] px-4 py-3">
                <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
                  {icon}
                  <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
                </div>
                <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* View toggle */}
        {!loading && projects.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {projects.length} launch{projects.length !== 1 ? "es" : ""}
            </p>
            <div className="flex items-center gap-1 rounded-lg border border-[#E5E7EB] dark:border-[#1E1E1E] p-1">
              {(["grid", "list"] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  aria-label={`${v} view`}
                  className={`p-1.5 rounded transition-colors ${
                    view === v
                      ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  {v === "grid" ? <LayoutGrid className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <ProjectsSkeleton view={view} />
        ) : error ? (
          <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-6 text-center">
            <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
            <button onClick={loadProjects} className="mt-3 text-xs text-red-600 dark:text-red-400 underline hover:no-underline">
              Try again
            </button>
          </div>
        ) : projects.length === 0 ? (
          <ProjectsEmptyState />
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projects.map(p => <ProjectCardGrid key={p.id} project={p} />)}
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map(p => <ProjectRow key={p.id} project={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}
