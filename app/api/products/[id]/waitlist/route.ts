import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { productWaitlistsTable } from "@/db/schema/product-waitlists-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;

  const [product] = await db
    .select({ id: productsTable.id, userId: productsTable.userId })
    .from(productsTable)
    .where(and(eq(productsTable.id, productId), isNull(productsTable.deletedAt)))
    .limit(1);

  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
  const name = typeof body.name === "string" ? body.name.trim() : null;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  await db
    .insert(productWaitlistsTable)
    .values({ productId, creatorUserId: product.userId, email, name })
    .onConflictDoNothing()
    .catch(() => null);

  return NextResponse.json({ success: true });
}

// GET — creator: view waitlist for a product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;

  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await db
    .select()
    .from(productWaitlistsTable)
    .where(and(eq(productWaitlistsTable.productId, productId), eq(productWaitlistsTable.creatorUserId, userId)))
    .orderBy(productWaitlistsTable.createdAt);

  return NextResponse.json(entries);
}
