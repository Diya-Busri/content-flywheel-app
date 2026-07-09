import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Shield, Users } from "lucide-react";
import {
  getConversationMessages,
  getConversationById,
  getConversationParticipants,
} from "@/db/queries/messaging-queries";
import { ConversationView } from "@/components/messaging/conversation-view";

export const dynamic = "force-dynamic";

export default async function AcademyConversationPage({
  params,
}: {
  params: { conversationId: string };
}) {
  const { userId } = await auth();
  if (!userId) return redirect("/sign-in");

  const messages = await getConversationMessages(params.conversationId, userId);
  if (messages === null) return notFound();

  const conversation = await getConversationById(params.conversationId);
  if (!conversation) return notFound();

  const participants = await getConversationParticipants(params.conversationId);
  const other = participants.find((p) => p.userId !== userId) ?? null;
  const isSupport = conversation.conversationType === "support";
  const isGroup = conversation.conversationType === "group";
  const title = isSupport
    ? "Content Flywheel Support"
    : isGroup
      ? conversation.groupName ?? "Group chat"
      : other?.userEmail ?? "Conversation";

  const user = await currentUser();
  const currentUserEmail = user?.emailAddresses?.[0]?.emailAddress ?? null;

  return (
    <div className="mx-auto flex h-[calc(100dvh-7rem)] w-full max-w-3xl flex-col px-0 md:px-4">
      <div className="flex items-center gap-3 border-b bg-background px-4 py-3">
        <Link
          href="/dashboard/academy/messages"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {isSupport && <Shield className="h-5 w-5 text-primary" />}
        {isGroup && <Users className="h-5 w-5 text-primary" />}
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{title}</p>
          {isSupport && <p className="text-[11px] text-muted-foreground">Support</p>}
          {isGroup && (
            <p className="text-[11px] text-muted-foreground">
              {participants.length} {participants.length === 1 ? "member" : "members"}
            </p>
          )}
        </div>
      </div>

      <ConversationView
        conversationId={params.conversationId}
        currentUserId={userId}
        initialMessages={messages.map((m) => ({
          id: m.id,
          senderId: m.senderId,
          senderEmail: m.senderEmail,
          content: m.content,
          isAdminMessage: m.isAdminMessage,
          createdAt: new Date(m.createdAt).toISOString(),
        }))}
        otherUserEmail={other?.userEmail}
        isSupport={isSupport}
        isGroup={isGroup}
        groupName={conversation.groupName}
        groupMemberCount={participants.length}
        currentUserEmail={currentUserEmail}
        backUrl="/dashboard/academy/messages"
      />
    </div>
  );
}
