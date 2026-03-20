"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  RotateCcw,
  Trash,
  BookOpen,
  Calendar,
  ClipboardList,
  LayoutTemplate,
  Eye,
  Lock,
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

type LibraryTab = "products" | "scripts" | "all" | "bundles" | "timeline" | "template-packs" | "templates" | "history" | "youtube" | "trash";

type TemplatePackItem = {
  id: string;
  packName: string;
  templateType: string;
  niche?: string;
  status: string;
  slideCount: number;
  createdAt: string;
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

export default function LibraryFlow() {
  const [tab, setTab] = useState<LibraryTab>("all");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  /** Item ids whose thumbnail failed to load (404, CORS, etc.) — show placeholder instead. */
  const [thumbnailErrors, setThumbnailErrors] = useState<Set<string>>(new Set());
  /** Timeline video preview modal: open in timeline to preview (no stored video URL). */
  const [previewVideo, setPreviewVideo] = useState<{ id: string; title: string; openHref: string } | null>(null);
  const [templatePacks, setTemplatePacks] = useState<TemplatePackItem[]>([]);
  const [packsLoading, setPacksLoading] = useState(false);
  const { toast } = useToast();

  const showThumbnail = (item: LibraryItem) =>
    Boolean(item.thumbnail && !thumbnailErrors.has(item.id));

  const markThumbnailError = (itemId: string) => {
    setThumbnailErrors((prev) => new Set(prev).add(itemId));
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const isTrash = tab === "trash";
      const typeParam = isTrash ? "all" : tab === "bundles" ? "bundles" : tab === "timeline" ? "timeline" : tab === "all" ? "all" : tab;
      const url = isTrash
        ? `/api/library?type=all&deleted=true`
        : `/api/library?type=${typeParam}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error("Failed to load library");
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load library";
      if ((err as { name?: string })?.name === "AbortError") {
        toast({ title: "Timeout", description: "Library took too long to load. Try again.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: message, variant: "destructive" });
      }
      setItems([]);
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

  useEffect(() => {
    if (tab === "templates" || tab === "history" || tab === "youtube") return;
    if (tab === "template-packs") fetchTemplatePacks();
    else fetchItems();
  }, [tab]);

  const filtered = items.filter((item) =>
    search.trim() ? item.title.toLowerCase().includes(search.toLowerCase()) : true
  );

  const getEditLink = (item: LibraryItem) => {
    if (item.type === "product") return `/dashboard/digital-products/${item.id}/edit`;
    if (item.type === "video" && Array.isArray(item.platforms) && item.platforms.includes("video-timeline")) {
      return `/dashboard/video-timeline?projectId=${encodeURIComponent(item.id)}`;
    }
    if (item.type === "video") return `/dashboard/library`;
    if (item.type === "script" && (item.platform === "video-guide" || item.platform === "content-studio")) return `/dashboard/digital-products/video-guide?libraryScriptId=${encodeURIComponent(item.id)}${item.platform === "content-studio" ? "&source=content-studio" : ""}`;
    if (item.type === "script") return `/dashboard/script-checker`;
    return "#";
  };

  const isTrashView = tab === "trash";
  const isTimelineView = tab === "timeline";

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

      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">My Library</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Your digital products, video guides, and scripts in one place
      </p>

      <Tabs value={tab} onValueChange={(v) => setTab(v as LibraryTab)}>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <TabsList className="bg-gray-200 dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A]">
            <TabsTrigger value="all" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-600 dark:text-gray-400">All items</TabsTrigger>
            <TabsTrigger value="products" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-600 dark:text-gray-400">Digital Products</TabsTrigger>
            <TabsTrigger value="bundles" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-600 dark:text-gray-400">Bundles</TabsTrigger>
            <TabsTrigger value="scripts" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-600 dark:text-gray-400">Scripts</TabsTrigger>
            <TabsTrigger value="timeline" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-600 dark:text-gray-400">My Videos</TabsTrigger>
            <TabsTrigger value="youtube" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
              <span>YouTube</span>
              <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden />
            </TabsTrigger>
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
            <div className="relative w-48 sm:w-64 shrink-0">
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
          {tab === "templates" ? (
            <TemplatesClient />
          ) : tab === "history" ? (
            <HistoryClient />
          ) : tab === "youtube" ? (
            <FeaturePreviewGate title="YouTube">
              <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
                <CardContent className="py-12 text-center">
                  <Video className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">YouTube</h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
                    Your YouTube scripts and video guides from Content Studio will appear here. This section is in development.
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/dashboard/content-studio">Content Studio</Link>
                  </Button>
                </CardContent>
              </Card>
            </FeaturePreviewGate>
          ) : (tab === "template-packs" ? packsLoading : loading) ? (
            <div className="py-16 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Loading library...</p>
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
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((project) => {
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
                              <CardTitle className="text-base truncate text-gray-900 dark:text-white">{item.title}</CardTitle>
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {item.type === "product" && item.format && (
                                  <Badge variant="secondary" className="text-xs font-normal bg-orange-500/10 text-orange-600 dark:text-orange-400 border-0">
                                    {formatLabel(item.format)}
                                  </Badge>
                                )}
                                {item.type === "product" && (item.designSource === "ai" || item.designSource === "brand") && (
                                  <Badge variant="secondary" className="text-xs font-normal bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
                                    AI Designed
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
                                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(item.title)}>
                                  <Copy className="w-4 h-4 mr-2" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600 dark:text-red-400" onClick={() => handleDelete(item, false)}>
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Move to Trash
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <CardDescription className="text-xs">
                            {formatDate(item.createdAt)} • {statusLabel(item.status)}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0 flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1" asChild>
                            <Link href={getEditLink(item)}>
                              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                              Open
                            </Link>
                          </Button>
                          {item.type === "product" && (
                            <Button variant="outline" size="sm" asChild title="Create Videos">
                              <Link href={`/dashboard/digital-products/scripts?productId=${encodeURIComponent(item.id)}`}>
                                <Video className="w-3.5 h-3.5" />
                              </Link>
                            </Button>
                          )}
                          <Button variant="outline" size="sm">
                            <Download className="w-3.5 h-3.5" />
                          </Button>
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
                        <CardTitle className="text-base truncate text-gray-900 dark:text-white">{item.title}</CardTitle>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {item.type === "product" && item.format && (
                            <Badge variant="secondary" className="text-xs font-normal bg-orange-500/10 text-orange-600 dark:text-orange-400 border-0">
                              {formatLabel(item.format)}
                            </Badge>
                          )}
                          {item.type === "product" && (item.designSource === "ai" || item.designSource === "brand") && (
                            <Badge variant="secondary" className="text-xs font-normal bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
                              AI Designed
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
                      {formatDate(item.createdAt)} • {statusLabel(item.status)}
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
                    ) : (
                      <>
                        <Button variant="outline" size="sm" className="flex-1" asChild>
                          <Link href={getEditLink(item)}>
                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                            Open
                          </Link>
                        </Button>
                        {item.type === "product" && (
                          <Button variant="outline" size="sm" asChild title="Create Videos">
                            <Link href={`/dashboard/digital-products/scripts?productId=${encodeURIComponent(item.id)}`}>
                              <Video className="w-3.5 h-3.5" />
                            </Link>
                          </Button>
                        )}
                        <Button variant="outline" size="sm">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}
