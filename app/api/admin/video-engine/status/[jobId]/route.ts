/**
 * GET /api/admin/video-engine/status/[jobId]
 *
 * Returns the current state of a render job.
 * Poll this endpoint every 2 seconds from the frontend.
 *
 * Response: RenderJob (from job-store.ts)
 * When stage === 'complete': includes downloadUrl for the rendered MP4.
 * When stage === 'error':    includes error string.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/is-admin';
import { getJob } from '@/lib/video-engine/job-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const job = getJob(params.jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json(job);
}
