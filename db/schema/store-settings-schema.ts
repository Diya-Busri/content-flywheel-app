import { pgTable, uuid, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const storeSettingsTable = pgTable("store_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().unique(),
  // Theme
  theme: text("theme").notNull().default("warm"), // warm | dark | light | minimal | bold
  accentColor: text("accent_color").notNull().default("#f97316"),
  // Layout
  layout: text("layout").notNull().default("grid"), // grid | list | featured
  // Branding
  bannerImageUrl: text("banner_image_url"),
  bannerGradient: text("banner_gradient"), // e.g. "135deg, #f97316, #ea580c"
  profileImageUrl: text("profile_image_url"),
  bio: text("bio"),
  // Display options
  showSocialLinks: boolean("show_social_links").default(false),
  socialLinks: text("social_links"), // JSON string of {twitter, instagram, youtube, tiktok}
  // Tax / VAT
  vatEnabled: boolean("vat_enabled").default(false),
  vatRate: integer("vat_rate").default(20), // percentage e.g. 20 for 20%
  vatNumber: text("vat_number"),
  businessName: text("business_name"),
  businessAddress: text("business_address"),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertStoreSettings = typeof storeSettingsTable.$inferInsert;
export type SelectStoreSettings = typeof storeSettingsTable.$inferSelect;
