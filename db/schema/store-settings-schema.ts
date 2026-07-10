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
  bannerImagePosition: text("banner_image_position").default("center 40%"), // CSS object-position
  profileImageUrl: text("profile_image_url"),
  bio: text("bio"),
  // Identity
  storeName: text("store_name"), // Override display name (falls back to brand name)
  tagline: text("tagline"),      // Short line under store name
  // Display options
  showSocialLinks: boolean("show_social_links").default(false),
  socialLinks: text("social_links"), // JSON string of {twitter, instagram, youtube, tiktok, linkedin, website}
  // Announcement bar
  announcementText: text("announcement_text"), // null = hidden
  announcementColor: text("announcement_color").default("#f97316"),
  // Storefront behaviour
  buttonText: text("button_text").default("Subscribe for updates"),
  fontFamily: text("font_family").default("inter"), // inter | poppins | playfair | montserrat | dm-sans
  productSort: text("product_sort").default("newest"), // newest | oldest | price-asc | price-desc
  showTrustBadges: boolean("show_trust_badges").default(true),
  showSalesCount: boolean("show_sales_count").default(false), // opt-in: show public sales count on marketplace
  // Custom domain (e.g. "store.mysite.com" — creator adds a CNAME to this platform)
  customDomain: text("custom_domain"),
  customDomainActive: boolean("custom_domain_active").notNull().default(false), // unlocked via £9.99 one-time purchase
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
