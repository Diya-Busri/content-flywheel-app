/**
 * /dashboard/projects
 * ──────────────────────────────────────────────────────────────────────────────
 * All Projects — polished list with skeleton loading, rich empty state,
 * mobile-first cards, and view toggle.
 */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FolderOpen, Plus, Rocket, TrendingUp, Clock,
  CheckCircle2, Circle, AlertTriangle, ExternalLink,
  LayoutGrid, List,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingCard, LoadingPageHeader } from "@/components/ui/loading-card";
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
  building:       { bg: "bg-gray-100 dark:bg-gray-800",      text: "text-gray-500 dark:text-gray-400",    dot: "bg-gray-400" },
  launching:      { bg: "bg-blue-50 dark:bg-blue-950/40",    text: "text-blue-600 dark:text-blue-400",    dot: "bg-blue-400" },
  first_visitors: { bg: "bg-amber-50 dark:bg-amber-950/30",  text: "text-amber-600 dark:text-amber-400",  dot: "bg-amber-400" },
  first_sales:    { bg: "bg-orange-50 dark:bg-orange-950/30",text: "text-orange-600 dark:text-orange-400",dot: "bg-orange-400 animate-pulse" },
  growing:        { bg: "bg-emerald-50 dark:bg-emerald-950/30",text:"text-emerald-600 dark:text-emerald-400",dot:"bg-emerald-400" },
  scaling:        { bg: "bg-violet-50 dark:bg-violet-950/30",text: "text-violet-600 dark:text-violet-400", dot: "bg-violet-400" },
};

const STAGE_NEXT: Record<string, string> = {
  building:       "Publish your store to start growing",
  launching:      "Drive traffic to your first sale",
  first_visitors: "Convert visitors into buyers",
  first_sales:    "Scale what's working",
  growing:        "Optimise and automate",
  scaling:        "Keep the flywheel spinning",
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

/* ─── Project card — grid view ───────────────────────────────────────────────── */

function ProjectCardGrid({ project }: { project: Project }) {
  const stage   = STAGE_COLORS[project.businessStage.id] ?? STAGE_COLORS.building;
  const pct     = completionPercent(project);
  const nextMsg = STAGE_NEXT[project.businessStage.id] ?? "";

  return (
    <Link href={`/dashboard/projects/${project.id}`} className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-2xl">
      <div className="rounded-2xl border border-[#E5E7EB] dark:border-[#1E1E1E] bg-white dark:bg-[#111] hover:border-orange-200 dark:hover:border-orange-500/30 hover:shadow-md transition-all duration-150 p-4 flex flex-col gap-3 h-full">

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0 group-hover:bg-orange-500/15 transition-colors">
            <FolderOpen className="w-4.5 h-4.5 text-orange-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug line-clamp-2">
              {project.projectName}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1">
              {relativeTime(project.updatedAt)}
            </p>
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${stage.bg} ${stage.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${stage.dot} shrink-0`} />
            {project.businessStage.label}
          </span>
        </div>

        {/* Progress */}
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

        {/* What's next */}
        {nextMsg && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-auto pt-1 border-t border-[#F5F5F5] dark:border-[#1A1A1A]">
            <span className="font-medium text-orange-500">Next:</span> {nextMsg}
          </p>
        )}
      </div>
    </Link>
  );
}

/* ─── Project row — list view ────────────────────────────────────────────────── */

function ProjectRow({ project }: { project: Project }) {
  const stage = STAGE_COLORS[project.businessStage.id] ?? STAGE_COLORS.building;
  const pct   = completionPercent(project);

  return (
    <Link
      href={`/dashboard/projects/${project.id}`}
      className="flex items-center gap-4 p-4 rounded-xl border border-[#E5E7EB] dark:border-[#1E1E1E] bg-white dark:bg-[#111] hover:border-orange-200 dark:hover:border-orange-500/30 hover:shadow-sm transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
    >
      <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0 group-hover:bg-orange-500/15 transition-colors">
        <FolderOpen className="w-4 h-4 text-orange-500" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{project.projectName}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="h-1 w-24 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] text-gray-400 tabular-nums">{pct}%</span>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${stage.bg} ${stage.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${stage.dot}`} />
          {project.businessStage.label}
        </span>
      </div>

      <div className="flex items-center gap-1 text-[10px] text-gray-400 shrink-0">
        <Clock className="h-3 w-3" />
        {relativeTime(project.updatedAt)}
      </div>
    </Link>
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
        Every project gives you a full AI company — researchers, marketers, analysts — all working together to grow your business.
      </p>

      {/* Journey preview */}
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
        Start First Project
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
            <div className="h-9 w-9 rounded-xl bg-gray-200 dark:bg-gray-800 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-48 bg-gray-200 dark:bg-gray-800 rounded" />
              <div className="h-1 w-24 bg-gray-200 dark:bg-gray-800 rounded" />
            </div>
            <div className="h-5 w-20 bg-gray-200 dark:bg-gray-800 rounded-full hidden sm:block" />
            <div className="h-3 w-12 bg-gray-200 dark:bg-gray-800 rounded" />
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

  useEffect(() => {
    fetch("/api/projects")
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then((data: { projects: Project[] }) => setProjects(data.projects))
      .catch(() => setError("Could not load projects."))
      .finally(() => setLoading(false));
  }, []);

  const growing   = projects.filter(p => ["growing", "scaling"].includes(p.businessStage.id)).length;
  const launching = projects.filter(p => ["launching", "first_visitors", "first_sales"].includes(p.businessStage.id)).length;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {/* Page header */}
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Projects" }]}
        title="Projects"
        subtitle={projects.length > 0 ? `${projects.length} AI business${projects.length !== 1 ? "es" : ""}` : "Your AI company portfolio"}
        border
        action={
          <Link
            href="/dashboard/launch"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors shadow-sm shadow-orange-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Project</span>
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

        {/* View toggle + sort (only when has projects) */}
        {!loading && projects.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
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
            <button
              onClick={() => { setError(null); setLoading(true); fetch("/api/projects").then(r => r.json()).then((d: { projects: Project[] }) => setProjects(d.projects)).catch(() => setError("Could not load projects.")).finally(() => setLoading(false)); }}
              className="mt-3 text-xs text-red-600 dark:text-red-400 underline hover:no-underline"
            >
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
