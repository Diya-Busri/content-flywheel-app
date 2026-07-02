export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { and, eq, ne } from "drizzle-orm";

const SUFFIX = ".contentflywheel.co.uk";

/**
 * GET /api/store-settings/check-domain?domain=digitaldrift
 * Accepts a bare handle or full subdomain. Returns { available: true/false }.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("domain") ?? "";
  const trimmed = raw.trim().toLowerCase();
  // Accept "digitaldrift" or "digitaldrift.contentflywheel.co.uk"
  const handle = trimmed.endsWith(SUFFIX) ? trimmed.slice(0, -SUFFIX.length) : trimmed;
  const domain = handle ? `${handle}${SUFFIX}` : "";

  if (!domain) {
    return NextResponse.json({ available: true });
  }

  // Handle: 2-63 chars, letters/numbers/hyphens, no leading/trailing hyphen
  const valid = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(handle);
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
