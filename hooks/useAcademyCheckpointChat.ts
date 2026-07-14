"use client";

import { useCallback, useRef, useState } from "react";
import type { CheckpointHelpOption } from "@/db/schema/academy-checkpoints-schema";
import { saveMessageVisualAction } from "@/actions/academy-checkpoint-actions";

export interface CheckpointClientMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  helpOption?: CheckpointHelpOption | null;
  pending?: boolean;
  failed?: boolean;
  /** Opt-in visual (see generateVisual) — never generated automatically, only on explicit click. */
  imageUrl?: string;
  visualLoading?: boolean;
  visualError?: string;
  /**
   * Real DB row id for a freshly-streamed assistant reply, set once the stream
   * finishes and the server confirms it persisted the message (see the
   * `assistantMessageId` SSE frame in the checkpoint chat route). `id` itself
   * stays a stable local id for React keys/lookups throughout streaming;
   * history messages hydrated from the server already have the real id in
   * `id` and never need this. Used so "Add a visual" can persist against the
   * correct row instead of silently no-op'ing on a local-only id.
   */
  dbId?: string;
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `local-${idCounter}-${Date.now()}`;
}

/**
 * Shared fetch for opt-in visuals — reuses the EXACT endpoint AI Coach uses for
 * inline image generation (/api/chat/coach/generate-image, DALL-E via OpenAI,
 * uploaded to Supabase Storage). No new AI client, no duplicated credit logic:
 * that route is rate-limited like the rest of the app and does not charge
 * video credits, matching how AI Coach's own inline images already behave.
 * Exported so both the message-bubble visual and the application-output
 * card's visual (outside the message list) can share one implementation.
 */
export async function fetchGeneratedVisual(prompt: string): Promise<{ url?: string; error?: string }> {
  try {
    const res = await fetch("/api/chat/coach/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt.slice(0, 800), aspectRatio: "1:1" }),
    });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !data.url) return { error: data.error || "Couldn't generate that visual." };
    return { url: data.url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't generate that visual." };
  }
}

export interface UseAcademyCheckpointChatOptions {
  lessonId: string;
  initialMessages?: CheckpointClientMessage[];
  /** Called with the exact text the user typed, only when a free-text send fails — lets the panel restore it into the input instead of losing it. */
  onSendFailed?: (originalText: string) => void;
  /** Seed value from hydration (see openCheckpointAction) — a prior session may have already crossed the struggling threshold. */
  initialStruggling?: boolean;
}

/**
 * Thin streaming-chat hook for the Understanding Check checkpoint, modeled on
 * hooks/useChatCoach.ts (same SSE `data: {...}` framing as /api/chat/coach)
 * but bound to the checkpoint API + DB persistence instead of localStorage,
 * and sending the selected help option as structured data rather than
 * relying on the model to infer intent from prompt text.
 */
