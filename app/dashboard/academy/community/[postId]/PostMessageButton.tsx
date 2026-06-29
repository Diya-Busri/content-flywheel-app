"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startDirectConversationAction } from "@/actions/messaging-actions";

export function PostMessageButton({ authorEmail }: { authorEmail: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (loading) return;
    setError(null);
    setLoading(true);
    const res = await startDirectConversationAction(authorEmail);
    setLoading(false);
    if (res.isSuccess && res.data) {
      router.push(`/dashboard/academy/messages/${res.data.id}`);
    } else {
      setError(res.message || "Could not start conversation");
    }
  }

  return (
    <div className="mt-3">
      <Button size="sm" variant="outline" className="gap-1.5" onClick={handleClick} disabled={loading}>
        <MessageCircle className="h-4 w-4" />
        {loading ? "Starting…" : `Message ${authorEmail}`}
      </Button>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
