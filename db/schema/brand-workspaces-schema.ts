import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";

/**
 * Brand workspaces for Campaign Mode. One workspace per brand; can be private (password-protected).
 * user_id is Clerk user id.
 * brand_type: clothing | digital | both
 */
export const brandWorkspacesTable = pgTable("brand_workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  brandName: text("brand_name").notNull(),
  brandType: text("brand_type").notNull(), // clothing | digital | both
  aestheticVibe: text("aesthetic_vibe"),
  niche: text("niche"),
  targetAudience: text("target_audience"),
  platform: text("platform"),
  colourPrimary: text("colour_primary"),
  colourSecondary: text("colour_secondary"),
  isPrivate: boolean("is_private").default(false).notNull(),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertBrandWorkspace = typeof brandWorkspacesTable.$inferInsert;
export type SelectBrandWorkspace = typeof brandWorkspacesTable.$inferSelect;
