export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { ugcCampaignsTable, ugcCampaignProductsTable } from "@/db/schema/ugc-campaigns-schema";
import { eq, and } from "drizzle-orm";

/** PATCH: Reorder products. Body: { productIds: string[] }. Updates order_index to match. */
export async function PATCH(
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

    const body = await request.json().catch(() => ({}));
    const productIds = body.productIds as string[] | undefined;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: "productIds array is required" }, { status: 400 });
    }

    for (let i = 0; i < productIds.length; i++) {
      await db
        .update(ugcCampaignProductsTable)
        .set({ orderIndex: i })
        .where(
          and(
            eq(ugcCampaignProductsTable.campaignId, campaignId),
            eq(ugcCampaignProductsTable.id, productIds[i])
          )
        );
    }

    return NextResponse.json({ success: true, productIds });
  } catch (err) {
    console.error("[products/reorder] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reorder" },
      { status: 500 }
    );
  }
}
