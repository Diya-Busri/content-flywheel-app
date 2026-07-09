import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { productReviewsTable } from "@/db/schema/product-reviews-schema";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { eq, and } from "drizzle-orm";
import { notificationsTable } from "@/db/schema/notifications-schema";
import { recomputeTrustScore, logReputationEvent } from "@/lib/trust-score-helpers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, rating, reviewText, buyerName } = body;

    if (!orderId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Validate order exists and is completed
    const [order] = await db
      .select({
        id: productOrdersTable.id,
        productId: productOrdersTable.productId,
        creatorUserId: productOrdersTable.creatorUserId,
        buyerEmail: productOrdersTable.buyerEmail,
        status: productOrdersTable.status,
      })
      .from(productOrdersTable)
      .where(and(eq(productOrdersTable.id, orderId), eq(productOrdersTable.status, "completed")))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Check if review already exists
    const [existing] = await db
      .select({ id: productReviewsTable.id })
      .from(productReviewsTable)
      .where(eq(productReviewsTable.buyerEmail, order.buyerEmail))
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: "Review already submitted" }, { status: 409 });
    }

    await db.insert(productReviewsTable).values({
      productId: order.productId,
      creatorUserId: order.creatorUserId,
      buyerEmail: order.buyerEmail,
      buyerName: buyerName || null,
      rating: parseInt(rating),
      reviewText: reviewText || null,
      approved: false,
    });

    // Notify creator of new review
    try {
      const stars = "★".repeat(parseInt(rating)) + "☆".repeat(5 - parseInt(rating));
      await db.insert(notificationsTable).values({
        userId: order.creatorUserId,
        title: `New ${rating}-star review`,
        message: `${buyerName || order.buyerEmail} left a review ${stars}${reviewText ? `: "${reviewText.slice(0, 80)}${reviewText.length > 80 ? "…" : ""}"` : ""}`,
        type: parseInt(rating) >= 4 ? "success" : "warning",
        read: false,
        linkUrl: "/dashboard/reviews",
        metadata: { kind: "review", rating, buyerName: buyerName || null, buyerEmail: order.buyerEmail },
      });
    } catch { /* non-fatal */ }

    // Recalculate Trust Score when a new review comes in
    logReputationEvent({
      userId: order.creatorUserId,
      eventType: "review_added",
      description: `New ${rating}-star review received.`,
      metadata: { rating, productId: order.productId },
    }).catch(() => {});
    recomputeTrustScore(order.creatorUserId, "review_added").catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Review submit error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
