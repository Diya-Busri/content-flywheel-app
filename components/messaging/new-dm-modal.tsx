"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { startDirectConversationAction } from "@/actions/messaging-actions";

export function NewDmModal({ baseUrl = "/dashboard/messages" }: { baseUrl?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!email.trim()) {
      setError("Enter an email address");
      return;
    }
    setLoading(true);
    const res = await startDirectConversationAction(email);
    setLoading(false);
    if (!res.isSuccess || !res.data) {
      setError(res.message || "Could not start conversation");
      return;
    }
    setOpen(false);
    setEmail("");
    router.push(`${baseUrl}/${res.data.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> New Message
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Recipient email</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="user@example.com"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Starting…" : "Start Conversation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
