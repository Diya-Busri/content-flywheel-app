"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { setVideoPrefill, getTimelineUrl } from "@/lib/video-prefill";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreatableSelectField } from "@/components/templates/CreatableSelectField";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ImagePlus, Loader2, Download, Link2, ArrowLeft, BarChart3, Film } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type ThumbnailTemplate = string;
type ThumbnailStyle = "auto" | "viral_stickman" | "viral_realistic";

type ThumbnailConcept = {
  id: string;
  titleSuggestion: string;
  promptForImage: string;
  ctrPrediction: string;
  suggestedColors: string[];
  layout: string;
};

type LibraryVideo = { id: string; title: string; createdAt?: string; status?: string };
type ConnectedAccount = {
  id: string;
  platform: string;
  platformUsername: string | null;
  platformUserId: string | null;
};

type LocalYouTubeQueueItem = {
  id: string;
  platform: "youtube";
  contentType: string;
  postedStatus: boolean;
  scheduledTime: string;
  createdAt: string;
  contentJson: Record<string, unknown>;
};

const TEMPLATES: { value: string; label: string }[] = [
  { value: "finance", label: "Finance" },
  { value: "gaming", label: "Gaming" },
  { value: "vlog", label: "Vlog" },
  { value: "education", label: "Education" },
];

const THUMBNAIL_STYLES: { value: ThumbnailStyle; label: string }[] = [
  { value: "auto", label: "Auto (from topic)" },
  { value: "viral_stickman", label: "Viral Stickman (whiteboard style)" },
  { value: "viral_realistic", label: "Viral Realistic (MrBeast-style energy)" },
];

function inferTemplateFromTopic(input: string): ThumbnailTemplate {
  const t = input.toLowerCase();

  const marketingWords = [
    "brand", "branding", "personal brand", "faceless brand", "creator", "audience",
    "content strategy", "marketing", "positioning", "messaging",
  ];
  const financeWords = [
    "money", "finance", "invest", "investing", "stock", "crypto", "bitcoin", "trading",
    "income", "revenue", "profit", "sales", "budget", "debt", "wealth", "side hustle",
    "ecom", "e-commerce", "agency",
  ];
  const gamingWords = [
    "game", "gaming", "fortnite", "minecraft", "roblox", "valorant", "call of duty",
    "cod", "gta", "fifa", "elden ring", "speedrun", "ranked", "fps", "stream highlights",
  ];
  const educationWords = [
    "how to", "guide", "tutorial", "learn", "lesson", "explained", "step by step", "tips",
    "strategy", "framework", "beginner", "course", "mistakes", "roadmap",
  ];

  if (gamingWords.some((w) => t.includes(w))) return "gaming";
  if (marketingWords.some((w) => t.includes(w))) return "education";
  if (financeWords.some((w) => t.includes(w))) return "finance";
  if (educationWords.some((w) => t.includes(w))) return "education";
  return "vlog";
}

const EXPORT_DIMENSIONS = [
  { key: "youtube", label: "YouTube (1280×720)", aspect: "16:9" },
  { key: "tiktok", label: "TikTok / Shorts (1080×1920)", aspect: "9:16" },
  { key: "instagram", label: "Instagram (1080×1080)", aspect: "1:1" },
];

const DIMENSION_PIXELS: Record<string, { width: number; height: number }> = {
  youtube: { width: 1280, height: 720 },
  tiktok: { width: 1080, height: 1920 },
  instagram: { width: 1080, height: 1080 },
};

