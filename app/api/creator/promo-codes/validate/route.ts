import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { creatorPromoCodesTable } from "@/db/schema/creator-promo-codes-schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

// POST — validate a promo code for a product purchase (public, no auth needed)
export async function POST(request: NextRequest) {
  const { code, creatorUserId } = await request.json();

  if (!code || !creatorUserId) {
    return NextResponse.json({ error: "code and creatorUserId required" }, { status: 400 });
  }

  const [promo] = await db
    .select()
    .from(creatorPromoCodesTable)
    .where(
      and(
        eq(creatorPromoCodesTable.creatorUserId, creatorUserId),
        eq(creatorPromoCodesTable.code, code.toUpperCase().trim()),
        eq(creatorPromoCodesTable.active, true)
      )
    )
    .limit(1);

  if (!promo) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 404 });
  }

  if (promo.expiresAt && promo.expiresAt < new Date()) {
    return NextResponse.json({ error: "This code has expired" }, { status: 400 });
  }

  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    return NextResponse.json({ error: "This code has reached its usage limit" }, { status: 400 });
  }

  return NextResponse.json({
    valid: true,
    discountPercent: promo.discountPercent,
    discountAmount: promo.discountAmount,
    code: promo.code,
  });
}
