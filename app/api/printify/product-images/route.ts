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
      variants?: Array<{ id: number; is_enabled: boolean }>;
    };

    const images = printifyProduct.images ?? [];
    const variants = printifyProduct.variants ?? [];

    // Debug: log image/variant structure so we can understand the data shape
    console.log(`[printify/product-images] total images: ${images.length}, total variants: ${variants.length}`);
    console.log(`[printify/product-images] first 5 images:`, JSON.stringify(images.slice(0, 5).map((i) => ({
      src: i.src?.slice(-40),
      position: i.position,
      is_default: i.is_default,
      is_selected_for_publishing: i.is_selected_for_publishing,
      variant_ids_count: i.variant_ids?.length,
      first_variant_id: i.variant_ids?.[0],
    })), null, 2));
    console.log(`[printify/product-images] first 3 variants:`, JSON.stringify(variants.slice(0, 3)));

    if (images.length === 0) {
      return NextResponse.json({ mockupUrls: [], message: "No mockups generated yet — try again in a moment" });
    }

    const firstEnabledVariant = variants.find((v) => v.is_enabled) ?? variants[0];
    const defaultVariantId = firstEnabledVariant?.id;
    console.log(`[printify/product-images] defaultVariantId: ${defaultVariantId}`);

    let candidateImages = images.filter((i) => i.src);
    if (defaultVariantId !== undefined) {
      const variantImages = candidateImages.filter(
        (i) => Array.isArray(i.variant_ids) && i.variant_ids.includes(defaultVariantId)
      );
      console.log(`[printify/product-images] variantImages for id ${defaultVariantId}: ${variantImages.length}`);
      if (variantImages.length > 0) candidateImages = variantImages;
    }

    // URL dedup
    const seen = new Set<string>();
    const mockupUrls: string[] = [];
    for (const img of candidateImages) {
      if (!seen.has(img.src)) { seen.add(img.src); mockupUrls.push(img.src); }
    }
    console.log(`[printify/product-images] final mockupUrls count: ${mockupUrls.length}`);

    // DEBUG: return raw structure so we can inspect it (remove after debugging)
    const debugInfo = {
      totalImages: images.length,
      totalVariants: variants.length,
      firstVariantId: defaultVariantId,
      variantImagesCount: candidateImages.length,
      uniquePositions: [...new Set(images.map(i => i.position))],
      sampleImages: images.slice(0, 3).map(i => ({
        position: i.position,
        is_default: i.is_default,
        is_selected_for_publishing: i.is_selected_for_publishing,
        variant_ids_length: i.variant_ids?.length,
        first_variant_id: i.variant_ids?.[0],
      })),
    };
    console.log("[printify/product-images] DEBUG:", JSON.stringify(debugInfo));

    // Save back to our DB so they persist
    await db
      .update(podProductsTable)
      .set({ mockupUrls })
      .where(and(eq(podProductsTable.id, productId), eq(podProductsTable.userId, userId)));

    return NextResponse.json({ mockupUrls, _debug: debugInfo });
  } catch (err) {
    console.error("[printify/product-images] GET:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch mockups" },
      { status: 500 }
    );
  }
}
