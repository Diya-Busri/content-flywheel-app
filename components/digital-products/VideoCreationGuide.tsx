"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { mapScriptToSceneOverlays } from "@/lib/video-guide-scene-overlays";
import { animateAiStorySceneFromImage } from "@/lib/ai-story-animate-client";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Film,
  ImagePlus,
  Loader2,
  Lock,
  Music,
  Type,
  Upload,
  Volume2,
  Mic,
  Lightbulb,
  X,
  Share2,
  Play,
  RefreshCw,
  Video,
  ExternalLink,
  Trash2,
  Pause,
  Sparkles,
  Check,
  Settings2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cleanProductTitle, replaceProductTitleInText } from "@/lib/product-title";
import {
  getVideoPrefill,
  setVideoPrefill,
  getTimelineUrl,
  type VideoPrefill,
  type TimelineScenePrefill,
} from "@/lib/video-prefill";
import { AiStorySceneVoiceover } from "@/components/ai-story/AiStorySceneVoiceover";
import { AiStoryAnimateSceneBlock } from "@/components/ai-story/AiStoryAnimateSceneBlock";
import { NoVideoCreditsError } from "@/lib/ai-story-animate-client";

/** Social Media Kit shape (matches API response). */
export type SocialMediaKit = {
  tiktok: {
    titleVariations: string[];
    descriptionVariations: string[];
    hashtags: string[];
    bestPostingTimes: string;
    suggestedSounds: string[];
  };
  instagramReels: {
    captionVariations: string[];
    hashtags: string[];
    storySequenceSuggestions: string[];
    bestPostingTimes: string;
  };
  youtubeShorts: {
    titleVariations: string[];
    descriptionWithKeywords: string;
    tagsList: string[];
    thumbnailTextSuggestions: string[];
  };
  general: {
    crossPostingSchedule: string;
    engagementPrompts: string[];
    pinCommentSuggestions: string[];
  };
};

const SOCIAL_KIT_STORAGE_KEY = "videoCreationGuideSocialKit";

/** Matches Template Studio AI Story → Video Timeline prefill (`TIMELINE_SCENE_DURATION`). */
const VIDEO_GUIDE_TIMELINE_SCENE_SEC = 8;

/** Same URL resolution as Template Studio `/api/generate-image` handling. */
function resolveGenerateImageApiUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as { url?: unknown; imageUrl?: unknown; data?: unknown };
  const rawFromUrl = typeof d.url === "string" ? d.url.trim() : "";
  const rawFromImageUrl = typeof d.imageUrl === "string" ? d.imageUrl.trim() : "";
  const arr = d.data;
  const first = Array.isArray(arr) && arr[0] && typeof arr[0] === "object" && arr[0] !== null ? (arr[0] as { url?: unknown }) : null;
  const rawFromData = typeof first?.url === "string" ? first.url.trim() : "";
  const url = rawFromUrl || rawFromImageUrl || rawFromData;
  if (url && (url.startsWith("data:image/") || url.startsWith("https://") || url.startsWith("http://"))) return url;
  return null;
}

function mergeTemplateStudioTimelineScene(
  existing: VideoPrefill | null,
  slot: TimelineScenePrefill,
  defaultTitle: string
): VideoPrefill {
  const prev =
    existing?.source === "template-studio" && Array.isArray(existing.timelineScenes) ? [...existing.timelineScenes] : [];
  const sn = slot.scene_number ?? 1;
  const idx = prev.findIndex((s) => s.scene_number === sn);
  const next = idx >= 0 ? prev.map((s, j) => (j === idx ? { ...s, ...slot } : s)) : [...prev, slot];
  next.sort((a, b) => (a.scene_number ?? 0) - (b.scene_number ?? 0));
  return {
    ...(existing ?? {}),
    source: "template-studio",
    title: existing?.title?.trim() ? existing.title : defaultTitle,
    timelineScenes: next,
  };
}

type PromptPlatform = "midjourney" | "grok" | "chatgpt" | "kling" | "runway" | "pika";

/**
 * Returns the prompt formatted for the selected AI tool. Used by Copy AI Prompt so the
 * dropdown selection actually changes what gets copied.
 */
function getFormattedPrompt(
  basePrompt: string,
  tool: PromptPlatform,
  sceneDuration: number,
  camera: string
): string {
  const base = basePrompt.trim();
  const durationSec = Math.max(1, Math.round(sceneDuration));
  const cameraVal = camera.trim() || "medium shot";

  switch (tool) {
    case "midjourney":
      return `${base} --ar 9:16 --v 6 --style raw --q 2`;

    case "grok":
      return `${base}\n\nAspect ratio: 9:16\nStyle: photorealistic\nQuality: ultra detailed`;

    case "chatgpt":
      return `Generate a photorealistic vertical image (9:16 aspect ratio): ${base}`;

    case "kling":
      return `${base}\n\nFormat: vertical 9:16\nDuration: ${durationSec} seconds\nMotion: subtle slow push in\nCamera: ${cameraVal}`;

    case "runway":
      return `${base}\nMotion amount: low\nCamera movement: ${cameraVal} slow\nDuration: ${durationSec} seconds\nAspect ratio: 9:16`;

    case "pika":
      return `${base} | camera: ${cameraVal} | motion: 1 | aspect ratio: 9:16 | duration: ${durationSec}s`;

    default:
      return base;
  }
}

import {
  ELEVENLABS_VOICES,
  VOICE_PREVIEW_TEXT,
  getDefaultVoiceId,
  setDefaultVoiceId,
} from "@/lib/elevenlabs-voices";

/** Audio element that respects playback speed. */
function AudioWithSpeed({ src, speed, className, ...props }: { src: string; speed: number; className?: string } & React.AudioHTMLAttributes<HTMLAudioElement>) {
  const ref = useCallback(
    (el: HTMLAudioElement | null) => {
      if (el) el.playbackRate = speed;
    },
    [speed]
  );
  return <audio ref={ref} src={src} className={className} {...props} />;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Parse scene timing string to start/end seconds. Supports "0-2s", "2-5s" and "0:00-0:02" style. */
function parseSceneTiming(t: string): { startSec: number; endSec: number } {
  const s = String(t).trim();
  const simple = s.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*s?$/i);
  if (simple) return { startSec: parseFloat(simple[1]), endSec: parseFloat(simple[2]) };
  const colon = s.match(/^(\d+):(\d{2}(?:\.\d+)?)\s*[-–]\s*(\d+):(\d{2}(?:\.\d+)?)\s*$/);
  if (colon) {
    const startSec = parseInt(colon[1], 10) * 60 + parseFloat(colon[2]);
    const endSec = parseInt(colon[3], 10) * 60 + parseFloat(colon[4]);
    return { startSec, endSec };
  }
  return { startSec: 0, endSec: 0 };
}

/**
 * Maps full script text + scenes to one overlay exactText per scene (scene 1 = hook, 2..n-1 = body sentences, last = CTA).
 * Exported for backward compatibility; prefer mapScriptToSceneOverlays from @/lib/video-guide-scene-overlays when you have hook/body/cta.
 */
export function getSceneChunksForScript(
  fullScriptText: string,
  scenes: Array<{ timing?: string }>
): string[] {
  const parts = fullScriptText.trim().split(/\n\n+/);
  const hook = parts[0]?.trim() ?? "";
  const cta = parts.length > 1 ? (parts[parts.length - 1]?.trim() ?? "") : "";
  const body = parts.length > 2 ? parts.slice(1, -1).join("\n\n").trim() : (parts.length === 2 ? parts[1]?.trim() ?? "" : "");
  return mapScriptToSceneOverlays({ hook, body, cta }, scenes.length);
}

/** Returns duration in seconds when the audio at src has loaded metadata. */
function useAudioDuration(src: string | null): number | null {
  const [duration, setDuration] = useState<number | null>(null);
  useEffect(() => {
    if (!src) {
      setDuration(null);
      return;
    }
    const audio = new Audio(src);
    const onLoaded = () => setDuration(audio.duration);
    audio.addEventListener("loadedmetadata", onLoaded);
    if (audio.readyState >= 1) onLoaded();
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.src = "";
    };
  }, [src]);
  return duration;
}

type TextOverlayObj = { exactText?: string; fontStyle?: string; size?: string; position?: string; color?: string; animation?: string; timingNote?: string };

function parseSceneOverlayObjs(rawOverlay: unknown): TextOverlayObj[] {
  if (rawOverlay == null) return [];
  if (typeof rawOverlay === "string") return [{ exactText: rawOverlay }];
  if (Array.isArray(rawOverlay)) {
    return rawOverlay.map((o) =>
      typeof o === "object" && o && "exactText" in o ? (o as TextOverlayObj) : { exactText: String(o) }
    );
  }
  if (typeof rawOverlay === "object" && rawOverlay && "exactText" in (rawOverlay as object)) {
    return [rawOverlay as TextOverlayObj];
  }
  return [];
}

type VisualDirection = {
  aiPrompt?: string;
  cameraAngle?: string;
  lightingMood?: string;
  colorPalette?: string;
  mediaType?: string;
  // Dark Infographic fields
  slideType?: "funnel" | "vs_comparison" | "steps" | "stat_callout" | "text_hook";
  slideTitle?: string;
  slidePoints?: string[];
  highlightWord?: string;
  textHook?: string;
  /** Rendered Mermaid diagram PNG URL (generated server-side, stored in Supabase) */
  diagramUrl?: string;
};

export type VideoGuideData = {
  script: { hook: string; body: string; cta: string };
  scenePrompts: Array<{ scene: string; timing: string; prompt: string }>;
  productName?: string;
  niche?: string;
  productDescription?: string;
  overview?: string;
  scenes?: Array<{
    scene: string;
    timing: string;
    visualDescription?: string;
    prompt?: string;
    visualDirection?: VisualDirection;
    textOverlay?: string | TextOverlayObj | TextOverlayObj[];
    transition?: { toNextScene?: string; effects?: string; pacing?: string };
    audio?: { mood?: string };
    format?: { aspect_ratio?: string; orientation?: string; resolution?: string };
  }>;
  editingSteps?: Record<string, string[]>;
  subtitleRecs?: { style?: string; font?: string; position?: string; animation?: string };
  musicRecs?: { mood?: string; sources?: string[]; volume?: string };
  exportSettings?: { resolution?: string; fps?: number; format?: string; fileSize?: string; aspectRatio?: string };
  videoFormat?: { aspectRatio: string; orientation: string; resolution: string };
  platformTips?: string[];
  /** Single full-script voiceover URL (saved to Supabase). */
  timelineVoiceoverUrl?: string;
  /** Duration in seconds of the full-script voiceover (saved with URL for timeline). */
  timelineVoiceoverDuration?: number;
  /** Per-scene voiceover URLs (saved to Supabase), ordered by scene index. */
  timelineSceneVoiceoverUrls?: string[];
  /** Set when user has used Video Timeline (saved scene slots). Enables Social Media Kit without proof upload. */
  timelineSceneSlots?: unknown[];
  storytellingFramework?: string;
  frameworkRationale?: string;
  engagementTriggers?: string[];
  /** Video style chosen by the user on the VideosFlow page. */
  videoStyle?: string;
};

export type ScriptForGuide = { id: string; title: string; length: number; hook: string; body: string; cta: string };

type Props = {
  guide: VideoGuideData;
  scriptTitle?: string;
  /** Voice ID from the video customization page; used as initial selection for voiceover. */
  preferredVoiceId?: string;
  /** All scripts for this product (enables left/right navigation and angle name). */
  scripts?: ScriptForGuide[];
  /** Product ID for Regenerate Script API. */
  productId?: string;
  /** Library script id when guide was loaded from My Library; passed to timeline so captions can auto-populate. */
  libraryScriptId?: string;
  /** When true, guide came from Content Studio (YouTube); affects breadcrumb, back link, and title. */
  isYouTubeMode?: boolean;
  /** Override back link (e.g. to Content Studio scripts when isYouTubeMode). */
  backUrl?: string;
  /** Channel name for YouTube context subtitle. */
  channelName?: string;
  channelId?: string;
  scriptId?: string;
  /** Called when user provides product name (e.g. from the "What is your product called?" prompt). Parent should update guide.productName and persist if libraryScriptId. */
  onProductNameChange?: (productName: string) => void;
  /** Called after full script is regenerated so parent can update guide.script and optionally guide.scenes (with textOverlay re-mapped). */
  onScriptRegenerated?: (script: { hook: string; body: string; cta: string }, updatedScenes?: Array<{ scene: string; timing: string; textOverlay?: TextOverlayObj | TextOverlayObj[]; [key: string]: unknown }>) => void;
  /** Called when user manually edits the script (hook/body/cta). Parent should update guide and persist to library if libraryScriptId. */
  onScriptEdited?: (script: { hook: string; body: string; cta: string }) => void;
  /** Called after scene voiceover URLs are saved to the library so parent can keep guide in sync (avoids losing them on refetch/refresh). */
  onSceneVoiceoverUrlsSaved?: (urls: string[]) => void;
  /** Called after scenes (visual + text overlay prompts) are regenerated. Parent should update guide and persist to library if libraryScriptId. */
  onScenesRegenerated?: (payload: {
    scenes: VideoGuideData["scenes"];
    scenePrompts: VideoGuideData["scenePrompts"];
    storytellingFramework?: string;
    frameworkRationale?: string;
    engagementTriggers?: string[];
  }) => void;
};

