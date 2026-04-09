import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { productReviewsTable } from "@/db/schema/product-reviews-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, desc } from "drizzle-orm";
import ReviewsClient from "./ReviewsClient";

export const metadata = { title: "Reviews | Content Flywheel" };

export default async function ReviewsPage() {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const reviews = await db
    .select({
      id: productReviewsTable.id,
      productId: productReviewsTable.productId,
      buyerName: productReviewsTable.buyerName,
      buyerEmail: productReviewsTable.buyerEmail,
      rating: productReviewsTable.rating,
      reviewText: productReviewsTable.reviewText,
      approved: productReviewsTable.approved,
      createdAt: productReviewsTable.createdAt,
      productTitle: productsTable.title,
    })
    .from(productReviewsTable)
    .leftJoin(productsTable, eq(productReviewsTable.productId, productsTable.id))
    .where(eq(productReviewsTable.creatorUserId, userId))
    .orderBy(desc(productReviewsTable.createdAt));

  return <ReviewsClient initialReviews={reviews} />;
}
