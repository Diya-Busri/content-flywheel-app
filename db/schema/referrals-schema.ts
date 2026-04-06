import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const referralsTable = pgTable("referrals", {
  id: uuid("id").defaultRandom().primaryKey(),
  referrerUserId: text("referrer_user_id").notNull(),
  referredUserId: text("referred_user_id").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
