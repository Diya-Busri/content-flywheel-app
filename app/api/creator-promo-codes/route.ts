import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { creatorPromoCodesTable } from "@/db/schema/creator-promo-codes-schema";
import { eq, desc } from "drizzle-orm";

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

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { code, discountPercent, discountAmount, maxUses, expiresAt } = body;

  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const [created] = await db
    .insert(creatorPromoCodesTable)
    .values({
      creatorUserId: userId,
      code: code.toUpperCase().trim(),
      discountPercent: discountPercent ?? null,
      discountAmount: discountAmount ?? null,
      maxUses: maxUses ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
