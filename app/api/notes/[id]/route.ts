/**
 * GET    /api/notes/[id]   — fetch single note
 * PATCH  /api/notes/[id]   — update note (title, content, body, folder, tags, isPinned, isArchived)
 * DELETE /api/notes/[id]   — soft-delete note (sets deletedAt)
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { notesTable } from "@/db/schema/notes-schema";
import { eq, and } from "drizzle-orm";

/* ─── GET ─────────────────────────────────────────────────────────────────── */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [row] = await db
    .select()
    .from(notesTable)
    .where(and(eq(notesTable.id, id), eq(notesTable.userId, userId)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ note: row });
}

/* ─── PATCH ───────────────────────────────────────────────────────────────── */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as {
    title?:      string;
    content?:    Record<string, unknown>;
    body?:       string;
    folder?:     string | null;
    tags?:       string[];
    isPinned?:   boolean;
    isArchived?: boolean;
    aiSummary?:  string | null;
  };

  const patch: Partial<typeof notesTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (body.title      !== undefined) patch.title      = body.title;
  if (body.content    !== undefined) patch.content    = body.content;
  if (body.folder     !== undefined) patch.folder     = body.folder ?? null;
  if (body.tags       !== undefined) patch.tags       = body.tags;
  if (body.isPinned   !== undefined) patch.isPinned   = body.isPinned;
  if (body.isArchived !== undefined) patch.isArchived = body.isArchived;
  if (body.aiSummary  !== undefined) patch.aiSummary  = body.aiSummary ?? null;

  if (body.body !== undefined) {
    patch.body      = body.body;
    patch.wordCount = body.body.trim().split(/\s+/).filter(Boolean).length;
  }

  const [row] = await db
    .update(notesTable)
    .set(patch)
    .where(and(eq(notesTable.id, id), eq(notesTable.userId, userId)))
    .returning();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ note: row });
}

/* ─── DELETE (soft) ───────────────────────────────────────────────────────── */

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db
    .update(notesTable)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(notesTable.id, id), eq(notesTable.userId, userId)));

  return NextResponse.json({ ok: true });
}
