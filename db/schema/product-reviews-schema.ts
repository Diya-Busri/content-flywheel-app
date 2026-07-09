import { pgTable, text, timestamp, uuid, integer, boolean } from "drizzle-orm/pg-core";

export const productReviewsTable = pgTable("product_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: text("product_id").notNull(),
  creatorUserId: text("creator_user_id").notNull(),
  buyerEmail: text("buyer_email").notNull(),
  buyerName: text("buyer_name"),
  rating: integer("rating").notNull().default(5),
  reviewText: text("review_text"),
  approved: boolean("approved").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertProductReview = typeof productReviewsTable.$inferInsert;
export type SelectProductReview = typeof productReviewsTable.$inferSelect;
