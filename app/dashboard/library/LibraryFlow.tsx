"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { YouTubePublishSheet } from "@/components/youtube/YouTubePublishSheet";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Search,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  Download,
  Package,
  Video,
  FileText,
  ImageIcon,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash,
  BookOpen,
  Calendar,
  ClipboardList,
  LayoutTemplate,
  Eye,
  Lock,
  Youtube,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import TemplatesClient from "@/app/dashboard/templates/TemplatesClient";
import HistoryClient from "@/app/dashboard/history/HistoryClient";
import { FeaturePreviewGate } from "@/components/feature-preview-gate";
import { QuickSellSheet } from "@/components/product-editor/QuickSellSheet";
import { SellOnCFButton } from "@/components/product-editor/SellOnCFButton";

type LibraryTab = "products" | "scripts" | "all" | "bundles" | "timeline" | "template-packs" | "templates" | "history" | "youtube" | "images" | "trash";

type TemplatePackItem = {
  id: string;
  packName: string;
  templateType: string;
  niche?: string;
  status: string;
  slideCount: number;
  createdAt: string;
};

type ScheduledPostItem = {
  id: string;
  platform: string;
  contentType: string;
  postedStatus: boolean;
  scheduledTime: string | null;
  createdAt: string | null;
  contentJson?: Record<string, unknown>;
};

