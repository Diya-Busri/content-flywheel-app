export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { founderWorkspaceEntriesTable } from "@/db/schema/founder-workspace-schema";
import { eq, and } from "drizzle-orm";

async function assertAdmin(): Promise<{ userId: string } | NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  if (!adminEmail) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const user = await currentUser();
  const userEmail = user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase() ?? "";
  if (userEmail !== adminEmail) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return { userId };
}

// GET /api/founder-workspace?category=research
export async function GET(request: NextRequest) {
  const result = await assertAdmin();
  if (result instanceof NextResponse) return result;
  const { userId } = result;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  try {
    const rows = await db
      .select()
      .from(founderWorkspaceEntriesTable)
      .where(
        category
          ? and(
              eq(founderWorkspaceEntriesTable.userId, userId),
              eq(founderWorkspaceEntriesTable.category, category)
            )
          : eq(founderWorkspaceEntriesTable.userId, userId)
      )
      .orderBy(founderWorkspaceEntriesTable.createdAt);

    return NextResponse.json(rows);
  } catch (err) {
    console.error("founder-workspace GET error:", err);
    return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
  }
}

// POST /api/founder-workspace  { category, type, title, content?, metadata? }
export async function POST(request: NextRequest) {
  const result = await assertAdmin();
  if (result instanceof NextResponse) return result;
  const { userId } = result;

  try {
    const body = await request.json();
    const { category, type, title, content = "", metadata } = body as {
      category: string;
      type: string;
      title: string;
      content?: string;
      metadata?: Record<string, unknown>;
    };

    if (!category || !type || !title) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [entry] = await db
      .insert(founderWorkspaceEntriesTable)
      .values({ userId, category, type, title, content, metadata: metadata ?? null })
      .returning();

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    console.error("founder-workspace POST error:", err);
    return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
  }
}

// PUT /api/founder-workspace  { id, title?, content?, metadata? }
export async function PUT(request: NextRequest) {
  const result = await assertAdmin();
  if (result instanceof NextResponse) return result;
  const { userId } = result;

  try {
    const body = await request.json();
    const { id, title, content, metadata } = body as {
      id: string;
      title?: string;
      content?: string;
      metadata?: Record<string, unknown>;
    };

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const updates: Partial<typeof founderWorkspaceEntriesTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (metadata !== undefined) updates.metadata = metadata;

    const [entry] = await db
      .update(founderWorkspaceEntriesTable)
      .set(updates)
      .where(
        and(
          eq(founderWorkspaceEntriesTable.id, id),
          eq(founderWorkspaceEntriesTable.userId, userId)
        )
      )
      .returning();

    if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(entry);
  } catch (err) {
    console.error("founder-workspace PUT error:", err);
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}

// DELETE /api/founder-workspace?id=uuid
export async function DELETE(request: NextRequest) {
  const result = await assertAdmin();
  if (result instanceof NextResponse) return result;
  const { userId } = result;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    await db
      .delete(founderWorkspaceEntriesTable)
      .where(
        and(
          eq(founderWorkspaceEntriesTable.id, id),
          eq(founderWorkspaceEntriesTable.userId, userId)
        )
      );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("founder-workspace DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}
