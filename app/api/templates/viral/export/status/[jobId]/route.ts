import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { renderJobsTable } from "@/db/schema/library-schema";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [job] = await db
    .select({ status: renderJobsTable.status, videoUrl: renderJobsTable.videoUrl, error: renderJobsTable.error })
    .from(renderJobsTable)
    .where(and(eq(renderJobsTable.id, params.jobId), eq(renderJobsTable.userId, userId)))
    .limit(1);

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json({ status: job.status, videoUrl: job.videoUrl, error: job.error });
}
