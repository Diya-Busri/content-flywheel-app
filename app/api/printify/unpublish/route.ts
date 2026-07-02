export const dynamic = "force-dynamic";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { userSettingsTable } from "@/db/schema/user-settings-schema";
import { podProductsTable } from "@/db/schema/pod-products-schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { printifyFetch } from "@/lib/printify";

/** POST — unpublish (remove from store) a Printify product and mark as sold out */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { productId } = await req.json() as { productId: string };
    if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

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
      return NextResponse.json({ error: "Product not synced to Printify" }, { status: 400 });
    }

    // Unpublish from Printify store
    await printifyFetch(
      `/shops/${settings.printifyShopId}/products/${product.printifyProductId}/unpublish.json`,
      settings.printifyApiKey,
      { method: "POST" }
    );

    // Update local status to synced (no longer published/live)
    await db
      .update(podProductsTable)
      .set({ status: "draft", printifyStatus: "synced" })
      .where(and(eq(podProductsTable.id, productId), eq(podProductsTable.userId, userId)));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[printify/unpublish] POST:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unpublish failed" },
      { status: 500 }
    );
  }
}
