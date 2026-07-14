import { pgTable, uuid, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const featureFlagsTable = pgTable("feature_flags", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  enabled: boolean("enabled").notNull().default(false),
  /** null = global (all users), set userId = per-user override */
  userId: text("user_id"),
  /**
   * Optional 0-100 gradual rollout, meaningful only on GLOBAL flags (userId
   * null) with enabled=true. When set, only a deterministic subset of that
   * size (hashed by userId+key — see lib/feature-flags.ts isInRollout) sees
   * the feature, instead of everyone. null = full rollout (existing
   * all-or-nothing behaviour, unchanged). A per-user flag always overrides
   * this regardless of rollout percentage.
   */
  rolloutPercentage: integer("rollout_percentage"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
