import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { savedScriptsTable } from "@/db/schema/library-schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** GET: Fetch one saved script by id (for Video Timeline). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const [row] = await db
      .select()
      .from(savedScriptsTable)
      .where(and(eq(savedScriptsTable.id, id), eq(savedScriptsTable.userId, userId)))
      .limit(1);

    if (!row) return NextResponse.json({ error: "Script not found" }, { status: 404 });

    return NextResponse.json({
      id: row.id,
      title: row.title,
      scenes_json: row.scenesJson ?? [],
      voiceover_url: row.voiceoverUrl ?? null,
      created_at: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    });
  } catch (err) {
    console.error("[saved-scripts/[id]] GET", err);
    return NextResponse.json({ error: "Failed to load script" }, { status: 500 });
  }
}

/** PATCH: Update voiceover_url (e.g. after uploading from Coach). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const voiceoverUrl = typeof (body as { voiceover_url?: string }).voiceover_url === "string"
      ? (body as { voiceover_url: string }).voiceover_url.trim() || null
      : null;

    const [row] = await db
      .update(savedScriptsTable)
      .set({ voiceoverUrl })
      .where(and(eq(savedScriptsTable.id, id), eq(savedScriptsTable.userId, userId)))
      .returning();

    if (!row) return NextResponse.json({ error: "Script not found" }, { status: 404 });

    return NextResponse.json({
      id: row.id,
      voiceover_url: row.voiceoverUrl ?? null,
    });
  } catch (err) {
    console.error("[saved-scripts/[id]] PATCH", err);
    return NextResponse.json({ error: "Failed to update script" }, { status: 500 });
  }
}
