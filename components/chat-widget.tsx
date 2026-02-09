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

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [isOpen, messages]);

  const handleQuickReply = (label: string) => {
    setMessages((prev) => [
      ...prev,
      { role: "user", text: label },
      {
        role: "bot",
        text: "Thanks for reaching out! We'll get back to you soon. For now this is a demo—no messages are sent.",
      },
    ]);
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setMessages((prev) => [
      ...prev,
      {
        role: "bot",
        text: "Got it! This is a demo chat—your message is stored locally only.",
      },
    ]);
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
                {msg.text}
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
                className="rounded-xl border-2 border-amber-500/50 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-amber-500 hover:bg-amber-50 dark:border-amber-500/50 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-amber-500 dark:hover:bg-amber-500/10"
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
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={handleSend}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-900 transition-opacity hover:opacity-90"
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
