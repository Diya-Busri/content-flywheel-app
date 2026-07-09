export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET  /api/user-memory?category=&memoryType=&limit=&offset=
 *   List the user's memories with optional filters.
 *
 * PUT  /api/user-memory  { id, memoryType }
 *   Update memory_type (pin / favourite / archive / restore to automatic).
 *
 * DELETE /api/user-memory?id=
 *   Hard-delete a memory entry.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { userMemoryTable } from "@/db/schema/user-memory-schema";
import { eq, and, desc } from "drizzle-orm";
import { enrichUserMemoryEntry } from "@/lib/user-memory";

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const category   = searchParams.get("category") ?? undefined;
  const memoryType = searchParams.get("memoryType") ?? undefined;
  const limit      = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const offset     = parseInt(searchParams.get("offset") ?? "0", 10);

  try {
    const conditions = [eq(userMemoryTable.userId, userId)];
    if (category)   conditions.push(eq(userMemoryTable.category, category));
    if (memoryType) conditions.push(eq(userMemoryTable.memoryType, memoryType));

    const rows = await db
      .select()
      .from(userMemoryTable)
      .where(and(...conditions))
      .orderBy(desc(userMemoryTable.updatedAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[user-memory GET]", err);
    return NextResponse.json({ error: "Failed to fetch memories" }, { status: 500 });
  }
}

// ─── PUT ─────────────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json() as {
      id?: string;
      memoryType?: string;
      title?: string;
      content?: string;
    };
    const { id, memoryType, title, content } = body;

    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const validTypes = ["automatic", "pinned", "favourite", "archived"];
    const updates: Partial<typeof userMemoryTable.$inferInsert> & { updatedAt: Date } = { updatedAt: new Date() };

    if (memoryType && validTypes.includes(memoryType)) updates.memoryType = memoryType;
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;

    const [entry] = await db
      .update(userMemoryTable)
      .set(updates)
      .where(and(eq(userMemoryTable.id, id), eq(userMemoryTable.userId, userId)))
      .returning();

    if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Re-embed if text changed
    if (title !== undefined || content !== undefined) {
      const newTitle   = title ?? entry.title;
      const newContent = content ?? entry.content;
      void enrichUserMemoryEntry(entry.id, newTitle, newContent).catch(() => {});
    }

    return NextResponse.json(entry);
  } catch (err) {
    console.error("[user-memory PUT]", err);
    return NextResponse.json({ error: "Failed to update memory" }, { status: 500 });
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    await db
      .delete(userMemoryTable)
      .where(and(eq(userMemoryTable.id, id), eq(userMemoryTable.userId, userId)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[user-memory DELETE]", err);
    return NextResponse.json({ error: "Failed to delete memory" }, { status: 500 });
  }
}
