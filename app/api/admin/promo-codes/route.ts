import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { promoCodesTable } from "@/db/schema/promo-codes-schema";
import { desc } from "drizzle-orm";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const codes = await db.select().from(promoCodesTable).orderBy(desc(promoCodesTable.createdAt));
  return NextResponse.json({ codes });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { code, description, discountType, discountValue, maxUses, expiresAt } = body;
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const isPercent = discountType === "percent";

  const [promo] = await db.insert(promoCodesTable).values({
    code: code.toUpperCase().trim(),
    description: description ?? null,
    discountPercent: isPercent ? Math.round(discountValue ?? 0) : 0,
    discountAmount: !isPercent ? Math.round((discountValue ?? 0) * 100) : 0, // store in cents
    maxUses: maxUses || null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    active: true,
  }).returning();

  return NextResponse.json({ code: promo });
}
