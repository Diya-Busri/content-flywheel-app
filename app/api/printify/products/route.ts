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
    let variantList = (
      Array.isArray(variants) && variants.length > 0 ? variants : localProduct.variants ?? []
    ) as Array<{ id: number; price: number; enabled: boolean }>;

    /** Fetch all valid variant IDs for this blueprint+print_provider from the Printify catalog */
    const fetchCatalogVariantList = async (): Promise<Array<{ id: number; price: number; enabled: boolean }> | null> => {
      if (!localProduct.blueprintId || !localProduct.printProviderId) return null;
      try {
        const catalogVariants = await printifyFetch(
          `/catalog/blueprints/${localProduct.blueprintId}/print_providers/${localProduct.printProviderId}/variants.json`,
          settings.printifyApiKey!
        ) as { variants?: Array<{ id: number; title?: string }> };
        if (catalogVariants.variants && catalogVariants.variants.length > 0) {
          return catalogVariants.variants.map((v) => ({ id: v.id, price: 2500, enabled: true }));
        }
      } catch { /* non-fatal */ }
      return null;
    };

    // Auto-fetch variants from Printify catalog if none are saved yet
    if (variantList.length === 0) {
      const fresh = await fetchCatalogVariantList();
      if (fresh) {
        variantList = fresh;
        await db.update(podProductsTable)
          .set({ variants: variantList as typeof localProduct.variants })
          .where(and(eq(podProductsTable.id, productId), eq(podProductsTable.userId, userId)));
      }
    }

    if (variantList.length === 0) {
      return NextResponse.json({ error: "No variants found. Open the product wizard and complete the Variants step first." }, { status: 400 });
    }
    // Printify requires ALL variant IDs in print_areas.variant_ids — is_enabled on each
    // variant controls availability for sale. Using only enabled IDs causes error 8251.
    const allVariantIds = variantList.map((v) => v.id);

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
          variant_ids: allVariantIds,
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

    /** Remap sleeve position names if Printify rejects them (some blueprints use sleeve_left/sleeve_right, others use left_sleeve/right_sleeve) */
    const remapSleevePositions = (payload: Record<string, unknown>): Record<string, unknown> => {
      const printAreas = payload.print_areas as Array<{ variant_ids: number[]; placeholders: Array<{ position: string; images: unknown[] }> }>;
      return {
        ...payload,
        print_areas: printAreas.map((pa) => ({
          ...pa,
          placeholders: pa.placeholders.map((ph) => ({
            ...ph,
            position:
              ph.position === "left_sleeve" ? "sleeve_left"
              : ph.position === "right_sleeve" ? "sleeve_right"
              : ph.position === "sleeve_left" ? "left_sleeve"
              : ph.position === "sleeve_right" ? "right_sleeve"
              : ph.position,
          })),
        })),
      };
    };

    /** Rebuild payload with fresh catalog variants — fixes stale IDs that cause error 8251 */
    const payloadWithFreshVariants = async (payload: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
      const fresh = await fetchCatalogVariantList();
      if (!fresh || fresh.length === 0) return null;
      // Preserve user-set prices where IDs overlap
      const priceMap = new Map(variantList.map((v) => [v.id, v.price]));
      const merged = fresh.map((v) => ({ id: v.id, price: priceMap.get(v.id) ?? 2500, enabled: true }));
      await db.update(podProductsTable)
        .set({ variants: merged as typeof localProduct.variants })
        .where(and(eq(podProductsTable.id, productId), eq(podProductsTable.userId, userId)));
      const freshIds = merged.map((v) => v.id);
      const printAreas = payload.print_areas as Array<{ variant_ids: number[]; placeholders: unknown[] }>;
      return {
        ...payload,
        variants: merged.map((v) => ({ id: v.id, price: v.price, is_enabled: true })),
        print_areas: printAreas.map((pa) => ({ ...pa, variant_ids: freshIds })),
      };
    };

    const printifySync = async (payload: Record<string, unknown>): Promise<string> => {
      const isPlaceholderError = (err: unknown) =>
        err instanceof Error && err.message.includes("422") && err.message.toLowerCase().includes("placeholder");
      const is8251Error = (err: unknown) =>
        err instanceof Error && err.message.includes("8251");

      const attempt = async (p: Record<string, unknown>, method: "POST" | "PUT", url: string): Promise<{ id?: string }> => {
        try {
          return await printifyFetch(url, settings.printifyApiKey!, { method, body: JSON.stringify(p) }) as { id?: string };
        } catch (err) {
          if (isPlaceholderError(err)) {
            return await printifyFetch(url, settings.printifyApiKey!, { method, body: JSON.stringify(remapSleevePositions(p)) }) as { id?: string };
          }
          if (is8251Error(err)) {
            // Stale variant IDs — re-fetch from catalog and retry once
            const freshPayload = await payloadWithFreshVariants(p);
            if (!freshPayload) throw err;
            try {
              return await printifyFetch(url, settings.printifyApiKey!, { method, body: JSON.stringify(freshPayload) }) as { id?: string };
            } catch (err2) {
              if (isPlaceholderError(err2)) {
                return await printifyFetch(url, settings.printifyApiKey!, { method, body: JSON.stringify(remapSleevePositions(freshPayload)) }) as { id?: string };
              }
              throw err2;
            }
          }
          throw err;
        }
      };

      if (printifyProductId) {
        await attempt(payload, "PUT", `/shops/${resolvedShopId}/products/${printifyProductId}.json`);
        return printifyProductId;
      } else {
        const created = await attempt(payload, "POST", `/shops/${resolvedShopId}/products.json`);
        return created.id!;
      }
    };

    printifyProductId = await printifySync(printifyPayload);

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
