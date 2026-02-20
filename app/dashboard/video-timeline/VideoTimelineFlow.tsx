"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Film, Music, Play, Square, Trash2, FileVideo, Loader2, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { getDefaultVoiceId } from "@/lib/elevenlabs-voices";
import { cn } from "@/lib/utils";

type VideoGuideListItem = { id: string; type: "script"; title: string; platform?: string; createdAt: string };

export type TimelineClip = {
  id: string;
  type: "video" | "audio";
  file: File;
  url: string;
  name: string;
};

export type CaptionItem = {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
};

export type DesignOptions = {
  font: string;
  fontSize: string;
  textColor: string;
  backgroundColor: string;
};

export type TransitionType = "cut" | "fade-in" | "fade-out";

const VIDEO_ACCEPT = "video/*";
const AUDIO_ACCEPT = "audio/*";

const FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Arial", label: "Arial" },
  { value: "Helvetica", label: "Helvetica" },
  { value: "Georgia", label: "Georgia" },
  { value: "system-ui", label: "System" },
];

const FONT_SIZE_OPTIONS = [
  { value: "14", label: "Small (14px)" },
  { value: "18", label: "Medium (18px)" },
  { value: "24", label: "Large (24px)" },
  { value: "32", label: "X-Large (32px)" },
];

const DEFAULT_DESIGN: DesignOptions = {
  font: "Inter",
  fontSize: "18",
  textColor: "#FFFFFF",
  backgroundColor: "#000000",
};

const TRANSITION_OPTIONS: { value: TransitionType; label: string }[] = [
  { value: "cut", label: "Cut" },
  { value: "fade-in", label: "Fade in" },
  { value: "fade-out", label: "Fade out" },
];

function SortableClip({
  clip,
  onRemove,
}: {
  clip: TimelineClip;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clip.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card p-3 text-card-foreground shadow-sm",
        isDragging && "opacity-60 shadow-md z-10"
      )}
    >
      <button
        type="button"
        className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 -ml-1"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      {clip.type === "video" ? (
        <Film className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
      ) : (
        <Music className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
      )}
      <span className="flex-1 truncate text-sm font-medium" title={clip.name}>
        {clip.name}
      </span>
      <span className="text-xs text-muted-foreground flex-shrink-0">
        {clip.type}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(clip.id)}
        aria-label="Remove clip"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