export default function VideoCreationGuide({ guide, scriptTitle, preferredVoiceId, scripts: scriptsProp, productId, libraryScriptId, isYouTubeMode, backUrl, channelName, onProductNameChange, onScriptRegenerated, onScriptEdited, onSceneVoiceoverUrlsSaved, onScenesRegenerated }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [scripts, setScripts] = useState<ScriptForGuide[]>(() => (Array.isArray(scriptsProp) && scriptsProp.length > 0 ? scriptsProp : []));
  // 0-based index for the 4 angles (Story, Problem/Solution, Social Proof/Results, Curiosity/Controversy)
  const [currentAngleIndex, setCurrentAngleIndex] = useState(0);

  const angles = [
    { name: "Story Angle" },
    { name: "Problem/Solution Angle" },
    { name: "Social Proof/Results Angle" },
    { name: "Curiosity/Controversy Angle" },
  ];
  const [regeneratingScript, setRegeneratingScript] = useState(false);
  const [regeneratingFullScript, setRegeneratingFullScript] = useState(false);
  const [regeneratingScenes, setRegeneratingScenes] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [voiceId, setVoiceId] = useState<string>(() =>
    preferredVoiceId && preferredVoiceId.trim()
      ? preferredVoiceId.trim()
      : typeof window !== "undefined"
        ? getDefaultVoiceId()
        : ELEVENLABS_VOICES[0].voiceId
  );

  const [showConfig, setShowConfig] = useState(true);
  const [config, setConfig] = useState(() => {
    const initialVoice =
      preferredVoiceId && preferredVoiceId.trim()
        ? preferredVoiceId.trim()
        : typeof window !== "undefined"
          ? getDefaultVoiceId()
          : ELEVENLABS_VOICES[0].voiceId;
    return {
      duration: 10,
      sceneCount: 8,
      selectedVoice: initialVoice,
      voiceoverMode: "scene-by-scene" as "full" | "scene-by-scene",
    };
  });

  useEffect(() => {
    if (Array.isArray(scriptsProp) && scriptsProp.length > 0) {
      setScripts(scriptsProp);
      setCurrentAngleIndex((i) => (i >= scriptsProp.length ? 0 : i));
    }
  }, [scriptsProp?.length]);

  useEffect(() => {
    if (guide.scenes?.length != null && guide.scenes.length >= 4 && guide.scenes.length <= 20) {
      setConfig((c) => ({ ...c, sceneCount: guide.scenes!.length }));
    }
  }, [guide.scenes?.length]);

  // Pre-populate scene images from injected image_url (set by POD promo video flow)
  useEffect(() => {
    if (!Array.isArray(guide.scenes)) return;
    const initial: Record<number, string> = {};
    guide.scenes.forEach((s, i) => {
      const url = (s as Record<string, unknown>).image_url;
      if (typeof url === "string" && url.trim()) initial[i] = url.trim();
    });
    if (Object.keys(initial).length > 0) setGuideSceneImageUrls(initial);
  // Run once when guide scenes first arrive
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide.scenes?.length]);

  useEffect(() => {
    if (showConfig && ELEVENLABS_VOICES.some((v) => v.voiceId === voiceId)) {
      setConfig((c) => (c.selectedVoice === voiceId ? c : { ...c, selectedVoice: voiceId }));
    }
  }, [showConfig, voiceId]);

  const hasMultipleScripts = scripts.length > 1;
  const effectiveScript = scripts.length > 0 && currentAngleIndex >= 0 && currentAngleIndex < scripts.length
    ? { hook: scripts[currentAngleIndex].hook, body: scripts[currentAngleIndex].body, cta: scripts[currentAngleIndex].cta }
    : guide.script;
  const effectiveScriptTitle = scripts.length > 0 && currentAngleIndex >= 0 && currentAngleIndex < scripts.length
    ? scripts[currentAngleIndex].title
    : scriptTitle;
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.75);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // ── Voice Settings step ──────────────────────────────────────────────────
  type SpeakingStyle = "Professional" | "Friendly" | "Energetic" | "Calm" | "Storytelling";
  const SPEAKING_STYLES: { label: SpeakingStyle; stability: number; similarity: number; description: string }[] = [
    { label: "Professional", stability: 0.5,  similarity: 0.75, description: "Clear & authoritative" },
    { label: "Friendly",     stability: 0.4,  similarity: 0.70, description: "Warm & approachable" },
    { label: "Energetic",    stability: 0.3,  similarity: 0.60, description: "Upbeat & punchy" },
    { label: "Calm",         stability: 0.70, similarity: 0.85, description: "Slow & reassuring" },
    { label: "Storytelling", stability: 0.45, similarity: 0.80, description: "Engaging narrative" },
  ];
  const [speakingStyle, setSpeakingStyle] = useState<SpeakingStyle>("Professional");
  const [rememberVoiceDefault, setRememberVoiceDefault] = useState(true);
  /** True once user has explicitly chosen a voice (or already had one saved). */
  const [voiceSettingsConfirmed, setVoiceSettingsConfirmed] = useState<boolean>(
    () => !!(preferredVoiceId && preferredVoiceId.trim())
  );
  const [fullVoiceoverUrl, setFullVoiceoverUrl] = useState<string | null>(() => guide.timelineVoiceoverUrl?.trim() || null);
  const [perSceneUrls, setPerSceneUrls] = useState<(string | null)[]>(() => {
    const urls = guide.timelineSceneVoiceoverUrls;
    if (!Array.isArray(urls) || urls.length === 0) return [];
    return urls.map((u) => (typeof u === "string" && u.trim() ? u.trim() : null));
  });
  const [fullVoiceoverDuration, setFullVoiceoverDuration] = useState<number | null>(
    () => (typeof guide.timelineVoiceoverDuration === "number" && guide.timelineVoiceoverDuration > 0 ? guide.timelineVoiceoverDuration : null)
  );
  const [perSceneDurations, setPerSceneDurations] = useState<number[]>([]);
  const [generatingFull, setGeneratingFull] = useState(false);
  const [generatingPerScene, setGeneratingPerScene] = useState(false);
  const [generatingSceneIndex, setGeneratingSceneIndex] = useState<number | null>(null);
  /** URL of the audio currently playing for inline preview (full or scene). */
  const [playingPreviewUrl, setPlayingPreviewUrl] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const autoPlayAudioRef = useRef<HTMLAudioElement | null>(null);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [characterRefPreviewUrl, setCharacterRefPreviewUrl] = useState<string | null>(null);
  const [characterRefPublicUrl, setCharacterRefPublicUrl] = useState<string | null>(null);
  const [copyFormatByScene, setCopyFormatByScene] = useState<Record<number, PromptPlatform>>({});
  /** Per-scene: "still" = Still Image, "video" = Video Clip (adds motion instructions). */
  const [mediaTypeByScene, setMediaTypeByScene] = useState<Record<number, "still" | "video">>({});
  /** Refs to rendered dark-infographic slide DOM elements — used for html2canvas export + MP4 compile. */
  const darkSlideRefs = useRef<(HTMLDivElement | null)[]>([]);
  /**
   * Randomly shuffled graphic types for Dark Infographic slides.
   * useState initialiser runs once on mount → fresh random order every
   * time the guide loads (new video = new shuffle), stable while on-page,
   * and guaranteed no repeats across all 7 designs within a single video.
   */
  const [darkInfographicGraphicOrder] = useState<string[]>(() => {
    const types = ["bolt", "bars", "bullseye", "chevrons", "star", "diamond", "rings"];
    for (let j = types.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [types[j], types[k]] = [types[k], types[j]];
    }
    return types;
  });
  /** DALL·E scene stills for Video Timeline (same flow as Template Studio AI Story). */
  const [guideSceneImageUrls, setGuideSceneImageUrls] = useState<Record<number, string>>({});
  const [guideSceneVideoUrls, setGuideSceneVideoUrls] = useState<Record<number, string>>({});
  /** `/api/ai-coach/voice-over` URLs (same as AI Story scene cards); falls back to per-scene voice tab URLs for playback/timeline. */
  const [guideCoachVoiceoverUrls, setGuideCoachVoiceoverUrls] = useState<Record<number, string>>({});
  const [guideSceneImageLoadingIndex, setGuideSceneImageLoadingIndex] = useState<number | null>(null);
  const [guideBulkImagesLoading, setGuideBulkImagesLoading] = useState(false);
  /** Server-side FFmpeg compile (whole MP4) in progress. */
  const [guideFullVideoLoading, setGuideFullVideoLoading] = useState(false);
  /** URL of the last successfully compiled MP4 — persists on the card so users don't miss it. */
  const [lastCompiledVideoUrl, setLastCompiledVideoUrl] = useState<string | null>(null);
  /** Tracks whether the video link was just copied to clipboard (shows "Copied!" briefly). */
  const [copiedVideoLink, setCopiedVideoLink] = useState(false);
  /** Tracks whether the TikTok caption was just copied. */
  const [copiedCaption, setCopiedCaption] = useState(false);
  /** Whether the "Post on TikTok" checklist is expanded. */
  const [showTikTokChecklist, setShowTikTokChecklist] = useState(false);
  /** Interactive TikTok checklist item states. */
  const [tiktokCheckItems, setTiktokCheckItems] = useState<boolean[]>([false, false, false, false, false, false, false]);
  /** Track which scene "Animate Scene" jobs are currently running so we can show export CTA. */
  const [animatingByScene, setAnimatingByScene] = useState<Record<number, boolean>>({});
  /** Product thumbnail for compile intro scene (bookMockup > coverThumbnail > thumbnail). */
  const [productThumbnailUrl, setProductThumbnailUrl] = useState<string | null>(null);
  /** Auto-generated social captions shown after MP4 export. */
  const [videoSocialCaptions, setVideoSocialCaptions] = useState<{ tiktok_title: string; tiktok: string; instagram_title: string; instagram: string; youtube_title: string; twitter: string } | null>(null);
  const [videoSocialCaptionsLoading, setVideoSocialCaptionsLoading] = useState(false);
  const [copiedSocialCaption, setCopiedSocialCaption] = useState<string | null>(null);
  useEffect(() => {
    if (!productId) return;
    fetch(`/api/products/${encodeURIComponent(productId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((p: { marketingAssets?: { bookMockupUrl?: string | null; coverThumbnailUrl?: string | null; thumbnailUrl?: string | null } | null } | null) => {
        const ma = p?.marketingAssets;
        const url = ma?.bookMockupUrl?.trim() || ma?.coverThumbnailUrl?.trim() || ma?.thumbnailUrl?.trim() || null;
        if (url) setProductThumbnailUrl(url);
      })
      .catch(() => {});
  }, [productId]);

  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/video-credits/balance")
      .then((r) => r.json())
      .then((d: { balance?: number }) => setCreditBalance(d.balance ?? 0))
      .catch(() => setCreditBalance(0));
  }, []);
  /** "Generate Everything" one-tap flow: images → voiceovers → compile MP4 */
  const [autoGeneratingAll, setAutoGeneratingAll] = useState(false);
  const [autoGeneratePhase, setAutoGeneratePhase] = useState<string | null>(null);
  /** When true, we auto-export once all animated scene videos + voiceovers are ready. */
  const [autoExportWhenAnimationsReady, setAutoExportWhenAnimationsReady] = useState(false);
  const autoExportStartedRef = useRef(false);
  const [activeTab, setActiveTab] = useState("script");
  const [socialKitProofFile, setSocialKitProofFile] = useState<File | null>(null);
  const [socialKit, setSocialKit] = useState<SocialMediaKit | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(SOCIAL_KIT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SocialMediaKit;
        if (parsed?.tiktok && parsed?.instagramReels && parsed?.youtubeShorts && parsed?.general) return parsed;
      }
    } catch {}
    return null;
  });
  const [socialKitLoading, setSocialKitLoading] = useState(false);
  /** User-entered product name when guide has none (shown in "What is your product called?" block). */
  const [userProductName, setUserProductName] = useState("");
  const [productNameInput, setProductNameInput] = useState("");
  /** User's products for the "Select a product" dropdown. */
  const [userProducts, setUserProducts] = useState<Array<{ id: string; title: string }>>([]);
  /** Local edits to script (hook/body/cta) before blur/save. */
  const [editedScript, setEditedScript] = useState<{ hook: string; body: string; cta: string } | null>(null);

  const effectiveProductName = (guide.productName?.trim() || "") || (userProductName?.trim() || "");
  const productNiche = String(guide.niche || guide.productDescription || "").trim();
  const PLACEHOLDER_NAMES = ["your product", "the product", "untitled", "product", ""];
  const isPlaceholderName = PLACEHOLDER_NAMES.includes(effectiveProductName.toLowerCase().trim());
  const hasProductName = effectiveProductName.length > 0 && !isPlaceholderName;
  const rawProductTitle = effectiveProductName || undefined;
  const stripMarkdown = (s: string) =>
    String(s ?? "")
      .replace(/^#+\s*/gm, "")
      .replace(/\*\*/g, "");
  /** Remove all "Visual prompt" / "vidual prompt" from script text (lines and bracketed inline). */
  const stripVisualPromptLines = (text: string) => {
    let out = text
      .replace(/\[\s*(?:visual|vidual)\s+prompt\s*:[^\]]*\]/gi, "")
      .split("\n")
      .filter((line) => !/^\s*(?:visual|vidual)\s+prompt\s*:/i.test(line.trim()))
      .join("\n");
    out = out.replace(/\n{3,}/g, "\n\n").replace(/  +/g, " ").trim();
    return out;
  };
  const replacePlaceholderInScript = (t: string) => {
    const s = stripMarkdown(String(t ?? ""));
    const noVisualPrompts = stripVisualPromptLines(s);
    const replacement = hasProductName ? (cleanProductTitle(effectiveProductName) || effectiveProductName) : "[Your product name]";
    return noVisualPrompts.replace(/\bYour product\b/gi, replacement);
  };
  const displayScript = {
    hook: replacePlaceholderInScript(effectiveScript.hook),
    body: replacePlaceholderInScript(effectiveScript.body),
    cta: replacePlaceholderInScript(effectiveScript.cta),
  };
  const currentScriptForDisplay = editedScript ?? displayScript;

  const handleScriptBlur = useCallback(() => {
    if (!editedScript) return;
    onScriptEdited?.(editedScript);
    if (scripts.length > 0 && currentAngleIndex >= 0 && currentAngleIndex < scripts.length) {
      setScripts((prev) => prev.map((s, i) => (i === currentAngleIndex ? { ...s, hook: editedScript.hook, body: editedScript.body, cta: editedScript.cta } : s)));
    }
    setEditedScript(null);
  }, [editedScript, onScriptEdited, scripts.length, currentAngleIndex]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDefaultVoiceId(voiceId);
  }, [voiceId]);

  useEffect(() => {
    if (!hasProductName) {
      fetch("/api/library?type=products", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : []))
        .then((items: Array<{ type?: string; id: string; title: string }>) => {
          const products = (items ?? []).filter((i) => i.type === "product").map((p) => ({ id: p.id, title: p.title || "Untitled" }));
          setUserProducts(products);
        })
        .catch(() => setUserProducts([]));
    }
  }, [hasProductName]);

  useEffect(() => {
    if (!fullVoiceoverUrl) {
      setFullVoiceoverDuration(null);
      return;
    }
    const audio = new Audio(fullVoiceoverUrl);
    const onLoaded = () => setFullVoiceoverDuration(audio.duration);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.load();
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.src = "";
    };
  }, [fullVoiceoverUrl]);

  useEffect(() => {
    if (perSceneUrls.length === 0) {
      setPerSceneDurations([]);
      return;
    }
    const durations: number[] = [];
    let cancelled = false;
    perSceneUrls.forEach((url, i) => {
      if (!url) {
        durations[i] = 0;
        return;
      }
      const audio = new Audio(url);
      audio.addEventListener("loadedmetadata", () => {
        if (!cancelled) {
          setPerSceneDurations((prev) => {
            const next = [...prev];
            next[i] = audio.duration;
            return next;
          });
        }
      });
      audio.load();
    });
    return () => {
      cancelled = true;
    };
  }, [perSceneUrls.length, perSceneUrls.join(",")]);

  // Sync voiceover state from guide when loaded from server (e.g. page reload) so saved voiceovers show
  useEffect(() => {
    const url = guide.timelineVoiceoverUrl?.trim() || null;
    setFullVoiceoverUrl((prev) => (url ? (prev !== url ? url : prev) : (prev && !guide.timelineVoiceoverUrl?.trim() ? null : prev)));
    const dur = typeof guide.timelineVoiceoverDuration === "number" && guide.timelineVoiceoverDuration > 0 ? guide.timelineVoiceoverDuration : null;
    setFullVoiceoverDuration((prev) => (dur !== null ? dur : prev));
    const urls = guide.timelineSceneVoiceoverUrls;
    if (Array.isArray(urls)) {
      const next = urls.map((u) => (typeof u === "string" && u.trim() ? u.trim() : null));
      setPerSceneUrls((prev) => (prev.length !== next.length || prev.some((u, i) => u !== next[i]) ? next : prev));
    }
  }, [guide.timelineVoiceoverUrl, guide.timelineVoiceoverDuration, guide.timelineSceneVoiceoverUrls]);

  const script = effectiveScript;
  const scenes = guide.scenes ?? guide.scenePrompts.map((s, i) => ({
    scene: s.scene,
    timing: s.timing,
    prompt: s.prompt,
    visualDescription: s.prompt,
  }));
  const editingSteps = guide.editingSteps ?? { CapCut: [] };
  const subtitles = guide.subtitleRecs ?? {};
  const music = guide.musicRecs ?? {};
  const exportSettings = guide.exportSettings ?? {};
  const platformTips = guide.platformTips ?? [];

  const copyToClipboard = useCallback(
    (text: string, label?: string) => {
      navigator.clipboard.writeText(text).then(
        () => {
          toast({ title: "Copied", description: label ? `${label} copied` : "Copied" });
        },
        () => toast({ title: "Copy failed", variant: "destructive" })
      );
    },
    [toast]
  );

  const getSceneFullPrompt = useCallback((s: (typeof scenes)[number]): string => {
    const vd = (s as { visualDirection?: { aiPrompt?: string } }).visualDirection;
    return vd?.aiPrompt ?? (s as { prompt?: string }).prompt ?? (s as { visualDescription?: string }).visualDescription ?? s.scene;
  }, []);

  const wrapVideoGuideImagePromptForDalle = useCallback((original: string): string => {
    const o = original.trim();
    const maxLen = 4000;
    const CHARACTER_CONSISTENCY_PREFIX =
      "Same woman: early 20s, brown hair, medium skin tone, wearing a beige knit sweater. Consistent appearance across all scenes.";
    const SINGLE_SCENE_ONLY = "Single scene only. No split screen. No collage. No before and after compositions.";
    const productNameForPrompt = effectiveProductName?.trim() || "Product";
    const nicheForPrompt = productNiche?.trim();
    const productRelevance = nicheForPrompt
      ? `Product relevance: show "${productNameForPrompt}" for the "${nicheForPrompt}" audience. Make the scene visually reflect the product (e.g. laptop/phone showing a course/lesson/dashboard-style interface if it's digital training), with clear UI structure but no readable text.`
      : `Product relevance: show "${productNameForPrompt}" in a visually relevant on-screen interface (e.g. laptop/phone UI elements), with clear structure but no readable text.`;

    const prefix = `${CHARACTER_CONSISTENCY_PREFIX} ${SINGLE_SCENE_ONLY} ${productRelevance} `;
    if (prefix.length >= maxLen) return prefix.slice(0, maxLen);
    const budget = Math.max(0, maxLen - prefix.length);
    const trimmed = budget > 0 ? o.slice(0, budget) : "";
    return `${prefix}${trimmed}`;
  }, [effectiveProductName, productNiche]);

  const copyAllPrompts = useCallback(() => {
    const all = scenes.map((s, i) => `Scene ${i + 1} (${s.timing}):\n${getSceneFullPrompt(s)}`).join("\n\n");
    copyToClipboard(all, "All AI prompts");
  }, [scenes, getSceneFullPrompt, copyToClipboard]);

  const copyAllPromptsMidjourney = useCallback(() => {
    const lines = scenes.map((s, i) => {
      const raw = getSceneFullPrompt(s);
      const t = parseSceneTiming(s.timing ?? "0-0");
      const sceneDuration = Math.max(0, t.endSec - t.startSec) || 3;
      const vd = (s as { visualDirection?: { cameraAngle?: string } }).visualDirection;
      const camera = vd?.cameraAngle?.trim() || "medium shot";
      return getFormattedPrompt(raw, "midjourney", sceneDuration, camera);
    });
    copyToClipboard(lines.join("\n\n---\n\n"), "All prompts (Midjourney)");
  }, [scenes, getSceneFullPrompt, copyToClipboard]);

  const handleCharacterRefFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (characterRefPreviewUrl) URL.revokeObjectURL(characterRefPreviewUrl);
    if (!file) {
      setCharacterRefPreviewUrl(null);
      return;
    }
    if (!file.type.startsWith("image/")) return;
    setCharacterRefPreviewUrl(URL.createObjectURL(file));
  }, [characterRefPreviewUrl]);

  const getCopyFormat = (sceneIndex: number): PromptPlatform =>
    copyFormatByScene[sceneIndex] ?? "midjourney";

  const getMediaType = (sceneIndex: number): "still" | "video" =>
    mediaTypeByScene[sceneIndex] ?? "still";

  const handleSocialKitUploadProof = useCallback(async () => {
    if (!socialKitProofFile) {
      toast({ title: "Select a file", description: "Upload a screenshot or video preview.", variant: "destructive" });
      return;
    }
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "video/mp4", "video/quicktime"];
    if (!allowedTypes.some((t) => socialKitProofFile.type.toLowerCase().includes(t))) {
      toast({ title: "Invalid file type", description: "Use .png, .jpg, .webp, .mp4, or .mov", variant: "destructive" });
      return;
    }
    setSocialKitLoading(true);
    try {
      const form = new FormData();
      form.append("file", socialKitProofFile);
      form.append("scriptHook", displayScript.hook);
      form.append("scriptBody", displayScript.body);
      form.append("scriptCta", displayScript.cta);
      form.append("productName", (effectiveProductName && cleanProductTitle(effectiveProductName)) || effectiveProductName || "Product");
      form.append("productDescription", (guide as { productDescription?: string }).productDescription ?? "");
      const res = await fetch("/api/video-guide/social-media-kit", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Upload failed");
      }
      const kit = (data as { kit?: SocialMediaKit }).kit;
      if (kit) {
        setSocialKit(kit);
        setSocialKitProofFile(null);
        try {
          sessionStorage.setItem(SOCIAL_KIT_STORAGE_KEY, JSON.stringify(kit));
        } catch (e) {
          console.warn("[video-guide] Failed to persist social kit to sessionStorage:", e);
        }
        toast({ title: "Social Media Kit ready", description: "Your kit has been generated." });
      }
    } catch (e) {
      toast({
        title: "Failed to unlock kit",
        description: e instanceof Error ? e.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSocialKitLoading(false);
    }
  }, [socialKitProofFile, script, guide, effectiveProductName, toast]);

  const hasTimelineUsage = Array.isArray(guide.timelineSceneSlots) && guide.timelineSceneSlots.length > 0;
  const isDarkInfographicStyle = guide.videoStyle === "dark_infographic";
  const handleSocialKitGenerateWithoutProof = useCallback(async () => {
    if (!libraryScriptId) return;
    setSocialKitLoading(true);
    try {
      const form = new FormData();
      form.append("libraryScriptId", libraryScriptId);
      form.append("scriptHook", displayScript.hook);
      form.append("scriptBody", displayScript.body);
      form.append("scriptCta", displayScript.cta);
      form.append("productName", (effectiveProductName && cleanProductTitle(effectiveProductName)) || effectiveProductName || "Product");
      form.append("productDescription", (guide as { productDescription?: string }).productDescription ?? "");
      const res = await fetch("/api/video-guide/social-media-kit", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Failed to generate kit");
      }
      const kit = (data as { kit?: SocialMediaKit }).kit;
      if (kit) {
        setSocialKit(kit);
        try {
          sessionStorage.setItem(SOCIAL_KIT_STORAGE_KEY, JSON.stringify(kit));
        } catch (e) {
          console.warn("[video-guide] Failed to persist social kit to sessionStorage:", e);
        }
        toast({ title: "Social Media Kit ready", description: "Your kit has been generated." });
      }
    } catch (e) {
      toast({
        title: "Failed to generate kit",
        description: e instanceof Error ? e.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSocialKitLoading(false);
    }
  }, [libraryScriptId, displayScript, effectiveProductName, guide, toast]);

  const socialKitToText = useCallback((kit: SocialMediaKit): string => {
    const lines: string[] = [];
    lines.push("=== TIKTOK ===");
    lines.push("Title variations:\n" + (kit.tiktok.titleVariations?.join("\n") || "—"));
    lines.push("\nDescription variations:\n" + (kit.tiktok.descriptionVariations?.join("\n\n") || "—"));
    lines.push("\nHashtags: " + (kit.tiktok.hashtags?.join(" ") || "—"));
    lines.push("\nBest posting times: " + (kit.tiktok.bestPostingTimes || "—"));
    lines.push("\nSuggested sounds: " + (kit.tiktok.suggestedSounds?.join(", ") || "—"));
    lines.push("\n=== INSTAGRAM REELS ===");
    lines.push("Caption variations:\n" + (kit.instagramReels.captionVariations?.join("\n\n") || "—"));
    lines.push("\nHashtags: " + (kit.instagramReels.hashtags?.join(" ") || "—"));
    lines.push("\nStory sequence: " + (kit.instagramReels.storySequenceSuggestions?.join("\n• ") || "—"));
    lines.push("\nBest posting times: " + (kit.instagramReels.bestPostingTimes || "—"));
    lines.push("\n=== YOUTUBE SHORTS ===");
    lines.push("Title variations:\n" + (kit.youtubeShorts.titleVariations?.join("\n") || "—"));
    lines.push("\nDescription:\n" + (kit.youtubeShorts.descriptionWithKeywords || "—"));
    lines.push("\nTags: " + (kit.youtubeShorts.tagsList?.join(", ") || "—"));
    lines.push("\nThumbnail text: " + (kit.youtubeShorts.thumbnailTextSuggestions?.join(" | ") || "—"));
    lines.push("\n=== GENERAL ===");
    lines.push("Cross-posting schedule:\n" + (kit.general.crossPostingSchedule || "—"));
    lines.push("\nEngagement prompts: " + (kit.general.engagementPrompts?.join("\n• ") || "—"));
    lines.push("\nPin comment suggestions: " + (kit.general.pinCommentSuggestions?.join("\n• ") || "—"));
    return lines.join("\n");
  }, [effectiveProductName]);

  const copyFullScript = useCallback(() => {
    const text = `Hook:\n${displayScript.hook}\n\nBody:\n${displayScript.body}\n\nCTA:\n${displayScript.cta}`;
    copyToClipboard(text, "Full script");
  }, [displayScript, copyToClipboard]);

  const handleRegenerateFullScript = useCallback(
    async (lengthAdjustment?: "shorter" | "longer") => {
      if (!libraryScriptId) return;
      setRegeneratingFullScript(true);
      try {
        const res = await fetch("/api/video-guide/regenerate-full-script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ libraryScriptId, ...(lengthAdjustment && { lengthAdjustment }) }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to regenerate script");
        const script = (data as { script?: { hook: string; body: string; cta: string } }).script;
        if (script) {
          const scenesForMapping = guide.scenes ?? guide.scenePrompts.map((s) => ({ scene: s.scene, timing: s.timing }));
          const chunks = mapScriptToSceneOverlays(script, scenesForMapping.length);
          const updatedScenes = scenesForMapping.map((scene, i) => {
            const chunk = chunks[i] ?? "";
            const raw = (scene as { textOverlay?: unknown }).textOverlay;
            const existing: TextOverlayObj =
              typeof raw === "object" && raw && !Array.isArray(raw) && "exactText" in (raw as object)
                ? (raw as TextOverlayObj)
                : Array.isArray(raw) && raw[0] && typeof raw[0] === "object" && raw[0] && "exactText" in (raw[0] as object)
                  ? (raw[0] as TextOverlayObj)
                  : {};
            return { ...scene, textOverlay: { ...existing, exactText: chunk } };
          });
          onScriptRegenerated?.(script, updatedScenes);
          if (scripts.length > 0 && currentAngleIndex >= 0 && currentAngleIndex < scripts.length) {
            setScripts((prev) =>
              prev.map((s, i) => (i === currentAngleIndex ? { ...s, hook: script.hook, body: script.body, cta: script.cta } : s))
            );
          }
          const msg = lengthAdjustment === "shorter" ? "Script shortened." : lengthAdjustment === "longer" ? "Script expanded." : "Hook, body and CTA updated.";
          toast({ title: "Script regenerated", description: msg });
        }
      } catch (e) {
        toast({ title: "Regenerate failed", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
      } finally {
        setRegeneratingFullScript(false);
      }
    },
    [libraryScriptId, onScriptRegenerated, scripts.length, currentAngleIndex, toast, guide.scenes, guide.scenePrompts]
  );

  const applyRegeneratePayload = useCallback(
    (payload: {
      scenes?: VideoGuideData["scenes"];
      scenePrompts?: VideoGuideData["scenePrompts"];
      storytellingFramework?: string;
      frameworkRationale?: string;
      engagementTriggers?: string[];
    }) => {
      if (payload.scenes && payload.scenePrompts && onScenesRegenerated) {
        onScenesRegenerated(payload as Parameters<typeof onScenesRegenerated>[0]);
        toast({ title: "Scenes regenerated", description: "Visual and text overlay prompts have been updated." });
      }
    },
    [onScenesRegenerated, toast]
  );

  const handleRegenerateScenes = useCallback(async () => {
    if (!onScenesRegenerated) return;
    const script = displayScript;
    const durationSeconds = config.duration * 60;
    setRegeneratingScenes(true);
    try {
      const res = await fetch("/api/video-guide/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook: script.hook,
          body: script.body,
          cta: script.cta,
          productName: guide.productName?.trim() || undefined,
          productId: productId || undefined,
          regenerateScenesOnly: true,
          durationSeconds: durationSeconds >= 120 ? durationSeconds : 300,
          targetSceneCount: config.sceneCount,
          ...(isYouTubeMode && { source: "content-studio", platforms: ["youtube_longform"] }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to regenerate scenes");
      const payload = data as {
        scenes?: VideoGuideData["scenes"];
        scenePrompts?: VideoGuideData["scenePrompts"];
        storytellingFramework?: string;
        frameworkRationale?: string;
        engagementTriggers?: string[];
      };
      if (payload.scenes && payload.scenePrompts) {
        applyRegeneratePayload(payload);
      } else {
        throw new Error("Invalid response");
      }
    } catch (e) {
      toast({ title: "Regenerate failed", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setRegeneratingScenes(false);
    }
  }, [displayScript, guide.productName, productId, onScenesRegenerated, toast, isYouTubeMode, config.duration, config.sceneCount, applyRegeneratePayload]);

  const handleApplyConfiguration = useCallback(async () => {
    if (!onScenesRegenerated) return;
    const script = displayScript;
    const durationSeconds = config.duration * 60;
    setRegeneratingScenes(true);
    try {
      const res = await fetch("/api/video-guide/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook: script.hook,
          body: script.body,
          cta: script.cta,
          productName: guide.productName?.trim() || undefined,
          productId: productId || undefined,
          regenerateScenesOnly: true,
          durationSeconds: durationSeconds >= 120 ? durationSeconds : 300,
          targetSceneCount: config.sceneCount,
          ...(isYouTubeMode && { source: "content-studio", platforms: ["youtube_longform"] }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to regenerate guide");
      const payload = data as {
        scenes?: VideoGuideData["scenes"];
        scenePrompts?: VideoGuideData["scenePrompts"];
        storytellingFramework?: string;
        frameworkRationale?: string;
        engagementTriggers?: string[];
      };
      if (payload.scenes && payload.scenePrompts) {
        applyRegeneratePayload(payload);
        toast({ title: "Video guide updated", description: "Duration, scene count, and format have been applied." });
      } else {
        throw new Error("Invalid response");
      }
    } catch (e) {
      toast({ title: "Apply failed", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setRegeneratingScenes(false);
    }
  }, [displayScript, guide.productName, productId, onScenesRegenerated, toast, isYouTubeMode, config.duration, config.sceneCount, applyRegeneratePayload]);

  const fullScriptText = `${currentScriptForDisplay.hook}\n\n${currentScriptForDisplay.body}\n\n${currentScriptForDisplay.cta}`;

  /** Copy the best available TikTok caption (social kit description + hashtags, else script text). */
  const copyCaption = useCallback(() => {
    let text = "";
    if (socialKit?.tiktok) {
      const desc = socialKit.tiktok.descriptionVariations?.[0] ?? "";
      const hashtags = socialKit.tiktok.hashtags?.join(" ") ?? "";
      text = [desc, hashtags].filter(Boolean).join("\n\n");
    } else {
      text = fullScriptText.trim();
    }
    if (!text) {
      toast({ title: "Nothing to copy", description: "Generate a Social Media Kit first for a polished caption." });
      return;
    }
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedCaption(true);
      setTimeout(() => setCopiedCaption(false), 2000);
      toast({ title: "Caption copied!", description: "Ready to paste straight into TikTok." });
    });
  }, [socialKit, fullScriptText, toast]);

  const scriptStats = useMemo(() => {
    const text = fullScriptText.trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const characters = text.length;
    const estimatedSeconds = Math.round(words / 2.5);
    return { words, characters, estimatedSeconds };
  }, [fullScriptText]);

  /**
   * Split full script across ALL scenes proportionally by scene duration (word count ∝ time).
   * wordsPerSecond = totalWords / totalDuration; each scene gets wordsPerSecond × sceneDuration words.
   * Returns exactly scenes.length chunks so there are exactly 5 voiceover clips for 5 scenes.
   */
  const getSceneTexts = useCallback((): string[] => {
    const n = scenes.length;
    if (n === 0) return [];
    const fullText = fullScriptText.trim();
    const words = fullText ? fullText.split(/\s+/).filter(Boolean) : [];
    if (words.length === 0) return Array(n).fill("");

    const timings = scenes.map((s) => parseSceneTiming(s.timing ?? "0-0"));
    const totalDuration = timings.reduce((sum, t) => sum + Math.max(0, t.endSec - t.startSec), 0);

    if (totalDuration <= 0) {
      const equalCount = Math.max(1, Math.floor(words.length / n));
      const chunks: string[] = [];
      let offset = 0;
      for (let i = 0; i < n; i++) {
        const isLast = i === n - 1;
        const count = isLast ? words.length - offset : Math.min(equalCount, words.length - offset);
        chunks.push(words.slice(offset, offset + count).join(" ").trim());
        offset += count;
      }
      return chunks;
    }

    const wordsPerSecond = words.length / totalDuration;
    const chunks: string[] = [];
    let wordOffset = 0;

    for (let i = 0; i < n; i++) {
      const { startSec, endSec } = timings[i];
      const sceneDuration = Math.max(0, endSec - startSec);
      const wordCount = Math.max(0, Math.round(wordsPerSecond * sceneDuration));
      const isLast = i === n - 1;
      const take = isLast ? Math.max(wordCount, words.length - wordOffset) : wordCount;
      const chunk = words.slice(wordOffset, wordOffset + take).join(" ").trim();
      wordOffset += take;
      chunks.push(chunk);
    }

    if (wordOffset < words.length && chunks.length > 0) {
      const lastChunk = chunks[chunks.length - 1];
      const remainder = words.slice(wordOffset).join(" ").trim();
      chunks[chunks.length - 1] = lastChunk ? `${lastChunk} ${remainder}`.trim() : remainder;
    }

    return chunks;
  }, [scenes, fullScriptText]);

  const buildGuideSceneCaptionText = useCallback(
    (i: number): string => {
      const sceneTexts = getSceneTexts();
      const voiceLine = (sceneTexts[i] ?? "").trim();
      const scene = scenes[i];
      if (!scene) return voiceLine;
      const overlayObjs = parseSceneOverlayObjs((scene as { textOverlay?: unknown }).textOverlay);
      const overlayParts = overlayObjs.map((o) => stripMarkdown(o.exactText ?? "")).filter(Boolean);
      const overlayLine = overlayParts.length > 0 ? `On-screen: ${overlayParts.join(" · ")}` : "";
      return [voiceLine, overlayLine].filter(Boolean).join("\n\n");
    },
    [getSceneTexts, scenes, stripMarkdown]
  );

  // Product mockup URLs injected by the POD promo flow — cycle through these instead of
  // calling the generic AI image generator, so every scene shows the actual product.
  const podProductImageUrls = useMemo<string[]>(() => {
    if (!Array.isArray(guide.scenes)) return [];
    return guide.scenes
      .map((s) => (s as Record<string, unknown>).image_url)
      .filter((u): u is string => typeof u === "string" && u.trim().startsWith("http"))
      .filter((u, idx, arr) => arr.indexOf(u) === idx); // dedupe
  }, [guide.scenes]);

  const fetchGuideSceneImageUrl = useCallback(
    async (i: number): Promise<string | null> => {
      // If this guide was launched from a POD product (scenes have image_url), cycle through
      // the product's own mockup images rather than generating random AI images.
      if (podProductImageUrls.length > 0) {
        return podProductImageUrls[i % podProductImageUrls.length];
      }

      const scene = scenes[i];
      if (!scene) return null;
      const prompt = getSceneFullPrompt(scene).trim();
      if (!prompt) {
        toast({
          title: "No visual prompt",
          description: `Scene ${i + 1} has nothing to send to the image model.`,
          variant: "destructive",
        });
        return null;
      }
      const finalPrompt = wrapVideoGuideImagePromptForDalle(prompt.slice(0, 12000));
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: finalPrompt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Failed to generate image");
      }
      const url = resolveGenerateImageApiUrl(data);
      if (!url) {
        toast({
          title: "Invalid image URL",
          description: "The server did not return a valid image URL.",
          variant: "destructive",
        });
        return null;
      }
      return url;
    },
    [podProductImageUrls, scenes, getSceneFullPrompt, toast, wrapVideoGuideImagePromptForDalle]
  );

  const allAnimatedVideosReady = scenes.length > 0 && scenes.every((_, i) => !!guideSceneVideoUrls[i]?.trim());
  const allVoiceoversReady = scenes.length > 0 && scenes.every(
    (_, i) => !!(guideCoachVoiceoverUrls[i]?.trim() || perSceneUrls[i]?.trim())
  );
  /** Server compile only accepts http(s) voiceover URLs (library uploads), not blob: previews. */
  const canCompileServerSideVoice = useMemo(() => {
    if (scenes.length === 0) return false;
    const isHttp = (s: string | null | undefined) => {
      const t = (s ?? "").trim();
      return t.startsWith("http://") || t.startsWith("https://");
    };
    const perSceneAllHttp = scenes.every((_, i) => isHttp(guideCoachVoiceoverUrls[i]) || isHttp(perSceneUrls[i]));
    return perSceneAllHttp || isHttp(fullVoiceoverUrl);
  }, [scenes.length, guideCoachVoiceoverUrls, perSceneUrls, fullVoiceoverUrl]);
  const isAnySceneAnimating = Object.values(animatingByScene).some(Boolean);

  const generateGuideSceneImage = useCallback(
    async (i: number): Promise<string | null> => {
      setGuideSceneImageLoadingIndex(i);
      try {
        const url = await fetchGuideSceneImageUrl(i);
        if (url) {
          setGuideSceneImageUrls((prev) => ({ ...prev, [i]: url }));
        }
        return url;
      } catch (e) {
        toast({
          title: "Image generation failed",
          description: e instanceof Error ? e.message : "Something went wrong",
          variant: "destructive",
        });
        return null;
      } finally {
        setGuideSceneImageLoadingIndex((cur) => (cur === i ? null : cur));
      }
    },
    [fetchGuideSceneImageUrl, toast]
  );

  const runBulkGuideMediaGeneration = useCallback(async (): Promise<{
    mergedUrls: Record<number, string>;
    mergedVideoUrls: Record<number, string>;
  }> => {
    const mergedUrls: Record<number, string> = { ...guideSceneImageUrls };
    const mergedVideoUrls: Record<number, string> = { ...guideSceneVideoUrls };
    for (let i = 0; i < scenes.length; i++) {
      setGuideSceneImageLoadingIndex(i);
      const scene = scenes[i];
      try {
        const url = await fetchGuideSceneImageUrl(i);
        if (url) mergedUrls[i] = url;
        const img = mergedUrls[i]?.trim();
        if (img && scene) {
          toast({
            title: `Animating scene ${i + 1} of ${scenes.length}`,
            description: "Motion generation often takes a few minutes per scene. You can leave this tab open.",
          });
          try {
            const vurl = await animateAiStorySceneFromImage(img, getSceneFullPrompt(scene));
            mergedVideoUrls[i] = vurl;
          } catch (animErr) {
            if (animErr instanceof NoVideoCreditsError) {
              toast({
                title: "Video credits required",
                description: "You need video credits to animate scenes. Purchase credits to continue.",
                variant: "destructive",
                action: (
                  <ToastAction altText="Buy credits" onClick={() => window.open("/dashboard/video-credits", "_blank")}>
                    Buy credits
                  </ToastAction>
                ),
              });
              break; // Stop animating — no point continuing without credits
            }
            toast({
              title: `Scene ${i + 1} animation failed`,
              description: animErr instanceof Error ? animErr.message : "Export will use the still image.",
              variant: "destructive",
            });
          }
        }
      } catch (e) {
        toast({
          title: `Scene ${i + 1} failed`,
          description: e instanceof Error ? e.message : "Skipped",
          variant: "destructive",
        });
      }
    }
    setGuideSceneImageUrls((prev) => ({ ...prev, ...mergedUrls }));
    setGuideSceneVideoUrls((prev) => ({ ...prev, ...mergedVideoUrls }));
    return { mergedUrls, mergedVideoUrls };
  }, [
    scenes,
    guideSceneImageUrls,
    guideSceneVideoUrls,
    fetchGuideSceneImageUrl,
    getSceneFullPrompt,
    toast,
  ]);

  const buildGuideTimelineSlot = useCallback(
    (i: number, imageUrlOverride?: string): TimelineScenePrefill => {
      const scene = scenes[i];
      const img = (imageUrlOverride ?? guideSceneImageUrls[i])?.trim();
      const cap = buildGuideSceneCaptionText(i);
      const coach = guideCoachVoiceoverUrls[i]?.trim();
      const legacyVo = perSceneUrls[i]?.trim();
      const audio = coach || legacyVo || undefined;
      const vid = guideSceneVideoUrls[i]?.trim();
      return {
        scene_number: i + 1,
        duration_seconds: VIDEO_GUIDE_TIMELINE_SCENE_SEC,
        visual: scene ? `Scene ${i + 1} · ${scene.timing}`.slice(0, 80) : `Scene ${i + 1}`,
        imageUrl: img || undefined,
        videoUrl: vid || undefined,
        audioUrl: audio,
        captionText: cap.trim() || undefined,
      };
    },
    [scenes, guideSceneImageUrls, guideSceneVideoUrls, guideCoachVoiceoverUrls, buildGuideSceneCaptionText, perSceneUrls]
  );

  const handleAutoExportFromAnimatedScenes = useCallback(() => {
    if (!scenes.length) return;
    if (!allAnimatedVideosReady) {
      toast({ title: "Animations not ready", description: "Finish animating all scenes first.", variant: "destructive" });
      return;
    }
    if (!allVoiceoversReady) {
      toast({
        title: "Missing voiceovers",
        description: "Generate scene voiceovers so the exported video includes them.",
        variant: "destructive",
      });
      return;
    }
    const title = (effectiveScriptTitle?.trim() || scriptTitle?.trim() || "Video Guide").slice(0, 200);
    const timelineScenes: TimelineScenePrefill[] = scenes.map((_, i) => buildGuideTimelineSlot(i));
    setVideoPrefill({
      source: "template-studio",
      title,
      ...(libraryScriptId?.trim() ? { scriptId: libraryScriptId.trim() } : {}),
      timelineScenes,
    });
    const qs = new URLSearchParams({ autoExport: "1", videoGuidePrefill: "1" });
    if (libraryScriptId?.trim()) qs.set("libraryScriptId", libraryScriptId.trim());
    try {
      router.push(`/dashboard/video-timeline?${qs.toString()}`);
    } catch (e) {
      toast({
        title: "Could not open timeline",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    }
  }, [
    scenes.length,
    allAnimatedVideosReady,
    allVoiceoversReady,
    toast,
    effectiveScriptTitle,
    scriptTitle,
    libraryScriptId,
    buildGuideTimelineSlot,
    router,
  ]);

  useEffect(() => {
    if (!autoExportWhenAnimationsReady) return;
    if (autoExportStartedRef.current) return;
    if (!scenes.length) return;
    if (!allAnimatedVideosReady) return;
    if (!allVoiceoversReady) return;
    autoExportStartedRef.current = true;
    setAutoExportWhenAnimationsReady(false);
    handleAutoExportFromAnimatedScenes();
  }, [autoExportWhenAnimationsReady, scenes.length, allAnimatedVideosReady, allVoiceoversReady, handleAutoExportFromAnimatedScenes]);

  const handleAddGuideSceneToTimeline = useCallback(
    (i: number) => {
      const imageUrl = guideSceneImageUrls[i]?.trim();
      if (!imageUrl) {
        toast({
          title: "Generate an image first",
          description: "Create a scene image before adding it to the timeline.",
          variant: "destructive",
        });
        return;
      }
      const slot = buildGuideTimelineSlot(i, imageUrl);
      const existing = getVideoPrefill();
      const title = (effectiveScriptTitle?.trim() || scriptTitle?.trim() || "Video Guide").slice(0, 200);
      setVideoPrefill(mergeTemplateStudioTimelineScene(existing, slot, title));
      toast({ title: "Added to timeline", description: "Open Video Timeline to load prefilled scenes." });
    },
    [guideSceneImageUrls, buildGuideTimelineSlot, effectiveScriptTitle, scriptTitle, toast]
  );

  const handleGenerateAllGuideImagesAndOpenTimeline = useCallback(async () => {
    if (scenes.length === 0) {
      toast({ title: "No scenes", description: "Add a scene breakdown first.", variant: "destructive" });
      return;
    }
    setGuideBulkImagesLoading(true);
    try {
      const { mergedUrls, mergedVideoUrls } = await runBulkGuideMediaGeneration();
      const title = (effectiveScriptTitle?.trim() || scriptTitle?.trim() || "Video Guide").slice(0, 200);
      const timelineScenes: TimelineScenePrefill[] = scenes.map((scene, i) => ({
        scene_number: i + 1,
        duration_seconds: VIDEO_GUIDE_TIMELINE_SCENE_SEC,
        visual: `Scene ${i + 1} · ${scene.timing}`.slice(0, 80),
        imageUrl: mergedUrls[i]?.trim() || undefined,
        videoUrl: mergedVideoUrls[i]?.trim() || undefined,
        audioUrl: guideCoachVoiceoverUrls[i]?.trim() || perSceneUrls[i]?.trim() || undefined,
        captionText: buildGuideSceneCaptionText(i).trim() || undefined,
      }));
      const sid = libraryScriptId?.trim();
      setVideoPrefill({
        source: "template-studio",
        title,
        ...(sid ? { scriptId: sid } : {}),
        timelineScenes,
      });
      router.push(getTimelineUrl(sid, { videoGuidePrefill: true }));
      toast({
        title: "Opening Video Timeline",
        description:
          "Scenes are pre-loaded with motion clips where animation succeeded; otherwise stills. Reorder, trim, and export.",
      });
    } finally {
      setGuideSceneImageLoadingIndex(null);
      setGuideBulkImagesLoading(false);
    }
  }, [
    scenes,
    runBulkGuideMediaGeneration,
    guideCoachVoiceoverUrls,
    buildGuideSceneCaptionText,
    perSceneUrls,
    effectiveScriptTitle,
    scriptTitle,
    libraryScriptId,
    router,
    toast,
  ]);

  const handleMakeFullVideoMp4 = useCallback(async () => {
    if (scenes.length === 0) {
      toast({ title: "No scenes", description: "Add a scene breakdown first.", variant: "destructive" });
      return;
    }
    setGuideFullVideoLoading(true);
    try {
      const isHttp = (s: string | null | undefined) => {
        const t = (s ?? "").trim();
        return t.startsWith("http://") || t.startsWith("https://");
      };
      // Use existing scene media (images + animations already generated)
      const guideScenes = scenes
        .map((_, i) => {
          const video_url = isHttp(guideSceneVideoUrls[i]) ? guideSceneVideoUrls[i].trim() : null;
          const image_url = isHttp(guideSceneImageUrls[i]) ? guideSceneImageUrls[i].trim() : null;
          if (!video_url && !image_url) return null; // skip scenes with no media
          const vo = guideCoachVoiceoverUrls[i]?.trim() || perSceneUrls[i]?.trim() || "";
          const caption = buildGuideSceneCaptionText(i).trim();
          const row: {
            duration: number;
            image_url: string | null;
            video_url: string | null;
            script_text?: string;
            caption?: string;
            voiceover_url?: string;
            disableKenBurns?: boolean;
          } = {
            duration: VIDEO_GUIDE_TIMELINE_SCENE_SEC,
            image_url,
            video_url,
            disableKenBurns: true,
          };
          if (caption) {
            row.script_text = caption;
            row.caption = caption;
          }
          if (isHttp(vo)) row.voiceover_url = vo;
          return row;
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (guideScenes.length === 0) {
        toast({
          title: "No scene media yet",
          description: "Generate images for your scenes first using the Generate Image buttons above.",
          variant: "destructive",
        });
        return;
      }

      // Resolve voiceover strategy BEFORE appending the thumbnail (thumbnail has no audio)
      const perSceneAnyHttp = guideScenes.some((r) => isHttp(r.voiceover_url ?? null));
      const perSceneAllHttp = guideScenes.every((r) => isHttp(r.voiceover_url ?? null));
      const globalVoRaw = fullVoiceoverUrl?.trim() ?? "";
      const globalVo =
        globalVoRaw.startsWith("http://") || globalVoRaw.startsWith("https://") ? globalVoRaw : undefined;

      let sendVoiceoverUrl: string | undefined;
      if (perSceneAllHttp) {
        // All scenes have per-scene voiceovers — compile uses them directly, no global needed
        sendVoiceoverUrl = undefined;
      } else if (perSceneAnyHttp) {
        // Some scenes have per-scene voiceovers — keep them, server handles missing ones
        sendVoiceoverUrl = undefined;
      } else {
        // No per-scene voiceovers at all — strip any stale keys and use global voiceover
        guideScenes.forEach((r) => { delete r.voiceover_url; });
        sendVoiceoverUrl = globalVo;
      }

      // Append product showcase scene at the END as a sign-off / CTA
      if (productThumbnailUrl && isHttp(productThumbnailUrl)) {
        guideScenes.push({
          duration: 4,
          image_url: productThumbnailUrl,
          video_url: null,
          disableKenBurns: true,
        });
      }

      const res = await fetch("/api/videos/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guideScenes,
          backgroundMusic: "none",
          outputAspect: guide.videoFormat?.aspectRatio === "16:9" ? "16:9" : "9:16",
          ...(sendVoiceoverUrl ? { voiceoverUrl: sendVoiceoverUrl } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Compile failed");
      const url = data.url?.trim();
      if (!url) throw new Error("No video URL returned");
      setLastCompiledVideoUrl(url);
      setVideoSocialCaptions(null); // reset previous captions
      // Auto-generate social captions for the exported video
      setVideoSocialCaptionsLoading(true);
      const captionsRequest = productId
        ? fetch(`/api/products/${encodeURIComponent(productId)}/social-captions`, { method: "POST" })
        : fetch("/api/videos/social-captions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: effectiveProductName || scriptTitle || guide.productName || "Video",
              script: [displayScript.hook, displayScript.body, displayScript.cta].filter(Boolean).join("\n\n"),
            }),
          });
      captionsRequest
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { tiktok_title?: string; tiktok?: string; instagram_title?: string; instagram?: string; youtube_title?: string; twitter?: string } | null) => {
          if (d?.tiktok || d?.instagram || d?.twitter) {
            setVideoSocialCaptions({ tiktok_title: d.tiktok_title ?? "", tiktok: d.tiktok ?? "", instagram_title: d.instagram_title ?? "", instagram: d.instagram ?? "", youtube_title: d.youtube_title ?? "", twitter: d.twitter ?? "" });
          }
        })
        .catch(() => {})
        .finally(() => setVideoSocialCaptionsLoading(false));
      // Trigger download directly via a link click (avoids popup blocker)
      const a = document.createElement("a");
      a.href = url;
      a.download = `video-${Date.now()}.mp4`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({
        title: "Full video ready ✅",
        description: "Downloading to your Downloads folder. Also saved to My Library.",
        duration: 60000,
        action: (
          <ToastAction altText="Open in new tab" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>
            Open
          </ToastAction>
        ),
      });
    } catch (e) {
      toast({
        title: "Could not make full video",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setGuideSceneImageLoadingIndex(null);
      setGuideFullVideoLoading(false);
    }
  }, [
    scenes,
    guideSceneImageUrls,
    guideSceneVideoUrls,
    guideCoachVoiceoverUrls,
    perSceneUrls,
    fullVoiceoverUrl,
    productThumbnailUrl,
    productId,
    buildGuideSceneCaptionText,
    toast,
  ]);

  /** Compile Dark Infographic slides → MP4 via backend FFmpeg pipeline. */
  const handleCompileInfographic = useCallback(async () => {
    if (scenes.length === 0) {
      toast({ title: "No scenes", description: "Add a scene breakdown first.", variant: "destructive" });
      return;
    }
    setGuideFullVideoLoading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const slideImages: string[] = [];
      for (let i = 0; i < scenes.length; i++) {
        const el = darkSlideRefs.current[i];
        if (!el) throw new Error(`Slide ${i + 1} not rendered — scroll through all scenes first so every slide loads.`);
        const canvas = await html2canvas(el, { backgroundColor: "#000000", scale: 2, useCORS: true });
        slideImages.push(canvas.toDataURL("image/png"));
      }
      const voiceoverUrls = scenes.map((_, i) =>
        guideCoachVoiceoverUrls[i]?.trim() || perSceneUrls[i]?.trim() || ""
      );
      const sceneDurations = scenes.map((s) => {
        const t = parseSceneTiming(s.timing ?? "0-0");
        return Math.max(2, t.endSec - t.startSec);
      });
      const res = await fetch("/api/video-guide/compile-infographic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slideImages,
          voiceoverUrls,
          sceneDurations,
          productName: effectiveProductName || guide.productName || "",
          libraryScriptId: libraryScriptId || "",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { videoUrl?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Compile failed");
      if (!data.videoUrl) throw new Error("No video URL returned");
      setLastCompiledVideoUrl(data.videoUrl);
      const a = document.createElement("a");
      a.href = data.videoUrl;
      a.download = `infographic-${Date.now()}.mp4`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({
        title: "Dark Infographic video ready ✅",
        description: "Downloading now.",
        duration: 60000,
        action: (
          <ToastAction altText="Open in new tab" onClick={() => window.open(data.videoUrl, "_blank", "noopener,noreferrer")}>
            Open
          </ToastAction>
        ),
      });
      // Auto-generate Social Media Kit (titles, descriptions, hashtags) after compile
      if (libraryScriptId && !socialKit) {
        setSocialKitLoading(true);
        const form = new FormData();
        form.append("libraryScriptId", libraryScriptId);
        form.append("scriptHook", displayScript.hook ?? "");
        form.append("scriptBody", displayScript.body ?? "");
        form.append("scriptCta", displayScript.cta ?? "");
        form.append("productName", (effectiveProductName && cleanProductTitle(effectiveProductName)) || effectiveProductName || "Product");
        form.append("productDescription", (guide as { productDescription?: string }).productDescription ?? "");
        fetch("/api/video-guide/social-media-kit", { method: "POST", body: form })
          .then((r) => r.json().catch(() => ({})))
          .then((d: { kit?: SocialMediaKit }) => { if (d.kit) { setSocialKit(d.kit); try { sessionStorage.setItem(SOCIAL_KIT_STORAGE_KEY, JSON.stringify(d.kit)); } catch { /* ignore */ } } })
          .catch(() => {})
          .finally(() => setSocialKitLoading(false));
      }
    } catch (e) {
      toast({
        title: "Compile failed",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setGuideFullVideoLoading(false);
    }
  }, [
    scenes,
    darkSlideRefs,
    guideCoachVoiceoverUrls,
    perSceneUrls,
    effectiveProductName,
    guide,
    libraryScriptId,
    displayScript,
    socialKit,
    toast,
  ]);

  const generateVoiceover = useCallback(
    async (text: string, options?: { voiceIdOverride?: string }): Promise<Blob> => {
      const vid = options?.voiceIdOverride ?? voiceId;
      const res = await fetch("/api/generate-voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId: vid, stability, similarity }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Voiceover failed");
      }
      return res.blob();
    },
    [voiceId, stability, similarity]
  );

  const handlePreviewVoice = useCallback(
    async (vId: string) => {
      setPreviewingVoiceId(vId);
      try {
        const blob = await generateVoiceover(VOICE_PREVIEW_TEXT, { voiceIdOverride: vId });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);
        await audio.play();
      } catch (e) {
        toast({ title: "Preview failed", description: e instanceof Error ? e.message : "Could not play sample", variant: "destructive" });
      } finally {
        setPreviewingVoiceId(null);
      }
    },
    [generateVoiceover, toast]
  );

  const handleGenerateFullVoiceover = useCallback(async () => {
    if (!fullScriptText.trim()) {
      toast({ title: "No script text", variant: "destructive" });
      return;
    }
    setGeneratingFull(true);
    if (fullVoiceoverUrl?.startsWith("blob:")) URL.revokeObjectURL(fullVoiceoverUrl);
    setFullVoiceoverUrl(null);
    setFullVoiceoverDuration(null);
    try {
      const blob = await generateVoiceover(fullScriptText);
      let finalUrl: string;
      if (libraryScriptId) {
        const form = new FormData();
        form.set("file", new File([blob], "voiceover.mp3", { type: "audio/mpeg" }));
        form.set("libraryScriptId", libraryScriptId);
        const upRes = await fetch("/api/video-timeline/upload-voiceover", { method: "POST", body: form });
        if (!upRes.ok) {
          const err = await upRes.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || "Upload failed");
        }
        const data = (await upRes.json()) as { url?: string };
        finalUrl = typeof data?.url === "string" && data.url.trim() ? data.url.trim() : "";
        if (!finalUrl) throw new Error("Upload did not return a URL");
      } else {
        finalUrl = URL.createObjectURL(blob);
      }
      // Show voiceover in UI immediately so it's visible "right away"
      setFullVoiceoverUrl(finalUrl);
      setFullVoiceoverDuration(null);
      setGeneratingFull(false);
      toast({ title: "Voiceover ready", description: "Playing full script audio." });
      setPlayingPreviewUrl(finalUrl);
      setTimeout(() => {
        const audio = new Audio(finalUrl);
        autoPlayAudioRef.current = audio;
        audio.play().catch(() => {
          setPlayingPreviewUrl(null);
          autoPlayAudioRef.current = null;
        });
        audio.onended = () => {
          setPlayingPreviewUrl(null);
          autoPlayAudioRef.current = null;
        };
      }, 150);
      // Get duration and save to library in background (don't block UI)
      const durationSec = await new Promise<number | null>((resolve) => {
        const audio = new Audio(finalUrl);
        audio.onloadedmetadata = () => resolve(audio.duration);
        audio.onerror = () => resolve(null);
        setTimeout(() => resolve(null), 10000);
      });
      if (durationSec != null && !Number.isNaN(durationSec)) setFullVoiceoverDuration(durationSec);
      if (libraryScriptId) {
        const patchRes = await fetch(`/api/library/scripts/${libraryScriptId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timelineVoiceoverUrl: finalUrl,
            timelineVoiceoverDuration: durationSec ?? 0,
          }),
        });
        if (!patchRes.ok) {
          toast({ title: "Voiceover saved here", description: "Could not save to library.", variant: "destructive" });
        }
      }
    } catch (e) {
      toast({
        title: "Voiceover failed",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
      setGeneratingFull(false);
    }
  }, [fullScriptText, generateVoiceover, toast, fullVoiceoverUrl, libraryScriptId]);

  const generateOneSceneVoiceover = useCallback(
    async (i: number, textChunk: string | undefined, urls: (string | null)[]): Promise<boolean> => {
      if (!textChunk?.trim()) {
        console.warn("[Scene voiceover] Scene", i, "has no text, skipping");
        return false;
      }
      let blob: Blob;
      try {
        blob = await generateVoiceover(textChunk);
      } catch (err) {
        console.error("[Scene voiceover] TTS failed for scene", i + 1, err);
        if (err instanceof Error) console.error("[Scene voiceover] TTS error message:", err.message);
        urls[i] = null;
        return false;
      }
      if (!libraryScriptId) {
        urls[i] = URL.createObjectURL(blob);
        return true;
      }
      try {
        const form = new FormData();
        form.set("file", new File([blob], `voiceover-scene-${i + 1}.mp3`, { type: "audio/mpeg" }));
        form.set("libraryScriptId", libraryScriptId);
        form.set("sceneIndex", String(i));
        const upRes = await fetch("/api/video-timeline/upload-voiceover", { method: "POST", body: form });
        if (!upRes.ok) {
          const errBody = await upRes.json().catch(() => ({}));
          const errMsg = (errBody as { error?: string }).error || upRes.statusText || "Upload failed";
          console.error("[Scene voiceover] Supabase/upload failed for scene", i + 1, { status: upRes.status, error: errMsg, body: errBody });
          urls[i] = null;
          return false;
        }
        const { url } = (await upRes.json()) as { url: string };
        urls[i] = url;
        return true;
      } catch (err) {
        console.error("[Scene voiceover] Upload error for scene", i + 1, err);
        if (err instanceof Error) console.error("[Scene voiceover] Upload error message:", err.message);
        urls[i] = null;
        return false;
      }
    },
    [generateVoiceover, libraryScriptId]
  );

  /**
   * One-tap "Generate Everything": images → per-scene voiceovers → compile MP4.
   * Skips steps that are already done.
   */
  const handleGenerateEverything = useCallback(async () => {
    if (!voiceSettingsConfirmed) {
      toast({ title: "Choose your voice first", description: "Set up voice settings before building the video." });
      setActiveTab("voice-settings");
      return;
    }
    if (scenes.length === 0) {
      toast({ title: "No scenes", description: "Add a scene breakdown first.", variant: "destructive" });
      return;
    }
    setAutoGeneratingAll(true);
    try {
      // Step 1: Generate images (skip scenes that already have one)
      setAutoGeneratePhase("Generating images…");
      const mergedImgUrls: Record<number, string> = { ...guideSceneImageUrls };
      for (let i = 0; i < scenes.length; i++) {
        if (mergedImgUrls[i]?.trim()) continue;
        setAutoGeneratePhase(`Generating image ${i + 1} of ${scenes.length}…`);
        setGuideSceneImageLoadingIndex(i);
        try {
          const url = await fetchGuideSceneImageUrl(i);
          if (url) { mergedImgUrls[i] = url; setGuideSceneImageUrls((prev) => ({ ...prev, [i]: url })); }
        } catch { /* non-fatal */ }
      }
      setGuideSceneImageLoadingIndex(null);

      // Step 2: Per-scene voiceovers (skip scenes that already have one)
      setAutoGeneratePhase("Generating voiceovers…");
      const texts = getSceneTexts();
      const voUrls: (string | null)[] = scenes.map((_, i) => guideCoachVoiceoverUrls[i]?.trim() || perSceneUrls[i]?.trim() || null);
      for (let i = 0; i < scenes.length; i++) {
        if (voUrls[i]) continue;
        setAutoGeneratePhase(`Generating voiceover ${i + 1} of ${scenes.length}…`);
        await generateOneSceneVoiceover(i, texts[i], voUrls);
        if (voUrls[i]) setGuideCoachVoiceoverUrls((prev) => ({ ...prev, [i]: voUrls[i]! }));
      }

      // Step 3: Compile MP4
      setAutoGeneratePhase("Compiling video…");
      const isHttp = (s: string | null | undefined) => { const t = (s ?? "").trim(); return t.startsWith("http://") || t.startsWith("https://"); };
      const guideScenes = scenes
        .map((_, i) => {
          const image_url = isHttp(mergedImgUrls[i]) ? mergedImgUrls[i].trim() : null;
          if (!image_url) return null;
          const vo = (isHttp(voUrls[i]) ? voUrls[i] : null) ?? (isHttp(guideCoachVoiceoverUrls[i]) ? guideCoachVoiceoverUrls[i].trim() : null);
          const caption = buildGuideSceneCaptionText(i).trim();
          return { duration: VIDEO_GUIDE_TIMELINE_SCENE_SEC, image_url, video_url: null as string | null, disableKenBurns: true as const, ...(caption ? { script_text: caption, caption } : {}), ...(vo ? { voiceover_url: vo } : {}) };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (guideScenes.length === 0) {
        toast({ title: "No scene images", description: "Image generation produced no results. Try again.", variant: "destructive" });
        return;
      }

      const compileRes = await fetch("/api/videos/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guideScenes,
          outputAspect: guide.videoFormat?.aspectRatio === "16:9" ? "16:9" : "9:16",
        }),
      });
      if (!compileRes.ok) {
        const err = await compileRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Compile failed");
      }
      const compileData = await compileRes.json() as { url?: string; jobId?: string };

      let finalVideoUrl = compileData.url;
      if (!finalVideoUrl && compileData.jobId) {
        setAutoGeneratePhase("Compiling… (this may take a minute)");
        for (let poll = 0; poll < 60; poll++) {
          await new Promise((r) => setTimeout(r, 5000));
          const statusRes = await fetch(`/api/videos/compile/status/${compileData.jobId}`);
          const statusData = await statusRes.json() as { status?: string; url?: string };
          if (statusData.url) { finalVideoUrl = statusData.url; break; }
          if (statusData.status === "failed") throw new Error("Video compile failed");
        }
      }

      if (finalVideoUrl) {
        setLastCompiledVideoUrl(finalVideoUrl);
        toast({ title: "Video ready!", description: "Your compiled MP4 is ready to download." });
      } else {
        toast({ title: "Compile timed out", description: "The video is still processing — check back shortly.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Generation failed", description: err instanceof Error ? err.message : "Something went wrong", variant: "destructive" });
    } finally {
      setAutoGeneratingAll(false);
      setAutoGeneratePhase(null);
      setGuideSceneImageLoadingIndex(null);
    }
  }, [
    scenes,
    guideSceneImageUrls,
    guideCoachVoiceoverUrls,
    perSceneUrls,
    fetchGuideSceneImageUrl,
    getSceneTexts,
    generateOneSceneVoiceover,
    buildGuideSceneCaptionText,
    toast,
  ]);

  const handleGeneratePerSceneVoiceover = useCallback(async () => {
    const texts = getSceneTexts();
    console.log("[Scene voiceovers] Scenes array:", scenes.map((s, i) => ({ i, timing: s.timing, scene: s.scene?.slice(0, 40) })));
    console.log("[Scene voiceovers] Text chunks to send:", texts.map((t, i) => ({ i, length: t?.length ?? 0, preview: (t ?? "").slice(0, 60) })));
    if (texts.length === 0 || texts.every((t) => !t?.trim())) {
      toast({ title: "No scene text", variant: "destructive" });
      return;
    }
    setGeneratingPerScene(true);
    setPerSceneUrls((prev) => {
      prev.forEach((u) => u && typeof u === "string" && u.startsWith("blob:") && URL.revokeObjectURL(u));
      return texts.map(() => null);
    });
    try {
      const urls: (string | null)[] = texts.map(() => null);
      for (let i = 0; i < texts.length; i++) {
        setGeneratingSceneIndex(i);
        await generateOneSceneVoiceover(i, texts[i] ?? undefined, urls);
      }
      const failedIndices = urls.map((u, i) => (u == null ? i : -1)).filter((i) => i >= 0);
      if (failedIndices.length > 0) {
        console.log("[Scene voiceover] Retrying failed scenes:", failedIndices.map((i) => i + 1));
        for (const i of failedIndices) {
          setGeneratingSceneIndex(i);
          await generateOneSceneVoiceover(i, texts[i] ?? undefined, urls);
        }
      }
      setPerSceneUrls([...urls]);
      if (libraryScriptId && urls.some(Boolean)) {
        const toSave = urls.map((u) => u ?? "");
        let patchRes = await fetch(`/api/library/scripts/${libraryScriptId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timelineSceneVoiceoverUrls: toSave }),
        });
        if (!patchRes.ok) {
          const errBody = await patchRes.json().catch(() => ({}));
          console.error("[Scene voiceover] PATCH failed, retrying once:", { status: patchRes.status, body: errBody });
          patchRes = await fetch(`/api/library/scripts/${libraryScriptId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timelineSceneVoiceoverUrls: toSave }),
          });
        }
        if (patchRes.ok) {
          onSceneVoiceoverUrlsSaved?.(toSave.filter(Boolean));
        } else {
          const errBody = await patchRes.json().catch(() => ({}));
          console.error("[Scene voiceover] PATCH failed after retry:", patchRes.status, errBody);
          toast({ title: "Voiceovers saved locally", description: "Refresh may lose them. Try saving again or go to Timeline and back.", variant: "destructive" });
        }
      }
      const ok = urls.filter(Boolean).length;
      if (libraryScriptId) {
        toast({
          title: "Scene voiceovers",
          description: "Would you like to create a video? Go to Timeline to add scenes and export.",
          action: (
            <ToastAction
              altText="Go to Timeline"
              onClick={() => {
                router.push(`/dashboard/video-timeline?libraryScriptId=${encodeURIComponent(libraryScriptId)}`);
              }}
            >
              Go to Timeline
            </ToastAction>
          ),
        });
      } else {
        toast({ title: "Scene voiceovers", description: `Generated ${ok} of ${texts.length} successfully.` });
      }
    } catch (e) {
      console.error("[Scene voiceover] Unexpected error:", e);
      toast({
        title: "Voiceover failed",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setGeneratingPerScene(false);
      setGeneratingSceneIndex(null);
    }
  }, [scenes, getSceneTexts, generateOneSceneVoiceover, toast, libraryScriptId, router, onSceneVoiceoverUrlsSaved]);

  const handleGenerateSingleSceneVoiceover = useCallback(
    async (index: number) => {
      const texts = getSceneTexts();
      if (index < 0 || index >= texts.length || !texts[index]?.trim()) {
        toast({ title: "No text for this scene", variant: "destructive" });
        return;
      }
      setGeneratingSceneIndex(index);
      try {
        const blob = await generateVoiceover(texts[index]);
        let finalUrl: string;
        if (libraryScriptId) {
          const form = new FormData();
          form.set("file", new File([blob], `voiceover-scene-${index + 1}.mp3`, { type: "audio/mpeg" }));
          form.set("libraryScriptId", libraryScriptId);
          form.set("sceneIndex", String(index));
          const upRes = await fetch("/api/video-timeline/upload-voiceover", { method: "POST", body: form });
          if (!upRes.ok) {
            const err = await upRes.json().catch(() => ({}));
            throw new Error((err as { error?: string }).error || "Upload failed");
          }
          const { url } = (await upRes.json()) as { url: string };
          finalUrl = url;
        } else {
          finalUrl = URL.createObjectURL(blob);
        }
        setPerSceneUrls((prev) => {
          const next = [...prev];
          while (next.length <= index) next.push(null);
          const old = next[index];
          if (old && typeof old === "string" && old.startsWith("blob:")) URL.revokeObjectURL(old);
          next[index] = finalUrl;
          if (libraryScriptId) {
            const urlsForPatch = next.map((u) => u ?? "");
            fetch(`/api/library/scripts/${libraryScriptId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ timelineSceneVoiceoverUrls: urlsForPatch }),
            }).catch(() => {});
          }
          return next;
        });
        toast({ title: "Voiceover ready", description: `Scene ${index + 1} audio generated.` });
      } catch (e) {
        toast({
          title: "Voiceover failed",
          description: e instanceof Error ? e.message : "Something went wrong",
          variant: "destructive",
        });
      } finally {
        setGeneratingSceneIndex(null);
      }
    },
    [getSceneTexts, generateVoiceover, toast, libraryScriptId]
  );

  const handlePlayPreview = useCallback((url: string) => {
    const el = previewAudioRef.current;
    const autoEl = autoPlayAudioRef.current;
    if (playingPreviewUrl === url) {
      if (el) {
        el.pause();
        el.currentTime = 0;
      }
      if (autoEl) {
        autoEl.pause();
        autoEl.currentTime = 0;
        autoPlayAudioRef.current = null;
      }
      setPlayingPreviewUrl(null);
      return;
    }
    if (autoEl) {
      autoEl.pause();
      autoPlayAudioRef.current = null;
    }
    if (!el) return;
    el.src = url;
    setPlayingPreviewUrl(url);
    el.play().catch(() => setPlayingPreviewUrl(null));
  }, [playingPreviewUrl]);

  useEffect(() => {
    const el = previewAudioRef.current;
    if (!el) return;
    const onEnded = () => setPlayingPreviewUrl(null);
    el.addEventListener("ended", onEnded);
    return () => el.removeEventListener("ended", onEnded);
  }, []);

  const handleDeleteFullVoiceover = useCallback(async () => {
    if (libraryScriptId) {
      await fetch(`/api/library/scripts/${libraryScriptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timelineVoiceoverUrl: "", timelineVoiceoverDuration: 0 }),
      }).catch(() => {});
    }
    if (fullVoiceoverUrl?.startsWith("blob:")) URL.revokeObjectURL(fullVoiceoverUrl);
    setFullVoiceoverUrl(null);
    setFullVoiceoverDuration(null);
    if (playingPreviewUrl === fullVoiceoverUrl) setPlayingPreviewUrl(null);
    toast({ title: "Voiceover removed" });
  }, [libraryScriptId, fullVoiceoverUrl, playingPreviewUrl, toast]);

  const handleDeleteSceneVoiceover = useCallback(
    async (index: number) => {
      const url = perSceneUrls[index];
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
      const next = perSceneUrls.map((u, i) => (i === index ? null : u));
      setPerSceneUrls(next);
      if (playingPreviewUrl === url) setPlayingPreviewUrl(null);
      if (libraryScriptId) {
        const toSave = next.map((u) => u ?? "");
        const res = await fetch(`/api/library/scripts/${libraryScriptId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timelineSceneVoiceoverUrls: toSave }),
        });
        if (res.ok) onSceneVoiceoverUrlsSaved?.(toSave.filter(Boolean));
      }
      toast({ title: "Scene voiceover removed" });
    },
    [libraryScriptId, perSceneUrls, playingPreviewUrl, toast, onSceneVoiceoverUrlsSaved]
  );

  const downloadGuide = useCallback(() => {
    const lines: string[] = [];
    lines.push("VIDEO CREATION GUIDE");
    if (effectiveProductName) lines.push(`Product: ${cleanProductTitle(effectiveProductName) || effectiveProductName}`);
    lines.push("");
    lines.push("SCRIPT");
    lines.push(`Hook: ${displayScript.hook}`);
    lines.push(`Body: ${displayScript.body}`);
    lines.push(`CTA: ${displayScript.cta}`);
    lines.push("");
    lines.push("SCENE BREAKDOWN");
    scenes.forEach((s, i) => {
      const prompt = getSceneFullPrompt(s);
      lines.push(`${i + 1}. ${s.scene} (${s.timing})`);
      lines.push(`   AI Prompt: ${prompt}`);
      const vd = (s as { visualDirection?: VisualDirection }).visualDirection;
      if (vd?.cameraAngle) lines.push(`   Camera: ${vd.cameraAngle}`);
      if (vd?.lightingMood) lines.push(`   Lighting: ${vd.lightingMood}`);
      const toText = (s as { textOverlay?: unknown }).textOverlay;
      if (toText != null) {
        const objs: TextOverlayObj[] = typeof toText === "string" ? [{ exactText: toText }] : Array.isArray(toText) ? toText as TextOverlayObj[] : [toText as TextOverlayObj];
        objs.forEach((o) => {
          if (o.exactText) lines.push(`   Text: ${o.exactText}`);
          if (o.fontStyle || o.timingNote) lines.push(`   Style: ${[o.fontStyle, o.size, o.position, o.animation, o.timingNote].filter(Boolean).join(", ")}`);
        });
      }
    });
    lines.push("");
    lines.push("EDITING GUIDE");
    Object.entries(editingSteps).forEach(([tool, steps]) => {
      lines.push(`${tool}:`);
      steps.forEach((step) => lines.push(`  - ${step}`));
    });
    lines.push("");
    lines.push("SUBTITLES & TEXT");
    lines.push(`Style: ${subtitles.style ?? "—"}`);
    lines.push(`Font: ${subtitles.font ?? "—"}`);
    lines.push(`Position: ${subtitles.position ?? "—"}`);
    lines.push(`Animation: ${subtitles.animation ?? "—"}`);
    lines.push("");
    lines.push("MUSIC & AUDIO");
    lines.push(`Mood: ${music.mood ?? "—"}`);
    lines.push(`Sources: ${Array.isArray(music.sources) ? music.sources.join(", ") : "—"}`);
    lines.push(`Volume: ${music.volume ?? "—"}`);
    lines.push("");
    lines.push("EXPORT");
    lines.push(`Resolution: ${exportSettings.resolution ?? "—"}`);
    lines.push(`FPS: ${exportSettings.fps ?? "—"}`);
    lines.push(`Format: ${exportSettings.format ?? "—"}`);
    if (platformTips.length > 0) {
      lines.push("");
      lines.push("PLATFORM TIPS");
      platformTips.forEach((t) => lines.push(`- ${t}`));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `video-guide-${(effectiveScriptTitle ?? cleanProductTitle(effectiveProductName) ?? effectiveProductName ?? "guide").replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: "Full guide saved" });
  }, [
    effectiveProductName,
    script,
    scenes,
    getSceneFullPrompt,
    editingSteps,
    subtitles,
    music,
    exportSettings,
    platformTips,
    effectiveScriptTitle,
    toast,
  ]);

  const handleRegenerateScript = useCallback(async () => {
    // hasScripts: at least one script exists (gives us product context).
    // currentAngleIndex may be BEYOND scripts.length when the user navigates to
    // an angle that hasn't been generated yet — that's valid, we just generate it.
    const hasProductContext = scripts.length > 0 || !!guide.productName;
    const canRegenerate = hasProductContext && (productId || libraryScriptId || guide.productName);
    if (!canRegenerate) {
      toast({ title: "Cannot regenerate", description: "Product or script missing.", variant: "destructive" });
      return;
    }
    // Angle name: use the existing script title if in-bounds, else use the named angle
    const angle = currentAngleIndex < scripts.length
      ? scripts[currentAngleIndex].title
      : angles[currentAngleIndex]?.name ?? "Story Angle";
    setRegeneratingScript(true);
    try {
      let url: string;
      let body: Record<string, unknown>;
      if (productId) {
        url = "/api/digital-products/regenerate-script";
        body = { productId, angle };
      } else if (libraryScriptId) {
        url = "/api/video-guide/regenerate-angle";
        body = { libraryScriptId, angle };
      } else {
        // Inline mode: pass product context directly — no saved ID needed
        url = "/api/video-guide/regenerate-angle";
        body = {
          productName: guide.productName ?? "",
          productDescription: (guide as { productDescription?: string }).productDescription ?? "",
          angle,
        };
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Regeneration failed");
      const newScript = data.script as ScriptForGuide | undefined;
      if (newScript) {
        setScripts((prev) => {
          const next = [...prev];
          if (currentAngleIndex < next.length) {
            // Replace existing script, preserving its id
            next[currentAngleIndex] = { ...newScript, id: next[currentAngleIndex].id };
          } else {
            // Angle didn't have a script yet — insert at the right slot
            next[currentAngleIndex] = newScript;
          }
          return next;
        });
        toast({ title: "Script updated", description: `New "${angle}" variation ready.` });
      }
    } catch (e) {
      toast({
        title: "Regenerate failed",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setRegeneratingScript(false);
    }
  }, [productId, libraryScriptId, guide, scripts, currentAngleIndex, toast]);

  const backHref = backUrl ?? "/dashboard/digital-products/results";
  const backLabel = isYouTubeMode ? "Back to Scripts" : "Back to Results";

  // Timeline URL for final CTA
  const timelineHref = libraryScriptId
    ? `/dashboard/video-timeline?importVoiceover=1&libraryScriptId=${encodeURIComponent(libraryScriptId)}`
    : "/dashboard/video-timeline?importVoiceover=1";

  // pb-44 on mobile = 176px clearance — enough for sticky bar (~72px) above app nav (~90px)
  return (
    <main className="min-h-dvh bg-white dark:bg-background text-foreground p-6 md:p-10 pb-44 md:pb-10">
      {/*
        ── Persistent completion bar — mobile only ──────────────────────────
        Fixed directly above the app nav. Always visible regardless of which
        tab is active or how far the user has scrolled.
        Shows:
          • "✓ Saved" badge when the guide has been saved to My Library
          • Primary CTA: "Open in Library →"  (if saved)  or  "Create Video →"
          • Secondary: back icon button
        Desktop (md+) hides this bar — the bottom card handles it there.
      ─────────────────────────────────────────────────────────────────────── */}
      <div
        className="md:hidden fixed left-0 right-0 z-40 border-t border-gray-200 dark:border-border bg-white/95 dark:bg-background/95 backdrop-blur"
        style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {/* Saved badge — only when guide is confirmed saved to library */}
        {libraryScriptId && (
          <div className="flex items-center gap-1.5 px-4 pt-2 pb-0">
            <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
            <span className="text-[11px] font-semibold text-green-600 dark:text-green-400">
              Guide saved to Library
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 px-4 py-2">
          {/* Back — icon only on mobile to save space */}
          <Link
            href={backHref}
            aria-label="Back"
            className="shrink-0 inline-flex items-center justify-center rounded-md border border-gray-200 dark:border-border h-9 w-9 text-gray-600 dark:text-muted-foreground hover:bg-gray-50 dark:hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          {/* Primary CTA */}
          {libraryScriptId ? (
            <Button
              asChild
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold gap-2 h-9"
            >
              <Link href="/dashboard/library">
                <BookOpen className="w-4 h-4" />
                Open in Library →
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold gap-2 h-9"
            >
              <Link href={timelineHref}>
                <Video className="w-4 h-4" />
                Create Video →
              </Link>
            </Button>
          )}

          {/* Secondary — timeline if we showed library above */}
          {libraryScriptId && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="shrink-0 border-gray-200 dark:border-border text-gray-700 dark:text-[#E0E0E0] h-9 px-3 gap-1.5 text-xs"
            >
              <Link href={timelineHref}>
                <Video className="w-4 h-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
      <div className="max-w-3xl mx-auto">
        {isYouTubeMode ? (
          <Breadcrumb className="mb-4 text-sm text-gray-600 dark:text-muted-foreground">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard/content-studio">Content Studio</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href={backHref}>Scripts</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Video Guide</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        ) : (
          <Breadcrumb className="mb-4 text-sm text-gray-600 dark:text-muted-foreground">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard/digital-products">Digital Products</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href={backHref}>Scripts</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Video Guide</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        )}
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-muted-foreground hover:text-orange-500 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </Link>

        {/* ── Progress bar — visible at top of page, before all panels ── */}
        {(() => {
          const hasImages = Object.keys(guideSceneImageUrls).length > 0;
          const hasVoiceover = !!(fullVoiceoverUrl || perSceneUrls.some(Boolean));
          const hasVideoFile = autoGeneratePhase === null && autoGeneratingAll === false && hasImages && hasVoiceover;
          const steps: { done: boolean; label: string; tab: "script" | "voice-settings" | "scenes" | "voiceover" | "export" }[] = [
            { done: true,                    label: "Script",         tab: "script" },
            { done: voiceSettingsConfirmed,  label: "Voice Settings", tab: "voice-settings" },
            { done: hasImages,               label: "Scenes",         tab: "scenes" },
            { done: hasVoiceover,            label: "Voiceover",      tab: "voiceover" },
            { done: hasVideoFile,            label: "Export",         tab: "export" },
          ];
          const doneCount = steps.filter((s) => s.done).length;
          const nextStep = steps.find((s) => !s.done);
          return (
            <div className="mb-6 rounded-xl border border-gray-200 dark:border-border bg-gray-50 dark:bg-card px-4 py-3">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wide">
                  Progress — {doneCount}/{steps.length} steps done
                </span>
                {nextStep && (
                  <button
                    type="button"
                    onClick={() => setActiveTab(nextStep.tab)}
                    className="text-xs font-semibold text-orange-500 hover:text-orange-600 whitespace-nowrap"
                  >
                    Next: {nextStep.label} →
                  </button>
                )}
              </div>
              {/* Step pills */}
              <div className="flex flex-wrap gap-2">
                {steps.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setActiveTab(s.tab)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                      s.done
                        ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
                        : s === nextStep
                        ? "bg-orange-50 dark:bg-orange-950/20 border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400"
                        : "bg-white dark:bg-background border-gray-200 dark:border-border text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {s.done
                      ? <CheckCircle2 className="w-3 h-3 shrink-0" />
                      : s === nextStep
                      ? <span className="w-3 h-3 rounded-full border-2 border-orange-400 shrink-0 inline-block" />
                      : <span className="w-3 h-3 rounded-full border-2 border-gray-300 dark:border-gray-600 shrink-0 inline-block" />}
                    {s.label}
                  </button>
                ))}
              </div>
              {/* Progress fill bar */}
              <div className="mt-3 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-orange-500 transition-all duration-500"
                  style={{ width: `${Math.round((doneCount / steps.length) * 100)}%` }}
                />
              </div>
            </div>
          );
        })()}

        {!hasProductName && (
          <div className="mb-6 p-4 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-card">
            <p className="text-sm font-medium text-foreground mb-3">Set your product name so scripts and voiceovers use it instead of &quot;Your product&quot;</p>
            <div className="flex flex-nowrap items-end gap-4">
              {userProducts.length > 0 && (
                <div className="flex flex-col gap-1.5 shrink-0">
                  <label className="text-xs text-gray-500 dark:text-muted-foreground">Select one of your products</label>
                  <Select
                    onValueChange={(value) => {
                      const p = userProducts.find((x) => x.id === value);
                      if (p?.title) {
                        setUserProductName(p.title);
                        onProductNameChange?.(p.title);
                        setProductNameInput("");
                      }
                    }}
                  >
                    <SelectTrigger className="w-[220px] border-gray-200 dark:border-border bg-white dark:bg-background">
                      <SelectValue placeholder="Choose a product..." />
                    </SelectTrigger>
                    <SelectContent>
                      {userProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                <label className="text-xs text-gray-500 dark:text-muted-foreground">{userProducts.length > 0 ? "Or type a name" : "Type your product name"}</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    placeholder="e.g. My App, Fitness Pro"
                    value={productNameInput}
                    onChange={(e) => setProductNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const v = productNameInput.trim();
                        if (v) {
                          setUserProductName(v);
                          onProductNameChange?.(v);
                          setProductNameInput("");
                        }
                      }
                    }}
                    className="flex-1 min-w-[140px] border-gray-200 dark:border-border bg-white dark:bg-background"
                  />
                  <Button
                    className="bg-orange-500 hover:bg-orange-600 text-white shrink-0"
                    onClick={() => {
                      const v = productNameInput.trim();
                      if (v) {
                        setUserProductName(v);
                        onProductNameChange?.(v);
                        setProductNameInput("");
                      }
                    }}
                    disabled={!productNameInput.trim()}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-muted-foreground mt-2">
              Pick a product from your library or type a name. Scripts and voiceovers will use this instead of a placeholder.
            </p>
          </div>
        )}

        {/* ── Script finalisation panel ── */}
        {scripts.length > 0 && (
          <div className="mb-8 rounded-xl border border-orange-200 dark:border-orange-800/50 bg-orange-50/40 dark:bg-orange-950/10 overflow-hidden">
            {/* Header row */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-orange-200 dark:border-orange-800/40 bg-orange-50 dark:bg-orange-950/20">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-500 shrink-0" />
                <span className="text-sm font-semibold text-foreground">Your script</span>
                {scripts.length > 1 && (
                  <span className="text-xs text-gray-500 dark:text-muted-foreground">
                    — {angles[currentAngleIndex]?.name ?? `Angle ${currentAngleIndex + 1}`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {productId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-gray-600 dark:text-muted-foreground hover:text-orange-500 gap-1"
                    onClick={handleRegenerateScript}
                    disabled={regeneratingScript || !hasProductName}
                  >
                    {regeneratingScript ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Regenerate
                  </Button>
                )}
              </div>
            </div>

            {/* Script preview */}
            <div className="px-5 py-4 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-500 mb-1">Hook</p>
                <p className="text-sm text-foreground leading-relaxed line-clamp-3">
                  {displayScript.hook || <span className="text-muted-foreground italic">No hook yet</span>}
                </p>
              </div>
              {displayScript.cta && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-500 mb-1">CTA</p>
                  <p className="text-sm text-foreground leading-relaxed line-clamp-2">{displayScript.cta}</p>
                </div>
              )}

              {/* Arrow navigation between angles */}
              {scripts.length > 1 ? (
                <div className="flex items-center justify-between pt-1 border-t border-orange-100 dark:border-orange-800/30 mt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentAngleIndex((i) => Math.max(0, i - 1))}
                    disabled={currentAngleIndex === 0}
                    className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-muted-foreground hover:text-orange-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <span className="text-xs text-gray-400 dark:text-muted-foreground">
                    {currentAngleIndex + 1} / {scripts.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentAngleIndex((i) => Math.min(scripts.length - 1, i + 1))}
                    disabled={currentAngleIndex === scripts.length - 1}
                    className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-muted-foreground hover:text-orange-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  <span className="text-xs text-green-700 dark:text-green-400 font-medium">
                    Script loaded — scroll down to edit hook, body &amp; CTA
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Video Creation Guide</h1>
            {isYouTubeMode ? (
              <p className="text-gray-600 dark:text-muted-foreground">
                For: {channelName ?? "Your channel"} · Optimized for YouTube growth
              </p>
            ) : (
              <p className="text-gray-600 dark:text-muted-foreground">
                {guide.overview ?? "Multi-platform video marketing guide."}
                {hasProductName && (scriptTitle?.trim() || effectiveProductName) && (
                  <>
                    {" "}
                    <span className="text-foreground font-medium">
                      {cleanProductTitle(scriptTitle ?? effectiveProductName) || scriptTitle || effectiveProductName}
                    </span>
                  </>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground hover:bg-gray-200 dark:hover:bg-muted hover:text-foreground"
              onClick={copyAllPrompts}
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Copy All AI Prompts
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              size="sm"
              onClick={downloadGuide}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download Full Guide
            </Button>
          </div>
        </div>

        {/* ── Quick Actions Strip ── */}
        <div className="flex flex-wrap items-center gap-3 mb-6 px-4 py-3 rounded-xl border border-orange-200 dark:border-orange-800/50 bg-orange-50/40 dark:bg-orange-950/10">
          <span className="text-xs font-semibold uppercase tracking-wider text-orange-500 mr-1 shrink-0">Quick actions</span>
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5 shrink-0"
            onClick={downloadGuide}
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-orange-200 dark:border-orange-800/60 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-950/30 gap-1.5 shrink-0"
            onClick={copyCaption}
          >
            <Copy className="w-3.5 h-3.5" />
            {copiedCaption ? "Copied!" : "Copy Caption"}
          </Button>
          {productId && (
            <Button
              variant="outline"
              size="sm"
              className="border-gray-300 dark:border-border text-gray-700 dark:text-muted-foreground hover:bg-gray-100 dark:hover:bg-muted gap-1.5 shrink-0"
              onClick={() => {
                const url = `${window.location.origin}/guide/${productId}`;
                void navigator.clipboard.writeText(url).then(() => {
                  toast({ title: "Guide link copied!", description: "Share it with your team or view it on mobile." });
                });
              }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Share Guide
            </Button>
          )}
        </div>

        {isYouTubeMode && (
          <Card className="mb-6 border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-950/20 overflow-visible">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                YouTube Optimization
              </CardTitle>
              <CardDescription className="text-sm text-gray-600 dark:text-muted-foreground">
                Checklist for maximum reach and monetization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <label className="flex items-center gap-2 text-foreground cursor-default">
                <span className="text-green-600 dark:text-green-400">☑</span>
                Hook within first 3 seconds
              </label>
              <label className="flex items-center gap-2 text-foreground cursor-default">
                <span className="text-green-600 dark:text-green-400">☑</span>
                Pattern interrupt at 30 seconds (retention cliff)
              </label>
              <label className="flex items-center gap-2 text-foreground cursor-default">
                <span className="text-green-600 dark:text-green-400">☑</span>
                Mid-roll ad placement markers (8min+ videos)
              </label>
              <label className="flex items-center gap-2 text-foreground cursor-default">
                <span className="text-green-600 dark:text-green-400">☑</span>
                End screen CTA (subscribe + next video)
              </label>
              <label className="flex items-center gap-2 text-foreground cursor-default">
                <span className="text-green-600 dark:text-green-400">☑</span>
                SEO-optimized title suggestions
              </label>
              <label className="flex items-center gap-2 text-foreground cursor-default">
                <span className="text-green-600 dark:text-green-400">☑</span>
                Description with timestamps
              </label>
              <label className="flex items-center gap-2 text-foreground cursor-default">
                <span className="text-green-600 dark:text-green-400">☑</span>
                Tag suggestions for algorithm
              </label>
            </CardContent>
          </Card>
        )}

        {/* Video Configuration Panel — removed */}
        {false && <div className="mb-8 border-2 border-orange-200 dark:border-orange-800 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className="w-full p-4 flex justify-between items-center hover:bg-orange-50 dark:hover:bg-orange-950/30 text-left"
          >
            <span className="font-semibold text-lg">⚙️ Video Configuration</span>
            <span className="text-muted-foreground">{showConfig ? "▼" : "▶"}</span>
          </button>

          {showConfig && (
            <div className="p-6 border-t-2 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20">
              {/* Duration */}
              <div className="mb-6">
                <label className="block font-medium mb-3">🎬 Video Duration: {config.duration} minutes</label>
                <div className="flex items-center gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-2"
                    onClick={() => setConfig((c) => ({ ...c, duration: Math.max(5, c.duration - 5) }))}
                  >
                    ⬅️ Shorter (-5 min)
                  </Button>
                  <div className="flex-1 min-w-0">
                    <Slider
                      min={5}
                      max={60}
                      step={5}
                      value={[config.duration]}
                      onValueChange={([v]) => setConfig((c) => ({ ...c, duration: v ?? 10 }))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>5 min</span>
                      <span>30 min</span>
                      <span>60 min</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-2"
                    onClick={() => setConfig((c) => ({ ...c, duration: Math.min(60, c.duration + 5) }))}
                  >
                    Longer (+5 min) ➡️
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Word count: ~{config.duration * 150} words •
                  {config.duration >= 8 ? " ✅ Mid-roll ads enabled" : " ❌ Mid-roll ads disabled (need 8+ min)"}
                </p>
              </div>

              {/* Scene count */}
              <div className="mb-6">
                <label className="block font-medium mb-3">🎞️ Number of Scenes: {config.sceneCount} scenes</label>
                <div className="flex items-center gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfig((c) => ({ ...c, sceneCount: Math.max(4, c.sceneCount - 1) }))}
                  >
                    −
                  </Button>
                  <div className="flex-1 min-w-0">
                    <Slider
                      min={4}
                      max={20}
                      step={1}
                      value={[config.sceneCount]}
                      onValueChange={([v]) => setConfig((c) => ({ ...c, sceneCount: v ?? 8 }))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>4 scenes</span>
                      <span>12 scenes</span>
                      <span>20 scenes</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfig((c) => ({ ...c, sceneCount: Math.min(20, c.sceneCount + 1) }))}
                  >
                    +
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  ~{Math.floor((config.duration * 60) / config.sceneCount)} seconds per scene •
                  {config.sceneCount <= 8 ? " Fewer scenes = more detail per scene" : " More scenes = faster pacing"}
                  {config.duration >= 5 && (
                    <span className="block mt-1">
                      Tip: ~1 scene per minute matches script length for long-form (e.g. {config.duration} min → {Math.min(20, Math.max(8, config.duration))} scenes).
                    </span>
                  )}
                </p>
              </div>

              {/* Voiceover mode */}
              <div className="mb-6">
                <label className="block font-medium mb-3">🎙️ Voiceover Generation Method</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setConfig((c) => ({ ...c, voiceoverMode: "scene-by-scene" }))}
                    className={`p-4 border-2 rounded-lg text-left transition-colors ${
                      config.voiceoverMode === "scene-by-scene"
                        ? "border-orange-500 bg-background"
                        : "border-border bg-background hover:border-orange-300"
                    }`}
                  >
                    <div className="font-medium mb-1">📹 Scene-by-Scene</div>
                    <div className="text-sm text-muted-foreground">
                      Generate individual voiceovers for each scene. Better for editing flexibility, B-roll timing control.
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">{config.sceneCount} separate audio files</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig((c) => ({ ...c, voiceoverMode: "full" }))}
                    className={`p-4 border-2 rounded-lg text-left transition-colors ${
                      config.voiceoverMode === "full"
                        ? "border-orange-500 bg-background"
                        : "border-border bg-background hover:border-orange-300"
                    }`}
                  >
                    <div className="font-medium mb-1">🎬 Full Script</div>
                    <div className="text-sm text-muted-foreground">
                      Generate one continuous voiceover for entire video. Better for natural flow, consistent pacing.
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">1 complete {config.duration}-minute audio file</div>
                  </button>
                </div>
              </div>

              {/* Voice selection */}
              <div className="mb-6">
                <label className="block font-medium mb-3">🗣️ Select Voice</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ELEVENLABS_VOICES.map((voice) => (
                    <button
                      key={voice.voiceId}
                      type="button"
                      onClick={() => {
                        setConfig((c) => ({ ...c, selectedVoice: voice.voiceId }));
                        setVoiceId(voice.voiceId);
                      }}
                      className={`p-4 border-2 rounded-lg text-left transition-colors ${
                        config.selectedVoice === voice.voiceId
                          ? "border-orange-500 bg-background"
                          : "border-border bg-background hover:border-orange-300"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium">{voice.name}</div>
                        {config.selectedVoice === voice.voiceId && (
                          <span className="text-orange-500 text-xs">✓ Selected</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">{voice.description}</div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreviewVoice(voice.voiceId);
                        }}
                        className="text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                      >
                        {previewingVoiceId === voice.voiceId ? (
                          <Loader2 className="w-3 h-3 animate-spin inline" />
                        ) : (
                          "▶ Preview Voice"
                        )}
                      </button>
                    </button>
                  ))}
                </div>
              </div>

              {/* Apply */}
              <div className="flex flex-wrap justify-between items-center gap-4 pt-4 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  Estimated generation time: ~{Math.ceil(config.sceneCount * 2)} seconds
                </div>
                <Button
                  type="button"
                  onClick={handleApplyConfiguration}
                  disabled={regeneratingScenes || !onScenesRegenerated}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                >
                  {regeneratingScenes ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Apply & Regenerate Guide
                </Button>
              </div>

              {/* Full script voiceover — visible here so it shows without scrolling */}
              <div className="pt-6 mt-6 border-t border-border">
                <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5" />
                  Full script voiceover
                </p>
                {fullVoiceoverUrl ? (
                  <div className="flex flex-wrap items-center gap-2 py-2 px-3 rounded-lg bg-gray-100 dark:bg-background border border-gray-200 dark:border-border">
                    <span className="text-sm font-medium text-foreground min-w-[100px] shrink-0">Full script</span>
                    <AudioWithSpeed src={fullVoiceoverUrl} speed={playbackSpeed} controls className="flex-1 min-w-0 max-w-md h-9" />
                    <Button variant="outline" size="sm" className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground shrink-0 gap-1" asChild>
                      <a href={fullVoiceoverUrl} download="voiceover-full.mp3">
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </a>
                    </Button>
                    {fullVoiceoverDuration != null && !Number.isNaN(fullVoiceoverDuration) && (
                      <span className="text-sm text-gray-600 dark:text-muted-foreground shrink-0">{formatDuration(fullVoiceoverDuration)}</span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground shrink-0 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                      onClick={handleDeleteFullVoiceover}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </Button>
                  </div>
                ) : (
                  <div className="py-3 px-3 rounded-lg bg-gray-100 dark:bg-background border border-gray-200 dark:border-border">
                    <p className="text-sm text-gray-600 dark:text-muted-foreground mb-3 flex items-center gap-2">
                      <Mic className="w-4 h-4 text-orange-500 shrink-0" />
                      No full voiceover yet. Generate one below — it will appear here.
                    </p>
                    <Button
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
                      onClick={handleGenerateFullVoiceover}
                      disabled={generatingFull || !fullScriptText.trim() || !hasProductName}
                      title={!hasProductName ? "Set your product name above" : !fullScriptText.trim() ? "Add script content in Full Script section below" : undefined}
                    >
                      {generatingFull ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
                      Generate Voiceover
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>}

        {activeTab === "script" && <Card className="mb-8 border-gray-200 dark:border-border bg-gray-50 dark:bg-card overflow-visible">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-foreground flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-500" />
                Full Script
                {!hasProductName && (
                  <span className="text-xs font-normal text-amber-600 dark:text-amber-400" title="Regenerate and voiceover need a product name to personalize the script.">
                    — Set product name above to enable buttons
                  </span>
                )}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground hover:bg-gray-200 dark:hover:bg-muted hover:text-foreground"
                  onClick={() => handleRegenerateFullScript()}
                  disabled={regeneratingFullScript || !hasProductName}
                  title={!hasProductName ? "Set your product name above to enable" : undefined}
                >
                  {regeneratingFullScript ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Regenerate Full Script
                </Button>
                {libraryScriptId && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground hover:bg-gray-200 dark:hover:bg-muted hover:text-foreground"
                      onClick={() => handleRegenerateFullScript("shorter")}
                      disabled={regeneratingFullScript || !hasProductName}
                      title="Cut script by ~30%; keep hook and CTA intact"
                    >
                      Shorter
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground hover:bg-gray-200 dark:hover:bg-muted hover:text-foreground"
                      onClick={() => handleRegenerateFullScript("longer")}
                      disabled={regeneratingFullScript || !hasProductName}
                      title="Expand body by ~30%; more pain agitation or social proof"
                    >
                      Longer
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground hover:bg-gray-200 dark:hover:bg-muted hover:text-foreground"
                  onClick={handleGenerateFullVoiceover}
                  disabled={generatingFull || !fullScriptText.trim() || !hasProductName}
                  title={!hasProductName ? "Set your product name above to enable" : !fullScriptText.trim() ? "Add script content first" : undefined}
                >
                  {generatingFull ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Mic className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Generate Voiceover
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground hover:bg-gray-200 dark:hover:bg-muted hover:text-foreground"
                  onClick={handleGeneratePerSceneVoiceover}
                  disabled={generatingPerScene || getSceneTexts().length === 0 || !hasProductName}
                  title={!hasProductName ? "Set your product name above to enable" : getSceneTexts().length === 0 ? "Scene breakdown required" : undefined}
                >
                  {generatingPerScene ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Mic className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Generate Scene Voiceovers
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground hover:bg-gray-200 dark:hover:bg-muted hover:text-foreground"
                  onClick={copyFullScript}
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copy Script
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-gray-600 dark:text-muted-foreground whitespace-pre-line overflow-visible">
            {/* Full Voiceover — same style as Scene Voiceovers: one row with native audio when present */}
            <div className="pt-2 border-t border-gray-200 dark:border-border">
              <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5" />
                Full Voiceover
              </p>
              {fullVoiceoverUrl ? (
                <div className="flex flex-wrap items-center gap-2 py-2 px-3 rounded-lg bg-gray-100 dark:bg-background border border-gray-200 dark:border-border">
                  <span className="text-sm font-medium text-foreground min-w-[100px] shrink-0">Full script</span>
                  <AudioWithSpeed src={fullVoiceoverUrl} speed={playbackSpeed} controls className="flex-1 min-w-0 max-w-md h-9" />
                  <Button variant="outline" size="sm" className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground shrink-0 gap-1" asChild>
                    <a href={fullVoiceoverUrl} download="voiceover-full.mp3">
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </a>
                  </Button>
                  {fullVoiceoverDuration != null && !Number.isNaN(fullVoiceoverDuration) && (
                    <span className="text-sm text-gray-600 dark:text-muted-foreground shrink-0">{formatDuration(fullVoiceoverDuration)}</span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground shrink-0 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                    onClick={handleDeleteFullVoiceover}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </Button>
                </div>
              ) : (
                <div className="py-3 px-3 rounded-lg bg-gray-100 dark:bg-background border border-gray-200 dark:border-border">
                  <p className="text-sm text-gray-600 dark:text-muted-foreground flex items-center gap-2">
                    <Mic className="w-4 h-4 text-orange-500 shrink-0" />
                    No full voiceover yet. Click <strong>Generate Voiceover</strong> above to create it — it will show here with a play bar, same as scene voiceovers.
                  </p>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-1">Hook</p>
              <textarea
                value={currentScriptForDisplay.hook}
                onChange={(e) => setEditedScript((prev) => ({ ...(prev ?? displayScript), hook: e.target.value }))}
                onBlur={handleScriptBlur}
                rows={Math.min(14, Math.max(6, Math.ceil((currentScriptForDisplay.hook || "").split(/\n/).length) + 2))}
                className="w-full min-h-[12rem] px-3 py-2 rounded-md border border-gray-200 dark:border-border bg-white dark:bg-background text-foreground break-words resize-y text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Hook (0–3s)..."
              />
            </div>
            <div className="min-w-0">
              <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-1">Body</p>
              <textarea
                value={currentScriptForDisplay.body}
                onChange={(e) => setEditedScript((prev) => ({ ...(prev ?? displayScript), body: e.target.value }))}
                onBlur={handleScriptBlur}
                rows={Math.min(50, Math.max(20, Math.ceil((currentScriptForDisplay.body || "").split(/\n/).length) + 2))}
                className="w-full min-h-[32rem] px-3 py-2 rounded-md border border-gray-200 dark:border-border bg-white dark:bg-background text-foreground break-words resize-y text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Body..."
              />
            </div>
            <div className="min-w-0">
              <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-1">CTA</p>
              <textarea
                value={currentScriptForDisplay.cta}
                onChange={(e) => setEditedScript((prev) => ({ ...(prev ?? displayScript), cta: e.target.value }))}
                onBlur={handleScriptBlur}
                rows={Math.min(12, Math.max(6, Math.ceil((currentScriptForDisplay.cta || "").split(/\n/).length) + 2))}
                className="w-full min-h-[8rem] px-3 py-2 rounded-md border border-gray-200 dark:border-border bg-white dark:bg-background text-foreground break-words resize-y text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Call to action..."
              />
            </div>
            <div className="pt-2 border-t border-gray-200 dark:border-border text-xs text-gray-500 dark:text-muted-foreground">
              {scriptStats.words > 0 ? `~${scriptStats.estimatedSeconds} ${scriptStats.estimatedSeconds === 1 ? "second" : "seconds"} at normal pace` : "—"} · {scriptStats.characters} characters · {scriptStats.words} words
            </div>

            {/* Inline preview audio (hidden) for Play button */}
            <audio ref={previewAudioRef} className="sr-only" preload="metadata" />

            {/* Scene Voiceovers — list with Play, Download, duration, Delete per scene */}
            {perSceneUrls.some(Boolean) && (
              <div className="pt-4 border-t border-gray-200 dark:border-border">
                <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5" />
                  Scene Voiceovers
                </p>
                <ul className="space-y-2">
                  {perSceneUrls.map((url, i) => {
                    if (!url) return null;
                    const duration = perSceneDurations[i];
                    const timingLabel = scenes[i]?.timing ? `Scene ${i + 1} (${scenes[i].timing})` : `Scene ${i + 1} Voiceover`;
                    return (
                      <li
                        key={i}
                        className="flex flex-wrap items-center gap-2 py-2 px-3 rounded-lg bg-gray-100 dark:bg-background border border-gray-200 dark:border-border"
                      >
                        <span className="text-sm font-medium text-foreground min-w-[120px]">
                          {timingLabel}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground shrink-0 gap-1"
                          onClick={() => handlePlayPreview(url)}
                        >
                          {playingPreviewUrl === url ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          {playingPreviewUrl === url ? "Stop" : "Play"}
                        </Button>
                        <Button variant="outline" size="sm" className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground shrink-0 gap-1" asChild>
                          <a href={url} download={`voiceover-scene-${i + 1}.mp3`}>
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </a>
                        </Button>
                        {duration != null && !Number.isNaN(duration) && (
                          <span className="text-sm text-gray-600 dark:text-muted-foreground shrink-0">{formatDuration(duration)}</span>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground shrink-0 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                          onClick={() => handleDeleteSceneVoiceover(i)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>}

        {/* ── Step navigation footer (script step) ── */}
        {activeTab === "script" && (
          <div className="flex justify-end mb-8">
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6"
              onClick={() => setActiveTab("voice-settings")}
            >
              Continue to Voice Settings →
            </Button>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="hidden">
            <TabsTrigger value="voice-settings" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs">
              Voice Settings
            </TabsTrigger>
            <TabsTrigger value="scenes" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs">
              Your Video Plan
              {guide.videoFormat?.aspectRatio && (
                <span className="ml-1.5 opacity-80" title={guide.videoFormat.orientation === "horizontal" ? "YouTube horizontal format" : "Vertical short-form format"}>
                  {guide.videoFormat.aspectRatio === "16:9" ? " (16:9)" : " (9:16)"}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="editing" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs">
              How to Edit
            </TabsTrigger>
            <TabsTrigger value="subtitles" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs">
              Subtitles
            </TabsTrigger>
            <TabsTrigger value="music" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs">
              Music
            </TabsTrigger>
            <TabsTrigger value="export" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs">
              Export
            </TabsTrigger>
            <TabsTrigger value="social-kit" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs">
              Captions & Hashtags
            </TabsTrigger>
            <TabsTrigger value="voiceover" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs">
              Voiceover
            </TabsTrigger>
          </TabsList>

          {/* ─────────────────────────── VOICE SETTINGS TAB ─────────────────────────── */}
          <TabsContent value="voice-settings" className="mt-6 space-y-6">
            <Card className="border-gray-200 dark:border-border bg-gray-50 dark:bg-card">
              <CardHeader>
                <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-orange-500" />
                  Voice Settings
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-muted-foreground">
                  Choose the voice, style, and speed for your video. These settings are used for all voiceovers — including "Build My Video".
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">

                {/* ── 1. Voice picker ── */}
                <div>
                  <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-3">Choose a voice</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {ELEVENLABS_VOICES.map((v) => {
                      const selected = voiceId === v.voiceId;
                      const loading = previewingVoiceId === v.voiceId;
                      return (
                        <div
                          key={v.voiceId}
                          onClick={() => setVoiceId(v.voiceId)}
                          className={`rounded-lg border-2 p-3 flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                            selected
                              ? "border-orange-500 bg-orange-500/10 text-foreground"
                              : "border-gray-200 dark:border-border bg-gray-100 dark:bg-background hover:border-gray-300 dark:hover:border-[#3A3A3A]"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              {selected && <Check className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                              <span className="block font-medium text-sm">{v.name}</span>
                            </div>
                            <span className="block text-xs text-gray-500 dark:text-muted-foreground mt-0.5">{v.description}</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground shrink-0 h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewVoice(v.voiceId);
                            }}
                            disabled={loading}
                            title="Preview voice"
                          >
                            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── 2. Speaking style ── */}
                <div>
                  <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-3">Speaking style</p>
                  <div className="flex flex-wrap gap-2">
                    {SPEAKING_STYLES.map((style) => {
                      const active = speakingStyle === style.label;
                      return (
                        <button
                          key={style.label}
                          type="button"
                          onClick={() => {
                            setSpeakingStyle(style.label);
                            setStability(style.stability);
                            setSimilarity(style.similarity);
                          }}
                          className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                            active
                              ? "bg-orange-500 border-orange-500 text-white"
                              : "border-gray-200 dark:border-border bg-white dark:bg-background text-gray-600 dark:text-muted-foreground hover:border-orange-400 hover:text-orange-500"
                          }`}
                        >
                          {style.label}
                          <span className={`block text-xs font-normal mt-0.5 ${active ? "text-orange-100" : "text-gray-400 dark:text-gray-500"}`}>
                            {style.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── 3. Speaking speed ── */}
                <div>
                  <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-3">Speaking speed</p>
                  <div className="max-w-xs space-y-2">
                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-muted-foreground">
                      <span>Speed</span>
                      <span className="font-medium text-foreground">{playbackSpeed.toFixed(1)}×</span>
                    </div>
                    <Slider
                      value={[playbackSpeed]}
                      onValueChange={([v]) => setPlaybackSpeed(v)}
                      min={0.5}
                      max={2}
                      step={0.1}
                    />
                    <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                      <span>0.5× Slow</span>
                      <span>2.0× Fast</span>
                    </div>
                  </div>
                </div>

                {/* ── 4. Remember as default ── */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setRememberVoiceDefault((v) => !v)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                      rememberVoiceDefault
                        ? "bg-orange-500 border-orange-500"
                        : "border-gray-300 dark:border-border bg-white dark:bg-background"
                    }`}
                  >
                    {rememberVoiceDefault && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <span className="text-sm text-gray-600 dark:text-muted-foreground">
                    Remember this as my default voice for future videos
                  </span>
                </div>

                {/* ── 5. Confirm button ── */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-border">
                  <button
                    type="button"
                    onClick={() => setActiveTab("script")}
                    className="text-sm text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    ← Back to Script
                  </button>
                  <Button
                    className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 gap-2"
                    onClick={() => {
                      if (rememberVoiceDefault) setDefaultVoiceId(voiceId);
                      setVoiceSettingsConfirmed(true);
                      setActiveTab("scenes");
                    }}
                  >
                    <Check className="w-4 h-4" />
                    Confirm &amp; Continue to Scenes →
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scenes" className="mt-6 space-y-4">
            {onScenesRegenerated && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground hover:bg-gray-200 dark:hover:bg-muted hover:text-foreground"
                  onClick={handleRegenerateScenes}
                  disabled={regeneratingScenes || !displayScript.hook?.trim()}
                >
                  {regeneratingScenes ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Regenerate Scenes
                </Button>
              </div>
            )}

            {scenes.map((scene, i) => {
              const fullPrompt = getSceneFullPrompt(scene);
              const rawOverlay = (scene as { textOverlay?: unknown }).textOverlay;
              const overlayObjs: TextOverlayObj[] =
                rawOverlay == null
                  ? []
                  : typeof rawOverlay === "string"
                    ? [{ exactText: rawOverlay }]
                    : Array.isArray(rawOverlay)
                      ? rawOverlay.map((o) => (typeof o === "object" && o && "exactText" in o ? (o as TextOverlayObj) : { exactText: String(o) }))
                      : typeof rawOverlay === "object" && rawOverlay && "exactText" in (rawOverlay as object)
                        ? [rawOverlay as TextOverlayObj]
                        : [];
              const vd = (scene as { visualDirection?: VisualDirection }).visualDirection;
              const transition = (scene as { transition?: { toNextScene?: string; effects?: string; pacing?: string } }).transition;
              return (
                <Card key={i} className="border-gray-200 dark:border-border bg-gray-50 dark:bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium text-foreground flex items-center justify-between gap-2 flex-wrap">
                      <span>Scene {i + 1} · {scene.timing}</span>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const ar = guide.videoFormat?.aspectRatio ?? (scene as { format?: { aspect_ratio?: string } }).format?.aspect_ratio ?? "9:16";
                            const prompt = `${fullPrompt || ""} --ar ${ar} --v 6 --style raw`;
                            navigator.clipboard.writeText(prompt)
                              .then(() => toast({ title: "Copied", description: "AI image prompt copied" }))
                              .catch(() => toast({ title: "Copy failed", variant: "destructive" }));
                          }}
                          className="h-7 px-2 text-xs rounded border border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground bg-gray-100 dark:bg-background hover:bg-white hover:text-gray-900 dark:hover:bg-muted dark:hover:text-white cursor-pointer"
                        >
                          Copy AI Prompt
                        </button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-gray-600 dark:text-muted-foreground">
                    {(() => {
                      const ar =
                        guide.videoFormat?.aspectRatio ??
                        (scene as { format?: { aspect_ratio?: string } }).format?.aspect_ratio ??
                        "9:16";
                      const aspectCls = ar === "16:9" ? "aspect-video max-w-2xl" : "aspect-[9/16] max-w-sm";
                      const genImageUrl = guideSceneImageUrls[i];
                      const sceneImageBusy = guideSceneImageLoadingIndex === i || guideBulkImagesLoading;
                      const voiceLine = getSceneTexts()[i] ?? "";
                      const overlaySummary =
                        overlayObjs.length > 0
                          ? overlayObjs.map((o) => stripMarkdown(o.exactText ?? "")).filter(Boolean).join("\n\n")
                          : "—";
                      const sceneLabel = (scene as { scene?: string }).scene?.trim();
                      const sceneTitleText = sceneLabel
                        ? `${sceneLabel} · ${scene.timing}`
                        : `Scene ${i + 1} · ${scene.timing}`;
                      const videoPreviewClass =
                        ar === "16:9"
                          ? "w-full rounded-md mt-2 aspect-video object-cover"
                          : "w-full rounded-md mt-2 aspect-[9/16] object-cover";
                      const coachAudioUrl = guideCoachVoiceoverUrls[i] ?? perSceneUrls[i] ?? null;
                      return (
                        <div className="space-y-3">
                          <div>
                            <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-1">Scene title</p>
                            <p className="text-foreground font-medium">{sceneTitleText}</p>
                          </div>
                          <div>
                            <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-1">Dialogue / text overlay</p>
                            <p className="text-foreground whitespace-pre-wrap">{overlaySummary}</p>
                          </div>
                          <div>
                            <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-1">Voiceover</p>
                            <p className="text-foreground whitespace-pre-wrap mb-2">{voiceLine.trim() || "—"}</p>
                            <AiStorySceneVoiceover
                              voiceId={voiceId}
                              dialogueLine={voiceLine}
                              audioUrl={coachAudioUrl}
                              onAudioUrl={(url) =>
                                setGuideCoachVoiceoverUrls((prev) => ({ ...prev, [i]: url }))
                              }
                              maxDurationSeconds={VIDEO_GUIDE_TIMELINE_SCENE_SEC}
                            />
                          </div>
                        </div>
                      );
                    })()}
                    {(() => {
                      const sceneAr = guide.videoFormat?.aspectRatio ?? (scene as { format?: { aspect_ratio?: string } }).format?.aspect_ratio ?? "9:16";
                      const sceneIs169 = sceneAr === "16:9";
                      const sceneImgUrl = guideSceneImageUrls[i];
                      const sceneBusy = guideSceneImageLoadingIndex === i || guideBulkImagesLoading;

                      // ── Dark Infographic: show slide preview card instead of AI prompt + generate button ──
                      if (vd?.mediaType === "dark_infographic") {
                        const slideRef = (el: HTMLDivElement | null) => {
                          darkSlideRefs.current[i] = el;
                        };
                        const accentColors = ["#22d3ee", "#a3e635", "#fbbf24", "#f472b6", "#818cf8"];
                        const accent = accentColors[i % accentColors.length];

                        const handleExportSlide = async () => {
                          const el = darkSlideRefs.current[i];
                          if (!el) return;
                          try {
                            const html2canvas = (await import("html2canvas")).default;
                            const canvas = await html2canvas(el, { backgroundColor: "#000000", scale: 2, useCORS: true });
                            const link = document.createElement("a");
                            link.download = `scene-${i + 1}-infographic.png`;
                            link.href = canvas.toDataURL("image/png");
                            link.click();
                          } catch {
                            toast({ title: "Export failed", description: "Could not capture the slide", variant: "destructive" });
                          }
                        };

                        // Hoist pts / helpers so both the graphic IIFE and the bullet list can use them
                        const slidePts = Array.isArray(vd.slidePoints) ? vd.slidePoints : [];
                        const slideTr = (s: string, max = 22) => s.length > max ? s.slice(0, max - 1) + "…" : s;
                        const slideTwoLines = (s: string, max = 14): [string, string] => {
                          if (s.length <= max) return [s, ""];
                          const words = s.split(" ");
                          let l1 = "";
                          for (const w of words) {
                            if ((l1 + (l1 ? " " : "") + w).length > max) break;
                            l1 += (l1 ? " " : "") + w;
                          }
                          return [l1 || s.slice(0, max), s.slice(l1.length).trim()];
                        };

                        return (
                          <div className="space-y-3">
                            <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-1">Slide preview</p>

                            {/* Slide preview card — flex column, fills 9:16 with no dead zones */}
                            <div
                              ref={slideRef}
                              className="rounded-xl overflow-hidden w-full max-w-sm mx-auto"
                              style={{
                                background: "#000",
                                backgroundImage: "radial-gradient(ellipse at 20% 20%, rgba(255,215,0,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(255,215,0,0.1) 0%, transparent 50%)",
                                aspectRatio: "9/16",
                                fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
                                display: "flex",
                                flexDirection: "column",
                                padding: "5%",
                                boxSizing: "border-box",
                              }}
                            >
                              {/* Scene number badge + slide type label */}
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, flexShrink: 0 }}>
                                <span style={{ background: accent, color: "#000", fontWeight: 900, fontSize: 10, padding: "2px 8px", borderRadius: 99 }}>
                                  {String(i + 1).padStart(2, "0")}
                                </span>
                                <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
                                  {vd.slideType?.replace(/_/g, " ") ?? ""}
                                </span>
                              </div>

                              {/* Title */}
                              {vd.slideTitle && (
                                <p style={{ color: "white", fontWeight: 800, fontSize: "clamp(13px, 3.8vw, 19px)", lineHeight: 1.25, margin: "0 0 10px", flexShrink: 0 }}>
                                  {vd.slideTitle.split(" ").map((word, wi) =>
                                    word.toLowerCase() === vd.highlightWord?.toLowerCase()
                                      ? <span key={wi} style={{ color: "#facc15" }}>{word} </span>
                                      : <span key={wi}>{word} </span>
                                  )}
                                </p>
                              )}

                              {/* ── Graphic area (flex: 1, fills middle) ── */}
                              <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 100, overflow: "hidden" }}>
                              {(() => {
                                const pts = slidePts;
                                const tr = slideTr;
                                const twoLines = slideTwoLines;

                                /* ── Napkin AI diagram (server-generated PNG) takes priority ── */
                                if (vd.diagramUrl && i !== scenes.length - 1) {
                                  return (
                                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      <img
                                        src={vd.diagramUrl}
                                        alt="Diagram"
                                        crossOrigin="anonymous"
                                        style={{
                                          width: "100%",
                                          maxHeight: "100%",
                                          objectFit: "contain",
                                          borderRadius: 8,
                                          display: "block",
                                          filter: "invert(1)",
                                        }}
                                      />
                                    </div>
                                  );
                                }

                                /* ── Last scene: always show the product mockup ── */
                                if (i === scenes.length - 1 && productThumbnailUrl) {
                                  return (
                                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      <img
                                        src={productThumbnailUrl}
                                        alt="Product mockup"
                                        crossOrigin="anonymous"
                                        style={{
                                          maxHeight: "100%",
                                          maxWidth: "85%",
                                          objectFit: "contain",
                                          borderRadius: 12,
                                          display: "block",
                                          filter: `drop-shadow(0 0 18px ${accent}66)`,
                                        }}
                                      />
                                    </div>
                                  );
                                }

                                /* ── Funnel ── */
                                if (vd.slideType === "funnel") {
                                  const layers = [
                                    { pts: "10,2 290,2 252,64 48,64",  fill: "rgba(0,212,255,0.2)",  stroke: "#00D4FF", cy: 38, col: "#00D4FF" },
                                    { pts: "48,68 252,68 215,130 85,130", fill: "rgba(0,255,136,0.2)", stroke: "#00FF88", cy: 104, col: "#00FF88" },
                                    { pts: "85,134 215,134 188,194 112,194", fill: "rgba(163,230,53,0.2)", stroke: "#a3e635", cy: 170, col: "#a3e635" },
                                  ];
                                  return (
                                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                      <svg viewBox="0 0 300 200" width="100%" style={{ flex: 1, display: "block", minHeight: 80 }} xmlns="http://www.w3.org/2000/svg">
                                        {layers.map((l, li) => {
                                          const [line1, line2] = twoLines(pts[li] ?? `Layer ${li + 1}`, 26);
                                          return (
                                            <g key={li}>
                                              <polygon points={l.pts} fill={l.fill} stroke={l.stroke} strokeWidth="1.5" />
                                              {line2 ? (
                                                <>
                                                  <text x="150" y={l.cy - 6} textAnchor="middle" fill={l.col} fontSize="10" fontWeight="bold" fontFamily="sans-serif">{line1}</text>
                                                  <text x="150" y={l.cy + 8} textAnchor="middle" fill={l.col} fontSize="10" fontWeight="bold" fontFamily="sans-serif">{tr(line2, 26)}</text>
                                                </>
                                              ) : (
                                                <text x="150" y={l.cy + 4} textAnchor="middle" fill={l.col} fontSize="10" fontWeight="bold" fontFamily="sans-serif">{line1}</text>
                                              )}
                                            </g>
                                          );
                                        })}
                                      </svg>
                                    </div>
                                  );
                                }

                                /* ── Steps ── */
                                if (vd.slideType === "steps") {
                                  const boxes = [
                                    { x: 5,   col: "#00D4FF", fill: "rgba(0,212,255,0.15)",   cx: 46  },
                                    { x: 109, col: "#00FF88", fill: "rgba(0,255,136,0.15)",   cx: 150 },
                                    { x: 213, col: "#FFD700", fill: "rgba(255,215,0,0.15)",   cx: 254 },
                                  ];
                                  return (
                                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                      <svg viewBox="0 0 300 125" width="100%" style={{ flex: 1, display: "block", minHeight: 80 }} xmlns="http://www.w3.org/2000/svg">
                                        {boxes.map((b, bi) => {
                                          const label = pts[bi] ?? `Step ${bi + 1}`;
                                          const [l1, l2] = twoLines(label, 12);
                                          return (
                                            <g key={bi}>
                                              <rect x={b.x} y="5" width="82" height="115" rx="8" fill={b.fill} stroke={b.col} strokeWidth="1.5" />
                                              {/* Step number */}
                                              <text x={b.cx} y="44" textAnchor="middle" fill={b.col} fontSize="28" fontWeight="900" fontFamily="sans-serif">{bi + 1}</text>
                                              {/* Label line 1 */}
                                              <text x={b.cx} y="68" textAnchor="middle" fill="white" fontSize="9" fontFamily="sans-serif">{l1}</text>
                                              {/* Label line 2 if needed */}
                                              {l2 && <text x={b.cx} y="80" textAnchor="middle" fill="white" fontSize="9" fontFamily="sans-serif">{tr(l2, 12)}</text>}
                                              {/* Arrow to next box */}
                                              {bi < 2 && (
                                                <>
                                                  <line x1={b.x + 85} y1="62" x2={b.x + 100} y2="62" stroke={b.col} strokeWidth="1.5" />
                                                  <polygon points={`${b.x + 99},57 ${b.x + 106},62 ${b.x + 99},67`} fill={b.col} />
                                                </>
                                              )}
                                            </g>
                                          );
                                        })}
                                      </svg>
                                    </div>
                                  );
                                }

                                /* ── Stat Callout ── */
                                if (vd.slideType === "stat_callout") {
                                  const rawStat = pts[0] ?? "";
                                  const m = rawStat.match(/(\d[\d,.]*([\s]*[%xX+kmKMbB])?)/);
                                  const bigStat = m ? m[0].trim() : tr(rawStat, 6);
                                  const caption = rawStat.replace(bigStat, "").replace(/^[-–:,\s]+/, "").trim();
                                  const restPoints = pts.slice(1);
                                  return (
                                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                      <svg viewBox="0 0 300 145" width="100%" style={{ flex: 1, display: "block", minHeight: 80 }} xmlns="http://www.w3.org/2000/svg">
                                        {/* Dashed ring */}
                                        <circle cx="150" cy="70" r="66" fill="rgba(255,215,0,0.07)" stroke="#FFD700" strokeWidth="1.5" strokeDasharray="6 4" />
                                        {/* Big number */}
                                        <text x="150" y="85" textAnchor="middle" fill="#FFD700" fontSize="56" fontWeight="900" fontFamily="sans-serif">{bigStat}</text>
                                        {/* Caption inside ring */}
                                        {caption && (
                                          <text x="150" y="106" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="10" fontFamily="sans-serif">{tr(caption, 30)}</text>
                                        )}
                                      </svg>
                                      {/* Remaining points below the ring */}
                                      {restPoints.length > 0 && (
                                        <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 0" }}>
                                          {restPoints.map((pt, pi) => (
                                            <li key={pi} className="flex items-start gap-2 text-white" style={{ fontSize: "clamp(10px, 2.5vw, 13px)", marginBottom: 4 }}>
                                              <span className="shrink-0 rounded-full" style={{ width: 7, height: 7, background: accentColors[(pi + 1) % accentColors.length], marginTop: 4, flexShrink: 0 }} />
                                              <span>{pt}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  );
                                }

                                /* ── VS Comparison ── */
                                if (vd.slideType === "vs_comparison") {
                                  const leftLabel = pts[0] ?? "Option A";
                                  const rightLabel = pts[1] ?? "Option B";
                                  const extra = pts.slice(2);
                                  const [ll1, ll2] = twoLines(leftLabel, 13);
                                  const [rl1, rl2] = twoLines(rightLabel, 13);
                                  return (
                                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                      <svg viewBox="0 0 300 155" width="100%" style={{ flex: 1, display: "block", minHeight: 80 }} xmlns="http://www.w3.org/2000/svg">
                                        {/* Left circle — pink/red */}
                                        <circle cx="82" cy="70" r="62" fill="rgba(255,107,157,0.18)" stroke="#FF6B9D" strokeWidth="1.5" />
                                        <text x="82" y={ll2 ? "66" : "74"} textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="sans-serif">{ll1}</text>
                                        {ll2 && <text x="82" y="80" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="sans-serif">{tr(ll2, 13)}</text>}
                                        <text x="82" y="145" textAnchor="middle" fill="#FF6B9D" fontSize="9" fontWeight="bold" fontFamily="sans-serif">Option A</text>

                                        {/* VS badge */}
                                        <text x="150" y="78" textAnchor="middle" fill="#FFD700" fontSize="20" fontWeight="900" fontFamily="sans-serif">VS</text>

                                        {/* Right circle — green */}
                                        <circle cx="218" cy="70" r="62" fill="rgba(0,255,136,0.18)" stroke="#00FF88" strokeWidth="1.5" />
                                        <text x="218" y={rl2 ? "66" : "74"} textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="sans-serif">{rl1}</text>
                                        {rl2 && <text x="218" y="80" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="sans-serif">{tr(rl2, 13)}</text>}
                                        <text x="218" y="145" textAnchor="middle" fill="#00FF88" fontSize="9" fontWeight="bold" fontFamily="sans-serif">Option B</text>
                                      </svg>
                                      {extra.length > 0 && (
                                        <ul style={{ listStyle: "none", padding: 0, margin: "4px 0 0" }}>
                                          {extra.map((pt, pi) => (
                                            <li key={pi} className="flex items-start gap-2 text-white" style={{ fontSize: "clamp(10px, 2.5vw, 13px)", marginBottom: 4 }}>
                                              <span className="shrink-0 rounded-full" style={{ width: 7, height: 7, background: accentColors[(pi + 2) % accentColors.length], marginTop: 4 }} />
                                              <span>{pt}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  );
                                }

                                /* ── Shuffled position-based graphic (text_hook + fallback) ── */
                                if (vd.slideType === "text_hook" || pts.length === 0) {
                                  const gType = darkInfographicGraphicOrder[i % darkInfographicGraphicOrder.length];

                                  /* ⚡ Lightning bolt */
                                  if (gType === "bolt") return (
                                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                      <svg viewBox="0 0 300 170" width="100%" style={{ flex: 1, display: "block", minHeight: 80 }} xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="150" cy="85" r="78" fill="none" stroke={accent} strokeWidth="1" opacity="0.1" />
                                        <circle cx="150" cy="85" r="60" fill="none" stroke={accent} strokeWidth="1" opacity="0.16" />
                                        {[0,45,90,135,180,225,270,315].map((deg, di) => {
                                          const r = (deg * Math.PI) / 180;
                                          return <line key={di} x1={150+Math.cos(r)*62} y1={85+Math.sin(r)*62} x2={150+Math.cos(r)*78} y2={85+Math.sin(r)*78} stroke={accent} strokeWidth="1.5" opacity="0.35" />;
                                        })}
                                        <polygon points="168,18 106,98 142,98 116,158 194,78 158,78" fill={accent} opacity="0.15" />
                                        <polygon points="168,18 106,98 142,98 116,158 194,78 158,78" fill="none" stroke={accent} strokeWidth="2" opacity="0.9" />
                                        <polygon points="162,30 118,94 146,94 124,148 184,84 156,84" fill={accent} opacity="0.07" />
                                      </svg>
                                    </div>
                                  );

                                  /* 📊 Rising bars chart */
                                  if (gType === "bars") return (
                                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                      <svg viewBox="0 0 300 170" width="100%" style={{ flex: 1, display: "block", minHeight: 80 }} xmlns="http://www.w3.org/2000/svg">
                                        <line x1="28" y1="10" x2="28" y2="152" stroke={accent} strokeWidth="1" opacity="0.35" />
                                        <polygon points="24,14 28,4 32,14" fill={accent} opacity="0.5" />
                                        <line x1="28" y1="152" x2="285" y2="152" stroke={accent} strokeWidth="1" opacity="0.35" />
                                        {[{x:42,h:28,o:0.28},{x:90,h:55,o:0.42},{x:138,h:85,o:0.57},{x:186,h:112,o:0.72},{x:234,h:138,o:0.9}].map((b,bi) => (
                                          <rect key={bi} x={b.x} y={152-b.h} width="34" height={b.h} fill={accent} opacity={b.o} rx="3" />
                                        ))}
                                        <polyline points="59,124 107,97 155,67 203,40 251,14" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.45" strokeDasharray="4 3" />
                                      </svg>
                                    </div>
                                  );

                                  /* 🎯 Bullseye / target */
                                  if (gType === "bullseye") return (
                                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                      <svg viewBox="0 0 300 170" width="100%" style={{ flex: 1, display: "block", minHeight: 80 }} xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="150" cy="85" r="76" fill="none" stroke={accent} strokeWidth="1"   opacity="0.1"  />
                                        <circle cx="150" cy="85" r="58" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.18" />
                                        <circle cx="150" cy="85" r="40" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.3"  />
                                        <circle cx="150" cy="85" r="22" fill={accent} opacity="0.12" stroke={accent} strokeWidth="1.5" strokeOpacity="0.6" />
                                        <circle cx="150" cy="85" r="7"  fill={accent} opacity="0.9"  />
                                        <line x1="70"  y1="85" x2="122" y2="85" stroke={accent} strokeWidth="1" opacity="0.3" />
                                        <line x1="178" y1="85" x2="230" y2="85" stroke={accent} strokeWidth="1" opacity="0.3" />
                                        <line x1="150" y1="9"  x2="150" y2="57" stroke={accent} strokeWidth="1" opacity="0.3" />
                                        <line x1="150" y1="113" x2="150" y2="161" stroke={accent} strokeWidth="1" opacity="0.3" />
                                      </svg>
                                    </div>
                                  );

                                  /* ∧∧∧ Triple upward chevrons */
                                  if (gType === "chevrons") return (
                                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                      <svg viewBox="0 0 300 170" width="100%" style={{ flex: 1, display: "block", minHeight: 80 }} xmlns="http://www.w3.org/2000/svg">
                                        <polyline points="70,138 150,98 230,138" fill="none" stroke={accent} strokeWidth="3"   strokeLinecap="round" strokeLinejoin="round" opacity="0.25" />
                                        <polyline points="70,108 150,68  230,108" fill="none" stroke={accent} strokeWidth="3"   strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
                                        <polyline points="70,78  150,38  230,78"  fill="none" stroke={accent} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"  />
                                        <circle cx="150" cy="38" r="5" fill={accent} opacity="0.95" />
                                        <line x1="150" y1="48" x2="150" y2="160" stroke={accent} strokeWidth="1" opacity="0.12" strokeDasharray="4 4" />
                                      </svg>
                                    </div>
                                  );

                                  /* ⭐ 5-pointed star burst */
                                  if (gType === "star") return (
                                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                      <svg viewBox="0 0 300 170" width="100%" style={{ flex: 1, display: "block", minHeight: 80 }} xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="150" cy="85" r="76" fill="none" stroke={accent} strokeWidth="1" opacity="0.09" />
                                        <circle cx="150" cy="85" r="60" fill="none" stroke={accent} strokeWidth="1" opacity="0.14" />
                                        <polygon points="150,33 162,67 198,67 170,89 180,124 150,104 120,124 130,89 102,67 138,67" fill={accent} opacity="0.18" stroke={accent} strokeWidth="1.5" strokeOpacity="0.85" />
                                        <circle cx="150" cy="85" r="16" fill={accent} opacity="0.18" />
                                        <circle cx="150" cy="85" r="5"  fill={accent} opacity="0.95" />
                                        {[0,45,90,135,180,225,270,315].map((deg,di) => {
                                          const r = (deg*Math.PI)/180;
                                          return <line key={di} x1={150+Math.cos(r)*62} y1={85+Math.sin(r)*62} x2={150+Math.cos(r)*76} y2={85+Math.sin(r)*76} stroke={accent} strokeWidth="1.5" opacity="0.3" />;
                                        })}
                                      </svg>
                                    </div>
                                  );

                                  /* ◆ Central diamond with speed lines */
                                  if (gType === "diamond") return (
                                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                      <svg viewBox="0 0 300 170" width="100%" style={{ flex: 1, display: "block", minHeight: 80 }} xmlns="http://www.w3.org/2000/svg">
                                        <line x1="-30" y1="200" x2="210" y2="-60" stroke={accent} strokeWidth="48" strokeLinecap="round" opacity="0.05" />
                                        <line x1="20"  y1="200" x2="260" y2="-60" stroke={accent} strokeWidth="24" strokeLinecap="round" opacity="0.07" />
                                        <line x1="80"  y1="200" x2="320" y2="-60" stroke={accent} strokeWidth="12" strokeLinecap="round" opacity="0.09" />
                                        <line x1="140" y1="200" x2="380" y2="-60" stroke={accent} strokeWidth="5"  strokeLinecap="round" opacity="0.12" />
                                        <line x1="185" y1="200" x2="425" y2="-60" stroke={accent} strokeWidth="2"  strokeLinecap="round" opacity="0.15" />
                                        <polygon points="150,52 178,85 150,118 122,85" fill="none" stroke={accent} strokeWidth="2"   opacity="0.8" />
                                        <polygon points="150,62 170,85 150,108 130,85" fill={accent}              opacity="0.2" />
                                        <circle cx="150" cy="85" r="4" fill={accent} opacity="0.95" />
                                        <line x1="30"  y1="85" x2="112" y2="85" stroke={accent} strokeWidth="1" opacity="0.2" />
                                        <line x1="188" y1="85" x2="270" y2="85" stroke={accent} strokeWidth="1" opacity="0.2" />
                                      </svg>
                                    </div>
                                  );

                                  /* ○ Concentric pulse rings */
                                  return (
                                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                      <svg viewBox="0 0 300 170" width="100%" style={{ flex: 1, display: "block", minHeight: 80 }} xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="150" cy="85" r="76" fill="none" stroke={accent} strokeWidth="1"   opacity="0.08" strokeDasharray="6 4" />
                                        <circle cx="150" cy="85" r="58" fill="none" stroke={accent} strokeWidth="1"   opacity="0.14" strokeDasharray="6 4" />
                                        <circle cx="150" cy="85" r="40" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.24" />
                                        <circle cx="150" cy="85" r="24" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.4"  />
                                        <circle cx="150" cy="85" r="10" fill={accent}              opacity="0.25" />
                                        <circle cx="150" cy="85" r="4"  fill={accent}              opacity="0.95" />
                                        {[0,60,120,180,240,300].map((deg,di) => {
                                          const r = (deg*Math.PI)/180;
                                          return <line key={di} x1={150+Math.cos(r)*42} y1={85+Math.sin(r)*42} x2={150+Math.cos(r)*76} y2={85+Math.sin(r)*76} stroke={accent} strokeWidth="1" opacity="0.18" />;
                                        })}
                                      </svg>
                                    </div>
                                  );
                                }

                                /* ── Default: bullet list ── */
                                return (
                                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                                    {pts.map((pt, pi) => (
                                      <li key={pi} style={{ display: "flex", alignItems: "flex-start", gap: 6, color: "rgba(255,255,255,0.85)", fontSize: "clamp(10px, 2.8vw, 13px)", marginBottom: 5 }}>
                                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: accentColors[pi % accentColors.length], marginTop: 3, flexShrink: 0 }} />
                                        <span>{pt}</span>
                                      </li>
                                    ))}
                                  </ul>
                                );
                              })()}
                              </div>{/* /graphic area */}

                              {/* ── Bottom: divider + textHook ── */}
                              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 10, paddingTop: 8, flexShrink: 0 }}>
                                {vd.textHook ? (
                                  <p style={{ color: "white", fontWeight: 900, fontSize: "clamp(13px, 4.5vw, 22px)", lineHeight: 1.1, margin: 0 }}>
                                    {vd.textHook.split(" ").map((word, wi) =>
                                      word.toLowerCase() === vd.highlightWord?.toLowerCase()
                                        ? <span key={wi} style={{ color: "#facc15" }}>{word} </span>
                                        : <span key={wi}>{word} </span>
                                    )}
                                  </p>
                                ) : (
                                  <p style={{ color: "rgba(255,255,255,0.18)", fontSize: 10, margin: 0, fontStyle: "italic" }}>
                                    {slidePts[0]?.slice(0, 40) ?? ""}
                                  </p>
                                )}
                              </div>
                            </div>{/* /slide card */}

                            {/* Export button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleExportSlide}
                              className="gap-1.5"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Export Slide as PNG
                            </Button>
                          </div>
                        );
                      }

                      // ── Default: AI image prompt + generate button ──
                      return (
                        <div>
                          <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-1">Image to generate</p>
                          <p className="text-foreground whitespace-pre-wrap mb-3">{stripMarkdown(fullPrompt ?? "")}</p>

                          {/* Image generation + animation — gated on video credits */}
                          {creditBalance === 0 ? (
                            <div className="rounded-lg border border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 p-4 space-y-3">
                              <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">🎬 Video credits required</p>
                              <p className="text-xs text-orange-600 dark:text-orange-300">
                                You need video credits to generate scene images and animate them into videos. Purchase credits, then come back and generate your scenes.
                              </p>
                              <Button
                                size="sm"
                                className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
                                onClick={() => { window.location.href = "/dashboard/video-credits"; }}
                              >
                                Buy Video Credits
                              </Button>
                            </div>
                          ) : sceneImgUrl ? (
                            <div className="space-y-2">
                              <img
                                src={sceneImgUrl}
                                alt={`Scene ${i + 1}`}
                                className={`w-full rounded-md ${sceneIs169 ? "aspect-video" : "aspect-[9/16] max-w-[200px]"} object-cover`}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={sceneBusy}
                                onClick={() => generateGuideSceneImage(i)}
                                className="gap-1.5"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Regenerate
                              </Button>
                              <AiStoryAnimateSceneBlock
                                imageUrl={sceneImgUrl}
                                motionPrompt={fullPrompt}
                                videoUrl={guideSceneVideoUrls[i] ?? null}
                                onVideoUrl={(url) => setGuideSceneVideoUrls((prev) => ({ ...prev, [i]: url }))}
                                onAnimationStateChange={(isAnimating) => setAnimatingByScene((prev) => ({ ...prev, [i]: isAnimating }))}
                                videoClassName={sceneIs169 ? "w-full rounded-md mt-2 aspect-video object-cover" : "w-full rounded-md mt-2 aspect-[9/16] max-w-[200px] object-cover"}
                                aspectRatio={sceneIs169 ? "16:9" : "9:16"}
                              />
                            </div>
                          ) : creditBalance === null ? null : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={sceneBusy}
                              onClick={() => generateGuideSceneImage(i)}
                              className="gap-1.5"
                            >
                              {sceneBusy ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating image…</>
                              ) : (
                                <><ImagePlus className="w-3.5 h-3.5" /> Generate Image</>
                              )}
                            </Button>
                          )}
                        </div>
                      );
                    })()}
                    {(vd?.cameraAngle || vd?.lightingMood || vd?.colorPalette || vd?.mediaType) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        {vd.cameraAngle && <span><span className="text-orange-500">Camera:</span> {vd.cameraAngle}</span>}
                        {vd.lightingMood && <span><span className="text-orange-500">Lighting:</span> {vd.lightingMood}</span>}
                        {vd.colorPalette && <span><span className="text-orange-500">Colors:</span> {vd.colorPalette}</span>}
                        {vd.mediaType && <span><span className="text-orange-500">Media:</span> {vd.mediaType}</span>}
                      </div>
                    )}
                    {overlayObjs.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-orange-500 font-medium text-xs uppercase tracking-wide">Text overlay</p>
                        {overlayObjs.map((obj, j) => (
                          <div key={j} className="pl-0 space-y-1">
                            <p className="text-foreground">{stripMarkdown(obj.exactText ?? "")}</p>
                            {(obj.fontStyle || obj.size || obj.position || obj.color || obj.animation || obj.timingNote) && (
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-600 dark:text-muted-foreground">
                                {obj.fontStyle && <span>Font: {obj.fontStyle}</span>}
                                {obj.size && <span>Size: {obj.size}</span>}
                                {obj.position && <span>Position: {obj.position}</span>}
                                {obj.color && <span>Color: {obj.color}</span>}
                                {obj.animation && <span>Animation: {obj.animation}</span>}
                                {obj.timingNote && <span>Timing: {obj.timingNote}</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {transition && (transition.toNextScene || transition.effects || transition.pacing) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                        {transition.toNextScene && <span><span className="text-orange-500">Transition:</span> {transition.toNextScene}</span>}
                        {transition.effects && <span><span className="text-orange-500">Effects:</span> {transition.effects}</span>}
                        {transition.pacing && <span><span className="text-orange-500">Pacing:</span> {transition.pacing}</span>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {/* ── Generate Everything button ─────────────────────────────── */}
            <Card className="mt-6 border-2 border-orange-400 dark:border-orange-500 bg-orange-50 dark:bg-orange-950/20">
              <CardContent className="pt-6 pb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="font-semibold text-foreground flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-orange-500" />
                      Build My Video — One Tap
                    </p>
                    <p className="text-sm text-gray-600 dark:text-muted-foreground mt-1">
                      Automatically creates images, voiceover, and your final video file in one go.
                    </p>
                    {autoGeneratePhase && (
                      <p className="text-xs text-orange-600 dark:text-orange-400 mt-1.5 animate-pulse">{autoGeneratePhase}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-2 bg-orange-500 hover:bg-orange-600 text-white shrink-0"
                    onClick={handleGenerateEverything}
                    disabled={autoGeneratingAll || scenes.length === 0}
                  >
                    {autoGeneratingAll ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Building video…</>
                    ) : (
                      <><Sparkles className="w-4 h-4" />Build My Video</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {(() => {
              const isDarkInfographic = guide.videoStyle === "dark_infographic";
              const someSceneHasMedia = isDarkInfographic
                ? scenes.length > 0
                : scenes.some((_, i) => !!(guideSceneImageUrls[i]?.trim() || guideSceneVideoUrls[i]?.trim()));
              const allScenesHaveMedia = isDarkInfographic
                ? scenes.length > 0
                : scenes.length > 0 && scenes.every((_, i) => !!(guideSceneImageUrls[i]?.trim() || guideSceneVideoUrls[i]?.trim()));
              return (
                <Card className={`mt-4 border-2 transition-colors ${allScenesHaveMedia ? "border-gray-300 dark:border-border bg-gray-50 dark:bg-card" : "border-gray-200 dark:border-border bg-gray-50 dark:bg-card"}`}>
                  <CardContent className="pt-6 pb-6">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div>
                          <p className="font-semibold text-foreground flex items-center gap-2">
                            <Film className="w-4 h-4 text-orange-500" />
                            {isDarkInfographic ? "Compile Infographic Slides" : "Sync \u0026 Export Full Video"}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-muted-foreground mt-1">
                            {isDarkInfographic
                              ? "Render your infographic slides into a single MP4 to download and post."
                              : "Once your scenes have images, compile them all into one MP4 to download and post."}
                          </p>
                          {!isDarkInfographic && !canCompileServerSideVoice && someSceneHasMedia && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                              Tip: Add scene voiceovers first to include audio in the compiled video.
                            </p>
                          )}
                          {isDarkInfographic && (
                            <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1.5">
                              Tip: Add a voiceover to each scene above for audio in the compiled video.
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            className={`gap-2 transition-colors ${allScenesHaveMedia ? "bg-orange-500 hover:bg-orange-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"}`}
                            onClick={isDarkInfographic ? handleCompileInfographic : handleMakeFullVideoMp4}
                            disabled={!someSceneHasMedia || guideFullVideoLoading}
                            title={!someSceneHasMedia ? (isDarkInfographic ? "Add scenes first" : "Generate images for your scenes first") : "Compile all scenes into one MP4"}
                          >
                            {guideFullVideoLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Compiling…
                              </>
                            ) : (
                              <>
                                <Download className="w-4 h-4" />
                                Create Video File
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      {lastCompiledVideoUrl && (
                        <div className="border-t border-gray-200 dark:border-border pt-4 flex flex-col gap-2">
                          <p className="text-xs font-medium text-foreground">Your compiled video is ready:</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <a
                              href={lastCompiledVideoUrl}
                              download={`video-${Date.now()}.mp4`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 shrink-0 px-4 py-2 rounded-md text-sm font-medium bg-green-500 hover:bg-green-600 text-white transition-colors"
                            >
                              <Download className="w-4 h-4" />
                              Download MP4
                            </a>
                            <a
                              href="https://www.tiktok.com/upload"
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Opens TikTok upload"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-black hover:bg-gray-900 text-white transition-colors"
                            >
                              📱 Post to TikTok
                            </a>
                            <a
                              href="https://www.instagram.com/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 hover:opacity-90 text-white transition-opacity"
                            >
                              📸 Post to Instagram
                            </a>
                            <a
                              href="https://studio.youtube.com/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
                            >
                              🎬 Post to YouTube
                            </a>
                            <button
                              type="button"
                              title="Copy video URL to clipboard"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-foreground transition-colors"
                              onClick={() => {
                                void navigator.clipboard.writeText(lastCompiledVideoUrl).then(() => {
                                  setCopiedVideoLink(true);
                                  setTimeout(() => setCopiedVideoLink(false), 2000);
                                });
                              }}
                            >
                              <Copy className="w-3 h-3" />
                              {copiedVideoLink ? "Copied!" : "Copy link"}
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground">Download first, then upload to your platform.</p>
                          {/* Social captions generated after export */}
                          {videoSocialCaptionsLoading && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Generating captions &amp; hashtags…
                            </div>
                          )}
                          {videoSocialCaptions && !videoSocialCaptionsLoading && (
                            <div className="mt-3 flex flex-col gap-3">
                              <p className="text-xs font-semibold text-foreground">Ready-to-post captions &amp; hashtags:</p>
                              {/* YouTube title row */}
                              {videoSocialCaptions.youtube_title && (
                                <div className="rounded-lg border border-gray-200 dark:border-border bg-white dark:bg-background p-3 flex flex-col gap-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-medium text-muted-foreground">YouTube Title</span>
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-foreground transition-colors shrink-0"
                                      onClick={() => {
                                        void navigator.clipboard.writeText(videoSocialCaptions.youtube_title).then(() => {
                                          setCopiedSocialCaption("youtube_title");
                                          setTimeout(() => setCopiedSocialCaption(null), 2000);
                                        });
                                      }}
                                    >
                                      <Copy className="w-3 h-3" />
                                      {copiedSocialCaption === "youtube_title" ? "Copied!" : "Copy"}
                                    </button>
                                  </div>
                                  <p className="text-xs text-foreground font-medium">{videoSocialCaptions.youtube_title}</p>
                                </div>
                              )}
                              {(["tiktok", "instagram", "twitter"] as const).map((platform) => {
                                const labels = { tiktok: "TikTok", instagram: "Instagram", twitter: "X / Twitter" };
                                const titleKey = platform === "tiktok" ? "tiktok_title" : platform === "instagram" ? "instagram_title" : null;
                                const title = titleKey ? videoSocialCaptions[titleKey as "tiktok_title"] : null;
                                const text = videoSocialCaptions[platform];
                                if (!text) return null;
                                const fullText = title ? `${title}\n\n${text}` : text;
                                return (
                                  <div key={platform} className="rounded-lg border border-gray-200 dark:border-border bg-white dark:bg-background p-3 flex flex-col gap-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs font-medium text-muted-foreground">{labels[platform]}</span>
                                      <button
                                        type="button"
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-foreground transition-colors shrink-0"
                                        onClick={() => {
                                          void navigator.clipboard.writeText(fullText).then(() => {
                                            setCopiedSocialCaption(platform);
                                            setTimeout(() => setCopiedSocialCaption(null), 2000);
                                          });
                                        }}
                                      >
                                        <Copy className="w-3 h-3" />
                                        {copiedSocialCaption === platform ? "Copied!" : "Copy"}
                                      </button>
                                    </div>
                                    {title && <p className="text-xs font-semibold text-foreground">{title}</p>}
                                    <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{text}</p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* ── Inline Social Media Kit for Dark Infographic ── */}
            {isDarkInfographicStyle && (
              <Card className="mt-4 border-orange-200 dark:border-orange-800/40 bg-orange-50/30 dark:bg-orange-950/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-orange-500" />
                    Titles, Descriptions &amp; Hashtags
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-muted-foreground text-sm">
                    Ready-to-use captions and hashtags for TikTok, Instagram and YouTube.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!socialKit ? (
                    <Button
                      className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
                      disabled={socialKitLoading || !libraryScriptId}
                      onClick={handleSocialKitGenerateWithoutProof}
                    >
                      {socialKitLoading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                      ) : (
                        <><Share2 className="w-4 h-4" /> Generate Titles &amp; Hashtags</>
                      )}
                    </Button>
                  ) : (
                    <div className="space-y-5">
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant="outline" size="sm"
                          className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground"
                          onClick={() => copyToClipboard(socialKitToText(socialKit), "Social Media Kit")}
                        >
                          <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy All
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground"
                          onClick={() => setSocialKit(null)}
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Regenerate
                        </Button>
                      </div>
                      {[
                        {
                          key: "tiktok", label: "TikTok",
                          rows: [
                            { name: "Titles", value: socialKit.tiktok.titleVariations?.join("\n") },
                            { name: "Description", value: socialKit.tiktok.descriptionVariations?.[0] },
                            { name: "Hashtags", value: socialKit.tiktok.hashtags?.join(" ") },
                          ],
                        },
                        {
                          key: "instagram", label: "Instagram Reels",
                          rows: [
                            { name: "Caption", value: socialKit.instagramReels.captionVariations?.[0] },
                            { name: "Hashtags", value: socialKit.instagramReels.hashtags?.join(" ") },
                          ],
                        },
                        {
                          key: "youtube", label: "YouTube Shorts",
                          rows: [
                            { name: "Titles", value: socialKit.youtubeShorts.titleVariations?.join("\n") },
                            { name: "Description", value: socialKit.youtubeShorts.descriptionWithKeywords },
                            { name: "Tags", value: socialKit.youtubeShorts.tagsList?.join(", ") },
                          ],
                        },
                      ].map((platform) => (
                        <div key={platform.key} className="rounded-lg border border-gray-200 dark:border-border bg-white dark:bg-background p-4 space-y-3">
                          <p className="text-xs font-bold text-foreground uppercase tracking-wide">{platform.label}</p>
                          {platform.rows.map((row) => (
                            <div key={row.name}>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-orange-500 font-medium text-xs uppercase tracking-wide">{row.name}</p>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-foreground transition-colors"
                                  onClick={() => copyToClipboard(row.value ?? "", row.name)}
                                >
                                  <Copy className="w-3 h-3" /> Copy
                                </button>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-muted-foreground whitespace-pre-wrap">{row.value || "—"}</p>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            {/* scenes step nav */}
            <div className="flex justify-between pt-4 mt-4 border-t border-gray-100 dark:border-border">
              <Button variant="outline" onClick={() => setActiveTab("script")}>
                ← Back to Script
              </Button>
              <Button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6" onClick={() => setActiveTab("voiceover")}>
                Continue to Voiceover →
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="editing" className="mt-6 space-y-4">
<Card className="border-gray-200 dark:border-border bg-gray-50 dark:bg-card">
            <CardHeader>
                <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
                  <Film className="w-4 h-4 text-orange-500" />
                  Step-by-step editing guide
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(editingSteps).map(([tool, steps]) => (
                  <div key={tool}>
                    <p className="text-orange-500 font-medium text-sm mb-2">{tool}</p>
                    <ul className="list-disc list-inside text-sm text-gray-600 dark:text-muted-foreground space-y-1">
                      {steps.map((step, j) => (
                        <li key={j}>{step}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subtitles" className="mt-6 space-y-4">
<Card className="border-gray-200 dark:border-border bg-gray-50 dark:bg-card">
            <CardHeader>
                <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
                  <Type className="w-4 h-4 text-orange-500" />
                  Subtitles & text
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-gray-600 dark:text-muted-foreground">
                <p><span className="text-foreground">Style:</span> {subtitles.style ?? "—"}</p>
                <p><span className="text-foreground">Font:</span> {subtitles.font ?? "—"}</p>
                <p><span className="text-foreground">Position:</span> {subtitles.position ?? "—"}</p>
                <p><span className="text-foreground">Animation:</span> {subtitles.animation ?? "—"}</p>
                <p className="text-xs text-gray-500 dark:text-muted-foreground mt-2">Use CapCut: Edit → Captions → Auto Captions for word-by-word sync.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="music" className="mt-6 space-y-4">
<Card className="border-gray-200 dark:border-border bg-gray-50 dark:bg-card">
            <CardHeader>
                <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
                  <Music className="w-4 h-4 text-orange-500" />
                  Music & audio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-gray-600 dark:text-muted-foreground">
                <p><span className="text-foreground">Mood:</span> {music.mood ?? "—"}</p>
                <p><span className="text-foreground">Sources:</span> {Array.isArray(music.sources) ? music.sources.join(", ") : "—"}</p>
                <p><span className="text-foreground">Volume:</span> {music.volume ?? "—"}</p>
                <p className="text-xs text-gray-500 dark:text-muted-foreground mt-2">Sync beat drops with scene transitions. Use royalty-free sources like Epidemic Sound or YouTube Audio Library.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="export" className="mt-6 space-y-4">
<Card className="border-gray-200 dark:border-border bg-gray-50 dark:bg-card">
            <CardHeader>
                <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
                  <Upload className="w-4 h-4 text-orange-500" />
                  Export settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-gray-600 dark:text-muted-foreground">
                <p><span className="text-foreground">Resolution:</span> {exportSettings.resolution ?? "—"}</p>
                <p><span className="text-foreground">FPS:</span> {exportSettings.fps ?? "—"}</p>
                <p><span className="text-foreground">Format:</span> {exportSettings.format ?? "—"}</p>
                <p><span className="text-foreground">File size:</span> {(exportSettings as { fileSize?: string }).fileSize ?? "—"}</p>
              </CardContent>
            </Card>
            {platformTips.length > 0 && (
              <Card className="border-gray-200 dark:border-border bg-gray-50 dark:bg-card">
                <CardHeader>
                  <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-orange-500" />
                    Platform tips
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside text-sm text-gray-600 dark:text-muted-foreground space-y-1">
                    {platformTips.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            {/* export step nav */}
            <div className="flex justify-between pt-4 mt-4 border-t border-gray-100 dark:border-border">
              <Button variant="outline" onClick={() => setActiveTab("voiceover")}>
                ← Back to Voiceover
              </Button>
              <Button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6" onClick={() => setActiveTab("social-kit")}>
                Continue to Social Kit →
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="social-kit" className="mt-6 space-y-4" id="social-media-kit-section">
            {!socialKit ? (
              (true) ? (
                <Card className="border-gray-200 dark:border-border bg-gray-50 dark:bg-card">
                  <CardContent className="pt-6 pb-6">
                    <div className="flex flex-col items-center text-center max-w-md mx-auto">
                      <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                        <Share2 className="w-8 h-8 text-green-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">Generate your Social Media Kit</h3>
                      <p className="text-gray-600 dark:text-muted-foreground text-sm mb-6">
                        Get TikTok titles, Instagram captions, YouTube Shorts descriptions, hashtags, and best posting times — all tailored to your script.
                      </p>
                      <Button
                        className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
                        onClick={handleSocialKitGenerateWithoutProof}
                        disabled={socialKitLoading}
                      >
                        {socialKitLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Share2 className="w-4 h-4" />
                        )}
                        {socialKitLoading ? "Generating your Social Media Kit..." : "Generate Social Media Kit"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-gray-200 dark:border-border bg-gray-50 dark:bg-card">
                  <CardContent className="pt-6 pb-6">
                    <div className="flex flex-col items-center text-center max-w-md mx-auto">
                      <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
                        <Lock className="w-8 h-8 text-amber-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">Upload proof to unlock</h3>
                      <p className="text-gray-600 dark:text-muted-foreground text-sm mb-2">
                        Upload a screenshot or video preview to unlock your Social Media Kit
                      </p>
                      <p className="text-gray-500 dark:text-muted-foreground text-xs mb-6">
                        We want to make sure you&apos;ve created your video before optimizing your social media presence. Or use the <strong>Video Timeline</strong> first to get access without proof.
                      </p>
                      <label className="w-full block">
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.webp,.mp4,.mov,image/png,image/jpeg,image/webp,video/mp4,video/quicktime"
                          className="sr-only"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            setSocialKitProofFile(f ?? null);
                          }}
                        />
                        <div
                          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors bg-gray-100 dark:bg-background ${
                            socialKitProofFile ? "border-orange-500/50" : "border-gray-200 dark:border-border hover:border-orange-500/50"
                          }`}
                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const f = e.dataTransfer.files?.[0];
                            if (f && (/\.(png|jpe?g|webp|mp4|mov)$/i.test(f.name) || f.type.startsWith("image/") || f.type.startsWith("video/"))) {
                              setSocialKitProofFile(f);
                            }
                          }}
                        >
                          <Upload className="w-10 h-10 mx-auto text-gray-500 dark:text-muted-foreground mb-2" />
                          <p className="text-sm text-gray-600 dark:text-muted-foreground">
                            {socialKitProofFile ? socialKitProofFile.name : "Drag and drop or click to upload"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">PNG, JPG, MP4 or MOV</p>
                        </div>
                      </label>
                      <Button
                        className="mt-4 bg-orange-500 hover:bg-orange-600 text-white gap-2"
                        onClick={handleSocialKitUploadProof}
                        disabled={!socialKitProofFile || socialKitLoading}
                      >
                        {socialKitLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        {socialKitLoading ? "Generating your Social Media Kit..." : "Upload Proof"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground hover:bg-gray-200 dark:hover:bg-muted"
                    onClick={() => {
                      copyToClipboard(socialKitToText(socialKit), "Social Media Kit");
                    }}
                  >
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copy All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground hover:bg-gray-200 dark:hover:bg-muted"
                    onClick={() => {
                      const blob = new Blob([socialKitToText(socialKit)], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "social-media-kit.txt";
                      a.click();
                      URL.revokeObjectURL(url);
                      toast({ title: "Downloaded", description: "Social Media Kit saved as .txt" });
                    }}
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Download Social Media Kit (.txt)
                  </Button>
                </div>

                {[
                  {
                    key: "tiktok",
                    title: "TikTok",
                    icon: Share2,
                    content: [
                      { label: "Title variations", value: socialKit.tiktok.titleVariations?.join("\n") },
                      { label: "Description variations", value: socialKit.tiktok.descriptionVariations?.join("\n\n") },
                      { label: "Hashtags", value: socialKit.tiktok.hashtags?.join(" ") },
                      { label: "Best posting times", value: socialKit.tiktok.bestPostingTimes },
                      { label: "Suggested sounds", value: socialKit.tiktok.suggestedSounds?.join(", ") },
                    ],
                  },
                  {
                    key: "instagram",
                    title: "Instagram Reels",
                    icon: Share2,
                    content: [
                      { label: "Caption variations", value: socialKit.instagramReels.captionVariations?.join("\n\n") },
                      { label: "Hashtags", value: socialKit.instagramReels.hashtags?.join(" ") },
                      { label: "Story sequence", value: socialKit.instagramReels.storySequenceSuggestions?.join("\n• ") },
                      { label: "Best posting times", value: socialKit.instagramReels.bestPostingTimes },
                    ],
                  },
                  {
                    key: "youtube",
                    title: "YouTube Shorts",
                    icon: Share2,
                    content: [
                      { label: "Title variations", value: socialKit.youtubeShorts.titleVariations?.join("\n") },
                      { label: "Description", value: socialKit.youtubeShorts.descriptionWithKeywords },
                      { label: "Tags", value: socialKit.youtubeShorts.tagsList?.join(", ") },
                      { label: "Thumbnail text", value: socialKit.youtubeShorts.thumbnailTextSuggestions?.join(" | ") },
                    ],
                  },
                  {
                    key: "general",
                    title: "General",
                    icon: Share2,
                    content: [
                      { label: "Cross-posting schedule", value: socialKit.general.crossPostingSchedule },
                      { label: "Engagement prompts", value: socialKit.general.engagementPrompts?.join("\n• ") },
                      { label: "Pin comment suggestions", value: socialKit.general.pinCommentSuggestions?.join("\n• ") },
                    ],
                  },
                ].map((section) => (
                  <Card key={section.key} className="border-gray-200 dark:border-border bg-gray-50 dark:bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
                        <section.icon className="w-4 h-4 text-orange-500" />
                        {section.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {section.content.map((item, i) => (
                        <div key={i}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-orange-500 font-medium text-xs uppercase tracking-wide">{item.label}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-gray-600 dark:text-muted-foreground hover:text-foreground shrink-0"
                              onClick={() => copyToClipboard(item.value ?? "", item.label)}
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              Copy
                            </Button>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-muted-foreground whitespace-pre-wrap">{item.value || "—"}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {/* social-kit step nav */}
            <div className="flex justify-between pt-4 mt-4 border-t border-gray-100 dark:border-border">
              <Button variant="outline" onClick={() => setActiveTab("export")}>
                ← Back to Export
              </Button>
              <Button className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6" onClick={() => setActiveTab("script")}>
                ✓ Done — Back to Start
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="voiceover" className="mt-6 space-y-4">
            <Card className="border-gray-200 dark:border-border bg-gray-50 dark:bg-card">
              <CardHeader>
                <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
                  <Mic className="w-4 h-4 text-orange-500" />
                  AI Voiceover (ElevenLabs)
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-muted-foreground">
                  Choose a voice, adjust style, then generate. Your last selected voice is saved as default. To see more voices, add custom ones in your ElevenLabs account under Voices — they appear automatically on the customization page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Voice picker: 8 voices as selectable cards, selected in orange */}
                <div>
                  <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-3">Voice</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {ELEVENLABS_VOICES.map((v) => {
                      const selected = voiceId === v.voiceId;
                      const loading = previewingVoiceId === v.voiceId;
                      return (
                        <div
                          key={v.voiceId}
                          className={`rounded-lg border-2 p-3 flex items-center justify-between gap-2 transition-colors ${
                            selected
                              ? "border-orange-500 bg-orange-500/10 text-foreground"
                              : "border-gray-200 dark:border-border bg-gray-100 dark:bg-background hover:border-gray-300 dark:hover:border-[#3A3A3A]"
                          }`}
                        >
                          <button
                            type="button"
                            className="flex-1 min-w-0 text-left"
                            onClick={() => {
                              setVoiceId(v.voiceId);
                              setDefaultVoiceId(v.voiceId);
                            }}
                          >
                            <span className="block font-medium text-sm">{v.name}</span>
                            <span className="block text-xs text-gray-500 dark:text-muted-foreground">{v.description}</span>
                          </button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground shrink-0 h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewVoice(v.voiceId);
                            }}
                            disabled={loading}
                            title="Preview voice"
                          >
                            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Speed / Stability / Clarity */}
                <div className="space-y-4">
                  <p className="text-orange-500 font-medium text-xs uppercase tracking-wide">Speed &amp; style</p>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-muted-foreground mb-1">Speaking speed (playback): {(playbackSpeed * 100) / 100}x</p>
                    <Slider
                      value={[playbackSpeed]}
                      onValueChange={([v]) => setPlaybackSpeed(v)}
                      min={0.5}
                      max={2}
                      step={0.1}
                      className="max-w-xs"
                    />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-muted-foreground mb-1">Stability: {Math.round(stability * 100)}%</p>
                    <Slider
                      value={[stability]}
                      onValueChange={([v]) => setStability(v)}
                      min={0}
                      max={1}
                      step={0.1}
                      className="max-w-xs"
                    />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-muted-foreground mb-1">Clarity: {Math.round(similarity * 100)}%</p>
                    <Slider
                      value={[similarity]}
                      onValueChange={([v]) => setSimilarity(v)}
                      min={0}
                      max={1}
                      step={0.1}
                      className="max-w-xs"
                    />
                  </div>
                </div>

                {/* Two buttons side by side: Generate Voiceover | Generate Scene Voiceovers */}
                <div>
                  <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-2">Generate</p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
                      onClick={handleGenerateFullVoiceover}
                      disabled={generatingFull || !fullScriptText.trim() || !hasProductName}
                    >
                      {generatingFull ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                      Generate Voiceover
                    </Button>
                    <Button
                      variant="outline"
                      className="border-gray-200 dark:border-border text-gray-700 dark:text-[#E0E0E0] hover:bg-gray-200 dark:hover:bg-muted gap-2"
                      onClick={handleGeneratePerSceneVoiceover}
                      disabled={generatingPerScene || getSceneTexts().length === 0 || !hasProductName}
                    >
                      {generatingPerScene ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                      Generate Scene Voiceovers
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1.5">
                    Full script = one audio file (Hook + Body + CTA). Scene voiceovers = one file per scene.
                  </p>
                </div>

                {/* Success: Full voiceover — play, duration, Regenerate */}
                {fullVoiceoverUrl && (
                  <div>
                    <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-2">Full script audio</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <AudioWithSpeed src={fullVoiceoverUrl} speed={playbackSpeed} controls className="max-w-full h-9 flex-1 min-w-0" />
                      {fullVoiceoverDuration != null && !Number.isNaN(fullVoiceoverDuration) && (
                        <span className="text-sm text-gray-600 dark:text-muted-foreground shrink-0">
                          {formatDuration(fullVoiceoverDuration)}
                        </span>
                      )}
                      <Button variant="outline" size="sm" className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground shrink-0" asChild>
                        <a href={fullVoiceoverUrl} download="voiceover-full.mp3">Download</a>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground shrink-0 gap-1.5"
                        onClick={handleGenerateFullVoiceover}
                        disabled={generatingFull || !hasProductName}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Regenerate
                      </Button>
                    </div>
                  </div>
                )}

                {/* Success: Scene voiceovers — Scene 1 Voiceover, Scene 2 Voiceover, … with play, duration, Regenerate each */}
                {perSceneUrls.some(Boolean) && (
                  <div>
                    <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-2">Scene voiceovers</p>
                    <div className="space-y-3">
                      {perSceneUrls.map((url, i) => {
                        if (!url) return null;
                        const duration = perSceneDurations[i];
                        const loading = generatingSceneIndex === i;
                        const timingLabel = scenes[i]?.timing ? `Scene ${i + 1} (${scenes[i].timing})` : `Scene ${i + 1}`;
                        return (
                          <div key={i} className="rounded-lg border border-gray-200 dark:border-border bg-gray-100 dark:bg-background p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <span className="text-sm font-medium text-gray-700 dark:text-[#E0E0E0]">
                                {timingLabel}
                              </span>
                              {duration != null && !Number.isNaN(duration) && (
                                <span className="text-xs text-gray-500 dark:text-muted-foreground">
                                  {formatDuration(duration)}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <AudioWithSpeed src={url} speed={playbackSpeed} controls className="flex-1 min-w-0 max-w-md h-9" />
                              <Button variant="outline" size="sm" className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground shrink-0" asChild>
                                <a href={url} download={`voiceover-scene-${i + 1}.mp3`}>Download</a>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground shrink-0 gap-1"
                                onClick={() => handleGenerateSingleSceneVoiceover(i)}
                                disabled={loading || generatingPerScene}
                              >
                                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                Regenerate
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground shrink-0 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteSceneVoiceover(i)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            {/* voiceover step nav */}
            <div className="flex justify-between pt-4 mt-4 border-t border-gray-100 dark:border-border">
              <Button variant="outline" onClick={() => setActiveTab("scenes")}>
                ← Back to Images
              </Button>
              <Button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6" onClick={() => setActiveTab("export")}>
                Continue to Export →
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* ── Flow completion card ── */}
        <Card className="mt-8 border-orange-500/25 dark:border-orange-500/20 bg-orange-500/5 dark:bg-orange-500/8">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 mb-1">
              {libraryScriptId ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">
                    Guide saved to My Library
                  </span>
                </>
              ) : (
                <span className="text-xs font-semibold text-orange-500 uppercase tracking-wide">
                  Guide ready
                </span>
              )}
            </div>
            <CardTitle className="text-lg font-semibold text-foreground">
              What would you like to do next?
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-muted-foreground">
              Your guide is ready. Open it in My Library, start building in the Video Timeline, or grab your social captions.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {libraryScriptId && (
              <Button asChild className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
                <Link href="/dashboard/library">
                  <BookOpen className="w-4 h-4" />
                  Open in Library →
                </Link>
              </Button>
            )}
            <Button
              asChild
              variant={libraryScriptId ? "outline" : "default"}
              className={libraryScriptId
                ? "border-gray-200 dark:border-border text-gray-700 dark:text-[#E0E0E0] hover:bg-gray-100 dark:hover:bg-muted gap-2"
                : "bg-orange-500 hover:bg-orange-600 text-white gap-2"}
            >
              <Link href={timelineHref}>
                <Video className="w-4 h-4" />
                Create Video in Timeline
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-gray-200 dark:border-border text-gray-700 dark:text-[#E0E0E0] hover:bg-gray-100 dark:hover:bg-muted gap-2"
              onClick={() => {
                setActiveTab("social-kit");
                setTimeout(() => {
                  document.getElementById("social-media-kit-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 80);
              }}
            >
              <ExternalLink className="w-4 h-4" />
              Use another tool
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
