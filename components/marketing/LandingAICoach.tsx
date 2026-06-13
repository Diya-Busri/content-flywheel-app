"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Bot, Sparkles, ArrowRight, RotateCcw } from "lucide-react";
import Link from "next/link";

/* ── types ── */
type Role = "user" | "assistant";
interface Message {
  id: string;
  role: Role;
  content: string;
  streaming?: boolean;
}

/* ── quick actions ── */
const QUICK_ACTIONS = [
  { label: "Find a niche", prompt: "Help me find a profitable niche for digital products." },
  { label: "Product ideas", prompt: "Give me some digital product ideas I could sell." },
  { label: "How it works", prompt: "How does Content Flywheel work?" },
  { label: "Pricing", prompt: "What does Content Flywheel cost?" },
  { label: "Features", prompt: "What features are included?" },
];

const OPENING_MESSAGE: Message = {
  id: "open",
  role: "assistant",
  content:
    "Hi, I'm the Content Flywheel AI Coach. I can help you find a product idea or answer questions about the platform.\n\nWhat would you like to explore?",
};

/* ── helpers ── */
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {!isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mt-0.5">
          <Bot className="w-3.5 h-3.5 text-orange-400" />
        </div>
      )}
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-orange-500 text-white rounded-tr-sm"
            : "bg-white/[0.06] text-white/80 rounded-tl-sm border border-white/[0.08]"
        }`}
      >
        {msg.content}
        {msg.streaming && (
          <span className="inline-flex gap-0.5 ml-1 align-middle">
            {[0, 0.15, 0.3].map((d) => (
              <motion.span
                key={d}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ repeat: Infinity, duration: 0.9, delay: d }}
                className="w-1 h-1 rounded-full bg-orange-400 inline-block"
              />
            ))}
          </span>
        )}
      </div>
    </motion.div>
  );
}

/* ── main widget ── */
export function LandingAICoach() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([OPENING_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCTA, setShowCTA] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: Message = { id: uid(), role: "user", content: trimmed };
      const assistantId = uid();
      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setLoading(true);

      // After 8 user messages, show CTA
      const userCount = messages.filter((m) => m.role === "user").length + 1;
      if (userCount >= 8) setShowCTA(true);

      try {
        const history = [...messages, userMsg]
          .filter((m) => m.id !== "open")
          .map(({ role, content }) => ({ role, content }));

        abortRef.current = new AbortController();
        const res = await fetch("/api/landing-coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({ error: "Something went wrong." }));
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: err.error ?? "Something went wrong.", streaming: false }
                : m
            )
          );
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let full = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") break;
            try {
              const { content } = JSON.parse(payload);
              if (content) {
                full += content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: full } : m
                  )
                );
              }
            } catch {
              // ignore parse errors
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, streaming: false } : m
          )
        );
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Something went wrong. Please try again.", streaming: false }
              : m
          )
        );
      } finally {
        setLoading(false);
      }
    },
    [loading, messages]
  );

  function handleQuickAction(prompt: string) {
    send(prompt);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  function reset() {
    abortRef.current?.abort();
    setMessages([OPENING_MESSAGE]);
    setInput("");
    setLoading(false);
    setShowCTA(false);
  }

  const showQuickActions = messages.length === 1; // only after opening message

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-6 right-6 z-50">
        <AnimatePresence>
          {!open && (
            <motion.button
              key="fab"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              onClick={() => setOpen(true)}
              className="group flex items-center gap-2.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3.5 text-sm font-bold text-white shadow-2xl shadow-orange-500/40 hover:shadow-orange-500/60 transition-shadow"
            >
              <motion.div
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ repeat: Infinity, duration: 3, delay: 2 }}
              >
                <Sparkles className="w-4 h-4" />
              </motion.div>
              AI Coach
              {/* Pulse ring */}
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500" />
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Chat panel */}
        <AnimatePresence>
          {open && (
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.92, y: 16, originX: 1, originY: 1 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="absolute bottom-0 right-0 w-[360px] sm:w-[400px] h-[580px] flex flex-col rounded-2xl border border-white/10 bg-[#111] shadow-2xl shadow-black/60 overflow-hidden"
              style={{ maxHeight: "calc(100vh - 32px)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] bg-gradient-to-r from-orange-500/10 to-transparent shrink-0">
                <div className="flex items-center gap-3">
                  <div className="relative w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-orange-400" />
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[#111]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white leading-none">AI Coach</p>
                    <p className="text-[10px] text-white/30 mt-0.5">Content Flywheel · Online</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={reset}
                    className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
                    title="Reset conversation"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}

                {/* Quick actions (shown only on first load) */}
                {showQuickActions && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex flex-wrap gap-2 pt-1"
                  >
                    {QUICK_ACTIONS.map((a) => (
                      <button
                        key={a.label}
                        onClick={() => handleQuickAction(a.prompt)}
                        className="rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-orange-500/30 px-3 py-1.5 text-xs font-medium text-white/60 hover:text-orange-400 transition-all"
                      >
                        {a.label}
                      </button>
                    ))}
                  </motion.div>
                )}

                {/* CTA after deep engagement */}
                {showCTA && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 text-center"
                  >
                    <p className="text-xs text-white/50 mb-3">
                      Ready to build this with the full platform?
                    </p>
                    <Link
                      href="/signup"
                      className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 hover:bg-orange-400 px-5 py-2 text-xs font-bold text-white transition-colors"
                    >
                      Start free trial <ArrowRight className="w-3 h-3" />
                    </Link>
                  </motion.div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="shrink-0 border-t border-white/[0.08] bg-[#111] px-4 py-3">
                <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 focus-within:border-orange-500/40 transition-colors">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about niches, products, pricing…"
                    disabled={loading}
                    className="flex-1 resize-none bg-transparent text-sm text-white placeholder-white/25 outline-none leading-relaxed disabled:opacity-50"
                    style={{ maxHeight: 100 }}
                  />
                  <button
                    onClick={() => send(input)}
                    disabled={!input.trim() || loading}
                    className="shrink-0 w-8 h-8 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                  >
                    <Send className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
                <p className="mt-2 text-center text-[10px] text-white/20">
                  Powered by Content Flywheel AI · Preview of in-app experience
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
