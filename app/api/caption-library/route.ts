import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { captionLibraryTable } from "@/db/schema/caption-library-schema";
import { eq, and, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** GET /api/caption-library — returns user's captions. Optional ?platform=tiktok filter */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const platform = new URL(request.url).searchParams.get("platform");

    let rows;
    if (platform && platform !== "all") {
      rows = await db
        .select()
        .from(captionLibraryTable)
        .where(and(eq(captionLibraryTable.userId, userId), eq(captionLibraryTable.platform, platform)))
        .orderBy(desc(captionLibraryTable.createdAt));
    } else {
      rows = await db
        .select()
        .from(captionLibraryTable)
        .where(eq(captionLibraryTable.userId, userId))
        .orderBy(desc(captionLibraryTable.createdAt));
    }

    return NextResponse.json({ captions: rows });
  } catch (e) {
    console.error("[caption-library] GET error:", e);
    return NextResponse.json({ error: "Failed to load captions" }, { status: 500 });
  }
}

/** POST /api/caption-library — save a caption. Body: { title, caption, hashtags, platform } */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({})) as {
      title?: string;
      caption?: string;
      hashtags?: string;
      platform?: string;
    };

    if (!body.caption?.trim()) return NextResponse.json({ error: "caption required" }, { status: 400 });

    const validPlatforms = ["all", "tiktok", "instagram", "youtube"];
    const platform = validPlatforms.includes(body.platform ?? "") ? body.platform! : "all";

    const [row] = await db
      .insert(captionLibraryTable)
      .values({
        userId,
        title: (body.title ?? "").trim(),
        caption: body.caption.trim(),
        hashtags: (body.hashtags ?? "").trim(),
        platform,
      })
      .returning();

    return NextResponse.json(row);
  } catch (e) {
    console.error("[caption-library] POST error:", e);
    return NextResponse.json({ error: "Failed to save caption" }, { status: 500 });
  }
}

/** DELETE /api/caption-library?id=X — delete a caption owned by the user */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await db
      .delete(captionLibraryTable)
      .where(and(eq(captionLibraryTable.id, id), eq(captionLibraryTable.userId, userId)));

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[caption-library] DELETE error:", e);
    return NextResponse.json({ error: "Failed to delete caption" }, { status: 500 });
  }
}
