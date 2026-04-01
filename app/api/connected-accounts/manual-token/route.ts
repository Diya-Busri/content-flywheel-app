import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { connectedAccountsTable } from "@/db/schema/connected-accounts-schema";
import { eq, and } from "drizzle-orm";
import type { ConnectedPlatform } from "@/db/schema/connected-accounts-schema";

export const dynamic = "force-dynamic";

const ALLOWED_PLATFORMS: ConnectedPlatform[] = ["instagram", "facebook"];

/**
 * POST /api/connected-accounts/manual-token
 * Dev bypass: save a manually-obtained access token for instagram or facebook.
 * Body: { platform, accessToken, platformUserId?, platformUsername? }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as {
      platform?: string;
      accessToken?: string;
      platformUserId?: string;
      platformUsername?: string;
    };

    const platform = body.platform as ConnectedPlatform | undefined;
    const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";

    if (!platform || !ALLOWED_PLATFORMS.includes(platform)) {
      return NextResponse.json({ error: "platform must be instagram or facebook" }, { status: 400 });
    }
    if (!accessToken) {
      return NextResponse.json({ error: "accessToken is required" }, { status: 400 });
    }

    const platformUserId = typeof body.platformUserId === "string" && body.platformUserId.trim()
      ? body.platformUserId.trim()
      : null;
    const platformUsername = typeof body.platformUsername === "string" && body.platformUsername.trim()
      ? body.platformUsername.trim()
      : null;

    // Upsert: if a row exists for this user+platform+platformUserId, update it; otherwise insert.
    const existing = await db
      .select({ id: connectedAccountsTable.id })
      .from(connectedAccountsTable)
      .where(
        and(
          eq(connectedAccountsTable.userId, userId),
          eq(connectedAccountsTable.platform, platform),
          ...(platformUserId ? [eq(connectedAccountsTable.platformUserId, platformUserId)] : [])
        )
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(connectedAccountsTable)
        .set({ accessToken, platformUsername, platformUserId, updatedAt: new Date() })
        .where(eq(connectedAccountsTable.id, existing[0].id));
    } else {
      await db.insert(connectedAccountsTable).values({
        userId,
        platform,
        accessToken,
        platformUserId,
        platformUsername,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[connected-accounts/manual-token]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save token" },
      { status: 500 }
    );
  }
}
