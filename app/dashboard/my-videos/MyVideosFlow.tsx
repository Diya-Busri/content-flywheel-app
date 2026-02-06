"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Plus,
  Search,
  MoreVertical,
  Play,
  Star,
  Pin,
  Download,
  Link2,
  Pencil,
  Copy,
  Trash2,
  Video,
  ArchiveRestore,
} from "lucide-react";

type FilterTab = "all" | "favorites" | "recent" | "archived";
type SortOption = "newest" | "oldest" | "most-used" | "name-az";

interface VideoItem {
  id: string;
  title: string;
  thumbnail?: string;
  platforms: ("tiktok" | "instagram" | "youtube")[];
  createdAt: Date;
  isFavorite: boolean;
  isPinned: boolean;
  isArchived: boolean;
  useCount?: number;
}

const MOCK_VIDEOS: VideoItem[] = [
  { id: "1", title: "Digital Product Launch Teaser", platforms: ["tiktok", "instagram"], createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), isFavorite: true, isPinned: true, isArchived: false, useCount: 12 },
  { id: "2", title: "TikTok Shop Unboxing - Skincare Set", platforms: ["tiktok"], createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), isFavorite: false, isPinned: true, isArchived: false, useCount: 8 },
  { id: "3", title: "Before/After Template Video", platforms: ["instagram", "youtube"], createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), isFavorite: true, isPinned: false, isArchived: false, useCount: 5 },
  { id: "4", title: "Product Demo - Course Overview", platforms: ["youtube"], createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), isFavorite: false, isPinned: false, isArchived: false, useCount: 3 },
  { id: "5", title: "Script Checker Promo Clip", platforms: ["tiktok", "instagram", "youtube"], createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), isFavorite: false, isPinned: false, isArchived: false, useCount: 15 },
  { id: "6", title: "Affiliate Link Review Short", platforms: ["tiktok"], createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), isFavorite: false, isPinned: false, isArchived: true, useCount: 2 },
];

function formatCreatedDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const PLATFORM_LABELS: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube" };

