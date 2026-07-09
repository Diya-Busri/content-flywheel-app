import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { seoHashtagGroupsTable } from "@/db/schema/seo-hashtag-groups-schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

type SavedGroup = {
  id: string;
  name: string;
  platform: string;
  topic: string | null;
  tags: string[];
  createdAt: string;
};

/**
 * GET: List saved hashtag groups for the user.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await db
      .select()
      .from(seoHashtagGroupsTable)
      .where(eq(seoHashtagGroupsTable.userId, userId))
      .orderBy(desc(seoHashtagGroupsTable.createdAt));

    const groups: SavedGroup[] = rows.map((r) => {
      let tags: string[] = [];
      try {
        tags = typeof r.tags === "string" ? JSON.parse(r.tags) : Array.isArray(r.tags) ? r.tags : [];
      } catch {
        // ignore
      }
      return {
        id: r.id,
        name: r.name,
        platform: r.platform,
        topic: r.topic ?? null,
        tags,
        createdAt: r.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ groups });
  } catch (e) {
    console.error("seo saved-groups GET:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

/**
 * POST: Save a new hashtag group.
 * Body: { name: string, platform: "youtube" | "tiktok" | "instagram", tags: string[], topic?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const platform = ["youtube", "tiktok", "instagram"].includes(body.platform)
      ? body.platform
      : "youtube";
    const topic = typeof body.topic === "string" ? body.topic.trim() || null : null;
    let tags: string[] = [];
    if (Array.isArray(body.tags)) {
      tags = body.tags.filter((t: any): t is string => typeof t === "string" && t.trim().length > 0);
    }

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const tagsJson = JSON.stringify(tags);
    const [inserted] = await db
      .insert(seoHashtagGroupsTable)
      .values({
        userId,
        name,
        platform,
        topic,
        tags: tagsJson,
      })
      .returning({ id: seoHashtagGroupsTable.id, createdAt: seoHashtagGroupsTable.createdAt });

    return NextResponse.json({
      id: inserted?.id,
      createdAt: inserted?.createdAt?.toISOString(),
    });
  } catch (e) {
    console.error("seo saved-groups POST:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
