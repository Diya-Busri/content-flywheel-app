"use client";

import { usePathname } from "next/navigation";
import { useRef, useEffect, useState, useCallback } from "react";
import { Send, Loader2, Volume2, VolumeX, ImagePlus, Plus, Search, Trash2, Mic, Phone, PhoneOff, Paperclip, FileText, X, ChevronDown, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { useChatCoach } from "@/hooks/useChatCoach";
import type { CoachMessage } from "@/hooks/useChatCoach";
import { cn } from "@/lib/utils";

const SESSIONS_KEY = "ai-coach-sessions";
const TITLE_MAX_LEN = 30;

type Session = {
  id: string;
  title: string;
  messages: CoachMessage[];
  createdAt: number;
  productId?: string | null;
  productName?: string | null;
};

function loadSessions(): Session[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s: unknown): s is Session =>
        s != null &&
        typeof s === "object" &&
        "id" in s &&
        "title" in s &&
        "messages" in s &&
        "createdAt" in s &&
        typeof (s as Session).id === "string" &&
        Array.isArray((s as Session).messages)
    ).map((s) => ({
      ...s,
      productId: typeof (s as Session).productId === "string" ? (s as Session).productId : undefined,
      productName: typeof (s as Session).productName === "string" ? (s as Session).productName : undefined,
    }));
  } catch {
    return [];
  }
}

function saveSessions(sessions: Session[]) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    // ignore
  }
}

function firstUserMessageTitle(messages: CoachMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  const text = first?.content?.trim() ?? "";
  if (text.length <= TITLE_MAX_LEN) return text;
  return text.slice(0, TITLE_MAX_LEN).trim() + "…";
}

