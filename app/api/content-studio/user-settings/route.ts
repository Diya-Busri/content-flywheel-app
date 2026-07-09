import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { userContentSettingsTable } from "@/db/schema/user-content-settings-schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type YouTubeChannel = { id: string; name: string; subscriber_count: number };

/**
 * GET: Load Content Studio user settings (niche, content style, YouTube channels).
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [row] = await db
      .select()
      .from(userContentSettingsTable)
      .where(eq(userContentSettingsTable.userId, userId))
      .limit(1);

    if (!row) {
      return NextResponse.json({
        selected_niche: null,
        content_style: null,
        youtube_channels: [],
      });
    }

    const channels = (row.youtubeChannels ?? []) as YouTubeChannel[];
    return NextResponse.json({
      selected_niche: row.selectedNiche ?? null,
      content_style: row.contentStyle ?? null,
      youtube_channels: channels,
    });
  } catch (err) {
    console.error("[content-studio user-settings GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load settings" },
      { status: 500 }
    );
  }
}

/**
 * PUT: Upsert Content Studio user settings.
 * Body: { selected_niche?: string | null, content_style?: 'faceless' | 'ai-generated' | 'personal-brand' | null, youtube_channels?: YouTubeChannel[] }
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const selectedNiche =
      body.selected_niche === undefined ? undefined : (body.selected_niche === null ? null : String(body.selected_niche).trim() || null);
    const contentStyle =
      body.content_style === undefined
        ? undefined
        : body.content_style === null
          ? null
          : body.content_style === "faceless" || body.content_style === "ai-generated" || body.content_style === "personal-brand"
            ? body.content_style
            : undefined;
    const youtubeChannels = Array.isArray(body.youtube_channels)
      ? (body.youtube_channels as YouTubeChannel[]).map((c) => ({
          id: String(c?.id ?? ""),
          name: String(c?.name ?? ""),
          subscriber_count: Number(c?.subscriber_count) || 0,
        }))
      : undefined;

    const [existing] = await db
      .select()
      .from(userContentSettingsTable)
      .where(eq(userContentSettingsTable.userId, userId))
      .limit(1);

    if (existing) {
      await db
        .update(userContentSettingsTable)
        .set({
          ...(selectedNiche !== undefined && { selectedNiche }),
          ...(contentStyle !== undefined && { contentStyle }),
          ...(youtubeChannels !== undefined && { youtubeChannels }),
          updatedAt: new Date(),
        })
        .where(eq(userContentSettingsTable.userId, userId));
    } else {
      await db.insert(userContentSettingsTable).values({
        userId,
        selectedNiche: selectedNiche ?? null,
        contentStyle: contentStyle ?? null,
        youtubeChannels: youtubeChannels ?? [],
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[content-studio user-settings PUT]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save settings" },
      { status: 500 }
    );
  }
}
