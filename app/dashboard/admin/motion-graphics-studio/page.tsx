"use client";

/**
 * Admin → Motion Graphics Studio
 *
 * ADMIN ONLY. Five tabs:
 *   - Content Projects   — AI Reddit Reaction + other content mode projects
 *   - AI Script to Video — paste a script or choose a content mode
 *   - Templates          — saved/reusable templates, opens the Template Builder
 *   - Animation Library  — all reusable animation components, live preview
 *   - Asset Library      — upload/manage images, video, logos, audio, music, SFX
 */

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clapperboard, Sparkles, LayoutTemplate, FolderOpen, Film, Loader2, ExternalLink } from "lucide-react";
import { TemplatesList } from "@/components/motion-graphics-studio/TemplatesList";
import { AnimationLibraryGrid } from "@/components/motion-graphics-studio/AnimationLibraryGrid";
import { ScriptToVideoPanel } from "@/components/motion-graphics-studio/ScriptToVideoPanel";
import { AssetLibraryPanel } from "@/components/motion-graphics-studio/AssetLibraryPanel";
import type { ContentProject, ContentProjectStatus } from "@/lib/motion-graphics/types";

// ─── Project status colours ───────────────────────────────────────────────────

const STATUS_BADGE: Record<ContentProjectStatus, string> = {
  draft: "bg-muted text-muted-foreground border-transparent",
  needs_assets: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  ready_to_render: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  rendering: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  complete: "bg-green-500/15 text-green-400 border-green-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
};

const STATUS_LABELS: Record<ContentProjectStatus, string> = {
  draft: "Draft",
  needs_assets: "Needs assets",
  ready_to_render: "Ready",
  rendering: "Rendering",
  complete: "Complete",
  failed: "Failed",
};

// ─── Projects list ────────────────────────────────────────────────────────────

const ProjectsList: React.FC = () => {
  const [projects, setProjects] = useState<ContentProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/motion-graphics/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground">
        <Loader2 size={16} className="animate-spin" />
        Loading projects…
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="py-16 text-center">
        <Film size={32} className="mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">No content projects yet.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Use the AI Script tab → choose a content mode → generate your first storyboard.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {projects.map((p) => {
        const scenes = p.shortForm?.scenes?.length ?? 0;
        const duration = p.shortForm?.durationSeconds ?? 0;
        return (
          <div
            key={p.id}
            className="flex items-center gap-3 p-3 rounded-lg border hover:border-orange-500/30 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.contentMode.replace(/-/g, " ")} · {p.aspectRatio} · {scenes} scenes · {duration}s ·{" "}
                {new Date(p.createdAt).toLocaleDateString("en-GB")}
              </p>
            </div>
            <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[p.status]}`}>
              {STATUS_LABELS[p.status]}
            </Badge>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/admin/motion-graphics-studio/projects/${p.id}`}>
                <ExternalLink size={12} className="mr-1.5" />
                Open
              </Link>
            </Button>
          </div>
        );
      })}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MotionGraphicsStudioPage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(searchParams?.get("tab") ?? "ai");

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Clapperboard className="text-orange-500" size={26} />
          Motion Graphics Studio
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Faceless AI video production — admin only.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="ai" className="gap-1.5">
            <Sparkles size={14} />
            AI Script to Video
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-1.5">
            <Film size={14} />
            Content Projects
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <LayoutTemplate size={14} />
            Templates
          </TabsTrigger>
          <TabsTrigger value="animations" className="gap-1.5">
            <Sparkles size={14} />
            Animation Library
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-1.5">
            <FolderOpen size={14} />
            Asset Library
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="mt-5">
          <ScriptToVideoPanel />
        </TabsContent>
        <TabsContent value="projects" className="mt-5">
          <ProjectsList />
        </TabsContent>
        <TabsContent value="templates" className="mt-5">
          <TemplatesList />
        </TabsContent>
        <TabsContent value="animations" className="mt-5">
          <AnimationLibraryGrid />
        </TabsContent>
        <TabsContent value="assets" className="mt-5">
          <AssetLibraryPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
