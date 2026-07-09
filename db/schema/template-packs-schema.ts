import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

export type TemplatePackSlide = {
  heading?: string;
  body?: string;
  bg_color?: string;
};

export type TemplatePackCaption = {
  caption?: string;
  hashtags?: string;
  alt_text?: string;
};

/**
 * Template packs for Template Studio: quotes, tips, affirmations, product_promo, tutorials.
 * user_id is Clerk user id.
 */
export const templatePacksTable = pgTable("template_packs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  packName: text("pack_name").notNull(),
  templateType: text("template_type").notNull(), // quotes | tips | affirmations | product_promo | tutorials
  niche: text("niche"),
  brandColourPrimary: text("brand_colour_primary"),
  brandColourSecondary: text("brand_colour_secondary"),
  fontStyle: text("font_style"),
  slidesJson: jsonb("slides_json").$type<TemplatePackSlide[]>(),
  captionsJson: jsonb("captions_json").$type<TemplatePackCaption[]>(),
  status: text("status").notNull(), // draft | complete
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertTemplatePack = typeof templatePacksTable.$inferInsert;
export type SelectTemplatePack = typeof templatePacksTable.$inferSelect;
