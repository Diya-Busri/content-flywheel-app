/**
 * /dashboard/projects
 * ──────────────────────────────────────────────────────────────────────────────
 * All Projects — every AI execution becomes a persistent project.
 * Shows business stage, scores, content count, and store status.
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FolderOpen, Plus, Loader2, Rocket, TrendingUp,
  Clock, LayoutGrid, List, ExternalLink,
} from "lucide-react";
import Link from "next/link";

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

/* ─── Stage badge config ─────────────────────────────────────────────────────── */

const STAGE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  building:       { bg: "bg-muted/40",        text: "text-muted-foreground",  dot: "bg-muted-foreground/40" },
  launching:      { bg: "bg-blue-500/10",     text: "text-blue-400",          dot: "bg-blue-400" },
  first_visitors: { bg: "bg-amber-500/10",    text: "text-amber-400",         dot: "bg-amber-400" },
  first_sales:    { bg: "bg-orange-500/10",   text: "text-orange-400",        dot: "bg-orange-400 animate-pulse" },
  growing:        { bg: "bg-green-500/10",    text: "text-green-400",         dot: "bg-green-400" },
  scaling:        { bg: "bg-purple-500/10",   text: "text-purple-400",        dot: "bg-purple-400" },
};

const STORE_STATUS: Record<string, { label: string; color: string }> = {
  published: { label: "Published", color: "text-green-400" },
  draft:     { label: "Draft",     color: "text-amber-400" },
  not_built: { label: "Not built", color: "text-muted-foreground/40" },
};

/* ─── Relative time helper ───────────────────────────────────────────────────── */

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/* ─── Stage completion dots ──────────────────────────────────────────────────── */

function StageDots({ project }: { project: Project }) {
  const stages = [
    { key: "research",  label: "Research",  done: project.hasResearch  },
    { key: "product",   label: "Product",   done: project.hasProduct   },
    { key: "design",    label: "Design",    done: project.hasDesign    },
    { key: "marketing", label: "Marketing", done: project.hasMarketing },
    { key: "store",     label: "Store",     done: project.hasStore     },
    { key: "brain",     label: "Brain",     done: project.hasBrain     },
  ];
  return (
    <div className="flex items-center gap-1">
      {stages.map(s => (
        <div
          key={s.key}
          title={s.label}
          className={[
            "w-1.5 h-1.5 rounded-full",
            s.done ? "bg-green-500" : "bg-muted/40",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

/* ─── Project Card ───────────────────────────────────────────────────────────── */

function ProjectCard({ project }: { project: Project }) {
  const stage  = STAGE_COLORS[project.businessStage.id] ?? STAGE_COLORS.building;
  const store  = STORE_STATUS[project.storeStatus];

  return (
    <Link href={`/dashboard/projects/${project.id}`} className="block group">
      <div className="rounded-2xl border border-border/50 bg-card/60 hover:border-border hover:bg-card/90 transition-all p-4 space-y-3">

        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
            <FolderOpen className="w-4 h-4 text-orange-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-foreground leading-snug line-clamp-2">
              {project.projectName}
            </p>
            {project.projectName !== project.goal && (
              <p className="text-[10px] text-muted-foreground/50 mt-0.5 line-clamp-1">{project.goal}</p>
            )}
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${stage.bg} ${stage.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${stage.dot}`} />
            {project.businessStage.label}
          </span>
        </div>

        {/* Score bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-muted-foreground/50 font-semibold uppercase tracking-wider">Business Score</span>
              <span className="text-[11px] font-black text-foreground tabular-nums">{project.businessScore}</span>
            </div>
            <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-green-500"
                style={{ width: `${project.businessScore}%` }}
              />
            </div>
          </div>
          {project.launchScore !== null && (
            <div className="text-center shrink-0">
              <p className="text-[9px] text-muted-foreground/50 font-semibold uppercase tracking-wider">Launch</p>
              <p className="text-[13px] font-black text-foreground">{project.launchScore}</p>
            </div>
          )}
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between gap-2">
          <StageDots project={project} />
          <div className="flex items-center gap-3">
            {project.contentCount > 0 && (
              <span className="text-[10px] text-muted-foreground/50">
                {project.contentCount} assets
              </span>
            )}
            <span className={`text-[10px] font-semibold ${store.color}`}>
              {store.label}
            </span>
            <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {relativeTime(project.updatedAt)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ─── Empty state ────────────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-4">
        <FolderOpen className="w-7 h-7 text-orange-500" />
      </div>
      <p className="text-[15px] font-bold text-foreground mb-1">No projects yet</p>
      <p className="text-[12px] text-muted-foreground/60 mb-6 max-w-xs">
        Every AI execution becomes a persistent project. Start your first one to build your business.
      </p>
      <Link
        href="/dashboard/launch"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-bold transition-colors"
      >
        <Rocket className="w-4 h-4" />
        Start First Project
      </Link>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────────── */

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) throw new Error("Failed to load projects");
        const data = await res.json() as { projects: Project[] };
        setProjects(data.projects);
      } catch (e) {
        setError("Could not load projects.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* Derived stats */
  const growing   = projects.filter(p => ["growing", "scaling"].includes(p.businessStage.id)).length;
  const launching = projects.filter(p => ["launching", "first_visitors", "first_sales"].includes(p.businessStage.id)).length;

  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-[22px] font-black text-foreground tracking-tight">Your Projects</h1>
            <p className="text-[12px] text-muted-foreground/60 mt-1">
              Every execution is a persistent business — AI keeps working, you keep building.
            </p>
          </div>
          <Link
            href="/dashboard/launch"
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-bold transition-colors shadow-lg shadow-orange-500/20"
          >
            <Plus className="w-4 h-4" />
            New Project
          </Link>
        </div>

        {/* ── Summary strip (if has projects) ── */}
        {projects.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { label: "Total Projects",  value: projects.length,   icon: <FolderOpen className="w-3.5 h-3.5" /> },
              { label: "Actively Growing", value: growing,           icon: <TrendingUp className="w-3.5 h-3.5 text-green-400" /> },
              { label: "In Launch Phase",  value: launching,         icon: <Rocket className="w-3.5 h-3.5 text-orange-400" /> },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl border border-border/40 bg-card/60 px-4 py-3">
                <div className="flex items-center gap-1.5 text-muted-foreground/60 mb-1">
                  {stat.icon}
                  <span className="text-[10px] font-semibold uppercase tracking-wider">{stat.label}</span>
                </div>
                <p className="text-[22px] font-black text-foreground tabular-nums">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Content ── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-center text-[13px] text-muted-foreground/60 py-20">{error}</p>
        ) : projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projects.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
