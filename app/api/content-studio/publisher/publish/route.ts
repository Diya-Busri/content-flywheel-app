import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { videosTable } from "@/db/schema/library-schema";
import { connectedAccountsTable, ConnectedPlatform } from "@/db/schema/connected-accounts-schema";
import { eq, and, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

const PLATFORMS = ["tiktok", "youtube", "instagram", "facebook"] as const;

/**
 * POST: Publish video(s) to selected platforms.
 * Body: { videoIds: string[], platforms: string[], options?: { tiktok?, youtube?, instagram?, facebook? } }
 * Validates user owns videos and has connected accounts. Real upload to TikTok/YouTube/Instagram/Facebook
 * would use platform APIs with stored OAuth tokens; this stub returns success and a message.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const videoIds = Array.isArray(body.videoIds) ? body.videoIds.filter((id: any): id is string => typeof id === "string") : [];
    const platforms = Array.isArray(body.platforms)
      ? body.platforms.filter((p: string) => PLATFORMS.includes(p as (typeof PLATFORMS)[number]))
      : [];

    if (videoIds.length === 0) {
      return NextResponse.json({ error: "videoIds required (array)" }, { status: 400 });
    }
    if (videoIds.length > 10) {
      return NextResponse.json({ error: "Maximum 10 videos per request" }, { status: 400 });
    }
    if (platforms.length === 0) {
      return NextResponse.json({ error: "Select at least one platform" }, { status: 400 });
    }

    const rows = await db
      .select({ id: videosTable.id })
      .from(videosTable)
      .where(and(eq(videosTable.userId, userId), inArray(videosTable.id, videoIds)));
    const ownedIds = new Set(rows.map((r) => r.id));
    const missing = videoIds.filter((id: string) => !ownedIds.has(id));
    if (missing.length > 0) {
      return NextResponse.json({ error: "Some videos not found or access denied", missing }, { status: 403 });
    }

    const connected = await db
      .select({ platform: connectedAccountsTable.platform })
      .from(connectedAccountsTable)
      .where(eq(connectedAccountsTable.userId, userId));
    const connectedSet = new Set(connected.map((c) => c.platform));
    const unconnected = platforms.filter((p: string) => !connectedSet.has(p as ConnectedPlatform));
    if (unconnected.length > 0) {
      return NextResponse.json({
        message: `Publish prepared for ${videoIds.length} video(s) to ${platforms.join(", ")}. Connect ${unconnected.join(", ")} in Settings for real publishing.`,
        simulated: true,
        unconnected,
      });
    }

    // Stub: real implementation would call TikTok Content API, YouTube Data API v3 upload,
    // Instagram Graph API, Facebook Graph API with user's tokens.
    return NextResponse.json({
      message: `Publish prepared: ${videoIds.length} video(s) → ${platforms.join(", ")}. Upload is simulated; connect OAuth in Settings to enable real publishing.`,
      simulated: true,
      videoIds,
      platforms,
    });
  } catch (e) {
    console.error("publisher/publish:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
