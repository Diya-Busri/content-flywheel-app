import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";

export const creatorEmailSettingsTable = pgTable("creator_email_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().unique(),
  leadMagnetProductId: text("lead_magnet_product_id"),  // product ID to gift on subscribe
  leadMagnetEnabled: boolean("lead_magnet_enabled").notNull().default(false),
  subscribePageTitle: text("subscribe_page_title"),     // custom headline on subscribe page
  subscribePageDescription: text("subscribe_page_description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertCreatorEmailSettings = typeof creatorEmailSettingsTable.$inferInsert;
export type SelectCreatorEmailSettings = typeof creatorEmailSettingsTable.$inferSelect;
