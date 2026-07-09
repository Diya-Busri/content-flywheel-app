"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Shield, Users } from "lucide-react";
import { messageTime } from "./message-time";

export interface ConversationListItem {
  id: string;
  conversationType: string;
  otherUserEmail: string | null;
  groupName: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

function initials(email: string | null): string {
  if (!email) return "?";
  return email.slice(0, 2).toUpperCase();
}

export function ConversationList({ conversations, basePath = "/dashboard/messages" }: {
  conversations: ConversationListItem[];
  basePath?: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = conversations.filter((c) =>
    (c.otherUserEmail ?? "").toLowerCase().includes(query.toLowerCase()) ||
    (c.groupName ?? "").toLowerCase().includes(query.toLowerCase()) ||
    (c.lastMessagePreview ?? "").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations…"
          className="w-full rounded-xl border bg-card py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          No conversations yet.
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((c) => {
            const isSupport = c.conversationType === "support";
            const isGroup = c.conversationType === "group";
            const title = isSupport
              ? "Content Flywheel Support"
              : isGroup
                ? c.groupName ?? "Group chat"
                : c.otherUserEmail ?? "Unknown user";
            return (
              <Link
                key={c.id}
                href={`${basePath}/${c.id}`}
                className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/50"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${isSupport || isGroup ? "bg-primary/10 text-primary" : "bg-muted text-foreground"}`}>
                  {isSupport ? <Shield className="h-5 w-5" /> : isGroup ? <Users className="h-5 w-5" /> : initials(c.otherUserEmail)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {title}
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
                {c.unreadCount > 0 && (
                  <span className="ml-1 flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {c.unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
