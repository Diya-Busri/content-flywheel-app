import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { seoHashtagGroupsTable } from "@/db/schema/seo-hashtag-groups-schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * DELETE: Remove a saved hashtag group. User can only delete their own.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const deleted = await db
      .delete(seoHashtagGroupsTable)
      .where(and(eq(seoHashtagGroupsTable.id, id), eq(seoHashtagGroupsTable.userId, userId)))
      .returning({ id: seoHashtagGroupsTable.id });

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("seo saved-groups DELETE:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
