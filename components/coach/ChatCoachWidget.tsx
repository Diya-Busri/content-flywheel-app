"use client";

import { usePathname } from "next/navigation";
import { useRef, useEffect } from "react";
import { MessageCircle, Send, Loader2, X } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCoachOpen } from "@/components/coach/CoachOpenContext";
import { useChatCoach } from "@/hooks/useChatCoach";
import { cn } from "@/lib/utils";

const STARTER_CHIPS = [
  "Help me generate a product idea",
  "What should I create next?",
  "How do I market my ebook?",
];

export interface CoachChatPanelProps {
  onClose?: () => void;
  className?: string;
}

/** Reusable coach chat panel (messages, input, chips). Used in Sheet and inline in sidebar. */
export function CoachChatPanel({ onClose, className }: CoachChatPanelProps) {
  const pathname = usePathname();
  const pageContext = pathname ?? "";
  const { messages, sendMessage, isLoading } = useChatCoach(pageContext);
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
    <div className={cn("flex flex-col h-full min-h-0", className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] dark:border-white/10 shrink-0">
        <h2 className="text-base font-semibold text-foreground">AI Coach</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {messages.length === 0 && (
        <div className="px-4 pt-3 pb-2 flex flex-wrap gap-2 shrink-0">
          {STARTER_CHIPS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => sendMessage(label)}
              disabled={isLoading}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                "bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20",
                "dark:bg-orange-500/20 dark:hover:bg-orange-500/30",
                "disabled:opacity-50 disabled:pointer-events-none"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0 px-4">
        <div className="py-3 space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-orange-500 text-white dark:bg-orange-500"
                    : "bg-muted text-foreground dark:bg-white/10 dark:text-gray-100"
                )}
              >
                {msg.content || (msg.role === "assistant" && isLoading ? "…" : "")}
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-[#E5E7EB] dark:border-white/10 flex gap-2 shrink-0">
        <Input
          ref={inputRef}
          placeholder="Ask your coach…"
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className="flex-1 bg-background"
        />
        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={isLoading}
          className="bg-orange-500 hover:bg-orange-600 dark:bg-orange-500 dark:hover:bg-orange-600 shrink-0"
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </Button>
      </div>
    </div>
  );
}

/** Floating AI Coach button — disabled: do not render. Use "AI Coach" in the sidebar instead. */
export function ChatCoachWidget() {
  return null;
}
