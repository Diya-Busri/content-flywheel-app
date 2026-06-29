import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import Link from "next/link";
import { getUserConversations } from "@/db/queries/messaging-queries";
import { ConversationList, ConversationListItem } from "@/components/messaging/conversation-list";
import { NewDmModal } from "@/components/messaging/new-dm-modal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages | Academy" };

export default async function AcademyMessagesPage() {
  const { userId } = await auth();
  if (!userId) return redirect("/sign-in");

  const conversations = await getUserConversations(userId);

  const directs: ConversationListItem[] = conversations
    .filter((c) => c.conversationType !== "support")
    .map((c) => ({
      id: c.id,
      conversationType: c.conversationType,
      otherUserEmail: c.otherUserEmail,
      lastMessagePreview: c.lastMessagePreview,
      lastMessageAt: c.lastMessageAt ? new Date(c.lastMessageAt).toISOString() : null,
      unreadCount: c.unreadCount,
    }));

  const supportConv = conversations.find((c) => c.conversationType === "support");
  const supportUnread = supportConv?.unreadCount ?? 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Messages</h2>
        <NewDmModal baseUrl="/dashboard/academy/messages" />

      </div>

      <Link
        href="/dashboard/academy/messages/support"
        className="mb-5 flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Shield className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">Message Support</p>
          <p className="text-xs text-muted-foreground">Get help from the Content Flywheel team</p>
        </div>
        {supportUnread > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
            {supportUnread}
          </span>
        )}
      </Link>

      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Direct Messages
      </h3>
      <ConversationList conversations={directs} basePath="/dashboard/academy/messages" />
    </div>
  );
}
