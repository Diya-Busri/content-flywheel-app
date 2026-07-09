import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Tracks which users follow which creators.
 * One row per (followerId, followedId) pair — enforced by unique index.
 */
export const creatorFollowsTable = pgTable(
  "creator_follows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Clerk user ID of the follower. */
    followerId: text("follower_id").notNull(),
    /** Clerk user ID of the creator being followed. */
    followedId: text("followed_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueFollowerFollowed: uniqueIndex("creator_follows_follower_followed_idx").on(
      table.followerId,
      table.followedId
    ),
  })
);

export type InsertCreatorFollow = typeof creatorFollowsTable.$inferInsert;
export type SelectCreatorFollow = typeof creatorFollowsTable.$inferSelect;
