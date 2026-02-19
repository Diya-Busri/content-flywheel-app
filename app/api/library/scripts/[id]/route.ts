import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { scriptsTable } from "@/db/schema/library-schema";
import { eq, and, isNull } from "drizzle-orm";

/** GET: Fetch a single script by id (e.g. to view a saved video guide). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Script ID required" }, { status: 400 });

    const [row] = await db
      .select()
      .from(scriptsTable)
      .where(and(eq(scriptsTable.id, id), eq(scriptsTable.userId, userId), isNull(scriptsTable.deletedAt)))
      .limit(1);

    if (!row) return NextResponse.json({ error: "Script not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (err) {
    console.error("Library script get failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch script" },
      { status: 500 }
    );
  }
}

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
      return NextResponse.json({ error: "Script ID required" }, { status: 400 });
    }
    const permanent = new URL(request.url).searchParams.get("permanent") === "true";
    if (permanent) {
      await db
        .delete(scriptsTable)
        .where(and(eq(scriptsTable.id, id), eq(scriptsTable.userId, userId)));
    } else {
      const [updated] = await db
        .update(scriptsTable)
        .set({ deletedAt: new Date() })
        .where(and(eq(scriptsTable.id, id), eq(scriptsTable.userId, userId)))
        .returning();
      if (!updated) {
        return NextResponse.json({ error: "Script not found" }, { status: 404 });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Library script delete failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete script" },
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
      return NextResponse.json({ error: "Script ID required" }, { status: 400 });
    }
    const [updated] = await db
      .update(scriptsTable)
      .set({ deletedAt: null })
      .where(and(eq(scriptsTable.id, id), eq(scriptsTable.userId, userId)))
      .returning();
    if (!updated) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error("Library script restore failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to restore script" },
      { status: 500 }
    );
  }
}
