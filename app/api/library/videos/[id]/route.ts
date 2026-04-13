import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { videosTable } from "@/db/schema/library-schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Video ID required" }, { status: 400 });
    const [row] = await db
      .select()
      .from(videosTable)
      .where(and(eq(videosTable.id, id), eq(videosTable.userId, userId)))
      .limit(1);
    if (!row) return NextResponse.json({ error: "Video not found" }, { status: 404 });
    return NextResponse.json({
      id: row.id,
      title: row.title,
      thumbnailUrl: row.thumbnailUrl,
      status: row.status,
      scriptId: row.scriptId,
      metadata: row.metadata,
      platforms: row.platforms,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  } catch (err) {
    console.error("Library video GET failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load video" },
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Video ID required" }, { status: 400 });

    const body = await request.json().catch(() => ({})) as {
      title?: string;
      thumbnailUrl?: string;
      metadata?: Record<string, unknown>;
    };

    // Merge metadata so callers can patch individual keys without wiping others
    const existing = await db
      .select({ metadata: videosTable.metadata, thumbnailUrl: videosTable.thumbnailUrl })
      .from(videosTable)
      .where(and(eq(videosTable.id, id), eq(videosTable.userId, userId)))
      .limit(1);

    if (!existing[0]) return NextResponse.json({ error: "Video not found" }, { status: 404 });

    const mergedMeta = {
      ...(existing[0].metadata ?? {}),
      ...(body.metadata ?? {}),
    };

    const [updated] = await db
      .update(videosTable)
      .set({
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.thumbnailUrl !== undefined ? { thumbnailUrl: body.thumbnailUrl } : {}),
        metadata: mergedMeta,
        updatedAt: new Date(),
      })
      .where(and(eq(videosTable.id, id), eq(videosTable.userId, userId)))
      .returning();

    return NextResponse.json({ ok: true, id: updated.id });
  } catch (err) {
    console.error("Library video PATCH failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update video" },
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
