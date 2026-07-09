import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Face profiles for UGC Lab — reusable across projects. */
export const faceProfilesTable = pgTable("face_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
