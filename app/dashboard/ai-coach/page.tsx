"use client";

import { usePathname } from "next/navigation";
import { useRef, useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { Send, Loader2, Volume2, VolumeX, ImagePlus, Plus, Search, Trash2, Mic, Phone, PhoneOff, Paperclip, FileText, X, ChevronDown, ChevronLeft, ChevronRight, Package, Copy, BookOpen, Sparkles, Save, Pencil, Download, Pin, AudioLines, Play, Square, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useChatCoach } from "@/hooks/useChatCoach";
import type { CoachMessage } from "@/hooks/useChatCoach";
import { cn } from "@/lib/utils";
import { YouTubeScriptActionPanel } from "./YouTubeScriptActionPanel";

const SESSIONS_KEY = "ai-coach-sessions";
const SIDEBAR_COLLAPSED_KEY = "ai_coach_sidebar_collapsed";
const COACH_MODE_KEY = "coach_mode";
const TITLE_MAX_LEN = 30;

const COACH_MODES = [
  { id: "business", label: "Business Strategy", emoji: "🧠" },
  { id: "finance", label: "Finance & Pricing", emoji: "💰" },
  { id: "content", label: "Content & Marketing", emoji: "📱" },
  { id: "youtube", label: "YouTube Strategy", emoji: "🎬" },
  { id: "goals", label: "Goal Setting", emoji: "🎯" },
  { id: "general", label: "General Chat", emoji: "💬" },
] as const;

type Session = {
  id: string;
  title: string;
  messages: CoachMessage[];
  createdAt: number;
  isPinned?: boolean;
  productId?: string | null;
  productName?: string | null;
};

/** Format chat created_at for sidebar: "Today, 2:32pm" | "Yesterday, 10:15am" | "06 Mar 2026, 3:45pm" */
function formatChatDate(createdAt: number | string): string {
  const date = typeof createdAt === "number" ? new Date(createdAt) : new Date(createdAt);
  const now = new Date();
  const sameDay = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();
  const time = date.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
  if (sameDay) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  const day = date.getDate().toString().padStart(2, "0");
  const month = date.toLocaleString("en-GB", { month: "short" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}, ${time}`;
}

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
    isPinned: false,
  };
}

/** Create a session via API (used for new chats so they appear in Supabase). */
async function createSessionViaApi(title: string = "New Chat"): Promise<Session> {
  const res = await fetch("/api/chat/coach/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Failed to create chat");
  }
  const data = (await res.json()) as { id: string; title: string; createdAt: string; isPinned: boolean };
  return {
    id: data.id,
    title: data.title,
    messages: [],
    createdAt: new Date(data.createdAt).getTime(),
    isPinned: data.isPinned ?? false,
  };
}

const STARTER_CHIPS = [
  "Help me generate a product idea",
  "What should I create next?",
  "How do I market my ebook?",
];

/** Empty state: 6 suggested prompts in 2x3 grid; click pre-fills and auto-sends */
const EMPTY_STATE_PROMPTS: { title: string; icon: React.ReactNode }[] = [
  { title: "Generate a digital product idea for my niche", icon: <Package className="h-5 w-5" /> },
  { title: "Write a TikTok script for my product", icon: <FileText className="h-5 w-5" /> },
  { title: "Help me price my digital product", icon: <Package className="h-5 w-5" /> },
  { title: "Create a marketing plan for this week", icon: <FileText className="h-5 w-5" /> },
  { title: "Review my product description", icon: <FileText className="h-5 w-5" /> },
  { title: "What should I focus on today?", icon: <Sparkles className="h-5 w-5" /> },
];

/** 20 prompts for Prompts Library slide-out, by category */
const PROMPTS_LIBRARY: { category: string; prompts: string[] }[] = [
  { category: "Product Creation", prompts: ["Generate a digital product idea for my niche", "Help me outline an ebook on [topic]", "Give me 5 workbook ideas for [audience]", "What format sells best for [niche]?"] },
  { category: "Marketing", prompts: ["Create a marketing plan for this week", "Write 5 email subject lines for my launch", "Suggest a social content calendar for the next 7 days", "How do I market my ebook?"] },
  { category: "TikTok", prompts: ["Write a TikTok script for my product", "Hook ideas for a 60-second product demo", "Script a before/after transformation video", "Caption ideas for a product unboxing"] },
  { category: "Pricing", prompts: ["Help me price my digital product", "Should I offer a payment plan?", "Bundle pricing strategy for [product types]", "Compare one-time vs subscription for my product"] },
  { category: "Strategy", prompts: ["What should I focus on today?", "Review my product description", "Prioritise my backlog: [list]", "Give me 3 next steps to grow my digital business"] },
];

function ChatListItem({
  s,
  activeId,
  editingSessionId,
  editingTitle,
  setEditingTitle,
  onSelect,
  onPin,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  titleMaxLen,
  formatChatDate,
}: {
  s: Session;
  activeId: string | null;
  editingSessionId: string | null;
  editingTitle: string;
  setEditingTitle: (v: string) => void;
  onSelect: () => void;
  onPin: (e: React.MouseEvent) => void;
  onStartEdit: (e: React.MouseEvent) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (e: React.MouseEvent) => void;
  titleMaxLen: number;
  formatChatDate: (createdAt: number | string) => string;
}) {
  const isActive = s.id === activeId;
  const isEditing = editingSessionId === s.id;
  const displayTitle = s.title.length > titleMaxLen ? s.title.slice(0, titleMaxLen) + "…" : s.title;

  return (
    <li>
      <div
        className={cn(
          "group w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
          isActive
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <button
          type="button"
          onClick={onSelect}
          className="flex-1 min-w-0 flex flex-col items-start gap-0.5"
        >
          <span className="flex items-center gap-1.5 w-full min-w-0">
            {(s.isPinned ?? false) && <Pin className="h-3 w-3 shrink-0 text-muted-foreground" />}
            {isEditing ? (
              <Input
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") onSaveEdit();
                  if (e.key === "Escape") onCancelEdit();
                }}
                onBlur={() => onSaveEdit()}
                onClick={(e) => e.stopPropagation()}
                className="h-7 text-sm flex-1 min-w-0"
                autoFocus
              />
            ) : (
              <span className="truncate flex-1">{displayTitle || "New Chat"}</span>
            )}
          </span>
          {!isEditing && (
            <span className="text-[11px] text-muted-foreground/80">
              {formatChatDate(s.createdAt)}
            </span>
          )}
        </button>
        {!isEditing && (
          <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={onPin}
              className={cn(
                "p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/80",
                (s.isPinned ?? false) && "opacity-100 text-foreground"
              )}
              aria-label={s.isPinned ? "Unpin" : "Pin"}
              title={s.isPinned ? "Unpin" : "Pin"}
            >
              <Pin className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onStartEdit}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/80"
              aria-label="Edit title"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted/80"
              aria-label="Delete conversation"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function MemorySetupForm({
  userName: initialUserName,
  coachName: initialCoachName,
  onSave,
}: {
  userName: string;
  coachName: string;
  onSave: (userName: string, coachName: string) => void;
}) {
  const [userName, setUserName] = useState(initialUserName);
  const [coachName, setCoachName] = useState(initialCoachName || "Coach");
  useEffect(() => {
    setUserName(initialUserName);
    setCoachName(initialCoachName || "Coach");
  }, [initialUserName, initialCoachName]);
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="memory-user-name">What should I call you?</Label>
        <Input
          id="memory-user-name"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="Your name"
          className="w-full"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="memory-coach-name">What would you like to call your coach?</Label>
        <Input
          id="memory-coach-name"
          value={coachName}
          onChange={(e) => setCoachName(e.target.value)}
          placeholder="Coach"
          className="w-full"
        />
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(userName.trim(), (coachName.trim() || "Coach"))}>Save</Button>
      </DialogFooter>
    </div>
  );
}

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

const TIKTOK_URL_RE = /https?:\/\/(?:www\.)?tiktok\.com\/@([\w.]+)/i;

export default function AICoachPage() {
  const pathname = usePathname();
  const pageContext = pathname ?? "";
  const { user } = useUser();
  const firstName = (user?.firstName?.trim() || user?.firstName) ?? "";
  const userEmail = user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() ?? "";
  const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const isAdminUser = !!adminEmail && userEmail === adminEmail;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [muted, setMuted] = useState(false);
  const [messageAudioUrls, setMessageAudioUrls] = useState<Record<number, string>>({});
  const [promptToSend, setPromptToSend] = useState<string | null>(null);
  const [promptsLibraryOpen, setPromptsLibraryOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [coachMode, setCoachMode] = useState<string>("business");
  const [coachSettings, setCoachSettings] = useState<{
    memoryEnabled: boolean;
    coachName: string;
    userName: string;
  }>({ memoryEnabled: false, coachName: "Coach", userName: "" });
  const [previousSummaries, setPreviousSummaries] = useState<string[]>([]);
  const [memorySetupModalOpen, setMemorySetupModalOpen] = useState(false);

  // Pre-acquire mic stream on page load so permission is granted immediately — zero delay on first mic click
  const micStreamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        micStreamRef.current = stream;
      })
      .catch(() => {});
    return () => {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ai-coach-muted");
      setMuted(stored === "true");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      setSidebarCollapsed(stored === "true");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COACH_MODE_KEY);
      if (stored && COACH_MODES.some((m) => m.id === stored)) setCoachMode(stored);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetch("/api/chat/coach/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { memoryEnabled?: boolean; coachName?: string; userName?: string } | null) => {
        if (data) setCoachSettings({
          memoryEnabled: data.memoryEnabled ?? false,
          coachName: data.coachName ?? "Coach",
          userName: data.userName ?? "",
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!coachSettings.memoryEnabled || !activeId) {
      setPreviousSummaries([]);
      return;
    }
    fetch("/api/chat/coach/summaries")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { summaries?: string[] } | null) => {
        if (data?.summaries) setPreviousSummaries(data.summaries);
      })
      .catch(() => setPreviousSummaries([]));
  }, [coachSettings.memoryEnabled, activeId]);

  const saveSummaryForSession = useCallback(async (session: Session) => {
    if (!session.messages.length) return;
    const body = { messages: session.messages.map((m) => ({ role: m.role, content: m.content ?? "" })) };
    try {
      await fetch("/api/chat/coach/summaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
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
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/chat/coach/chats");
        const apiChats = res.ok ? ((await res.json()) as { id: string; title: string; createdAt: string; isPinned: boolean }[]) : [];
        const local = loadSessions();
        if (apiChats.length > 0) {
          const merged: Session[] = apiChats.map((c) => {
            const localSession = local.find((s) => s.id === c.id);
            return {
              id: c.id,
              title: c.title,
              messages: localSession?.messages ?? [],
              createdAt: new Date(c.createdAt).getTime(),
              isPinned: c.isPinned ?? false,
              productId: localSession?.productId,
              productName: localSession?.productName,
            };
          });
          if (!cancelled) {
            setSessions(merged);
            if (!activeId || !merged.some((s) => s.id === activeId)) setActiveId(merged[0]?.id ?? null);
          }
          return;
        }
        if (local.length > 0) {
          const created: Session[] = [];
          for (const s of local) {
            try {
              const createdOne = await createSessionViaApi(s.title);
              created.push({
                ...createdOne,
                messages: s.messages,
                productId: s.productId,
                productName: s.productName,
              });
            } catch {
              created.push({ ...s, isPinned: s.isPinned ?? false });
            }
          }
          if (!cancelled) {
            setSessions(created);
            if (!activeId || !created.some((c) => c.id === activeId)) setActiveId(created[0]?.id ?? null);
          }
          return;
        }
        const newSession = await createSessionViaApi("New Chat");
        if (!cancelled) {
          setSessions([newSession]);
          setActiveId(newSession.id);
        }
      } catch {
        const loaded = loadSessions();
        if (!cancelled) {
          if (loaded.length === 0) {
            const newSession = createSession();
            setSessions([newSession]);
            setActiveId(newSession.id);
          } else {
            setSessions(loaded.map((s) => ({ ...s, isPinned: s.isPinned ?? false })));
            if (!activeId || !loaded.some((s) => s.id === activeId)) setActiveId(loaded[0].id);
          }
        }
      }
    })();
    return () => { cancelled = true; };
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
          const newTitle =
            s.title === "New Chat" && messages.length > 0 ? firstUserMessageTitle(messages) : s.title;
          if (newTitle !== s.title) {
            fetch(`/api/chat/coach/chats/${s.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: newTitle }),
            }).catch(() => {});
          }
          return { ...s, messages, title: newTitle };
        })
      );
    },
    [activeId]
  );

  const handleCoachModeChange = useCallback(
    (modeId: string) => {
      setCoachMode(modeId);
      try {
        localStorage.setItem(COACH_MODE_KEY, modeId);
      } catch {
        // ignore
      }
      const label = COACH_MODES.find((m) => m.id === modeId)?.label ?? modeId;
      const active = sessions.find((s) => s.id === activeId);
      if (active) {
        updateActiveSessionMessages([
          ...active.messages,
          { role: "assistant", content: `Switched to ${label} mode.` },
        ]);
      }
    },
    [sessions, activeId, updateActiveSessionMessages]
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

  const handleNewChat = useCallback(async () => {
    const leaving = sessions.find((s) => s.id === activeId);
    if (coachSettings.memoryEnabled && leaving && leaving.messages.length > 0) {
      saveSummaryForSession(leaving);
    }
    try {
      const newSession = await createSessionViaApi("New Chat");
      setSessions((prev) => [newSession, ...prev]);
      setActiveId(newSession.id);
      setPromptToSend(null);
    } catch {
      const newSession = createSession();
      setSessions((prev) => [newSession, ...prev]);
      setActiveId(newSession.id);
      setPromptToSend(null);
    }
  }, [sessions, activeId, coachSettings.memoryEnabled, saveSummaryForSession]);

  const handleEmptyStateCardClick = useCallback(async (prompt: string) => {
    try {
      const newSession = await createSessionViaApi("New Chat");
      setSessions((prev) => [newSession, ...prev]);
      setActiveId(newSession.id);
      setPromptToSend(prompt);
    } catch {
      const newSession = createSession();
      setSessions((prev) => [newSession, ...prev]);
      setActiveId(newSession.id);
      setPromptToSend(prompt);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        handleNewChat();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleNewChat]);

  const saveCoachSettings = useCallback(
    async (updates: { memoryEnabled?: boolean; coachName?: string; userName?: string }) => {
      try {
        const res = await fetch("/api/chat/coach/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            memoryEnabled: updates.memoryEnabled ?? coachSettings.memoryEnabled,
            coachName: updates.coachName ?? coachSettings.coachName,
            userName: updates.userName ?? coachSettings.userName,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { memoryEnabled: boolean; coachName: string; userName: string };
          setCoachSettings(data);
        }
      } catch {
        // ignore
      }
    },
    [coachSettings.memoryEnabled, coachSettings.coachName, coachSettings.userName]
  );

  const handleMemoryToggle = useCallback(
    (checked: boolean) => {
      setCoachSettings((prev) => ({ ...prev, memoryEnabled: checked }));
      saveCoachSettings({ memoryEnabled: checked });
      if (checked && !coachSettings.userName?.trim()) setMemorySetupModalOpen(true);
    },
    [coachSettings.userName, saveCoachSettings]
  );

  const switchToSession = useCallback(
    (id: string) => {
      if (id === activeId) return;
      const leaving = sessions.find((s) => s.id === activeId);
      if (coachSettings.memoryEnabled && leaving && leaving.messages.length > 0) {
        saveSummaryForSession(leaving);
      }
      setActiveId(id);
    },
    [activeId, sessions, coachSettings.memoryEnabled, saveSummaryForSession]
  );

  const handleDeleteSession = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await fetch(`/api/chat/coach/chats/${id}`, { method: "DELETE" });
      } catch {
        // continue to update local state
      }
      const nextSessions = sessions.filter((s) => s.id !== id);
      if (nextSessions.length === 0) {
        try {
          const newSession = await createSessionViaApi("New Chat");
          setSessions([newSession]);
          setActiveId(newSession.id);
        } catch {
          const newSession = createSession();
          setSessions([newSession]);
          setActiveId(newSession.id);
        }
      } else {
        const nextActiveId = activeId === id ? nextSessions[0].id : activeId;
        setSessions(nextSessions);
        setActiveId(nextActiveId);
      }
    },
    [sessions, activeId]
  );

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const handlePinSession = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      const session = sessions.find((s) => s.id === id);
      if (!session) return;
      const nextPinned = !(session.isPinned ?? false);
      try {
        await fetch(`/api/chat/coach/chats/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_pinned: nextPinned }),
        });
      } catch {
        // update local only
      }
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isPinned: nextPinned } : s))
      );
    },
    [sessions]
  );

  const handleStartEditSession = useCallback((e: React.MouseEvent, s: Session) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingSessionId(s.id);
    setEditingTitle(s.title);
  }, []);

  const handleSaveEditSession = useCallback(
    async (id: string) => {
      const title = editingTitle.trim() || "New Chat";
      setEditingSessionId(null);
      setEditingTitle("");
      try {
        await fetch(`/api/chat/coach/chats/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
      } catch {
        // update local only
      }
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title } : s))
      );
    },
    [editingTitle]
  );

  const handleCancelEditSession = useCallback(() => {
    setEditingSessionId(null);
    setEditingTitle("");
  }, []);

  const filteredSessions = searchQuery.trim()
    ? sessions
        .filter((s) => s.title.toLowerCase().includes(searchQuery.trim().toLowerCase()))
        .sort((a, b) => {
          const aPin = a.isPinned ?? false;
          const bPin = b.isPinned ?? false;
          if (aPin !== bPin) return aPin ? -1 : 1;
          return (b.createdAt ?? 0) - (a.createdAt ?? 0);
        })
    : [...sessions].sort((a, b) => {
        const aPin = a.isPinned ?? false;
        const bPin = b.isPinned ?? false;
        if (aPin !== bPin) return aPin ? -1 : 1;
        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      });
  const pinnedSessions = filteredSessions.filter((s) => s.isPinned);
  const recentSessions = filteredSessions.filter((s) => !(s.isPinned ?? false));

  useEffect(() => {
    setMessageAudioUrls((prev) => {
      Object.values(prev).forEach(URL.revokeObjectURL);
      return {};
    });
  }, [activeId]);

  return (
    <div className="flex h-full min-h-0 bg-background">
      {/* Left panel: collapsible sidebar (theme-aware) */}
      <aside
        className={cn(
          "shrink-0 flex flex-col bg-card border-r border-border transition-[width] duration-200 ease-out",
          sidebarCollapsed ? "w-14" : "w-[260px]"
        )}
      >
        {/* Top row: New Chat + collapse toggle (expanded) or toggle + New Chat icon only (collapsed) */}
        <div className={cn("flex items-center shrink-0", sidebarCollapsed ? "flex-col gap-2 p-2" : "gap-2 p-3")}>
          {sidebarCollapsed ? (
            <>
              <button
                type="button"
                onClick={toggleSidebarCollapsed}
                className="flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Expand chat history"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <Button
                type="button"
                onClick={handleNewChat}
                className="flex items-center justify-center w-10 h-10 p-0 bg-muted hover:bg-muted/80 text-foreground border-0"
                aria-label="New chat"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                onClick={handleNewChat}
                className="flex-1 justify-start gap-2 bg-muted hover:bg-muted/80 text-foreground border-0 min-w-0"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="truncate">New Chat</span>
              </Button>
              <button
                type="button"
                onClick={toggleSidebarCollapsed}
                className="flex items-center justify-center w-9 h-9 shrink-0 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Collapse chat history"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
        {/* Search + chat list: hidden when collapsed */}
        {!sidebarCollapsed && (
          <>
            <div className="px-3 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search chats..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted/50 border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-2">
              {pinnedSessions.length > 0 && (
                <>
                  <p className="px-2 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Pinned
                  </p>
                  <ul className="space-y-0.5">
                    {pinnedSessions.map((s) => (
                      <ChatListItem
                        key={s.id}
                        s={s}
                        activeId={activeId}
                        editingSessionId={editingSessionId}
                        editingTitle={editingTitle}
                        setEditingTitle={setEditingTitle}
                        onSelect={() => switchToSession(s.id)}
                        onPin={(e) => handlePinSession(e, s.id)}
                        onStartEdit={(e) => handleStartEditSession(e, s)}
                        onSaveEdit={() => handleSaveEditSession(s.id)}
                        onCancelEdit={handleCancelEditSession}
                        onDelete={(e) => handleDeleteSession(e, s.id)}
                        titleMaxLen={TITLE_MAX_LEN}
                        formatChatDate={formatChatDate}
                      />
                    ))}
                  </ul>
                </>
              )}
              <p className="px-2 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Recent
              </p>
              <ul className="space-y-0.5">
                {recentSessions.map((s) => (
                  <ChatListItem
                    key={s.id}
                    s={s}
                    activeId={activeId}
                    editingSessionId={editingSessionId}
                    editingTitle={editingTitle}
                    setEditingTitle={setEditingTitle}
                    onSelect={() => switchToSession(s.id)}
                    onPin={(e) => handlePinSession(e, s.id)}
                    onStartEdit={(e) => handleStartEditSession(e, s)}
                    onSaveEdit={() => handleSaveEditSession(s.id)}
                    onCancelEdit={handleCancelEditSession}
                    onDelete={(e) => handleDeleteSession(e, s.id)}
                    titleMaxLen={TITLE_MAX_LEN}
                    formatChatDate={formatChatDate}
                  />
                ))}
              </ul>
            </div>
          </>
        )}
      </aside>

      {/* Memory setup modal */}
      <Dialog open={memorySetupModalOpen} onOpenChange={setMemorySetupModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Memory setup</DialogTitle>
          </DialogHeader>
          <MemorySetupForm
            userName={coachSettings.userName}
            coachName={coachSettings.coachName}
            onSave={(userName, coachName) => {
              saveCoachSettings({ userName, coachName });
              setMemorySetupModalOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Right panel: main chat area */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeId && activeSession ? (
          <ChatPanel
            key={activeId}
            pageContext={pageContext}
            sessionTitle={activeSession.title}
            userFirstName={firstName}
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
            promptToSend={promptToSend}
            onSentInitialPrompt={() => setPromptToSend(null)}
            promptsLibraryOpen={promptsLibraryOpen}
            onPromptsLibraryOpenChange={setPromptsLibraryOpen}
            coachMode={coachMode}
            coachModes={COACH_MODES}
            onCoachModeChange={handleCoachModeChange}
            memoryEnabled={coachSettings.memoryEnabled}
            coachUserName={coachSettings.userName}
            coachName={coachSettings.coachName}
            previousSummaries={previousSummaries}
            onMemorySettingsOpen={() => setMemorySetupModalOpen(true)}
            onMemoryToggle={handleMemoryToggle}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 bg-background">
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-2 text-center">
              Hey {firstName || "there"}, what are we building today?
            </h2>
            <p className="text-muted-foreground text-sm mb-8 text-center max-w-md">
              Pick a prompt below or start a new chat from the sidebar.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-2xl">
              {EMPTY_STATE_PROMPTS.map(({ title, icon }) => (
                <button
                  key={title}
                  type="button"
                  onClick={() => handleEmptyStateCardClick(title)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-border",
                    "bg-card px-4 py-4 text-left transition-all",
                    "hover:border-orange-500/50 hover:bg-orange-500/5 dark:hover:bg-orange-500/10",
                    "shadow-sm hover:shadow-md"
                  )}
                >
                  <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-400">
                    {icon}
                  </span>
                  <span className="text-sm font-medium text-foreground">{title}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type ChatPanelProps = {
  pageContext: string;
  sessionTitle: string;
  userFirstName: string;
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
  promptToSend: string | null;
  onSentInitialPrompt: () => void;
  promptsLibraryOpen: boolean;
  onPromptsLibraryOpenChange: (open: boolean) => void;
  coachMode: string;
  coachModes: readonly { id: string; label: string; emoji: string }[];
  onCoachModeChange: (modeId: string) => void;
  memoryEnabled: boolean;
  coachUserName: string;
  coachName: string;
  previousSummaries: string[];
  onMemorySettingsOpen: () => void;
  onMemoryToggle: (checked: boolean) => void;
};

type SpeechRecognitionInstance = {
  start: () => void;
  stop: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
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

// Module-level recognition instance so it's ready before React mounts; handlers set in component
let sharedRecognition: SpeechRecognitionInstance | null = null;
if (typeof window !== "undefined") {
  const SR = (window as Window & { SpeechRecognition?: new () => SpeechRecognitionInstance; webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition
    ?? (window as Window & { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;
  if (SR) {
    try {
      sharedRecognition = new SR();
      sharedRecognition.continuous = false;
      sharedRecognition.interimResults = true;
      sharedRecognition.lang = "en-US";
    } catch {
      sharedRecognition = null;
    }
  }
}

function ChatPanel({
  pageContext,
  sessionTitle,
  userFirstName,
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
  promptToSend,
  onSentInitialPrompt,
  promptsLibraryOpen,
  onPromptsLibraryOpenChange,
  coachMode,
  coachModes,
  onCoachModeChange,
  memoryEnabled,
  coachUserName,
  coachName,
  previousSummaries,
  onMemorySettingsOpen,
  onMemoryToggle,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const LINE_HEIGHT_PX = 24;
  const MAX_ROWS = 6;
  const maxTextareaHeight = LINE_HEIGHT_PX * MAX_ROWS;
  const transcriptRef = useRef("");
  const sendMessageRef = useRef<(text: string) => void>(() => {});
  const setRecordingRef = useRef<(v: boolean) => void>(() => {});
  const mutedRef = useRef(muted);
  const lastMessageIndexRef = useRef(0);
  const promptToSendRef = useRef(promptToSend);
  mutedRef.current = muted;
  promptToSendRef.current = promptToSend;

  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [saveResponseModal, setSaveResponseModal] = useState<{ content: string; index: number } | null>(null);
  const [saveResponseTitle, setSaveResponseTitle] = useState("");
  const [savingToLibrary, setSavingToLibrary] = useState(false);

  const [isVoiceCall, setIsVoiceCall] = useState(false);
  const [callStatus, setCallStatus] = useState<"connecting" | "listening" | "speaking">("connecting");

  const [pendingImageUrls, setPendingImageUrls] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<{ name: string; text: string }[]>([]);
  const [pendingVideos, setPendingVideos] = useState<{ name: string; blobUrl: string; transcript?: string; transcribing?: boolean }[]>([]);
  const [fetchingTikTok, setFetchingTikTok] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [voiceOverOpen, setVoiceOverOpen] = useState(false);
  const [voiceOverScript, setVoiceOverScript] = useState("");
  const [voiceOverVoiceId, setVoiceOverVoiceId] = useState("pNInz6obpgDQGcFmaJgB");
  const [voiceOverVoices, setVoiceOverVoices] = useState<{ voice_id: string; name: string; description?: string; preview_url?: string }[]>([]);
  const [voiceOverStability, setVoiceOverStability] = useState(0.5);
  const [voiceOverSimilarity, setVoiceOverSimilarity] = useState(0.75);
  const [voiceOverGenerating, setVoiceOverGenerating] = useState(false);
  const [voiceOverProgress, setVoiceOverProgress] = useState(0);
  const [voiceOverError, setVoiceOverError] = useState<string | null>(null);
  const [voiceOverPreviewVoiceId, setVoiceOverPreviewVoiceId] = useState<string | null>(null);
  const voiceOverPreviewAudioRef = useRef<HTMLAudioElement | null>(null);

  const realtimeAudioRef = useRef<HTMLAudioElement | null>(null);
  const realtimePcRef = useRef<RTCPeerConnection | null>(null);
  const realtimeStreamRef = useRef<MediaStream | null>(null);

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

  const onAssistantCompleteRef = useRef<(text: string) => void>(() => {});
  onAssistantCompleteRef.current = (text: string) => {
    if (!mutedRef.current) playTTS(text, lastMessageIndexRef.current);
  };

  const { messages, sendMessage, generateImage, clearChat, isLoading } = useChatCoach(pageContext, {
    initialMessages,
    onMessagesChange,
    onAssistantComplete: (text) => onAssistantCompleteRef.current(text),
    productId: productId ?? undefined,
    coachMode,
    memoryEnabled,
    userName: coachUserName,
    coachName,
    previousSummaries,
  });
  sendMessageRef.current = sendMessage;
  setRecordingRef.current = setIsRecording;

  useEffect(() => {
    lastMessageIndexRef.current = messages.length > 0 ? messages.length - 1 : 0;
  }, [messages]);

  const didSendInitialRef = useRef(false);
  useEffect(() => {
    if (didSendInitialRef.current || !promptToSend?.trim()) return;
    didSendInitialRef.current = true;
    sendMessage(promptToSend.trim());
    onSentInitialPrompt();
  }, [promptToSend, sendMessage, onSentInitialPrompt]);

  // Wire handlers to module-level recognition. Mic permission is pre-granted via micStreamRef (getUserMedia on load).
  useEffect(() => {
    const rec = sharedRecognition;
    if (!rec) return;

    rec.onresult = (e: { results: SpeechRecognitionResultList }) => {
      let full = "";
      let current = "";
      for (let i = 0; i < e.results.length; i++) {
        const result = e.results.item ? e.results.item(i) : e.results[i];
        const alt = result.length > 0 ? (result.item ? result.item(0) : result[0]) : null;
        const transcript = (alt?.transcript ?? "").trim();
        if (result.isFinal) {
          full += transcript + " ";
          current = full;
        } else {
          current = full + transcript;
        }
      }
      if (full) transcriptRef.current = full.trim();
      if (textareaRef.current) textareaRef.current.value = current.trim();
    };
    rec.onend = () => {
      setRecordingRef.current(false);
      const finalText = transcriptRef.current.trim();
      if (finalText) sendMessageRef.current(finalText);
      if (textareaRef.current) {
        textareaRef.current.value = "";
        if (textareaRef.current.style) textareaRef.current.style.height = "auto";
      }
    };
    rec.onerror = (e: { error: string }) => {
      if (e.error !== "aborted") setRecordingRef.current(false);
    };
  }, []);

  const toggleVoiceInput = useCallback(() => {
    if (!sharedRecognition) {
      toast({ title: "Voice input not supported in this browser" });
      return;
    }
    if (isLoading) return;

    if (isRecording) {
      sharedRecognition.stop();
      return;
    }

    // Show recording state immediately, before recognition confirms
    setIsRecording(true);
    transcriptRef.current = "";
    if (textareaRef.current) textareaRef.current.value = "";
    try {
      sharedRecognition.start();
    } catch {
      setRecordingRef.current(false);
    }
  }, [isRecording, isLoading, toast]);

  const endCall = useCallback(() => {
    const pc = realtimePcRef.current;
    if (pc) {
      pc.close();
      realtimePcRef.current = null;
    }
    const stream = realtimeStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      realtimeStreamRef.current = null;
    }
    if (realtimeAudioRef.current) {
      realtimeAudioRef.current.srcObject = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.removeAttribute("src");
    }
    setPlayingIndex(null);
    setIsVoiceCall(false);
  }, []);

  const handleStartVoiceCall = useCallback(async () => {
    if (typeof RTCPeerConnection === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast({ title: "Voice call not supported in this browser — try Chrome." });
      return;
    }
    setIsVoiceCall(true);
    setCallStatus("connecting");
    try {
      const sessionRes = await fetch("/api/realtime-session", { method: "POST" });
      if (!sessionRes.ok) {
        const err = await sessionRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to start session");
      }
      const sessionData = (await sessionRes.json()) as { client_secret?: { value: string } };
      const token = sessionData.client_secret?.value;
      if (!token) throw new Error("No session token");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      realtimeStreamRef.current = stream;

      const pc = new RTCPeerConnection();
      realtimePcRef.current = pc;

      if (!realtimeAudioRef.current) {
        const el = document.createElement("audio");
        el.autoplay = true;
        el.setAttribute("playsinline", "true");
        realtimeAudioRef.current = el;
      }
      const audioEl = realtimeAudioRef.current;
      pc.ontrack = (e) => {
        if (e.streams?.[0] && audioEl) audioEl.srcObject = e.streams[0];
      };

      pc.addTrack(stream.getTracks()[0]);

      const dc = pc.createDataChannel("oai-events");
      dc.addEventListener("message", (e) => {
        try {
          const ev = JSON.parse(e.data as string) as { type?: string };
          if (ev.type === "response.audio.delta" || ev.type === "response.audio_transcript.delta") setCallStatus("speaking");
          else if (ev.type === "response.done") setCallStatus("listening");
        } catch {
          // ignore
        }
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // GA WebRTC endpoint (released March 2025) — replaces old beta /v1/realtime/calls
      const sdpRes = await fetch("https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });
      if (!sdpRes.ok) {
        const errText = await sdpRes.text();
        throw new Error(errText || "Realtime connection failed");
      }
      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      setCallStatus("listening");
    } catch (err) {
      console.error("[Realtime voice call]", err);
      toast({ title: err instanceof Error ? err.message : "Voice call failed" });
      endCall();
    }
  }, [toast, endCall]);

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
      const rawFiles = e.target.files;
      if (!rawFiles?.length) return;
      const files = Array.from(rawFiles); // copy before clearing so the FileList isn't emptied
      e.target.value = "";
      const imageTypes = ["image/jpeg", "image/png", "image/webp"];
      const videoTypes = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm", "video/x-matroska", "video/mpeg"];
      for (const file of files) {
        const lowerName = file.name.toLowerCase();
        if (imageTypes.includes(file.type) || /\.(jpe?g|png|webp)$/i.test(lowerName)) {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Failed to read image"));
            reader.readAsDataURL(file);
          });
          setPendingImageUrls((prev) => [...prev, dataUrl]);
        } else if (videoTypes.includes(file.type) || /\.(mp4|mov|avi|webm|mkv|mpeg|mpg)$/i.test(lowerName)) {
          const blobUrl = URL.createObjectURL(file);
          setPendingVideos((prev) => [...prev, { name: file.name, blobUrl, transcribing: true }]);
          // Upload to Vercel Blob first (bypasses Vercel function body limit), then transcribe
          (async () => {
            try {
              const { upload } = await import("@vercel/blob/client");
              const uploaded = await upload(
                `coach-videos/${Date.now()}-${file.name}`,
                file,
                { access: "public", handleUploadUrl: "/api/upload-video-blob" }
              );
              const res = await fetch("/api/transcribe-video", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: uploaded.url, filename: file.name }),
              });
              const data = await res.json().catch(() => ({})) as { transcript?: string; error?: string };
              if (!res.ok) {
                setPendingVideos((prev) =>
                  prev.map((v) => v.blobUrl === blobUrl ? { ...v, transcribing: false } : v)
                );
                toast({ title: "Could not transcribe video", description: data.error ?? `Server error ${res.status}` });
                return;
              }
              const transcript = data.transcript || undefined;
              setPendingVideos((prev) =>
                prev.map((v) => v.blobUrl === blobUrl ? { ...v, transcript, transcribing: false } : v)
              );
              if (!transcript) {
                toast({ title: "No speech detected", description: "Video attached — the AI will be told no audio was found.", duration: 4000 });
              }
            } catch (err) {
              setPendingVideos((prev) =>
                prev.map((v) => v.blobUrl === blobUrl ? { ...v, transcribing: false } : v)
              );
              toast({ title: "Could not transcribe video", description: err instanceof Error ? err.message : "Upload failed" });
            }
          })();
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
          toast({ title: "Unsupported file type", description: "Use images (jpg, png, webp), videos (mp4, mov, webm), PDF, or txt." });
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

  const removePendingVideo = useCallback((index: number) => {
    setPendingVideos((prev) => {
      URL.revokeObjectURL(prev[index].blobUrl);
      return prev.filter((_, i) => i !== index);
    });
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
    setPendingVideos((prev) => {
      prev.forEach((v) => URL.revokeObjectURL(v.blobUrl));
      return [];
    });
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
    const hasVideos = pendingVideos.length > 0;
    const isTranscribing = pendingVideos.some((v) => v.transcribing);
    if ((!value && !hasImages && !hasFiles && !hasVideos) || isLoading || fetchingTikTok) return;
    if (isTranscribing) {
      toast({ title: "Still transcribing…", description: "Please wait a moment before sending." });
      return;
    }

    // Admin-only: detect TikTok URLs and auto-enrich with account data
    const tiktokMatch = isAdminUser ? value.match(TIKTOK_URL_RE) : null;
    if (tiktokMatch) {
      ta.value = "";
      setFetchingTikTok(true);
      const originalText = value;
      const tiktokUrl = tiktokMatch[0];
      (async () => {
        try {
          const res = await fetch("/api/tiktok-analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: tiktokUrl }),
          });
          const data = await res.json().catch(() => ({}));
          let enriched = originalText;
          if (res.ok && data.stats) {
            const { profile, stats, derived, recentVideos } = data;
            const videoLines = (recentVideos as Array<{ description: string; views?: number; likes?: number; comments?: number; shares?: number; createdAt?: string }>)
              .map((v, i) => `  ${i + 1}. "${v.description.slice(0, 80)}" — ${v.views?.toLocaleString() ?? "?"} views, ${v.likes?.toLocaleString() ?? "?"} likes, ${v.comments?.toLocaleString() ?? "?"} comments, ${v.shares?.toLocaleString() ?? "?"} shares${v.createdAt ? ` (${v.createdAt})` : ""}`)
              .join("\n");
            enriched = `${originalText}

[TikTok Account Data for @${profile.username ?? data.handle}]
Followers: ${stats.followers?.toLocaleString() ?? "?"}
Following: ${stats.following?.toLocaleString() ?? "?"}
Total Likes: ${stats.totalLikes?.toLocaleString() ?? "?"}
Total Videos: ${stats.videoCount?.toLocaleString() ?? "?"}
Avg views (last ${derived.videosAnalyzed} videos): ${derived.avgViewsLast30Videos?.toLocaleString() ?? "?"}
Top video: "${derived.topVideoDescription?.slice(0, 100)}" (${derived.topVideoViews?.toLocaleString() ?? "?"} views)

Recent Videos:
${videoLines}`;
          } else {
            toast({ title: "TikTok fetch failed", description: (data as { error?: string }).error ?? "Could not load account data", duration: 4000 });
          }
          const attachments = hasImages || hasFiles || hasVideos ? {
            imageUrls: hasImages ? pendingImageUrls : undefined,
            attachedFiles: hasFiles ? pendingFiles : undefined,
            attachedVideos: hasVideos ? pendingVideos : undefined,
          } : undefined;
          sendMessage(enriched, attachments);
          setPendingImageUrls([]);
          setPendingFiles([]);
          setPendingVideos([]);
        } catch {
          toast({ title: "TikTok fetch failed", description: "Network error", duration: 4000 });
          sendMessage(originalText);
        } finally {
          setFetchingTikTok(false);
        }
      })();
      return;
    }

    ta.value = "";
    const attachments =
      hasImages || hasFiles || hasVideos
        ? {
            imageUrls: hasImages ? pendingImageUrls : undefined,
            attachedFiles: hasFiles ? pendingFiles : undefined,
            attachedVideos: hasVideos ? pendingVideos : undefined,
          }
        : undefined;
    sendMessage(value || "(no text)", attachments);
    setPendingImageUrls([]);
    setPendingFiles([]);
    setPendingVideos([]);
    ta.style.height = "auto";
  };

  const handleGenerateImage = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const value = ta.value.trim();
    if (isLoading) return;
    if (!value) {
      toast({ title: "Type an image description first", description: "Describe the image you want to generate, then click the button." });
      return;
    }
    ta.value = "";
    generateImage(value);
    ta.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!fetchingTikTok) handleSend();
    }
  };

  const handleSaveToLibrary = useCallback(async () => {
    if (!saveResponseModal || !saveResponseTitle.trim()) return;
    setSavingToLibrary(true);
    try {
      const res = await fetch("/api/library/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: saveResponseTitle.trim(),
          content: stripMarkdown(saveResponseModal.content),
          platform: "all",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Failed to save");
      }
      toast({ title: "Saved to My Library", description: "Find it in My Library → Scripts." });
      setSaveResponseModal(null);
      setSaveResponseTitle("");
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSavingToLibrary(false);
    }
  }, [saveResponseModal, saveResponseTitle, toast]);

  const openVoiceOverDialog = useCallback(() => {
    const text = textareaRef.current?.value?.trim() ?? "";
    setVoiceOverScript(text);
    setVoiceOverError(null);
    setVoiceOverProgress(0);
    setVoiceOverOpen(true);
  }, []);

  useEffect(() => {
    if (!voiceOverOpen) return;
    fetch("/api/elevenlabs/voices")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { voices?: { voice_id: string; name: string }[] } | null) => {
        if (data?.voices?.length) setVoiceOverVoices(data.voices);
      })
      .catch(() => {});
  }, [voiceOverOpen]);

  const handleGenerateVoiceOver = useCallback(async () => {
    const script = voiceOverScript.trim();
    if (!script) {
      setVoiceOverError("Paste or type a script first.");
      return;
    }
    setVoiceOverGenerating(true);
    setVoiceOverError(null);
    setVoiceOverProgress(10);
    const progressInterval = setInterval(() => {
      setVoiceOverProgress((p) => Math.min(p + 8, 85));
    }, 400);
    try {
      const res = await fetch("/api/ai-coach/voice-over", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script,
          voiceId: voiceOverVoiceId,
          stability: voiceOverStability,
          similarity: voiceOverSimilarity,
          saveToLibrary: false,
        }),
      });
      clearInterval(progressInterval);
      setVoiceOverProgress(100);
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Voice-over failed");
      }
      if (!data.url) throw new Error("No URL returned");
      onMessagesChange([
        ...messages,
        { role: "assistant", content: "Here's your voice-over.", voiceOverUrl: data.url },
      ]);
      toast({ title: "Voice-over ready", description: "Play or download below." });
      setVoiceOverOpen(false);
      setVoiceOverScript("");
    } catch (err) {
      setVoiceOverError(err instanceof Error ? err.message : "Generation failed");
      toast({ title: "Voice-over failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      clearInterval(progressInterval);
      setVoiceOverGenerating(false);
      setVoiceOverProgress(0);
    }
  }, [voiceOverScript, voiceOverVoiceId, voiceOverStability, voiceOverSimilarity, messages, onMessagesChange, toast]);

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
        onEnded={() => setPlayingIndex(null)}
      />
      <div className="shrink-0 border-b border-border bg-card px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground truncate max-w-[240px]">
            {sessionTitle === "New Chat" ? "New Conversation" : sessionTitle}
          </h1>
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
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-sm font-medium text-foreground hidden sm:inline">Memory</span>
                <Switch checked={memoryEnabled} onCheckedChange={onMemoryToggle} aria-label="Memory on or off" />
                <button
                  type="button"
                  onClick={onMemorySettingsOpen}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="Edit memory settings"
                  title="Edit name settings"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              <Select value={coachMode} onValueChange={onCoachModeChange}>
                <SelectTrigger
                  className="shrink-0 w-[200px] gap-1.5 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-white/20 h-9"
                  aria-label="Coach mode"
                >
                  <SelectValue placeholder="Coach Mode">
                    {coachModes.find((m) => m.id === coachMode)?.emoji}{" "}
                    {coachModes.find((m) => m.id === coachMode)?.label ?? "Coach Mode"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {coachModes.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="flex items-center gap-2">
                        <span>{m.emoji}</span>
                        <span>{m.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onPromptsLibraryOpenChange(true)}
                className="shrink-0 gap-1.5 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-white/20"
                aria-label="Open prompts library"
              >
                <BookOpen className="h-4 w-4" />
                Prompts Library
              </Button>
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
        <div className="flex-1 flex flex-col min-h-0 bg-background">
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="flex flex-col items-center gap-6">
              <div className="relative flex items-center justify-center">
                <span className="absolute inline-flex h-24 w-24 rounded-full bg-orange-400/30 animate-ping" />
                <span className="relative inline-flex h-24 w-24 rounded-full bg-orange-500 dark:bg-orange-500" />
              </div>
              <p className="text-lg font-medium text-slate-700 dark:text-slate-300">
                {callStatus === "connecting" && "Connecting…"}
                {callStatus === "listening" && "Listening…"}
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
        <div className="mx-auto w-full max-w-[52rem] px-4 py-6">
          {memoryEnabled && (
            <div className="flex justify-center pb-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/80 text-muted-foreground text-xs px-2.5 py-1">
                🧠 Memory on
              </span>
            </div>
          )}
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 justify-center pt-6 pb-4">
              {(products.length > 0
                ? [
                    `Help me improve "${products[0]?.title ?? "my product"}"`,
                    "What should I create next?",
                    "What should I focus on today?",
                  ]
                : STARTER_CHIPS
              ).map((label) => (
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
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="shrink-0 flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">CF Coach</span>
                  </div>
                )}
                <div className={cn("flex flex-col gap-1 min-w-0", msg.role === "user" ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap shadow-sm max-w-[90%] sm:max-w-[32rem]",
                      msg.role === "user"
                        ? "bg-orange-500 text-white dark:bg-orange-500"
                        : "bg-card text-foreground border border-border"
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
                    {msg.role === "user" && msg.attachedVideos && msg.attachedVideos.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {msg.attachedVideos.map((v, j) => (
                          v.blobUrl ? (
                            <div key={j} className="relative">
                              <video
                                src={v.blobUrl}
                                className="rounded-lg max-h-32 w-auto border border-white/20 bg-black"
                                controls
                                preload="metadata"
                              />
                            </div>
                          ) : (
                            <span
                              key={j}
                              className="inline-flex items-center gap-1 rounded-md bg-white/20 px-2 py-1 text-xs"
                            >
                              <Video className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate max-w-[120px]">{v.name}</span>
                            </span>
                          )
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
                      <span className={(msg.imageUrls?.length || msg.attachedFiles?.length || msg.attachedVideos?.length) ? "block mt-2" : ""}>
                        {stripMarkdown(msg.content)}
                      </span>
                    )) ||
                      (msg.role === "assistant" && (msg.content || (isLoading && i === messages.length - 1)) && (
                        <span>{stripMarkdown(msg.content || "")}</span>
                      ))}
                    {msg.role === "assistant" && isLoading && i === messages.length - 1 && !msg.content && (
                      <span className="inline-flex gap-1 items-center">
                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" />
                      </span>
                    )}
                    {msg.role === "assistant" && msg.voiceOverUrl && (
                      <div className="mt-2 flex flex-col gap-2">
                        <audio
                          src={msg.voiceOverUrl}
                          controls
                          className="w-full max-w-md h-9"
                          preload="metadata"
                        />
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={async () => {
                              try {
                                const a = document.createElement("a");
                                a.href = msg.voiceOverUrl!;
                                a.download = `voice-over-${Date.now()}.mp3`;
                                a.click();
                                toast({ title: "Downloaded" });
                              } catch {
                                toast({ title: "Download failed", variant: "destructive" });
                              }
                            }}
                          >
                            <Download className="h-4 w-4" />
                            Download .mp3
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={async () => {
                              try {
                                const res = await fetch("/api/library/items", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    type: "voice_over",
                                    title: `Voice-over ${new Date().toLocaleDateString()}`,
                                    url: msg.voiceOverUrl,
                                  }),
                                });
                                if (!res.ok) throw new Error("Save failed");
                                toast({ title: "Saved to My Library", description: "Find it in My Library." });
                              } catch {
                                toast({ title: "Could not save to library", variant: "destructive" });
                              }
                            }}
                          >
                            <Save className="h-4 w-4" />
                            Save to Library
                          </Button>
                        </div>
                      </div>
                    )}
                    {msg.role === "assistant" && msg.imageUrl && (
                      <div className="mt-2 flex flex-col gap-2">
                        <div className="rounded-xl overflow-hidden border border-border bg-muted/30 max-w-full w-fit">
                          <img
                            src={msg.imageUrl}
                            alt="Generated"
                            className="max-w-full h-auto max-h-[420px] object-contain block"
                          />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={async () => {
                              try {
                                const res = await fetch(msg.imageUrl!);
                                const blob = await res.blob();
                                const a = document.createElement("a");
                                a.href = URL.createObjectURL(blob);
                                a.download = `ai-generated-${Date.now()}.png`;
                                a.click();
                                URL.revokeObjectURL(a.href);
                                toast({ title: "Downloaded" });
                              } catch {
                                toast({ title: "Download failed", variant: "destructive" });
                              }
                            }}
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={async () => {
                              try {
                                const res = await fetch("/api/library/items", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    type: "generated_image",
                                    title: "Generated image",
                                    url: msg.imageUrl,
                                  }),
                                });
                                if (!res.ok) throw new Error("Save failed");
                                toast({ title: "Saved to Library" });
                              } catch {
                                toast({ title: "Could not save to library", variant: "destructive" });
                              }
                            }}
                          >
                            <Save className="h-4 w-4" />
                            Save to Library
                          </Button>
                        </div>
                      </div>
                    )}
                    {msg.role === "assistant" && (msg.content || msg.imageUrl) && msg.content?.trim() && (
                      <div className="mt-2 flex items-center gap-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            const text = stripMarkdown(msg.content ?? "");
                            navigator.clipboard.writeText(text).then(() => toast({ title: "Copied to clipboard" }));
                          }}
                          className="rounded p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-white/10 transition-colors"
                          aria-label="Copy response"
                          title="Copy"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSaveResponseModal({ content: msg.content ?? "", index: i });
                            setSaveResponseTitle("");
                          }}
                          className="rounded p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-white/10 transition-colors"
                          aria-label="Save response to library"
                          title="Save to My Library"
                        >
                          <Save className="h-4 w-4" />
                        </button>
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
                    {coachMode === "youtube" &&
                      msg.role === "assistant" &&
                      i === messages.length - 1 &&
                      (msg.content?.trim()?.length ?? 0) > 100 && (
                        <div className="mt-3 w-full">
                          <YouTubeScriptActionPanel scriptText={stripMarkdown(msg.content ?? "")} />
                          <div className="mt-3">
                            <Button
                              type="button"
                              className="gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                              onClick={() => {
                                const scriptText = stripMarkdown(msg.content ?? "");
                                try {
                                  sessionStorage.setItem("cf_coach_script", scriptText);
                                } catch {
                                  // ignore storage errors
                                }
                                window.location.href = "/dashboard/video-timeline";
                              }}
                            >
                              🎬 Create Video from this Script
                            </Button>
                          </div>
                        </div>
                      )}
                  </div>
                </div>
                {msg.role === "user" && (
                  <div className="shrink-0 flex flex-col items-center gap-1 order-first sm:order-none">
                    <div className="w-8 h-8 rounded-full bg-slate-400 dark:bg-slate-500 flex items-center justify-center text-white text-sm font-medium">
                      {userFirstName?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">You</span>
                  </div>
                )}
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-card px-4 py-4">
        {(pendingImageUrls.length > 0 || pendingFiles.length > 0 || pendingVideos.length > 0) && (
          <div className="mx-auto max-w-[52rem] flex flex-wrap gap-2 mb-2">
            {pendingImageUrls.map((url, i) => (
              <div key={`img-${i}`} className="relative inline-block">
                <img
                  src={url}
                  alt=""
                  className="h-14 w-14 rounded-lg object-cover border border-border"
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
            {pendingVideos.map((v, i) => (
              <div key={`vid-${i}`} className="relative inline-block">
                <video
                  src={v.blobUrl}
                  className="h-14 w-24 rounded-lg object-cover border border-border bg-black"
                  muted
                  preload="metadata"
                />
                <span className="absolute bottom-0 left-0 right-0 text-[9px] text-white bg-black/60 rounded-b-lg px-1 truncate leading-tight py-0.5">
                  {v.transcribing ? "Transcribing…" : v.transcript ? "✓ Transcribed" : v.name}
                </span>
                {v.transcribing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removePendingVideo(i)}
                  className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 text-white p-0.5 hover:bg-red-600"
                  aria-label="Remove video"
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
        <div className="mx-auto max-w-[52rem] flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            placeholder={isRecording ? "Speak now…" : "Ask your coach or describe an image…"}
            onKeyDown={handleKeyDown}
            onInput={handleTextareaInput}
            disabled={isLoading}
            rows={1}
            className={cn(
              "flex-1 min-h-[2.5rem] max-h-[9rem] resize-none overflow-y-auto rounded-md border border-input",
              "bg-background px-3 py-2 text-sm text-foreground ring-offset-background",
              "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          />
          <label
            htmlFor="coach-file-input"
            className={cn(
              "shrink-0 h-10 w-10 border border-border rounded-md flex items-center justify-center cursor-pointer",
              "bg-background hover:bg-accent hover:text-accent-foreground transition-colors",
              (isLoading || isRecording) && "pointer-events-none opacity-50 cursor-not-allowed"
            )}
            title="Attach file (images, PDF, txt)"
            aria-label="Attach file"
          >
            <input
              id="coach-file-input"
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,video/mp4,video/quicktime,video/x-msvideo,video/webm,video/x-matroska,.mp4,.mov,.avi,.webm,.mkv,application/pdf,.pdf,text/plain,.txt"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              disabled={isLoading || isRecording}
            />
            <Paperclip className="h-4 w-4" />
          </label>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleGenerateImage}
            disabled={isLoading || isRecording}
            className="shrink-0 h-10 w-10 border-border"
            title="Generate AI image from your description"
            aria-label="Generate AI image"
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={openVoiceOverDialog}
            disabled={isLoading || isRecording}
            className="shrink-0 h-10 w-10 border-border"
            title="Generate voice-over"
            aria-label="Generate voice-over from script"
          >
            <AudioLines className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size={isRecording ? "default" : "icon"}
            onClick={toggleVoiceInput}
            disabled={isLoading}
            className={cn(
              "shrink-0 h-10 border-border flex items-center justify-center gap-1.5",
              isRecording ? "min-w-10 px-2.5 text-orange-500 dark:text-orange-400" : "w-10"
            )}
            title={isRecording ? "Stop recording" : "Voice input"}
            aria-label={isRecording ? "Stop recording" : "Start voice input"}
          >
            <Mic className="h-4 w-4 shrink-0" />
            {isRecording && (
              <span className="flex gap-0.5 items-end h-3" aria-hidden>
                <span
                  className="w-1 h-2.5 bg-orange-500 dark:bg-orange-400 rounded-full origin-bottom"
                  style={{ animation: "voice-wave 0.6s ease-in-out -0.3s infinite" }}
                />
                <span
                  className="w-1 h-3 bg-orange-500 dark:bg-orange-400 rounded-full origin-bottom"
                  style={{ animation: "voice-wave 0.6s ease-in-out infinite" }}
                />
                <span
                  className="w-1 h-2.5 bg-orange-500 dark:bg-orange-400 rounded-full origin-bottom"
                  style={{ animation: "voice-wave 0.6s ease-in-out 0.3s infinite" }}
                />
              </span>
            )}
          </Button>
          <Button
            type="button"
            size="icon"
            onClick={handleSend}
            disabled={isLoading || fetchingTikTok}
            className="bg-orange-500 hover:bg-orange-600 dark:bg-orange-500 dark:hover:bg-orange-600 shrink-0 h-10 w-10"
            title={fetchingTikTok ? "Fetching TikTok data…" : undefined}
          >
            {isLoading || fetchingTikTok ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      </>
      )}

      <Sheet open={promptsLibraryOpen} onOpenChange={onPromptsLibraryOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Prompts Library</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {PROMPTS_LIBRARY.map((section) => (
              <div key={section.category}>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">{section.category}</h3>
                <ul className="space-y-1.5">
                  {section.prompts.map((prompt) => (
                    <li key={prompt}>
                      <button
                        type="button"
                        onClick={() => {
                          if (textareaRef.current) {
                            textareaRef.current.value = prompt;
                            textareaRef.current.focus();
                            handleTextareaInput();
                          }
                          onPromptsLibraryOpenChange(false);
                        }}
                        className="w-full text-left text-sm rounded-lg px-3 py-2.5 bg-slate-100 dark:bg-white/10 hover:bg-orange-500/10 dark:hover:bg-orange-500/20 text-slate-700 dark:text-slate-200 border border-transparent hover:border-orange-500/30 transition-colors"
                      >
                        {prompt}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!saveResponseModal} onOpenChange={(open) => !open && setSaveResponseModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save to My Library</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="save-response-title">Title</Label>
              <Input
                id="save-response-title"
                value={saveResponseTitle}
                onChange={(e) => setSaveResponseTitle(e.target.value)}
                placeholder="e.g. Marketing plan from Coach"
                className="bg-background"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveResponseModal(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveToLibrary} disabled={!saveResponseTitle.trim() || savingToLibrary}>
              {savingToLibrary ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={voiceOverOpen} onOpenChange={(open) => !voiceOverGenerating && setVoiceOverOpen(open)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Generate voice-over</DialogTitle>
          </DialogHeader>
          <audio
            ref={voiceOverPreviewAudioRef}
            className="hidden"
            onEnded={() => setVoiceOverPreviewVoiceId(null)}
          />
          <div className="space-y-4 py-2 overflow-y-auto min-h-0">
            <div className="space-y-2">
              <Label htmlFor="voice-over-script">Script</Label>
              <textarea
                id="voice-over-script"
                value={voiceOverScript}
                onChange={(e) => setVoiceOverScript(e.target.value)}
                placeholder="Paste or type your script here…"
                rows={4}
                className={cn(
                  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
                disabled={voiceOverGenerating}
              />
            </div>
            <div className="space-y-2">
              <Label>Voice</Label>
              <div className="grid gap-2 max-h-[200px] overflow-y-auto pr-1">
                {voiceOverVoices.length === 0 ? (
                  <div
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg border border-border p-3 cursor-pointer transition-colors",
                      voiceOverVoiceId === "pNInz6obpgDQGcFmaJgB"
                        ? "ring-2 ring-orange-500 bg-orange-500/10 border-orange-500/50"
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => setVoiceOverVoiceId("pNInz6obpgDQGcFmaJgB")}
                  >
                    <div>
                      <p className="font-medium text-sm">Adam</p>
                      <p className="text-xs text-muted-foreground">Default voice</p>
                    </div>
                    <span className="text-xs text-muted-foreground">Default</span>
                  </div>
                ) : (
                  voiceOverVoices.map((v) => {
                    const isSelected = voiceOverVoiceId === v.voice_id;
                    const isPlaying = voiceOverPreviewVoiceId === v.voice_id;
                    return (
                      <div
                        key={v.voice_id}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-lg border p-3 cursor-pointer transition-colors",
                          isSelected
                            ? "ring-2 ring-orange-500 bg-orange-500/10 border-orange-500/50"
                            : "border-border hover:bg-muted/50"
                        )}
                        onClick={() => setVoiceOverVoiceId(v.voice_id)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{v.name}</p>
                          {v.description && (
                            <p className="text-xs text-muted-foreground truncate">{v.description}</p>
                          )}
                        </div>
                        {v.preview_url && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0 h-8 gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              const el = voiceOverPreviewAudioRef.current;
                              if (!el) return;
                              if (isPlaying) {
                                el.pause();
                                el.currentTime = 0;
                                setVoiceOverPreviewVoiceId(null);
                                return;
                              }
                              setVoiceOverPreviewVoiceId(v.voice_id);
                              el.src = v.preview_url!;
                              el.play().catch(() => setVoiceOverPreviewVoiceId(null));
                            }}
                          >
                            {isPlaying ? (
                              <>
                                <Square className="h-3.5 w-3.5" />
                                Stop
                              </>
                            ) : (
                              <>
                                <Play className="h-3.5 w-3.5" />
                                Preview
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="text-muted-foreground -ml-2">
                  Advanced (stability & similarity)
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <div className="space-y-2">
                  <Label>Stability: {voiceOverStability.toFixed(1)}</Label>
                  <Slider
                    value={[voiceOverStability]}
                    onValueChange={([val]) => setVoiceOverStability(val ?? 0.5)}
                    min={0}
                    max={1}
                    step={0.1}
                    disabled={voiceOverGenerating}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Similarity: {voiceOverSimilarity.toFixed(1)}</Label>
                  <Slider
                    value={[voiceOverSimilarity]}
                    onValueChange={([val]) => setVoiceOverSimilarity(val ?? 0.75)}
                    min={0}
                    max={1}
                    step={0.1}
                    disabled={voiceOverGenerating}
                    className="w-full"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
            {voiceOverGenerating && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Generating voice-over…</p>
                <Progress value={voiceOverProgress} className="h-2" />
              </div>
            )}
            {voiceOverError && (
              <p className="text-sm text-destructive">{voiceOverError}</p>
            )}
          </div>
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setVoiceOverOpen(false)} disabled={voiceOverGenerating}>
              Cancel
            </Button>
            <Button onClick={handleGenerateVoiceOver} disabled={voiceOverGenerating || !voiceOverScript.trim()}>
              {voiceOverGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                "Generate voice-over"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
