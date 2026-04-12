import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { designHistoryTable } from "@/db/schema/design-history-schema";
import { eq, and, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** GET /api/design-history — last 20 designs for the authenticated user */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await db
      .select()
      .from(designHistoryTable)
      .where(eq(designHistoryTable.userId, userId))
      .orderBy(desc(designHistoryTable.createdAt))
      .limit(20);

    return NextResponse.json({ designs: rows });
  } catch (e) {
    console.error("[design-history] GET error:", e);
    return NextResponse.json({ error: "Failed to load designs" }, { status: 500 });
  }
}

/** POST /api/design-history — save a design. Body: { name, imageUrl, sourceType } */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({})) as {
      name?: string;
      imageUrl?: string;
      sourceType?: string;
    };

    if (!body.imageUrl) return NextResponse.json({ error: "imageUrl required" }, { status: 400 });

    const [row] = await db
      .insert(designHistoryTable)
      .values({
        userId,
        name: (body.name ?? "Untitled Design").trim(),
        imageUrl: body.imageUrl,
        sourceType: ["studio", "upload", "ai"].includes(body.sourceType ?? "") ? body.sourceType! : "studio",
      })
      .returning();

    return NextResponse.json(row);
  } catch (e) {
    console.error("[design-history] POST error:", e);
    return NextResponse.json({ error: "Failed to save design" }, { status: 500 });
  }
}

/** DELETE /api/design-history?id=X — delete a design owned by the user */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await db
      .delete(designHistoryTable)
      .where(and(eq(designHistoryTable.id, id), eq(designHistoryTable.userId, userId)));

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[design-history] DELETE error:", e);
    return NextResponse.json({ error: "Failed to delete design" }, { status: 500 });
  }
}
