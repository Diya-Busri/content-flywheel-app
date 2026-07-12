"use client";

/**
 * Admin → Motion Graphics Studio → Storyboard Review
 *
 * Loads a ContentProject from /api/admin/motion-graphics/projects/:id and
 * renders the full 3-column StoryboardReviewPanel:
 *   left   — scene list
 *   centre — live RedditReaction Remotion preview + render controls
 *   right  — per-scene editor
 *
 * ADMIN ONLY — inherits guard from app/dashboard/admin/layout.tsx.
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, ExternalLink } from "lucide-react";
import { StoryboardReviewPanel } from "@/components/motion-graphics-studio/StoryboardReviewPanel";
import type { ContentProject, ContentProjectStatus } from "@/lib/motion-graphics/types";

const STATUS_COLORS: Record<ContentProjectStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  needs_assets: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  ready_to_render: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  rendering: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  complete: "bg-green-500/15 text-green-400 border-green-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
};

const STATUS_LABELS: Record<ContentProjectStatus, string> = {
  draft: "Draft",
  needs_assets: "Needs assets",
  ready_to_render: "Ready to render",
  rendering: "Rendering",
  complete: "Complete",
  failed: "Failed",
};

export default function ProjectStoryboardPage({
  params,
}: {
  params: { projectId: string };
}) {
  const { projectId } = params;
  const [project, setProject] = useState<ContentProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/motion-graphics/projects/${projectId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setProject(d.project);
      })
      .catch(() => setError("Failed to load project"))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-muted-foreground" size={28} />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-6 text-center">
        <p className="text-destructive">{error || "Project not found"}</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/dashboard/admin/motion-graphics-studio">
            <ArrowLeft size={14} className="mr-2" />
            Back to Studio
          </Link>
        </Button>
      </div>
    );
  }

  const statusColor = STATUS_COLORS[project.status] ?? STATUS_COLORS.draft;
  const statusLabel = STATUS_LABELS[project.status] ?? project.status;

  return (
    <div className="p-5 flex flex-col gap-4 min-h-0 h-screen overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/admin/motion-graphics-studio?tab=projects">
            <ArrowLeft size={16} />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{project.name}</h1>
          <p className="text-xs text-muted-foreground">
            {project.contentMode.replace(/-/g, " ")} · {project.aspectRatio} ·{" "}
            {project.shortForm?.scenes?.length ?? 0} scenes ·{" "}
            {project.shortForm?.durationSeconds ?? 0}s
          </p>
        </div>
        <Badge
          variant="outline"
          className={`text-[11px] ${statusColor}`}
        >
          {statusLabel}
        </Badge>
        {/* Long-form plan link */}
        {project.longForm && (
          <Button variant="outline" size="sm" className="text-xs" asChild>
            <Link href={`/dashboard/admin/motion-graphics-studio/projects/${projectId}/long-form`}>
              <ExternalLink size={12} className="mr-1.5" />
              Long-form plan
            </Link>
          </Button>
        )}
      </div>

      {/* Analysis summary ribbon */}
      {project.analysis && (
        <div className="flex-shrink-0 rounded-md bg-muted/40 border px-4 py-2 grid grid-cols-3 gap-x-6 gap-y-0.5">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Core problem</span>
            <p className="text-xs font-medium truncate">{project.analysis.coreProblem}</p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Audience</span>
            <p className="text-xs font-medium truncate">{project.analysis.audience}</p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Content opportunity</span>
            <p className="text-xs font-medium truncate">{project.analysis.contentOpportunity}</p>
          </div>
        </div>
      )}

      {/* Storyboard */}
      <div className="flex-1 min-h-0">
        <StoryboardReviewPanel
          project={project}
          onSaved={(saved) => setProject(saved)}
        />
      </div>
    </div>
  );
}
