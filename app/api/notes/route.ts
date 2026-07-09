/**
 * GET  /api/notes          — list user's notes (non-deleted, non-archived)
 * POST /api/notes          — create a new note
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { notesTable } from "@/db/schema/notes-schema";
import { eq, and, isNull, desc } from "drizzle-orm";

/* ─── GET — list ──────────────────────────────────────────────────────────── */

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(notesTable)
    .where(and(eq(notesTable.userId, userId), isNull(notesTable.deletedAt)))
    .orderBy(desc(notesTable.updatedAt));

  return NextResponse.json({ notes: rows });
}

/* ─── POST — create ───────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    title?:     string;
    content?:   Record<string, unknown>;
    body?:      string;
    folder?:    string;
    tags?:      string[];
    isPinned?:  boolean;
  };

  const wordCount = typeof body.body === "string"
    ? body.body.trim().split(/\s+/).filter(Boolean).length
    : 0;

  const [row] = await db
    .insert(notesTable)
    .values({
      userId,
      title:     body.title     ?? "Untitled",
      content:   body.content   ?? null,
      body:      body.body      ?? "",
      folder:    body.folder    ?? null,
      tags:      body.tags      ?? [],
      isPinned:  body.isPinned  ?? false,
      wordCount,
    })
    .returning();

  return NextResponse.json({ note: row });
}
