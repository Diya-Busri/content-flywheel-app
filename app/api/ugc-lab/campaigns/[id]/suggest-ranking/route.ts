export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { ugcCampaignsTable, ugcCampaignProductsTable } from "@/db/schema/ugc-campaigns-schema";
import { eq, and, asc } from "drizzle-orm";
import { suggestRankingOrder } from "@/lib/ugc/suggest-ranking-order";

/** POST: AI suggests ranking order for campaign products. Returns product IDs in suggested order. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);

    if (rl) return rl;

    const { id: campaignId } = await params;

    const [campaign] = await db
      .select()
      .from(ugcCampaignsTable)
      .where(and(eq(ugcCampaignsTable.id, campaignId), eq(ugcCampaignsTable.userId, userId)))
      .limit(1);

    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    const products = await db
      .select()
      .from(ugcCampaignProductsTable)
      .where(eq(ugcCampaignProductsTable.campaignId, campaignId))
      .orderBy(asc(ugcCampaignProductsTable.orderIndex));

    if (products.length < 2) {
      return NextResponse.json(
        { error: "Ranking requires at least 2 products" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const productContext = (body.productContext as string)?.trim();

    const suggestedIds = await suggestRankingOrder(
      products.map((p) => ({
        id: p.id,
        productName: p.productName,
        productLink: p.productLink,
        role: p.role,
      })),
      productContext
    );

    return NextResponse.json({ productIds: suggestedIds });
  } catch (err) {
    console.error("[suggest-ranking] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to suggest ranking" },
      { status: 500 }
    );
  }
}
