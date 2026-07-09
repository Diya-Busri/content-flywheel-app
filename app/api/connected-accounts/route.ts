import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { connectedAccountsTable } from "@/db/schema/connected-accounts-schema";
import { eq } from "drizzle-orm";
import type { ConnectedPlatform } from "@/db/schema/connected-accounts-schema";

export const dynamic = "force-dynamic";

const PLATFORMS: ConnectedPlatform[] = ["tiktok", "youtube", "instagram", "facebook"];

function isDbOrConfigError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return (
    !process.env.DATABASE_URL ||
    lower.includes("connect") ||
    lower.includes("econnrefused") ||
    lower.includes("timeout") ||
    lower.includes("does not exist") ||
    lower.includes("relation") ||
    lower.includes("database")
  );
}

/** GET: List connected accounts for the current user (no tokens returned). */
export async function GET() {
  try {
    if (!process.env.DATABASE_URL?.trim()) {
      return NextResponse.json(
        { error: "Server not configured (database)" },
        { status: 503 }
      );
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const rows = await db
      .select({
        id: connectedAccountsTable.id,
        platform: connectedAccountsTable.platform,
        platformUsername: connectedAccountsTable.platformUsername,
        platformUserId: connectedAccountsTable.platformUserId,
        expiresAt: connectedAccountsTable.expiresAt,
        createdAt: connectedAccountsTable.createdAt,
      })
      .from(connectedAccountsTable)
      .where(eq(connectedAccountsTable.userId, userId));

    const connected = rows.map((r) => ({
      id: r.id,
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
    const status = isDbOrConfigError(err) ? 503 : 500;
    const message = err instanceof Error ? err.message : "Failed to load";
    return NextResponse.json(
      { error: status === 503 ? "Server temporarily unavailable" : message },
      { status }
    );
  }
}
