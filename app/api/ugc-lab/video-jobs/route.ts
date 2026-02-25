import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { videoJobsTable } from "@/db/schema/video-jobs-schema";
import { eq, desc, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** GET: List video jobs for the current user. Optional ?batchId= filter. */
export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get("batchId");

    if (batchId) {
      const rows = await db
        .select()
        .from(videoJobsTable)
        .where(
          and(
            eq(videoJobsTable.userId, userId),
            eq(videoJobsTable.batchId, batchId)
          )
        )
        .orderBy(desc(videoJobsTable.createdAt));
      return NextResponse.json({ jobs: rows });
    }

    const jobs = await db
      .select()
      .from(videoJobsTable)
      .where(eq(videoJobsTable.userId, userId))
      .orderBy(desc(videoJobsTable.createdAt))
      .limit(50);

    return NextResponse.json({ jobs });
  } catch (err) {
    console.error("[video-jobs] GET Error:", err);
    return NextResponse.json({ error: "Failed to list jobs" }, { status: 500 });
  }
}
