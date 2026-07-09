import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Brand voice settings per user (Clerk user_id). Used to inject voice/style
 * into AI prompts. One row per user.
 */
export const brandVoiceTable = pgTable("brand_voice", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  brandName: text("brand_name"),
  tone: text("tone"),
  targetAudience: text("target_audience"),
  writingStyle: text("writing_style"),
  examplePhrases: text("example_phrases"),
  platformFocus: text("platform_focus"),       // comma-separated e.g. "youtube,tiktok"
  postingFrequency: text("posting_frequency"), // "daily"|"few_times_week"|"weekly"|"less"
  audienceSize: text("audience_size"),         // "just_starting"|"small"|"growing"|"established"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type InsertBrandVoice = typeof brandVoiceTable.$inferInsert;
export type SelectBrandVoice = typeof brandVoiceTable.$inferSelect;
