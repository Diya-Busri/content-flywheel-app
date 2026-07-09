import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { affiliateLinksTable } from "@/db/schema/affiliate-links-schema";
import { eq, and } from "drizzle-orm";

// Public endpoint — validates a ref code and returns affiliate link id + commission %
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { code, creatorUserId } = body;

  if (!code || !creatorUserId) {
    return NextResponse.json({ valid: false });
  }

  const [link] = await db
    .select({ id: affiliateLinksTable.id, commissionPercent: affiliateLinksTable.commissionPercent })
    .from(affiliateLinksTable)
    .where(
      and(
        eq(affiliateLinksTable.code, code.toUpperCase()),
        eq(affiliateLinksTable.creatorUserId, creatorUserId),
        eq(affiliateLinksTable.active, true)
      )
    )
    .limit(1);

  if (!link) return NextResponse.json({ valid: false });
  return NextResponse.json({ valid: true, affiliateLinkId: link.id, commissionPercent: link.commissionPercent });
}
