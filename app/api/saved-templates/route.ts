export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { savedTemplatesTable } from "@/db/schema/saved-templates-schema";
import { eq, desc } from "drizzle-orm";

/**
 * GET: List all saved templates for the current user (id, title, format_type, tags, created_at; no content).
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db
      .select({
        id: savedTemplatesTable.id,
        title: savedTemplatesTable.title,
        formatType: savedTemplatesTable.formatType,
        tags: savedTemplatesTable.tags,
        createdAt: savedTemplatesTable.createdAt,
      })
      .from(savedTemplatesTable)
      .where(eq(savedTemplatesTable.userId, userId))
      .orderBy(desc(savedTemplatesTable.createdAt));

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        formatType: r.formatType,
        tags: r.tags ?? undefined,
        createdAt: r.createdAt?.toISOString(),
      }))
    );
  } catch (e) {
    console.error("[saved-templates] GET error:", e);
    return NextResponse.json(
      { error: "Failed to load templates" },
      { status: 500 }
    );
  }
}

/**
 * POST: Create a saved template. Body: title, content, formatType, tags (optional).
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const title = (body.title as string)?.trim();
    const content = typeof body.content === "string" ? body.content : "";
    const formatType = (body.formatType as string)?.trim() || "other";
    const tags = (body.tags as string)?.trim() || null;

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const [row] = await db
      .insert(savedTemplatesTable)
      .values({
        userId,
        title,
        content,
        formatType,
        tags,
      })
      .returning();

    return NextResponse.json({
      id: row.id,
      title: row.title,
      formatType: row.formatType,
      tags: row.tags ?? undefined,
      createdAt: row.createdAt?.toISOString(),
    });
  } catch (e) {
    console.error("[saved-templates] POST error:", e);
    return NextResponse.json(
      { error: "Failed to save template" },
      { status: 500 }
    );
  }
}
