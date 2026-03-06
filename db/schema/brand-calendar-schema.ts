import { pgTable, text, timestamp, uuid, jsonb, integer } from "drizzle-orm/pg-core";

export type BrandCalendarDay = {
  day: number;
  post_type?: string;
  concept?: string;
  text_overlay?: string;
  hook?: string;
};

/**
 * Brand Builder Content Calendar: saved weeks of 7-day content ideas.
 * user_id is Clerk user id; week_number is 1-4.
 */
export const brandCalendarTable = pgTable("brand_calendar", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  brandName: text("brand_name").notNull(),
  weekNumber: integer("week_number").notNull(),
  daysJson: jsonb("days_json").$type<BrandCalendarDay[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertBrandCalendar = typeof brandCalendarTable.$inferInsert;
export type SelectBrandCalendar = typeof brandCalendarTable.$inferSelect;
