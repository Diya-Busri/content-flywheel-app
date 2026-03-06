"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ImagePlus, Loader2, Download, Link2, ArrowLeft, BarChart3, Film } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type ThumbnailTemplate = "finance" | "gaming" | "vlog" | "education";

type ThumbnailConcept = {
  id: string;
  titleSuggestion: string;
  promptForImage: string;
  ctrPrediction: string;
  suggestedColors: string[];
  layout: string;
};

type LibraryVideo = { id: string; title: string };

const TEMPLATES: { value: ThumbnailTemplate; label: string }[] = [
  { value: "finance", label: "Finance" },
  { value: "gaming", label: "Gaming" },
  { value: "vlog", label: "Vlog" },
  { value: "education", label: "Education" },
];

const EXPORT_DIMENSIONS = [
  { key: "youtube", label: "YouTube (1280×720)", aspect: "16:9" },
  { key: "tiktok", label: "TikTok / Shorts (1080×1920)", aspect: "9:16" },
  { key: "instagram", label: "Instagram (1080×1080)", aspect: "1:1" },
];

export default function ThumbnailsClient() {
  const [topic, setTopic] = useState("");
  const [template, setTemplate] = useState<ThumbnailTemplate>("vlog");
  const [concepts, setConcepts] = useState<ThumbnailConcept[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [overlayTexts, setOverlayTexts] = useState<Record<string, string>>({});
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [pendingAttachUrl, setPendingAttachUrl] = useState<string | null>(null);
  const [attachingVideoId, setAttachingVideoId] = useState<string | null>(null);
  const [libraryVideos, setLibraryVideos] = useState<LibraryVideo[]>([]);
  const { toast } = useToast();
  const router = useRouter();

  const loadLibraryVideos = useCallback(async () => {
    try {
      const res = await fetch("/api/content-calendar/events");
      const data = await res.json();
      const list = (data.events ?? []).map((e: { id: string; title: string }) => ({ id: e.id, title: e.title }));
      setLibraryVideos(list);
    } catch {
      setLibraryVideos([]);
    }
  }, []);

  useEffect(() => {
    loadLibraryVideos();
  }, [loadLibraryVideos]);

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
        body: JSON.stringify({ topic: t, template }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Could not generate", description: data.error, variant: "destructive" });
        return;
      }
      setConcepts(data.concepts ?? []);
      (data.concepts ?? []).forEach((c: ThumbnailConcept) => {
        setOverlayTexts((prev) => ({ ...prev, [c.id]: c.titleSuggestion }));
      });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [topic, template, toast]);

  const handleGenerateImage = useCallback(
    async (concept: ThumbnailConcept, dimensions: string) => {
      setGeneratingId(concept.id);
      try {
        const res = await fetch("/api/content-studio/thumbnails/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: concept.promptForImage, dimensions }),
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
    [toast]
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
                disabled={loading}
                className="border-[#E5E7EB] dark:border-[#2A2A2A]"
              />
            </div>
            <div className="space-y-2">
              <Label>Template (niche)</Label>
              <Select value={template} onValueChange={(v) => setTemplate(v as ThumbnailTemplate)} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
            {concepts.map((concept) => {
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
                            <div className="absolute inset-0 flex items-center justify-center p-2">
                              <span className="text-white font-bold text-center text-sm drop-shadow-lg bg-black/40 px-2 py-1 rounded">
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
                  {v.title}
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
