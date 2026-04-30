"use client";

import { useState, useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "ai-coach-history";

const IMAGE_ACTION_WORDS = /\b(create|make|generate|draw|show\s+me|design|build|produce|give\s+me|i\s+want\s+a|can\s+you\s+make)\b/i;
const IMAGE_SUBJECT_WORDS = /\b(image|picture|photo|illustration|design|graphic|poster|thumbnail|banner|visual|mockup|logo|flyer|infographic|artwork|cover|background|wallpaper|header|hero|icon|sticker|meme|frame|slide|creative|ad|reel\s+cover|story\s+post|story\s+background|post\s+background)s?\b/i;

/** Detect if the user message is requesting an image or design. */
export function isImageRequest(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return IMAGE_ACTION_WORDS.test(t) && IMAGE_SUBJECT_WORDS.test(t);
}

export type CoachMessage = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  /** Assistant message: URL of generated voice-over audio (e.g. from Supabase). */
  voiceOverUrl?: string;
  /** User message: image data URLs for inline display and vision API */
  imageUrls?: string[];
  /** User message: uploaded PDF/txt with extracted text */
  attachedFiles?: { name: string; text: string }[];
  /** User message: attached video files. blobUrl is session-only (not persisted). */
  attachedVideos?: { name: string; blobUrl?: string; transcript?: string }[];
};

export type SendMessageAttachments = {
  imageUrls?: string[];
  attachedFiles?: { name: string; text: string }[];
  attachedVideos?: { name: string; blobUrl?: string; transcript?: string }[];
};

function loadStoredMessages(persist: boolean): CoachMessage[] {
  if (!persist || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m: unknown) =>
        m &&
        typeof m === "object" &&
        "role" in m &&
        "content" in m &&
        (m as CoachMessage).role in { user: 1, assistant: 1 } &&
        typeof (m as CoachMessage).content === "string"
    ) as CoachMessage[];
  } catch {
    return [];
  }
}

export type UseChatCoachOptions = {
  persist?: boolean;
  /** When provided, messages are controlled by the parent (e.g. sessions). Initial state from initialMessages. */
  initialMessages?: CoachMessage[];
  onMessagesChange?: (messages: CoachMessage[]) => void;
  /** Called once when streaming finishes with the final assistant text (for e.g. TTS auto-play). */
  onAssistantComplete?: (text: string) => void;
  /** When set, coach API injects this product's details into the system prompt. */
  productId?: string | null;
  /** Coach mode id: business | finance | content | goals | general. Sent to API to select system prompt. */
  coachMode?: string;
  /** Memory feature: include name context and previous summaries in system prompt. */
  memoryEnabled?: boolean;
  userName?: string;
  coachName?: string;
  previousSummaries?: string[];
};

