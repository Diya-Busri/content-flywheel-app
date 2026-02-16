import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

export type LibraryStatus = "draft" | "published" | "needs_review";

export const scriptsTable = pgTable("scripts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  platform: text("platform").notNull(),
  status: text("status").$type<LibraryStatus>().default("draft").notNull(),
  videoId: text("video_id"),
  productId: text("product_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const videosTable = pgTable("videos", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  platforms: jsonb("platforms").$type<string[]>().default([]).notNull(),
  status: text("status").$type<LibraryStatus>().default("draft").notNull(),
  productId: text("product_id"),
  scriptId: text("script_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** TikTok Shop generated videos: one row per generated video. */
export const tiktokShopVideosTable = pgTable("tiktok_shop_videos", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  productLink: text("product_link").notNull(),
  videoUrl: text("video_url").notNull(),
  videoStyle: text("video_style").notNull(),
  platform: text("platform").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Async render jobs: create job, process in background, poll for status. */
export const renderJobsTable = pgTable("render_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  status: text("status").notNull().default("pending"), // pending | processing | completed | failed
  videoUrl: text("video_url"),
  error: text("error"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
