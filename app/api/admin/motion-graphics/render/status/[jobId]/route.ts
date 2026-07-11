/**
 * GET /api/admin/motion-graphics/render/status/:jobId — poll a render job.
 * Admin-only (see lib/motion-graphics/guard.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/motion-graphics/guard";
import { getRenderJob } from "@/lib/motion-graphics/job-store";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { jobId: string } }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const job = await getRenderJob(params.jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({ job });
}
