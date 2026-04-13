"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2,
  Sparkles,
  Youtube,
  Calendar,
  Send,
  CheckCircle2,
  RefreshCw,
  X,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";

type ConnectedAccount = {
  id: string;
  platform: string;
  accountName?: string;
  username?: string;
};

export type YouTubePublishSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The title / topic for SEO generation */
  videoTitle: string;
  /** A short topic or niche hint (optional) */
  topic?: string;
  /** Niche hint for SEO (optional) */
  niche?: string;
  /** The publicly accessible video URL to upload */
  videoUrl: string;
  /** Existing thumbnail URL (optional — will be shown as preview) */
  thumbnailUrl?: string;
};

type SEOData = {
  title: string;
  description: string;
  keywords: string[];
  thumbnailPrompt: string;
};

export function YouTubePublishSheet({
  open,
  onOpenChange,
  videoTitle,
  topic,
  niche,
  videoUrl,
  thumbnailUrl,
}: YouTubePublishSheetProps) {
  const { toast } = useToast();

  // SEO state
  const [seoLoading, setSeoLoading] = useState(false);
  const [title, setTitle] = useState(videoTitle);
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordsInput, setKeywordsInput] = useState("");
  const [thumbnailPrompt, setThumbnailPrompt] = useState("");

  // Thumbnail generation state
  const [generatedThumbnail, setGeneratedThumbnail] = useState<string | null>(null);
  const [thumbnailGenerating, setThumbnailGenerating] = useState(false);
  const [activeThumbnail, setActiveThumbnail] = useState<string | null>(thumbnailUrl ?? null);

  // Account & schedule state
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [scheduleType, setScheduleType] = useState<"now" | "schedule">("schedule");
  const [scheduleDate, setScheduleDate] = useState<string>(() => {
    // Default: tomorrow at 9am
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });

  // Publish state
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{
    youtubeVideoId: string;
    watchUrl: string;
    studioUrl: string;
    scheduledAt: string;
    immediate: boolean;
  } | null>(null);

  // Reset when opened with new video
  useEffect(() => {
    if (open) {
      setTitle(videoTitle);
      setDescription("");
      setKeywords([]);
      setKeywordsInput("");
      setThumbnailPrompt("");
      setGeneratedThumbnail(null);
      setActiveThumbnail(thumbnailUrl ?? null);
      setResult(null);
      // Pass videoTitle explicitly so first-load SEO uses the prop title
      generateSEO(videoTitle);
      loadAccounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, videoTitle]);

  const generateSEO = useCallback(async (overrideTitle?: string) => {
    setSeoLoading(true);
    // Use the current edited title if available, falling back to the prop
    const effectiveTitle = overrideTitle ?? (title?.trim() || videoTitle);
    try {
      const res = await fetch("/api/youtube/generate-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: effectiveTitle,
          topic: topic ?? effectiveTitle,
          niche: niche ?? "",
        }),
      });
      if (!res.ok) throw new Error("SEO generation failed");
      const data = (await res.json()) as SEOData;
      setTitle(data.title || effectiveTitle);
      setDescription(data.description || "");
      setKeywords(data.keywords || []);
      setKeywordsInput((data.keywords || []).join(", "));
      setThumbnailPrompt(data.thumbnailPrompt || "");
    } catch (e) {
      toast({
        title: "Could not generate SEO",
        description: e instanceof Error ? e.message : "Please fill in the fields manually.",
        variant: "destructive",
      });
    } finally {
      setSeoLoading(false);
    }
  }, [title, videoTitle, topic, niche, toast]);

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const res = await fetch("/api/connected-accounts");
      const data = await res.json().catch(() => ({ connected: [] })) as { connected?: ConnectedAccount[] };
      const ytAccounts = (data.connected ?? []).filter((a) => a.platform === "youtube");
      setAccounts(ytAccounts);
      if (ytAccounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(ytAccounts[0].id);
      }
    } catch {
      /* ignore */
    } finally {
      setAccountsLoading(false);
    }
  }, [selectedAccountId]);

  const generateThumbnail = useCallback(async () => {
    if (!thumbnailPrompt.trim()) {
      toast({ title: "No thumbnail prompt", description: "Generate SEO first to get a thumbnail prompt.", variant: "destructive" });
      return;
    }
    setThumbnailGenerating(true);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `YouTube thumbnail: ${thumbnailPrompt}. Bold text area, high contrast, professional photography or illustration, 16:9 landscape format.`,
        }),
      });
      const data = await res.json().catch(() => ({})) as { url?: string; imageUrl?: string };
      const imgUrl = data.url ?? data.imageUrl ?? "";
      if (!imgUrl) throw new Error("No image returned");
      setGeneratedThumbnail(imgUrl);
      setActiveThumbnail(imgUrl);
    } catch (e) {
      toast({
        title: "Thumbnail generation failed",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setThumbnailGenerating(false);
    }
  }, [thumbnailPrompt, toast]);

  const handlePublish = useCallback(async () => {
    if (!videoUrl.trim()) {
      toast({ title: "No video URL", description: "This video does not have a shareable URL yet.", variant: "destructive" });
      return;
    }
    if (!selectedAccountId) {
      toast({ title: "Select a YouTube account", description: "Connect YouTube in Settings → Connected accounts first.", variant: "destructive" });
      return;
    }
    if (!title.trim()) {
      toast({ title: "Title required", description: "Please enter a YouTube title.", variant: "destructive" });
      return;
    }

    const scheduledAt = scheduleType === "now"
      ? new Date().toISOString()
      : new Date(scheduleDate).toISOString();

    if (scheduleType === "schedule" && new Date(scheduleDate).getTime() < Date.now()) {
      toast({ title: "Invalid schedule", description: "Scheduled time must be in the future.", variant: "destructive" });
      return;
    }

    // Parse keywords from input (user may have edited the comma list)
    const finalKeywords = keywordsInput
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 30)
      .join(",");

    setPublishing(true);
    try {
      const res = await fetch("/api/youtube/post-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeAccountId: selectedAccountId,
          videoUrl,
          title: title.trim().slice(0, 100),
          description: description.slice(0, 5000),
          keywords: finalKeywords,
          scheduledAt,
        }),
      });
      const data = await res.json().catch(() => ({})) as {
        youtubeVideoId?: string;
        watchUrl?: string;
        studioUrl?: string;
        scheduledAt?: string;
        immediate?: boolean;
        error?: string;
      };
      if (!res.ok || !data.youtubeVideoId) {
        throw new Error(data.error ?? "Upload failed");
      }
      setResult({
        youtubeVideoId: data.youtubeVideoId!,
        watchUrl: data.watchUrl!,
        studioUrl: data.studioUrl!,
        scheduledAt: data.scheduledAt!,
        immediate: data.immediate ?? false,
      });
      toast({
        title: data.immediate ? "Published to YouTube!" : "Scheduled on YouTube!",
        description: data.immediate
          ? "Your video is now live."
          : `Scheduled for ${new Date(data.scheduledAt!).toLocaleString()}`,
      });
    } catch (e) {
      toast({
        title: "Publish failed",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setPublishing(false);
    }
  }, [videoUrl, selectedAccountId, title, description, scheduleType, scheduleDate, keywordsInput, toast]);

  const removeKeyword = (kw: string) => {
    const updated = keywords.filter((k) => k !== kw);
    setKeywords(updated);
    setKeywordsInput(updated.join(", "));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
              <Youtube className="w-4 h-4 text-red-600" />
            </div>
            <SheetTitle>Publish to YouTube</SheetTitle>
          </div>
          <SheetDescription>
            Auto-generated SEO metadata ready to edit. Pick a schedule and publish.
          </SheetDescription>
        </SheetHeader>

        {result ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center justify-center gap-6 py-10 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {result.immediate ? "Published!" : "Scheduled!"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {result.immediate
                  ? "Your video is now live on YouTube."
                  : `Scheduled for ${new Date(result.scheduledAt).toLocaleString()}`}
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <Button asChild variant="default" className="w-full gap-2">
                <a href={result.studioUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                  Open in YouTube Studio
                </a>
              </Button>
              <Button asChild variant="outline" className="w-full gap-2">
                <a href={result.watchUrl} target="_blank" rel="noopener noreferrer">
                  <Youtube className="w-4 h-4 text-red-600" />
                  Watch on YouTube
                </a>
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* ── Thumbnail preview ── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Thumbnail</Label>
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border">
                {activeThumbnail ? (
                  <img src={activeThumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="w-10 h-10" />
                  </div>
                )}
                {thumbnailGenerating && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={thumbnailGenerating || seoLoading}
                  onClick={generateThumbnail}
                >
                  {thumbnailGenerating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                  )}
                  {generatedThumbnail ? "Regenerate" : "Generate Thumbnail"}
                </Button>
                {generatedThumbnail && activeThumbnail !== thumbnailUrl && thumbnailUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveThumbnail(thumbnailUrl)}
                  >
                    Use original
                  </Button>
                )}
              </div>
            </div>

            {/* ── SEO Header ── */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">YouTube SEO</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                disabled={seoLoading}
                onClick={generateSEO}
              >
                {seoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Regenerate SEO
              </Button>
            </div>

            {seoLoading ? (
              <div className="flex items-center gap-3 py-6 text-muted-foreground text-sm">
                <Loader2 className="w-5 h-5 animate-spin text-orange-500 shrink-0" />
                Generating YouTube SEO with AI…
              </div>
            ) : (
              <>
                {/* Title */}
                <div className="space-y-1.5">
                  <Label htmlFor="yt-title" className="text-sm">
                    Title <span className="text-muted-foreground text-xs">({title.length}/100)</span>
                  </Label>
                  <Input
                    id="yt-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={100}
                    placeholder="Enter YouTube title…"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label htmlFor="yt-desc" className="text-sm">
                    Description <span className="text-muted-foreground text-xs">({description.length}/5000)</span>
                  </Label>
                  <Textarea
                    id="yt-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={5000}
                    placeholder="YouTube description…"
                    rows={8}
                    className="text-sm resize-none"
                  />
                </div>

                {/* Keywords */}
                <div className="space-y-1.5">
                  <Label htmlFor="yt-keywords" className="text-sm">Keywords / Tags</Label>
                  {keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {keywords.map((kw) => (
                        <Badge key={kw} variant="secondary" className="text-xs gap-1 pr-1">
                          {kw}
                          <button
                            onClick={() => removeKeyword(kw)}
                            className="ml-0.5 hover:text-destructive transition-colors"
                            aria-label={`Remove ${kw}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <Input
                    id="yt-keywords"
                    value={keywordsInput}
                    onChange={(e) => {
                      setKeywordsInput(e.target.value);
                      setKeywords(
                        e.target.value
                          .split(",")
                          .map((k) => k.trim())
                          .filter(Boolean)
                      );
                    }}
                    placeholder="keyword1, keyword2, keyword3…"
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Comma-separated. Max 30 tags.</p>
                </div>
              </>
            )}

            {/* ── YouTube account ── */}
            <div className="space-y-1.5">
              <Label className="text-sm">YouTube Account</Label>
              {accountsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading accounts…
                </div>
              ) : accounts.length === 0 ? (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  No YouTube account connected.{" "}
                  <a href="/dashboard/settings/connected-accounts" className="text-primary underline underline-offset-2">
                    Connect one in Settings
                  </a>
                </div>
              ) : (
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select account…" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.accountName ?? acc.username ?? acc.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* ── Schedule ── */}
            <div className="space-y-1.5">
              <Label className="text-sm">When to publish</Label>
              <div className="flex gap-2">
                <Button
                  variant={scheduleType === "schedule" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => setScheduleType("schedule")}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Schedule
                </Button>
                <Button
                  variant={scheduleType === "now" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => setScheduleType("now")}
                >
                  <Send className="w-3.5 h-3.5" />
                  Publish Now
                </Button>
              </div>
              {scheduleType === "schedule" && (
                <Input
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                  className="mt-1"
                />
              )}
            </div>

            {/* ── Publish button ── */}
            <Button
              className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white"
              disabled={publishing || seoLoading || !selectedAccountId || !videoUrl}
              onClick={handlePublish}
            >
              {publishing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Youtube className="w-4 h-4" />
              )}
              {publishing
                ? "Uploading to YouTube…"
                : scheduleType === "now"
                  ? "Publish to YouTube Now"
                  : "Schedule on YouTube"}
            </Button>

            {!videoUrl && (
              <p className="text-xs text-destructive text-center">
                This video does not have a completed export URL yet. Export the video first.
              </p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
