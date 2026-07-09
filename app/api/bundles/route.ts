import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productBundlesTable } from "@/db/schema/product-bundles-schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET — list creator's bundles
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bundles = await db
    .select()
    .from(productBundlesTable)
    .where(eq(productBundlesTable.creatorUserId, userId))
    .orderBy(productBundlesTable.createdAt);

  return NextResponse.json(bundles);
}

// POST — create a new bundle
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { title, description, bundlePrice, productIds } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!bundlePrice || bundlePrice < 100) {
    return NextResponse.json({ error: "Bundle price must be at least £1.00" }, { status: 400 });
  }
  if (!Array.isArray(productIds) || productIds.length < 2) {
    return NextResponse.json({ error: "Select at least 2 products" }, { status: 400 });
  }

  const [created] = await db
    .insert(productBundlesTable)
    .values({
      creatorUserId: userId,
      title: title.trim(),
      description: description?.trim() ?? null,
      bundlePrice: Math.round(bundlePrice),
      productIds,
      active: true,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