type LibraryItem = {
  id: string;
  type: "product" | "video" | "script";
  title: string;
  thumbnail?: string;
  status: string;
  createdAt: string;
  productId?: string;
  videoId?: string;
  scriptId?: string;
  platform?: string;
  format?: string;
  bundleId?: string;
  /** When 'ai' or 'brand', product was auto-designed; show "AI Designed" badge. */
  designSource?: "ai" | "brand" | null;
  /** True when product has a completed avatar promo video. */
  hasPromoVideo?: boolean;
  /** True when product has a book mockup image. */
  hasBookMockup?: boolean;
  /** True when product has AI-generated marketplace listing copy. */
  hasMarketingAssets?: boolean;
  /** True when product has a cover thumbnail. */
  hasThumbnail?: boolean;
  /** 0–100 completion score. */
  completionScore?: number;
  /** True when product is published natively on Content Flywheel. */
  isNativePublished?: boolean;
  /** Native price in pence (GBP). */
  nativePrice?: number;
  /** Video: timeline project metadata (scenes, template, etc.). */
  metadata?: Record<string, unknown>;
  /** Video: platforms array, e.g. ['video-timeline']. */
  platforms?: string[];
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusLabel(s: string): string {
  const m: Record<string, string> = {
    draft: "Draft",
    scheduled: "Scheduled",
    published: "Published",
    "needs_review": "Needs review",
  };
  return m[s] ?? s;
}

/** Status badge colors for video cards: Draft (gray), Published (green), Scheduled (blue). */
function statusBadgeClass(status: string): string {
  const s = (status ?? "").toLowerCase();
  if (s === "published") return "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/40";
  if (s === "scheduled") return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/40";
  return "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/40";
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0s";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return sec > 0 ? `${m}:${sec.toString().padStart(2, "0")}` : `${m}m`;
}

function typeIcon(type: string) {
  switch (type) {
    case "product":
      return <Package className="w-5 h-5 text-orange-500" />;
    case "video":
      return <Video className="w-5 h-5 text-blue-500" />;
    case "script":
      return <FileText className="w-5 h-5 text-green-500" />;
    default:
      return <ImageIcon className="w-5 h-5 text-slate-500" />;
  }
}

const FORMAT_LABELS: Record<string, string> = {
  ebook: "Ebook",
  guide: "Guide",
  workbook: "Workbook",
  planner: "Planner",
  journal: "Journal",
  checklist: "Checklist Pack",
  course: "Course Outline",
  notion: "Notion Template",
  template: "Template",
  spreadsheet: "Spreadsheet Guide",
};

function formatLabel(format: string | undefined): string {
  if (!format) return "";
  return FORMAT_LABELS[format] ?? format.charAt(0).toUpperCase() + format.slice(1);
}

function isTimelineVideoItem(item: LibraryItem): boolean {
  return item.type === "video" && Array.isArray(item.platforms) && item.platforms.includes("video-timeline");
}

function getVideoDownloadUrl(item: LibraryItem): string | null {
  if (item.type !== "video" || !item.metadata || typeof item.metadata !== "object") return null;
  const m = item.metadata as Record<string, unknown>;
  const candidates = [
    m.videoUrl,
    m.video_url,
    m.exportUrl,
    m.export_url,
    m.downloadUrl,
    m.download_url,
    m.compiledUrl,
    m.compiled_url,
    m.outputUrl,
    m.output_url,
    m.compiledVideoUrl,
    m.compiled_video_url,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && /^https?:\/\//i.test(c.trim())) return c.trim();
  }
  return null;
}

/** Human-readable label for where a script came from (platform). */
const SCRIPT_SOURCE_LABELS: Record<string, string> = {
  "video-guide": "Digital Products",
  "content-studio": "YouTube",
  "script-checker": "Script Checker",
  "all": "Script Checker",
};
function scriptSourceLabel(platform: string | undefined): string {
  if (!platform) return "Library";
  return SCRIPT_SOURCE_LABELS[platform.toLowerCase()] ?? platform.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** SVG ring that shows product completion score (0–100). */
function CompletionRing({ score }: { score: number }) {
  const r = 16;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score === 100 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#e5e7eb";
  return (
    <div className="relative flex items-center justify-center" title={`${score}% complete`}>
      <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3.5" className="dark:stroke-slate-700" />
        <circle
          cx="20" cy="20" r={r}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.4s ease" }}
        />
      </svg>
      <span className="absolute text-[9px] font-bold text-slate-600 dark:text-slate-300 rotate-90">{score}%</span>
    </div>
  );
}

/** Icon for product format (used in thumbnail placeholder). */
function formatIcon(format: string | undefined) {
  const f = (format ?? "").toLowerCase();
  if (f === "planner" || f === "journal") return <Calendar className="w-10 h-10 text-orange-500/90" />;
  if (f === "ebook" || f === "guide") return <BookOpen className="w-10 h-10 text-orange-500/90" />;
  if (f === "workbook" || f === "checklist") return <ClipboardList className="w-10 h-10 text-orange-500/90" />;
  if (f === "notion" || f === "template") return <LayoutTemplate className="w-10 h-10 text-orange-500/90" />;
  return <Package className="w-10 h-10 text-orange-500/90" />;
}

/** Styled placeholder when thumbnail is missing or failed to load. */
function ThumbnailPlaceholder({
  item,
  className = "",
}: {
  item: LibraryItem;
  className?: string;
}) {
  const label =
    item.type === "product" && item.format
      ? formatLabel(item.format)
      : item.type === "video"
        ? "Video"
        : item.type === "script"
          ? "Script"
          : "Item";
  const icon =
    item.type === "product" ? formatIcon(item.format) : typeIcon(item.type);

  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 w-full h-full min-h-[140px] bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/30 text-orange-800 dark:text-orange-200 ${className}`}
      aria-hidden
    >
      {icon}
      <span className="text-sm font-semibold tracking-tight px-2 text-center">
        {label}
      </span>
    </div>
  );
}

/** Group bundle products by bundleId; returns array of { bundleId, bundleName, items }. */
function groupByBundle(items: LibraryItem[]): { bundleId: string; bundleName: string; items: LibraryItem[] }[] {
  const byId = new Map<string, LibraryItem[]>();
  for (const item of items) {
    if (item.type !== "product" || !item.bundleId) continue;
    const list = byId.get(item.bundleId) ?? [];
    list.push(item);
    byId.set(item.bundleId, list);
  }
  return Array.from(byId.entries()).map(([bundleId, list]) => {
    const first = list[0];
    const title = first?.title ?? "";
    const bundleName = title.replace(/\s*-\s*(Ebook|Workbook|Planner|Journal|Checklist Pack|Course Outline|Notion Template|Spreadsheet Guide)\s*$/i, "").trim() || title;
    return { bundleId, bundleName, items: list };
  });
}

/** Timeline videos that share `metadata.seriesTitle` (from Template Studio) render under one heading. */
function groupTimelineVideosBySeries(items: LibraryItem[]): { seriesTitle: string | null; items: LibraryItem[] }[] {
  const bySeries = new Map<string, LibraryItem[]>();
  const ungrouped: LibraryItem[] = [];
  for (const item of items) {
    const meta = item.metadata;
    const st =
      meta &&
      typeof meta === "object" &&
      meta !== null &&
      typeof (meta as { seriesTitle?: unknown }).seriesTitle === "string" &&
      (meta as { seriesTitle: string }).seriesTitle.trim().length > 0
        ? (meta as { seriesTitle: string }).seriesTitle.trim()
        : null;
    if (st) {
      const list = bySeries.get(st) ?? [];
      list.push(item);
      bySeries.set(st, list);
    } else {
      ungrouped.push(item);
    }
  }
  const out: { seriesTitle: string | null; items: LibraryItem[] }[] = [];
  const keys = [...bySeries.keys()].sort((a, b) => a.localeCompare(b));
  for (const k of keys) {
    const list = bySeries.get(k)!;
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    out.push({ seriesTitle: k, items: list });
  }
  if (ungrouped.length > 0) {
    ungrouped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    out.push({ seriesTitle: null, items: ungrouped });
  }
  return out;
}

function itemMatchesLibrarySearch(item: LibraryItem, q: string): boolean {
  if (!q) return true;
  if (item.title.toLowerCase().includes(q)) return true;
  const meta = item.metadata;
  if (meta && typeof meta === "object" && meta !== null) {
    const st = (meta as { seriesTitle?: unknown }).seriesTitle;
    if (typeof st === "string" && st.toLowerCase().includes(q)) return true;
  }
  return false;
}

export default function LibraryFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as LibraryTab | null) ?? "all";
  const [tab, setTab] = useState<LibraryTab>(initialTab);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  /** Item ids whose thumbnail failed to load (404, CORS, etc.) — show placeholder instead. */
  const [thumbnailErrors, setThumbnailErrors] = useState<Set<string>>(new Set());
  const [fetchError, setFetchError] = useState<string | null>(null);
  /** Timeline video preview modal: open in timeline to preview (no stored video URL). */
  const [previewVideo, setPreviewVideo] = useState<{ id: string; title: string; openHref: string } | null>(null);
  const [templatePacks, setTemplatePacks] = useState<TemplatePackItem[]>([]);
  const [packsLoading, setPacksLoading] = useState(false);
  const [youtubePosts, setYoutubePosts] = useState<ScheduledPostItem[]>([]);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [myImages, setMyImages] = useState<{ id: string; title: string; url: string | null; createdAt: string }[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  /** YouTube publish sheet state */
  const [ytPublishItem, setYtPublishItem] = useState<{
    videoId?: string;
    videoTitle: string;
    videoUrl: string;
    thumbnailUrl?: string;
    niche?: string;
  } | null>(null);
  const { toast } = useToast();

  const showThumbnail = (item: LibraryItem) =>
    Boolean(item.thumbnail && !thumbnailErrors.has(item.id));

  const markThumbnailError = (itemId: string) => {
    setThumbnailErrors((prev) => new Set(prev).add(itemId));
  };

  const STALE_KEY = (t: string) => `cf:library:${t}`;

  const fetchItems = async (attempt = 1) => {
    // On first attempt, immediately show stale cached data so the page isn't blank
    if (attempt === 1) {
      setFetchError(null);
      try {
        const stale = localStorage.getItem(STALE_KEY(tab));
        if (stale) {
          const parsed = JSON.parse(stale);
          if (Array.isArray(parsed)) setItems(parsed);
        }
      } catch { /* ignore */ }
    }
    setLoading(true);
    try {
      const isTrash = tab === "trash";
      const typeParam = isTrash ? "all" : tab === "bundles" ? "bundles" : tab === "timeline" ? "timeline" : tab === "all" ? "all" : tab;
      const url = isTrash
        ? `/api/library?type=all&deleted=true`
        : `/api/library?type=${typeParam}`;
      const controller = new AbortController();
      // 20s timeout; auto-retry up to 2 times on slow DB cold-start
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error("Failed to load library");
      const data = await res.json();
      const freshItems = Array.isArray(data) ? data : [];
      setItems(freshItems);
      setFetchError(null);
      // Persist to localStorage for instant stale load next time
      if (!isTrash) {
        try { localStorage.setItem(STALE_KEY(tab), JSON.stringify(freshItems)); } catch { /* ignore */ }
      }
    } catch (err) {
      const isTimeout = (err as { name?: string })?.name === "AbortError";
      // Auto-retry silently up to 2 times on timeout (DB cold start)
      if (isTimeout && attempt < 3) {
        setLoading(false);
        return fetchItems(attempt + 1);
      }
      // After retries exhausted, show inline error (no red toast — items may still show from stale cache)
      setFetchError(isTimeout ? "Taking too long — tap Retry to try again." : (err instanceof Error ? err.message : "Failed to load library"));
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplatePacks = async () => {
    setPacksLoading(true);
    try {
      const res = await fetch("/api/template-packs");
      if (!res.ok) throw new Error("Failed to load template packs");
      const data = await res.json();
      setTemplatePacks(Array.isArray(data) ? data : []);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to load template packs", variant: "destructive" });
      setTemplatePacks([]);
    } finally {
      setPacksLoading(false);
    }
  };

  const fetchYouTubePosts = async () => {
    setYoutubeLoading(true);
    try {
      const res = await fetch("/api/scheduled-posts");
      if (!res.ok) throw new Error("Failed to load YouTube posts");
      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];
      const ytOnly = rows.filter(
        (r: { platform?: unknown }) => typeof r.platform === "string" && r.platform.toLowerCase() === "youtube"
      );
      setYoutubePosts(ytOnly);
    } catch (err) {
      // Fallback: show locally queued YouTube posts when DB schedule API is unavailable.
      let localQueued: ScheduledPostItem[] = [];
      try {
        const localRows = JSON.parse(localStorage.getItem("cf:youtube-queue-local") ?? "[]") as ScheduledPostItem[];
        localQueued = Array.isArray(localRows) ? localRows : [];
      } catch {
        localQueued = [];
      }
      if (localQueued.length > 0) {
        setYoutubePosts(localQueued);
        toast({
          title: "Using local queue",
          description: "Cloud scheduled-post API unavailable. Showing locally queued YouTube posts.",
        });
      } else {
        toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to load YouTube posts", variant: "destructive" });
        setYoutubePosts([]);
      }
    } finally {
      setYoutubeLoading(false);
    }
  };

  const fetchImages = async () => {
    setImagesLoading(true);
    try {
      const res = await fetch("/api/library/items?type=generated_image");
      if (!res.ok) throw new Error("Failed to load images");
      const data = await res.json();
      setMyImages(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Could not load images", variant: "destructive" });
    } finally {
      setImagesLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "templates" || tab === "history") return;
    if (tab === "youtube") { fetchYouTubePosts(); return; }
    if (tab === "images") { fetchImages(); return; }
    if (tab === "template-packs") fetchTemplatePacks();
    else fetchItems();
  }, [tab]);

  const searchQuery = search.trim().toLowerCase();
  const filtered = items.filter((item) => itemMatchesLibrarySearch(item, searchQuery));
  const timelineOnlyFiltered = tab === "timeline" ? filtered.filter(isTimelineVideoItem) : [];
  const compiledVideoFiltered = tab === "timeline" ? filtered.filter((i) => !isTimelineVideoItem(i) && i.type === "video") : [];
  const timelineSeriesSections = tab === "timeline" ? groupTimelineVideosBySeries(timelineOnlyFiltered) : [];
  const timelineHasNamedSeries = timelineSeriesSections.some((s) => s.seriesTitle !== null);

  const getEditLink = (item: LibraryItem) => {
    if (item.type === "product") return `/dashboard/digital-products/${item.id}/edit`;
    if (isTimelineVideoItem(item)) {
      return `/dashboard/video-timeline?projectId=${encodeURIComponent(item.id)}`;
    }
    if (item.type === "video") return `/dashboard/library`;
    if (item.type === "script" && (item.platform === "video-guide" || item.platform === "content-studio")) return `/dashboard/digital-products/video-guide?libraryScriptId=${encodeURIComponent(item.id)}${item.platform === "content-studio" ? "&source=content-studio" : ""}`;
    if (item.type === "script") return `/dashboard/script-checker`;
    return "#";
  };

  const isTrashView = tab === "trash";
  const isTimelineView = tab === "timeline";

  const handleRetryGeneration = async (item: LibraryItem) => {
    setRetryingIds((prev) => new Set(prev).add(item.id));
    try {
      const res = await fetch(`/api/products/${item.id}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retry: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Retry failed");
      }
      toast({ title: "Regenerating", description: "Your product is generating again — it will update here when done." });
      // Poll until done, then refresh the item status in the list
      const poll = async () => {
        for (let i = 0; i < 120; i++) {
          await new Promise(r => setTimeout(r, 3000));
          const r = await fetch(`/api/products/${item.id}`).catch(() => null);
          if (!r?.ok) continue;
          const data = await r.json().catch(() => ({}));
          const status = data?.status;
          const sections: Array<{ content?: string; contentHtml?: string }> = data?.content?.sections ?? [];
          const hasContent = sections.length > 0 && sections.every(s => ((s?.content ?? s?.contentHtml ?? "").trim().length > 0));
          if (status === "draft" && hasContent) {
            setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: "draft" } : p));
            setRetryingIds(prev => { const s = new Set(prev); s.delete(item.id); return s; });
            toast({ title: "Ready!", description: `${item.title} has been regenerated.` });
            return;
          }
          if (status === "failed") {
            setRetryingIds(prev => { const s = new Set(prev); s.delete(item.id); return s; });
            toast({ title: "Generation failed", description: "Try clicking Retry again.", variant: "destructive" });
            return;
          }
        }
        setRetryingIds(prev => { const s = new Set(prev); s.delete(item.id); return s; });
        toast({ title: "Still generating", description: "Check back in a few minutes.", variant: "destructive" });
      };
      poll();
    } catch (err) {
      setRetryingIds(prev => { const s = new Set(prev); s.delete(item.id); return s; });
      toast({ title: "Retry failed", description: err instanceof Error ? err.message : "Could not retry.", variant: "destructive" });
    }
  };

  const handleDelete = async (item: LibraryItem, permanent = false) => {
    const message = permanent
      ? `Permanently delete "${item.title}"? This cannot be undone.`
      : `Move "${item.title}" to Trash? You can restore it later.`;
    if (!confirm(message)) return;
    try {
      let url = "";
      if (item.type === "product") url = `/api/products/${item.id}`;
      if (item.type === "video") url = `/api/library/videos/${item.id}`;
      if (item.type === "script") url = `/api/library/scripts/${item.id}`;
      if (!url) return;
      if (permanent) url += "?permanent=true";
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast({ title: permanent ? "Permanently deleted" : "Moved to Trash" });
      fetchItems();
    } catch (err) {
      toast({ title: "Error", description: "Could not delete", variant: "destructive" });
    }
  };

  const handleRestore = async (item: LibraryItem) => {
    try {
      let url = "";
      let method = "POST";
      if (item.type === "product") url = `/api/products/${item.id}`;
      if (item.type === "video") url = `/api/library/videos/${item.id}`;
      if (item.type === "script") url = `/api/library/scripts/${item.id}`;
      if (!url) return;
      const res = await fetch(url, { method });
      if (!res.ok) throw new Error("Failed to restore");
      toast({ title: "Restored", description: `"${item.title}" is back in your library.` });
      fetchItems();
    } catch (err) {
      toast({ title: "Error", description: "Could not restore", variant: "destructive" });
    }
  };

  const handleDuplicate = async (item: LibraryItem) => {
    if (item.type !== "product") return;
    try {
      const res = await fetch(`/api/products/${item.id}/duplicate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to duplicate");
      toast({ title: "Product duplicated!", description: "Opening your copy…" });
      router.push(`/dashboard/digital-products/${data.id}/edit`);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to duplicate", variant: "destructive" });
    }
  };

  const handleDeleteAll = async () => {
    setDeletingAll(true);
    try {
      const res = await fetch("/api/library/delete-all", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete all");
      setDeleteAllOpen(false);
      toast({ title: "All items deleted", description: "Your library has been cleared." });
      fetchItems();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Could not delete all items", variant: "destructive" });
    } finally {
      setDeletingAll(false);
    }
  };

  const handleDownloadItem = (item: LibraryItem) => {
    if (item.type !== "video") {
      toast({ title: "Download not available", description: "Only exported videos can be downloaded." });
      return;
    }
    const url = getVideoDownloadUrl(item);
    if (!url) {
      // No compiled MP4 yet — take them straight to the editor to export
      const editLink = getEditLink(item);
      if (editLink && editLink !== "/dashboard/library") {
        toast({
          title: "Not exported yet",
          description: "Taking you to the editor — compile to MP4 there to download.",
        });
        router.push(editLink);
      } else {
        toast({
          title: "No downloadable video yet",
          description: "Open the Editor, compile to MP4, then come back to download.",
          variant: "destructive",
        });
      }
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.title || "video"}.mp4`;
    a.target = "_blank";
    a.rel = "noopener";
    a.click();
  };

  const showDeleteAll = !isTrashView && tab !== "template-packs" && tab !== "templates" && tab !== "history" && tab !== "youtube" && items.length > 0;

  return (
    <main className="p-6 md:p-10 max-w-5xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-orange-500 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Library</h1>
        {loading && items.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Refreshing…
          </span>
        )}
      </div>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Your digital products, video guides, and scripts in one place
      </p>

      <Tabs value={tab} onValueChange={(v) => setTab(v as LibraryTab)}>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <TabsList data-tour="library-tabs" className="bg-gray-200 dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A]">
            <TabsTrigger value="all" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-600 dark:text-gray-400">All items</TabsTrigger>
            <TabsTrigger value="products" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-600 dark:text-gray-400">Digital Products</TabsTrigger>
            <TabsTrigger value="bundles" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-600 dark:text-gray-400">Bundles</TabsTrigger>
            <TabsTrigger value="scripts" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-600 dark:text-gray-400">Scripts</TabsTrigger>
            <TabsTrigger value="timeline" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-600 dark:text-gray-400">My Videos</TabsTrigger>
            <TabsTrigger value="youtube" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
              <span>YouTube</span>
              <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden />
            </TabsTrigger>
            <TabsTrigger value="images" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-600 dark:text-gray-400">Images</TabsTrigger>
            <TabsTrigger value="template-packs" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-600 dark:text-gray-400">Template Packs</TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-600 dark:text-gray-400">Templates</TabsTrigger>
            <TabsTrigger value="trash" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-600 dark:text-gray-400">Trash</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Delete All: only when there are items and not viewing Trash; opens confirmation modal */}
            {showDeleteAll && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
                onClick={() => setDeleteAllOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Delete All
              </Button>
            )}
            <div data-tour="library-search" className="relative w-48 sm:w-64 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white dark:bg-[#1A1A1A] border-[#E5E7EB] dark:border-[#2A2A2A] text-gray-900 dark:text-white placeholder:text-gray-500"
            />
          </div>
          </div>
        </div>

        <Dialog open={!!previewVideo} onOpenChange={(open) => !open && setPreviewVideo(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Preview video</DialogTitle>
              <DialogDescription>
                {previewVideo ? `Open "${previewVideo.title}" in the Timeline editor to preview and export.` : ""}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setPreviewVideo(null)}>
                Cancel
              </Button>
              {previewVideo && (
                <Button asChild>
                  <Link href={previewVideo.openHref}>Open in Timeline</Link>
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <AlertDialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete all items?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete all items? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingAll}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteAll();
                }}
                disabled={deletingAll}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deletingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete All"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <TabsContent value={tab} className="mt-0">
          {tab === "images" ? (
            <div className="space-y-4">
              {!imagesLoading && myImages.length > 0 && (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-950"
                    onClick={async () => {
                      if (!confirm("Delete all saved images? This cannot be undone.")) return;
                      await fetch("/api/library/items?type=generated_image", { method: "DELETE" });
                      setMyImages([]);
                      toast({ title: "All images deleted" });
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete All
                  </Button>
                </div>
              )}
              {imagesLoading ? (
                <div className="py-16 flex flex-col items-center justify-center">
                  <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">Loading images...</p>
                </div>
              ) : myImages.length === 0 ? (
                <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
                  <CardContent className="py-12 text-center">
                    <ImageIcon className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No saved images yet</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
                      Generate images in AI Coach and click &ldquo;Save to Library&rdquo; to see them here.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {myImages.map((img) => (
                    <Card key={img.id} className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] overflow-hidden group">
                      <div className="relative">
                        {img.url ? (
                          <img src={img.url} alt={img.title} className="w-full aspect-video object-cover" />
                        ) : (
                          <div className="w-full aspect-video bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <ImageIcon className="w-10 h-10 text-gray-400" />
                          </div>
                        )}
                        <button
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          title="Delete image"
                          onClick={async () => {
                            await fetch(`/api/library/items?id=${img.id}`, { method: "DELETE" });
                            setMyImages((prev) => prev.filter((i) => i.id !== img.id));
                            toast({ title: "Image deleted" });
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <CardContent className="p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{new Date(img.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                        <div className="flex items-center gap-2">
                          {img.url && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 gap-1.5"
                              onClick={async () => {
                                try {
                                  const res = await fetch(img.url!);
                                  const blob = await res.blob();
                                  const a = document.createElement("a");
                                  a.href = URL.createObjectURL(blob);
                                  a.download = `ai-image-${img.id.slice(0, 6)}.png`;
                                  a.click();
                                  URL.revokeObjectURL(a.href);
                                } catch {
                                  toast({ title: "Download failed", variant: "destructive" });
                                }
                              }}
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 gap-1.5 text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-950"
                            onClick={async () => {
                              await fetch(`/api/library/items?id=${img.id}`, { method: "DELETE" });
                              setMyImages((prev) => prev.filter((i) => i.id !== img.id));
                              toast({ title: "Image deleted" });
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : tab === "templates" ? (
            <TemplatesClient />
          ) : tab === "history" ? (
            <HistoryClient />
          ) : tab === "youtube" ? (
            <div className="space-y-4">
              {youtubeLoading ? (
                <div className="py-16 flex flex-col items-center justify-center">
                  <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">Loading YouTube queue...</p>
                </div>
              ) : youtubePosts.length === 0 ? (
                <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
                  <CardContent className="py-12 text-center">
                    <Video className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No YouTube posts queued</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
                      Queue a YouTube post from Thumbnail Generator or Template Studio.
                    </p>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/dashboard/content-studio/thumbnails">Open Thumbnail Generator</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {youtubePosts.map((p) => {
                    const content = (p.contentJson ?? {}) as Record<string, unknown>;
                    const title =
                      typeof content.title === "string" && content.title.trim()
                        ? content.title
                        : "Untitled YouTube Post";
                    const accountId =
                      typeof content.youtubeAccountId === "string" ? content.youtubeAccountId : "unknown";
                    const when = p.scheduledTime ? formatDate(p.scheduledTime) : "No schedule";
                    return (
                      <Card key={p.id} className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
                        <CardHeader className="pb-2 pt-3">
                          <CardTitle className="text-base truncate text-gray-900 dark:text-white">{title}</CardTitle>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <Badge variant="secondary" className="text-xs font-normal bg-red-500/10 text-red-600 dark:text-red-400 border-0">
                              YouTube
                            </Badge>
                            <Badge variant="secondary" className="text-xs font-normal bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0">
                              {p.postedStatus ? "Posted" : "Queued"}
                            </Badge>
                          </div>
                          <CardDescription className="text-xs">
                            Scheduled: {when}
                          </CardDescription>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">Account: {accountId}</p>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <Button asChild variant="outline" size="sm" className="w-full">
                            <Link href="/dashboard/content-studio/thumbnails">
                              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                              Open queue source
                            </Link>
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (tab === "template-packs" ? packsLoading : (loading && items.length === 0)) ? (
            <div className="py-16 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Loading library...</p>
            </div>
          ) : fetchError && items.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
                <RotateCcw className="w-6 h-6 text-orange-500" />
              </div>
              <p className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                Couldn&apos;t load your library
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 max-w-xs">
                {fetchError}
              </p>
              <Button
                onClick={() => fetchItems()}
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Retry
              </Button>
            </div>
          ) : tab === "template-packs" && templatePacks.length === 0 ? (
            <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
              <CardContent className="py-12 text-center">
                <LayoutTemplate className="w-12 h-12 text-gray-500 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-2">No template packs yet</p>
                <p className="text-sm text-gray-500 mb-4">
                  Create slides in Template Studio and save a pack to see it here.
                </p>
                <Button asChild className="bg-orange-500 hover:bg-orange-600">
                  <Link href="/dashboard/template-studio">Template Studio</Link>
                </Button>
              </CardContent>
            </Card>
          ) : tab === "template-packs" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templatePacks.map((pack) => (
                <Card key={pack.id} className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-base truncate text-gray-900 dark:text-white">{pack.packName}</CardTitle>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <Badge variant="secondary" className="text-xs font-normal bg-orange-500/10 text-orange-600 dark:text-orange-400 border-0">
                        {pack.templateType.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      {pack.slideCount} slide{pack.slideCount !== 1 ? "s" : ""}
                      {pack.niche ? ` • ${pack.niche}` : ""}
                    </CardDescription>
                    <p className="text-xs text-gray-500 mt-0.5">{formatDate(pack.createdAt)}</p>
                  </CardHeader>
                  <CardContent className="pt-0 flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" className="flex-1 min-w-0" asChild>
                      <Link href={`/dashboard/template-studio?packId=${encodeURIComponent(pack.id)}`}>
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                        Re-open
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/template-studio?packId=${encodeURIComponent(pack.id)}&download=1`}>
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
              <CardContent className="py-12 text-center">
                {isTrashView ? (
                  <>
                    <Trash className="w-12 h-12 text-gray-500 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 mb-2">Trash is empty</p>
                    <p className="text-sm text-gray-500">
                      Deleted items appear here. Restore them or delete permanently.
                    </p>
                  </>
                ) : tab === "timeline" ? (
                  <>
                    <Video className="w-12 h-12 text-gray-500 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 mb-2">No videos yet</p>
                    <p className="text-sm text-gray-500 mb-4">
                      Create a video in the Timeline editor and export to save it here.
                    </p>
                    <Button asChild className="bg-orange-500 hover:bg-orange-600">
                      <Link href="/dashboard/video-timeline">Open Timeline</Link>
                    </Button>
                  </>
                ) : tab === "bundles" ? (
                  <>
                    <Package className="w-12 h-12 text-gray-500 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 mb-2">No bundles yet</p>
                    <p className="text-sm text-gray-500 mb-4">
                      Generate a full bundle from Digital Products (one topic → all 8 formats) to see it here.
                    </p>
                    <Button asChild className="bg-orange-500 hover:bg-orange-600">
                      <Link href="/dashboard/digital-products">Digital Products</Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Package className="w-12 h-12 text-gray-500 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 mb-2">No items yet</p>
                    <p className="text-sm text-gray-500 mb-4">
                      Save products from Digital Products, scripts from Script Checker, and videos from TikTok Shop. Video guides are saved here automatically when you create them.
                    </p>
                    <div className="flex flex-wrap gap-3 justify-center">
                      <Button asChild className="bg-orange-500 hover:bg-orange-600">
                        <Link href="/dashboard/digital-products">Digital Products</Link>
                      </Button>
                      <Button asChild variant="outline" className="border-[#E5E7EB] dark:border-[#2A2A2A]">
                        <Link href="/dashboard/digital-products">Create Video Guide</Link>
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : tab === "timeline" ? (
            <div className="space-y-10">
              {/* Compiled videos (TikTok Shop, Digital Products, Video Guides) */}
              {compiledVideoFiltered.length > 0 && (
                <section>
                  {timelineOnlyFiltered.length > 0 && (
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Compiled Videos</h2>
                  )}
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {compiledVideoFiltered.map((video) => {
                      const downloadUrl = getVideoDownloadUrl(video);
                      return (
                        <Card key={video.id} className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] overflow-hidden">
                          <div className="relative aspect-video bg-gray-200 dark:bg-[#2A2A2A] rounded-t-lg flex items-center justify-center overflow-hidden">
                            {downloadUrl ? (
                              <video src={downloadUrl} className="w-full h-full object-cover" muted playsInline />
                            ) : (
                              <div className="text-4xl" aria-hidden>🎬</div>
                            )}
                          </div>
                          <CardHeader className="pb-2 pt-3">
                            <div className="flex items-start justify-between gap-2">
                              <CardTitle className="text-base truncate text-gray-900 dark:text-white min-w-0">{video.title}</CardTitle>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                                    onClick={() => handleDelete(video)}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{formatDate(video.createdAt)}</p>
                          </CardHeader>
                          <CardContent className="pt-0 flex gap-2 flex-wrap">
                            {downloadUrl && (
                              <Button variant="outline" size="sm" className="flex-1 min-w-0" asChild>
                                <a href={downloadUrl} download target="_blank" rel="noopener noreferrer">
                                  <Download className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                                  Download
                                </a>
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              )}
              {/* Timeline series videos */}
              {timelineSeriesSections.map((section) => {
                if (section.items.length === 0) return null;
                const showHeading =
                  section.seriesTitle !== null || (timelineHasNamedSeries && section.seriesTitle === null);
                return (
                  <section key={section.seriesTitle ?? "__other__"}>
                    {showHeading ? (
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        {section.seriesTitle ?? "Other videos"}
                      </h2>
                    ) : null}
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                      {section.items.map((project) => {
                        const content = (project.metadata ?? {}) as {
                          scenes?: { duration?: number; elements?: { media?: { url?: string } }[] }[];
                          template?: { name?: string };
                          platform?: string;
                          publishedPlatforms?: string[];
                          [key: string]: unknown;
                        };
                        const scenes = Array.isArray(content.scenes) ? content.scenes : [];
                        const totalDuration = scenes.reduce((acc, s) => acc + (Number(s.duration) || 0), 0);
                        const firstScene = scenes[0];
                        const backgroundMediaUrl =
                          firstScene?.elements?.[0] && typeof firstScene.elements[0] === "object" && firstScene.elements[0] !== null && "media" in firstScene.elements[0]
                            ? (firstScene.elements[0] as { media?: { url?: string } }).media?.url
                            : undefined;
                        const templateName = content.template && typeof content.template === "object" && "name" in content.template ? String(content.template.name) : undefined;
                        const openHref = `/dashboard/video-timeline?projectId=${encodeURIComponent(project.id)}`;
                        const publishedPlatforms = Array.isArray(content.publishedPlatforms)
                          ? content.publishedPlatforms
                          : typeof content.platform === "string" && content.platform
                            ? [content.platform]
                            : [];
                        return (
                          <Card key={project.id} className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] overflow-hidden">
                            <div className="relative aspect-video bg-gray-200 dark:bg-[#2A2A2A] rounded-t-lg flex items-center justify-center overflow-hidden">
                              {backgroundMediaUrl ? (
                                <img src={backgroundMediaUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="text-4xl" aria-hidden>🎬</div>
                              )}
                              {totalDuration > 0 && (
                                <span className="absolute top-2 right-2 rounded bg-black/70 text-white text-xs font-medium px-1.5 py-0.5">
                                  {formatDuration(totalDuration)}
                                </span>
                              )}
                              {totalDuration > 0 && (
                                <span className="absolute bottom-2 right-2 rounded bg-black/70 text-white text-xs font-medium px-1.5 py-0.5">
                                  {formatDuration(totalDuration)}
                                </span>
                              )}
                            </div>
                            <CardHeader className="pb-2 pt-3">
                              <div className="flex items-start justify-between gap-2">
                                <CardTitle className="text-base truncate text-gray-900 dark:text-white min-w-0">{project.title}</CardTitle>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Badge variant="outline" className={`text-xs font-normal ${statusBadgeClass(project.status ?? "draft")}`}>
                                    {statusLabel(project.status ?? "draft")}
                                  </Badge>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreVertical className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                                        onClick={() => handleDelete(project)}
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                              <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                                {templateName ?? "Video"} • {scenes.length} scene{scenes.length !== 1 ? "s" : ""}
                                {totalDuration > 0 && ` • ${formatDuration(totalDuration)}`}
                              </CardDescription>
                              <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                                {formatDate(project.createdAt)}
                              </p>
                              {publishedPlatforms.length > 0 && (project.status ?? "").toLowerCase() === "published" && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {publishedPlatforms.map((p) => {
                                    const name = String(p).toLowerCase();
                                    const label = name.includes("tiktok") ? "TikTok" : name.includes("instagram") ? "Instagram" : name.includes("youtube") ? "YouTube" : p;
                                    return (
                                      <Badge key={p} variant="secondary" className="text-xs font-normal bg-muted">
                                        {label}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              )}
                            </CardHeader>
                            <CardContent className="pt-0 flex gap-2 flex-wrap">
                              <Button variant="outline" size="sm" className="flex-1 min-w-0" asChild>
                                <Link href={openHref}>
                                  <ExternalLink className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                                  Open
                                </Link>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                title="Preview"
                                onClick={() => setPreviewVideo({ id: project.id, title: project.title, openHref })}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="outline" size="sm" asChild title="Download">
                                <Link href={openHref}>
                                  <Download className="w-3.5 h-3.5" />
                                </Link>
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : tab === "bundles" ? (
            <div className="space-y-10">
              {groupByBundle(filtered).map(({ bundleId, bundleName, items: bundleItems }) => (
                <section key={bundleId}>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{bundleName}</h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {bundleItems.map((item) => (
                      <Card key={item.id} className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] overflow-hidden">
                        <div className="aspect-video bg-gray-200 dark:bg-[#2A2A2A] flex items-center justify-center overflow-hidden">
                          {showThumbnail(item) ? (
                            <img
                              src={item.thumbnail}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={() => markThumbnailError(item.id)}
                            />
                          ) : (
                            <ThumbnailPlaceholder item={item} />
                          )}
                        </div>
                        <CardHeader className="pb-2 pt-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-base truncate text-gray-900 dark:text-white flex-1">{item.title}</CardTitle>
                                {item.type === "product" && typeof item.completionScore === "number" && (
                                  <CompletionRing score={item.completionScore} />
                                )}
                              </div>
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {item.type === "product" && item.format && (
                                  <Badge variant="secondary" className="text-xs font-normal bg-orange-500/10 text-orange-600 dark:text-orange-400 border-0">
                                    {formatLabel(item.format)}
                                  </Badge>
                                )}
                                {item.type === "product" && item.completionScore === 100 && (
                                  <Badge variant="secondary" className="text-xs font-normal bg-green-500/10 text-green-600 dark:text-green-400 border-0">
                                    ✓ Ready to sell
                                  </Badge>
                                )}
                                {item.type === "product" && (item.designSource === "ai" || item.designSource === "brand") && (
                                  <Badge variant="secondary" className="text-xs font-normal bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
                                    AI Designed
                                  </Badge>
                                )}
                                {item.type === "product" && item.hasPromoVideo && (
                                  <Badge variant="secondary" className="text-xs font-normal bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0" title="Has avatar promo video">
                                    🎬 Video
                                  </Badge>
                                )}
                                {item.type === "product" && item.hasBookMockup && (
                                  <Badge variant="secondary" className="text-xs font-normal bg-purple-500/10 text-purple-600 dark:text-purple-400 border-0" title="Has book mockup">
                                    📸 Mockup
                                  </Badge>
                                )}
                                {item.type === "video" && (item.metadata as { sourceType?: string })?.sourceType === "ai-story" && (
                                  <Badge variant="secondary" className="text-xs font-normal bg-violet-500/10 text-violet-600 dark:text-violet-400 border-0">
                                    AI Story
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={getEditLink(item)}>
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Edit
                                  </Link>
                                </DropdownMenuItem>
                                {item.type === "product" && (
                                  <DropdownMenuItem asChild>
                                    <Link href={`/dashboard/digital-products/scripts?productId=${encodeURIComponent(item.id)}`}>
                                      <Video className="w-4 h-4 mr-2" />
                                      Create Videos
                                    </Link>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleDownloadItem(item)}>
                                  <Download className="w-4 h-4 mr-2" />
                                  Download
                                </DropdownMenuItem>
                                {item.type === "product" && (
                                  <DropdownMenuItem onClick={() => handleDuplicate(item)}>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Duplicate
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600 dark:text-red-400" onClick={() => handleDelete(item, false)}>
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Move to Trash
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <CardDescription className="text-xs">
                            {formatDate(item.createdAt)} • {item.status === "generating" ? <span className="text-orange-500 font-medium">generating…</span> : statusLabel(item.status)}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0 flex gap-2">
                          {item.type === "product" && item.status === "generating" ? (
                            <Button
                              size="sm"
                              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                              disabled={retryingIds.has(item.id)}
                              onClick={() => handleRetryGeneration(item)}
                            >
                              {retryingIds.has(item.id) ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Regenerating…</> : <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Retry Generation</>}
                            </Button>
                          ) : (
                            <>
                              <Button variant="outline" size="sm" className="flex-1" asChild>
                                <Link href={getEditLink(item)}>
                                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                                  Open
                                </Link>
                              </Button>
                              {item.type === "product" && (
                                <SellOnCFButton
                                  productId={item.id}
                                  productTitle={item.title}
                                  isNativePublished={item.isNativePublished}
                                  nativePrice={item.nativePrice}
                                />
                              )}
                              {item.type === "product" && (
                                <QuickSellSheet productId={item.id} productTitle={item.title} />
                              )}
                            </>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item) => (
                <Card key={`${item.type}-${item.id}`} className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] overflow-hidden">
                  <div className="aspect-video bg-gray-200 dark:bg-[#2A2A2A] flex items-center justify-center overflow-hidden">
                    {showThumbnail(item) ? (
                      <img
                        src={item.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={() => markThumbnailError(item.id)}
                      />
                    ) : (
                      <ThumbnailPlaceholder item={item} />
                    )}
                  </div>
                  <CardHeader className="pb-2 pt-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base truncate text-gray-900 dark:text-white flex-1">{item.title}</CardTitle>
                          {item.type === "product" && typeof item.completionScore === "number" && (
                            <CompletionRing score={item.completionScore} />
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {item.type === "product" && item.format && (
                            <Badge variant="secondary" className="text-xs font-normal bg-orange-500/10 text-orange-600 dark:text-orange-400 border-0">
                              {formatLabel(item.format)}
                            </Badge>
                          )}
                          {item.type === "product" && item.completionScore === 100 && (
                            <Badge variant="secondary" className="text-xs font-normal bg-green-500/10 text-green-600 dark:text-green-400 border-0">
                              ✓ Ready to sell
                            </Badge>
                          )}
                          {item.type === "product" && (item.designSource === "ai" || item.designSource === "brand") && (
                            <Badge variant="secondary" className="text-xs font-normal bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
                              AI Designed
                            </Badge>
                          )}
                          {item.type === "product" && item.hasPromoVideo && (
                            <Badge variant="secondary" className="text-xs font-normal bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0" title="Has avatar promo video">
                              🎬 Video
                            </Badge>
                          )}
                          {item.type === "product" && item.hasBookMockup && (
                            <Badge variant="secondary" className="text-xs font-normal bg-purple-500/10 text-purple-600 dark:text-purple-400 border-0" title="Has book mockup">
                              📸 Mockup
                            </Badge>
                          )}
                          {item.type === "script" && (
                            <Badge variant="secondary" className="text-xs font-normal bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0">
                              From: {scriptSourceLabel(item.platform)}
                            </Badge>
                          )}
                          {item.type === "video" && (item.metadata as { sourceType?: string })?.sourceType === "ai-story" && (
                            <Badge variant="secondary" className="text-xs font-normal bg-violet-500/10 text-violet-600 dark:text-violet-400 border-0">
                              AI Story
                            </Badge>
                          )}
                          {isTimelineVideoItem(item) && (
                            <Badge variant="secondary" className="text-xs font-normal bg-amber-500/10 text-amber-700 dark:text-amber-400 border-0">
                              Timeline Draft
                            </Badge>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!isTrashView && (
                            <>
                              <DropdownMenuItem asChild>
                                <Link href={getEditLink(item)}>
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                              {item.type === "product" && (
                                <DropdownMenuItem asChild>
                                  <Link href={`/dashboard/digital-products/scripts?productId=${encodeURIComponent(item.id)}`}>
                                    <Video className="w-4 h-4 mr-2" />
                                    Create Videos
                                  </Link>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleDownloadItem(item)}>
                                <Download className="w-4 h-4 mr-2" />
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(item.title)}>
                                <Copy className="w-4 h-4 mr-2" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600 dark:text-red-400"
                                onClick={() => handleDelete(item, false)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Move to Trash
                              </DropdownMenuItem>
                            </>
                          )}
                          {isTrashView && (
                            <>
                              <DropdownMenuItem onClick={() => handleRestore(item)}>
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Restore
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600 dark:text-red-400"
                                onClick={() => handleDelete(item, true)}
                              >
                                <Trash className="w-4 h-4 mr-2" />
                                Delete permanently
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardDescription className="text-xs">
                      {formatDate(item.createdAt)} • {item.status === "generating" ? <span className="text-orange-500 font-medium">generating…</span> : statusLabel(item.status)}
                      {item.type === "script" && item.platform && (
                        <span className="text-muted-foreground"> • From: {scriptSourceLabel(item.platform)}</span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 flex gap-2">
                    {isTrashView ? (
                      <>
                        <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => handleRestore(item)}>
                          <RotateCcw className="w-3.5 h-3.5" />
                          Restore
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                          onClick={() => handleDelete(item, true)}
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : item.type === "product" && item.status === "generating" ? (
                      <Button
                        size="sm"
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                        disabled={retryingIds.has(item.id)}
                        onClick={() => handleRetryGeneration(item)}
                      >
                        {retryingIds.has(item.id) ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Regenerating…</> : <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Retry Generation</>}
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" size="sm" className="flex-1" asChild>
                          <Link href={getEditLink(item)}>
                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                            {isTimelineVideoItem(item) ? "Open Editor" : "Open"}
                          </Link>
                        </Button>
                        {item.type === "product" && (
                          <SellOnCFButton
                            productId={item.id}
                            productTitle={item.title}
                            isNativePublished={item.isNativePublished}
                            nativePrice={item.nativePrice}
                          />
                        )}
                        {item.type === "product" && (
                          <QuickSellSheet productId={item.id} productTitle={item.title} />
                        )}
                        {item.type === "video" && getVideoDownloadUrl(item) && (
                          <Button
                            variant="outline"
                            size="sm"
                            title="Publish to YouTube"
                            className="text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 border-red-200 dark:border-red-800"
                            onClick={() =>
                              setYtPublishItem({
                                videoId: item.id,
                                videoTitle: item.title,
                                videoUrl: getVideoDownloadUrl(item)!,
                                thumbnailUrl: item.thumbnail ?? undefined,
                              })
                            }
                          >
                            <Youtube className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* YouTube Publish Sheet */}
      <YouTubePublishSheet
        open={ytPublishItem !== null}
        onOpenChange={(open) => { if (!open) setYtPublishItem(null); }}
        videoId={ytPublishItem?.videoId}
        videoTitle={ytPublishItem?.videoTitle ?? ""}
        videoUrl={ytPublishItem?.videoUrl ?? ""}
        thumbnailUrl={ytPublishItem?.thumbnailUrl}
        niche={ytPublishItem?.niche}
      />
    </main>
  );
}
