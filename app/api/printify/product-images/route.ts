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
      images?: Array<{ src: string; position?: string; is_default?: boolean; is_selected_for_publishing?: boolean; variant_ids?: number[] }>;
    };

    const images = printifyProduct.images ?? [];
    if (images.length === 0) {
      return NextResponse.json({ mockupUrls: [], message: "No mockups generated yet — try again in a moment" });
    }

    // Products with many color variants have one image per (variant × view type) — potentially
    // hundreds of URLs. Use is_selected_for_publishing to get the curated set Printify shows
    // in their UI (Front, Back, Person 1, Person 2, etc.). Fall back to is_default if needed.
    const publishingImages = images.filter((i) => i.is_selected_for_publishing && i.src);
    const defaultImages = images.filter((i) => i.is_default && i.src);
    const candidateImages = publishingImages.length > 0 ? publishingImages
      : defaultImages.length > 0 ? defaultImages
      : images;

    const seen = new Set<string>();
    const mockupUrls: string[] = [];
    for (const img of candidateImages) {
      if (img.src && !seen.has(img.src)) {
        seen.add(img.src);
        mockupUrls.push(img.src);
      }
    }

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
