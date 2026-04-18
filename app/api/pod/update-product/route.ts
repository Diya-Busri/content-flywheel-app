import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { podProductsTable } from "@/db/schema/pod-products-schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

/** PATCH — update specific product fields (e.g. blueprintImageUrl backfill, variant prices) */
export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json() as {
      productId: string;
      blueprintImageUrl?: string;
      variants?: Array<{ id: number; price: number; enabled?: boolean; title?: string }>;
    };
    const { productId, blueprintImageUrl, variants } = body;

    if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

    const updateFields: Record<string, unknown> = {};
    if (blueprintImageUrl !== undefined) updateFields.blueprintImageUrl = blueprintImageUrl;
    if (variants !== undefined) updateFields.variants = variants;

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    await db
      .update(podProductsTable)
      .set(updateFields)
      .where(and(eq(podProductsTable.id, productId), eq(podProductsTable.userId, userId)));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[pod/update-product] PATCH:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed" }, { status: 500 });
  }
}
