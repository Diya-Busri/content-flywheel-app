import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { promoCodesTable, promoCodeUsesTable } from "@/db/schema/promo-codes-schema";
import { eq, desc, count } from "drizzle-orm";

export async function GET() {
  const { userId } = auth();
  if (!userId || !(await isAdmin(userId))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const codes = await db.select().from(promoCodesTable).orderBy(desc(promoCodesTable.createdAt));
  return NextResponse.json({ codes });
}

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId || !(await isAdmin(userId))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { code, description, discountPercent = 0, discountAmount = 0, maxUses, expiresAt } = body;
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const [promo] = await db.insert(promoCodesTable).values({
    code: code.toUpperCase().trim(),
    description,
    discountPercent,
    discountAmount,
    maxUses: maxUses || null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    active: true,
  }).returning();

  return NextResponse.json({ code: promo });
}
