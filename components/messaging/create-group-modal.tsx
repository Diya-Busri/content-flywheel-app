"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createGroupChatAction } from "@/actions/messaging-actions";

export function CreateGroupModal({
  baseUrl = "/dashboard/academy/messages",
  trigger,
}: {
  baseUrl?: string;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function addEmail() {
    const e = emailInput.trim().toLowerCase();
    if (!e) return;
    if (emails.includes(e)) {
      setEmailInput("");
      return;
    }
    setEmails((prev) => [...prev, e]);
    setEmailInput("");
  }

  function removeEmail(e: string) {
    setEmails((prev) => prev.filter((x) => x !== e));
  }

  async function handleSubmit() {
    setError(null);
    if (!groupName.trim()) {
      setError("Enter a group name");
      return;
    }
    const finalEmails = [...emails];
    const pending = emailInput.trim().toLowerCase();
    if (pending && !finalEmails.includes(pending)) finalEmails.push(pending);
    if (finalEmails.length === 0) {
      setError("Add at least one member");
      return;
    }
    setLoading(true);
    const res = await createGroupChatAction(groupName.trim(), finalEmails);
    setLoading(false);
    if (!res.isSuccess || !res.data) {
      setError(res.message || "Could not create group");
      return;
    }
    setOpen(false);
    setGroupName("");
    setEmails([]);
    setEmailInput("");
    router.push(`${baseUrl}/${res.data.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="gap-1.5">
            <Users className="h-4 w-4" /> New Group
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Group Chat</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Group name</label>
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Q1 Launch Crew"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Add members</label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addEmail();
                  }
                }}
                placeholder="user@example.com"
              />
              <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={addEmail}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {emails.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {emails.map((e) => (
                  <span
                    key={e}
                    className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground"
                  >
                    {e}
                    <button type="button" onClick={() => removeEmail(e)} aria-label={`Remove ${e}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Creating…" : "Create Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