export default function MyVideosFlow() {
  const [videos, setVideos] = useState<VideoItem[]>(MOCK_VIDEOS);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const updateVideo = (id: string, updates: Partial<VideoItem>) => {
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...updates } : v)));
  };

  const duplicateVideo = (v: VideoItem) => {
    setVideos((prev) => [
      ...prev,
      {
        ...v,
        id: `${v.id}-copy-${Date.now()}`,
        title: `${v.title} (copy)`,
        createdAt: new Date(),
        isPinned: false,
      },
    ]);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = (ids: string[]) => {
    setSelectedIds(new Set(ids));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const filteredAndSorted = useMemo(() => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let list = videos.filter((v) => {
      if (v.isArchived && filterTab !== "archived") return false;
      if (!v.isArchived && filterTab === "archived") return false;
      if (filterTab === "favorites" && !v.isFavorite) return false;
      if (filterTab === "recent" && v.createdAt < sevenDaysAgo) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!v.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "newest") return b.createdAt.getTime() - a.createdAt.getTime();
      if (sort === "oldest") return a.createdAt.getTime() - b.createdAt.getTime();
      if (sort === "most-used") return (b.useCount ?? 0) - (a.useCount ?? 0);
      return a.title.localeCompare(b.title);
    });
    return list;
  }, [videos, filterTab, search, sort]);

  const pinnedVideos = useMemo(() => videos.filter((v) => v.isPinned && !v.isArchived), [videos]);
  const showPinned = pinnedVideos.length > 0 && (filterTab === "all" || filterTab === "favorites");
  const gridVideos = showPinned ? filteredAndSorted.filter((v) => !v.isPinned) : filteredAndSorted;
  const pinnedInView = showPinned ? pinnedVideos : [];

  const handleBulkDownload = () => { /* mock */ clearSelection(); };
  const handleBulkDelete = () => {
    selectedIds.forEach((id) => updateVideo(id, { isArchived: true }));
    clearSelection();
  };
  const handleBulkFavorite = () => {
    selectedIds.forEach((id) => updateVideo(id, { isFavorite: true }));
    clearSelection();
  };

  const startEditTitle = (v: VideoItem) => {
    setEditingId(v.id);
    setEditingTitle(v.title);
  };
  const saveEditTitle = () => {
    if (editingId) updateVideo(editingId, { title: editingTitle });
    setEditingId(null);
  };

  const isEmpty = videos.length === 0;
  const hasVideos = !isEmpty;

  return (
    <main className="p-6 md:p-10 max-w-6xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-orange-500 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Videos</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">All your generated videos in one place</p>
          </div>
          <Button asChild className="bg-orange-500 hover:bg-orange-600 shrink-0 w-full sm:w-auto">
            <Link href="/dashboard/digital-products" className="gap-2">
              <Plus className="w-4 h-4" />
              Create Video
            </Link>
          </Button>
        </div>

        {hasVideos && (
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
            <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as FilterTab)} className="w-full sm:w-auto">
              <TabsList className="bg-slate-100 dark:bg-slate-800 w-full sm:w-auto flex flex-wrap">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="favorites">Favorites</TabsTrigger>
                <TabsTrigger value="recent">Recent</TabsTrigger>
                <TabsTrigger value="archived">Archived</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search videos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="most-used">Most Used</SelectItem>
                <SelectItem value="name-az">Name A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Empty state */}
      {isEmpty && (
        <Card className="border-slate-200 dark:border-slate-800 border-dashed">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Video className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-2 font-medium">
              No videos yet. Create your first video to get started!
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500 mb-6">
              Your generated videos will appear here
            </p>
            <Button asChild className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
              <Link href="/dashboard/digital-products">
                <Play className="w-4 h-4" />
                Create Video
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pinned section */}
      {hasVideos && showPinned && pinnedInView.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Pinned</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pinnedInView.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                selected={selectedIds.has(v.id)}
                onToggleSelect={() => toggleSelect(v.id)}
                onUpdate={updateVideo}
                onDuplicate={duplicateVideo}
                onStartEditTitle={startEditTitle}
                editingId={editingId}
                editingTitle={editingTitle}
                setEditingTitle={setEditingTitle}
                onSaveEditTitle={saveEditTitle}
                setEditingId={setEditingId}
                formatDate={formatCreatedDate}
              />
            ))}
          </div>
        </section>
      )}

      {/* Video grid */}
      {hasVideos && (pinnedInView.length > 0 || gridVideos.length > 0) && (
        <section>
          {showPinned && pinnedInView.length > 0 && (
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">All Videos</h2>
          )}
          {gridVideos.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 py-8 text-center">
              No videos match this filter.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {gridVideos.map((v) => (
                <VideoCard
                  key={v.id}
                  video={v}
                  selected={selectedIds.has(v.id)}
                  onToggleSelect={() => toggleSelect(v.id)}
                  onUpdate={updateVideo}
                  onDuplicate={duplicateVideo}
                  onStartEditTitle={startEditTitle}
                  editingId={editingId}
                  editingTitle={editingTitle}
                  setEditingTitle={setEditingTitle}
                  onSaveEditTitle={saveEditTitle}
                  setEditingId={setEditingId}
                  formatDate={formatCreatedDate}
                  showRestore={filterTab === "archived"}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur py-3 px-4 md:px-6 flex items-center justify-between gap-4 shadow-lg">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {selectedIds.size} selected
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleBulkFavorite}>
              Add to Favorites
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkDownload}>
              Download All
            </Button>
            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={handleBulkDelete}>
              Delete Selected
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

function VideoCard({
  video,
  selected,
  onToggleSelect,
  onUpdate,
  onDuplicate,
  onStartEditTitle,
  editingId,
  editingTitle,
  setEditingTitle,
  onSaveEditTitle,
  setEditingId,
  formatDate,
  showRestore = false,
}: {
  video: VideoItem;
  selected: boolean;
  onToggleSelect: () => void;
  onUpdate: (id: string, u: Partial<VideoItem>) => void;
  onDuplicate: (v: VideoItem) => void;
  onStartEditTitle: (v: VideoItem) => void;
  editingId: string | null;
  editingTitle: string;
  setEditingTitle: (s: string) => void;
  onSaveEditTitle: () => void;
  setEditingId: (id: string | null) => void;
  formatDate: (date: Date) => string;
  showRestore?: boolean;
}) {
  const isEditing = editingId === video.id;

  return (
    <Card className="group overflow-hidden border-slate-200 dark:border-slate-800 hover:shadow-lg transition-shadow">
      <CardContent className="p-0">
        {/* Thumbnail + overlay */}
        <div className="relative aspect-video bg-gradient-to-br from-orange-400/20 to-slate-600/30 dark:from-orange-600/20 dark:to-slate-800/50">
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
            <button type="button" className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center text-slate-900 hover:bg-white">
              <Play className="w-6 h-6 ml-0.5" fill="currentColor" />
            </button>
          </div>
          <div className="absolute top-2 left-2 z-10">
            <Checkbox checked={selected} onCheckedChange={() => onToggleSelect()} className="border-white bg-white/90" />
          </div>
          <button
            type="button"
            className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/90 hover:bg-white text-slate-700"
            onClick={() => onUpdate(video.id, { isFavorite: !video.isFavorite })}
          >
            <Star className={`w-4 h-4 ${video.isFavorite ? "fill-orange-500 text-orange-500" : ""}`} />
          </button>
        </div>

        <div className="p-3">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <Input
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={onSaveEditTitle}
                onKeyDown={(e) => e.key === "Enter" && onSaveEditTitle()}
                className="h-8 text-sm"
                autoFocus
              />
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5 min-h-[2rem] cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-slate-800/50 -mx-1 px-1"
              onClick={() => onStartEditTitle(video)}
            >
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate flex-1">{video.title}</p>
              <Pencil className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 shrink-0" />
            </div>
          )}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {video.platforms.map((p) => (
              <span
                key={p}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                {PLATFORM_LABELS[p]}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{formatDate(video.createdAt)}</p>
          <div className="flex items-center justify-between mt-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onUpdate(video.id, { isPinned: !video.isPinned })}>
                  <Pin className="w-4 h-4 mr-2" />
                  {video.isPinned ? "Unpin" : "Pin to top"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdate(video.id, { isFavorite: !video.isFavorite })}>
                  <Star className="w-4 h-4 mr-2" />
                  {video.isFavorite ? "Remove from favorites" : "Add to favorites"}
                </DropdownMenuItem>
                <DropdownMenuItem><Download className="w-4 h-4 mr-2" /> Download</DropdownMenuItem>
                <DropdownMenuItem><Link2 className="w-4 h-4 mr-2" /> Copy link</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStartEditTitle(video)}>
                  <Pencil className="w-4 h-4 mr-2" /> Edit details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(video)}>
                  <Copy className="w-4 h-4 mr-2" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {showRestore ? (
                  <DropdownMenuItem onClick={() => onUpdate(video.id, { isArchived: false })}>
                    <ArchiveRestore className="w-4 h-4 mr-2" /> Restore
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem className="text-red-600" onClick={() => onUpdate(video.id, { isArchived: true })}>
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
