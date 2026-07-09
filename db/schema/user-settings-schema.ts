import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const userSettingsTable = pgTable("user_settings", {
  userId: text("user_id").primaryKey().notNull(),
  displayName: text("display_name"),
  openaiApiKey: text("openai_api_key"),
  shotstackApiKey: text("shotstack_api_key"),
  defaultProductType: text("default_product_type").notNull().default("digital_product"),
  defaultVideoStyle: text("default_video_style").notNull().default("professional"),
  printifyApiKey: text("printify_api_key"),
  printifyShopId: text("printify_shop_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type InsertUserSettings = typeof userSettingsTable.$inferInsert;
export type SelectUserSettings = typeof userSettingsTable.$inferSelect;
