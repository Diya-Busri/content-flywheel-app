import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { ugcCampaignsTable, ugcCampaignProductsTable } from "@/db/schema/ugc-campaigns-schema";
import { eq, and } from "drizzle-orm";

const MIN_PRODUCTS_PER_CAMPAIGN = 1;

/** PATCH: Update product role. Exactly one must be PRIMARY. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: campaignId, productId } = await params;

    const [campaign] = await db
      .select()
      .from(ugcCampaignsTable)
      .where(and(eq(ugcCampaignsTable.id, campaignId), eq(ugcCampaignsTable.userId, userId)))
      .limit(1);

    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const role = (body.role as string)?.trim();

    if (role !== "primary" && role !== "comparison") {
      return NextResponse.json({ error: "role must be primary or comparison" }, { status: 400 });
    }

    const [product] = await db
      .select()
      .from(ugcCampaignProductsTable)
      .where(
        and(
          eq(ugcCampaignProductsTable.campaignId, campaignId),
          eq(ugcCampaignProductsTable.id, productId)
        )
      )
      .limit(1);

    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    if (role === "primary") {
      await db
        .update(ugcCampaignProductsTable)
        .set({ role: "comparison" })
        .where(eq(ugcCampaignProductsTable.campaignId, campaignId));
    }

    const [updated] = await db
      .update(ugcCampaignProductsTable)
      .set({ role: role as "primary" | "comparison" })
      .where(eq(ugcCampaignProductsTable.id, productId))
      .returning();

    return NextResponse.json({ product: updated });
  } catch (err) {
    console.error("[campaigns/:id/products/:productId] PATCH Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update product" },
      { status: 500 }
    );
  }
}

/** DELETE: Remove product. Campaign must have at least 1 product. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: campaignId, productId } = await params;

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

    if (existing.length <= MIN_PRODUCTS_PER_CAMPAIGN) {
      return NextResponse.json(
        { error: `Campaign must have at least ${MIN_PRODUCTS_PER_CAMPAIGN} product` },
        { status: 400 }
      );
    }

    const [product] = existing.filter((p) => p.id === productId);
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    await db
      .delete(ugcCampaignProductsTable)
      .where(
        and(
          eq(ugcCampaignProductsTable.campaignId, campaignId),
          eq(ugcCampaignProductsTable.id, productId)
        )
      );

    if (product.role === "primary") {
      const remaining = existing.filter((p) => p.id !== productId);
      const [first] = remaining;
      if (first) {
        await db
          .update(ugcCampaignProductsTable)
          .set({ role: "primary" })
          .where(eq(ugcCampaignProductsTable.id, first.id));
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[campaigns/:id/products/:productId] DELETE Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete product" },
      { status: 500 }
    );
  }
}
