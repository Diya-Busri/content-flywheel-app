import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { coachChatsTable } from "@/db/schema/coach-settings-schema";
import { eq, desc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: List current user's coach chats (pinned first, then by created_at desc). */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await db
      .select({
        id: coachChatsTable.id,
        title: coachChatsTable.title,
        isPinned: coachChatsTable.isPinned,
        createdAt: coachChatsTable.createdAt,
      })
      .from(coachChatsTable)
      .where(eq(coachChatsTable.userId, userId))
      .orderBy(desc(coachChatsTable.isPinned), desc(coachChatsTable.createdAt));

    const chats = rows.map((r) => ({
      id: r.id,
      title: r.title,
      isPinned: r.isPinned ?? false,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }));

    return NextResponse.json(chats);
  } catch (err) {
    console.error("[chat/coach/chats] GET", err);
    return NextResponse.json({ error: "Failed to load chats" }, { status: 500 });
  }
}

/** POST: Create a new coach chat. Body: { title?: string }. Returns { id, title, createdAt, isPinned }. */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const title =
      typeof (body as { title?: string }).title === "string"
        ? (body as { title: string }).title.trim() || "New Chat"
        : "New Chat";

    const [row] = await db
      .insert(coachChatsTable)
      .values({ userId, title, isPinned: false })
      .returning();

    if (!row) return NextResponse.json({ error: "Failed to create chat" }, { status: 500 });

    return NextResponse.json({
      id: row.id,
      title: row.title,
      isPinned: row.isPinned ?? false,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    });
  } catch (err) {
    console.error("[chat/coach/chats] POST", err);
    return NextResponse.json({ error: "Failed to create chat" }, { status: 500 });
  }
}
