import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { userSettingsTable } from "@/db/schema/user-settings-schema";
import { podProductsTable } from "@/db/schema/pod-products-schema";
import { eq, isNull, and, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { printifyFetch } from "@/lib/printify";
import { alertPrintifyError } from "@/lib/printify-alert";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const products = await db
      .select()
      .from(podProductsTable)
      .where(and(eq(podProductsTable.userId, userId), isNull(podProductsTable.deletedAt)))
      .orderBy(desc(podProductsTable.createdAt));

    return NextResponse.json({ products });
  } catch (err) {
    console.error("[printify/products] GET:", err);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      title,
      designFileUrl,
      designFileName,
      blueprintId,
      blueprintTitle,
      blueprintImageUrl,
      printProviderId,
      printProviderTitle,
      placements,
    } = body;

    if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });

    const [product] = await db
      .insert(podProductsTable)
      .values({
        userId,
        title: title.trim(),
        designFileUrl: designFileUrl ?? null,
        designFileName: designFileName ?? null,
        blueprintId: blueprintId ?? null,
        blueprintTitle: blueprintTitle ?? null,
        blueprintImageUrl: blueprintImageUrl ?? null,
        printProviderId: printProviderId ?? null,
        printProviderTitle: printProviderTitle ?? null,
        placements: placements ?? [],
        status: "draft",
        printifyStatus: "draft",
      })
      .returning();

    return NextResponse.json({ product });
  } catch (err) {
    console.error("[printify/products] POST:", err);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}

