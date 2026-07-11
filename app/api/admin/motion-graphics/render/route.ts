/**
 * POST /api/admin/motion-graphics/render
 *
 * Starts an async export render job for a template. Returns { jobId }
 * immediately — poll /api/admin/motion-graphics/render/status/:jobId.
 *
 * Background-work pattern mirrors app/api/admin/video-engine/render/route.ts:
 * the pipeline is kicked off via setImmediate() so it runs after this
 * request's response has been sent and Next.js has torn down its
 * request-scoped AsyncLocalStorage context (avoids fetch/context teardown
 * issues for the OpenAI/Remotion/R2 calls the pipeline makes).
 *
 * Admin-only (see lib/motion-graphics/guard.ts). Rendering needs Node APIs
 * (fs, child_process via Chromium) so this must run on the Node runtime,
 * never Edge.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/motion-graphics/guard";
import { getTemplate } from "@/lib/motion-graphics/templates-repo";
import { createRenderJob, updateRenderJob } from "@/lib/motion-graphics/job-store";
import { runMotionGraphicsRenderPipeline } from "@/lib/motion-graphics/render-pipeline";
import type { ExportFormat } from "@/lib/motion-graphics/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TAG = "[motion-graphics/render/route]";
const VALID_FORMATS: ExportFormat[] = ["mp4", "gif", "webm"];

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { templateId?: string; format?: ExportFormat };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { templateId, format = "mp4" } = body;
  if (!templateId) return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  if (!VALID_FORMATS.includes(format)) {
    return NextResponse.json({ error: `format must be one of ${VALID_FORMATS.join(", ")}` }, { status: 400 });
  }

  const template = await getTemplate(templateId);
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  if (template.scenes.length === 0) {
    return NextResponse.json({ error: "Template has no scenes to render" }, { status: 400 });
  }

  const job = await createRenderJob({
    templateId,
    userId,
    format,
    aspectRatio: template.aspectRatio,
  });
  console.log(TAG, `job created — jobId=${job.id} templateId=${templateId} format=${format}`);

  setImmediate(() => {
    console.log(TAG, `pipeline starting (deferred) — jobId=${job.id}`);
    runMotionGraphicsRenderPipeline(job.id, template, format).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(TAG, `pipeline error — jobId=${job.id}:`, msg);
      void updateRenderJob(job.id, { stage: "error", message: "Render failed", error: msg });
    });
  });

  return NextResponse.json({ jobId: job.id, templateId });
}