function escSvg(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function pickAccent(topic: string): string {
  const t = topic.toLowerCase();
  if (t.includes("money") || t.includes("finance") || t.includes("sales")) return "#22C55E";
  if (t.includes("warning") || t.includes("mistake") || t.includes("fail")) return "#EF4444";
  return "#F59E0B";
}

function pickBadge(topic: string): string {
  const t = topic.toLowerCase();
  if (t.includes("brand")) return "BRAND";
  if (t.includes("money") || t.includes("sales")) return "MONEY";
  if (t.includes("mistake")) return "MISTAKE";
  return "GROWTH";
}

type StickmanVariant = "presenter-board" | "split-compare" | "big-arrow";

function buildStickmanVariantPrompt({
  topic,
  overlayText,
  variant,
}: {
  topic: string;
  overlayText: string;
  variant: StickmanVariant;
}): string {
  const hook = (overlayText || topic || "Build a faceless brand").trim();
  const base =
    `Create a premium YouTube thumbnail illustration for: "${topic}". ` +
    `Core hook: "${hook}". ` +
    `Style: polished digital stickman mascot illustration (not rough doodle), clean vector-like linework, strong depth, dramatic contrast, cinematic composition, high-click-through feel. ` +
    `No text, no letters, no logos, no watermark.`;

  if (variant === "split-compare") {
    return (
      `${base} ` +
      `Composition: split-screen comparison concept. Left side represents anonymous/faceless creator identity, right side represents personal brand identity. ` +
      `Include a central stickman decision pose pointing between both sides, with clear opposing props and color contrast.`
    );
  }

  if (variant === "big-arrow") {
    return (
      `${base} ` +
      `Composition: breakthrough moment concept. Large dynamic arrow and upward motion cues dominate the frame. ` +
      `Stickman in energetic pose with strong emotion, foreground perspective, bright accent glow, and bold focal separation.`
    );
  }

  return (
    `${base} ` +
    `Composition: presenter explainer concept. Stickman host in foreground pointing to a strategy board/chart in background. ` +
    `Use clean geometry, strong hierarchy, and a clear focal point optimized for small-size readability.`
  );
}

function toCtrHook(input: string): string {
  const words = input
    .toUpperCase()
    .replace(/[^A-Z0-9\s!?'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !["THE", "A", "AN", "OF", "FOR", "TO", "AND", "WITH"].includes(w))
    .slice(0, 4);
  return words.join(" ").trim();
}

function getOverlayPlacement(idx: number): string {
  if (idx % 3 === 0) return "top-3 left-3 justify-start items-start";
  if (idx % 3 === 1) return "bottom-3 right-3 justify-end items-end";
  return "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 justify-center items-center";
}

function appendLocalYouTubeQueue(item: Omit<LocalYouTubeQueueItem, "id" | "createdAt" | "postedStatus">): LocalYouTubeQueueItem {
  const record: LocalYouTubeQueueItem = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    postedStatus: false,
    createdAt: new Date().toISOString(),
    ...item,
  };
  try {
    const key = "cf:youtube-queue-local";
    const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as LocalYouTubeQueueItem[];
    localStorage.setItem(key, JSON.stringify([record, ...(Array.isArray(existing) ? existing : [])]));
  } catch {
    // ignore local storage errors
  }
  return record;
}

function toTitleCase(input: string): string {
  return input
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function buildBetterYouTubeTitle(topic: string, hook: string): string {
  const cleanHook = toTitleCase(hook.replace(/[^a-zA-Z0-9\s'-]/g, " ").replace(/\s+/g, " ").trim());
  const cleanTopic = topic.replace(/\s+/g, " ").trim();
  if (!cleanTopic) return cleanHook || "How to Build a Faceless Brand (Step-by-Step)";

  const lowerTopic = cleanTopic.toLowerCase();
  if (lowerTopic.includes("faceless") && lowerTopic.includes("brand")) {
    return cleanHook
      ? `${cleanHook}: How to Build a Faceless Brand That Actually Grows`
      : "How to Build a Faceless Brand That Actually Grows";
  }

  return cleanHook ? `${cleanHook}: ${cleanTopic}` : cleanTopic;
}

function formatLibraryVideoLabel(video: LibraryVideo): string {
  const rawTitle = video.title?.trim() || "";
  const isUntitled = !rawTitle || /^untitled video$/i.test(rawTitle);
  const idPart = video.id.slice(-6).toUpperCase();
  const datePart = video.createdAt
    ? new Date(video.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : null;
  const statusPart = video.status ? video.status.toUpperCase() : null;
  const meta = [datePart, statusPart, `#${idPart}`].filter(Boolean).join(" · ");
  const title = isUntitled ? "Untitled Video" : rawTitle;
  return meta ? `${title} (${meta})` : title;
}

function renderStickmanThumbnailDataUrl({
  topic,
  overlayText,
  dimensions,
  variant,
}: {
  topic: string;
  overlayText: string;
  dimensions: string;
  variant: StickmanVariant;
}): string {
  const { width, height } = DIMENSION_PIXELS[dimensions] ?? DIMENSION_PIXELS.youtube;
  const accent = pickAccent(topic);
  const badge = pickBadge(topic);
  const stroke = Math.max(5, Math.round(width / 220));
  const safeText = escSvg((overlayText || topic || "Build a Faceless Brand").slice(0, 54).toUpperCase());
  const safeBadge = escSvg(badge);
  const sceneBlock =
    variant === "presenter-board"
      ? `
  <rect width="${width}" height="${height}" fill="#F8FAFC"/>
  <rect x="0" y="${Math.round(height * 0.72)}" width="${width}" height="${Math.round(height * 0.28)}" fill="#EEF2F7"/>
  <rect x="${Math.round(width * 0.52)}" y="${Math.round(height * 0.14)}" width="${Math.round(width * 0.4)}" height="${Math.round(height * 0.58)}" rx="${Math.round(width * 0.01)}" fill="#FFFFFF" stroke="#111111" stroke-width="${stroke}"/>
  <polyline points="${Math.round(width * 0.56)},${Math.round(height * 0.6)} ${Math.round(width * 0.66)},${Math.round(height * 0.48)} ${Math.round(width * 0.76)},${Math.round(height * 0.54)} ${Math.round(width * 0.87)},${Math.round(height * 0.34)}" fill="none" stroke="${accent}" stroke-width="${Math.round(stroke * 0.8)}" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${Math.round(width * 0.28)}" cy="${Math.round(height * 0.28)}" r="${Math.round(width * 0.048)}" fill="#FFFFFF" stroke="#111111" stroke-width="${stroke}"/>
  <line x1="${Math.round(width * 0.28)}" y1="${Math.round(height * 0.33)}" x2="${Math.round(width * 0.28)}" y2="${Math.round(height * 0.6)}" stroke="#111111" stroke-width="${stroke}" stroke-linecap="round"/>
  <line x1="${Math.round(width * 0.28)}" y1="${Math.round(height * 0.42)}" x2="${Math.round(width * 0.18)}" y2="${Math.round(height * 0.5)}" stroke="#111111" stroke-width="${stroke}" stroke-linecap="round"/>
  <line x1="${Math.round(width * 0.28)}" y1="${Math.round(height * 0.42)}" x2="${Math.round(width * 0.42)}" y2="${Math.round(height * 0.39)}" stroke="#111111" stroke-width="${stroke}" stroke-linecap="round"/>
  <line x1="${Math.round(width * 0.28)}" y1="${Math.round(height * 0.6)}" x2="${Math.round(width * 0.2)}" y2="${Math.round(height * 0.72)}" stroke="#111111" stroke-width="${stroke}" stroke-linecap="round"/>
  <line x1="${Math.round(width * 0.28)}" y1="${Math.round(height * 0.6)}" x2="${Math.round(width * 0.36)}" y2="${Math.round(height * 0.72)}" stroke="#111111" stroke-width="${stroke}" stroke-linecap="round"/>
  <rect x="${Math.round(width * 0.04)}" y="${Math.round(height * 0.79)}" width="${Math.round(width * 0.92)}" height="${Math.round(height * 0.16)}" rx="${Math.round(width * 0.012)}" fill="#111111" opacity="0.93"/>
  <text x="${Math.round(width * 0.06)}" y="${Math.round(height * 0.885)}" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="${Math.round(width * 0.043)}" font-weight="900">${safeText}</text>`
      : variant === "split-compare"
        ? `
  <rect width="${width}" height="${height}" fill="#F8FAFC"/>
  <rect x="${Math.round(width * 0.5)}" y="0" width="${Math.round(width * 0.5)}" height="${height}" fill="#F1F5F9"/>
  <rect x="${Math.round(width * 0.07)}" y="${Math.round(height * 0.12)}" width="${Math.round(width * 0.28)}" height="${Math.round(height * 0.58)}" rx="${Math.round(width * 0.01)}" fill="#111111"/>
  <text x="${Math.round(width * 0.1)}" y="${Math.round(height * 0.2)}" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="${Math.round(width * 0.02)}" font-weight="800">FACELESS</text>
  <text x="${Math.round(width * 0.1)}" y="${Math.round(height * 0.28)}" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="${Math.round(width * 0.02)}" font-weight="800">BRAND</text>
  <rect x="${Math.round(width * 0.43)}" y="${Math.round(height * 0.15)}" width="${Math.round(width * 0.22)}" height="${Math.round(height * 0.54)}" rx="${Math.round(width * 0.01)}" fill="#FFFFFF" stroke="#111111" stroke-width="${stroke}"/>
  <rect x="${Math.round(width * 0.7)}" y="${Math.round(height * 0.15)}" width="${Math.round(width * 0.22)}" height="${Math.round(height * 0.54)}" rx="${Math.round(width * 0.01)}" fill="#FFFFFF" stroke="#111111" stroke-width="${stroke}"/>
  <line x1="${Math.round(width * 0.67)}" y1="${Math.round(height * 0.15)}" x2="${Math.round(width * 0.67)}" y2="${Math.round(height * 0.69)}" stroke="${accent}" stroke-width="${Math.max(5, Math.round(stroke * 1.1))}"/>
  <circle cx="${Math.round(width * 0.34)}" cy="${Math.round(height * 0.35)}" r="${Math.round(width * 0.042)}" fill="#FFFFFF" stroke="#111111" stroke-width="${stroke}"/>
  <line x1="${Math.round(width * 0.34)}" y1="${Math.round(height * 0.39)}" x2="${Math.round(width * 0.34)}" y2="${Math.round(height * 0.62)}" stroke="#111111" stroke-width="${stroke}" stroke-linecap="round"/>
  <line x1="${Math.round(width * 0.34)}" y1="${Math.round(height * 0.48)}" x2="${Math.round(width * 0.46)}" y2="${Math.round(height * 0.43)}" stroke="#111111" stroke-width="${stroke}" stroke-linecap="round"/>
  <rect x="${Math.round(width * 0.38)}" y="${Math.round(height * 0.78)}" width="${Math.round(width * 0.58)}" height="${Math.round(height * 0.14)}" rx="${Math.round(width * 0.012)}" fill="#111111" opacity="0.93"/>
  <text x="${Math.round(width * 0.4)}" y="${Math.round(height * 0.87)}" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="${Math.round(width * 0.03)}" font-weight="900">${safeText}</text>`
        : `
  <rect width="${width}" height="${height}" fill="#FFF7ED"/>
  <rect x="${Math.round(width * 0.48)}" y="${Math.round(height * 0.06)}" width="${Math.round(width * 0.46)}" height="${Math.round(height * 0.54)}" rx="${Math.round(width * 0.012)}" fill="#FFFFFF" stroke="#111111" stroke-width="${stroke}"/>
  <line x1="${Math.round(width * 0.08)}" y1="${Math.round(height * 0.64)}" x2="${Math.round(width * 0.82)}" y2="${Math.round(height * 0.22)}" stroke="${accent}" stroke-width="${Math.round(stroke * 1.3)}" stroke-linecap="round"/>
  <polygon points="${Math.round(width * 0.82)},${Math.round(height * 0.22)} ${Math.round(width * 0.74)},${Math.round(height * 0.17)} ${Math.round(width * 0.77)},${Math.round(height * 0.27)}" fill="${accent}"/>
  <circle cx="${Math.round(width * 0.2)}" cy="${Math.round(height * 0.42)}" r="${Math.round(width * 0.064)}" fill="#FFFFFF" stroke="#111111" stroke-width="${stroke}"/>
  <line x1="${Math.round(width * 0.2)}" y1="${Math.round(height * 0.48)}" x2="${Math.round(width * 0.2)}" y2="${Math.round(height * 0.78)}" stroke="#111111" stroke-width="${stroke}" stroke-linecap="round"/>
  <line x1="${Math.round(width * 0.2)}" y1="${Math.round(height * 0.59)}" x2="${Math.round(width * 0.06)}" y2="${Math.round(height * 0.67)}" stroke="#111111" stroke-width="${stroke}" stroke-linecap="round"/>
  <line x1="${Math.round(width * 0.2)}" y1="${Math.round(height * 0.59)}" x2="${Math.round(width * 0.37)}" y2="${Math.round(height * 0.5)}" stroke="#111111" stroke-width="${stroke}" stroke-linecap="round"/>
  <text x="${Math.round(width * 0.52)}" y="${Math.round(height * 0.25)}" fill="#111111" font-family="Arial, sans-serif" font-size="${Math.round(width * 0.022)}" font-weight="800">BREAKTHROUGH</text>
  <rect x="${Math.round(width * 0.04)}" y="${Math.round(height * 0.06)}" width="${Math.round(width * 0.6)}" height="${Math.round(height * 0.14)}" rx="${Math.round(width * 0.012)}" fill="#111111" opacity="0.94"/>
  <text x="${Math.round(width * 0.06)}" y="${Math.round(height * 0.15)}" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="${Math.round(width * 0.03)}" font-weight="900">${safeText}</text>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${sceneBlock}

  <rect x="${Math.round(width * 0.04)}" y="${Math.round(height * 0.05)}" width="${Math.round(width * 0.33)}" height="${Math.round(height * 0.11)}" rx="${Math.round(width * 0.012)}" fill="#111111"/>
  <text x="${Math.round(width * 0.055)}" y="${Math.round(height * 0.125)}" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="${Math.round(width * 0.03)}" font-weight="800">${safeBadge}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export default function ThumbnailsClient() {
  const searchParams = useSearchParams();
  const [topic, setTopic] = useState("");
  const [template, setTemplate] = useState<string>("vlog");
  const [thumbnailStyle, setThumbnailStyle] = useState<ThumbnailStyle>("auto");
  const [templateLockedByUser, setTemplateLockedByUser] = useState(false);
  const [titleIdeas, setTitleIdeas] = useState<string[]>([]);
  const [titleIdeasLoading, setTitleIdeasLoading] = useState(false);
  const [concepts, setConcepts] = useState<ThumbnailConcept[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [overlayTexts, setOverlayTexts] = useState<Record<string, string>>({});
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [pendingAttachUrl, setPendingAttachUrl] = useState<string | null>(null);
  const [attachingVideoId, setAttachingVideoId] = useState<string | null>(null);
  const [libraryVideos, setLibraryVideos] = useState<LibraryVideo[]>([]);
  const [youtubeAccounts, setYoutubeAccounts] = useState<ConnectedAccount[]>([]);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [publishingConceptId, setPublishingConceptId] = useState<string | null>(null);
  const [postTitle, setPostTitle] = useState("");
  const [postDescription, setPostDescription] = useState("");
  const [postKeywords, setPostKeywords] = useState("");
  const [selectedYoutubeAccountId, setSelectedYoutubeAccountId] = useState<string>("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [youtubeVideoFile, setYoutubeVideoFile] = useState<File | null>(null);
  const [schedulingPost, setSchedulingPost] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const topicFromQuery = searchParams.get("topic")?.trim();
    const styleFromQuery = searchParams.get("style")?.trim();
    const fromQuery = topicFromQuery || "";
    let fromSession = "";
    let fromLocal = "";
    try {
      fromSession = sessionStorage.getItem("cf:lastThumbnailTopic")?.trim() || "";
      fromLocal = localStorage.getItem("cf:lastThumbnailTopic")?.trim() || "";
    } catch {
      // ignore
    }
    const candidate = fromQuery || fromSession || fromLocal;
    if (!candidate) return;
    setTopic((prev) => (prev.trim().length > 0 ? prev : candidate));
    if (styleFromQuery === "viral_stickman" || styleFromQuery === "viral_realistic") {
      setThumbnailStyle(styleFromQuery);
    }
  }, [searchParams]);

  useEffect(() => {
    if (templateLockedByUser) return;
    const t = topic.trim();
    if (!t) return;
    setTemplate(inferTemplateFromTopic(t));
  }, [topic, templateLockedByUser]);

  const loadLibraryVideos = useCallback(async () => {
    try {
      const res = await fetch("/api/content-calendar/events");
      const data = await res.json();
      const list = (data.events ?? [])
        .filter((e: { id?: unknown }) => typeof e.id === "string" && !String(e.id).startsWith("campaign-"))
        .map((e: { id: string; title?: string; createdAt?: string; status?: string }) => ({
          id: e.id,
          title: e.title ?? "Untitled Video",
          createdAt: typeof e.createdAt === "string" ? e.createdAt : undefined,
          status: typeof e.status === "string" ? e.status : undefined,
        }));
      setLibraryVideos(list);
    } catch {
      setLibraryVideos([]);
    }
  }, []);

  const loadYoutubeAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/connected-accounts");
      const data = await res.json().catch(() => ({}));
      const connected = Array.isArray(data.connected) ? data.connected : [];
      setYoutubeAccounts(
        connected.filter((a: ConnectedAccount) => a && a.platform === "youtube")
      );
    } catch {
      setYoutubeAccounts([]);
    }
  }, []);

  useEffect(() => {
    loadLibraryVideos();
    loadYoutubeAccounts();
  }, [loadLibraryVideos, loadYoutubeAccounts]);

  const handleGenerateTitles = useCallback(async () => {
    const t = topic.trim();
    if (!t) {
      toast({ title: "Enter a topic first", description: "Type your video topic, then generate title options.", variant: "destructive" });
      return;
    }
    setTitleIdeasLoading(true);
    setTitleIdeas([]);
    try {
      const res = await fetch("/api/content-studio/thumbnails/title-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: t, template, style: thumbnailStyle }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Could not generate titles", description: data.error ?? "Failed", variant: "destructive" });
        return;
      }
      const titles = Array.isArray(data.titles) ? data.titles.filter((x: unknown) => typeof x === "string") : [];
      setTitleIdeas(titles.slice(0, 15));
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setTitleIdeasLoading(false);
    }
  }, [topic, template, thumbnailStyle, toast]);

  const handleGenerateConcepts = useCallback(async () => {
    const t = topic.trim();
    if (!t) {
      toast({ title: "Enter a video title or topic", variant: "destructive" });
      return;
    }
    setLoading(true);
    setConcepts([]);
    setImageUrls({});
    setOverlayTexts({});
    try {
      const res = await fetch("/api/content-studio/thumbnails/concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: t, template, style: thumbnailStyle }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Could not generate", description: data.error, variant: "destructive" });
        return;
      }
      const generated = data.concepts ?? [];
      setConcepts(generated);
      generated.forEach((c: ThumbnailConcept) => {
        const base = thumbnailStyle === "viral_stickman" ? toCtrHook(c.titleSuggestion || t) : c.titleSuggestion;
        setOverlayTexts((prev) => ({ ...prev, [c.id]: base }));
      });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [topic, template, thumbnailStyle, toast]);

  const handleGenerateImage = useCallback(
    async (concept: ThumbnailConcept, dimensions: string) => {
      setGeneratingId(concept.id);
      try {
        const overlay = overlayTexts[concept.id] ?? concept.titleSuggestion ?? topic;
        const variants: StickmanVariant[] = ["presenter-board", "split-compare", "big-arrow"];
        const conceptIdx = concepts.findIndex((c) => c.id === concept.id);
        const variant = variants[(conceptIdx >= 0 ? conceptIdx : 0) % variants.length];
        const prompt =
          thumbnailStyle === "viral_stickman"
            ? buildStickmanVariantPrompt({ topic, overlayText: overlay, variant })
            : concept.promptForImage;

        const res = await fetch("/api/content-studio/thumbnails/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, dimensions, style: thumbnailStyle }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast({ title: "Image generation failed", description: data.error, variant: "destructive" });
          return;
        }
        setImageUrls((prev) => ({ ...prev, [concept.id]: data.url }));
      } catch (e) {
        toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
      } finally {
        setGeneratingId(null);
      }
    },
    [concepts, overlayTexts, thumbnailStyle, toast, topic]
  );

  const handleAttach = useCallback(
    async (videoId: string, imageUrl: string) => {
      setAttachingVideoId(videoId);
      try {
        const res = await fetch("/api/content-studio/thumbnails/attach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId, imageUrl }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast({ title: "Attach failed", description: data.error, variant: "destructive" });
          return;
        }
        toast({ title: "Thumbnail attached", description: "Video in library updated." });
        setAttachModalOpen(false);
        setPendingAttachUrl(null);
      } catch (e) {
        toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
      } finally {
        setAttachingVideoId(null);
      }
    },
    [toast]
  );

  const openYouTubePostSetup = useCallback(
    (concept: ThumbnailConcept, imageUrl: string) => {
      const overlay = (overlayTexts[concept.id] ?? concept.titleSuggestion ?? topic).trim();
      const nowPlusOneHour = new Date(Date.now() + 60 * 60 * 1000);
      const localIso = new Date(nowPlusOneHour.getTime() - nowPlusOneHour.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);

      setPublishingConceptId(concept.id);
      setPostTitle(buildBetterYouTubeTitle(topic.trim(), overlay));
      setPostDescription(
        `${topic.trim()}\n\nIn this video I break down practical faceless brand strategy and show what actually works.\n\n#facelessbrand #youtubegrowth #contentstrategy`
      );
      setPostKeywords("faceless brand, personal brand, youtube growth, content strategy");
      setScheduledAt(localIso);
      setYoutubeVideoFile(null);
      setSelectedYoutubeAccountId((prev) => prev || youtubeAccounts[0]?.id || "");
      setImageUrls((prev) => ({ ...prev, [concept.id]: imageUrl }));
      setPostModalOpen(true);
    },
    [overlayTexts, topic, youtubeAccounts]
  );

  const handleScheduleYouTubePost = useCallback(async () => {
    if (!publishingConceptId) return;
    if (!postTitle.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (!scheduledAt) {
      toast({ title: "Schedule time is required", variant: "destructive" });
      return;
    }
    if (!selectedYoutubeAccountId) {
      toast({ title: "Select a YouTube account", variant: "destructive" });
      return;
    }
    if (!youtubeVideoFile) {
      toast({ title: "Upload MP4 required", description: "Pick your final video file to actually schedule on YouTube.", variant: "destructive" });
      return;
    }

    const concept = concepts.find((c) => c.id === publishingConceptId);
    const thumbUrl = imageUrls[publishingConceptId];
    if (!concept || !thumbUrl) {
      toast({ title: "Missing thumbnail", description: "Generate an image before scheduling.", variant: "destructive" });
      return;
    }

    setSchedulingPost(true);
    try {
      const fd = new FormData();
      fd.set("youtubeAccountId", selectedYoutubeAccountId);
      fd.set("title", postTitle.trim());
      fd.set("description", postDescription.trim());
      fd.set("keywords", postKeywords);
      fd.set("scheduledAt", new Date(scheduledAt).toISOString());
      fd.set("videoFile", youtubeVideoFile);

      const uploadRes = await fetch("/api/youtube/schedule-upload", {
        method: "POST",
        body: fd,
      });
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        toast({ title: "Could not schedule on YouTube", description: uploadData.error ?? "Upload failed", variant: "destructive" });
        return;
      }

      // Keep internal queue record for app tracking/history.
      await fetch("/api/scheduled-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: "youtube-video-post",
          platform: "youtube",
          scheduledTime: new Date(scheduledAt).toISOString(),
          contentJson: {
            title: postTitle.trim(),
            description: postDescription.trim(),
            keywords: postKeywords
              .split(",")
              .map((k) => k.trim())
              .filter(Boolean),
            youtubeAccountId: selectedYoutubeAccountId,
            thumbnailUrl: thumbUrl,
            source: "thumbnails",
            conceptTitle: concept.titleSuggestion,
            topic: topic.trim(),
            youtubeVideoId: uploadData.youtubeVideoId,
            watchUrl: uploadData.watchUrl,
            studioUrl: uploadData.studioUrl,
          },
        }),
      }).catch(() => {});

      toast({ title: "Scheduled on YouTube", description: "Video uploaded and scheduled in YouTube Studio." });
      setPostModalOpen(false);
      setPublishingConceptId(null);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setSchedulingPost(false);
    }
  }, [concepts, imageUrls, postDescription, postKeywords, postTitle, publishingConceptId, scheduledAt, selectedYoutubeAccountId, toast, topic, youtubeVideoFile]);

  const downloadUrl = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener";
    a.click();
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <ImagePlus className="w-5 h-5 text-orange-500" />
            AI thumbnail generator from video title
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Critical for CTR. Enter your video title → get 3 variations (A/B test ready). Edit text overlay, export for YouTube / TikTok / Instagram, and attach to a video.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Video title / topic</Label>
              <Input
                placeholder="e.g. How I made $10K in 30 days"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={loading || titleIdeasLoading}
                className="border-[#E5E7EB] dark:border-[#2A2A2A]"
              />
              {!topic.trim() ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    try {
                      const last =
                        sessionStorage.getItem("cf:lastThumbnailTopic")?.trim() ||
                        localStorage.getItem("cf:lastThumbnailTopic")?.trim() ||
                        "";
                      if (last) {
                        setTopic(last);
                      } else {
                        toast({
                          title: "No saved topic found",
                          description: "Go to Template Studio, enter a topic, then click Generate thumbnail.",
                          variant: "destructive",
                        });
                      }
                    } catch {
                      toast({
                        title: "Could not read saved topic",
                        description: "Enter your topic manually for now.",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  Use last topic from Template Studio
                </Button>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateTitles}
                  disabled={loading || titleIdeasLoading || !topic.trim()}
                >
                  {titleIdeasLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Generate viral titles
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <CreatableSelectField
                label="Template (niche)"
                value={template}
                onValueChange={(v) => {
                  setTemplate(v);
                  setTemplateLockedByUser(true);
                }}
                options={TEMPLATES}
                storageKey="cf:thumbnail-niches"
                addPlaceholder="Type custom niche and save"
              />
              <p className="text-xs text-muted-foreground">
                Auto-detected from title. You can add any custom niche and reuse it later.
              </p>
              <div className="space-y-2 pt-2">
                <Label>Thumbnail style</Label>
                <Select
                  value={thumbnailStyle}
                  onValueChange={(v) => setThumbnailStyle(v as ThumbnailStyle)}
                  disabled={loading || titleIdeasLoading}
                >
                  <SelectTrigger className="border-[#E5E7EB] dark:border-[#2A2A2A]">
                    <SelectValue placeholder="Select style" />
                  </SelectTrigger>
                  <SelectContent>
                    {THUMBNAIL_STYLES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Use stickman style to make thumbnails match your whiteboard video identity.
                </p>
              </div>
            </div>
          </div>

          {titleIdeas.length > 0 && (
            <div className="rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#0F0F0F] p-3">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Pick a title</p>
              <div className="flex flex-wrap gap-2">
                {titleIdeas.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTopic(t)}
                    className="text-left text-xs rounded-md border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#141414] px-2 py-1 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-[#1A1A1A]"
                    title="Click to use this title"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button onClick={handleGenerateConcepts} disabled={loading} className="bg-orange-500 hover:bg-orange-600">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {loading ? "Generating concepts…" : "Generate 3 thumbnail concepts"}
          </Button>
        </CardContent>
      </Card>

      {concepts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            A/B variations
          </h2>
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-3">
            {concepts.map((concept, idx) => {
              const imageUrl = imageUrls[concept.id];
              const overlayText = overlayTexts[concept.id] ?? concept.titleSuggestion;
              return (
                <Card
                  key={concept.id}
                  className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] overflow-hidden"
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-900 dark:text-white">
                      {concept.titleSuggestion}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      CTR: {concept.ctrPrediction} · {concept.layout}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="aspect-video rounded-lg bg-muted flex items-center justify-center overflow-hidden min-h-[140px]">
                      {imageUrl ? (
                        <div className="relative w-full h-full">
                          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                          {overlayText && (
                            <div className={`absolute inset-0 flex p-2 ${getOverlayPlacement(idx)}`}>
                              <span className="text-white font-extrabold uppercase tracking-wide text-center text-sm md:text-base drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] bg-black/70 border border-white/20 px-2 py-1 rounded">
                                {overlayText}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center p-4">
                          <p className="text-xs text-muted-foreground mb-2">No image yet</p>
                          <div className="flex flex-wrap gap-1 justify-center">
                            {EXPORT_DIMENSIONS.map((d) => (
                              <Button
                                key={d.key}
                                size="sm"
                                variant="outline"
                                disabled={generatingId === concept.id}
                                onClick={() => handleGenerateImage(concept, d.key)}
                              >
                                {generatingId === concept.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  d.label.split(" ")[0]
                                )}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Text overlay editor</Label>
                      <Input
                        value={overlayText}
                        onChange={(e) =>
                          setOverlayTexts((prev) => ({ ...prev, [concept.id]: e.target.value }))
                        }
                        placeholder="Title text"
                        className="text-sm h-8"
                      />
                    </div>
                    {concept.suggestedColors.length > 0 && (
                      <div className="flex flex-wrap gap-1 items-center">
                        <span className="text-xs text-muted-foreground">Colors:</span>
                        {concept.suggestedColors.map((c, i) => (
                          <span
                            key={i}
                            className="w-5 h-5 rounded border border-border"
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                      </div>
                    )}
                    {imageUrl && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                        {EXPORT_DIMENSIONS.map((d) => (
                          <Button
                            key={d.key}
                            size="sm"
                            variant="outline"
                            onClick={() => downloadUrl(imageUrl, `thumbnail-${d.key}.png`)}
                          >
                            <Download className="w-3.5 h-3.5 mr-1" />
                            {d.label.split(" ")[0]}
                          </Button>
                        ))}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPendingAttachUrl(imageUrl);
                            setAttachModalOpen(true);
                          }}
                        >
                          <Link2 className="w-3.5 h-3.5 mr-1" />
                          Attach to video
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openYouTubePostSetup(concept, imageUrl)}
                        >
                          <Film className="w-3.5 h-3.5 mr-1" />
                          YouTube post
                        </Button>
                        <Button
                          size="sm"
                          className="bg-orange-500 hover:bg-orange-600"
                          onClick={() => {
                            setVideoPrefill({
                              thumbnailUrl: imageUrl,
                              title: topic.trim() || undefined,
                              source: "thumbnails",
                            });
                            router.push(getTimelineUrl());
                          }}
                        >
                          <Film className="w-3.5 h-3.5 mr-1" />
                          Create video
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={attachModalOpen} onOpenChange={(open) => { if (!open) { setAttachModalOpen(false); setPendingAttachUrl(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach thumbnail to video</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Choose a video from your library. The thumbnail will be saved and linked to that video.
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {libraryVideos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No videos in library. Save a video from the Video Timeline first.
              </p>
            ) : (
              libraryVideos.map((v) => (
                <Button
                  key={v.id}
                  variant="outline"
                  className="w-full justify-start"
                  disabled={!!attachingVideoId}
                  onClick={() => pendingAttachUrl && handleAttach(v.id, pendingAttachUrl)}
                >
                  {attachingVideoId === v.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {formatLibraryVideoLabel(v)}
                </Button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAttachModalOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={postModalOpen} onOpenChange={(open) => { if (!open) { setPostModalOpen(false); setPublishingConceptId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>YouTube post setup</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Video title</Label>
              <Input value={postTitle} onChange={(e) => setPostTitle(e.target.value)} placeholder="e.g. FACELESS WINS" />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                value={postDescription}
                onChange={(e) => setPostDescription(e.target.value)}
                placeholder="Write your YouTube description..."
                className="min-h-[110px]"
              />
            </div>
            <div className="space-y-1">
              <Label>SEO keywords (comma-separated)</Label>
              <Input
                value={postKeywords}
                onChange={(e) => setPostKeywords(e.target.value)}
                placeholder="faceless brand, personal brand, youtube growth"
              />
            </div>
            <div className="space-y-1">
              <Label>YouTube account</Label>
              {youtubeAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No YouTube account connected. Connect one in{" "}
                  <Link href="/dashboard/settings/connected-accounts" className="text-orange-500 hover:underline">
                    Connected Accounts
                  </Link>
                  .
                </p>
              ) : (
                <Select value={selectedYoutubeAccountId} onValueChange={setSelectedYoutubeAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {youtubeAccounts.map((a, idx) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.platformUsername ? `@${a.platformUsername}` : `YouTube #${idx + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1">
              <Label>Schedule date/time</Label>
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Final video file (MP4)</Label>
              <Input
                type="file"
                accept="video/mp4,video/*"
                onChange={(e) => setYoutubeVideoFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Required for real YouTube scheduling. This uploads your actual video to YouTube.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPostModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleScheduleYouTubePost}
              className="bg-orange-500 hover:bg-orange-600"
              disabled={schedulingPost || youtubeAccounts.length === 0}
            >
              {schedulingPost ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Schedule post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!loading && concepts.length === 0 && (
        <Card className="border-dashed border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50/50 dark:bg-[#0F0F0F]/50">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            <p>Enter a video title and click “Generate 3 thumbnail concepts” to get 3 A/B-ready variations. Edit text overlay and export for YouTube, TikTok, or Instagram.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
