import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productBundlesTable } from "@/db/schema/product-bundles-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, inArray, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET — public: fetch bundle + included products
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [bundle] = await db
    .select()
    .from(productBundlesTable)
    .where(and(eq(productBundlesTable.id, id), eq(productBundlesTable.active, true)))
    .limit(1);

  if (!bundle) {
    return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
  }

  // Fetch included products
  const products =
    bundle.productIds.length > 0
      ? await db
          .select({
            id: productsTable.id,
            title: productsTable.title,
            marketingAssets: productsTable.marketingAssets,
          })
          .from(productsTable)
          .where(
            and(
              inArray(productsTable.id, bundle.productIds),
              isNull(productsTable.deletedAt)
            )
          )
      : [];

  return NextResponse.json({ bundle, products });
}

// DELETE — creator only: deactivate bundle
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await db
    .update(productBundlesTable)
    .set({ active: false, updatedAt: new Date() })
    .where(
      and(
        eq(productBundlesTable.id, id),
        eq(productBundlesTable.creatorUserId, userId)
      )
    );

  return NextResponse.json({ success: true });
}
