import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

/**
 * One row per user. Used by Auto-Design and back cover socials.
 */
export const brandProfilesTable = pgTable("brand_profiles", {
  userId: text("user_id").primaryKey().notNull(),
  brandName: text("brand_name"),
  nicheIndustry: text("niche_industry"),
  brandVoice: text("brand_voice"),
  tiktokUrl: text("tiktok_url"),
  instagramUrl: text("instagram_url"),
  youtubeUrl: text("youtube_url"),
  facebookUrl: text("facebook_url"),
  websiteUrl: text("website_url"),
  primaryColor: text("primary_color").notNull().default("#1a1a1a"),
  secondaryColor: text("secondary_color").notNull().default("#475569"),
  logoUrl: text("logo_url"),
  /** When true, Auto-Design uses "Let AI decide" by default; when false, uses "Use my brand colours". */
  preferAiColors: boolean("prefer_ai_colors").notNull().default(false),
  /** "match_product" = Pexels keyword from product niche/type; "random" = random aesthetic unrelated to niche. */
  coverBackgroundPreference: text("cover_background_preference").notNull().default("match_product"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type InsertBrandProfile = typeof brandProfilesTable.$inferInsert;
export type SelectBrandProfile = typeof brandProfilesTable.$inferSelect;
