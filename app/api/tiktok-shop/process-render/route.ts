import { NextResponse } from "next/server";
import { db } from "@/db/db";
import { renderJobsTable } from "@/db/schema/library-schema";
import { eq } from "drizzle-orm";

const MESSAGE = "Video rendering has been removed. Use Step 4: Video Creation Guides instead.";

/** Deprecated: Use Video Creation Guide flow. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const jobId = body.jobId as string | undefined;

  if (jobId) {
    await db
      .update(renderJobsTable)
      .set({ status: "failed", error: MESSAGE, updatedAt: new Date() })
      .where(eq(renderJobsTable.id, jobId));
  }

  return NextResponse.json(
    { error: MESSAGE },
    { status: 410 }
  );
}
