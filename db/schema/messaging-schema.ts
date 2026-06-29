import { pgTable, text, boolean, timestamp, uuid } from "drizzle-orm/pg-core";

// A conversation is between participants.
// conversationType: 'direct' | 'support'
// 'support' conversations are user↔admin support chat, visible in admin inbox
// 'direct' conversations are private user↔user, NOT visible to admin
export const conversationsTable = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationType: text("conversation_type").notNull().default("direct"), // 'direct' | 'support' | 'group'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  lastMessagePreview: text("last_message_preview"),
  // Group chat fields — null for DMs/support, set for 'group' conversations.
  groupName: text("group_name"),
  groupDescription: text("group_description"),
  groupAvatarUrl: text("group_avatar_url"),
  createdByUserId: text("created_by_user_id"),
});

// Who is in each conversation (2 participants for DM, can be extended for groups)
export const conversationParticipantsTable = pgTable("conversation_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(), // Clerk user ID, or 'support' for the support account
  userEmail: text("user_email"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  lastReadAt: timestamp("last_read_at"),
});

export const messagesTable = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  senderId: text("sender_id").notNull(), // Clerk user ID or 'support'
  senderEmail: text("sender_email"),
  content: text("content").notNull(),
  isAdminMessage: boolean("is_admin_message").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Future: fileUrl, voiceNoteUrl, etc.
});

// Community post reports
export const communityReportsTable = pgTable("community_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportedByUserId: text("reported_by_user_id").notNull(),
  postId: uuid("post_id"), // references academy_community_posts
  commentId: uuid("comment_id"), // references academy_community_comments
  reportedUserId: text("reported_user_id"),
  reason: text("reason").notNull(), // spam/harassment/inappropriate/misinformation/other
  details: text("details"),
  status: text("status").default("pending").notNull(), // pending/reviewed/dismissed/actioned
  reviewedByAdmin: boolean("reviewed_by_admin").default(false).notNull(),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertConversation = typeof conversationsTable.$inferInsert;
export type SelectConversation = typeof conversationsTable.$inferSelect;
export type InsertConversationParticipant = typeof conversationParticipantsTable.$inferInsert;
export type SelectConversationParticipant = typeof conversationParticipantsTable.$inferSelect;
export type InsertMessage = typeof messagesTable.$inferInsert;
export type SelectMessage = typeof messagesTable.$inferSelect;
export type InsertCommunityReport = typeof communityReportsTable.$inferInsert;
export type SelectCommunityReport = typeof communityReportsTable.$inferSelect;
