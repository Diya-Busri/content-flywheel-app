"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { ActionResult } from "@/types/actions/actions-types";
import * as q from "@/db/queries/messaging-queries";
import { getProfileByEmail } from "@/db/queries/profiles-queries";
import { SUPPORT_USER_ID } from "@/db/queries/messaging-queries";
import { SelectConversation, SelectMessage } from "@/db/schema/messaging-schema";

function isAdminEmail(email: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  return !!adminEmail && email.trim().toLowerCase() === adminEmail;
}

async function requireUser(): Promise<{ userId: string; email: string }> {
  const { userId } = auth();
  if (!userId) throw new Error("Unauthorized");
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
  return { userId, email };
}

function ok<T>(data: T, message = "OK"): ActionResult<T> {
  return { isSuccess: true, message, data };
}
function fail<T>(error: unknown, fallback: string): ActionResult<T> {
  const msg = error instanceof Error ? error.message : fallback;
  return { isSuccess: false, message: msg };
}

/* ----------------------------- Messaging ----------------------------- */

export async function sendMessageAction(
  conversationId: string,
  content: string
): Promise<ActionResult<SelectMessage>> {
  try {
    const { userId, email } = await requireUser();
    const trimmed = content.trim();
    if (!trimmed) throw new Error("Message cannot be empty");
    if (!(await q.isParticipant(conversationId, userId))) throw new Error("Forbidden");

    const msg = await q.sendMessage(conversationId, userId, email, trimmed, false);
    revalidatePath(`/dashboard/messages/${conversationId}`);
    revalidatePath("/dashboard/messages");
    return ok(msg, "Message sent");
  } catch (e) {
    return fail(e, "Failed to send message");
  }
}

export async function startSupportConversationAction(): Promise<ActionResult<SelectConversation>> {
  try {
    const { userId, email } = await requireUser();
    const conv = await q.getOrCreateSupportConversation(userId, email);
    return ok(conv, "Support conversation ready");
  } catch (e) {
    return fail(e, "Failed to start support conversation");
  }
}

export async function startDirectConversationAction(
  targetEmail: string
): Promise<ActionResult<SelectConversation>> {
  try {
    const { userId, email } = await requireUser();
    const normalized = targetEmail.trim().toLowerCase();
    if (!normalized) throw new Error("Email required");
    if (normalized === email.trim().toLowerCase()) throw new Error("You cannot message yourself");

    // Try the normalized (lowercased) email first, then the raw input, since
    // stored emails may not be normalized to lowercase.
    const profile =
      (await getProfileByEmail(normalized)) ?? (await getProfileByEmail(targetEmail.trim()));
    if (!profile) throw new Error("User not found");

    const conv = await q.findOrCreateDirectConversation(
      userId,
      profile.userId,
      email,
      profile.email ?? normalized
    );
    revalidatePath("/dashboard/messages");
    return ok(conv, "Conversation ready");
  } catch (e) {
    return fail(e, "Failed to start conversation");
  }
}

export async function markReadAction(conversationId: string): Promise<ActionResult<null>> {
  try {
    const { userId } = await requireUser();
    if (!(await q.isParticipant(conversationId, userId))) throw new Error("Forbidden");
    await q.markConversationRead(conversationId, userId);
    return ok(null, "Marked read");
  } catch (e) {
    return fail(e, "Failed to mark read");
  }
}

export async function getUnreadCountAction(): Promise<ActionResult<number>> {
  try {
    const { userId } = await requireUser();
    const count = await q.getUnreadCount(userId);
    return ok(count);
  } catch (e) {
    return fail(e, "Failed to get unread count");
  }
}

/* ----------------------------- Admin Support ----------------------------- */

export async function adminSendSupportReplyAction(
  conversationId: string,
  content: string
): Promise<ActionResult<SelectMessage>> {
  try {
    const { email } = await requireUser();
    if (!isAdminEmail(email)) throw new Error("Forbidden");
    const trimmed = content.trim();
    if (!trimmed) throw new Error("Message cannot be empty");

    const conv = await q.getConversationById(conversationId);
    if (!conv || conv.conversationType !== "support") throw new Error("Not a support conversation");

    // Send as the literal 'support' sender so admin's Clerk id is never stored.
    const msg = await q.sendMessage(conversationId, SUPPORT_USER_ID, "support", trimmed, true);
    revalidatePath(`/dashboard/admin/support/${conversationId}`);
    revalidatePath("/dashboard/admin/support");
    return ok(msg, "Reply sent");
  } catch (e) {
    return fail(e, "Failed to send reply");
  }
}

/* ----------------------------- Reports ----------------------------- */

export async function reportPostAction(
  postId: string,
  reason: string,
  details?: string,
  reportedUserId?: string
): Promise<ActionResult<null>> {
  try {
    const { userId } = await requireUser();
    await q.createReport({ reportedByUserId: userId, postId, reason, details, reportedUserId });
    return ok(null, "Report submitted");
  } catch (e) {
    return fail(e, "Failed to submit report");
  }
}

export async function reportCommentAction(
  commentId: string,
  reason: string,
  details?: string,
  reportedUserId?: string
): Promise<ActionResult<null>> {
  try {
    const { userId } = await requireUser();
    await q.createReport({ reportedByUserId: userId, commentId, reason, details, reportedUserId });
    return ok(null, "Report submitted");
  } catch (e) {
    return fail(e, "Failed to submit report");
  }
}

export async function adminUpdateReportAction(
  reportId: string,
  status: string
): Promise<ActionResult<null>> {
  try {
    const { email } = await requireUser();
    if (!isAdminEmail(email)) throw new Error("Forbidden");
    await q.updateReportStatus(reportId, status);
    revalidatePath("/dashboard/admin/reports");
    return ok(null, "Report updated");
  } catch (e) {
    return fail(e, "Failed to update report");
  }
}
