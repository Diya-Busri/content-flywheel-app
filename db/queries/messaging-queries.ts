import { db } from "@/db/db";
import {
  conversationsTable,
  conversationParticipantsTable,
  messagesTable,
  communityReportsTable,
  InsertCommunityReport,
  SelectConversation,
  SelectMessage,
  SelectCommunityReport,
} from "@/db/schema/messaging-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { and, asc, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";

export const SUPPORT_USER_ID = "support";

/* --------------------------- Helpers --------------------------- */

async function getParticipantConversationIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ conversationId: conversationParticipantsTable.conversationId })
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, userId));
  return rows.map((r) => r.conversationId);
}

export async function isParticipant(conversationId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: conversationParticipantsTable.id })
    .from(conversationParticipantsTable)
    .where(
      and(
        eq(conversationParticipantsTable.conversationId, conversationId),
        eq(conversationParticipantsTable.userId, userId)
      )
    )
    .limit(1);
  return rows.length > 0;
}

/* --------------------------- Support --------------------------- */

export async function getOrCreateSupportConversation(
  userId: string,
  userEmail?: string | null
): Promise<SelectConversation> {
  // Find an existing support conversation where this user is a participant.
  const existing = await db
    .select({ conv: conversationsTable })
    .from(conversationsTable)
    .innerJoin(
      conversationParticipantsTable,
      eq(conversationParticipantsTable.conversationId, conversationsTable.id)
    )
    .where(
      and(
        eq(conversationsTable.conversationType, "support"),
        eq(conversationParticipantsTable.userId, userId)
      )
    )
    .limit(1);

  if (existing[0]) return existing[0].conv;

  const [conv] = await db
    .insert(conversationsTable)
    .values({ conversationType: "support" })
    .returning();

  await db.insert(conversationParticipantsTable).values([
    { conversationId: conv.id, userId, userEmail: userEmail ?? null },
    { conversationId: conv.id, userId: SUPPORT_USER_ID, userEmail: "support" },
  ]);

  return conv;
}

/* --------------------------- Direct --------------------------- */

export async function findOrCreateDirectConversation(
  userIdA: string,
  userIdB: string,
  emailA?: string | null,
  emailB?: string | null
): Promise<SelectConversation> {
  // Find a direct conversation in which both users participate.
  const aConvs = await getParticipantConversationIds(userIdA);
  if (aConvs.length > 0) {
    const shared = await db
      .select({ conv: conversationsTable })
      .from(conversationsTable)
      .innerJoin(
        conversationParticipantsTable,
        eq(conversationParticipantsTable.conversationId, conversationsTable.id)
      )
      .where(
        and(
          eq(conversationsTable.conversationType, "direct"),
          inArray(conversationsTable.id, aConvs),
          eq(conversationParticipantsTable.userId, userIdB)
        )
      )
      .limit(1);
    if (shared[0]) return shared[0].conv;
  }

  const [conv] = await db
    .insert(conversationsTable)
    .values({ conversationType: "direct" })
    .returning();

  await db.insert(conversationParticipantsTable).values([
    { conversationId: conv.id, userId: userIdA, userEmail: emailA ?? null },
    { conversationId: conv.id, userId: userIdB, userEmail: emailB ?? null },
  ]);

  return conv;
}

/* --------------------------- Groups --------------------------- */

// Create a group conversation. Looks up member profiles by email; emails with no
// matching profile are silently skipped. The creator is always a participant.
export async function createGroupConversation(
  creatorUserId: string,
  creatorEmail: string | null,
  memberEmails: string[],
  groupName: string
): Promise<SelectConversation> {
  const [conv] = await db
    .insert(conversationsTable)
    .values({
      conversationType: "group",
      groupName,
      createdByUserId: creatorUserId,
    })
    .returning();

  const normalized = Array.from(
    new Set(
      memberEmails
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e && e !== (creatorEmail ?? "").trim().toLowerCase())
    )
  );

  const profiles = normalized.length
    ? await db
        .select({ userId: profilesTable.userId, email: profilesTable.email })
        .from(profilesTable)
        .where(inArray(sql`lower(${profilesTable.email})`, normalized))
    : [];

  const participantValues = [
    { conversationId: conv.id, userId: creatorUserId, userEmail: creatorEmail ?? null },
    ...profiles.map((p) => ({
      conversationId: conv.id,
      userId: p.userId,
      userEmail: p.email ?? null,
    })),
  ];

  // De-dupe by userId in case a member email resolves to the creator.
  const seen = new Set<string>();
  const unique = participantValues.filter((p) => {
    if (seen.has(p.userId)) return false;
    seen.add(p.userId);
    return true;
  });

  await db.insert(conversationParticipantsTable).values(unique);
  return conv;
}

export async function addGroupMember(
  conversationId: string,
  userId: string,
  userEmail: string | null
): Promise<void> {
  if (await isParticipant(conversationId, userId)) return;
  await db
    .insert(conversationParticipantsTable)
    .values({ conversationId, userId, userEmail });
}

export async function removeGroupMember(conversationId: string, userId: string): Promise<void> {
  await db
    .delete(conversationParticipantsTable)
    .where(
      and(
        eq(conversationParticipantsTable.conversationId, conversationId),
        eq(conversationParticipantsTable.userId, userId)
      )
    );
}

export async function getGroupMembers(conversationId: string) {
  return getConversationParticipants(conversationId);
}

/* --------------------------- Lists --------------------------- */

