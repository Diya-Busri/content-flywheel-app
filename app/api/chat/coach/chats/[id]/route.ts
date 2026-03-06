import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { coachChatsTable } from "@/db/schema/coach-settings-schema";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH: Update title and/or is_pinned. Body: { title?: string, is_pinned?: boolean }. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const title = typeof (body as { title?: string }).title === "string" ? (body as { title: string }).title.trim() : undefined;
    const isPinned = typeof (body as { is_pinned?: boolean }).is_pinned === "boolean" ? (body as { is_pinned: boolean }).is_pinned : undefined;

    if (title === undefined && isPinned === undefined) {
      return NextResponse.json({ error: "Provide title and/or is_pinned" }, { status: 400 });
    }

    const updates: { title?: string; isPinned?: boolean } = {};
    if (title !== undefined) updates.title = title;
    if (isPinned !== undefined) updates.isPinned = isPinned;

    const [row] = await db
      .update(coachChatsTable)
      .set(updates)
      .where(and(eq(coachChatsTable.id, id), eq(coachChatsTable.userId, userId)))
      .returning();

    if (!row) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

    return NextResponse.json({
      id: row.id,
      title: row.title,
      isPinned: row.isPinned ?? false,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    });
  } catch (err) {
    console.error("[chat/coach/chats/[id]] PATCH", err);
    return NextResponse.json({ error: "Failed to update chat" }, { status: 500 });
  }
}

/** DELETE: Remove chat. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const [row] = await db
      .delete(coachChatsTable)
      .where(and(eq(coachChatsTable.id, id), eq(coachChatsTable.userId, userId)))
      .returning();

    if (!row) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[chat/coach/chats/[id]] DELETE", err);
    return NextResponse.json({ error: "Failed to delete chat" }, { status: 500 });
  }
}
