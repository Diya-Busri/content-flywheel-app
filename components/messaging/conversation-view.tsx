"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "./message-bubble";

interface Message {
  id: string;
  senderId: string;
  senderEmail: string | null;
  content: string;
  isAdminMessage: boolean;
  createdAt: string;
}

interface ConversationViewProps {
  conversationId: string;
  currentUserId: string;
  initialMessages?: Message[];
  otherUserEmail?: string | null;
  isSupport?: boolean;
  // When true, sending posts via the admin support reply endpoint instead.
  asAdmin?: boolean;
  // Override the GET endpoint used for polling messages (admin uses a dedicated route).
  fetchPath?: string;
}

export function ConversationView({
  conversationId,
  currentUserId,
  initialMessages = [],
  otherUserEmail,
  isSupport,
  asAdmin,
  fetchPath,
}: ConversationViewProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const getPath = fetchPath ?? `/api/messages/conversations/${conversationId}`;

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(getPath, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.messages)) {
        setMessages((prev) => {
          if (prev.length !== data.messages.length) return data.messages;
          return prev;
        });
      }
    } catch {
      /* ignore transient polling errors */
    }
  }, [getPath]);

  // Mark read on open + poll every 5s.
  // TODO: replace with Supabase Realtime subscription for true real-time messaging
  useEffect(() => {
    // Admins read via the support inbox and don't track per-user read state here.
    if (!asAdmin) {
      fetch(`/api/messages/conversations/${conversationId}/read`, { method: "POST" }).catch(() => {});
    }
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [conversationId, fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleSend() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput("");

    // Optimistic append
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      senderId: currentUserId,
      senderEmail: null,
      content,
      isAdminMessage: !!asAdmin,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const endpoint = asAdmin
        ? `/api/admin/support/${conversationId}/reply`
        : `/api/messages/conversations/${conversationId}/send`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setInput(content);
      } else {
        await fetchMessages();
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(content);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            {isSupport
              ? "Send a message and our team will get back to you."
              : "No messages yet. Say hello!"}
          </div>
        ) : (
          messages.map((m) => {
            const isOwn = asAdmin ? m.isAdminMessage : m.senderId === currentUserId;
            return (
              <MessageBubble
                key={m.id}
                content={m.content}
                isOwn={isOwn}
                senderEmail={m.senderEmail}
                timestamp={m.createdAt}
                isAdmin={m.isAdminMessage}
              />
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-background p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            placeholder={asAdmin ? "Reply as Content Flywheel Support…" : "Type a message…"}
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button onClick={handleSend} disabled={sending || !input.trim()} size="icon" className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {asAdmin && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Shield className="h-3 w-3" /> Replying as support — your personal account is hidden.
          </p>
        )}
      </div>
    </div>
  );
}