export function useAcademyCheckpointChat({
  lessonId,
  initialMessages = [],
  onSendFailed,
  initialStruggling = false,
}: UseAcademyCheckpointChatOptions) {
  const [messages, setMessages] = useState<CheckpointClientMessage[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "Struggling" nudge — once true it stays true for the rest of this panel
  // session; the underlying signal (repeated questions/explain-simpler) only grows.
  const [struggling, setStruggling] = useState(initialStruggling);
  const lastRequestRef = useRef<{ helpOption: CheckpointHelpOption; message?: string; displayText: string } | null>(null);
  const submittingRef = useRef(false); // synchronous guard against double-submit even before state updates flush

  // Mirrors `messages` synchronously so callbacks (e.g. generateVisual, defined with
  // an empty dep array) can read the latest list without needing to depend on and
  // recreate on every message update.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const send = useCallback(
    async (helpOption: CheckpointHelpOption, options?: { message?: string; displayText?: string }) => {
      if (submittingRef.current || isLoading) return; // dedupe: ignore repeated clicks while a request is in flight
      submittingRef.current = true;
      setIsLoading(true);
      setError(null);

      const displayText = options?.displayText ?? options?.message ?? "";
      lastRequestRef.current = { helpOption, message: options?.message, displayText };

      const userMsg: CheckpointClientMessage = { id: nextId(), role: "user", content: displayText, helpOption };
      const assistantMsg: CheckpointClientMessage = { id: nextId(), role: "assistant", content: "", helpOption, pending: true };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      try {
        const res = await fetch(`/api/academy/lessons/${lessonId}/checkpoint/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ helpOption, message: options?.message }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const msg = (errBody as { error?: string }).error || `Request failed (${res.status})`;
          throw new Error(msg);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");
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
              const parsed = JSON.parse(payload) as { content?: string; assistantMessageId?: string; struggling?: boolean };
              if (parsed.struggling) setStruggling(true);
              if (parsed.content) {
                accumulated += parsed.content;
                setMessages((prev) => {
                  const next = [...prev];
                  const idx = next.findIndex((m) => m.id === assistantMsg.id);
                  if (idx !== -1) next[idx] = { ...next[idx], content: accumulated, pending: true };
                  return next;
                });
              } else if (parsed.assistantMessageId) {
                setMessages((prev) => {
                  const next = [...prev];
                  const idx = next.findIndex((m) => m.id === assistantMsg.id);
                  if (idx !== -1) next[idx] = { ...next[idx], dbId: parsed.assistantMessageId };
                  return next;
                });
              }
            } catch {
              // skip malformed chunk
            }
          }
        }

        setMessages((prev) => {
          const next = [...prev];
          const idx = next.findIndex((m) => m.id === assistantMsg.id);
          if (idx !== -1) {
            next[idx] = {
              ...next[idx],
              content: accumulated || "No response received.",
              pending: false,
            };
          }
          return next;
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong.";
        setError(message);
        // Remove the empty pending assistant bubble and mark the user turn as failed —
        // never silently show a fake/empty response, never lose the request that was made.
        setMessages((prev) => {
          const withoutPendingAssistant = prev.filter((m) => m.id !== assistantMsg.id);
          return withoutPendingAssistant.map((m) => (m.id === userMsg.id ? { ...m, failed: true } : m));
        });
        if (options?.message) onSendFailed?.(options.message);
      } finally {
        setIsLoading(false);
        submittingRef.current = false;
      }
    },
    [lessonId, isLoading, onSendFailed]
  );

  const retry = useCallback(() => {
    const last = lastRequestRef.current;
    if (!last) return;
    // Drop the failed pair before resending so we don't accumulate duplicate failed turns.
    setMessages((prev) => prev.filter((m) => !(m.failed && m.role === "user" && m.content === last.displayText)));
    void send(last.helpOption, { message: last.message, displayText: last.displayText });
  }, [send]);

  const clearError = useCallback(() => setError(null), []);

  const visualInFlightRef = useRef<Set<string>>(new Set());

  /** Generate a supporting image for one reply — always explicit/opt-in (a button click), never automatic. */
  const generateVisual = useCallback(
    async (messageId: string, prompt: string) => {
      if (visualInFlightRef.current.has(messageId)) return; // dedupe duplicate clicks
      visualInFlightRef.current.add(messageId);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, visualLoading: true, visualError: undefined } : m)));

      const { url, error: visualErr } = await fetchGeneratedVisual(prompt);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? url
              ? { ...m, imageUrl: url, visualLoading: false }
              : { ...m, visualLoading: false, visualError: visualErr }
            : m
        )
      );
      visualInFlightRef.current.delete(messageId);

      // Best-effort persistence so the visual survives closing/reopening the panel.
      // Never blocks or errors the UI — the image is already showing regardless.
      if (url) {
        const msg = messagesRef.current.find((m) => m.id === messageId);
        const persistId = msg?.dbId ?? messageId;
        void saveMessageVisualAction(persistId, url).catch(() => {});
      }
    },
    []
  );

  return { messages, setMessages, isLoading, error, send, retry, clearError, generateVisual, struggling, setStruggling };
}
