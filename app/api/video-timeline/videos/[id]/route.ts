import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { videosTable } from "@/db/schema/library-schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET: Fetch a single video by id (for loading timeline project).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Video id required" }, { status: 400 });

    const [row] = await db
      .select()
      .from(videosTable)
      .where(and(eq(videosTable.id, id), eq(videosTable.userId, userId)))
      .limit(1);

    if (!row) return NextResponse.json({ error: "Video not found" }, { status: 404 });

    return NextResponse.json({
      id: row.id,
      title: row.title,
      status: row.status,
      scriptId: row.scriptId,
      metadata: row.metadata,
      platforms: row.platforms,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  } catch (err) {
    console.error("[video-timeline/videos GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load video" },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Update a video (e.g. set status to 'completed' and exportedAt after export).
 * Body: { status?: string, metadata?: Record<string, unknown> }.
 * Merges metadata.exportedAt when provided.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Video id required" }, { status: 400 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "JSON body required" }, { status: 400 });
    }

    const status = typeof body.status === "string" ? body.status : undefined;
    const metadataUpdate = body.metadata && typeof body.metadata === "object" ? body.metadata : undefined;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (metadataUpdate) {
      const [current] = await db
        .select({ metadata: videosTable.metadata })
        .from(videosTable)
        .where(and(eq(videosTable.id, id), eq(videosTable.userId, userId)))
        .limit(1);
      const merged =
        current?.metadata && typeof current.metadata === "object"
          ? { ...current.metadata, ...metadataUpdate }
          : metadataUpdate;
      updates.metadata = merged;
    }

    const [row] = await db
      .update(videosTable)
      .set(updates as Record<string, unknown>)
      .where(and(eq(videosTable.id, id), eq(videosTable.userId, userId)))
      .returning({ id: videosTable.id, status: videosTable.status });

    if (!row) return NextResponse.json({ error: "Video not found" }, { status: 404 });

    return NextResponse.json({ id: row.id, status: row.status });
  } catch (err) {
    console.error("[video-timeline/videos PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}
