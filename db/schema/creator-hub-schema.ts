import { pgTable, uuid, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

/**
 * Creator Hub — the public creator page (`/c/[userId]`) is built from an
 * ordered list of blocks. The profile identity (banner, avatar, name, bio,
 * follow/subscribe buttons) is fixed at the top of the page; everything
 * below is a reorderable, toggleable block managed here. The store
 * (products + bundles) is just one block type among several — it is no
 * longer the entire page.
 *
 * Section `type` is one of:
 *   "featured_product"   — spotlight a single product
 *   "products"           — the store grid/list (existing product+bundle render)
 *   "social_links"       — social icon row
 *   "featured_content"   — embedded YouTube/TikTok/Instagram posts
 *   "newsletter"         — email signup CTA
 *   "currently_building" — "what I'm working on" freeform text
 *   "custom"             — freeform title/body/links block, creator-defined
 *
 * `config` holds type-specific data (see lib/creator-hub.ts for shapes).
 * Built-in section rows are seeded once per creator on first access; a
 * creator can add any number of "custom" rows.
 */
export const profileSectionsTable = pgTable("profile_sections", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(), // see union above
  order: integer("order").notNull().default(0),
  visible: boolean("visible").notNull().default(true),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertProfileSection = typeof profileSectionsTable.$inferInsert;
export type SelectProfileSection = typeof profileSectionsTable.$inferSelect;