/** PATCH — sync product to Printify */
export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let parsedProductId: string | undefined;
  try {
    const body = await req.json() as {
      productId: string;
      variants?: Array<{ id: number; price: number; enabled: boolean }>;
      // New: all placement images at once
      placementImages?: Array<{ position: string; printifyImageId: string }>;
      // Legacy: single front image (backward compat)
      printifyImageId?: string;
    };
    const { productId, variants, placementImages, printifyImageId } = body;
    parsedProductId = productId;

    const [settings] = await db
      .select({ printifyApiKey: userSettingsTable.printifyApiKey, printifyShopId: userSettingsTable.printifyShopId })
      .from(userSettingsTable)
      .where(eq(userSettingsTable.userId, userId))
      .limit(1);

    if (!settings?.printifyApiKey) {
      return NextResponse.json({ error: "Printify not connected. Add your API key in Settings." }, { status: 400 });
    }

    // Resolve shop ID — auto-heal if it was never saved
    let resolvedShopId = settings.printifyShopId ?? null;
    if (!resolvedShopId) {
      try {
        const shops = await printifyFetch("/shops.json", settings.printifyApiKey) as Array<{ id: number | string }>;
        const firstShopId = shops?.[0]?.id ? String(shops[0].id) : null;
        if (firstShopId) {
          await db.update(userSettingsTable).set({ printifyShopId: firstShopId }).where(eq(userSettingsTable.userId, userId));
          resolvedShopId = firstShopId;
        }
      } catch { /* continue — will fail with clearer error below */ }
    }

    if (!resolvedShopId) {
      return NextResponse.json({ error: "No Printify shop found. Make sure you have a shop in your Printify account." }, { status: 400 });
    }

    const [localProduct] = await db
      .select()
      .from(podProductsTable)
      .where(and(eq(podProductsTable.id, productId), eq(podProductsTable.userId, userId)))
      .limit(1);

    if (!localProduct) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    if (!localProduct.designFileUrl) return NextResponse.json({ error: "Upload a design first" }, { status: 400 });

    // Save variants to DB immediately (even if Printify sync fails later, variants are preserved)
    if (variants && variants.length > 0) {
      await db.update(podProductsTable)
        .set({ variants: variants as typeof localProduct.variants })
        .where(and(eq(podProductsTable.id, productId), eq(podProductsTable.userId, userId)));
    }

    // Build Printify product payload
    const variantList = (
      Array.isArray(variants) && variants.length > 0 ? variants : localProduct.variants ?? []
    ) as Array<{ id: number; price: number; enabled: boolean }>;
    if (variantList.length === 0) {
      return NextResponse.json({ error: "No variants found. Open the product wizard and complete the Variants step first." }, { status: 400 });
    }
    const enabledVariantIds = variantList.filter((v) => v.enabled !== false).map((v) => v.id);

    const printifyPayload: Record<string, unknown> = {
      title: localProduct.title,
      blueprint_id: localProduct.blueprintId,
      print_provider_id: localProduct.printProviderId,
      variants: variantList.map((v) => ({
        id: v.id,
        price: v.price ?? 2000, // default £20.00 in pence
        is_enabled: v.enabled !== false,
      })),
      print_areas: [
        {
          variant_ids: enabledVariantIds,
          placeholders: (() => {
            // Build placeholders from all placements that have an image.
            // Only include positions Printify accepts as standard placeholder positions.
            // "label"/"inside_label" requires a separate print_areas entry — skip for now.
            const VALID_PRINTIFY_POSITIONS = new Set(["front", "back", "left_sleeve", "right_sleeve", "sleeve_left", "sleeve_right"]);
            const allImages: Array<{ position: string; printifyImageId: string }> = (
              placementImages && placementImages.length > 0
                ? placementImages
                : printifyImageId
                ? [{ position: "front", printifyImageId }]
                : []
            ).filter(({ position }) => VALID_PRINTIFY_POSITIONS.has(position));

            if (allImages.length === 0) {
              // No images provided — include empty front placeholder so Printify accepts the payload
              return [{ position: "front", images: [] }];
            }

            return allImages.map(({ position, printifyImageId: imgId }) => ({
              position,
              images: [{ id: imgId, x: 0.5, y: 0.5, scale: 1, angle: 0 }],
            }));
          })(),
        },
      ],
    };

    let printifyProductId = localProduct.printifyProductId;

    if (printifyProductId) {
      // Update existing Printify product
      await printifyFetch(
        `/shops/${resolvedShopId}/products/${printifyProductId}.json`,
        settings.printifyApiKey,
        { method: "PUT", body: JSON.stringify(printifyPayload) }
      );
    } else {
      // Create new Printify product
      const created = await printifyFetch(
        `/shops/${resolvedShopId}/products.json`,
        settings.printifyApiKey,
        { method: "POST", body: JSON.stringify(printifyPayload) }
      );
      printifyProductId = created.id;
    }

    // Auto-fetch Printify's generated mockup images straight after sync
    let printifyMockupUrls: string[] = [];
    try {
      const printifyProduct = await printifyFetch(
        `/shops/${resolvedShopId}/products/${printifyProductId}.json`,
        settings.printifyApiKey
      ) as { images?: Array<{ src: string }> };
      const seen = new Set<string>();
      for (const img of printifyProduct.images ?? []) {
        if (img.src && !seen.has(img.src)) {
          seen.add(img.src);
          printifyMockupUrls.push(img.src);
        }
      }
    } catch {
      // Non-fatal — mockups can be fetched later via /api/printify/product-images
    }

    await db
      .update(podProductsTable)
      .set({
        printifyProductId,
        printifyStatus: "synced",
        printifyLastSyncedAt: new Date(),
        variants: (variants ?? localProduct.variants) as typeof localProduct.variants,
        ...(printifyMockupUrls.length > 0 ? { mockupUrls: printifyMockupUrls } : {}),
      })
      .where(and(eq(podProductsTable.id, productId), eq(podProductsTable.userId, userId)));

    return NextResponse.json({ success: true, printifyProductId, mockupUrls: printifyMockupUrls });
  } catch (err) {
    console.error("[printify/products] PATCH:", err);
    await alertPrintifyError({ route: "/api/printify/products PATCH", message: err instanceof Error ? err.message : "Sync failed", userId, metadata: { productId: parsedProductId } });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 500 });
  }
}
