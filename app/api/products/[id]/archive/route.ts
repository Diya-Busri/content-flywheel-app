export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import type { MarketingAssets } from "@/db/schema/products-schema";

/**
 * POST /api/products/[id]/archive
 * Archives a product — hides it from the library default view and marketplace.
 * Also unpublishes it from the native store (sets isNativePublished = false).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [product] = await db
    .select({ id: productsTable.id, userId: productsTable.userId, marketingAssets: productsTable.marketingAssets })
    .from(productsTable)
    .where(and(eq(productsTable.id, id), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)))
    .limit(1);

  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ma = (product.marketingAssets ?? {}) as MarketingAssets;
  const updatedAssets = { ...ma, isNativePublished: false };

  await db
    .update(productsTable)
    .set({ archivedAt: new Date(), marketingAssets: updatedAssets, updatedAt: new Date() })
    .where(and(eq(productsTable.id, id), eq(productsTable.userId, userId)));

  return NextResponse.json({ ok: true, archived: true });
}

/**
 * DELETE /api/products/[id]/archive
 * Unarchives a product — restores it to the library.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [product] = await db
    .select({ id: productsTable.id, userId: productsTable.userId })
    .from(productsTable)
    .where(and(eq(productsTable.id, id), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)))
    .limit(1);

  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db
    .update(productsTable)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(and(eq(productsTable.id, id), eq(productsTable.userId, userId)));

  return NextResponse.json({ ok: true, archived: false });
}
