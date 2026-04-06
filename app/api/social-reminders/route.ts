import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { scheduledPostsTable } from "@/db/schema/scheduled-posts-schema";
import { eq, and, gte, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Social posting reminders built on the existing scheduledPostsTable.
 * Content type: "social-caption"
 */

/**
 * GET /api/social-reminders
 * Returns upcoming (not yet posted) social caption reminders.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const now = new Date();
    const posts = await db.select()
      .from(scheduledPostsTable)
      .where(
        and(
          eq(scheduledPostsTable.userId, userId),
          eq(scheduledPostsTable.contentType, "social-caption"),
        )
      )
      .orderBy(desc(scheduledPostsTable.scheduledTime))
      .limit(50);

    return NextResponse.json({ reminders: posts });
  } catch (err) {
    console.error("[social-reminders/GET]", err);
    return NextResponse.json({ error: "Failed to fetch reminders" }, { status: 500 });
  }
}

/**
 * POST /api/social-reminders
 * Body: { platform, caption, productId?, productTitle?, scheduledTime (ISO string) }
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const platform = typeof body.platform === "string" ? body.platform : "instagram";
    const caption = typeof body.caption === "string" ? body.caption.trim() : "";
    const scheduledTime = body.scheduledTime ? new Date(body.scheduledTime) : null;

    if (!caption) return NextResponse.json({ error: "caption is required" }, { status: 400 });
    if (!scheduledTime || isNaN(scheduledTime.getTime())) {
      return NextResponse.json({ error: "valid scheduledTime is required" }, { status: 400 });
    }
    if (scheduledTime <= new Date()) {
      return NextResponse.json({ error: "scheduledTime must be in the future" }, { status: 400 });
    }

    const [post] = await db.insert(scheduledPostsTable).values({
      userId,
      contentType: "social-caption",
      contentJson: {
        caption,
        productId: body.productId ?? null,
        productTitle: body.productTitle ?? null,
        platform,
      },
      platform,
      scheduledTime,
      postedStatus: false,
    }).returning();

    return NextResponse.json({ reminder: post });
  } catch (err) {
    console.error("[social-reminders/POST]", err);
    return NextResponse.json({ error: "Failed to schedule reminder" }, { status: 500 });
  }
}

/**
 * PATCH /api/social-reminders  — mark as posted
 * Body: { id }
 */
export async function PATCH(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await db.update(scheduledPostsTable)
      .set({ postedStatus: true })
      .where(and(eq(scheduledPostsTable.id, id), eq(scheduledPostsTable.userId, userId)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[social-reminders/PATCH]", err);
    return NextResponse.json({ error: "Failed to update reminder" }, { status: 500 });
  }
}

/**
 * DELETE /api/social-reminders
 * Body: { id }
 */
export async function DELETE(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await db.delete(scheduledPostsTable)
      .where(and(eq(scheduledPostsTable.id, id), eq(scheduledPostsTable.userId, userId)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[social-reminders/DELETE]", err);
    return NextResponse.json({ error: "Failed to delete reminder" }, { status: 500 });
  }
}
