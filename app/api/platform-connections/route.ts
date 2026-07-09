/**
 * GET  /api/platform-connections  — list all connected platforms for user
 * POST /api/platform-connections  — connect a platform (simulate or real OAuth)
 *
 * Body for POST:
 *   { platform: ConnectedPlatform, accountName: string, accountId?: string,
 *     accessToken?: string, scopes?: string }
 *
 * For platforms without real OAuth set up yet, pass accessToken = "simulated".
 * For Email, pass accessToken = RESEND_API_KEY and scopes = to_email_address.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { connectedAccountsTable } from "@/db/schema/connected-accounts-schema";
import type { ConnectedPlatform } from "@/db/schema/connected-accounts-schema";
import { eq, and } from "drizzle-orm";

const VALID_PLATFORMS = new Set<string>([
  "tiktok", "youtube", "instagram", "facebook", "x", "linkedin", "email",
]);

export async function GET(_req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const connections = await db
    .select({
      id:               connectedAccountsTable.id,
      platform:         connectedAccountsTable.platform,
      platformUsername: connectedAccountsTable.platformUsername,
      platformUserId:   connectedAccountsTable.platformUserId,
      scopes:           connectedAccountsTable.scopes,
      createdAt:        connectedAccountsTable.createdAt,
    })
    .from(connectedAccountsTable)
    .where(eq(connectedAccountsTable.userId, userId));

  // Return as a map keyed by platform for easy UI lookup
  const map: Record<string, { connected: boolean; accountName?: string; connectedAt: string }> = {};
  for (const c of connections) {
    map[c.platform] = {
      connected:   true,
      accountName: c.platformUsername ?? c.platformUserId ?? undefined,
      connectedAt: c.createdAt.toISOString(),
    };
  }

  return NextResponse.json({ connections: map });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    platform:     string;
    accountName?: string;
    accountId?:   string;
    accessToken?: string;
    scopes?:      string; // for email: recipient address
  };

  if (!VALID_PLATFORMS.has(body.platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  const platform   = body.platform as ConnectedPlatform;
  const accountId  = body.accountId  ?? `${userId}-${platform}`;
  const accessToken = body.accessToken ?? "simulated";

  // Upsert: delete old connection for this (user, platform, accountId) first
  await db
    .delete(connectedAccountsTable)
    .where(
      and(
        eq(connectedAccountsTable.userId, userId),
        eq(connectedAccountsTable.platform, platform),
      )
    );

  const [row] = await db
    .insert(connectedAccountsTable)
    .values({
      userId,
      platform,
      accessToken,
      platformUserId:   accountId,
      platformUsername: body.accountName,
      scopes:           body.scopes,
    })
    .returning();

  return NextResponse.json({
    connection: {
      connected:   true,
      accountName: row.platformUsername ?? row.platformUserId,
      connectedAt: row.createdAt.toISOString(),
    },
  });
}
