import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { creatorPromoCodesTable } from "@/db/schema/creator-promo-codes-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { code, productId } = body;

  if (!code || !productId) {
    return NextResponse.json({ valid: false, error: "Missing code or productId" });
  }

  // Get the product to find creator
  const [product] = await db
    .select({ userId: productsTable.userId })
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .limit(1);

  if (!product) {
    return NextResponse.json({ valid: false, error: "Product not found" });
  }

  // Find matching active code for this creator (case-insensitive)
  const [promoCode] = await db
    .select()
    .from(creatorPromoCodesTable)
    .where(
      and(
        eq(creatorPromoCodesTable.creatorUserId, product.userId),
        eq(creatorPromoCodesTable.active, true),
        sql`UPPER(${creatorPromoCodesTable.code}) = UPPER(${code})`
      )
    )
    .limit(1);

  if (!promoCode) {
    return NextResponse.json({ valid: false, error: "Invalid or expired code" });
  }

  // Check expiry
  if (promoCode.expiresAt && promoCode.expiresAt < new Date()) {
    return NextResponse.json({ valid: false, error: "This code has expired" });
  }

  // Check max uses
  if (promoCode.maxUses !== null && promoCode.usedCount >= promoCode.maxUses) {
    return NextResponse.json({ valid: false, error: "This code has reached its usage limit" });
  }

  return NextResponse.json({
    valid: true,
    codeId: promoCode.id,
    discountPercent: promoCode.discountPercent,
    discountAmount: promoCode.discountAmount,
  });
}
