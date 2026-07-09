import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { myLibraryTable } from "@/db/schema/library-schema";
import { eq, desc, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** GET: Fetch my_library items for the current user. ?type=generated_image|voice_over|all */
export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const typeFilter = searchParams.get("type") ?? "all";
    const rows = await db
      .select()
      .from(myLibraryTable)
      .where(eq(myLibraryTable.userId, userId))
      .orderBy(desc(myLibraryTable.createdAt));
    const filtered = typeFilter === "all" ? rows : rows.filter((r) => r.type === typeFilter);
    return NextResponse.json(filtered);
  } catch (err) {
    console.error("[library/items] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

/**
 * POST: Save an item to my_library (e.g. generated_image, voice_over from AI Coach).
 * Body: { type: 'generated_image' | 'voice_over', title: string, url?: string }
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const type = typeof body.type === "string" ? body.type.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const url = typeof body.url === "string" ? body.url.trim() : "";

    if ((type !== "generated_image" && type !== "voice_over") || !title) {
      return NextResponse.json(
        { error: "type must be 'generated_image' or 'voice_over' and title is required" },
        { status: 400 }
      );
    }

    const [row] = await db
      .insert(myLibraryTable)
      .values({
        userId,
        type,
        title,
        url: url || null,
      })
      .returning({ id: myLibraryTable.id, createdAt: myLibraryTable.createdAt });

    if (!row) return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    return NextResponse.json({ id: row.id, createdAt: row.createdAt });
  } catch (err) {
    console.error("[library/items] POST error:", err);
    return NextResponse.json({ error: "Failed to save to library" }, { status: 500 });
  }
}

/** DELETE: Remove one item (?id=) or all items of a type (?type=generated_image). */
export async function DELETE(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type");
    if (id) {
      await db.delete(myLibraryTable).where(and(eq(myLibraryTable.id, id), eq(myLibraryTable.userId, userId)));
      return NextResponse.json({ ok: true });
    }
    if (type) {
      await db.delete(myLibraryTable).where(and(eq(myLibraryTable.type, type), eq(myLibraryTable.userId, userId)));
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "id or type required" }, { status: 400 });
  } catch (err) {
    console.error("[library/items] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
