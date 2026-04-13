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
  platformUsername?: string | null;
  platformUserId?: string | null;
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
  /** Library video ID — used to persist SEO data so it doesn't disappear on reopen */
  videoId?: string;
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
  videoId,
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
  const [textOverlayLoading, setTextOverlayLoading] = useState(false);
  const [activeThumbnail, setActiveThumbnail] = useState<string | null>(thumbnailUrl ?? null);

  // Account & schedule state
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
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
  const [publishProgress, setPublishProgress] = useState<{ accountId: string; label: string; status: "pending" | "uploading" | "done" | "error"; error?: string; watchUrl?: string; studioUrl?: string }[]>([]);
  const [results, setResults] = useState<{
    youtubeVideoId: string;
    watchUrl: string;
    studioUrl: string;
    scheduledAt: string;
    immediate: boolean;
    channelLabel: string;
  }[]>([]);

  /** Persist SEO + thumbnail back to the library video so it survives page reloads */
  const saveVideoSEO = useCallback(async (patch: {
    title?: string;
    thumbnailUrl?: string;
    youtubeDescription?: string;
    youtubeKeywords?: string[];
    youtubeThumbnailPrompt?: string;
  }) => {
    if (!videoId) return;
    try {
      await fetch(`/api/library/videos/${videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(patch.title ? { title: patch.title } : {}),
          ...(patch.thumbnailUrl ? { thumbnailUrl: patch.thumbnailUrl } : {}),
          metadata: {
            youtubeTitle: patch.title,
            youtubeDescription: patch.youtubeDescription,
            youtubeKeywords: patch.youtubeKeywords,
            youtubeThumbnailPrompt: patch.youtubeThumbnailPrompt,
            youtubeThumbnailUrl: patch.thumbnailUrl,
          },
        }),
      });
    } catch {
      /* non-fatal */
    }
  }, [videoId]);

  // Reset when opened with new video
  useEffect(() => {
    if (!open) return;

    setResults([]);
    setPublishProgress([]);
    loadAccounts();

    // If we have a videoId, try to load saved SEO from the library first
    if (videoId) {
      (async () => {
        try {
          const res = await fetch(`/api/library/videos/${videoId}`);
          const data = await res.json().catch(() => ({})) as {
            title?: string;
            thumbnailUrl?: string;
            metadata?: {
              youtubeTitle?: string;
              youtubeDescription?: string;
              youtubeKeywords?: string[];
              youtubeThumbnailPrompt?: string;
              youtubeThumbnailUrl?: string;
            };
          };
          const meta = data.metadata ?? {};
          if (meta.youtubeTitle || meta.youtubeDescription) {
            // Saved SEO exists — restore it, skip regeneration
            setTitle(meta.youtubeTitle || videoTitle);
            setDescription(meta.youtubeDescription || "");
            const kws = meta.youtubeKeywords ?? [];
            setKeywords(kws);
            setKeywordsInput(kws.join(", "));
            setThumbnailPrompt(meta.youtubeThumbnailPrompt || "");
            const savedThumb = meta.youtubeThumbnailUrl || data.thumbnailUrl || thumbnailUrl || null;
            setGeneratedThumbnail(savedThumb);
            setActiveThumbnail(savedThumb);
            return;
          }
        } catch {
          /* fall through to generate */
        }
        // No saved SEO — generate fresh
        setTitle(videoTitle);
        setDescription("");
        setKeywords([]);
        setKeywordsInput("");
        setThumbnailPrompt("");
        setGeneratedThumbnail(null);
        setActiveThumbnail(thumbnailUrl ?? null);
        generateSEO(videoTitle);
      })();
    } else {
      setTitle(videoTitle);
      setDescription("");
      setKeywords([]);
      setKeywordsInput("");
      setThumbnailPrompt("");
      setGeneratedThumbnail(null);
      setActiveThumbnail(thumbnailUrl ?? null);
      generateSEO(videoTitle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, videoTitle, videoId]);

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
      // Auto-save so it survives reopen
      void saveVideoSEO({
        title: data.title || effectiveTitle,
        youtubeDescription: data.description || "",
        youtubeKeywords: data.keywords || [],
        youtubeThumbnailPrompt: data.thumbnailPrompt || "",
      });
    } catch (e) {
      toast({
        title: "Could not generate SEO",
        description: e instanceof Error ? e.message : "Please fill in the fields manually.",
        variant: "destructive",
      });
    } finally {
      setSeoLoading(false);
    }
  }, [title, videoTitle, topic, niche, toast, saveVideoSEO]);

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const res = await fetch("/api/connected-accounts");
      const data = await res.json().catch(() => ({ connected: [] })) as { connected?: ConnectedAccount[] };
      const ytAccounts = (data.connected ?? []).filter((a) => a.platform === "youtube");
      setAccounts(ytAccounts);
      // Auto-select all connected accounts
      if (ytAccounts.length > 0) {
        setSelectedAccountIds(new Set(ytAccounts.map((a) => a.id)));
      }
    } catch {
      /* ignore */
    } finally {
      setAccountsLoading(false);
    }
  }, []);

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

      // Apply title text overlay via browser Canvas
      let finalUrl = imgUrl;
      try {
        // Add text overlay via server-side compositing (no canvas/CORS)
        const overlayRes = await fetch("/api/thumbnail-with-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: imgUrl, title: title || videoTitle }),
        });
        const overlayData = await overlayRes.json().catch(() => ({})) as { url?: string };
        if (overlayData.url) finalUrl = overlayData.url;
      } catch {
        // Fall back to raw image if overlay fails
      }

      setGeneratedThumbnail(finalUrl);
      setActiveThumbnail(finalUrl);
      // Auto-save thumbnail so it survives reopen
      void saveVideoSEO({ thumbnailUrl: finalUrl });
    } catch (e) {
      toast({
        title: "Thumbnail generation failed",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setThumbnailGenerating(false);
    }
  }, [thumbnailPrompt, toast, saveVideoSEO]);

  const getChannelLabel = useCallback((acc: ConnectedAccount, idx: number) => {
    const u = acc.platformUsername;
    if (!u) return `YouTube Channel ${idx + 1}`;
    return u.startsWith("@") ? u : `@${u}`;
  }, []);

  const handlePublish = useCallback(async () => {
    if (!videoUrl.trim()) {
      toast({ title: "No video URL", description: "This video does not have a shareable URL yet.", variant: "destructive" });
      return;
    }
    if (selectedAccountIds.size === 0) {
      toast({ title: "Select at least one channel", description: "Tick the channels you want to post to.", variant: "destructive" });
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

    const finalKeywords = keywordsInput
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 30)
      .join(",");

    const selectedAccounts = accounts.filter((a) => selectedAccountIds.has(a.id));

    // Initialise per-channel progress
    const progress = selectedAccounts.map((acc, idx) => ({
      accountId: acc.id,
      label: getChannelLabel(acc, idx),
      status: "pending" as const,
    }));
    setPublishProgress(progress);
    setPublishing(true);

    const completedResults: typeof results = [];

    for (let i = 0; i < selectedAccounts.length; i++) {
      const acc = selectedAccounts[i];
      const label = getChannelLabel(acc, i);

      // Mark as uploading
      setPublishProgress((prev) =>
        prev.map((p) => p.accountId === acc.id ? { ...p, status: "uploading" } : p)
      );

      try {
        const res = await fetch("/api/youtube/post-from-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            youtubeAccountId: acc.id,
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
        if (!res.ok || !data.youtubeVideoId) throw new Error(data.error ?? "Upload failed");

        setPublishProgress((prev) =>
          prev.map((p) => p.accountId === acc.id ? { ...p, status: "done", watchUrl: data.watchUrl, studioUrl: data.studioUrl } : p)
        );
        completedResults.push({
          youtubeVideoId: data.youtubeVideoId!,
          watchUrl: data.watchUrl!,
          studioUrl: data.studioUrl!,
          scheduledAt: data.scheduledAt!,
          immediate: data.immediate ?? false,
          channelLabel: label,
        });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Failed";
        setPublishProgress((prev) =>
          prev.map((p) => p.accountId === acc.id ? { ...p, status: "error", error: errMsg } : p)
        );
      }
    }

    setResults(completedResults);
    setPublishing(false);

    const successCount = completedResults.length;
    const totalCount = selectedAccounts.length;
    toast({
      title: successCount === totalCount
        ? (scheduleType === "now" ? `Published to ${successCount} channel${successCount > 1 ? "s" : ""}!` : `Scheduled on ${successCount} channel${successCount > 1 ? "s" : ""}!`)
        : `${successCount}/${totalCount} channels succeeded`,
      description: scheduleType === "schedule" && successCount > 0
        ? `Scheduled for ${new Date(scheduledAt).toLocaleString()}`
        : undefined,
    });
  }, [videoUrl, selectedAccountIds, accounts, title, description, scheduleType, scheduleDate, keywordsInput, getChannelLabel, toast]);

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

        {results.length > 0 && !publishing ? (
          /* ── Success state ── */
          <div className="flex flex-col gap-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {scheduleType === "now" ? "Published!" : "Scheduled!"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {results.length} channel{results.length > 1 ? "s" : ""} {scheduleType === "now" ? "published" : `scheduled for ${new Date(results[0].scheduledAt).toLocaleString()}`}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {publishProgress.map((p) => (
                <div key={p.accountId} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <Youtube className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    {p.label}
                  </span>
                  {p.status === "done" && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      {p.studioUrl && (
                        <a href={p.studioUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline underline-offset-2">
                          Studio
                        </a>
                      )}
                    </div>
                  )}
                  {p.status === "error" && (
                    <span className="text-xs text-destructive">{p.error}</span>
                  )}
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* ── Thumbnail preview ── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Thumbnail</Label>
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border">
                {activeThumbnail ? (
                  <img key={activeThumbnail} src={activeThumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
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
              <div className="flex flex-wrap gap-2">
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
                {activeThumbnail && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    disabled={textOverlayLoading || thumbnailGenerating}
                    onClick={async () => {
                      setTextOverlayLoading(true);
                      try {
                        // Server-side compositing — no canvas/CORS issues
                        const res = await fetch("/api/thumbnail-with-text", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            imageUrl: activeThumbnail,
                            title: title || videoTitle,
                          }),
                        });
                        const data = await res.json().catch(() => ({})) as { url?: string; error?: string };
                        if (!res.ok || !data.url) {
                          throw new Error(data.error ?? "Server failed to add text");
                        }
                        setGeneratedThumbnail(data.url);
                        setActiveThumbnail(data.url);
                        void saveVideoSEO({ thumbnailUrl: data.url });
                        toast({ title: "✅ Title text added!", description: "Thumbnail updated with bold title overlay." });
                      } catch (err) {
                        console.error("[add-title-text]", err);
                        toast({
                          title: "Could not add text",
                          description: err instanceof Error ? err.message : "Try regenerating the thumbnail first.",
                          variant: "destructive",
                        });
                      } finally {
                        setTextOverlayLoading(false);
                      }
                    }}
                  >
                    {textOverlayLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                    )}
                    {textOverlayLoading ? "Adding text…" : "Add title text"}
                  </Button>
                )}
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
                onClick={() => generateSEO()}
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

            {/* ── YouTube channels (multi-select checkboxes) ── */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Post to channels</Label>
                {accounts.length > 1 && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                    onClick={() =>
                      setSelectedAccountIds(
                        selectedAccountIds.size === accounts.length
                          ? new Set()
                          : new Set(accounts.map((a) => a.id))
                      )
                    }
                  >
                    {selectedAccountIds.size === accounts.length ? "Deselect all" : "Select all"}
                  </button>
                )}
              </div>
              {accountsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading channels…
                </div>
              ) : accounts.length === 0 ? (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  No YouTube account connected.{" "}
                  <a href="/dashboard/settings/connected-accounts" className="text-primary underline underline-offset-2">
                    Connect one in Settings
                  </a>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {accounts.map((acc, idx) => {
                    const label = getChannelLabel(acc, idx);
                    const checked = selectedAccountIds.has(acc.id);
                    return (
                      <label
                        key={acc.id}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${checked ? "border-red-500/40 bg-red-500/5" : "border-border hover:bg-muted/50"}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = new Set(selectedAccountIds);
                            if (e.target.checked) next.add(acc.id);
                            else next.delete(acc.id);
                            setSelectedAccountIds(next);
                          }}
                          className="accent-red-600 w-4 h-4"
                        />
                        <Youtube className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        <span className="text-sm font-medium">{label}</span>
                      </label>
                    );
                  })}
                </div>
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

            {/* ── Publishing progress (shown while uploading) ── */}
            {publishing && publishProgress.length > 0 && (
              <div className="space-y-1.5 rounded-lg border p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Uploading to channels…</p>
                {publishProgress.map((p) => (
                  <div key={p.accountId} className="flex items-center gap-2 text-sm">
                    {p.status === "pending" && <div className="w-4 h-4 rounded-full border-2 border-muted shrink-0" />}
                    {p.status === "uploading" && <Loader2 className="w-4 h-4 animate-spin text-orange-500 shrink-0" />}
                    {p.status === "done" && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                    {p.status === "error" && <X className="w-4 h-4 text-destructive shrink-0" />}
                    <span className={p.status === "error" ? "text-destructive" : ""}>{p.label}</span>
                    {p.status === "error" && <span className="text-xs text-muted-foreground ml-auto">{p.error}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* ── Publish button ── */}
            <Button
              className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white"
              disabled={publishing || seoLoading || selectedAccountIds.size === 0 || !videoUrl}
              onClick={handlePublish}
            >
              {publishing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Youtube className="w-4 h-4" />
              )}
              {publishing
                ? `Uploading… (${publishProgress.filter(p => p.status === "done").length}/${publishProgress.length})`
                : scheduleType === "now"
                  ? `Publish to ${selectedAccountIds.size} Channel${selectedAccountIds.size !== 1 ? "s" : ""} Now`
                  : `Schedule on ${selectedAccountIds.size} Channel${selectedAccountIds.size !== 1 ? "s" : ""}`}
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
