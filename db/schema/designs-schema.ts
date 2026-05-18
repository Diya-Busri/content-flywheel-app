import { pgTable, text, timestamp, jsonb, uuid, integer } from "drizzle-orm/pg-core";

export type DesignElement = {
  id: string;
  type: "text" | "image" | "shape";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  zIndex?: number;
  flipX?: boolean;
  flipY?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowX?: number;
  shadowY?: number;
  letterSpacing?: number;
  lineHeight?: number;
  // text
  content?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  textBackground?: string;
  textAlign?: string;
  // image
  imageUrl?: string;
  objectFit?: string;
  blur?: number;
  // shape
  shapeType?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
};

export type DesignData = {
  width: number;
  height: number;
  background: string;
  backgroundType?: "solid" | "gradient" | "pattern";
  backgroundGradient?: { color1: string; color2: string; angle: number };
  backgroundImage?: string;
  backgroundImageFit?: "cover" | "contain";
  backgroundImageBlur?: number;
  backgroundImageOverlayColor?: string;
  backgroundImageOverlayOpacity?: number;
  activePalette?: string[];
  elements: DesignElement[];
  presetName?: string;
};

export const designsTable = pgTable("designs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull().default("Untitled Design"),
  data: jsonb("data").$type<DesignData>().notNull(),
  previewUrl: text("preview_url"),
  bundleId: uuid("bundle_id"),
  slideIndex: integer("slide_index"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertDesign = typeof designsTable.$inferInsert;
export type SelectDesign = typeof designsTable.$inferSelect;
