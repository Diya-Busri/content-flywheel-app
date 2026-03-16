import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { myLibraryTable } from "@/db/schema/library-schema";

export const dynamic = "force-dynamic";

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