export type ConversationSummary = SelectConversation & {
  otherUserId: string | null;
  otherUserEmail: string | null;
  groupName: string | null;
  unreadCount: number;
};

export async function getUserConversations(userId: string): Promise<ConversationSummary[]> {
  const convIds = await getParticipantConversationIds(userId);
  if (convIds.length === 0) return [];

  const convs = await db
    .select()
    .from(conversationsTable)
    .where(inArray(conversationsTable.id, convIds))
    .orderBy(desc(conversationsTable.lastMessageAt));

  // Load all participants for these conversations
  const participants = await db
    .select()
    .from(conversationParticipantsTable)
    .where(inArray(conversationParticipantsTable.conversationId, convIds));

  const summaries: ConversationSummary[] = [];
  for (const conv of convs) {
    const parts = participants.filter((p) => p.conversationId === conv.id);
    const me = parts.find((p) => p.userId === userId);
    const isGroup = conv.conversationType === "group";
    // For groups there is no single "other" participant.
    const other = isGroup ? null : parts.find((p) => p.userId !== userId) ?? null;

    // unread = messages after my lastReadAt that I didn't send
    const lastReadAt = me?.lastReadAt ?? null;
    const unreadRows = await db
      .select({ c: sql<number>`count(*)` })
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.conversationId, conv.id),
          ne(messagesTable.senderId, userId),
          lastReadAt ? gt(messagesTable.createdAt, lastReadAt) : sql`true`
        )
      );
    const unreadCount = Number(unreadRows[0]?.c ?? 0);

    summaries.push({
      ...conv,
      otherUserId: other?.userId ?? null,
      otherUserEmail: isGroup ? null : other?.userEmail ?? null,
      groupName: conv.groupName ?? null,
      unreadCount,
    });
  }
  return summaries;
}

/* --------------------------- Messages --------------------------- */

export async function getConversationMessages(
  conversationId: string,
  requestingUserId: string
): Promise<SelectMessage[] | null> {
  // PRIVACY CHECK: only participants can read.
  const allowed = await isParticipant(conversationId, requestingUserId);
  if (!allowed) return null;

  return db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conversationId))
    .orderBy(asc(messagesTable.createdAt));
}

export async function getConversationById(conversationId: string): Promise<SelectConversation | undefined> {
  const rows = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, conversationId))
    .limit(1);
  return rows[0];
}

export async function getConversationParticipants(conversationId: string) {
  return db
    .select()
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.conversationId, conversationId));
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  senderEmail: string | null,
  content: string,
  isAdminMessage = false
): Promise<SelectMessage> {
  const [msg] = await db
    .insert(messagesTable)
    .values({ conversationId, senderId, senderEmail, content, isAdminMessage })
    .returning();

  const preview = content.length > 140 ? `${content.slice(0, 140)}…` : content;
  await db
    .update(conversationsTable)
    .set({ lastMessageAt: new Date(), lastMessagePreview: preview })
    .where(eq(conversationsTable.id, conversationId));

  return msg;
}

export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  await db
    .update(conversationParticipantsTable)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(conversationParticipantsTable.conversationId, conversationId),
        eq(conversationParticipantsTable.userId, userId)
      )
    );
}

export async function getUnreadCount(userId: string): Promise<number> {
  const parts = await db
    .select()
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, userId));
  if (parts.length === 0) return 0;

  let total = 0;
  for (const p of parts) {
    const rows = await db
      .select({ c: sql<number>`count(*)` })
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.conversationId, p.conversationId),
          ne(messagesTable.senderId, userId),
          p.lastReadAt ? gt(messagesTable.createdAt, p.lastReadAt) : sql`true`
        )
      );
    total += Number(rows[0]?.c ?? 0);
  }
  return total;
}

/* --------------------------- Admin Support Inbox --------------------------- */

export type SupportConversationSummary = SelectConversation & {
  userId: string | null;
  userEmail: string | null;
};

export async function getAllSupportConversations(): Promise<SupportConversationSummary[]> {
  const convs = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.conversationType, "support"))
    .orderBy(desc(conversationsTable.lastMessageAt));

  if (convs.length === 0) return [];

  const ids = convs.map((c) => c.id);
  const parts = await db
    .select()
    .from(conversationParticipantsTable)
    .where(
      and(
        inArray(conversationParticipantsTable.conversationId, ids),
        ne(conversationParticipantsTable.userId, SUPPORT_USER_ID)
      )
    );

  return convs.map((conv) => {
    const p = parts.find((x) => x.conversationId === conv.id);
    return { ...conv, userId: p?.userId ?? null, userEmail: p?.userEmail ?? null };
  });
}

/* --------------------------- Reports --------------------------- */

export async function createReport(data: InsertCommunityReport): Promise<SelectCommunityReport> {
  const [row] = await db.insert(communityReportsTable).values(data).returning();
  return row;
}

export async function getReports(status?: string): Promise<SelectCommunityReport[]> {
  if (status) {
    return db
      .select()
      .from(communityReportsTable)
      .where(eq(communityReportsTable.status, status))
      .orderBy(desc(communityReportsTable.createdAt));
  }
  return db.select().from(communityReportsTable).orderBy(desc(communityReportsTable.createdAt));
}

export async function updateReportStatus(reportId: string, status: string): Promise<SelectCommunityReport> {
  const [row] = await db
    .update(communityReportsTable)
    .set({ status, reviewedByAdmin: true, reviewedAt: new Date() })
    .where(eq(communityReportsTable.id, reportId))
    .returning();
  return row;
}
