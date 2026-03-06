import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { scheduledPostsTable } from "@/db/schema/scheduled-posts-schema";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET: List scheduled posts for the current user (for Scheduled tab).
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db
      .select()
      .from(scheduledPostsTable)
      .where(eq(scheduledPostsTable.userId, userId))
      .orderBy(asc(scheduledPostsTable.scheduledTime));

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        contentType: r.contentType,
        contentJson: r.contentJson,
        platform: r.platform,
        scheduledTime: r.scheduledTime?.toISOString(),
        postedStatus: r.postedStatus,
        createdAt: r.createdAt?.toISOString(),
      }))
    );
  } catch (e) {
    console.error("[scheduled-posts] GET error:", e);
    return NextResponse.json(
      { error: "Failed to load scheduled posts" },
      { status: 500 }
    );
  }
}

/**
 * POST: Create a scheduled post.
 * Body: { contentType, contentJson, platform, scheduledTime (ISO string) }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "JSON body required" }, { status: 400 });
    }

    const contentType = typeof body.contentType === "string" ? body.contentType.trim() : "video";
    const contentJson = body.contentJson && typeof body.contentJson === "object" ? body.contentJson : {};
    const platform = ["tiktok", "instagram", "both"].includes(String(body.platform).toLowerCase())
      ? String(body.platform).toLowerCase()
      : "both";
    const scheduledTimeRaw = body.scheduledTime;
    if (typeof scheduledTimeRaw !== "string" || !scheduledTimeRaw) {
      return NextResponse.json({ error: "scheduledTime (ISO string) required" }, { status: 400 });
    }
    const scheduledTime = new Date(scheduledTimeRaw);
    if (Number.isNaN(scheduledTime.getTime())) {
      return NextResponse.json({ error: "Invalid scheduledTime" }, { status: 400 });
    }

    const [row] = await db
      .insert(scheduledPostsTable)
      .values({
        userId,
        contentType,
        contentJson,
        platform,
        scheduledTime,
        postedStatus: false,
      })
      .returning();

    if (!row) {
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }

    return NextResponse.json({
      id: row.id,
      contentType: row.contentType,
      platform: row.platform,
      scheduledTime: row.scheduledTime?.toISOString(),
      postedStatus: row.postedStatus,
      createdAt: row.createdAt?.toISOString(),
    });
  } catch (e) {
    console.error("[scheduled-posts] POST error:", e);
    return NextResponse.json(
      { error: "Failed to create scheduled post" },
      { status: 500 }
    );
  }
}
