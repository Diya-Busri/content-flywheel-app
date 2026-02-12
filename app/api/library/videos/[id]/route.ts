import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { videosTable } from "@/db/schema/library-schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Video ID required" }, { status: 400 });
    }
    const permanent = new URL(request.url).searchParams.get("permanent") === "true";
    if (permanent) {
      await db
        .delete(videosTable)
        .where(and(eq(videosTable.id, id), eq(videosTable.userId, userId)));
    } else {
      const [updated] = await db
        .update(videosTable)
        .set({ deletedAt: new Date() })
        .where(and(eq(videosTable.id, id), eq(videosTable.userId, userId)))
        .returning();
      if (!updated) {
        return NextResponse.json({ error: "Video not found" }, { status: 404 });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Library video delete failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete video" },
      { status: 500 }
    );
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Video ID required" }, { status: 400 });
    }
    const [updated] = await db
      .update(videosTable)
      .set({ deletedAt: null })
      .where(and(eq(videosTable.id, id), eq(videosTable.userId, userId)))
      .returning();
    if (!updated) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error("Library video restore failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to restore video" },
      { status: 500 }
    );
  }
}
