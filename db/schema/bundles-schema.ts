import { pgTable, text, uuid, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export type ContentAssets = {
  generatedAt: string;
  topic: string;
  mainCaption: { tiktok: string; instagram: string };
  hooks: string[];
  ctaSuggestions: string[];
  hashtagSets: {
    broad: string[];
    niche: string[];
    lowCompetition: string[];
  };
  platformVariants: {
    tiktok: string;
    instagram: string;
    threads: string;
    twitter: string;
  };
};

export const contentBundlesTable = pgTable("content_bundles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull().default("Untitled Bundle"),
  style: text("style").notNull().default("minimal-luxury"),
  slideCount: integer("slide_count").notNull().default(0),
  coverPreviewUrl: text("cover_preview_url"),
  assets: jsonb("assets").$type<ContentAssets>(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SelectBundle = typeof contentBundlesTable.$inferSelect;
export type InsertBundle = typeof contentBundlesTable.$inferInsert;
