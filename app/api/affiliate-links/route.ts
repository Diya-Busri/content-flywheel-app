import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { affiliateLinksTable } from "@/db/schema/affiliate-links-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const links = await db
    .select({
      id: affiliateLinksTable.id,
      affiliateName: affiliateLinksTable.affiliateName,
      affiliateEmail: affiliateLinksTable.affiliateEmail,
      code: affiliateLinksTable.code,
      commissionPercent: affiliateLinksTable.commissionPercent,
      totalEarnedCents: affiliateLinksTable.totalEarnedCents,
      active: affiliateLinksTable.active,
      createdAt: affiliateLinksTable.createdAt,
    })
    .from(affiliateLinksTable)
    .where(eq(affiliateLinksTable.creatorUserId, userId))
    .orderBy(desc(affiliateLinksTable.createdAt));

  return NextResponse.json(links);
}

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { affiliateName, affiliateEmail, commissionPercent, code } = body;

  if (!affiliateName) {
    return NextResponse.json({ error: "affiliateName is required" }, { status: 400 });
  }

  // Generate a code if not provided
  const linkCode = code
    ? code.toLowerCase().replace(/\s+/g, "-")
    : affiliateName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") +
      "-" +
      Math.random().toString(36).slice(2, 6);

  const [created] = await db
    .insert(affiliateLinksTable)
    .values({
      creatorUserId: userId,
      affiliateName,
      affiliateEmail: affiliateEmail || null,
      code: linkCode,
      commissionPercent: commissionPercent ?? 20,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
