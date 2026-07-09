/**
 * DELETE /api/platform-connections/[platform] — disconnect a platform
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { connectedAccountsTable } from "@/db/schema/connected-accounts-schema";
import type { ConnectedPlatform } from "@/db/schema/connected-accounts-schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { platform } = await params;

  await db
    .delete(connectedAccountsTable)
    .where(
      and(
        eq(connectedAccountsTable.userId, userId),
        eq(connectedAccountsTable.platform, platform as ConnectedPlatform),
      )
    );

  return NextResponse.json({ disconnected: true });
}
