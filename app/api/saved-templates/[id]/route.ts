export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { savedTemplatesTable } from "@/db/schema/saved-templates-schema";
import { eq, and } from "drizzle-orm";

/**
 * GET: Fetch a single template by id (including content). Only allowed for the owner.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing template id" }, { status: 400 });
    }

    const [row] = await db
      .select()
      .from(savedTemplatesTable)
      .where(
        and(
          eq(savedTemplatesTable.id, id),
          eq(savedTemplatesTable.userId, userId)
      ));

    if (!row) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: row.id,
      title: row.title,
      content: row.content,
      formatType: row.formatType,
      tags: row.tags ?? undefined,
      createdAt: row.createdAt?.toISOString(),
    });
  } catch (e) {
    console.error("[saved-templates] GET [id] error:", e);
    return NextResponse.json(
      { error: "Failed to load template" },
      { status: 500 }
    );
  }
}
