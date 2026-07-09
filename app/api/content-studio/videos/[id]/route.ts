import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { contentStudioVideosTable } from "@/db/schema/content-studio-videos-schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * DELETE: Remove a Content Studio video. User must own it.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Video ID required" }, { status: 400 });

    const deleted = await db
      .delete(contentStudioVideosTable)
      .where(
        and(
          eq(contentStudioVideosTable.id, id),
          eq(contentStudioVideosTable.userId, userId)
        )
      )
      .returning({ id: contentStudioVideosTable.id });

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Video not found or access denied" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[content-studio/videos/[id] DELETE]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete" },
      { status: 500 }
    );
  }
}
