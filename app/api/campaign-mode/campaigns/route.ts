import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { brandCampaignsTable } from "@/db/schema/brand-campaigns-schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET: List campaigns for a workspace. Query: workspaceId (required).
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const rows = await db
      .select()
      .from(brandCampaignsTable)
      .where(eq(brandCampaignsTable.workspaceId, workspaceId))
      .orderBy(desc(brandCampaignsTable.createdAt));

    // Only return campaigns belonging to current user
    const owned = rows.filter((r) => r.userId === userId);

    return NextResponse.json(
      owned.map((r) => ({
        id: r.id,
        workspaceId: r.workspaceId,
        contentType: r.contentType,
        postConcept: r.postConcept ?? undefined,
        title: r.title ?? undefined,
        status: r.status,
        scheduledDate: r.scheduledDate?.toISOString() ?? undefined,
        createdAt: r.createdAt?.toISOString(),
      }))
    );
  } catch (e) {
    console.error("[campaign-mode/campaigns GET]", e);
    return NextResponse.json({ error: "Failed to load campaigns." }, { status: 500 });
  }
}

/**
 * POST: Create a campaign (Save Campaign or Schedule Post).
 * Body: workspaceId, contentType, postConcept, scriptJson?, voiceoverText?, timelineJson?, carouselJson?,
 *       caption, hashtags, title, description, status ('ready'|'draft'), scheduledDate? (ISO string)
 * Returns { id, ... } of created row.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : null;
    const contentType = body.contentType === "video" || body.contentType === "carousel" ? body.contentType : null;
    const postConcept = typeof body.postConcept === "string" ? body.postConcept.trim() || null : null;
    const status = body.status === "ready" || body.status === "draft" ? body.status : "ready";

    if (!workspaceId || !contentType) {
      return NextResponse.json(
        { error: "workspaceId and contentType (video|carousel) are required" },
        { status: 400 }
      );
    }

    const scriptJson = body.scriptJson != null ? body.scriptJson : null;
    const voiceoverText = typeof body.voiceoverText === "string" ? body.voiceoverText : null;
    const timelineJson = body.timelineJson != null ? body.timelineJson : null;
    const carouselJson = body.carouselJson != null ? body.carouselJson : null;
    const caption = typeof body.caption === "string" ? body.caption : null;
    const hashtags = typeof body.hashtags === "string" ? body.hashtags : null;
    const title = typeof body.title === "string" ? body.title : null;
    const description = typeof body.description === "string" ? body.description : null;
    let scheduledDate: Date | null = null;
    if (typeof body.scheduledDate === "string" && body.scheduledDate) {
      const d = new Date(body.scheduledDate);
      if (!Number.isNaN(d.getTime())) scheduledDate = d;
    }

    const [row] = await db
      .insert(brandCampaignsTable)
      .values({
        userId,
        workspaceId,
        contentType,
        postConcept,
        scriptJson,
        voiceoverText,
        timelineJson,
        carouselJson,
        caption,
        hashtags,
        title,
        description,
        scheduledDate,
        status,
      })
      .returning();

    if (!row) {
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }

    return NextResponse.json({
      id: row.id,
      workspaceId: row.workspaceId,
      contentType: row.contentType,
      postConcept: row.postConcept ?? undefined,
      title: row.title ?? undefined,
      status: row.status,
      scheduledDate: row.scheduledDate?.toISOString() ?? undefined,
      createdAt: row.createdAt?.toISOString(),
    });
  } catch (e) {
    console.error("[campaign-mode/campaigns POST]", e);
    return NextResponse.json({ error: "Failed to save campaign." }, { status: 500 });
  }
}
