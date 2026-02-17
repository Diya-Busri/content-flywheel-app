import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

export type MarketingAssets = {
  productTitle?: string;
  productDescription?: string;
  hashtags?: string[];
  seoKeywords?: string[];
  thumbnailUrl?: string | null;
  updatedAt?: string;
};

export const productsTable = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  niche: text("niche").notNull(),
  format: text("format").notNull(),
  content: jsonb("content").$type<{ sections: Array<{ id: string; title: string; content: string; order: number }> }>().notNull(),
  designSettings: jsonb("design_settings").$type<Record<string, unknown>>(),
  placedElements: jsonb("placed_elements").$type<unknown[]>(),
  /** Discovery customization (chapters, length, tone, format-specific options). Null for existing products before migration. */
  customizationOptions: jsonb("customization_options").$type<Record<string, unknown> | null>(),
  /** Marketing assets for marketplaces (Etsy, Gumroad, etc.): title, description, hashtags, seoKeywords, thumbnailUrl. */
  marketingAssets: jsonb("marketing_assets").$type<MarketingAssets | null>(),
  status: text("status").default("draft").notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
