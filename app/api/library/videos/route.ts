export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { videosTable } from "@/db/schema/library-schema";
import { eq, desc } from "drizzle-orm";
import { autoCompleteGoalTasks } from "@/lib/goals-auto-complete";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await db
      .select()
      .from(videosTable)
      .where(eq(videosTable.userId, userId))
      .orderBy(desc(videosTable.createdAt));

    return NextResponse.json(rows);
  } catch (err) {
    console.error("Library videos list error:", err);
    return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { title, thumbnailUrl, platforms = [], productId, scriptId } = body as {
      title?: string;
      thumbnailUrl?: string;
      platforms?: string[];
      productId?: string;
      scriptId?: string;
    };

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const [inserted] = await db
      .insert(videosTable)
      .values({
        userId,
        title: title.trim(),
        thumbnailUrl: thumbnailUrl || null,
        platforms: Array.isArray(platforms) ? platforms : [],
        productId: productId || null,
        scriptId: scriptId || null,
      })
      .returning();

    if (!inserted?.id) return NextResponse.json({ error: "Failed to save video" }, { status: 500 });

    // Fire-and-forget: auto-complete any matching goal tasks
    autoCompleteGoalTasks(userId, "video_created").catch(() => {});

    return NextResponse.json(inserted);
  } catch (err) {
    console.error("Library video save error:", err);
    return NextResponse.json({ error: "Failed to save video" }, { status: 500 });
  }
}
