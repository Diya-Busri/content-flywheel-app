import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export type ConnectedPlatform = "tiktok" | "youtube" | "instagram" | "facebook";

export const connectedAccountsTable = pgTable(
  "connected_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    platform: text("platform").$type<ConnectedPlatform>().notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at"),
    scopes: text("scopes"), // comma-separated or JSON
    platformUserId: text("platform_user_id"),
    platformUsername: text("platform_username"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqUserPlatformUser: uniqueIndex("connected_accounts_user_platform_user").on(t.userId, t.platform, t.platformUserId),
  })
);

export type InsertConnectedAccount = typeof connectedAccountsTable.$inferInsert;
export type SelectConnectedAccount = typeof connectedAccountsTable.$inferSelect;
