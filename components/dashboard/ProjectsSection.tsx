/**
 * ProjectsSection — client island for the home dashboard.
 * Shows top 3 AI launches with thumbnail + "Open Workspace" CTA.
 * Cards link to /dashboard/launch/[id]/workspace (not the project dashboard).
 */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Activity, ArrowRight, FolderOpen, Layers, Loader2, Zap } from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

interface ProjectSummary {
  id:             string;
  projectName:    string;
  businessStage:  { id: string; label: string } | string;
  businessScore:  number;
  launchScore:    number | null;
  contentCount:   number;
  storeStatus:    "published" | "draft" | "not_built";
  pendingTasks:   number;
  healthScore:    number | null;
  lastCheckedAt:  string | null;
  thumbnailUrl:   string | null;
  updatedAt:      string;
}

const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  building:       { bg: "bg-muted/40",      text: "text-muted-foreground"  },
  launching:      { bg: "bg-blue-500/10",   text: "text-blue-400"          },
  first_visitors: { bg: "bg-amber-500/10",  text: "text-amber-400"         },
  first_sales:    { bg: "bg-orange-500/10", text: "text-orange-400"        },
  growing:        { bg: "bg-green-500/10",  text: "text-green-400"         },
  scaling:        { bg: "bg-purple-500/10", text: "text-purple-400"        },
};

const STAGE_LABELS: Record<string, string> = {
  building:       "Building",
  launching:      "Launching",
  first_visitors: "First Visitors",
  first_sales:    "First Sales",
  growing:        "Growing",
  scaling:        "Scaling",
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

export function ProjectsSection() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then(r => r.ok ? r.json() as Promise<{ projects: ProjectSummary[] }> : Promise.resolve({ projects: [] }))
      .then(data => setProjects((data.projects ?? []).slice(0, 3)))
      .catch(() => setProjects([]));
  }, []);

  if (projects === null) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  if (projects.length === 0) return null;

  const totalPendingTasks = projects.reduce((sum, p) => sum + (p.pendingTasks ?? 0), 0);

  return (
    <section className="mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-green-400" />
          <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
            Recent Launches
          </h2>
          {totalPendingTasks > 0 && (
            <span className="text-[10px] font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded-full">
              {totalPendingTasks} pending
            </span>
          )}
        </div>
        <Link href="/dashboard/projects" className="text-xs font-medium text-orange-500 hover:text-orange-400 transition-colors">
          All launches →
        </Link>
      </div>

      {/* Project cards */}
      <div className="space-y-2">
        {projects.map(project => {
          const stageId    = typeof project.businessStage === "string" ? project.businessStage : project.businessStage.id;
          const stageStyle = STAGE_COLORS[stageId] ?? STAGE_COLORS.building;
          const stageLabel = typeof project.businessStage === "string"
            ? (STAGE_LABELS[project.businessStage] ?? project.businessStage)
            : project.businessStage.label;

          return (
            <div key={project.id} className="rounded-xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] hover:border-orange-200 dark:hover:border-orange-500/30 hover:shadow-md transition-all overflow-hidden group">
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Thumbnail or icon */}
                {project.thumbnailUrl ? (
                  <div className="w-9 h-9 rounded-lg overflow-hidden bg-[#0f0f12] shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={project.thumbnailUrl} alt="" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                    <FolderOpen className="w-4 h-4 text-orange-500" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      {project.projectName}
                    </p>
                    <span className={`shrink-0 inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold ${stageStyle.bg} ${stageStyle.text}`}>
                      {stageLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
                    <span>Score {project.businessScore}</span>
                    <span>·</span>
                    <span>{project.contentCount} assets</span>
                    {project.pendingTasks > 0 && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1 text-orange-500 font-semibold">
                          <Zap className="w-2.5 h-2.5" />
                          {project.pendingTasks} AI tasks
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Open Workspace CTA */}
                <Link
                  href={`/dashboard/launch/${project.id}/workspace`}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold transition-colors"
                >
                  <Layers className="w-3 h-3" />
                  <span className="hidden sm:inline">Workspace</span>
                  <ArrowRight className="w-3 h-3 sm:hidden" />
                </Link>
              </div>

              {/* Health bar */}
              {project.healthScore !== null && (
                <div className="mx-4 mb-3 h-1 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${project.healthScore}%`,
                      background: project.healthScore >= 75
                        ? "#22c55e"
                        : project.healthScore >= 50
                          ? "#f97316"
                          : "#f87171",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
