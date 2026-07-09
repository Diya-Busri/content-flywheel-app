import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { savedScriptsTable } from "@/db/schema/library-schema";
import type { SavedScriptScene } from "@/db/schema/library-schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** GET: List saved scripts for the current user. */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await db
      .select({ id: savedScriptsTable.id, title: savedScriptsTable.title, createdAt: savedScriptsTable.createdAt })
      .from(savedScriptsTable)
      .where(eq(savedScriptsTable.userId, userId))
      .orderBy(desc(savedScriptsTable.createdAt));

    const list = rows.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }));

    return NextResponse.json(list);
  } catch (err) {
    console.error("[saved-scripts] GET", err);
    return NextResponse.json({ error: "Failed to load scripts" }, { status: 500 });
  }
}

/** POST: Create a saved script (from AI Coach "Build in Timeline"). */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const title = typeof (body as { title?: string }).title === "string" ? (body as { title: string }).title.trim() || "YouTube Script" : "YouTube Script";
    const scenesJson = Array.isArray((body as { scenes_json?: SavedScriptScene[] }).scenes_json)
      ? (body as { scenes_json: SavedScriptScene[] }).scenes_json
      : [];
    const voiceoverUrl = typeof (body as { voiceover_url?: string }).voiceover_url === "string" ? (body as { voiceover_url: string }).voiceover_url.trim() || null : null;

    const [row] = await db
      .insert(savedScriptsTable)
      .values({
        userId,
        title,
        scenesJson,
        voiceoverUrl: voiceoverUrl ?? null,
      })
      .returning();

    if (!row) return NextResponse.json({ error: "Failed to save script" }, { status: 500 });

    return NextResponse.json({
      id: row.id,
      title: row.title,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    });
  } catch (err) {
    console.error("[saved-scripts] POST", err);
    return NextResponse.json({ error: "Failed to save script" }, { status: 500 });
  }
}
