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
  /** When true, show Content Studio / YouTube context (breadcrumb, back link, title). */
  isYouTubeMode?: boolean;
  /** Override back link URL (e.g. Content Studio scripts or Digital Products scripts). */
  backUrl?: string;
  /** Channel name for YouTube mode subtitle. */
  channelName?: string;
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

  const [showConfig, setShowConfig] = useState(false);
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
  const [activeTab, setActiveTab] = useState("scenes");
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
        onScenesRegenerated(payload);
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
    guide.productName,
    libraryScriptId,
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

  return (
    <main className="min-h-screen bg-white dark:bg-background text-foreground p-6 md:p-10">
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

        {scripts.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 p-4 rounded-lg border border-gray-200 dark:border-border bg-gray-50 dark:bg-card">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Guide ready
              </span>
              <span className="text-gray-300 dark:text-muted-foreground">|</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentAngleIndex((prev) => (prev - 1 + 4) % 4)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-muted rounded text-foreground transition-colors"
                  aria-label="Previous angle"
                >
                  ← Previous
                </button>
                <span className="font-medium text-foreground min-w-[200px] text-center">
                  {(angles[currentAngleIndex]?.name ?? effectiveScriptTitle ?? `Angle ${currentAngleIndex + 1}`)} ({currentAngleIndex + 1} of {scripts.length})
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentAngleIndex((prev) => (prev + 1) % 4)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-muted rounded text-foreground transition-colors"
                  aria-label="Next angle"
                >
                  Next →
                </button>
              </div>
            </div>
            {productId && (
              <Button
                variant="outline"
                size="sm"
                className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground hover:bg-gray-200 dark:hover:bg-muted gap-1.5"
                onClick={handleRegenerateScript}
                disabled={regeneratingScript || !hasProductName}
              >
                {regeneratingScript ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Regenerate This Angle
              </Button>
            )}
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
              variant="outline"
              size="sm"
              className="border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground hover:bg-gray-200 dark:hover:bg-muted hover:text-foreground"
              onClick={copyAllPromptsMidjourney}
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Copy All Prompts (Midjourney)
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
          <Button
            variant="outline"
            size="sm"
            className={[
              "gap-1.5 shrink-0 transition-colors",
              showTikTokChecklist
                ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                : "border-gray-300 dark:border-border text-gray-700 dark:text-muted-foreground hover:bg-gray-100 dark:hover:bg-muted",
            ].join(" ")}
            onClick={() => setShowTikTokChecklist((v) => !v)}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Post on TikTok checklist
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

        {/* ── TikTok Posting Checklist ── */}
        {showTikTokChecklist && (
          <Card className="mb-6 border-gray-200 dark:border-border overflow-visible">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
                <span className="text-lg leading-none">📱</span>
                Post on TikTok — Step-by-Step
              </CardTitle>
              <CardDescription className="text-sm text-gray-600 dark:text-muted-foreground">
                Tick each step off as you go
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                { label: "Film your video using the hook, body and CTA from the script above", extra: null },
                { label: "Export as vertical MP4 (1080 × 1920, 30 fps)", extra: null },
                {
                  label: "Copy your caption — hit \"Copy Caption\" above, or use your Social Media Kit description + hashtags",
                  extra: (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); copyCaption(); }}
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-orange-500 hover:text-orange-600 transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      {copiedCaption ? "Copied!" : "Copy Caption"}
                    </button>
                  ),
                },
                { label: "Open TikTok → tap + → upload your video", extra: null },
                { label: "Paste your caption and hashtags, set your cover thumbnail", extra: null },
                { label: "Schedule or post at your peak time (check your TikTok Analytics)", extra: null },
                { label: "Reply to every comment in the first 30 minutes to boost the algorithm", extra: null },
              ].map((item, i) => (
                <label
                  key={i}
                  className="flex items-start gap-2.5 cursor-pointer group select-none"
                  onClick={() =>
                    setTiktokCheckItems((prev) => {
                      const next = [...prev];
                      next[i] = !next[i];
                      return next;
                    })
                  }
                >
                  <span
                    className={[
                      "mt-0.5 w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors",
                      tiktokCheckItems[i]
                        ? "bg-black dark:bg-white border-black dark:border-white"
                        : "border-gray-300 dark:border-border group-hover:border-gray-400 dark:group-hover:border-muted-foreground",
                    ].join(" ")}
                  >
                    {tiktokCheckItems[i] && (
                      <svg className="w-2.5 h-2.5 text-white dark:text-black" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 12 12">
                        <polyline points="1.5,6 4.5,9 10.5,3" />
                      </svg>
                    )}
                  </span>
                  <div>
                    <span className={tiktokCheckItems[i] ? "line-through text-gray-400 dark:text-muted-foreground" : "text-foreground"}>
                      {item.label}
                    </span>
                    {item.extra}
                  </div>
                </label>
              ))}
              <div className="pt-3 border-t border-gray-100 dark:border-border">
                <a
                  href="https://www.tiktok.com/upload"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-black hover:bg-gray-900 text-white transition-colors"
                >
                  📱 Open TikTok Upload
                </a>
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* Video Configuration Panel */}
        <div className="mb-8 border-2 border-orange-200 dark:border-orange-800 rounded-lg overflow-hidden">
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
        </div>

        <Card className="mb-8 border-gray-200 dark:border-border bg-gray-50 dark:bg-card overflow-visible">
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
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-gray-100 dark:bg-card border border-gray-200 dark:border-border flex flex-wrap gap-1 p-1">
            <TabsTrigger value="scenes" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs">
              Scene Breakdown
              {guide.videoFormat?.aspectRatio && (
                <span className="ml-1.5 opacity-80" title={guide.videoFormat.orientation === "horizontal" ? "YouTube horizontal format" : "Vertical short-form format"}>
                  {guide.videoFormat.aspectRatio === "16:9" ? " (16:9)" : " (9:16)"}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="editing" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs">
              Editing Guide
            </TabsTrigger>
            <TabsTrigger value="subtitles" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs">
              Subtitles & Text
            </TabsTrigger>
            <TabsTrigger value="music" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs">
              Music & Audio
            </TabsTrigger>
            <TabsTrigger value="export" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs">
              Export & Post
            </TabsTrigger>
            <TabsTrigger value="social-kit" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs">
              Social Media Kit
            </TabsTrigger>
            <TabsTrigger value="voiceover" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs">
              Voiceover
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scenes" className="mt-6 space-y-4">
            {/* Character Setup */}
            <Card className="border-gray-200 dark:border-border bg-gray-50 dark:bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
                  <ImagePlus className="w-4 h-4 text-orange-500" />
                  Character Setup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-muted-foreground">
                  Use the same reference image across all scenes for consistent characters. Works best with Midjourney (--cref) and ChatGPT.
                </p>
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleCharacterRefFile}
                  />
                  <div className="border-2 border-dashed border-gray-200 dark:border-border rounded-lg p-6 text-center hover:border-orange-500/50 transition-colors cursor-pointer bg-gray-100 dark:bg-background">
                    <ImagePlus className="w-10 h-10 mx-auto text-gray-500 dark:text-muted-foreground mb-2" />
                    <p className="text-sm text-gray-600 dark:text-muted-foreground">Upload your character reference image</p>
                    <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">PNG, JPG or WebP</p>
                  </div>
                </label>
                {characterRefPreviewUrl && (
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-border bg-gray-100 dark:bg-background w-24 h-24 shrink-0">
                      <img
                        src={characterRefPreviewUrl}
                        alt="Character reference"
                        className="w-full h-full object-cover"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-0 right-0 h-6 w-6 rounded-bl bg-background/80 text-foreground hover:bg-background"
                        onClick={() => {
                          URL.revokeObjectURL(characterRefPreviewUrl);
                          setCharacterRefPreviewUrl(null);
                          setCharacterRefPublicUrl(null);
                        }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <label className="block">
                        <span className="text-xs text-orange-500 font-medium uppercase tracking-wide">Reference image URL (for Midjourney --cref)</span>
                        <input
                          type="url"
                          placeholder="Paste your hosted image URL"
                          value={characterRefPublicUrl ?? ""}
                          onChange={(e) => setCharacterRefPublicUrl(e.target.value || null)}
                          className="mt-1 w-full rounded-md bg-gray-100 dark:bg-background border border-gray-200 dark:border-border px-3 py-2 text-sm text-foreground placeholder:text-gray-500 dark:placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                      </label>
                      <p className="text-xs text-gray-500 dark:text-muted-foreground">Host your image (e.g. Discord, imgur) and paste the direct image URL here for --cref.</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pro tip */}
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3">
              <Lightbulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm text-foreground space-y-2">
                <p className="font-medium text-foreground">Pro tip: Generate your main character first, then use that image as a reference for all scenes.</p>
                <ul className="list-disc list-inside space-y-0.5 text-gray-700 dark:text-gray-200">
                  <li><strong>Midjourney:</strong> Use --cref flag (best consistency)</li>
                  <li><strong>ChatGPT:</strong> Upload reference image in each prompt</li>
                  <li><strong>Grok:</strong> Upload reference and ask to maintain character</li>
                </ul>
              </div>
            </div>

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

                        return (
                          <div className="space-y-3">
                            <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-1">Slide preview</p>

                            {/* Slide preview card — black bg, bold sans, accent colours */}
                            <div
                              ref={slideRef}
                              className="relative rounded-xl overflow-hidden w-full max-w-sm mx-auto"
                              style={{ background: "#000", aspectRatio: "9/16", fontFamily: "'Inter', 'Helvetica Neue', sans-serif", padding: "5%" }}
                            >
                              {/* Slide type badge */}
                              {vd.slideType && (
                                <span
                                  className="absolute top-4 right-4 text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded"
                                  style={{ background: accent, color: "#000" }}
                                >
                                  {vd.slideType.replace(/_/g, " ")}
                                </span>
                              )}

                              {/* Slide title */}
                              {vd.slideTitle && (
                                <p className="text-white font-bold mb-4 leading-tight" style={{ fontSize: "clamp(14px, 4vw, 20px)", marginTop: "10%" }}>
                                  {vd.slideTitle.split(" ").map((word, wi) =>
                                    word.toLowerCase() === vd.highlightWord?.toLowerCase()
                                      ? <span key={wi} style={{ color: "#facc15" }}>{word} </span>
                                      : <span key={wi}>{word} </span>
                                  )}
                                </p>
                              )}

                              {/* ── Slide-type graphic + points ── */}
                              {(() => {
                                const pts = Array.isArray(vd.slidePoints) ? vd.slidePoints : [];
                                /** Truncate long strings to fit SVG text nodes */
                                const tr = (s: string, max = 22) => s.length > max ? s.slice(0, max - 1) + "…" : s;
                                /** Split a string into two SVG-friendly lines */
                                const twoLines = (s: string, max = 14): [string, string] => {
                                  if (s.length <= max) return [s, ""];
                                  const words = s.split(" ");
                                  let l1 = "";
                                  for (const w of words) {
                                    if ((l1 + (l1 ? " " : "") + w).length > max) break;
                                    l1 += (l1 ? " " : "") + w;
                                  }
                                  return [l1 || s.slice(0, max), s.slice(l1.length).trim()];
                                };

                                /* ── Funnel ── */
                                if (vd.slideType === "funnel") {
                                  const layers = [
                                    { pts: "10,2 290,2 252,64 48,64",  fill: "rgba(0,212,255,0.2)",  stroke: "#00D4FF", cy: 38, col: "#00D4FF" },
                                    { pts: "48,68 252,68 215,130 85,130", fill: "rgba(0,255,136,0.2)", stroke: "#00FF88", cy: 104, col: "#00FF88" },
                                    { pts: "85,134 215,134 188,194 112,194", fill: "rgba(163,230,53,0.2)", stroke: "#a3e635", cy: 170, col: "#a3e635" },
                                  ];
                                  return (
                                    <div style={{ margin: "10px 0" }}>
                                      <svg viewBox="0 0 300 200" width="100%" style={{ height: 200, display: "block" }} xmlns="http://www.w3.org/2000/svg">
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
                                    <div style={{ margin: "10px 0" }}>
                                      <svg viewBox="0 0 300 125" width="100%" style={{ height: 125, display: "block" }} xmlns="http://www.w3.org/2000/svg">
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
                                    <div style={{ margin: "10px 0" }}>
                                      <svg viewBox="0 0 300 145" width="100%" style={{ height: 145, display: "block" }} xmlns="http://www.w3.org/2000/svg">
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
                                    <div style={{ margin: "10px 0" }}>
                                      <svg viewBox="0 0 300 155" width="100%" style={{ height: 155, display: "block" }} xmlns="http://www.w3.org/2000/svg">
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

                                /* ── text_hook + default: standard bullet list ── */
                                if (pts.length === 0) return null;
                                return (
                                  <ul className="space-y-2 mb-4" style={{ listStyle: "none", padding: 0 }}>
                                    {pts.map((pt, pi) => (
                                      <li key={pi} className="flex items-start gap-2 text-white" style={{ fontSize: "clamp(11px, 3vw, 14px)" }}>
                                        <span className="shrink-0 w-2 h-2 rounded-full" style={{ background: accentColors[pi % accentColors.length], marginTop: 4, flexShrink: 0 }} />
                                        <span>{pt}</span>
                                      </li>
                                    ))}
                                  </ul>
                                );
                              })()}

                              {/* Divider */}
                              <div className="absolute left-[5%] right-[5%]" style={{ bottom: "22%", height: 1, background: "#333" }} />

                              {/* Text hook — large bold bottom text */}
                              {vd.textHook && (
                                <p
                                  className="absolute left-[5%] right-[5%] font-black leading-tight"
                                  style={{ bottom: "6%", fontSize: "clamp(16px, 5vw, 26px)", color: "#fff" }}
                                >
                                  {vd.textHook.split(" ").map((word, wi) =>
                                    word.toLowerCase() === vd.highlightWord?.toLowerCase()
                                      ? <span key={wi} style={{ color: "#facc15" }}>{word} </span>
                                      : <span key={wi}>{word} </span>
                                  )}
                                </p>
                              )}
                            </div>

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
                          <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-1">Visual / AI image prompt</p>
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
                      Generate Everything
                    </p>
                    <p className="text-sm text-gray-600 dark:text-muted-foreground mt-1">
                      Auto-generate images + voiceovers + compile MP4 in one go.
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
                      <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
                    ) : (
                      <><Sparkles className="w-4 h-4" />Generate Everything</>
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
                          {!isDarkInfographic && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-2 border-gray-300 dark:border-border"
                              onClick={handleGenerateAllGuideImagesAndOpenTimeline}
                              disabled={scenes.length === 0 || guideBulkImagesLoading}
                            >
                              <Film className="w-4 h-4" />
                              Open in Timeline
                            </Button>
                          )}
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
                                Compile &amp; Export MP4
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
          </TabsContent>

          <TabsContent value="editing" className="mt-6 space-y-4">
<Card className="border-gray-200 dark:border-border bg-gray-50 dark:bg-card">
            <CardHeader>
                <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
                  <Film className="w-4 h-4 text-orange-500" />
                  Recommended tools & steps
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
                <p className="text-xs text-gray-500 dark:text-muted-foreground mt-2">Sync beat drops with scene transitions. Use TikTok Sounds for trending audio.</p>
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
          </TabsContent>

          <TabsContent value="social-kit" className="mt-6 space-y-4" id="social-media-kit-section">
            {!socialKit ? (
              hasTimelineUsage && libraryScriptId ? (
                <Card className="border-gray-200 dark:border-border bg-gray-50 dark:bg-card">
                  <CardContent className="pt-6 pb-6">
                    <div className="flex flex-col items-center text-center max-w-md mx-auto">
                      <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                        <Video className="w-8 h-8 text-green-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">You&apos;ve used the Video Timeline</h3>
                      <p className="text-gray-600 dark:text-muted-foreground text-sm mb-6">
                        Generate your Social Media Kit with titles, hashtags, and captions—no proof upload needed.
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
                    <Button
                      variant="outline"
                      className="border-gray-200 dark:border-border text-gray-700 dark:text-[#E0E0E0] hover:bg-gray-200 dark:hover:bg-muted gap-2"
                      onClick={() => {
                        if (libraryScriptId) {
                          router.push(`/dashboard/video-timeline?libraryScriptId=${encodeURIComponent(libraryScriptId)}`);
                        }
                      }}
                      disabled={!libraryScriptId}
                    >
                      <Film className="w-4 h-4" />
                      Open in Timeline
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1.5">
                    Full script = one audio file (Hook + Body + CTA). Scene voiceovers = one file per scene for the Video Timeline.
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
                    {libraryScriptId && (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-gray-200 dark:border-border text-gray-700 dark:text-[#E0E0E0] hover:bg-gray-100 dark:hover:bg-muted gap-2"
                          onClick={() => router.push(`/dashboard/video-timeline?libraryScriptId=${encodeURIComponent(libraryScriptId)}`)}
                        >
                          <Film className="w-4 h-4" />
                          Open in Timeline
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Ready to create your video? */}
        <Card className="mt-8 border-gray-200 dark:border-border bg-gray-50 dark:bg-card">
          <CardHeader>
            <CardTitle className="text-lg font-medium text-foreground">
              Ready to create your video?
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-muted-foreground">
              Build your timeline here or copy titles, hashtags, and captions to use in another editor.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {libraryScriptId && (
              <Button asChild variant="outline" className="border-gray-200 dark:border-border text-gray-700 dark:text-[#E0E0E0] hover:bg-gray-100 dark:hover:bg-muted gap-2">
                <Link href={`/dashboard/video-timeline?libraryScriptId=${encodeURIComponent(libraryScriptId)}`}>
                  <Film className="w-4 h-4" />
                  Open in Timeline
                </Link>
              </Button>
            )}
            <Button
              asChild
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
            >
              <Link
                href={
                  libraryScriptId
                    ? `/dashboard/video-timeline?importVoiceover=1&libraryScriptId=${encodeURIComponent(libraryScriptId)}`
                    : "/dashboard/video-timeline?importVoiceover=1"
                }
              >
                <Video className="w-4 h-4" />
                Create here
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
