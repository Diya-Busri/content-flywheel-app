import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

/** Cached niche suggestions to avoid calling OpenAI on every Pick Your Niche visit. */
export const nicheCacheTable = pgTable("niche_cache", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Cache key: "trending" for generic trending niches, or custom key for interest-based later. */
  cacheKey: text("cache_key").notNull().default("trending"),
  /** JSON array of NicheOption. */
  niches: jsonb("niches").$type<unknown[]>().notNull(),
  refreshedAt: timestamp("refreshed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
