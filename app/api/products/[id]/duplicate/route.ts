export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const [original] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, id), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));

    if (!original) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const originalAssets = (original.marketingAssets ?? {}) as Record<string, unknown>;
    const clonedAssets = { ...originalAssets, isNativePublished: false, stripePriceId: undefined, stripeProductId: undefined, checkoutUrl: undefined };

    const [inserted] = await db
      .insert(productsTable)
      .values({
        userId,
        title: `${original.title} (Copy)`,
        niche: original.niche,
        format: original.format,
        content: original.content,
        designSettings: original.designSettings,
        marketingAssets: clonedAssets,
        placedElements: original.placedElements,
        pageBackgrounds: original.pageBackgrounds,
      })
      .returning({ id: productsTable.id });

    return NextResponse.json({ id: inserted.id });
  } catch (err) {
    console.error("[duplicate]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
