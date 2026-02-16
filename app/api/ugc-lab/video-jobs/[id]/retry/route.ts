import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { videoJobsTable } from "@/db/schema/video-jobs-schema";
import { eq, and } from "drizzle-orm";

/**
 * POST: Retry a failed job.
 * Resets status to pending and triggers process-job.
 */
export async function POST(
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
    if (job.status !== "failed") {
      return NextResponse.json({ error: "Only failed jobs can be retried" }, { status: 400 });
    }

    await db
      .update(videoJobsTable)
      .set({ status: "pending", progress: "0", error: null, updatedAt: new Date() })
      .where(eq(videoJobsTable.id, id));

    const base =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000";

    fetch(`${base}/api/ugc-lab/process-job`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: id, userId }),
    }).catch((e) => console.error("[retry] process-job trigger failed:", e));

    return NextResponse.json({ ok: true, jobId: id });
  } catch (err) {
    console.error("[video-jobs/:id/retry] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Retry failed" },
      { status: 500 }
    );
  }
}
