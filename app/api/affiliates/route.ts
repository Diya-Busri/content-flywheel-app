import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { affiliateLinksTable, affiliateCommissionsTable } from "@/db/schema/affiliate-links-schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET — list affiliate links + commission totals
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const links = await db
    .select()
    .from(affiliateLinksTable)
    .where(and(eq(affiliateLinksTable.creatorUserId, userId), eq(affiliateLinksTable.active, true)))
    .orderBy(affiliateLinksTable.createdAt);

  // Fetch commission records per link
  const commissions = await db
    .select()
    .from(affiliateCommissionsTable)
    .where(eq(affiliateCommissionsTable.creatorUserId, userId));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

  const result = links.map((link) => {
    const linkCommissions = commissions.filter((c) => c.affiliateLinkId === link.id);
    return {
      ...link,
      salesCount: linkCommissions.length,
      totalCommissionCents: linkCommissions.reduce((sum, c) => sum + c.commissionCents, 0),
      referralUrl: `${appUrl}/c/${userId}?ref=${link.code}`,
    };
  });

  return NextResponse.json(result);
}

// POST — create a new affiliate link
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { affiliateName, affiliateEmail, commissionPercent } = body;

  if (!affiliateName?.trim()) {
    return NextResponse.json({ error: "Affiliate name is required" }, { status: 400 });
  }
  const pct = Math.min(100, Math.max(1, parseInt(commissionPercent) || 20));

  // Generate a unique code
  const code = affiliateName.trim().toUpperCase().replace(/\s+/g, "").slice(0, 8) + Math.random().toString(36).slice(2, 5).toUpperCase();

  const [created] = await db
    .insert(affiliateLinksTable)
    .values({
      creatorUserId: userId,
      affiliateName: affiliateName.trim(),
      affiliateEmail: affiliateEmail?.trim() || null,
      code,
      commissionPercent: pct,
    })
    .returning();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";
  return NextResponse.json({
    ...created,
    salesCount: 0,
    totalCommissionCents: 0,
    referralUrl: `${appUrl}/c/${userId}?ref=${code}`,
  }, { status: 201 });
}

// DELETE — deactivate an affiliate link
export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db
    .update(affiliateLinksTable)
    .set({ active: false })
    .where(and(eq(affiliateLinksTable.id, id), eq(affiliateLinksTable.creatorUserId, userId)));

  return NextResponse.json({ success: true });
}
