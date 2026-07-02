export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { and, eq, ne } from "drizzle-orm";

/**
 * GET /api/store-settings/check-domain?domain=store.example.com
 * Returns { available: true } if no other user has this domain, { available: false } if taken.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("domain") ?? "";
  const domain = raw.trim().toLowerCase();

  if (!domain) {
    return NextResponse.json({ available: true });
  }

  // Basic format check
  const valid = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain);
  if (!valid) {
    return NextResponse.json({ available: false, reason: "Invalid domain format" });
  }

  const [taken] = await db
    .select({ userId: storeSettingsTable.userId })
    .from(storeSettingsTable)
    .where(
      and(
        eq(storeSettingsTable.customDomain, domain),
        ne(storeSettingsTable.userId, userId)
      )
    )
    .limit(1);

  return NextResponse.json({ available: !taken });
}
