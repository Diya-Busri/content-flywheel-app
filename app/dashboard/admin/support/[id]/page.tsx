import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Shield } from "lucide-react";
import { isAdmin } from "@/lib/is-admin";
import {
  getConversationById,
  getConversationParticipants,
  SUPPORT_USER_ID,
} from "@/db/queries/messaging-queries";
import { db } from "@/db/db";
import { messagesTable } from "@/db/schema/messaging-schema";
import { asc, eq } from "drizzle-orm";
import { ConversationView } from "@/components/messaging/conversation-view";

export const dynamic = "force-dynamic";

export default async function AdminSupportConversationPage({
  params,
}: {
  params: { id: string };
}) {
  if (!(await isAdmin())) return redirect("/dashboard");

  const conversation = await getConversationById(params.id);
  if (!conversation || conversation.conversationType !== "support") return notFound();

  const participants = await getConversationParticipants(params.id);
  const user = participants.find((p) => p.userId !== SUPPORT_USER_ID) ?? null;

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, params.id))
    .orderBy(asc(messagesTable.createdAt));

  return (
    <div className="mx-auto flex h-[calc(100dvh-3rem)] w-full max-w-3xl flex-col px-0 md:px-4">
      <div className="flex items-center gap-3 border-b bg-background px-4 py-3">
        <Link href="/dashboard/admin/support" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Shield className="h-5 w-5 text-primary" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{user?.userEmail ?? "User"}</p>
          <p className="text-[11px] text-muted-foreground">Support conversation</p>
        </div>
      </div>

      <ConversationView
        conversationId={params.id}
        currentUserId={SUPPORT_USER_ID}
        asAdmin
        isSupport
        fetchPath={`/api/admin/support/${params.id}`}
        initialMessages={messages.map((m) => ({
          id: m.id,
          senderId: m.senderId,
          senderEmail: m.senderEmail,
          content: m.content,
          isAdminMessage: m.isAdminMessage,
          createdAt: new Date(m.createdAt).toISOString(),
        }))}
      />
    </div>
  );
}
