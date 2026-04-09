import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { productReviewsTable } from "@/db/schema/product-reviews-schema";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";

// GET — public: fetch approved reviews for a product
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;

  const reviews = await db
    .select({
      id: productReviewsTable.id,
      buyerName: productReviewsTable.buyerName,
      rating: productReviewsTable.rating,
      reviewText: productReviewsTable.reviewText,
      createdAt: productReviewsTable.createdAt,
    })
    .from(productReviewsTable)
    .where(and(eq(productReviewsTable.productId, productId), eq(productReviewsTable.approved, true)))
    .orderBy(productReviewsTable.createdAt);

  return NextResponse.json(reviews);
}

// POST — verified buyer submits a review
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;

  const body = await request.json().catch(() => ({}));
  const { email, name, rating, reviewText } = body;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be 1–5" }, { status: 400 });
  }

  // Verify buyer has actually purchased this product
  const [order] = await db
    .select({ id: productOrdersTable.id, creatorUserId: productOrdersTable.creatorUserId })
    .from(productOrdersTable)
    .where(
      and(
        eq(productOrdersTable.productId, productId),
        eq(productOrdersTable.buyerEmail, email.toLowerCase().trim()),
        eq(productOrdersTable.status, "completed")
      )
    )
    .limit(1);

  if (!order) {
    return NextResponse.json({ error: "Only verified buyers can leave a review" }, { status: 403 });
  }

  // Check if they've already reviewed
  const [existing] = await db
    .select({ id: productReviewsTable.id })
    .from(productReviewsTable)
    .where(and(eq(productReviewsTable.productId, productId), eq(productReviewsTable.buyerEmail, email.toLowerCase().trim())))
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: "You've already left a review for this product" }, { status: 409 });
  }

  const [review] = await db
    .insert(productReviewsTable)
    .values({
      productId,
      creatorUserId: order.creatorUserId,
      buyerEmail: email.toLowerCase().trim(),
      buyerName: name?.trim() || null,
      rating: Math.round(rating),
      reviewText: reviewText?.trim() || null,
      approved: true,
    })
    .returning();

  return NextResponse.json(review, { status: 201 });
}