export function useChatCoach(pageContext: string, options: UseChatCoachOptions = {}) {
  const {
    persist = false,
    initialMessages,
    onMessagesChange,
    onAssistantComplete,
    productId,
    coachMode = "business",
    memoryEnabled = false,
    userName = "",
    coachName = "Coach",
    previousSummaries = [],
  } = options;
  const onMessagesChangeRef = useRef(onMessagesChange);
  onMessagesChangeRef.current = onMessagesChange;

  const [messages, setMessagesState] = useState<CoachMessage[]>(() => {
    if (initialMessages != null) return initialMessages;
    return persist ? loadStoredMessages(true) : [];
  });
  const [isLoading, setIsLoading] = useState(false);

  const setMessages = useCallback((updater: CoachMessage[] | ((prev: CoachMessage[]) => CoachMessage[])) => {
    setMessagesState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      onMessagesChangeRef.current?.(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (onMessagesChange != null) return;
    if (!persist || messages.length === 0) return;
    try {
      const toStore = messages.map((m) =>
        m.attachedVideos?.length
          ? { ...m, attachedVideos: m.attachedVideos.map((v) => ({ name: v.name })) }
          : m
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch {
      // ignore
    }
  }, [persist, messages, onMessagesChange]);

  const clearChat = useCallback(() => {
    if (persist && onMessagesChange == null) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    setMessages([]);
  }, [persist, onMessagesChange, setMessages]);

  const generateImage = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || isLoading) return;

      const userMessage: CoachMessage = { role: "user", content: `Generate image: ${trimmed}` };
      setMessages((prev) => [...prev, userMessage]);
      setMessages((prev) => [...prev, { role: "assistant", content: "", imageUrl: undefined }]);
      setIsLoading(true);

      try {
        const res = await fetch("/api/chat/coach/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: trimmed, aspectRatio: "16:9" }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((data as { error?: string }).error || `Request failed: ${res.status}`);
        }
        const url = (data as { url?: string }).url;
        if (!url) throw new Error("No image URL returned");
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") next[next.length - 1] = { ...last, content: "Here's your image.", imageUrl: url };
          return next;
        });
      } catch (err) {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = { ...last, content: "Couldn't generate that one, try describing it differently." };
          }
          return next;
        });
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading]
  );

  const sendMessage = useCallback(
    async (content: string, attachments?: SendMessageAttachments) => {
      const trimmed = content.trim();
      const hasImages = (attachments?.imageUrls?.length ?? 0) > 0;
      const hasFiles = (attachments?.attachedFiles?.length ?? 0) > 0;
      const hasVideos = (attachments?.attachedVideos?.length ?? 0) > 0;
      if ((!trimmed && !hasImages && !hasFiles && !hasVideos) || isLoading) return;

      const userMessage: CoachMessage = {
        role: "user",
        content: trimmed || "(no text)",
        imageUrls: attachments?.imageUrls,
        attachedFiles: attachments?.attachedFiles,
        attachedVideos: attachments?.attachedVideos,
      };
      setMessages((prev) => [...prev, userMessage]);
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      setIsLoading(true);

      const messageList = [...messages, userMessage];
      const body = messageList.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.role === "user" && (m.imageUrls?.length || m.attachedFiles?.length || m.attachedVideos?.length)
          ? {
              imageUrls: m.imageUrls,
              attachedFiles: m.attachedFiles,
              // Strip blobUrl — server only needs filename + transcript
              attachedVideos: m.attachedVideos?.map((v) => ({ name: v.name, transcript: v.transcript })),
            }
          : {}),
      }));

      const isImage = isImageRequest(trimmed);
      if (isImage) {
        try {
          // Enrich the prompt with any attached video transcripts or image context
          let imagePrompt = trimmed;
          if (attachments?.attachedVideos?.length) {
            const videoContext = attachments.attachedVideos
              .filter((v) => v.transcript)
              .map((v) => `Video "${v.name}" transcript: ${v.transcript}`)
              .join("\n\n");
            if (videoContext) imagePrompt = `${trimmed}\n\nContext:\n${videoContext}`;
          }
          const res = await fetch("/api/chat/coach/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: imagePrompt, aspectRatio: "16:9" }),
          });
          const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
          if (data.url) {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = { ...last, content: "Here you go 👇", imageUrl: data.url };
              }
              return next;
            });
          } else {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = { ...last, content: "Couldn't generate that one, try describing it differently." };
              }
              return next;
            });
          }
        } catch {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant") {
              next[next.length - 1] = { ...last, content: "Couldn't generate that one, try describing it differently." };
            }
            return next;
          });
        } finally {
          setIsLoading(false);
        }
        return;
      }

      try {
        const res = await fetch("/api/chat/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: body,
            pageContext,
            productId: productId ?? undefined,
            coachMode,
            memoryEnabled,
            userName: userName || undefined,
            coachName: coachName || undefined,
            previousSummaries: memoryEnabled && previousSummaries.length > 0 ? previousSummaries : undefined,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || `Request failed: ${res.status}`);
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant") next[next.length - 1] = { ...last, content: "Something went wrong." };
            return next;
          });
          return;
        }

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
                  if (last?.role === "assistant") next[next.length - 1] = { ...last, content: accumulated };
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
            if (last?.role === "assistant") next[next.length - 1] = { ...last, content: "No response received." };
            return next;
          });
        } else {
          onAssistantComplete?.(accumulated);
        }
      } catch (err) {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = { ...last, content: err instanceof Error ? err.message : "Something went wrong." };
          }
          return next;
        });
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, productId, coachMode, memoryEnabled, userName, coachName, previousSummaries]
  );

  return { messages, sendMessage, generateImage, clearChat, isLoading };
}