function createSession(): Session {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`,
    title: "New Chat",
    messages: [],
    createdAt: Date.now(),
  };
}

const STARTER_CHIPS = [
  "Help me generate a product idea",
  "What should I create next?",
  "How do I market my ebook?",
];

/** Strip markdown to plain text: remove **, *, ##, #, _, ` so UI and TTS get plain text only. */
function stripMarkdown(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/#{1,6}\s*/g, "")
    .replace(/__/g, "")
    .replace(/_/g, "")
    .replace(/`/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function AICoachPage() {
  const pathname = usePathname();
  const pageContext = pathname ?? "";
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [muted, setMuted] = useState(false);
  const [messageAudioUrls, setMessageAudioUrls] = useState<Record<number, string>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ai-coach-muted");
      setMuted(stored === "true");
    } catch {
      // ignore
    }
  }, []);

  const handleMutedChange = useCallback((next: boolean) => {
    setMuted(next);
    try {
      localStorage.setItem("ai-coach-muted", String(next));
    } catch {
      // ignore
    }
  }, []);
  const prevLoadingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlsRef = useRef<Record<number, string>>({});
  audioUrlsRef.current = messageAudioUrls;

  const activeSession = sessions.find((s) => s.id === activeId);

  useEffect(() => {
    const loaded = loadSessions();
    if (loaded.length === 0) {
      const newSession = createSession();
      setSessions([newSession]);
      setActiveId(newSession.id);
    } else {
      setSessions(loaded);
      if (!activeId || !loaded.some((s) => s.id === activeId)) {
        setActiveId(loaded[0].id);
      }
    }
  }, []);

  useEffect(() => {
    if (sessions.length === 0) return;
    saveSessions(sessions);
  }, [sessions]);

  const updateActiveSessionMessages = useCallback(
    (messages: CoachMessage[]) => {
      if (!activeId) return;
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeId) return s;
          const title =
            s.title === "New Chat" && messages.length > 0 ? firstUserMessageTitle(messages) : s.title;
          return { ...s, messages, title };
        })
      );
    },
    [activeId]
  );

  const setActiveSessionProductContext = useCallback(
    (productId: string | null, productName?: string) => {
      if (!activeId) return;
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeId) return s;
          if (!productId) {
            return { ...s, productId: undefined, productName: undefined };
          }
          const shouldAppendMessage = s.productId !== productId && productName != null && productName !== "";
          const nextMessages = shouldAppendMessage
            ? [
                ...s.messages,
                {
                  role: "assistant" as const,
                  content: `Product context added: ${productName} — I now know all about this product. What do you need help with?`,
                },
              ]
            : s.messages;
          return {
            ...s,
            productId,
            productName: productName ?? undefined,
            messages: nextMessages,
          };
        })
      );
    },
    [activeId]
  );

  const handleNewChat = useCallback(() => {
    const newSession = createSession();
    setSessions((prev) => [newSession, ...prev]);
    setActiveId(newSession.id);
  }, []);

  const handleDeleteSession = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const nextSessions = sessions.filter((s) => s.id !== id);
    if (nextSessions.length === 0) {
      const newSession = createSession();
      setSessions([newSession]);
      setActiveId(newSession.id);
    } else {
      const nextActiveId = activeId === id ? nextSessions[0].id : activeId;
      setSessions(nextSessions);
      setActiveId(nextActiveId);
    }
  }, [sessions, activeId]);

  const filteredSessions = searchQuery.trim()
    ? sessions.filter((s) =>
        s.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : sessions;

  useEffect(() => {
    setMessageAudioUrls((prev) => {
      Object.values(prev).forEach(URL.revokeObjectURL);
      return {};
    });
  }, [activeId]);

  return (
    <div className="flex h-full min-h-0 bg-[#F9FAFB] dark:bg-[#0F0F0F]">
      {/* Left panel: 260px dark sidebar */}
      <aside className="w-[260px] shrink-0 flex flex-col bg-[#171717] dark:bg-[#0d0d0d] border-r border-white/10">
        <div className="p-3">
          <Button
            type="button"
            onClick={handleNewChat}
            className="w-full justify-start gap-2 bg-white/10 hover:bg-white/15 text-white border-0"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>
        <div className="px-3 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-2">
          <p className="px-2 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
            Recent
          </p>
          <ul className="space-y-0.5">
            {filteredSessions.map((s) => {
              const isActive = s.id === activeId;
              const displayTitle = s.title.length > TITLE_MAX_LEN ? s.title.slice(0, TITLE_MAX_LEN) + "…" : s.title;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(s.id)}
                    className={cn(
                      "group w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                      isActive
                        ? "bg-white/15 text-white"
                        : "text-gray-300 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <span className="flex-1 min-w-0 truncate">{displayTitle || "New Chat"}</span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSession(e, s.id)}
                      className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 hover:bg-white/10 transition-opacity"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {/* Right panel: main chat area */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeId && activeSession ? (
          <ChatPanel
            key={activeId}
            pageContext={pageContext}
            initialMessages={activeSession.messages}
            onMessagesChange={updateActiveSessionMessages}
            muted={muted}
            onMutedChange={handleMutedChange}
            messageAudioUrls={messageAudioUrls}
            setMessageAudioUrls={setMessageAudioUrls}
            audioRef={audioRef}
            audioUrlsRef={audioUrlsRef}
            productId={activeSession.productId ?? null}
            productName={activeSession.productName ?? null}
            onProductContextChange={setActiveSessionProductContext}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-slate-400">
            <p className="text-sm">Select a chat or start a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
}

type ChatPanelProps = {
  pageContext: string;
  initialMessages: CoachMessage[];
  onMessagesChange: (messages: CoachMessage[]) => void;
  muted: boolean;
  onMutedChange: (m: boolean) => void;
  messageAudioUrls: Record<number, string>;
  setMessageAudioUrls: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  audioUrlsRef: React.MutableRefObject<Record<number, string>>;
  productId: string | null;
  productName: string | null;
  onProductContextChange: (productId: string | null, productName?: string) => void;
};

type SpeechRecognitionInstance = {
  start: () => void;
  stop: () => void;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: SpeechRecognitionResultList }) => void) | null;
  onend: (() => void) | null;
  onerror?: (e: { error: string }) => void;
};

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  length: number;
  isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

function getSpeechRecognitionClass(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { SpeechRecognition?: new () => SpeechRecognitionInstance; webkitSpeechRecognition?: new () => SpeechRecognitionInstance };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function ChatPanel({
  pageContext,
  initialMessages,
  onMessagesChange,
  muted,
  onMutedChange,
  messageAudioUrls,
  setMessageAudioUrls,
  audioRef,
  audioUrlsRef,
  productId,
  productName,
  onProductContextChange,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const LINE_HEIGHT_PX = 24;
  const MAX_ROWS = 6;
  const maxTextareaHeight = LINE_HEIGHT_PX * MAX_ROWS;
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptRef = useRef("");
  const mutedRef = useRef(muted);
  const lastMessageIndexRef = useRef(0);
  mutedRef.current = muted;

  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  const [isVoiceCall, setIsVoiceCall] = useState(false);
  const [callStatus, setCallStatus] = useState<"listening" | "processing" | "speaking">("listening");
  const isVoiceCallRef = useRef(false);
  const callRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const callTranscriptRef = useRef("");
  isVoiceCallRef.current = isVoiceCall;

  const [pendingImageUrls, setPendingImageUrls] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<{ name: string; text: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const voiceCallTtsQueueRef = useRef<string[]>([]);
  const voiceCallPreFetchedUrlRef = useRef<string | null>(null);
  const voiceCallPlayingRef = useRef(false);
  const voiceCallCurrentUrlRef = useRef<string | null>(null);
  const voiceCallQueueOnEndedRef = useRef<() => void>(() => {});

  const [products, setProducts] = useState<{ id: string; title: string; format: string }[]>([]);
  useEffect(() => {
    fetch("/api/products")
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((data: { products?: { id: string; title: string; format: string }[] }) =>
        setProducts(Array.isArray(data?.products) ? data.products : [])
      )
      .catch(() => setProducts([]));
  }, []);

  const playTTS = useCallback(
    async (text: string, index: number, onPlaybackDone?: () => void) => {
      const plainText = stripMarkdown(text);
      if (!plainText.trim()) {
        onPlaybackDone?.();
        return;
      }
      const el = audioRef.current;
      if (!el) {
        onPlaybackDone?.();
        return;
      }
      const done = () => {
        setPlayingIndex(null);
        onPlaybackDone?.();
      };
      console.log("playing TTS...");
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: plainText }),
        });
        if (!res.ok) {
          done();
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setMessageAudioUrls((prev) => {
          const next = { ...prev };
          if (prev[index]) URL.revokeObjectURL(prev[index]);
          next[index] = url;
          return next;
        });
        el.pause();
        el.currentTime = 0;
        el.src = url;
        setPlayingIndex(index);
        el.play().catch((err) => {
          console.warn("[AI Coach TTS] play failed:", err);
          done();
        });
      } catch (err) {
        console.warn("[AI Coach TTS] fetch failed:", err);
        done();
      }
    },
    [setMessageAudioUrls]
  );

  const onVoiceCallPlaybackDone = useCallback(() => {
    setCallStatus("listening");
    startCallRecognitionRef.current?.();
  }, []);

  const processVoiceCallQueueRef = useRef<() => void>(() => {});
  const processVoiceCallQueue = useCallback(() => {
    if (voiceCallPlayingRef.current) return;
    const queue = voiceCallTtsQueueRef.current;
    if (queue.length === 0) {
      onVoiceCallPlaybackDone();
      return;
    }
    setCallStatus("speaking");
    voiceCallQueueOnEndedRef.current = () => {
      voiceCallPlayingRef.current = false;
      if (voiceCallCurrentUrlRef.current) {
        URL.revokeObjectURL(voiceCallCurrentUrlRef.current);
        voiceCallCurrentUrlRef.current = null;
      }
      queue.shift();
      processVoiceCallQueueRef.current?.();
    };
    const first = queue[0];
    const el = audioRef.current;
    if (!el) {
      queue.shift();
      processVoiceCallQueueRef.current?.();
      return;
    }
    const playUrl = (url: string) => {
      el.pause();
      el.currentTime = 0;
      el.src = url;
      voiceCallCurrentUrlRef.current = url;
      voiceCallPlayingRef.current = true;
      setPlayingIndex(lastMessageIndexRef.current);
      el.play().catch(() => {
        voiceCallPlayingRef.current = false;
        queue.shift();
        processVoiceCallQueueRef.current?.();
      });
    };
    const preFetchForIndex = (index: number) => {
      const text = queue[index];
      if (!text?.trim()) return;
      fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: stripMarkdown(text).trim() }),
      })
        .then((r) => (r.ok ? r.blob() : null))
        .then((blob) => {
          if (blob && isVoiceCallRef.current && voiceCallPreFetchedUrlRef.current === null)
            voiceCallPreFetchedUrlRef.current = URL.createObjectURL(blob);
        })
        .catch(() => {});
    };
    if (voiceCallPreFetchedUrlRef.current) {
      const url = voiceCallPreFetchedUrlRef.current;
      voiceCallPreFetchedUrlRef.current = null;
      playUrl(url);
      preFetchForIndex(1);
    } else {
      const plain = stripMarkdown(first).trim();
      if (!plain) {
        queue.shift();
        processVoiceCallQueueRef.current?.();
        return;
      }
      fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: plain }),
      })
        .then((r) => (r.ok ? r.blob() : null))
        .then((blob) => {
          if (!blob) {
            queue.shift();
            processVoiceCallQueueRef.current?.();
            return;
          }
          const url = URL.createObjectURL(blob);
          playUrl(url);
          preFetchForIndex(1);
        })
        .catch(() => {
          queue.shift();
          processVoiceCallQueueRef.current?.();
        });
    }
  }, [onVoiceCallPlaybackDone]);
  processVoiceCallQueueRef.current = processVoiceCallQueue;

  const onAssistantStreamChunkRef = useRef<(sentence: string) => void>(() => {});
  onAssistantStreamChunkRef.current = (sentence: string) => {
    if (!isVoiceCallRef.current) return;
    const t = stripMarkdown(sentence).trim();
    if (!t) return;
    voiceCallTtsQueueRef.current.push(t);
    processVoiceCallQueue();
  };

  const onAssistantCompleteRef = useRef<(text: string) => void>(() => {});
  onAssistantCompleteRef.current = (text: string) => {
    if (isVoiceCallRef.current) {
      if (!text?.trim()) {
        setCallStatus("listening");
        startCallRecognitionRef.current?.();
        return;
      }
      // Chunked TTS is handled by stream chunks; do not play full text here.
      return;
    }
    if (!mutedRef.current) playTTS(text, lastMessageIndexRef.current);
  };

  const { messages, sendMessage, generateImage, clearChat, isLoading } = useChatCoach(pageContext, {
    initialMessages,
    onMessagesChange,
    onAssistantComplete: (text) => onAssistantCompleteRef.current(text),
    onAssistantStreamChunk: (sentence) => onAssistantStreamChunkRef.current(sentence),
    productId: productId ?? undefined,
    voiceCallMode: isVoiceCall,
  });

  useEffect(() => {
    lastMessageIndexRef.current = messages.length > 0 ? messages.length - 1 : 0;
  }, [messages]);

  const SpeechRecognitionClass = getSpeechRecognitionClass();

  const toggleVoiceInput = useCallback(() => {
    if (!SpeechRecognitionClass) {
      toast({ title: "Voice input not supported in this browser" });
      return;
    }
    if (isLoading) return;

    const recognition = recognitionRef.current;
    if (isRecording && recognition) {
      recognition.stop();
      return;
    }

    transcriptRef.current = "";
    const rec = new SpeechRecognitionClass();
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: { results: SpeechRecognitionResultList }) => {
      let full = "";
      for (let i = 0; i < e.results.length; i++) {
        const result = e.results.item ? e.results.item(i) : e.results[i];
        if (result.isFinal && result.length > 0) {
          const alt = result.item ? result.item(0) : result[0];
          full += (alt?.transcript ?? "").trim() + " ";
        }
      }
      if (full) transcriptRef.current = full.trim();
    };
    rec.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
      const finalText = transcriptRef.current.trim();
      if (finalText && textareaRef.current) {
        textareaRef.current.value = finalText;
        sendMessage(finalText);
        textareaRef.current.value = "";
        if (textareaRef.current.style) textareaRef.current.style.height = "auto";
      }
    };
    rec.onerror = (e: { error: string }) => {
      if (e.error !== "aborted") setIsRecording(false);
      recognitionRef.current = null;
    };
    try {
      rec.start();
      recognitionRef.current = rec;
      setIsRecording(true);
    } catch {
      setIsRecording(false);
      recognitionRef.current = null;
    }
  }, [SpeechRecognitionClass, isRecording, isLoading, toast, sendMessage]);

  const startCallRecognition = useCallback(() => {
    const Klass = getSpeechRecognitionClass();
    if (!Klass || !isVoiceCallRef.current) return;
    if (callRecognitionRef.current) {
      try {
        callRecognitionRef.current.abort();
      } catch {
        // ignore
      }
      callRecognitionRef.current = null;
    }
    callTranscriptRef.current = "";
    const rec = new Klass();
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: { results: SpeechRecognitionResultList }) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results.item ? e.results.item(i) : e.results[i];
        if (r.isFinal && r.length > 0) {
          const alt = r.item ? r.item(0) : r[0];
          t += (alt?.transcript ?? "").trim() + " ";
        }
      }
      if (t) callTranscriptRef.current = t.trim();
    };
    rec.onend = () => {
      setCallStatus("processing");
      const transcript = callTranscriptRef.current.trim();
      if (transcript) {
        sendMessage(transcript);
      }
      callRecognitionRef.current = null;
    };
    rec.onerror = () => {
      callRecognitionRef.current = null;
    };
    try {
      rec.start();
      callRecognitionRef.current = rec;
    } catch {
      callRecognitionRef.current = null;
    }
  }, [sendMessage]);

  const startCallRecognitionRef = useRef(startCallRecognition);
  startCallRecognitionRef.current = startCallRecognition;

  const endCall = useCallback(() => {
    if (callRecognitionRef.current) {
      try {
        callRecognitionRef.current.abort();
      } catch {
        // ignore
      }
      callRecognitionRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.removeAttribute("src");
    }
    voiceCallTtsQueueRef.current = [];
    voiceCallPlayingRef.current = false;
    if (voiceCallPreFetchedUrlRef.current) {
      URL.revokeObjectURL(voiceCallPreFetchedUrlRef.current);
      voiceCallPreFetchedUrlRef.current = null;
    }
    if (voiceCallCurrentUrlRef.current) {
      URL.revokeObjectURL(voiceCallCurrentUrlRef.current);
      voiceCallCurrentUrlRef.current = null;
    }
    setPlayingIndex(null);
    setIsVoiceCall(false);
  }, []);

  const handleStartVoiceCall = useCallback(() => {
    if (!getSpeechRecognitionClass()) {
      toast({ title: "Voice call not supported in this browser — try Chrome." });
      return;
    }
    setIsVoiceCall(true);
    setCallStatus("listening");
    setTimeout(() => startCallRecognition(), 0);
  }, [toast, startCallRecognition]);

  useEffect(() => {
    if (messages.length) scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = containerRef.current ?? document;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file" && item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            if (dataUrl) setPendingImageUrls((prev) => [...prev, dataUrl]);
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    };
    el.addEventListener("paste", onPaste);
    return () => el.removeEventListener("paste", onPaste);
  }, []);

  const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });

  const extractPdfText = async (file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/extract-pdf-text", { method: "POST", body: form });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || "Failed to extract PDF text");
    }
    const data = (await res.json()) as { text?: string };
    return data.text ?? "";
  };

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      e.target.value = "";
      const imageTypes = ["image/jpeg", "image/png", "image/webp"];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const lowerName = file.name.toLowerCase();
        if (imageTypes.includes(file.type) || /\.(jpe?g|png|webp)$/i.test(lowerName)) {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Failed to read image"));
            reader.readAsDataURL(file);
          });
          setPendingImageUrls((prev) => [...prev, dataUrl]);
        } else if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
          try {
            const text = await extractPdfText(file);
            setPendingFiles((prev) => [...prev, { name: file.name, text }]);
          } catch (err) {
            toast({
              title: "Could not read PDF",
              description: err instanceof Error ? err.message : "Unknown error",
            });
          }
        } else if (file.type === "text/plain" || lowerName.endsWith(".txt")) {
          const text = await readFileAsText(file);
          setPendingFiles((prev) => [...prev, { name: file.name, text }]);
        } else {
          toast({ title: "Unsupported file type", description: "Use images (jpg, png, webp), PDF, or txt." });
        }
      }
    },
    [toast]
  );

  const removePendingImage = useCallback((index: number) => {
    setPendingImageUrls((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const replayAudio = useCallback(
    async (index: number) => {
      const msg = messages[index];
      if (msg?.role !== "assistant" || !msg.content?.trim()) return;

      const el = audioRef.current;
      if (playingIndex === index) {
        if (el) {
          el.pause();
          el.currentTime = 0;
          el.removeAttribute("src");
        }
        setPlayingIndex(null);
        return;
      }

      let url = audioUrlsRef.current[index];
      if (!url) {
        const plainText = stripMarkdown(msg.content);
        try {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: plainText }),
          });
          if (!res.ok) return;
          const blob = await res.blob();
          url = URL.createObjectURL(blob);
          setMessageAudioUrls((prev) => {
            const next = { ...prev };
            if (prev[index]) URL.revokeObjectURL(prev[index]);
            next[index] = url!;
            return next;
          });
        } catch {
          return;
        }
      }

      if (el) {
        el.pause();
        el.currentTime = 0;
        el.src = url;
        setPlayingIndex(index);
        el.play().catch(() => setPlayingIndex(null));
      }
    },
    [messages, setMessageAudioUrls, playingIndex]
  );

  const handleClearChat = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.removeAttribute("src");
    }
    setPlayingIndex(null);
    setPendingImageUrls([]);
    setPendingFiles([]);
    Object.values(messageAudioUrls).forEach(URL.revokeObjectURL);
    setMessageAudioUrls({});
    clearChat();
  }, [clearChat, messageAudioUrls, setMessageAudioUrls]);

  useEffect(() => {
    return () => {
      Object.values(audioUrlsRef.current).forEach(URL.revokeObjectURL);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.removeAttribute("src");
      }
    };
  }, [audioRef, audioUrlsRef]);

  const handleSend = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const value = ta.value.trim();
    const hasImages = pendingImageUrls.length > 0;
    const hasFiles = pendingFiles.length > 0;
    if ((!value && !hasImages && !hasFiles) || isLoading) return;
    ta.value = "";
    const attachments =
      hasImages || hasFiles
        ? { imageUrls: pendingImageUrls.length ? pendingImageUrls : undefined, attachedFiles: pendingFiles.length ? pendingFiles : undefined }
        : undefined;
    sendMessage(value || (hasImages || hasFiles ? "(no text)" : ""), attachments);
    setPendingImageUrls([]);
    setPendingFiles([]);
    ta.style.height = "auto";
  };

  const handleGenerateImage = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const value = ta.value.trim();
    if (!value || isLoading) return;
    ta.value = "";
    generateImage(value);
    ta.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, maxTextareaHeight)}px`;
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full min-h-0">
      <audio
        ref={audioRef}
        className="hidden"
        playsInline
        aria-hidden
        onEnded={() => {
          setPlayingIndex(null);
          if (isVoiceCallRef.current) voiceCallQueueOnEndedRef.current?.();
        }}
      />
      <div className="shrink-0 border-b border-[#E5E7EB] dark:border-white/10 bg-white dark:bg-[#1A1A1A] px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">AI Coach</h1>
          {playingIndex !== null && (
            <span
              className="relative flex h-2 w-2"
              aria-hidden
            >
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isVoiceCall ? (
            <>
              {productId && productName ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-orange-500/15 text-orange-700 dark:text-orange-300 px-2.5 py-1.5 text-sm">
                  <Package className="h-4 w-4 shrink-0" />
                  <span className="max-w-[160px] truncate">Talking about: {productName}</span>
                  <button
                    type="button"
                    onClick={() => onProductContextChange(null)}
                    className="rounded p-0.5 hover:bg-orange-500/20"
                    aria-label="Remove product context"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-white/20"
                    aria-label="Add product context"
                    title="Attach a product to this conversation"
                  >
                    <Package className="h-4 w-4" />
                    Add Product Context
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-[280px] overflow-y-auto">
                  {products.length === 0 ? (
                    <DropdownMenuItem disabled className="text-slate-500">
                      No products yet
                    </DropdownMenuItem>
                  ) : (
                    products.map((p) => (
                      <DropdownMenuItem
                        key={p.id}
                        onClick={() => onProductContextChange(p.id, p.title)}
                        className="flex flex-col items-start gap-0.5 py-2"
                      >
                        <span className="font-medium truncate max-w-full">{p.title}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                          {p.format || "Product"}
                        </span>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleStartVoiceCall}
                className="shrink-0 gap-1.5 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-white/20"
                aria-label="Start voice call"
                title="Start voice call"
              >
                <Phone className="h-4 w-4" />
                Start Voice Call
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onMutedChange(!muted)}
                className={cn(
                  "shrink-0",
                  muted ? "text-slate-500 dark:text-slate-400" : "text-orange-500 dark:text-orange-400"
                )}
                aria-label={muted ? "Unmute speech" : "Mute speech"}
                title={muted ? "Unmute" : "Mute TTS"}
              >
                {muted ? (
                  <VolumeX className="h-5 w-5" aria-hidden />
                ) : (
                  <Volume2 className="h-5 w-5 fill-current" aria-hidden />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearChat}
                className="text-slate-600 dark:text-slate-400"
              >
                Clear Chat
              </Button>
            </>
          ) : (
            <span className="text-sm text-slate-500 dark:text-slate-400">Voice call active</span>
          )}
        </div>
      </div>

      {isVoiceCall ? (
        <div className="flex-1 flex flex-col min-h-0 bg-[#F9FAFB] dark:bg-[#0F0F0F]">
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="flex flex-col items-center gap-6">
              <div className="relative flex items-center justify-center">
                <span className="absolute inline-flex h-24 w-24 rounded-full bg-orange-400/30 animate-ping" />
                <span className="relative inline-flex h-24 w-24 rounded-full bg-orange-500 dark:bg-orange-500" />
              </div>
              <p className="text-lg font-medium text-slate-700 dark:text-slate-300">
                {callStatus === "listening" && "Listening…"}
                {callStatus === "processing" && "Thinking…"}
                {callStatus === "speaking" && "Speaking…"}
              </p>
            </div>
          </div>
          <div className="shrink-0 flex justify-center pb-6">
            <Button
              type="button"
              variant="destructive"
              size="lg"
              onClick={endCall}
              className="gap-2"
              aria-label="End call"
            >
              <PhoneOff className="h-5 w-5" />
              End Call
            </Button>
          </div>
        </div>
      ) : (
      <>
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="mx-auto w-full max-w-[800px] px-4 py-6">
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 justify-center pt-8 pb-4">
              {STARTER_CHIPS.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => sendMessage(label)}
                  disabled={isLoading}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors",
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

          <div className="space-y-6 py-4">
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
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap shadow-sm",
                    msg.role === "user"
                      ? "bg-orange-500 text-white dark:bg-orange-500"
                      : "bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-gray-100 border border-[#E5E7EB] dark:border-white/10"
                  )}
                >
                  {msg.role === "user" && msg.imageUrls && msg.imageUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {msg.imageUrls.map((url, j) => (
                        <img
                          key={j}
                          src={url}
                          alt=""
                          className="rounded-lg max-h-32 w-auto object-contain bg-white/10"
                        />
                      ))}
                    </div>
                  )}
                  {msg.role === "user" && msg.attachedFiles && msg.attachedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {msg.attachedFiles.map((f, j) => (
                        <span
                          key={j}
                          className="inline-flex items-center gap-1 rounded-md bg-white/20 px-2 py-1 text-xs"
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate max-w-[120px]">{f.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {(msg.role === "user" && msg.content && msg.content !== "(no text)" && (
                    <span className={(msg.imageUrls?.length || msg.attachedFiles?.length) ? "block mt-2" : ""}>
                      {stripMarkdown(msg.content)}
                    </span>
                  )) ||
                    (msg.role === "assistant" && (msg.content || (isLoading && i === messages.length - 1)) && (
                      <span>{stripMarkdown(msg.content || "…")}</span>
                    ))}
                  {msg.role === "assistant" && msg.imageUrl && (
                    <div className="mt-2">
                      <img
                        src={msg.imageUrl}
                        alt="Generated"
                        className="rounded-lg max-w-full h-auto"
                      />
                    </div>
                  )}
                  {msg.role === "assistant" && (msg.content || msg.imageUrl) && msg.content?.trim() && (
                    <div className="mt-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => replayAudio(i)}
                        className={cn(
                          "rounded p-1 transition-colors",
                          playingIndex === i
                            ? "text-orange-500 dark:text-orange-400 bg-orange-500/10"
                            : "text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-white/10"
                        )}
                        aria-label={playingIndex === i ? "Stop playback" : "Play message"}
                        title={playingIndex === i ? "Stop" : "Play"}
                      >
                        <Volume2
                          className={cn("h-4 w-4", playingIndex === i && "fill-current animate-pulse")}
                        />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-[#E5E7EB] dark:border-white/10 bg-white dark:bg-[#1A1A1A] px-4 py-4">
        {(pendingImageUrls.length > 0 || pendingFiles.length > 0) && (
          <div className="mx-auto max-w-[800px] flex flex-wrap gap-2 mb-2">
            {pendingImageUrls.map((url, i) => (
              <div key={`img-${i}`} className="relative inline-block">
                <img
                  src={url}
                  alt=""
                  className="h-14 w-14 rounded-lg object-cover border border-[#E5E7EB] dark:border-white/20"
                />
                <button
                  type="button"
                  onClick={() => removePendingImage(i)}
                  className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 text-white p-0.5 hover:bg-red-600"
                  aria-label="Remove image"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {pendingFiles.map((f, i) => (
              <span
                key={`file-${i}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 dark:bg-white/10 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate max-w-[140px]">{f.name}</span>
                <button
                  type="button"
                  onClick={() => removePendingFile(i)}
                  className="rounded p-0.5 hover:bg-slate-200 dark:hover:bg-white/20"
                  aria-label="Remove file"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        {isRecording && (
          <div className="mx-auto max-w-[800px] flex items-center gap-2 mb-2 text-sm text-red-600 dark:text-red-400">
            <span className="flex gap-1 items-end h-3">
              <span className="w-1.5 h-3 bg-current rounded-full origin-bottom animate-[voice-wave_0.5s_ease-in-out_infinite] [animation-delay:-0.4s]" />
              <span className="w-1.5 h-3 bg-current rounded-full origin-bottom animate-[voice-wave_0.5s_ease-in-out_infinite] [animation-delay:-0.2s]" />
              <span className="w-1.5 h-3 bg-current rounded-full origin-bottom animate-[voice-wave_0.5s_ease-in-out_infinite]" />
              <span className="w-1.5 h-3 bg-current rounded-full origin-bottom animate-[voice-wave_0.5s_ease-in-out_infinite] [animation-delay:0.2s]" />
              <span className="w-1.5 h-3 bg-current rounded-full origin-bottom animate-[voice-wave_0.5s_ease-in-out_infinite] [animation-delay:0.4s]" />
            </span>
            <span>Listening…</span>
          </div>
        )}
        <div className="mx-auto max-w-[800px] flex gap-2 items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,application/pdf,.pdf,text/plain,.txt"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <textarea
            ref={textareaRef}
            placeholder={isRecording ? "Speak now…" : "Ask your coach or describe an image…"}
            onKeyDown={handleKeyDown}
            onInput={handleTextareaInput}
            disabled={isLoading}
            rows={1}
            className={cn(
              "flex-1 min-h-[2.5rem] max-h-[9rem] resize-none overflow-y-auto rounded-md border border-[#E5E7EB] dark:border-white/10",
              "bg-[#F9FAFB] dark:bg-[#0F0F0F] px-3 py-2 text-sm ring-offset-background",
              "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isRecording}
            className="shrink-0 h-10 w-10 border-[#E5E7EB] dark:border-white/10"
            title="Attach file (images, PDF, txt)"
            aria-label="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleGenerateImage}
            disabled={isLoading || isRecording}
            className="shrink-0 h-10 w-10 border-[#E5E7EB] dark:border-white/10"
            title="Generate image"
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={toggleVoiceInput}
            disabled={isLoading}
            className={cn(
              "shrink-0 h-10 w-10 border-[#E5E7EB] dark:border-white/10",
              isRecording && "bg-red-500 border-red-500 text-white hover:bg-red-600 hover:text-white animate-pulse"
            )}
            title={isRecording ? "Stop recording" : "Voice input"}
            aria-label={isRecording ? "Stop recording" : "Start voice input"}
          >
            <Mic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            onClick={handleSend}
            disabled={isLoading}
            className="bg-orange-500 hover:bg-orange-600 dark:bg-orange-500 dark:hover:bg-orange-600 shrink-0 h-10 w-10"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
