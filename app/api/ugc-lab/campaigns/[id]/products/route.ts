import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { ugcCampaignsTable, ugcCampaignProductsTable } from "@/db/schema/ugc-campaigns-schema";
import { eq, and } from "drizzle-orm";

const MAX_PRODUCTS_PER_CAMPAIGN = 5;

/** POST: Add a product to a campaign. Min 1, max 5 products. Exactly one must be PRIMARY. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: campaignId } = await params;

    const [campaign] = await db
      .select()
      .from(ugcCampaignsTable)
      .where(and(eq(ugcCampaignsTable.id, campaignId), eq(ugcCampaignsTable.userId, userId)))
      .limit(1);

    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    const existing = await db
      .select()
      .from(ugcCampaignProductsTable)
      .where(eq(ugcCampaignProductsTable.campaignId, campaignId));

    if (existing.length >= MAX_PRODUCTS_PER_CAMPAIGN) {
      return NextResponse.json(
        { error: `Maximum ${MAX_PRODUCTS_PER_CAMPAIGN} products per campaign` },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const productName = (body.productName as string)?.trim();
    const productLink = (body.productLink as string)?.trim();
    let role = (body.role as string) ?? (existing.length === 0 ? "primary" : "comparison");
    const orderIndex = Number(body.orderIndex) ?? existing.length;

    if (!productName) {
      return NextResponse.json({ error: "productName is required" }, { status: 400 });
    }
    if (role !== "primary" && role !== "comparison") {
      return NextResponse.json({ error: "role must be primary or comparison" }, { status: 400 });
    }

    if (existing.length === 0) role = "primary";

    if (role === "primary" && existing.some((p) => p.role === "primary")) {
      await db
        .update(ugcCampaignProductsTable)
        .set({ role: "comparison" })
        .where(eq(ugcCampaignProductsTable.campaignId, campaignId));
    }

    const [product] = await db
      .insert(ugcCampaignProductsTable)
      .values({
        campaignId,
        productName,
        productLink: productLink || null,
        role: role as "primary" | "comparison",
        orderIndex,
      })
      .returning();

    return NextResponse.json({ product });
  } catch (err) {
    console.error("[campaigns/:id/products] POST Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add product" },
      { status: 500 }
    );
  }
}
