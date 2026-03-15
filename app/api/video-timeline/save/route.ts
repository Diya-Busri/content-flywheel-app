import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { videosTable } from "@/db/schema/library-schema";

export const dynamic = "force-dynamic";

export type TimelineProjectContent = {
  scriptId?: string;
  template?: { id: string; name: string; aspectRatio: string; [key: string]: unknown } | null;
  scenes: unknown[];
  captions: unknown[];
  musicUrl?: string | null;
  musicVolume?: number;
  voiceoverUrl?: string | null;
  captionStyle?: {
    position?: string;
    fontSize?: string;
    textColor?: string;
    animation?: string;
  };
  /** Scene transition: fade | slideLeft | slideRight | wipe | zoom (used by server compile). */
  sceneTransition?: string;
  aspectRatio?: string;
  totalDuration?: number;
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "JSON body required" }, { status: 400 });
    }

    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : "Untitled Video";
    const content = body.content as TimelineProjectContent | undefined;
    if (!content || !Array.isArray(content.scenes)) {
      return NextResponse.json({ error: "content.scenes required" }, { status: 400 });
    }

    const thumbnailUrl =
      typeof body.thumbnailUrl === "string" && body.thumbnailUrl.trim()
        ? body.thumbnailUrl.trim()
        : null;
    const description = typeof body.description === "string" ? body.description : undefined;
    const hashtags = typeof body.hashtags === "string" ? body.hashtags : undefined;
    const scheduledAt = typeof body.scheduledAt === "string" ? body.scheduledAt : undefined;

    const metadata: Record<string, unknown> = {
      ...content,
      savedAt: new Date().toISOString(),
    };
    if (description !== undefined) metadata.description = description;
    if (hashtags !== undefined) metadata.hashtags = hashtags;
    if (scheduledAt !== undefined) metadata.scheduledAt = scheduledAt;

    const [row] = await db
      .insert(videosTable)
      .values({
        userId,
        title,
        thumbnailUrl,
        platforms: ["video-timeline"],
        status: "draft",
        productId: null,
        scriptId: content.scriptId ?? null,
        metadata,
      })
      .returning({ id: videosTable.id, title: videosTable.title, createdAt: videosTable.createdAt });

    if (!row) return NextResponse.json({ error: "Insert failed" }, { status: 500 });

    return NextResponse.json({
      id: row.id,
      title: row.title,
      createdAt: row.createdAt,
      message: "Saved to My Library",
    });
  } catch (err) {
    console.error("[video-timeline/save]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save" },
      { status: 500 }
    );
  }
}
