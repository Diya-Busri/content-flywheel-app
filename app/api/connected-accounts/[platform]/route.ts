import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { connectedAccountsTable } from "@/db/schema/connected-accounts-schema";
import { eq, and } from "drizzle-orm";
import type { ConnectedPlatform } from "@/db/schema/connected-accounts-schema";

export const dynamic = "force-dynamic";

const PLATFORMS: ConnectedPlatform[] = ["tiktok", "youtube", "instagram", "facebook"];

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
