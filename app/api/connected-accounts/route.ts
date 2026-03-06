import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { connectedAccountsTable } from "@/db/schema/connected-accounts-schema";
import { eq, and } from "drizzle-orm";
import type { ConnectedPlatform } from "@/db/schema/connected-accounts-schema";

export const dynamic = "force-dynamic";

const PLATFORMS: ConnectedPlatform[] = ["tiktok", "youtube", "instagram", "facebook"];

/** GET: List connected accounts for the current user (no tokens returned). */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await db
      .select({
        platform: connectedAccountsTable.platform,
        platformUsername: connectedAccountsTable.platformUsername,
        platformUserId: connectedAccountsTable.platformUserId,
        expiresAt: connectedAccountsTable.expiresAt,
        createdAt: connectedAccountsTable.createdAt,
      })
      .from(connectedAccountsTable)
      .where(eq(connectedAccountsTable.userId, userId));

    const connected = rows.map((r) => ({
      platform: r.platform,
      platformUsername: r.platformUsername ?? null,
      platformUserId: r.platformUserId ?? null,
      expiresAt: r.expiresAt ? (r.expiresAt as Date).toISOString() : null,
      createdAt: (r.createdAt as Date).toISOString(),
    }));

    return NextResponse.json({
      connected,
      platforms: PLATFORMS,
    });
  } catch (err) {
    console.error("[connected-accounts GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load" },
      { status: 500 }
    );
  }
}
