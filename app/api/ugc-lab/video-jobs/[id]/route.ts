export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { videoJobsTable } from "@/db/schema/video-jobs-schema";
import { eq, and } from "drizzle-orm";

/** GET: Poll single job status. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const [job] = await db
      .select()
      .from(videoJobsTable)
      .where(
        and(eq(videoJobsTable.id, id), eq(videoJobsTable.userId, userId))
      )
      .limit(1);

    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    return NextResponse.json({
      id: job.id,
      status: job.status,
      progress: job.progress ?? "0",
      hookPreview: job.hookPreview,
      videoUrl: job.videoUrl,
      error: job.error,
    });
  } catch (err) {
    console.error("[video-jobs/:id] GET Error:", err);
    return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 });
  }
}
