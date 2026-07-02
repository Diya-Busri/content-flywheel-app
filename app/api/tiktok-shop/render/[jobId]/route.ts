export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { renderJobsTable } from "@/db/schema/library-schema";
import { eq, and } from "drizzle-orm";

/**
 * GET: Poll render job status. Returns { status, videoUrl?, error? }
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
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

    const result: { status: string; videoUrl?: string; error?: string; script?: unknown } = {
      status: job.status,
    };
    if (job.videoUrl) result.videoUrl = job.videoUrl;
    if (job.error) result.error = job.error;
    const payload = job.payload as { script?: unknown } | undefined;
    if (payload?.script) result.script = payload.script;

    return NextResponse.json(result);
  } catch (err) {
    console.error("[render-status] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get status" },
      { status: 500 }
    );
  }
}
