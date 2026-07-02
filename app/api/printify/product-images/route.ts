export const dynamic = "force-dynamic";
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
      variants?: Array<{ id: number; title?: string; is_enabled: boolean }>;
    };

    const images = printifyProduct.images ?? [];
    if (images.length === 0) {
      return NextResponse.json({ mockupUrls: [], message: "No mockups generated yet — try again in a moment" });
    }

    // Build variant ID → colour name map from Printify variant titles ("Black / S" → "black")
    const variantColourMap: Record<number, string> = {};
    for (const v of printifyProduct.variants ?? []) {
      const colour = (v.title ?? "").split("/")[0].trim().toLowerCase();
      if (colour) variantColourMap[v.id] = colour;
    }

    // Build per-colour image sets: each image has variant_ids — map to colours
    const imagesByColour: Record<string, string[]> = {};
    for (const img of images) {
      if (!img.src) continue;
      const colours = new Set<string>();
      for (const vid of img.variant_ids ?? []) {
        const colour = variantColourMap[vid];
        if (colour) colours.add(colour);
      }
      for (const colour of Array.from(colours)) {
        if (!imagesByColour[colour]) imagesByColour[colour] = [];
        if (!imagesByColour[colour]!.includes(img.src)) {
          imagesByColour[colour]!.push(img.src);
        }
      }
    }

    // Strategy: Printify stores one image per (variant × view type). With many colour variants
    // this creates hundreds of images — mostly duplicates of the same view in different colours.
    //
    // Best approach: use is_selected_for_publishing images (Printify's curated showcase set),
    // then fall back to is_default images, then fall back to the first-enabled-variant images.
    // This gives the clean set Printify itself picks (typically 6-12 key views).
    const selectedImages = images.filter((i) => i.src && i.is_selected_for_publishing);
    const defaultImages = images.filter((i) => i.src && i.is_default);

    let candidateImages: typeof images;

    if (selectedImages.length >= 3) {
      candidateImages = selectedImages;
    } else if (defaultImages.length >= 3) {
      candidateImages = defaultImages;
    } else {
      // Fall back: images for the first enabled variant
      const firstEnabledVariant = printifyProduct.variants?.find((v) => v.is_enabled) ?? printifyProduct.variants?.[0];
      const defaultVariantId = firstEnabledVariant?.id;
      if (defaultVariantId !== undefined) {
        const variantImages = images.filter(
          (i) => i.src && Array.isArray(i.variant_ids) && i.variant_ids.includes(defaultVariantId)
        );
        candidateImages = variantImages.length > 0 ? variantImages : images.filter((i) => i.src);
      } else {
        candidateImages = images.filter((i) => i.src);
      }
    }

    // URL dedup
    const seen = new Set<string>();
    const mockupUrls: string[] = [];
    for (const img of candidateImages) {
      if (!seen.has(img.src)) { seen.add(img.src); mockupUrls.push(img.src); }
    }

    // Save back to our DB so they persist
    await db
      .update(podProductsTable)
      .set({ mockupUrls })
      .where(and(eq(podProductsTable.id, productId), eq(podProductsTable.userId, userId)));

    // Return both the default set AND per-colour map (colour map not persisted — client holds it in state)
    return NextResponse.json({ mockupUrls, imagesByColour });
  } catch (err) {
    console.error("[printify/product-images] GET:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch mockups" },
      { status: 500 }
    );
  }
}
