import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { userSettingsTable } from "@/db/schema/user-settings-schema";
import { podProductsTable } from "@/db/schema/pod-products-schema";
import { eq, isNull, and, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { printifyFetch } from "@/lib/printify";

export async function GET() {
  const { userId } = auth();
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
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { title, designFileUrl, designFileName, blueprintId, blueprintTitle, printProviderId, printProviderTitle } = body;

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
        printProviderId: printProviderId ?? null,
        printProviderTitle: printProviderTitle ?? null,
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
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { productId, variants, printifyImageId } = await req.json();

    const [settings] = await db
      .select({ printifyApiKey: userSettingsTable.printifyApiKey, printifyShopId: userSettingsTable.printifyShopId })
      .from(userSettingsTable)
      .where(eq(userSettingsTable.userId, userId))
      .limit(1);

    if (!settings?.printifyApiKey || !settings?.printifyShopId) {
      return NextResponse.json({ error: "Printify not connected or no shop selected" }, { status: 400 });
    }

    const [localProduct] = await db
      .select()
      .from(podProductsTable)
      .where(and(eq(podProductsTable.id, productId), eq(podProductsTable.userId, userId)))
      .limit(1);

    if (!localProduct) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    if (!localProduct.designFileUrl) return NextResponse.json({ error: "Upload a design first" }, { status: 400 });

    // Build Printify product payload
    const variantList = (variants ?? localProduct.variants ?? []) as Array<{ id: number; price: number; enabled: boolean }>;
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
          placeholders: [
            {
              position: "front",
              images: printifyImageId
                ? [{ id: printifyImageId, x: 0.5, y: 0.5, scale: 1, angle: 0 }]
                : [],
            },
          ],
        },
      ],
    };

    let printifyProductId = localProduct.printifyProductId;

    if (printifyProductId) {
      // Update existing Printify product
      await printifyFetch(
        `/shops/${settings.printifyShopId}/products/${printifyProductId}.json`,
        settings.printifyApiKey,
        { method: "PUT", body: JSON.stringify(printifyPayload) }
      );
    } else {
      // Create new Printify product
      const created = await printifyFetch(
        `/shops/${settings.printifyShopId}/products.json`,
        settings.printifyApiKey,
        { method: "POST", body: JSON.stringify(printifyPayload) }
      );
      printifyProductId = created.id;
    }

    await db
      .update(podProductsTable)
      .set({
        printifyProductId,
        printifyStatus: "synced",
        printifyLastSyncedAt: new Date(),
        variants: variants ?? localProduct.variants,
      })
      .where(eq(podProductsTable.id, productId));

    return NextResponse.json({ success: true, printifyProductId });
  } catch (err) {
    console.error("[printify/products] PATCH:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 500 });
  }
}
