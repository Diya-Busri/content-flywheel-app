"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
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
  Search,
  MoreVertical,
  Play,
  Loader2,
  Trash2,
  Download,
  Copy,
  Pencil,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type VideoStatus = "draft" | "ready" | "published";
type VideoType = "youtube-long" | "youtube-short" | "tiktok";

type ContentStudioVideo = {
  id: string;
  title: string;
  status: VideoStatus;
  videoType: VideoType | null;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "ready", label: "Ready" },
  { value: "published", label: "Published" },
];

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "youtube-long", label: "YouTube Long" },
  { value: "youtube-short", label: "YouTube Short" },
  { value: "tiktok", label: "TikTok" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusBadgeClass(status: string): string {
  const s = (status ?? "").toLowerCase();
  if (s === "published") return "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/40";
  if (s === "ready") return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/40";
  return "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/40";
}

function typeLabel(type: string | null): string {
  if (!type) return "—";
  const m: Record<string, string> = {
    "youtube-long": "YouTube Long",
    "youtube-short": "YouTube Short",
    tiktok: "TikTok",
  };
  return m[type] ?? type;
}

export default function ContentStudioLibraryClient() {
  const [videos, setVideos] = useState<ContentStudioVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      const res = await fetch(`/api/content-studio/videos?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load videos");
      const data = await res.json();
      setVideos(Array.isArray(data) ? data : []);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load videos",
        variant: "destructive",
      });
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter, toast]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/content-studio/videos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast({ title: "Video deleted" });
      setDeleteId(null);
      fetchVideos();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Could not delete",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = async (video: ContentStudioVideo) => {
    try {
      const res = await fetch("/api/content-studio/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${video.title} (copy)`,
          status: "draft",
          videoType: video.videoType,
        }),
      });
      if (!res.ok) throw new Error("Failed to duplicate");
      toast({ title: "Video duplicated" });
      fetchVideos();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Could not duplicate",
        variant: "destructive",
      });
    }
  };

  return (
    <main className="p-6 md:p-10 max-w-5xl mx-auto">
      <nav className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
        <Link href="/dashboard" className="hover:text-orange-500">
          Dashboard
        </Link>
        <ChevronRight className="w-4 h-4" />
        <Link href="/dashboard/content-studio" className="hover:text-orange-500">
          Content Studio
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-900 dark:text-white">My Videos</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Videos</h1>
        <Button asChild className="bg-orange-500 hover:bg-orange-600 shrink-0">
          <Link href="/dashboard/content-studio/create">
            ➕ Create New Video
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative w-48 sm:w-64 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Search videos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white dark:bg-[#1A1A1A] border-[#E5E7EB] dark:border-[#2A2A2A] text-gray-900 dark:text-white placeholder:text-gray-500"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] bg-white dark:bg-[#1A1A1A] border-[#E5E7EB] dark:border-[#2A2A2A]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px] bg-white dark:bg-[#1A1A1A] border-[#E5E7EB] dark:border-[#2A2A2A]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading videos...</p>
        </div>
      ) : videos.length === 0 ? (
        <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
          <CardContent className="py-12 text-center">
            <div className="text-5xl mb-4" aria-hidden>🎬</div>
            <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">No videos yet</p>
            <p className="text-sm text-gray-500 mb-4">
              Create your first video to get started
            </p>
            <Button asChild className="bg-orange-500 hover:bg-orange-600">
              <Link href="/dashboard/content-studio/create">Create Video</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <Card
              key={video.id}
              className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] overflow-hidden"
            >
              <Link href={`/dashboard/content-studio/edit/${video.id}`} className="block">
                <div className="relative aspect-video bg-gray-200 dark:bg-[#2A2A2A] flex items-center justify-center">
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-gray-500 dark:text-gray-600" aria-hidden>
                      <Play className="w-12 h-12" />
                    </div>
                  )}
                </div>
              </Link>
              <CardHeader className="pb-2 pt-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base truncate text-gray-900 dark:text-white min-w-0">
                    <Link href={`/dashboard/content-studio/edit/${video.id}`} className="hover:underline">
                      {video.title}
                    </Link>
                  </CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/content-studio/edit/${video.id}`}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit Timeline
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled>
                        <Download className="w-4 h-4 mr-2" />
                        Export MP4
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(video)}>
                        <Copy className="w-4 h-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                        onClick={() => setDeleteId(video.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <Badge variant="outline" className={`text-xs font-normal ${statusBadgeClass(video.status)}`}>
                    {video.status.charAt(0).toUpperCase() + video.status.slice(1)}
                  </Badge>
                  <Badge variant="secondary" className="text-xs font-normal bg-muted">
                    {typeLabel(video.videoType)}
                  </Badge>
                </div>
                <CardDescription className="text-xs mt-1">
                  {formatDate(video.createdAt)}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/dashboard/content-studio/edit/${video.id}`}>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                    Edit Timeline
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete video?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleteId) handleDelete(deleteId);
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
