import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/custom-domain/lookup?host=store.mysite.com
 * Returns { userId } if the host matches a creator's custom domain, or 404.
 * Called from middleware to route custom domains to the creator's store.
 */
export async function GET(request: NextRequest) {
  const host = request.nextUrl.searchParams.get("host");
  if (!host) return NextResponse.json({ error: "Missing host" }, { status: 400 });

  // Normalise: strip port if present (e.g. localhost:3000)
  const normalised = host.split(":")[0].toLowerCase();

  try {
    const [row] = await db
      .select({ userId: storeSettingsTable.userId })
      .from(storeSettingsTable)
      .where(eq(storeSettingsTable.customDomain, normalised))
      .limit(1);

    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ userId: row.userId });
  } catch (err) {
    console.error("[custom-domain/lookup]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
