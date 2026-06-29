import Link from "next/link";
import { Inbox, Shield } from "lucide-react";
import { isAdmin } from "@/lib/is-admin";
import { redirect } from "next/navigation";
import { getAllSupportConversations } from "@/db/queries/messaging-queries";
import { messageTime } from "@/components/messaging/message-time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Support Inbox | Admin" };

export default async function AdminSupportPage() {
  if (!(await isAdmin())) return redirect("/dashboard");
  const conversations = await getAllSupportConversations();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-foreground">
        <Inbox className="h-6 w-6 text-primary" /> Support Inbox
      </h1>
      <p className="mb-5 text-sm text-muted-foreground">
        All user support conversations. Replies are sent as Content Flywheel Support.
      </p>

      {conversations.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          No support conversations yet.
        </div>
      ) : (
        <div className="space-y-1.5">
          {conversations.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/admin/support/${c.id}`}
              className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Shield className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {c.userEmail ?? c.userId ?? "Unknown user"}
                  </span>
                  {c.lastMessageAt && (
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                      {messageTime(c.lastMessageAt)}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {c.lastMessagePreview ?? "No messages yet"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
