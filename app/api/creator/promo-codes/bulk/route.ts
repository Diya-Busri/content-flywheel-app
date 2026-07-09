import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { creatorPromoCodesTable } from "@/db/schema/creator-promo-codes-schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0,O,I,1)

function randomSuffix(length = 6): string {
  let s = "";
  for (let i = 0; i < length; i++) {
    s += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return s;
}

/**
 * POST /api/creator/promo-codes/bulk
 * Body: { prefix, count, discountPercent?, discountAmount?, maxUses?, expiresAt? }
 * Generates `count` unique codes like PREFIX-XXXXXX and bulk-inserts them.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as {
    prefix?: string;
    count?: number;
    discountPercent?: number | null;
    discountAmount?: number | null;
    maxUses?: number | null;
    expiresAt?: string | null;
  };

  const prefix = (body.prefix ?? "CODE").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16) || "CODE";
  const count = Math.min(Math.max(parseInt(String(body.count ?? 10)) || 10, 1), 100);
  const discountPercent = body.discountPercent ? parseInt(String(body.discountPercent)) : null;
  const discountAmount = body.discountAmount ? Math.round(Number(body.discountAmount) * 100) : null;

  if (!discountPercent && !discountAmount) {
    return NextResponse.json({ error: "discountPercent or discountAmount is required" }, { status: 400 });
  }
  if (discountPercent && (discountPercent < 1 || discountPercent > 100)) {
    return NextResponse.json({ error: "discountPercent must be 1–100" }, { status: 400 });
  }

  // Fetch existing codes for this creator to avoid collisions
  const existing = await db
    .select({ code: creatorPromoCodesTable.code })
    .from(creatorPromoCodesTable)
    .where(eq(creatorPromoCodesTable.creatorUserId, userId));
  const existingSet = new Set(existing.map((r) => r.code));

  // Generate unique codes
  const generated: string[] = [];
  let attempts = 0;
  while (generated.length < count && attempts < count * 10) {
    attempts++;
    const candidate = `${prefix}-${randomSuffix(6)}`;
    if (!existingSet.has(candidate) && !generated.includes(candidate)) {
      generated.push(candidate);
    }
  }

  if (generated.length === 0) {
    return NextResponse.json({ error: "Could not generate unique codes. Try a different prefix." }, { status: 409 });
  }

  const maxUses = body.maxUses ? parseInt(String(body.maxUses)) : null;
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  const rows = generated.map((code) => ({
    creatorUserId: userId,
    code,
    discountPercent,
    discountAmount,
    maxUses,
    expiresAt,
  }));

  const inserted = await db
    .insert(creatorPromoCodesTable)
    .values(rows)
    .returning();

  return NextResponse.json({ codes: inserted, count: inserted.length }, { status: 201 });
}
