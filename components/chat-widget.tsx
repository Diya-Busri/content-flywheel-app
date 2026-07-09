"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

const ACCENT = "#F59E0B";

const QUICK_REPLIES = [
  "What does this do?",
  "How much does it cost?",
  "I found a bug",
  "Get help",
] as const;

type Message = { role: "user" | "bot"; text: string };

const WELCOME_MESSAGE: Message = {
  role: "bot",
  text: "Hi! How can we help? Pick a quick reply or type your message below.",
};

function buildChatRequestBody(messages: Message[]): { role: "user" | "assistant"; content: string }[] {
  return messages
    .filter((m) => m.text.trim())
    .map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    }));
}

/** Turn URLs in text into clickable links; keep the rest as plain text. */
function renderMessageText(text: string) {
  const parts: (string | JSX.Element)[] = [];
  const urlRe = /(https?:\/\/[^\s]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = urlRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const url = match[0];
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
      >
        {url}
      </a>
    );
    lastIndex = match.index + url.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : <span>{parts}</span>;
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3 dark:bg-slate-800">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChatWidget() {
  const { userId } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [leadEmail, setLeadEmail] = useState("");
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [awaitingBugDescription, setAwaitingBugDescription] = useState(false);
  const [bugDescription, setBugDescription] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [isOpen, messages, showEmailPrompt, awaitingBugDescription]);

  const sendMessage = async (userText: string, options: { isBugDescription?: boolean } = {}) => {
    const text = userText.trim();
    if (!text || isLoading) return;

    setInput("");
    setBugDescription("");
    setAwaitingBugDescription(false);

    const userMessage: Message = { role: "user", text };
    const assistantPlaceholder: Message = { role: "bot", text: "" };
    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setIsLoading(true);
    setShowEmailPrompt(false);

    const messageList = [...messages, userMessage];
    const body = buildChatRequestBody(messageList);

    const payload: { messages: typeof body; email?: string; isBugDescription?: boolean } = {
      messages: body,
    };
    if (!userId && leadEmail) payload.email = leadEmail;
    if (options.isBugDescription) payload.isBugDescription = true;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const data = await res.json().catch(() => ({}));
        if (data.requireEmail === true) {
          setShowEmailPrompt(true);
          setMessages((prev) => prev.slice(0, -1)); // remove only bot placeholder so user message stays
          setIsLoading(false);
          return;
        }
        if (!res.ok) {
          throw new Error(data.error || `Request failed: ${res.status}`);
        }
      }

      if (!res.body) {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "bot") next[next.length - 1] = { ...last, text: "Something went wrong." };
          return next;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          if (!chunk.startsWith("data: ")) continue;
          const payload = chunk.slice(6);
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
            // skip
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
          next[next.length - 1] = {
            ...last,
            text: err instanceof Error ? err.message : "Something went wrong.",
          };
        }
        return next;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickReply = (label: string) => {
    if (label === "I found a bug") {
      setAwaitingBugDescription(true);
      setMessages((prev) => [
        ...prev,
        { role: "user", text: "I found a bug" },
        {
          role: "bot",
          text: "Sorry to hear that. Please describe what went wrong and we'll log it for the team.",
        },
      ]);
      return;
    }
    sendMessage(label);
  };

  const handleSend = () => {
    if (awaitingBugDescription && bugDescription.trim()) {
      sendMessage(bugDescription.trim(), { isBugDescription: true });
      return;
    }
    sendMessage(input);
  };

  const handleEmailSubmit = async () => {
    const email = leadEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    setLeadEmail(email);
    setShowEmailPrompt(false);
    setIsLoading(true);
    const messageList = buildChatRequestBody(messages);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messageList, email }),
      });
      if (!res.body) {
        setMessages((prev) => [...prev, { role: "bot", text: "Something went wrong." }]);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";
      setMessages((prev) => [...prev, { role: "bot", text: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          if (!chunk.startsWith("data: ")) continue;
          const payload = chunk.slice(6);
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
            // skip
          }
        }
      }
      if (!accumulated) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "bot", text: "No response received." };
          return next;
        });
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: err instanceof Error ? err.message : "Something went wrong." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const canSend = awaitingBugDescription ? bugDescription.trim().length > 0 : input.trim().length > 0;
  const showQuickReplies = messages.length <= 1 && !showEmailPrompt && !awaitingBugDescription;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      <div
        className={`flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-300 ease-out dark:border-slate-700 dark:bg-slate-900
          ${isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none invisible"}
          ${isOpen ? "h-[520px] w-[400px] max-sm:h-[calc(100vh-8rem)] max-sm:w-[calc(100vw-2rem)] max-sm:max-h-[560px]" : "h-0 w-0 overflow-hidden"}
        `}
      >
        <div
          className="flex shrink-0 items-center justify-between border-b border-amber-600/20 px-4 py-3"
          style={{ backgroundColor: ACCENT }}
        >
          <span className="text-sm font-semibold text-slate-900">Support</span>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1.5 text-slate-900/80 transition-colors hover:bg-slate-900/10 hover:text-slate-900"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "rounded-br-md text-slate-900"
                    : "rounded-bl-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }`}
                style={msg.role === "user" ? { backgroundColor: ACCENT } : undefined}
              >
                {msg.role === "bot" ? renderMessageText(msg.text) : msg.text}
              </div>
            </div>
          ))}
          {isLoading && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {showEmailPrompt && (
          <div className="shrink-0 border-t border-slate-200 bg-amber-50/50 px-4 py-3 dark:border-slate-700 dark:bg-amber-950/20">
            <p className="mb-2 text-xs font-medium text-slate-700 dark:text-slate-300">
              Enter your email to continue (we’ll only use it to follow up if needed).
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
                placeholder="you@example.com"
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
              <button
                type="button"
                onClick={handleEmailSubmit}
                disabled={!leadEmail.trim()}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-900 transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {awaitingBugDescription && (
          <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">
              Describe what went wrong (optional but helpful).
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={bugDescription}
                onChange={(e) => setBugDescription(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="e.g. Upload failed when..."
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!bugDescription.trim() || isLoading}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-900 transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {showQuickReplies && (
          <div className="shrink-0 border-t border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/30">
            <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Quick replies</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_REPLIES.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleQuickReply(label)}
                  disabled={isLoading}
                  className="rounded-xl border border-amber-500/40 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-amber-500 hover:bg-amber-50/80 disabled:opacity-50 dark:border-amber-500/40 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-amber-500 dark:hover:bg-amber-500/10"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {!showEmailPrompt && !awaitingBugDescription && (
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
              disabled={!canSend || isLoading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-900 transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
              aria-label="Send"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        )}
      </div>

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
