"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  Plus,
  Film,
  Play,
  Square,
  Pause,
  Trash2,
  FileVideo,
  Loader2,
  Type,
  Layout,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Upload,
  Rewind,
  FastForward,
  Mic,
  Music,
} from "lucide-react";
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
import { replaceProductTitleInText } from "@/lib/product-title";

// --- Types ---

type VideoGuideListItem = { id: string; type: string; title: string; platform?: string; createdAt: string };

/** One scene slot in the timeline. User uploads a video or image; if none, we show background during playback. */
export type SceneSlot = {
  id: string;
  sceneIndex: number;
  startSec: number;
  endSec: number;
  mediaUrl?: string;
  mediaType?: "video" | "image";
  muted?: boolean;
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
export type AspectRatioId = "9:16" | "1:1" | "16:9";

// --- Helpers ---

function parseTiming(t: string): { startSec: number; endSec: number } {
  const m = String(t).trim().match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)s?$/i);
  if (!m) return { startSec: 0, endSec: 0 };
  return { startSec: parseFloat(m[1]), endSec: parseFloat(m[2]) };
}

function parseBulletItems(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const byNewline = trimmed.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const bulletStart = /^[•\-]\s*/;
  const hasBulletLines = byNewline.some((line) => bulletStart.test(line));
  if (hasBulletLines && byNewline.length > 0) {
    return byNewline.map((line) => line.replace(bulletStart, "").trim()).filter(Boolean);
  }
  if (trimmed.includes("•") && (trimmed.match(/•/g)?.length ?? 0) >= 2) {
    return trimmed
      .split("•")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [trimmed];
}

/**
 * Build captions from the Full Script (Hook, Body, CTA) — the actual spoken words — mapped to scene timestamps.
 * Split the combined script proportionally by scene duration so captions match the voiceover exactly.
 * Product title: strip everything from the first | onwards in hook, body, CTA and all caption text.
 */
function buildCaptionsFromGuide(guide: {
  productName?: string;
  script?: { hook?: string; body?: string; cta?: string };
  scenes?: Array<{ scene?: string; timing?: string; textOverlay?: { exactText?: string } }>;
}): CaptionItem[] {
  const script = guide?.script;
  const scenes = guide?.scenes?.filter((s) => s?.timing) ?? [];
  const rawProductTitle = guide?.productName ?? "";
  const clean = (text: string) => replaceProductTitleInText(text, rawProductTitle);

  if (!script || scenes.length === 0) return [];

  const hook = clean((script.hook ?? "").trim());
  const body = clean((script.body ?? "").trim());
  const cta = clean((script.cta ?? "").trim());
  const fullScript = [hook, body, cta].filter(Boolean).join(" ");
  const words = fullScript.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const timings = scenes.map((s) => parseTiming(s.timing ?? "0-0"));
  const totalDuration = timings.reduce((sum, t) => sum + Math.max(0, t.endSec - t.startSec), 0);
  if (totalDuration <= 0) return [];

  const baseId = `cap-guide-${Date.now()}`;
  const captions: CaptionItem[] = [];
  let wordOffset = 0;

  for (let i = 0; i < timings.length; i++) {
    const { startSec, endSec } = timings[i];
    const duration = Math.max(0, endSec - startSec);
    const fraction = duration / totalDuration;
    const wordCount = Math.max(0, Math.round(words.length * fraction));
    const chunk = words.slice(wordOffset, wordOffset + wordCount).join(" ").trim();
    wordOffset += wordCount;
    if (chunk) {
      captions.push({
        id: `${baseId}-${i}`,
        text: chunk,
        startTime: startSec,
        endTime: endSec,
      });
    }
  }

  if (wordOffset < words.length && captions.length > 0) {
    const last = captions[captions.length - 1];
    const remainder = words.slice(wordOffset).join(" ").trim();
    if (remainder) last.text = (last.text + " " + remainder).trim();
  }

  return captions;
}

// --- Constants ---

const RATIO_OPTIONS: {
  value: AspectRatioId;
  label: string;
  aspectClass: string;
  width: number;
  height: number;
  safeZone: { top: number; right: number; bottom: number; left: number };
}[] = [
  {
    value: "9:16",
    label: "9:16 Vertical (TikTok, Reels, Shorts)",
    aspectClass: "aspect-[9/16]",
    width: 1080,
    height: 1920,
    safeZone: { top: 0.1, right: 0.05, bottom: 0.2, left: 0.05 },
  },
  {
    value: "1:1",
    label: "1:1 Square",
    aspectClass: "aspect-square",
    width: 1080,
    height: 1080,
    safeZone: { top: 0.08, right: 0.08, bottom: 0.08, left: 0.08 },
  },
  {
    value: "16:9",
    label: "16:9 Landscape",
    aspectClass: "aspect-video",
    width: 1920,
    height: 1080,
    safeZone: { top: 0.05, right: 0.05, bottom: 0.1, left: 0.05 },
  },
];

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

// --- Main component ---

export default function VideoTimelineFlow() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  /** Scene slots from Video Guide. Each can have an uploaded video or image; no placeholders. */
  const [sceneSlots, setSceneSlots] = useState<SceneSlot[]>([]);
  /** Single voiceover URL (from import or loaded from guide). */
  const [voiceoverUrl, setVoiceoverUrl] = useState<string | null>(null);
  const [playingSceneIndex, setPlayingSceneIndex] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackTimeSec, setPlaybackTimeSec] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playbackTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);

  const [aspectRatio, setAspectRatio] = useState<AspectRatioId>("9:16");
  const ratioConfig = RATIO_OPTIONS.find((r) => r.value === aspectRatio) ?? RATIO_OPTIONS[0];
  const previewSize = useMemo(() => {
    if (aspectRatio === "9:16") return { width: 270, height: 480 };
    if (aspectRatio === "1:1") return { width: 360, height: 360 };
    return { width: 480, height: 270 };
  }, [aspectRatio]);
  const [voiceoverPreviewPlaying, setVoiceoverPreviewPlaying] = useState(false);
  const voiceoverPreviewRef = useRef<HTMLAudioElement | null>(null);
  const [importPopupOpen, setImportPopupOpen] = useState(false);
  const [videoGuides, setVideoGuides] = useState<VideoGuideListItem[]>([]);
  const [guidesLoading, setGuidesLoading] = useState(false);
  const [importingGuideId, setImportingGuideId] = useState<string | null>(null);
  const [captions, setCaptions] = useState<CaptionItem[]>([]);
  const [design, setDesign] = useState<DesignOptions>(DEFAULT_DESIGN);
  const hasPopulatedCaptionsRef = useRef(false);
  const [masterMuted, setMasterMuted] = useState(false);
  const [mutedSlotIds, setMutedSlotIds] = useState<string[]>([]);
  /** Guide id from URL (when opened from library) or from last Import from Video Guide. */
  const [linkedGuideId, setLinkedGuideId] = useState<string | null>(null);
  const urlGuideId = searchParams.get("guideId") ?? searchParams.get("libraryScriptId") ?? null;
  const effectiveScriptId = urlGuideId ?? linkedGuideId;

  const totalAudioSec = useMemo(
    () => (sceneSlots.length > 0 ? Math.max(...sceneSlots.map((s) => s.endSec)) : 0),
    [sceneSlots]
  );
  const slotsWithMedia = useMemo(() => sceneSlots.filter((s) => s.mediaUrl), [sceneSlots]);

  const addCaption = useCallback(() => {
    const lastEnd = captions.length > 0 ? Math.max(...captions.map((c) => c.endTime)) : 0;
    setCaptions((prev) => [...prev, { id: `cap-${Date.now()}`, text: "", startTime: lastEnd, endTime: lastEnd + 3 }]);
  }, [captions.length]);

  const updateCaption = useCallback((id: string, patch: Partial<CaptionItem>) => {
    setCaptions((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const removeCaption = useCallback((id: string) => {
    setCaptions((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const activeCaption = useMemo(() => {
    const t = playbackTimeSec;
    return captions.find((c) => c.startTime <= t && t < c.endTime) ?? null;
  }, [captions, playbackTimeSec]);

  useEffect(() => {
    if (searchParams.get("importVoiceover") === "1") {
      setImportPopupOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("importVoiceover");
      window.history.replaceState({}, "", url.pathname + (url.search || ""));
    }
  }, [searchParams]);

  useEffect(() => {
    const param = searchParams.get("ratio");
    if (param === "9:16" || param === "1:1" || param === "16:9") setAspectRatio(param);
  }, [searchParams]);

  // Load timeline (scene slots, voiceover, captions, mute) when a Video Guide is linked via URL
  useEffect(() => {
    const guideId = searchParams.get("guideId") ?? searchParams.get("libraryScriptId");
    if (!guideId || hasPopulatedCaptionsRef.current) return;
    hasPopulatedCaptionsRef.current = true;
    setLinkedGuideId((prev) => prev ?? guideId);
    fetch(`/api/library/scripts/${guideId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((row) => {
        if (!row?.content) return;
        let guide: {
          productName?: string;
          script?: { hook?: string; body?: string; cta?: string };
          scenes?: Array<{ scene?: string; timing?: string; textOverlay?: { exactText?: string } }>;
          timelineMutedClipIds?: string[];
          timelineSceneSlots?: SceneSlot[];
          timelineVoiceoverUrl?: string;
        };
        try {
          guide = typeof row.content === "string" ? JSON.parse(row.content) : row.content;
        } catch {
          return;
        }
        const next = buildCaptionsFromGuide(guide);
        if (next.length > 0) setCaptions((prev) => (prev.length === 0 ? next : prev));
        if (Array.isArray(guide.timelineMutedClipIds)) setMutedSlotIds(guide.timelineMutedClipIds);
        if (typeof guide.timelineVoiceoverUrl === "string" && guide.timelineVoiceoverUrl.trim()) {
          setVoiceoverUrl(guide.timelineVoiceoverUrl.trim());
        }
        const scenes = guide?.scenes?.filter((s) => s?.timing) ?? [];
        if (Array.isArray(guide.timelineSceneSlots) && guide.timelineSceneSlots.length > 0) {
          setSceneSlots(guide.timelineSceneSlots);
        } else if (scenes.length > 0) {
          const timings = scenes.map((s) => parseTiming(s.timing ?? "0-0"));
          setSceneSlots(
            timings.map((t, i) => ({
              id: `scene-${guideId}-${i}`,
              sceneIndex: i + 1,
              startSec: t.startSec,
              endSec: t.endSec,
            }))
          );
        }
      })
      .catch(() => {
        hasPopulatedCaptionsRef.current = false;
      });
  }, [searchParams]);

  const toggleMasterMute = useCallback(() => {
    setMasterMuted((prev) => !prev);
  }, []);

  const persistMutedClipIds = useCallback(
    (ids: string[]) => {
      if (!effectiveScriptId) return;
      fetch(`/api/library/scripts/${effectiveScriptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timelineMutedClipIds: ids }),
      }).catch(() => {});
    },
    [effectiveScriptId]
  );

  const toggleSlotMute = useCallback(
    (slotId: string) => {
      setMutedSlotIds((prev) => {
        const next = prev.includes(slotId) ? prev.filter((id) => id !== slotId) : [...prev, slotId];
        persistMutedClipIds(next);
        return next;
      });
    },
    [persistMutedClipIds]
  );

  const persistSceneSlots = useCallback(
    (slots: SceneSlot[]) => {
      if (!effectiveScriptId) return;
      fetch(`/api/library/scripts/${effectiveScriptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timelineSceneSlots: slots }),
      }).catch(() => {});
    },
    [effectiveScriptId]
  );

  const uploadSceneMedia = useCallback(
    async (sceneIndex: number, file: File) => {
      if (sceneSlots.length === 0) {
        toast({ title: "No guide linked", description: "Import from Video Guide first so uploads can be saved.", variant: "destructive" });
        return;
      }
      if (!effectiveScriptId) {
        toast({ title: "Upload failed", description: "Link a guide to save uploads.", variant: "destructive" });
        return;
      }
      const form = new FormData();
      form.set("file", file);
      form.set("libraryScriptId", effectiveScriptId);
      form.set("sceneIndex", String(sceneIndex));
      const res = await fetch("/api/video-timeline/upload-scene-media", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ title: "Upload failed", description: (data as { error?: string }).error || "Try again.", variant: "destructive" });
        return;
      }
      const { url, mediaType } = (await res.json()) as { url: string; mediaType?: "video" | "image" };
      setSceneSlots((prev) => {
        const next = prev.map((s) =>
          s.sceneIndex === sceneIndex + 1 ? { ...s, mediaUrl: url, mediaType: mediaType ?? (url.match(/\.(mp4|webm|mov)/i) ? "video" : "image") } : s
        );
        persistSceneSlots(next);
        return next;
      });
      toast({ title: "Uploaded", description: `Scene ${sceneIndex + 1} media saved.` });
    },
    [sceneSlots.length, effectiveScriptId, toast, persistSceneSlots]
  );

  const clearSceneMedia = useCallback(
    (slotId: string) => {
      setSceneSlots((prev) => {
        const next = prev.map((s) => (s.id === slotId ? { ...s, mediaUrl: undefined, mediaType: undefined } : s));
        persistSceneSlots(next);
        return next;
      });
    },
    [persistSceneSlots]
  );

  const stopSequence = useCallback(() => {
    setPlayingSceneIndex(null);
    setIsPaused(false);
    setPlaybackProgress(0);
    setPlaybackTimeSec(0);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
    if (imageRef.current) imageRef.current.style.display = "none";
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (playbackTickRef.current) {
      clearInterval(playbackTickRef.current);
      playbackTickRef.current = null;
    }
  }, []);

  const removeVoiceover = useCallback(() => {
    setVoiceoverUrl(null);
    if (effectiveScriptId) {
      fetch(`/api/library/scripts/${effectiveScriptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timelineVoiceoverUrl: "" }),
      }).catch(() => {});
    }
    if (playingSceneIndex !== null) {
      stopSequence();
    }
    toast({ title: "Voiceover removed" });
  }, [effectiveScriptId, playingSceneIndex, stopSequence, toast]);

  const previewVoiceover = useCallback(() => {
    const el = voiceoverPreviewRef.current;
    if (!el || !voiceoverUrl) return;
    if (voiceoverPreviewPlaying) {
      el.pause();
      el.currentTime = 0;
      setVoiceoverPreviewPlaying(false);
      return;
    }
    el.src = voiceoverUrl;
    setVoiceoverPreviewPlaying(true);
    el.play().catch(() => setVoiceoverPreviewPlaying(false));
    el.onended = () => setVoiceoverPreviewPlaying(false);
  }, [voiceoverUrl, voiceoverPreviewPlaying]);

  useEffect(() => {
    if (!importPopupOpen) return;
    setGuidesLoading(true);
    fetch("/api/library?type=scripts")
      .then((res) => (res.ok ? res.json() : []))
      .then((items: VideoGuideListItem[]) => setVideoGuides((items ?? []).filter((i) => i.type === "script" && i.platform === "video-guide")))
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
        let guide: {
          productName?: string;
          script?: { hook?: string; body?: string; cta?: string };
          scenes?: Array<{ scene?: string; timing?: string; textOverlay?: { exactText?: string } }>;
          platforms?: string[];
        };
        try {
          guide = typeof content === "string" ? JSON.parse(content) : content;
        } catch {
          throw new Error("Invalid guide data");
        }
        const script = guide?.script;
        if (!script) throw new Error("No script in guide");
        const fullText = [script.hook, script.body, script.cta].filter(Boolean).join(" ").trim();
        if (!fullText) throw new Error("Script is empty");

        const scenes = guide?.scenes?.filter((s) => s?.timing) ?? [];
        const voiceId = getDefaultVoiceId();
        const voiceOpts = { voiceId, stability: 0.5, similarity: 0.75 };

        const timings = scenes.length > 0 ? scenes.map((s) => parseTiming(s.timing ?? "0-0")) : [{ startSec: 0, endSec: 30 }];
        const baseId = `guide-${item.id}-${Date.now()}`;
        const slots: SceneSlot[] = timings.map((t, i) => ({
          id: `${baseId}-${i}`,
          sceneIndex: i + 1,
          startSec: t.startSec,
          endSec: t.endSec,
        }));
        setSceneSlots(slots);
        setLinkedGuideId(item.id);

        const voiceRes = await fetch("/api/generate-voiceover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: fullText, ...voiceOpts }),
        });
        if (!voiceRes.ok) throw new Error((await voiceRes.json().catch(() => ({})) as { error?: string }).error || "Voiceover failed");
        const buffer = await voiceRes.arrayBuffer();
        const blob = new Blob([buffer], { type: "audio/mpeg" });
        const voiceFile = new File([blob], "Voiceover.mp3", { type: "audio/mpeg" });

        let finalVoiceUrl: string;
        try {
          const form = new FormData();
          form.set("file", voiceFile);
          form.set("libraryScriptId", item.id);
          const upRes = await fetch("/api/video-timeline/upload-voiceover", { method: "POST", body: form });
          if (upRes.ok) {
            const data = (await upRes.json()) as { url: string };
            finalVoiceUrl = data.url;
            await fetch(`/api/library/scripts/${item.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ timelineVoiceoverUrl: finalVoiceUrl, timelineSceneSlots: slots }),
            });
          } else {
            finalVoiceUrl = URL.createObjectURL(blob);
          }
        } catch {
          finalVoiceUrl = URL.createObjectURL(blob);
        }
        setVoiceoverUrl(finalVoiceUrl);
        setImportPopupOpen(false);
        if (Array.isArray(guide.platforms) && guide.platforms.some((p) => String(p).toLowerCase().includes("tiktok") || String(p).toLowerCase().includes("instagram"))) {
          setAspectRatio("9:16");
        }
        const guideCaptions = buildCaptionsFromGuide(guide);
        if (guideCaptions.length > 0) setCaptions(guideCaptions);
        toast({ title: "Video guide imported", description: `${slots.length} scene(s). Upload video or image for each scene.` });
      } catch (err) {
        toast({ title: "Import failed", description: err instanceof Error ? err.message : "Could not add voiceover", variant: "destructive" });
      } finally {
        setImportingGuideId(null);
      }
    },
    [toast]
  );

  // --- Playback: voiceover is master; scenes switch by audio time; show video, image, or background ---
  const playSequence = useCallback(() => {
    if (!voiceoverUrl || sceneSlots.length === 0) return;
    if (playingSceneIndex !== null && isPaused) {
      videoRef.current?.play().catch(() => {});
      audioRef.current?.play().catch(() => {});
      setIsPaused(false);
      return;
    }
    setPlayingSceneIndex(0);
    setPlaybackProgress(0);
    setPlaybackTimeSec(0);
  }, [voiceoverUrl, sceneSlots.length, playingSceneIndex, isPaused]);

  const pauseSequence = useCallback(() => {
    if (playingSceneIndex === null) return;
    videoRef.current?.pause();
    audioRef.current?.pause();
    setIsPaused(true);
  }, [playingSceneIndex]);

  const getClipStartSec = useCallback((index: number) => sceneSlots[index]?.startSec ?? 0, [sceneSlots]);
  const getClipEndSec = useCallback(
    (index: number) => sceneSlots[index]?.endSec ?? sceneSlots[index]?.startSec + 10 ?? 10,
    [sceneSlots]
  );

  const formatTime = useCallback((sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, []);

  const seekTo = useCallback(
    (timeSec: number) => {
      const t = Math.max(0, Math.min(timeSec, totalAudioSec));
      if (audioRef.current) {
        audioRef.current.currentTime = t;
        audioRef.current.play().catch(() => {});
      }
      setPlaybackTimeSec(t);
      setPlaybackProgress(totalAudioSec > 0 ? t / totalAudioSec : 0);
      const idx = sceneSlots.findIndex((s) => t >= s.startSec && t < s.endSec);
      setPlayingSceneIndex(idx >= 0 ? idx : null);
      setIsPaused(false);
    },
    [totalAudioSec, sceneSlots]
  );

  const seekBack5 = useCallback(() => {
    const a = audioRef.current;
    if (a) seekTo(a.currentTime - 5);
  }, [seekTo]);

  const seekForward5 = useCallback(() => {
    const a = audioRef.current;
    if (a) seekTo(a.currentTime + 5);
  }, [seekTo]);

  const rewindToPrevClip = useCallback(() => {
    if (sceneSlots.length === 0) return;
    const n = sceneSlots.length;
    const current = playingSceneIndex ?? 0;
    const prev = current <= 0 ? n - 1 : current - 1;
    const startSec = getClipStartSec(prev);
    const a = audioRef.current;
    if (a) {
      a.currentTime = startSec;
      a.play().catch(() => {});
    }
    setIsPaused(false);
    setPlayingSceneIndex(prev);
    setPlaybackProgress(totalAudioSec > 0 ? startSec / totalAudioSec : 0);
    setPlaybackTimeSec(startSec);
  }, [sceneSlots.length, playingSceneIndex, getClipStartSec, totalAudioSec]);

  const forwardToNextClip = useCallback(() => {
    if (sceneSlots.length === 0) return;
    const n = sceneSlots.length;
    const current = playingSceneIndex ?? 0;
    const next = current >= n - 1 ? 0 : current + 1;
    const startSec = getClipStartSec(next);
    const a = audioRef.current;
    if (a) {
      a.currentTime = startSec;
      a.play().catch(() => {});
    }
    setIsPaused(false);
    setPlayingSceneIndex(next);
    setPlaybackProgress(totalAudioSec > 0 ? startSec / totalAudioSec : 0);
    setPlaybackTimeSec(startSec);
  }, [sceneSlots.length, playingSceneIndex, getClipStartSec, totalAudioSec]);

  useEffect(() => {
    if (playingSceneIndex === null || sceneSlots.length === 0) {
      if (videoRef.current) videoRef.current.style.display = "none";
      if (imageRef.current) imageRef.current.style.display = "none";
      if (playbackTickRef.current) {
        clearInterval(playbackTickRef.current);
        playbackTickRef.current = null;
      }
      return;
    }

    const video = videoRef.current;
    const img = imageRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;

    const index = playingSceneIndex;
    const slot = sceneSlots[index];
    const clipEndSec = getClipEndSec(index);
    const slotMuted = slot && mutedSlotIds.includes(slot.id);

    if (slot?.mediaUrl && slot.mediaType === "video") {
      video.style.display = "block";
      video.style.visibility = "visible";
      video.style.opacity = "1";
      video.style.width = "100%";
      video.style.height = "100%";
      video.style.objectFit = "contain";
      video.muted = masterMuted || slotMuted;
      video.src = slot.mediaUrl;
      video.load();
      const playWhenReady = () => video.play().catch(() => {});
      if (video.readyState >= 2) playWhenReady();
      else video.oncanplay = () => {
        video.oncanplay = null;
        playWhenReady();
      };
      if (img) img.style.display = "none";
    } else if (slot?.mediaUrl && slot.mediaType === "image") {
      if (img) {
        img.style.display = "block";
        img.src = slot.mediaUrl;
        img.style.objectFit = "contain";
      }
      video.style.display = "none";
    } else {
      video.style.display = "none";
      if (img) img.style.display = "none";
    }

    if (index === 0 && voiceoverUrl) {
      if (!audio.src || !audio.src.includes(voiceoverUrl)) {
        audio.src = voiceoverUrl;
        audio.currentTime = 0;
        audio.muted = masterMuted;
        audio.volume = 1;
        audio.load();
        const playAudio = () => {
          audio.currentTime = 0;
          audio.muted = masterMuted;
          audio.volume = 1;
          audio.play().catch(() => {});
        };
        if (audio.readyState >= 2) playAudio();
        else audio.oncanplay = () => {
          audio.oncanplay = null;
          playAudio();
        };
      } else {
        audio.play().catch(() => {});
      }
    } else if (audio) {
      audio.play().catch(() => {});
    }

    playbackTickRef.current = setInterval(() => {
      const a = audioRef.current;
      if (!a) return;
      const t = a.currentTime;
      setPlaybackTimeSec(t);
      setPlaybackProgress(totalAudioSec > 0 ? Math.min(1, t / totalAudioSec) : 0);
      if (t >= clipEndSec) {
        const next = index + 1;
        if (next < sceneSlots.length) {
          setPlayingSceneIndex(next);
        } else {
          setPlayingSceneIndex(null);
          if (playbackTickRef.current) {
            clearInterval(playbackTickRef.current);
            playbackTickRef.current = null;
          }
        }
      }
    }, 100);

    return () => {
      video.onended = null;
      video.oncanplay = null;
      video.pause();
      if (playbackTickRef.current) {
        clearInterval(playbackTickRef.current);
        playbackTickRef.current = null;
      }
    };
  }, [playingSceneIndex, sceneSlots, voiceoverUrl, masterMuted, mutedSlotIds, getClipEndSec, totalAudioSec]);

  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (video && playingSceneIndex !== null && sceneSlots.length > 0) {
      const slot = sceneSlots[playingSceneIndex];
      if (slot) video.muted = masterMuted || mutedSlotIds.includes(slot.id);
    }
    if (audio) audio.muted = masterMuted;
  }, [masterMuted, mutedSlotIds, playingSceneIndex, sceneSlots]);

  return (
    <div className="p-6 flex flex-col lg:flex-row gap-6 max-w-[1400px] mx-auto">
      <div className="flex-1 min-w-0 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Video Timeline</h1>
          <p className="text-sm text-muted-foreground mt-1">Preview, timeline, and captions. Design panel on the right.</p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Layout className="w-4 h-4" />
              Video format
            </CardTitle>
            <p className="text-sm text-muted-foreground">Export dimensions: {ratioConfig.width}×{ratioConfig.height}.</p>
          </CardHeader>
          <CardContent>
            <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as AspectRatioId)}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RATIO_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
            <p className="text-sm text-muted-foreground">Voiceover is the master clock. Scenes show your uploaded video or image; empty scenes show background only.</p>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col items-center w-full">
              {/* Canvas: 9:16 portrait 270×480, aspect-ratio 9/16, centred; no text inside */}
              <div
                className="rounded-t-lg overflow-hidden shrink-0 mx-auto"
                style={{
                  backgroundColor: design.backgroundColor,
                  width: 270,
                  height: 480,
                  aspectRatio: "9 / 16",
                }}
              >
                <div className="relative w-full h-full flex items-center justify-center">
                  <video ref={videoRef} className="absolute inset-0 w-full h-full object-contain" style={{ display: "none" }} muted={false} playsInline />
                  <img ref={imageRef} alt="" className="absolute inset-0 w-full h-full object-contain" style={{ display: "none" }} />
                  <audio ref={audioRef} className="absolute w-0 h-0 opacity-0 pointer-events-none" style={{ position: "absolute", left: -9999 }} preload="auto" />
                  <div
                    className="absolute pointer-events-none border-2 border-dashed border-white/30 rounded z-10"
                    style={{
                      top: `${ratioConfig.safeZone.top * 100}%`,
                      right: `${ratioConfig.safeZone.right * 100}%`,
                      bottom: `${ratioConfig.safeZone.bottom * 100}%`,
                      left: `${ratioConfig.safeZone.left * 100}%`,
                    }}
                    aria-hidden
                  />
                  {activeCaption && playingSceneIndex !== null && !isPaused && (
                    <div
                      className="absolute bottom-[12%] left-[5%] right-[5%] z-20 text-center px-4 py-2 rounded"
                      style={{
                        fontFamily: design.font,
                        fontSize: `${design.fontSize}px`,
                        color: design.textColor,
                        backgroundColor: "rgba(0,0,0,0.6)",
                      }}
                    >
                      {activeCaption.text}
                    </div>
                  )}
                </div>
              </div>

              {/* Player bar: same width as canvas (270px), flush below, no gap */}
              <div className="bg-[#0a0a0a] rounded-b-lg border border-t-0 border-[#2A2A2A] shrink-0 mx-auto" style={{ width: 270 }}>
                {sceneSlots.length > 0 && totalAudioSec > 0 && (
                  <div className="flex items-center gap-3 py-2 px-3">
                    <span className="text-xs font-mono text-white/80 tabular-nums w-10 text-right">{formatTime(playbackTimeSec)}</span>
                    <div
                      ref={scrubberRef}
                      role="slider"
                      tabIndex={0}
                      aria-valuemin={0}
                      aria-valuemax={totalAudioSec}
                      aria-valuenow={playbackTimeSec}
                      aria-label="Seek"
                      className="flex-1 h-1.5 rounded-full bg-white/20 cursor-pointer hover:bg-white/30 transition-colors overflow-hidden"
                      onClick={(e) => {
                        const el = scrubberRef.current;
                        if (!el || totalAudioSec <= 0) return;
                        const rect = el.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const pct = Math.max(0, Math.min(1, x / rect.width));
                        seekTo(pct * totalAudioSec);
                      }}
                    >
                      <div
                        className="h-full bg-[#FF6B35] transition-[width] duration-100"
                        style={{ width: `${playbackProgress * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-white/80 tabular-nums w-10">{formatTime(totalAudioSec)}</span>
                  </div>
                )}
                {/* Controls — icon-only except Play */}
                <div className="flex items-center justify-center gap-1 py-2 px-2 border-t border-white/10">
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-white/90 hover:text-[#FF6B35] hover:bg-white/10" onClick={rewindToPrevClip} disabled={sceneSlots.length === 0} title="Previous scene" aria-label="Previous scene">
                  <SkipBack className="w-5 h-5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-white/90 hover:text-[#FF6B35] hover:bg-white/10" onClick={seekBack5} disabled={!voiceoverUrl || sceneSlots.length === 0} title="Seek back 5s" aria-label="Seek back 5 seconds">
                  <Rewind className="w-5 h-5" />
                </Button>
                <Button type="button" size="sm" className="h-9 px-4 bg-[#FF6B35] hover:bg-[#FF7B45] text-white" onClick={playSequence} disabled={!voiceoverUrl || sceneSlots.length === 0} title="Play" aria-label="Play">
                  <Play className="w-4 h-4 mr-1.5" />
                  {playingSceneIndex !== null && !isPaused ? "Playing" : "Play"}
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-white/90 hover:text-[#FF6B35] hover:bg-white/10" onClick={pauseSequence} disabled={playingSceneIndex === null || isPaused} title="Pause" aria-label="Pause">
                  <Pause className="w-5 h-5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-white/90 hover:text-[#FF6B35] hover:bg-white/10" onClick={stopSequence} disabled={playingSceneIndex === null} title="Stop" aria-label="Stop">
                  <Square className="w-5 h-5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-white/90 hover:text-[#FF6B35] hover:bg-white/10" onClick={seekForward5} disabled={!voiceoverUrl || sceneSlots.length === 0} title="Seek forward 5s" aria-label="Seek forward 5 seconds">
                  <FastForward className="w-5 h-5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-white/90 hover:text-[#FF6B35] hover:bg-white/10" onClick={forwardToNextClip} disabled={sceneSlots.length === 0} title="Next scene" aria-label="Next scene">
                  <SkipForward className="w-5 h-5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-white/90 hover:text-[#FF6B35] hover:bg-white/10" onClick={toggleMasterMute} title={masterMuted ? "Unmute" : "Mute"} aria-label={masterMuted ? "Unmute" : "Mute"}>
                  {masterMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </Button>
              </div>
              </div>
            </div>

            {/* Empty state below the player, not inside canvas */}
            {sceneSlots.length === 0 && (
              <p className="text-sm text-muted-foreground text-center mt-4">Import from Video Guide to get scene slots and voiceover.</p>
            )}
            {sceneSlots.length > 0 && !voiceoverUrl && (
              <p className="text-sm text-muted-foreground text-center mt-4">Import from Video Guide to generate voiceover, then upload video or image per scene.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4" /> Timeline track</CardTitle>
            <p className="text-sm text-muted-foreground">One slot per scene. Upload video or image per scene (saved to Supabase). Empty scenes show background during playback.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button type="button" variant="outline" size="sm" onClick={() => setImportPopupOpen(true)}>
              <FileVideo className="w-4 h-4 mr-1" /> Import from Video Guide
            </Button>
            {sceneSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center rounded-lg border border-dashed">No scene slots yet. Import from Video Guide to create scene slots and generate voiceover.</p>
            ) : (
              <ul className="space-y-2">
                {sceneSlots.map((slot, i) => (
                  <li key={slot.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                    <Film className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
                    <span className="w-24 flex-shrink-0 text-sm font-medium">Scene {slot.sceneIndex}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{slot.startSec.toFixed(1)}s – {slot.endSec.toFixed(1)}s</span>
                    {slot.mediaUrl ? (
                      <>
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <div className="w-16 h-9 rounded overflow-hidden bg-muted flex-shrink-0">
                            {slot.mediaType === "video" ? (
                              <video src={slot.mediaUrl} className="w-full h-full object-cover" muted preLoad="metadata" />
                            ) : (
                              <img src={slot.mediaUrl} alt="" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground capitalize">{slot.mediaType ?? "media"}</span>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => toggleSlotMute(slot.id)} title={mutedSlotIds.includes(slot.id) ? "Unmute" : "Mute clip"}>
                          {mutedSlotIds.includes(slot.id) ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive" onClick={() => clearSceneMedia(slot.id)} aria-label="Remove media">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <label className="flex-1 flex items-center cursor-pointer">
                        <input
                          type="file"
                          accept={VIDEO_ACCEPT + "," + "image/*"}
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadSceneMedia(i, file);
                            e.target.value = "";
                          }}
                        />
                        <Button type="button" variant="outline" size="sm" asChild><span><Upload className="w-4 h-4 mr-1 inline" /> Upload</span></Button>
                      </label>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Mic className="w-4 h-4" /> Voiceover track</CardTitle>
            <p className="text-sm text-muted-foreground">Master clock for playback. Import from Video Guide to fetch or generate voiceover.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {voiceoverUrl ? (
              <>
                <audio ref={voiceoverPreviewRef} className="sr-only" preload="metadata" onEnded={() => setVoiceoverPreviewPlaying(false)} />
                <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <Music className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium truncate flex-1 min-w-0">voiceover.mp3</span>
                  <span className="text-xs font-mono text-muted-foreground tabular-nums flex-shrink-0">{formatTime(totalAudioSec)}</span>
                  <div className="flex-1 min-w-0 h-6 flex items-center px-2 rounded bg-muted/50">
                    <div className="h-1.5 flex-1 rounded-full bg-white/20 overflow-hidden">
                      <div className="h-full bg-[#FF6B35]/80 rounded-full transition-[width] duration-150" style={{ width: `${totalAudioSec > 0 ? (playbackTimeSec / totalAudioSec) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={previewVoiceover} className="flex-shrink-0">
                    <Play className="w-4 h-4 mr-1" />
                    {voiceoverPreviewPlaying ? "Stop" : "Preview"}
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive" onClick={removeVoiceover} aria-label="Remove voiceover">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setImportPopupOpen(true)}>
                  <FileVideo className="w-4 h-4 mr-1" /> Import from Video Guide
                </Button>
                {effectiveScriptId && (
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={`/dashboard/digital-products/video-guide?libraryScriptId=${effectiveScriptId}`}>Generate Voiceover</a>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Type className="w-4 h-4" /> Captions track</CardTitle>
            <p className="text-sm text-muted-foreground">Auto-filled from linked Video Guide. Editable start/end and text.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button type="button" variant="outline" size="sm" onClick={addCaption}><Plus className="w-4 h-4 mr-1" /> Add caption</Button>
            {captions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center rounded-lg border border-dashed">No captions. Link a Video Guide (URL) or add manually.</p>
            ) : (
              <ul className="space-y-3">
                {captions.map((cap) => (
                  <li key={cap.id} className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 text-card-foreground">
                    <Input placeholder="Caption text" value={cap.text} onChange={(e) => updateCaption(cap.id, { text: e.target.value })} className="flex-1 min-w-[120px]" />
                    <div className="flex items-center gap-1">
                      <Label className="text-xs whitespace-nowrap">Start</Label>
                      <Input type="number" min={0} step={0.5} value={cap.startTime} onChange={(e) => updateCaption(cap.id, { startTime: Number(e.target.value) || 0 })} className="w-16" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Label className="text-xs whitespace-nowrap">End</Label>
                      <Input type="number" min={0} step={0.5} value={cap.endTime} onChange={(e) => updateCaption(cap.id, { endTime: Number(e.target.value) || 0 })} className="w-16" />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeCaption(cap.id)} aria-label="Remove caption">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <aside className="w-full lg:w-72 flex-shrink-0 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Design</CardTitle>
            <p className="text-sm text-muted-foreground">Caption font, size, colors. Background for preview.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Text overlay font</Label>
              <Select value={design.font} onValueChange={(v) => setDesign((d) => ({ ...d, font: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{FONT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Text size</Label>
              <Select value={design.fontSize} onValueChange={(v) => setDesign((d) => ({ ...d, fontSize: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{FONT_SIZE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Text color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={design.textColor} onChange={(e) => setDesign((d) => ({ ...d, textColor: e.target.value }))} className="h-9 w-12 rounded border border-input cursor-pointer bg-transparent" aria-label="Text color" />
                <Input value={design.textColor} onChange={(e) => setDesign((d) => ({ ...d, textColor: e.target.value }))} className="flex-1 font-mono text-sm" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Background color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={design.backgroundColor} onChange={(e) => setDesign((d) => ({ ...d, backgroundColor: e.target.value }))} className="h-9 w-12 rounded border border-input cursor-pointer bg-transparent" aria-label="Background color" />
                <Input value={design.backgroundColor} onChange={(e) => setDesign((d) => ({ ...d, backgroundColor: e.target.value }))} className="flex-1 font-mono text-sm" />
              </div>
            </div>
            {aspectRatio === "9:16" && (captions.length > 0 || sceneSlots.length > 0) && (
              <p className="text-xs text-amber-600 dark:text-amber-400 pt-1 border-t mt-1">Keep text within the safe zone for 9:16.</p>
            )}
          </CardContent>
        </Card>
      </aside>

      <Dialog open={importPopupOpen} onOpenChange={setImportPopupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import from Video Guide</DialogTitle>
            <DialogDescription>Generate voiceover and add to timeline. Captions will be filled from scene breakdown.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[280px] overflow-y-auto space-y-1 pr-2">
            {guidesLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading guides…</div>
            ) : videoGuides.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No video guides yet. Create one from Digital Products → Scripts → Create Video Guide.</p>
            ) : (
              videoGuides.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={importingGuideId !== null}
                  onClick={() => handleSelectGuide(item)}
                  className={cn("w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50", importingGuideId === item.id && "bg-accent")}
                >
                  <FileVideo className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm font-medium">{item.title}</span>
                  {importingGuideId === item.id && <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin text-muted-foreground" />}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
