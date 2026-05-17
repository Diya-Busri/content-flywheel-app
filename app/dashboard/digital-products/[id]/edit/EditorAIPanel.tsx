"use client";

import React, { useRef, useEffect } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatCoach } from "@/hooks/useChatCoach";
import { cn } from "@/lib/utils";

const STARTER_CHIPS = [
  "Improve my content",
  "Suggest section titles",
  "Write intro text for this page",
  "How should I price this?",
  "Give me a hook for TikTok",
  "Make it more engaging",
];

export function EditorAIPanel({ productId }: { productId: string }) {
  const { messages, sendMessage, isLoading } = useChatCoach("product-editor", {
    productId,
    coachMode: "content",
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messages.length) scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const input = inputRef.current;
    if (!input) return;
    const value = input.value.trim();
    if (!value || isLoading) return;
    input.value = "";
    sendMessage(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {messages.length === 0 && (
        <div className="px-4 pt-4 pb-2 space-y-3">
          <div className="flex items-center gap-2 text-orange-500">
            <Sparkles className="w-4 h-4" />
            <p className="text-sm font-medium text-gray-900">AI Product Assistant</p>
          </div>
          <p className="text-xs text-gray-500">
            Ask me anything about your product — I can see your content and help you improve, expand, or market it.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {STARTER_CHIPS.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => sendMessage(label)}
                disabled={isLoading}
                className="rounded-full px-3 py-1.5 text-xs font-medium bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0 px-4">
        <div className="py-3 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-900"
                )}
              >
                {msg.content || (msg.role === "assistant" && isLoading && i === messages.length - 1 ? "…" : "")}
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-gray-200 flex gap-2 shrink-0">
        <Input
          ref={inputRef}
          placeholder="Ask about your product…"
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className="flex-1 text-sm"
        />
        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={isLoading}
          className="bg-orange-500 hover:bg-orange-600 text-white shrink-0"
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </Button>
      </div>
    </div>
  );
}
