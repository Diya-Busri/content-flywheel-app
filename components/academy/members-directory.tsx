"use client";

import { useState } from "react";
import { Search, Users } from "lucide-react";
import { MemberCard } from "./member-card";

export interface DirectoryMember {
  userId: string;
  userEmail: string;
  displayName: string | null;
  postCount: number;
}

export function MembersDirectory({
  members,
  currentUserId,
}: {
  members: DirectoryMember[];
  currentUserId?: string | null;
}) {
  const [query, setQuery] = useState("");
  const q = query.toLowerCase();
  const filtered = members.filter((m) =>
    m.userEmail.toLowerCase().includes(q) ||
    (m.displayName ?? "").toLowerCase().includes(q)
  );

  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members…"
          className="w-full rounded-xl border bg-card py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">
          <Users className="mx-auto h-10 w-10 opacity-40" />
          <p className="mt-3">No members found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {filtered.map((m) => (
            <MemberCard
              key={m.userId}
              userId={m.userId}
              userEmail={m.userEmail}
              displayName={m.displayName}
              postCount={m.postCount}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
