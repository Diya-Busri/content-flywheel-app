import { pgTable, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const podProductsTable = pgTable("pod_products", {
  id: text("id").primaryKey().notNull().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),

  // Design
  title: text("title").notNull(),
  designFileUrl: text("design_file_url"),      // uploaded PNG/SVG design
  designFileName: text("design_file_name"),

  // Product type from Printify catalog
  blueprintId: integer("blueprint_id"),         // Printify blueprint ID (e.g. 5 = t-shirt)
  blueprintTitle: text("blueprint_title"),       // e.g. "Unisex Staple T-Shirt"
  printProviderId: integer("print_provider_id"),
  printProviderTitle: text("print_provider_title"),

  // Multi-placement designs (back, sleeves, label — front is designFileUrl above)
  placements: jsonb("placements").$type<Array<{
    position: string;        // "back" | "left_sleeve" | "right_sleeve" | "label"
    designFileUrl: string;
    designFileName?: string;
  }>>().default([]),

  // AI Mockups (lifestyle photos of people wearing the product)
  mockupUrls: jsonb("mockup_urls").$type<string[]>().default([]),
  aiMockupPrompt: text("ai_mockup_prompt"),

  // Printify sync
  printifyProductId: text("printify_product_id"),
  printifyStatus: text("printify_status").default("draft"), // draft | synced | published | failed
  printifyLastSyncedAt: timestamp("printify_last_synced_at"),
  variants: jsonb("variants").$type<Array<{
    id: number;
    title: string;
    sku: string;
    price: number;
    enabled: boolean;
  }>>().default([]),

  // Status
  status: text("status").default("draft"), // draft | ready | published

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at"),
});

export type InsertPodProduct = typeof podProductsTable.$inferInsert;
export type SelectPodProduct = typeof podProductsTable.$inferSelect;
