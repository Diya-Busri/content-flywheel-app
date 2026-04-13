import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { connectedAccountsTable } from "@/db/schema/connected-accounts-schema";
import { eq, and } from "drizzle-orm";
import type { ConnectedPlatform } from "@/db/schema/connected-accounts-schema";

export const dynamic = "force-dynamic";

const PLATFORMS: ConnectedPlatform[] = ["tiktok", "youtube", "instagram", "facebook"];

/**
 * PATCH: Update the channel label (platformUsername) for a specific account row.
 * Used by the post-OAuth channel picker so users can correct which brand channel
 * this token is for.
 * Body: { accountId: string; channelHandle: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const { platform } = await params;
    if (!platform || !PLATFORMS.includes(platform as ConnectedPlatform)) {
      return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({})) as { accountId?: string; channelHandle?: string };
    const { accountId, channelHandle } = body;

    if (!accountId?.trim()) return NextResponse.json({ error: "accountId required" }, { status: 400 });
    if (!channelHandle?.trim()) return NextResponse.json({ error: "channelHandle required" }, { status: 400 });

    // Normalise handle — strip leading @
    const handle = channelHandle.trim().replace(/^@+/, "");
    const displayHandle = `@${handle}`;

    // Optionally look up the real channel ID via YouTube API
    let resolvedChannelId: string | null = null;
    if (platform === "youtube") {
      try {
        const ytRes = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=id,snippet&forHandle=${encodeURIComponent(handle)}&key=${process.env.GOOGLE_CLIENT_ID}`,
        );
        // forHandle lookup needs an API key — fall back to stored token if available
        if (!ytRes.ok) throw new Error("skip");
        const ytData = await ytRes.json() as { items?: Array<{ id?: string }> };
        resolvedChannelId = ytData.items?.[0]?.id ?? null;
      } catch {
        // Non-fatal — we still update the display name
      }
    }

    await db
      .update(connectedAccountsTable)
      .set({
        platformUsername: displayHandle,
        ...(resolvedChannelId ? { platformUserId: resolvedChannelId } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(connectedAccountsTable.id, accountId.trim()),
          eq(connectedAccountsTable.userId, userId),
          eq(connectedAccountsTable.platform, platform as ConnectedPlatform)
        )
      );

    return NextResponse.json({ ok: true, channelHandle: displayHandle });
  } catch (err) {
    console.error("[connected-accounts PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update" },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Disconnect a platform (remove stored tokens).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { platform } = await params;
    if (!platform || !PLATFORMS.includes(platform as ConnectedPlatform)) {
      return NextResponse.json(
        { error: "Invalid platform. Use: tiktok, youtube, instagram, facebook" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId")?.trim() ?? "";

    await db
      .delete(connectedAccountsTable)
      .where(
        and(
          eq(connectedAccountsTable.userId, userId),
          eq(connectedAccountsTable.platform, platform as ConnectedPlatform),
          ...(accountId ? [eq(connectedAccountsTable.id, accountId)] : [])
        )
      );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[connected-accounts DELETE]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to disconnect" },
      { status: 500 }
    );
  }
}
