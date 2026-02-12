"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send } from "lucide-react";

const ACCENT = "#F59E0B";

const QUICK_REPLIES = [
  "Pricing questions",
  "Technical support",
  "Schedule demo",
] as const;

type Message = { role: "user" | "bot"; text: string };

const WELCOME_MESSAGE: Message = {
  role: "bot",
  text: "Hi! How can we help? Choose a quick reply or type your message below.",
};

function buildChatRequestBody(messages: Message[]): { role: "user" | "assistant"; content: string }[] {
  return messages.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.text,
  }));
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [isOpen, messages]);

  const sendMessage = async (userText: string) => {
    const text = userText.trim();
    if (!text || isLoading) return;

    setInput("");
    const userMessage: Message = { role: "user", text };
    const assistantPlaceholder: Message = { role: "bot", text: "" };
    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setIsLoading(true);

    const messageList = [...messages, userMessage];
    const body = buildChatRequestBody(messageList);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: body }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed: ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "bot") next[next.length - 1] = { ...last, text: "Something went wrong." };
          return next;
        });
        return;
      }

      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload) as { content?: string };
            if (parsed.content) {
              accumulated += parsed.content;
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "bot") next[next.length - 1] = { ...last, text: accumulated };
                return next;
              });
            }
          } catch {
            // skip malformed chunk
          }
        }
      }

      if (!accumulated) {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "bot") next[next.length - 1] = { ...last, text: "No response received." };
          return next;
        });
      }
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "bot") {
          next[next.length - 1] = { ...last, text: err instanceof Error ? err.message : "Something went wrong." };
        }
        return next;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickReply = (label: string) => {
    sendMessage(label);
  };

  const handleSend = () => {
    sendMessage(input);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Chat window: constrained size, above the button when open */}
      <div
        className={`flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-300 ease-out dark:border-slate-700 dark:bg-slate-900
          ${isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none invisible"}
          ${isOpen
            ? "h-[480px] w-[380px] max-sm:h-[calc(100vh-8rem)] max-sm:w-[calc(100vw-2rem)] max-sm:max-h-[520px]"
            : "h-0 w-0 overflow-hidden"
          }
        `}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700"
          style={{ backgroundColor: ACCENT }}
        >
          <span className="text-sm font-semibold text-slate-900">Chat Bot</span>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1.5 text-slate-900/80 transition-colors hover:bg-slate-900/10 hover:text-slate-900"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "rounded-br-md text-slate-900"
                    : "rounded-bl-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }`}
                style={msg.role === "user" ? { backgroundColor: ACCENT } : undefined}
              >
                {msg.text || (msg.role === "bot" && isLoading ? "…" : "")}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick replies */}
        <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
          <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            Quick replies
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_REPLIES.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => handleQuickReply(label)}
                disabled={isLoading}
                className="rounded-xl border-2 border-amber-500/50 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-amber-500 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-500/50 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-amber-500 dark:hover:bg-amber-500/10"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Input + Send */}
        <div className="flex shrink-0 gap-2 border-t border-slate-200 p-3 dark:border-slate-700">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            disabled={isLoading}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isLoading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-900 transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: ACCENT }}
            aria-label="Send"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Floating chat button - always visible, not full width */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
        style={{ backgroundColor: ACCENT }}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        <MessageCircle className="h-6 w-6 text-slate-900" />
      </button>
    </div>
  );
}
