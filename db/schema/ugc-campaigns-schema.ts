import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";

export type ProjectType = "affiliate" | "brand";
export type ProductRole = "primary" | "comparison";

/** UGC Lab campaigns — multi-product support. */
export const ugcCampaignsTable = pgTable("ugc_campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  projectType: text("project_type").$type<ProjectType>().notNull(),
  campaignName: text("campaign_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Products within a campaign. */
export const ugcCampaignProductsTable = pgTable("ugc_campaign_products", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id").notNull().references(() => ugcCampaignsTable.id, { onDelete: "cascade" }),
  productName: text("product_name").notNull(),
  productLink: text("product_link"),
  role: text("role").$type<ProductRole>().notNull().default("primary"),
  orderIndex: integer("order_index").notNull().default(0),
});
