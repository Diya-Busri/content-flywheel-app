/**
 * GET /api/admin/motion-graphics/render/history/:templateId — recent render
 * jobs for a template, newest first. Admin-only (see lib/motion-graphics/guard.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/motion-graphics/guard";
import { listRenderJobsForTemplate } from "@/lib/motion-graphics/job-store";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { templateId: string } }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const jobs = await listRenderJobsForTemplate(params.templateId);
  return NextResponse.json({ jobs });
}
