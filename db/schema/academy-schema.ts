import { pgTable, text, boolean, integer, timestamp, uuid } from "drizzle-orm/pg-core";

export const academyCoursesTable = pgTable("academy_courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  difficulty: text("difficulty").default("beginner"), // beginner/intermediate/advanced
  estimatedDuration: text("estimated_duration"),
  isPublished: boolean("is_published").default(false).notNull(),
  status: text("status").default("draft").notNull(), // draft | published | archived
  slug: text("slug"), // SEO-friendly URL slug
  category: text("category"), // e.g. "Digital Products", "Marketing", "Business"
  isFeatured: boolean("is_featured").default(false).notNull(),
  learningOutcomes: text("learning_outcomes"), // JSON array of strings
  coverImageUrl: text("cover_image_url"),
  orderIndex: integer("order_index").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const academyModulesTable = pgTable("academy_modules", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id").notNull().references(() => academyCoursesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const academyLessonsTable = pgTable("academy_lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  moduleId: uuid("module_id").notNull().references(() => academyModulesTable.id, { onDelete: "cascade" }),
  courseId: uuid("course_id").notNull().references(() => academyCoursesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content"), // JSON-stringified Block[] (see lib/academy-blocks.ts); legacy rows may hold plain text/markdown
  videoUrl: text("video_url"), // legacy YouTube URL (superseded by video blocks in content)
  lessonType: text("lesson_type").default("video"), // video/text/mixed
  orderIndex: integer("order_index").default(0).notNull(),
  isPublished: boolean("is_published").default(true).notNull(),
  durationMinutes: integer("duration_minutes"),
  /** Short label for the action CTA button shown at lesson end (e.g. "Generate My Niche"). */
  ctaLabel: text("cta_label"),
  /** Internal route or URL the action CTA opens (e.g. "/dashboard/digital-products/discover"). */
  ctaRoute: text("cta_route"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const academyResourcesTable = pgTable("academy_resources", {
  id: uuid("id").primaryKey().defaultRandom(),
  lessonId: uuid("lesson_id").notNull().references(() => academyLessonsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  url: text("url").notNull(),
  fileType: text("file_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const academyProgressTable = pgTable("academy_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  lessonId: uuid("lesson_id").notNull().references(() => academyLessonsTable.id, { onDelete: "cascade" }),
  courseId: uuid("course_id").notNull().references(() => academyCoursesTable.id, { onDelete: "cascade" }),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
});

export const academyCommunityPostsTable = pgTable("academy_community_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  userEmail: text("user_email"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").default("general").notNull(), // questions/wins/feedback/product_showcase/marketing/general/admin
  imageUrls: text("image_urls"), // JSON array string
  isPinned: boolean("is_pinned").default(false).notNull(),
  isFeatured: boolean("is_featured").default(false).notNull(),
  isLocked: boolean("is_locked").default(false).notNull(),
  isAnnouncement: boolean("is_announcement").default(false).notNull(),
  scheduledFor: timestamp("scheduled_for"), // for scheduled announcements
  likesCount: integer("likes_count").default(0).notNull(),
  commentsCount: integer("comments_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const academyCommunityCommentsTable = pgTable("academy_community_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id").notNull().references(() => academyCommunityPostsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  userEmail: text("user_email"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const academyCommunityLikesTable = pgTable("academy_community_likes", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id").notNull().references(() => academyCommunityPostsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertAcademyCourse = typeof academyCoursesTable.$inferInsert;
export type SelectAcademyCourse = typeof academyCoursesTable.$inferSelect;
export type InsertAcademyModule = typeof academyModulesTable.$inferInsert;
export type SelectAcademyModule = typeof academyModulesTable.$inferSelect;
export type InsertAcademyLesson = typeof academyLessonsTable.$inferInsert;
export type SelectAcademyLesson = typeof academyLessonsTable.$inferSelect;
export type InsertAcademyResource = typeof academyResourcesTable.$inferInsert;
export type SelectAcademyResource = typeof academyResourcesTable.$inferSelect;
export type InsertAcademyProgress = typeof academyProgressTable.$inferInsert;
export type SelectAcademyProgress = typeof academyProgressTable.$inferSelect;
export type InsertAcademyCommunityPost = typeof academyCommunityPostsTable.$inferInsert;
export type SelectAcademyCommunityPost = typeof academyCommunityPostsTable.$inferSelect;
export type InsertAcademyCommunityComment = typeof academyCommunityCommentsTable.$inferInsert;
export type SelectAcademyCommunityComment = typeof academyCommunityCommentsTable.$inferSelect;
