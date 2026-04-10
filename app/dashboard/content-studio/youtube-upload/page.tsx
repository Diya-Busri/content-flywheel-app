"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Upload,
  Loader2,
  CheckCircle2,
  Youtube,
  ExternalLink,
  Film,
  Calendar,
  Tag,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

type ConnectedAccount = {
  id: string;
  platform: string;
  platformUsername: string | null;
  platformUserId: string | null;
};

type UploadResult = {
  youtubeVideoId: string;
  watchUrl: string;
  studioUrl: string;
  scheduledAt: string;
};

type LibraryVideo = {
  id: string;
  title: string;
  videoUrl: string;
};

export default function YouTubeUploadPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [youtubeAccounts, setYoutubeAccounts] = useState<ConnectedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [uploadMode, setUploadMode] = useState<"library" | "file">("library");
  const [libraryVideos, setLibraryVideos] = useState<LibraryVideo[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [selectedLibraryVideoUrl, setSelectedLibraryVideoUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  // Default schedule to 1 hour from now
  useEffect(() => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    // Format for datetime-local input: YYYY-MM-DDTHH:mm
    const local = now.toISOString().slice(0, 16);
    setScheduledAt(local);
  }, []);

  useEffect(() => {
    async function loadAccounts() {
      try {
        const res = await fetch("/api/connected-accounts");
        const data = await res.json();
        const yt = (data.connected ?? []).filter(
          (c: ConnectedAccount) => c.platform === "youtube"
        );
        setYoutubeAccounts(yt);
        if (yt.length === 1) setSelectedAccountId(yt[0].id);
      } catch {
        setYoutubeAccounts([]);
      } finally {
        setLoadingAccounts(false);
      }
    }
    async function loadLibrary() {
      setLoadingLibrary(true);
      try {
        const res = await fetch("/api/content-calendar/events");
        const data = await res.json();
        const events = (data.events ?? []) as { id: string; title: string; metadata?: Record<string, unknown> }[];
        const withVideo: LibraryVideo[] = events
          .filter((e) => {
            const m = e.metadata ?? {};
            return typeof m.videoUrl === "string" || typeof m.exportUrl === "string" || typeof m.compiledVideoUrl === "string";
          })
          .map((e) => {
            const m = e.metadata ?? {};
            const url = (m.videoUrl ?? m.exportUrl ?? m.compiledVideoUrl ?? m.outputUrl ?? m.downloadUrl) as string;
            return { id: e.id, title: e.title, videoUrl: url };
          });
        setLibraryVideos(withVideo);
      } catch {
        setLibraryVideos([]);
      } finally {
        setLoadingLibrary(false);
      }
    }
    loadAccounts();
    loadLibrary();
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast({ title: "Please select a video file (mp4, mov)", variant: "destructive" });
      return;
    }
    if (file.size > 256 * 1024 * 1024) {
      toast({ title: "File too large. Max 256MB", variant: "destructive" });
      return;
    }
    setVideoFile(file);
  }

  async function handleUpload() {
    if (!selectedAccountId) {
      toast({ title: "Select your YouTube account", variant: "destructive" });
      return;
    }
    if (uploadMode === "library" && !selectedLibraryVideoUrl) {
      toast({ title: "Select a video from your library", variant: "destructive" });
      return;
    }
    if (uploadMode === "file" && !videoFile) {
      toast({ title: "Select a video file", variant: "destructive" });
      return;
    }
    if (!title.trim()) {
      toast({ title: "Enter a title", variant: "destructive" });
      return;
    }
    if (!scheduledAt) {
      toast({ title: "Set a publish date", variant: "destructive" });
      return;
    }

    setUploading(true);
    setResult(null);
    try {
      let res: Response;

      if (uploadMode === "library" && selectedLibraryVideoUrl) {
        // Post from Supabase URL
        res = await fetch("/api/youtube/post-from-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            youtubeAccountId: selectedAccountId,
            videoUrl: selectedLibraryVideoUrl,
            title: title.trim(),
            description: description.trim(),
            keywords: keywords.trim(),
            scheduledAt: new Date(scheduledAt).toISOString(),
          }),
        });
      } else {
        // Upload file directly
        const form = new FormData();
        form.append("youtubeAccountId", selectedAccountId);
        form.append("videoFile", videoFile!);
        form.append("title", title.trim());
        form.append("description", description.trim());
        form.append("keywords", keywords.trim());
        form.append("scheduledAt", new Date(scheduledAt).toISOString());
        res = await fetch("/api/youtube/schedule-upload", { method: "POST", body: form });
      }

      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error ?? "Upload failed", variant: "destructive" });
        return;
      }

      setResult(data as UploadResult);
      toast({ title: "✅ Uploaded to YouTube!", description: "Video is scheduled and will go live at your chosen time." });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  function resetForm() {
    setVideoFile(null);
    setSelectedLibraryVideoUrl(null);
    setTitle("");
    setDescription("");
    setKeywords("");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const selectedAccount = youtubeAccounts.find((a) => a.id === selectedAccountId);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Youtube className="w-7 h-7 text-red-500" />
          Upload to YouTube
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Upload a video directly to your YouTube channel and schedule when it goes live.
        </p>
      </div>

      {/* Account selector */}
      <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
        <CardHeader>
          <CardTitle className="text-base">YouTube account</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAccounts ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading accounts…
            </div>
          ) : youtubeAccounts.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                No YouTube account connected.{" "}
                <Link href="/dashboard/settings" className="underline font-medium">
                  Connect one in Settings →
                </Link>
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {youtubeAccounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedAccountId(a.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                    selectedAccountId === a.id
                      ? "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400"
                      : "border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-red-400"
                  }`}
                >
                  <Youtube className="w-4 h-4" />
                  {a.platformUsername ?? a.platformUserId ?? "YouTube"}
                  {selectedAccountId === a.id && <CheckCircle2 className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload form */}
      {youtubeAccounts.length > 0 && !result && (
        <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Film className="w-4 h-4 text-orange-500" />
              Video details
            </CardTitle>
            <CardDescription>Upload a video and add YouTube metadata before publishing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Mode toggle */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Video source *</Label>
              <div className="flex rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setUploadMode("library")}
                  className={`flex-1 text-sm py-2 transition-colors ${uploadMode === "library" ? "bg-orange-500 text-white" : "hover:bg-muted text-muted-foreground"}`}
                >
                  📚 From Library
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode("file")}
                  className={`flex-1 text-sm py-2 transition-colors ${uploadMode === "file" ? "bg-orange-500 text-white" : "hover:bg-muted text-muted-foreground"}`}
                >
                  💻 Upload File
                </button>
              </div>
            </div>

            {/* Library video picker */}
            {uploadMode === "library" && (
              <div>
                {loadingLibrary ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading library…
                  </div>
                ) : libraryVideos.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>
                      No exported videos found. Go to{" "}
                      <Link href="/dashboard/video-timeline" className="underline font-medium">
                        Video Timeline
                      </Link>{" "}
                      and use &quot;Publish Now&quot; (server export) first.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {libraryVideos.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => { setSelectedLibraryVideoUrl(v.videoUrl); if (!title) setTitle(v.title); }}
                        className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                          selectedLibraryVideoUrl === v.videoUrl
                            ? "border-orange-500 bg-orange-500/10"
                            : "border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-orange-400"
                        }`}
                      >
                        <Film className="w-5 h-5 text-orange-500 shrink-0" />
                        <span className="text-sm font-medium truncate">{v.title}</span>
                        {selectedLibraryVideoUrl === v.videoUrl && <CheckCircle2 className="w-4 h-4 text-orange-500 ml-auto shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* File picker */}
            {uploadMode === "file" && (
              <div>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    videoFile
                      ? "border-green-500 bg-green-500/5"
                      : "border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-orange-400"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {videoFile ? (
                    <div className="space-y-1">
                      <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto" />
                      <p className="text-sm font-medium text-green-600 dark:text-green-400">{videoFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(videoFile.size / (1024 * 1024)).toFixed(1)} MB — click to change
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
                      <p className="text-sm font-medium">Click to select video</p>
                      <p className="text-xs text-muted-foreground">MP4 or MOV, max 256MB</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/mov,video/quicktime,video/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            )}

            {/* Title */}
            <div>
              <Label htmlFor="yt-title" className="text-sm font-medium mb-1.5 block">
                Title * <span className="text-muted-foreground font-normal">({title.length}/100)</span>
              </Label>
              <Input
                id="yt-title"
                placeholder="Your video title"
                value={title}
                maxLength={100}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="yt-desc" className="text-sm font-medium mb-1.5 block">Description</Label>
              <Textarea
                id="yt-desc"
                placeholder="Video description, links, timestamps…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[100px]"
                maxLength={5000}
              />
              <p className="text-xs text-muted-foreground mt-1">{description.length}/5000</p>
            </div>

            {/* Tags */}
            <div>
              <Label htmlFor="yt-tags" className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Tags (comma separated)
              </Label>
              <Input
                id="yt-tags"
                placeholder="content creation, social media, tips"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">Up to 30 tags. Helps YouTube recommend your video.</p>
            </div>

            {/* Schedule */}
            <div>
              <Label htmlFor="yt-schedule" className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Publish date & time *
              </Label>
              <Input
                id="yt-schedule"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Video will be uploaded as private and go public at this time. Must be in the future.
              </p>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <Button
                onClick={handleUpload}
                disabled={uploading || !selectedAccountId || (uploadMode === "library" ? !selectedLibraryVideoUrl : !videoFile) || !title || !scheduledAt}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                size="lg"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Uploading… this may take a minute
                  </>
                ) : (
                  <>
                    <Youtube className="w-4 h-4 mr-2" />
                    Upload & Schedule to YouTube
                  </>
                )}
              </Button>
              {uploading && (
                <p className="text-xs text-center text-muted-foreground mt-2">
                  Please keep this tab open while uploading
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success state */}
      {result && (
        <Card className="border-green-500/30 bg-green-500/5 dark:bg-green-500/10">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="font-semibold text-green-700 dark:text-green-400">Video uploaded successfully!</p>
                <p className="text-sm text-muted-foreground">
                  Scheduled for {new Date(result.scheduledAt).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" size="sm">
                <a href={result.studioUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Edit in YouTube Studio
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={result.watchUrl} target="_blank" rel="noopener noreferrer">
                  <Youtube className="w-3.5 h-3.5 mr-1.5" />
                  View on YouTube
                </a>
              </Button>
              <Button variant="ghost" size="sm" onClick={resetForm}>
                Upload another
              </Button>
            </div>

            <div className="text-xs text-muted-foreground bg-black/5 dark:bg-white/5 rounded p-2">
              <span className="font-medium">Video ID:</span> {result.youtubeVideoId}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
