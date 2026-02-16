import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { ugcCampaignsTable, ugcCampaignProductsTable } from "@/db/schema/ugc-campaigns-schema";
import { eq, and, asc } from "drizzle-orm";

/** GET: Get campaign with products. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const [campaign] = await db
      .select()
      .from(ugcCampaignsTable)
      .where(and(eq(ugcCampaignsTable.id, id), eq(ugcCampaignsTable.userId, userId)))
      .limit(1);

    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    const products = await db
      .select()
      .from(ugcCampaignProductsTable)
      .where(eq(ugcCampaignProductsTable.campaignId, id))
      .orderBy(asc(ugcCampaignProductsTable.orderIndex));

    return NextResponse.json({ campaign, products });
  } catch (err) {
    console.error("[campaigns/:id] GET Error:", err);
    return NextResponse.json({ error: "Failed to fetch campaign" }, { status: 500 });
  }
}
