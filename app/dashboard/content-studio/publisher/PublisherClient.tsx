"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Loader2,
  Settings,
  Film,
  Smartphone,
  Tv,
  Image as ImageIcon,
  Music,
  Type,
  LayoutGrid,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type Platform = "tiktok" | "youtube" | "instagram" | "facebook";

type VideoItem = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  status: string;
};

type ConnectedAccount = {
  platform: string;
  platformUsername: string | null;
  platformUserId: string | null;
};

const PLATFORMS: { id: Platform; label: string; aspect: "9:16" | "16:9"; icon: React.ReactNode }[] = [
  { id: "tiktok", label: "TikTok", aspect: "9:16", icon: <Smartphone className="w-4 h-4" /> },
  { id: "youtube", label: "YouTube", aspect: "16:9", icon: <Tv className="w-4 h-4" /> },
  { id: "instagram", label: "Instagram", aspect: "9:16", icon: <ImageIcon className="w-4 h-4" /> },
  { id: "facebook", label: "Facebook", aspect: "16:9", icon: <LayoutGrid className="w-4 h-4" /> },
];

export default function PublisherClient() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [connected, setConnected] = useState<ConnectedAccount[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Platform>>(new Set());
  const [bulkVideoIds, setBulkVideoIds] = useState<Set<string>>(new Set());
  const [publishing, setPublishing] = useState(false);
  const { toast } = useToast();

  // Platform-specific options (single video)
  const [tiktokVerticalCrop, setTiktokVerticalCrop] = useState(true);
  const [tiktokSound, setTiktokSound] = useState("");
  const [youtubeChapters, setYoutubeChapters] = useState("");
  const [youtubeEndScreen, setYoutubeEndScreen] = useState("");
  const [instagramCaption, setInstagramCaption] = useState("");
  const [instagramMusic, setInstagramMusic] = useState("");
  const [facebookCaption, setFacebookCaption] = useState("");

  const loadVideos = useCallback(async () => {
    setLoadingVideos(true);
    try {
      const res = await fetch("/api/content-calendar/events");
      const data = await res.json();
      const list = (data.events ?? []).map((e: VideoItem) => ({
        id: e.id,
        title: e.title,
        thumbnailUrl: e.thumbnailUrl ?? null,
        status: e.status ?? "draft",
      }));
      setVideos(list);
    } catch {
      setVideos([]);
    } finally {
      setLoadingVideos(false);
    }
  }, []);

  const loadConnectedAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const res = await fetch("/api/connected-accounts");
      const data = await res.json();
      setConnected((data.connected ?? []).map((c: ConnectedAccount) => ({ platform: c.platform, platformUsername: c.platformUsername, platformUserId: c.platformUserId })));
    } catch {
      setConnected([]);
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    loadVideos();
    loadConnectedAccounts();
  }, [loadVideos, loadConnectedAccounts]);

  const selectedVideo = videos.find((v) => v.id === selectedVideoId);
  const connectedSet = new Set(connected.map((c) => c.platform));

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const toggleBulkVideo = (id: string) => {
    setBulkVideoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 10) next.add(id);
      return next;
    });
  };

  const handlePublish = useCallback(
    async (videoIds: string[], platforms: Platform[]) => {
      if (videoIds.length === 0 || platforms.length === 0) {
        toast({ title: "Select at least one video and one platform", variant: "destructive" });
        return;
      }
      setPublishing(true);
      try {
        const res = await fetch("/api/content-studio/publisher/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoIds,
            platforms: [...platforms],
            options: {
              tiktok: { verticalCrop: tiktokVerticalCrop, trendingSound: tiktokSound || undefined },
              youtube: { chapters: youtubeChapters || undefined, endScreen: youtubeEndScreen || undefined },
              instagram: { caption: instagramCaption || undefined, music: instagramMusic || undefined },
              facebook: { caption: facebookCaption || undefined },
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast({ title: data.error ?? "Publish failed", variant: "destructive" });
          return;
        }
        toast({ title: data.message ?? "Publish queued", description: data.simulated ? "Connect accounts in Settings for real publishing." : undefined });
      } catch (e) {
        toast({ title: e instanceof Error ? e.message : "Request failed", variant: "destructive" });
      } finally {
        setPublishing(false);
      }
    },
    [tiktokVerticalCrop, tiktokSound, youtubeChapters, youtubeEndScreen, instagramCaption, instagramMusic, facebookCaption, toast]
  );

  const handleCrossPost = () => {
    if (!selectedVideoId) {
      toast({ title: "Select a video first", variant: "destructive" });
      return;
    }
    const platforms = [...selectedPlatforms];
    if (platforms.length === 0) {
      toast({ title: "Select at least one platform", variant: "destructive" });
      return;
    }
    handlePublish([selectedVideoId], platforms);
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Connected accounts */}
      <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-orange-500" />
            Connected accounts
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Connect TikTok, YouTube, Instagram, and Facebook in Settings to publish. OAuth required for each platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {loadingAccounts ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          ) : (
            <>
              {PLATFORMS.map((p) => (
                <Badge
                  key={p.id}
                  variant={connectedSet.has(p.id) ? "default" : "secondary"}
                  className={connectedSet.has(p.id) ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  {p.label}
                  {connectedSet.has(p.id) ? " ✓" : ""}
                </Badge>
              ))}
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/settings">
                  <Settings className="w-3.5 h-3.5 mr-1.5" />
                  Settings
                </Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="single" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="single">Single video</TabsTrigger>
          <TabsTrigger value="bulk">Bulk (up to 10)</TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="space-y-6">
          {/* Select video */}
          <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
            <CardHeader>
              <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
                <Film className="w-5 h-5 text-orange-500" />
                Select video
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Choose a video from your library (Video Timeline).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingVideos ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading videos…
                </div>
              ) : videos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No videos yet. Create and save a video in{" "}
                  <Link href="/dashboard/video-timeline" className="text-orange-500 hover:underline">
                    Video Timeline
                  </Link>
                  .
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {videos.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVideoId(v.id)}
                      className={`rounded-lg border p-3 text-left transition-all ${
                        selectedVideoId === v.id
                          ? "border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30"
                          : "border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-orange-500/50"
                      }`}
                    >
                      <div
                        className="aspect-video rounded bg-muted mb-2 overflow-hidden flex items-center justify-center"
                        style={{ aspectRatio: "16/9" }}
                      >
                        {v.thumbnailUrl ? (
                          <img src={v.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Film className="w-8 h-8 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-sm font-medium truncate">{v.title}</p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedVideo && (
            <>
              {/* Platforms + options */}
              <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-900 dark:text-white">Platforms & options</CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400">
                    Customize per platform. TikTok: vertical crop, sound. YouTube: chapters, end screen. Instagram: caption, music.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-wrap gap-4">
                    {PLATFORMS.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={selectedPlatforms.has(p.id)}
                          onCheckedChange={() => togglePlatform(p.id)}
                        />
                        <span className="flex items-center gap-1.5">{p.icon} {p.label}</span>
                      </label>
                    ))}
                  </div>

                  {selectedPlatforms.has("tiktok") && (
                    <div className="rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] p-4 space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-2"><Smartphone className="w-4 h-4" /> TikTok</h4>
                      <label className="flex items-center gap-2">
                        <Checkbox checked={tiktokVerticalCrop} onCheckedChange={(c) => setTiktokVerticalCrop(!!c)} />
                        <span className="text-sm">Vertical crop (9:16)</span>
                      </label>
                      <div>
                        <Label className="text-xs">Trending sound (optional)</Label>
                        <Input
                          placeholder="e.g. trending_audio_123"
                          value={tiktokSound}
                          onChange={(e) => setTiktokSound(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  )}
                  {selectedPlatforms.has("youtube") && (
                    <div className="rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] p-4 space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-2"><Tv className="w-4 h-4" /> YouTube</h4>
                      <p className="text-xs text-muted-foreground">Thumbnail from library is used. Add chapters and end screen below.</p>
                      <div>
                        <Label className="text-xs">Chapters (one per line: 0:00 Intro)</Label>
                        <Textarea
                          placeholder="0:00 Intro\n0:30 Main\n1:00 Outro"
                          value={youtubeChapters}
                          onChange={(e) => setYoutubeChapters(e.target.value)}
                          className="mt-1 min-h-[80px]"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">End screen (text)</Label>
                        <Input
                          placeholder="Subscribe, link in description"
                          value={youtubeEndScreen}
                          onChange={(e) => setYoutubeEndScreen(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  )}
                  {selectedPlatforms.has("instagram") && (
                    <div className="rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] p-4 space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Instagram</h4>
                      <div>
                        <Label className="text-xs">Caption</Label>
                        <Textarea
                          placeholder="Caption + hashtags"
                          value={instagramCaption}
                          onChange={(e) => setInstagramCaption(e.target.value)}
                          className="mt-1 min-h-[80px]"
                        />
                      </div>
                      <div>
                        <Label className="text-xs flex items-center gap-1"><Music className="w-3 h-3" /> Music / sticker (optional)</Label>
                        <Input
                          placeholder="Music track or sticker note"
                          value={instagramMusic}
                          onChange={(e) => setInstagramMusic(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  )}
                  {selectedPlatforms.has("facebook") && (
                    <div className="rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] p-4 space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-2"><LayoutGrid className="w-4 h-4" /> Facebook</h4>
                      <div>
                        <Label className="text-xs">Caption</Label>
                        <Textarea
                          placeholder="Post caption"
                          value={facebookCaption}
                          onChange={(e) => setFacebookCaption(e.target.value)}
                          className="mt-1 min-h-[60px]"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Preview */}
              <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-900 dark:text-white">Preview</CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400">
                    How your video will look on each platform.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4">
                    {PLATFORMS.filter((p) => selectedPlatforms.has(p.id)).map((p) => (
                      <div key={p.id} className="rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden bg-muted/30">
                        <p className="text-xs font-medium p-2 border-b border-[#E5E7EB] dark:border-[#2A2A2A] flex items-center gap-1">
                          {p.icon} {p.label}
                        </p>
                        <div
                          className="bg-black/20 flex items-center justify-center overflow-hidden"
                          style={{
                            width: p.aspect === "9:16" ? 120 : 200,
                            height: p.aspect === "9:16" ? 213 : 113,
                            aspectRatio: p.aspect === "9:16" ? "9/16" : "16/9",
                          }}
                        >
                          {selectedVideo?.thumbnailUrl ? (
                            <img
                              src={selectedVideo.thumbnailUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Film className="w-8 h-8 text-white/50" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleCrossPost}
                  disabled={publishing || selectedPlatforms.size === 0}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {publishing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Cross-post to {selectedPlatforms.size} platform{selectedPlatforms.size !== 1 ? "s" : ""}
                </Button>
                {selectedPlatforms.size > 1 && (
                  <p className="text-xs text-muted-foreground self-center">
                    Or publish to each platform separately from the calendar.
                  </p>
                )}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="bulk" className="space-y-6">
          <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
            <CardHeader>
              <CardTitle className="text-lg text-gray-900 dark:text-white">Bulk upload</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Select up to 10 videos and publish to chosen platforms at once.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingVideos ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              ) : videos.length === 0 ? (
                <p className="text-sm text-muted-foreground">No videos in library. Save videos from Video Timeline first.</p>
              ) : (
                <>
                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {videos.slice(0, 15).map((v) => (
                      <label
                        key={v.id}
                        className={`flex items-start gap-2 rounded-lg border p-2 cursor-pointer ${
                          bulkVideoIds.has(v.id) ? "border-orange-500 bg-orange-500/10" : "border-[#E5E7EB] dark:border-[#2A2A2A]"
                        } ${bulkVideoIds.size >= 10 && !bulkVideoIds.has(v.id) ? "opacity-60" : ""}`}
                      >
                        <Checkbox
                          checked={bulkVideoIds.has(v.id)}
                          onCheckedChange={() => toggleBulkVideo(v.id)}
                          disabled={bulkVideoIds.size >= 10 && !bulkVideoIds.has(v.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="aspect-video rounded bg-muted mb-1 overflow-hidden flex items-center justify-center">
                            {v.thumbnailUrl ? (
                              <img src={v.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Film className="w-6 h-6 text-muted-foreground" />
                            )}
                          </div>
                          <p className="text-xs font-medium truncate">{v.title}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Selected: {bulkVideoIds.size} / 10
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {PLATFORMS.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={selectedPlatforms.has(p.id)}
                          onCheckedChange={() => togglePlatform(p.id)}
                        />
                        <span>{p.label}</span>
                      </label>
                    ))}
                  </div>
                  <Button
                    onClick={() => handlePublish([...bulkVideoIds], [...selectedPlatforms])}
                    disabled={publishing || bulkVideoIds.size === 0 || selectedPlatforms.size === 0}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    {publishing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Publish {bulkVideoIds.size} video{bulkVideoIds.size !== 1 ? "s" : ""} to {selectedPlatforms.size} platform{selectedPlatforms.size !== 1 ? "s" : ""}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
