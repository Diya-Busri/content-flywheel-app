import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { userSettingsTable } from "@/db/schema/user-settings-schema";
import { podProductsTable } from "@/db/schema/pod-products-schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { printifyFetch } from "@/lib/printify";

/**
 * GET /api/printify/product-images?productId=X
 *
 * Pulls the mockup images Printify generates for a synced product and saves
 * them to our DB as mockupUrls.  Printify renders professional photos
 * (lifestyle, flat-lay, folded, person wearing it, etc.) automatically after
 * a product is created — far better than AI generation.
 */
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

  try {
    const [settings] = await db
      .select({ printifyApiKey: userSettingsTable.printifyApiKey, printifyShopId: userSettingsTable.printifyShopId })
      .from(userSettingsTable)
      .where(eq(userSettingsTable.userId, userId))
      .limit(1);

    if (!settings?.printifyApiKey) {
      return NextResponse.json({ error: "Printify not connected" }, { status: 400 });
    }
    if (!settings.printifyShopId) {
      return NextResponse.json({ error: "No Printify shop found" }, { status: 400 });
    }

    const [product] = await db
      .select()
      .from(podProductsTable)
      .where(and(eq(podProductsTable.id, productId), eq(podProductsTable.userId, userId)))
      .limit(1);

    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    if (!product.printifyProductId) {
      return NextResponse.json({ error: "Sync to Printify first" }, { status: 400 });
    }

    // Fetch the product from Printify — it includes generated mockup images
    const printifyProduct = await printifyFetch(
      `/shops/${settings.printifyShopId}/products/${product.printifyProductId}.json`,
      settings.printifyApiKey
    ) as {
      images?: Array<{ src: string; position?: string; is_default?: boolean; variant_ids?: number[] }>;
    };

    const images = printifyProduct.images ?? [];
    if (images.length === 0) {
      return NextResponse.json({ mockupUrls: [], message: "No mockups generated yet — try again in a moment" });
    }

    // Group by position and pick one representative image per view type.
    // Prefer is_default images; fall back to first in group.
    // This gives us one clean image for each view (Front, Back, Person 1, Person 2, etc.)
    const byPosition = new Map<string, typeof images[number]>();
    for (const img of images) {
      if (!img.src) continue;
      const pos = img.position ?? "unknown";
      const existing = byPosition.get(pos);
      if (!existing || img.is_default) {
        byPosition.set(pos, img);
      }
    }

    // Order: front first, then back variants, then person/lifestyle, then everything else
    const POSITION_ORDER = ["front", "back", "back_2", "folded", "front_collar_closeup",
      "person_1", "person_2", "person_3", "person_4", "person_5", "person_6",
      "person_7", "person_8", "person_9", "person_10"];
    const sorted = [...byPosition.entries()].sort(([a], [b]) => {
      const ai = POSITION_ORDER.indexOf(a);
      const bi = POSITION_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    const mockupUrls: string[] = sorted.map(([, img]) => img.src);

    // Save back to our DB so they persist
    await db
      .update(podProductsTable)
      .set({ mockupUrls })
      .where(and(eq(podProductsTable.id, productId), eq(podProductsTable.userId, userId)));

    return NextResponse.json({ mockupUrls });
  } catch (err) {
    console.error("[printify/product-images] GET:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch mockups" },
      { status: 500 }
    );
  }
}
