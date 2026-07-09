"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { startDirectConversationAction } from "@/actions/messaging-actions";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function MemberCard({
  userId,
  userEmail,
  displayName,
  postCount,
  currentUserId,
}: {
  userId: string;
  userEmail: string;
  displayName?: string | null;
  postCount: number;
  currentUserId?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isSelf = !!currentUserId && userId === currentUserId;

  async function handleMessage() {
    if (loading || isSelf) return;
    setLoading(true);
    const res = await startDirectConversationAction(userEmail);
    setLoading(false);
    if (res.isSuccess && res.data) {
      router.push(`/dashboard/academy/messages/${res.data.id}`);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
        {initials(displayName || userEmail)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{displayName || userEmail}</p>
        {displayName && <p className="truncate text-xs text-muted-foreground">{userEmail}</p>}
        <p className="text-xs text-muted-foreground">
          {postCount} {postCount === 1 ? "post" : "posts"}
        </p>
      </div>
      {!isSelf && (
        <button
          type="button"
          onClick={handleMessage}
          disabled={loading}
          className="flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-60"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {loading ? "…" : "Message"}
        </button>
      )}
    </div>
  );
}
