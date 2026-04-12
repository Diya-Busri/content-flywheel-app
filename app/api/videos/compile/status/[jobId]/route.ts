import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { renderJobsTable } from "@/db/schema/library-schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/videos/compile/status/[jobId]
 * Poll compile job status. Returns:
 *   { status: "pending" | "processing" | "completed" | "failed", url?, error? }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const [job] = await db
    .select()
    .from(renderJobsTable)
    .where(and(eq(renderJobsTable.id, jobId), eq(renderJobsTable.userId, userId)))
    .limit(1);

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json({
    status: job.status,
    url: job.videoUrl ?? null,
    error: job.error ?? null,
    updatedAt: job.updatedAt,
  });
}
