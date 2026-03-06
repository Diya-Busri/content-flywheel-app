import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { contentStudioVideosTable } from "@/db/schema/content-studio-videos-schema";
import { eq, desc, ilike, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

const STATUS_VALUES = ["draft", "ready", "published"] as const;
const TYPE_VALUES = ["youtube-long", "youtube-short", "tiktok"] as const;

/**
 * GET: List Content Studio videos for the current user.
 * Query: search?, status?, type?
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const status = searchParams.get("status")?.trim().toLowerCase();
    const type = searchParams.get("type")?.trim();

    const conditions = [eq(contentStudioVideosTable.userId, userId)];

    if (search) {
      conditions.push(ilike(contentStudioVideosTable.title, `%${search}%`));
    }
    if (status && STATUS_VALUES.includes(status as (typeof STATUS_VALUES)[number])) {
      conditions.push(eq(contentStudioVideosTable.status, status as (typeof STATUS_VALUES)[number]));
    }
    if (type && TYPE_VALUES.includes(type as (typeof TYPE_VALUES)[number])) {
      conditions.push(eq(contentStudioVideosTable.videoType, type as (typeof TYPE_VALUES)[number]));
    }

    const rows = await db
      .select()
      .from(contentStudioVideosTable)
      .where(and(...conditions))
      .orderBy(desc(contentStudioVideosTable.createdAt));

    const videos = rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      videoType: r.videoType,
      thumbnailUrl: r.thumbnailUrl,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return NextResponse.json(videos);
  } catch (err) {
    console.error("[content-studio/videos GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load videos" },
      { status: 500 }
    );
  }
}

/**
 * POST: Create a new Content Studio video (e.g. for duplicate).
 * Body: { title: string, status?: "draft"|"ready"|"published", videoType?: "youtube-long"|"youtube-short"|"tiktok" }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

    const status = body?.status && STATUS_VALUES.includes(body.status) ? body.status : "draft";
    const videoType = body?.videoType && TYPE_VALUES.includes(body.videoType) ? body.videoType : null;

    const [row] = await db
      .insert(contentStudioVideosTable)
      .values({
        userId,
        title,
        status,
        videoType,
      })
      .returning();

    if (!row) return NextResponse.json({ error: "Failed to create video" }, { status: 500 });
    return NextResponse.json({
      id: row.id,
      title: row.title,
      status: row.status,
      videoType: row.videoType,
      thumbnailUrl: row.thumbnailUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  } catch (err) {
    console.error("[content-studio/videos POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create video" },
      { status: 500 }
    );
  }
}
