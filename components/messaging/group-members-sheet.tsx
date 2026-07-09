"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Users, UserPlus, LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addGroupMemberAction, leaveGroupAction } from "@/actions/messaging-actions";

interface Member {
  userId: string;
  userEmail: string | null;
}

export function GroupMembersSheet({
  conversationId,
  currentUserId,
}: {
  conversationId: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages/conversations/${conversationId}/members`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.members)) setMembers(data.members);
    } catch {
      /* ignore */
    }
  }, [conversationId]);

  useEffect(() => {
    if (open) loadMembers();
  }, [open, loadMembers]);

  async function handleAdd() {
    setError(null);
    if (!email.trim()) return;
    setBusy(true);
    const res = await addGroupMemberAction(conversationId, email.trim());
    setBusy(false);
    if (!res.isSuccess) {
      setError(res.message || "Could not add member");
      return;
    }
    setEmail("");
    loadMembers();
  }

  async function handleLeave() {
    setBusy(true);
    const res = await leaveGroupAction(conversationId);
    setBusy(false);
    if (res.isSuccess) {
      setOpen(false);
      router.push("/dashboard/academy/messages");
    } else {
      setError(res.message || "Could not leave group");
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 px-2 text-xs">
          <Users className="h-3.5 w-3.5" /> Members
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-sm">
        <SheetHeader>
          <SheetTitle>Group Members</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-1.5">
          {members.map((m) => (
            <div
              key={m.userId}
              className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                {(m.userEmail ?? "?").slice(0, 2).toUpperCase()}
              </div>
              <span className="truncate">{m.userEmail ?? m.userId}</span>
              {m.userId === currentUserId && (
                <span className="ml-auto text-[10px] text-muted-foreground">You</span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Add member by email</label>
          <div className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="user@example.com"
            />
            <Button size="icon" onClick={handleAdd} disabled={busy} className="shrink-0">
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="mt-6 border-t pt-4">
          <Button variant="outline" className="w-full gap-2 text-red-500" onClick={handleLeave} disabled={busy}>
            <LogOut className="h-4 w-4" /> Leave group
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