export default function VideoTimelineFlow() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const clipsRef = useRef<TimelineClip[]>([]);
  clipsRef.current = clips;

  const [importPopupOpen, setImportPopupOpen] = useState(false);
  const [videoGuides, setVideoGuides] = useState<VideoGuideListItem[]>([]);
  const [guidesLoading, setGuidesLoading] = useState(false);
  const [importingGuideId, setImportingGuideId] = useState<string | null>(null);

  const [captions, setCaptions] = useState<CaptionItem[]>([]);
  const [design, setDesign] = useState<DesignOptions>(DEFAULT_DESIGN);
  /** Transition from clip[i] to clip[i+1]; length = max(0, clips.length - 1) */
  const [transitionsBetween, setTransitionsBetween] = useState<TransitionType[]>([]);

  const addCaption = useCallback(() => {
    const lastEnd = captions.length > 0 ? Math.max(...captions.map((c) => c.endTime)) : 0;
    setCaptions((prev) => [
      ...prev,
      { id: `cap-${Date.now()}`, text: "", startTime: lastEnd, endTime: lastEnd + 3 },
    ]);
  }, [captions.length]);

  const updateCaption = useCallback((id: string, patch: Partial<CaptionItem>) => {
    setCaptions((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const removeCaption = useCallback((id: string) => {
    setCaptions((prev) => prev.filter((c) => c.id !== id));
  }, []);

  useEffect(() => {
    if (searchParams.get("importVoiceover") === "1") {
      setImportPopupOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("importVoiceover");
      window.history.replaceState({}, "", url.pathname + (url.search || ""));
    }
  }, [searchParams]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setClips((prev) => {
      const oldIndex = prev.findIndex((c) => c.id === active.id);
      const newIndex = prev.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
    setTransitionsBetween((prev) => {
      if (prev.length <= 1) return prev;
      const oldIndex = clips.findIndex((c) => c.id === active.id);
      const newIndex = clips.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1 || oldIndex >= prev.length || newIndex >= prev.length) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, [clips]);

  const addFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const newClips: TimelineClip[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const type = file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("audio/")
          ? "audio"
          : null;
      if (!type) continue;
      const url = URL.createObjectURL(file);
      newClips.push({
        id: `${Date.now()}-${i}-${file.name}`,
        type,
        file,
        url,
        name: file.name,
      });
    }
    setClips((prev) => [...prev, ...newClips]);
  }, []);

  const addClipFromFile = useCallback((file: File) => {
    const type = file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : null;
    if (!type) return;
    const url = URL.createObjectURL(file);
    setClips((prev) => [
      ...prev,
      { id: `${Date.now()}-${file.name}`, type, file, url, name: file.name },
    ]);
  }, []);

  const removeClip = useCallback((id: string) => {
    setClips((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1) return prev;
      const clip = prev[idx];
      if (clip) URL.revokeObjectURL(clip.url);
      const next = prev.filter((c) => c.id !== id);
      setTransitionsBetween((t) => {
        if (t.length === 0) return t;
        if (idx >= t.length) return t.slice(0, -1);
        return t.slice(0, idx).concat(t.slice(idx + 1));
      });
      return next;
    });
    setPlayingIndex(null);
  }, []);

  // Keep transitions in sync with clip count (add "cut" when clips added)
  useEffect(() => {
    const n = clips.length;
    const need = Math.max(0, n - 1);
    setTransitionsBetween((prev) => {
      if (prev.length === need) return prev;
      if (prev.length < need) return [...prev, ...Array(need - prev.length).fill("cut")];
      return prev.slice(0, need);
    });
  }, [clips.length]);

  useEffect(() => {
    if (!importPopupOpen) return;
    setGuidesLoading(true);
    fetch("/api/library?type=scripts")
      .then((res) => (res.ok ? res.json() : []))
      .then((items: VideoGuideListItem[]) => {
        setVideoGuides((items ?? []).filter((i) => i.type === "script" && i.platform === "video-guide"));
      })
      .catch(() => setVideoGuides([]))
      .finally(() => setGuidesLoading(false));
  }, [importPopupOpen]);

  const handleSelectGuide = useCallback(
    async (item: VideoGuideListItem) => {
      setImportingGuideId(item.id);
      try {
        const res = await fetch(`/api/library/scripts/${item.id}`);
        if (!res.ok) throw new Error("Failed to load guide");
        const row = await res.json();
        const content = row?.content;
        if (!content) throw new Error("No guide content");
        let guide: { script?: { hook?: string; body?: string; cta?: string } };
        try {
          guide = typeof content === "string" ? JSON.parse(content) : content;
        } catch {
          throw new Error("Invalid guide data");
        }
        const script = guide?.script;
        if (!script) throw new Error("No script in guide");
        const fullText = [script.hook, script.body, script.cta].filter(Boolean).join(" ").trim();
        if (!fullText) throw new Error("Script is empty");

        const voiceRes = await fetch("/api/generate-voiceover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: fullText,
            voiceId: getDefaultVoiceId(),
            stability: 0.5,
            similarity: 0.75,
          }),
        });
        if (!voiceRes.ok) {
          const err = await voiceRes.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || "Voiceover failed");
        }
        const buffer = await voiceRes.arrayBuffer();
        const blob = new Blob([buffer], { type: "audio/mpeg" });
        const fileName = `${(item.title || "Video Guide").replace(/^Video Guide:\s*/i, "").replace(/\s+/g, "-")}-voiceover.mp3`;
        const file = new File([blob], fileName, { type: "audio/mpeg" });
        addClipFromFile(file);
        setImportPopupOpen(false);
        toast({ title: "Voiceover added", description: "Added to timeline as audio track." });
      } catch (err) {
        toast({
          title: "Import failed",
          description: err instanceof Error ? err.message : "Could not add voiceover",
          variant: "destructive",
        });
      } finally {
        setImportingGuideId(null);
      }
    },
    [addClipFromFile, toast]
  );

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      clipsRef.current.forEach((c) => URL.revokeObjectURL(c.url));
    };
  }, []);

  const playSequence = useCallback(() => {
    if (clips.length === 0) return;
    setPlayingIndex(0);
  }, [clips.length]);

  const stopSequence = useCallback(() => {
    setPlayingIndex(null);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  // When playingIndex is set, play that clip; when it ends, advance to next
  useEffect(() => {
    if (playingIndex === null || playingIndex >= clips.length) {
      if (playingIndex !== null && clips.length === 0) setPlayingIndex(null);
      return;
    }
    const clip = clips[playingIndex];
    const goNext = () => {
      setPlayingIndex((i) => (i === null ? null : i + 1 >= clips.length ? null : i + 1));
    };

    if (clip.type === "video") {
      const el = videoRef.current;
      if (!el) return;
      el.src = clip.url;
      el.style.display = "block";
      if (audioRef.current) audioRef.current.style.display = "none";
      el.play().catch(() => goNext());
      el.onended = goNext;
      return () => {
        el.onended = null;
        el.pause();
      };
    } else {
      const el = audioRef.current;
      if (!el) return;
      el.src = clip.url;
      el.style.display = "block";
      if (videoRef.current) videoRef.current.style.display = "none";
      el.play().catch(() => goNext());
      el.onended = goNext;
      return () => {
        el.onended = null;
        el.pause();
      };
    }
  }, [clips, playingIndex]);

  return (
    <div className="p-6 flex flex-col lg:flex-row gap-6 max-w-[1400px] mx-auto">
      {/* Main: preview + tracks */}
      <div className="flex-1 min-w-0 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Video Timeline
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Preview at the top, timeline and captions below. Design panel on the right.
          </p>
        </div>

        {/* Preview player at top */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
            <p className="text-sm text-muted-foreground">
              Play the sequence in timeline order. Background uses Design panel color.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="rounded-lg aspect-video flex items-center justify-center min-h-[200px] overflow-hidden transition-colors"
              style={{ backgroundColor: design.backgroundColor }}
            >
              <video
                ref={videoRef}
                className="max-w-full max-h-full object-contain hidden"
                muted
                playsInline
                controls
              />
              <audio ref={audioRef} className="hidden" controls />
              {playingIndex === null && clips.length === 0 && (
                <p className="text-sm text-muted-foreground" style={{ color: design.textColor }}>
                  Add clips below, then play.
                </p>
              )}
              {playingIndex === null && clips.length > 0 && (
                <p className="text-sm text-muted-foreground" style={{ color: design.textColor }}>
                  Click &quot;Play sequence&quot; to preview.
                </p>
              )}
            </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              size="sm"
              onClick={playSequence}
              disabled={clips.length === 0 || playingIndex !== null}
            >
              <Play className="w-4 h-4 mr-1" />
              Play sequence
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={stopSequence}
              disabled={playingIndex === null}
            >
              <Square className="w-4 h-4 mr-1" />
              Stop
            </Button>
            {playingIndex !== null && (
              <span className="text-sm text-muted-foreground">
                Playing {playingIndex + 1} of {clips.length}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Timeline track: upload + draggable clip blocks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Timeline track
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload video clips and audio. Drag to reorder. Choose transition between clips: cut, fade in, or fade out.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer">
            <input
              type="file"
              accept={VIDEO_ACCEPT}
              multiple
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Button type="button" variant="outline" size="sm" asChild>
              <span>Add video clips</span>
            </Button>
          </label>
          <label className="cursor-pointer">
            <input
              type="file"
              accept={AUDIO_ACCEPT}
              multiple
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Button type="button" variant="outline" size="sm" asChild>
              <span>Add voiceover</span>
            </Button>
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setImportPopupOpen(true)}
          >
            <FileVideo className="w-4 h-4 mr-1" />
            Import from Video Guide
          </Button>
          </div>
          {clips.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center rounded-lg border border-dashed">
              No clips on the track yet. Add video clips or audio above.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={clips.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-2">
                  {clips.map((clip, i) => (
                    <li key={clip.id} className="space-y-2">
                      <SortableClip clip={clip} onRemove={removeClip} />
                      {i < clips.length - 1 && (
                        <div className="flex items-center gap-2 pl-10 py-1.5 rounded-md bg-muted/50 border border-border/50">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">Transition:</span>
                          <Select
                            value={transitionsBetween[i] ?? "cut"}
                            onValueChange={(v) =>
                              setTransitionsBetween((prev) => {
                                const next = [...prev];
                                if (i < next.length) next[i] = v as TransitionType;
                                return next;
                              })
                            }
                          >
                            <SelectTrigger className="w-[130px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TRANSITION_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Captions track */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Type className="w-4 h-4" />
            Captions track
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Add text captions with start and end times (seconds).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button type="button" variant="outline" size="sm" onClick={addCaption}>
            <Plus className="w-4 h-4 mr-1" />
            Add caption
          </Button>
          {captions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center rounded-lg border border-dashed">
              No captions yet. Add captions to show text at specific times.
            </p>
          ) : (
            <ul className="space-y-3">
              {captions.map((cap) => (
                <li
                  key={cap.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 text-card-foreground"
                >
                  <Input
                    placeholder="Caption text"
                    value={cap.text}
                    onChange={(e) => updateCaption(cap.id, { text: e.target.value })}
                    className="flex-1 min-w-[120px]"
                  />
                  <div className="flex items-center gap-1">
                    <Label className="text-xs whitespace-nowrap">Start</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      value={cap.startTime}
                      onChange={(e) => updateCaption(cap.id, { startTime: Number(e.target.value) || 0 })}
                      className="w-16"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Label className="text-xs whitespace-nowrap">End</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      value={cap.endTime}
                      onChange={(e) => updateCaption(cap.id, { endTime: Number(e.target.value) || 0 })}
                      className="w-16"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeCaption(cap.id)}
                    aria-label="Remove caption"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Design panel - right sidebar (stacks below on small screens) */}
      <aside className="w-full lg:w-72 flex-shrink-0 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Design</CardTitle>
            <p className="text-sm text-muted-foreground">
              Text overlay and background for your video.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Text overlay font</Label>
              <Select
                value={design.font}
                onValueChange={(v) => setDesign((d) => ({ ...d, font: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Text size</Label>
              <Select
                value={design.fontSize}
                onValueChange={(v) => setDesign((d) => ({ ...d, fontSize: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_SIZE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Text color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={design.textColor}
                  onChange={(e) => setDesign((d) => ({ ...d, textColor: e.target.value }))}
                  className="h-9 w-12 rounded border border-input cursor-pointer bg-transparent"
                  aria-label="Text color"
                />
                <Input
                  value={design.textColor}
                  onChange={(e) => setDesign((d) => ({ ...d, textColor: e.target.value }))}
                  className="flex-1 font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Background color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={design.backgroundColor}
                  onChange={(e) => setDesign((d) => ({ ...d, backgroundColor: e.target.value }))}
                  className="h-9 w-12 rounded border border-input cursor-pointer bg-transparent"
                  aria-label="Background color"
                />
                <Input
                  value={design.backgroundColor}
                  onChange={(e) => setDesign((d) => ({ ...d, backgroundColor: e.target.value }))}
                  className="flex-1 font-mono text-sm"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground pt-1 border-t">
              Preview area uses the background color. Caption styling will apply when you export (coming soon).
            </p>
          </CardContent>
        </Card>
      </aside>

      <Dialog open={importPopupOpen} onOpenChange={setImportPopupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import from Video Guide</DialogTitle>
            <DialogDescription>
              Select a video guide to generate its voiceover and add it to the timeline as an audio track.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[280px] overflow-y-auto space-y-1 pr-2">
            {guidesLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Loading guides…
              </div>
            ) : videoGuides.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No video guides yet. Create one from Digital Products → Scripts → Create Video Guide.
              </p>
            ) : (
              videoGuides.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={importingGuideId !== null}
                  onClick={() => handleSelectGuide(item)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "disabled:opacity-50 disabled:pointer-events-none",
                    importingGuideId === item.id && "bg-accent"
                  )}
                >
                  <FileVideo className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm font-medium">{item.title}</span>
                  {importingGuideId === item.id && (
                    <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin text-muted-foreground" />
                  )}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
