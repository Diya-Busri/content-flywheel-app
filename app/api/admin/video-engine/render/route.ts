/**
 * POST /api/admin/video-engine/render
 *
 * Starts an async render job for a VideoEngineProject.
 * Returns immediately with { jobId } — poll /api/admin/video-engine/status/{jobId}
 * to track progress.
 *
 * ⚠️  Background work pattern
 * Next.js 14 App Router wraps each request in an AsyncLocalStorage context for
 * things like request-scoped caching and cookie access.  Async work fired with a
 * bare `.catch()` can silently fail when Next.js tears down that context after
 * the response is sent (especially when the patched global `fetch` tries to
 * access the dead context).
 *
 * Using `setImmediate(() => pipeline.catch(...))` defers the pipeline start to
 * the next iteration of the Node.js event loop — after the response is fully
 * committed and the request context is no longer in scope — so the pipeline runs
 * in a clean async context with no Next.js request dependencies.
 *
 * Security: admin-only (isAdmin() checked server-side).
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/is-admin';
import { createJob, updateJob, generateJobId } from '@/lib/video-engine/job-store';
import { runRenderPipeline } from '@/lib/video-engine/render-pipeline';
import type { VideoEngineProject } from '@/lib/video-engine/schema';

export const dynamic = 'force-dynamic';

// Remotion rendering uses Node.js APIs (fs, path, child_process).
// This must NOT run on the Edge runtime.
export const runtime = 'nodejs';

const TAG = '[render/route]';

export async function POST(request: NextRequest) {
  // ── Admin guard ──────────────────────────────────────────────────────────
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let project: VideoEngineProject;
  try {
    project = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!project?.id || !Array.isArray(project?.scenes) || project.scenes.length === 0) {
    return NextResponse.json(
      { error: 'Body must be a VideoEngineProject with at least one scene' },
      { status: 400 },
    );
  }

  // ── Create job ───────────────────────────────────────────────────────────
  const jobId = generateJobId();
  createJob(jobId, project.id, project.title ?? 'Untitled');
  console.log(TAG, `job created — jobId=${jobId} projectId=${project.id}`);

  // ── Fire render outside Next.js request context ──────────────────────────
  //
  // setImmediate defers the pipeline to the next event-loop tick so it runs
  // AFTER this route handler has returned and Next.js has torn down its
  // request-scoped AsyncLocalStorage context.  This prevents the pipeline's
  // internal `fetch` calls (OpenAI, Remotion network ops) from being affected
  // by Next.js's request-context-aware fetch patching.
  setImmediate(() => {
    console.log(TAG, `pipeline starting (deferred) — jobId=${jobId}`);
    runRenderPipeline(jobId, project).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(TAG, `pipeline error — jobId=${jobId}:`, msg);
      updateJob(jobId, {
        stage:    'error',
        progress: 0,
        message:  'Render failed',
        error:    msg,
      });
    });
  });

  return NextResponse.json({ jobId, projectId: project.id });
}
