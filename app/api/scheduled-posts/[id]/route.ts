import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { scheduledPostsTable } from "@/db/schema/scheduled-posts-schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * PATCH: Update a scheduled post (e.g. mark as posted).
 * Body: { postedStatus?: boolean }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Post id required" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "JSON body required" }, { status: 400 });
    }

    const postedStatus = typeof body.postedStatus === "boolean" ? body.postedStatus : undefined;
    if (postedStatus === undefined) {
      return NextResponse.json({ error: "postedStatus (boolean) required" }, { status: 400 });
    }

    const [row] = await db
      .update(scheduledPostsTable)
      .set({ postedStatus })
      .where(and(eq(scheduledPostsTable.id, id), eq(scheduledPostsTable.userId, userId)))
      .returning();

    if (!row) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: row.id,
      postedStatus: row.postedStatus,
    });
  } catch (e) {
    console.error("[scheduled-posts PATCH] error:", e);
    return NextResponse.json(
      { error: "Failed to update scheduled post" },
      { status: 500 }
    );
  }
}
