export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { promoCodesTable, promoCodeUsesTable } from "@/db/schema/promo-codes-schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const [promo] = await db.select().from(promoCodesTable)
    .where(and(eq(promoCodesTable.code, code.toUpperCase().trim()), eq(promoCodesTable.active, true)));

  if (!promo) return NextResponse.json({ valid: false, error: "Invalid promo code" });
  if (promo.expiresAt && promo.expiresAt < new Date()) return NextResponse.json({ valid: false, error: "Promo code expired" });
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) return NextResponse.json({ valid: false, error: "Promo code fully redeemed" });

  // Check if user already used it
  const [used] = await db.select().from(promoCodeUsesTable)
    .where(and(eq(promoCodeUsesTable.codeId, promo.id), eq(promoCodeUsesTable.userId, userId)));
  if (used) return NextResponse.json({ valid: false, error: "You have already used this code" });

  return NextResponse.json({ valid: true, discountPercent: promo.discountPercent, discountAmount: promo.discountAmount, description: promo.description, plan: promo.plan });
}
