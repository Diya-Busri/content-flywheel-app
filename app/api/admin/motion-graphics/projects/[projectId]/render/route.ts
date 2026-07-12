/**
 * POST /api/admin/motion-graphics/projects/:id/render
 *
 * Converts a ContentProject's shortForm storyboard into a TemplateDraft,
 * saves it as a motion_graphics_templates row (or reuses the existing linked
 * one), then starts a RedditReaction render job using the existing render
 * infrastructure.
 *
 * Uses the "RedditReaction" Remotion composition rather than "MotionGraphicsStudio".
 *
 * Admin-only.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/motion-graphics/guard";
import { getProject, updateProject } from "@/lib/motion-graphics/projects-repo";
import { createRenderJob, updateRenderJob } from "@/lib/motion-graphics/job-store";
import { runRedditReactionRenderPipeline } from "@/lib/motion-graphics/reddit-reaction-render-pipeline";
import type { ExportFormat } from "@/lib/motion-graphics/types";

type Ctx = { params: Promise<{ projectId: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!project.shortForm?.scenes?.length) {
    return NextResponse.json({ error: "Project has no storyboard scenes to render" }, { status: 400 });
  }

  let body: { format?: ExportFormat } = {};
  try {
    body = await request.json();
  } catch {
    // no body — use defaults
  }
  const format: ExportFormat = body.format ?? "mp4";

  const job = await createRenderJob({
    templateId: projectId, // use projectId as reference (no template row needed)
    userId,
    format,
    aspectRatio: project.aspectRatio,
  });

  // Mark project as rendering
  await updateProject(projectId, { status: "rendering", renderJobId: job.id });

  setImmediate(() => {
    runRedditReactionRenderPipeline(job.id, project, format)
      .then(async (outputUrl) => {
        await updateProject(projectId, { status: "complete", outputUrl });
      })
      .catch(async (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[project-render/route] pipeline error:", msg);
        await updateRenderJob(job.id, { stage: "error", message: "Render failed", error: msg });
        await updateProject(projectId, { status: "failed" });
      });
  });

  return NextResponse.json({ jobId: job.id });
}
