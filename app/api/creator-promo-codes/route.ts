import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { creatorPromoCodesTable } from "@/db/schema/creator-promo-codes-schema";
import { eq, and, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET — list all promo codes for the logged-in creator
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const codes = await db
    .select()
    .from(creatorPromoCodesTable)
    .where(eq(creatorPromoCodesTable.creatorUserId, userId))
    .orderBy(desc(creatorPromoCodesTable.createdAt));

  return NextResponse.json(codes);
}

// POST — create a new promo code
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { code, discountPercent, discountAmount, maxUses, expiresAt } = body;

  if (!code || typeof code !== "string" || !code.trim()) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }
  if (!discountPercent && !discountAmount) {
    return NextResponse.json({ error: "Discount percent or amount is required" }, { status: 400 });
  }
  if (discountPercent && (discountPercent < 1 || discountPercent > 100)) {
    return NextResponse.json({ error: "Discount percent must be 1–100" }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: creatorPromoCodesTable.id })
    .from(creatorPromoCodesTable)
    .where(and(eq(creatorPromoCodesTable.creatorUserId, userId), eq(creatorPromoCodesTable.code, code.toUpperCase().trim())))
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: "You already have a code with this name" }, { status: 409 });
  }

  const [created] = await db
    .insert(creatorPromoCodesTable)
    .values({
      creatorUserId: userId,
      code: code.toUpperCase().trim(),
      discountPercent: discountPercent ? parseInt(discountPercent) : null,
      discountAmount: discountAmount ? Math.round(discountAmount * 100) : null,
      maxUses: maxUses ? parseInt(maxUses) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}

// DELETE — soft-deactivate a promo code (preserves usage history)
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json().catch(() => ({})) as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db
    .update(creatorPromoCodesTable)
    .set({ active: false })
    .where(and(eq(creatorPromoCodesTable.id, id), eq(creatorPromoCodesTable.creatorUserId, userId)));

  return NextResponse.json({ success: true });
}
