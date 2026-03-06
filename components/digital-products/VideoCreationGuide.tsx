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
type VisualDirection = { aiPrompt?: string; cameraAngle?: string; lightingMood?: string; colorPalette?: string; mediaType?: string };

export type VideoGuideData = {
  script: { hook: string; body: string; cta: string };
  scenePrompts: Array<{ scene: string; timing: string; prompt: string }>;
  productName?: string;
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
        sessionStorage.setItem(SOCIAL_KIT_STORAGE_KEY, JSON.stringify(kit));
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
        sessionStorage.setItem(SOCIAL_KIT_STORAGE_KEY, JSON.stringify(kit));
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
                router.push(`/dashboard/video-timeline?scriptId=${encodeURIComponent(libraryScriptId)}`);
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
    if (!productId || scripts.length === 0 || currentAngleIndex < 0 || currentAngleIndex >= scripts.length) {
      toast({ title: "Cannot regenerate", description: "Product or script missing.", variant: "destructive" });
      return;
    }
    const angle = scripts[currentAngleIndex].title;
    setRegeneratingScript(true);
    try {
      const res = await fetch("/api/digital-products/regenerate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, angle }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Regeneration failed");
      const newScript = data.script as ScriptForGuide | undefined;
      if (newScript) {
        setScripts((prev) => {
          const next = [...prev];
          next[currentAngleIndex] = { ...newScript, id: next[currentAngleIndex].id };
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
  }, [productId, scripts, currentAngleIndex, toast]);

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
                        <Select
                          key={`ai-tool-scene-${i}`}
                          value={getCopyFormat(i)}
                          onValueChange={(v) => {
                            const tool = (v as PromptPlatform) || "midjourney";
                            setCopyFormatByScene((prev) => ({ ...prev, [i]: tool }));
                          }}
                        >
                          <SelectTrigger className="w-[130px] h-8 border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground bg-gray-100 dark:bg-background text-xs">
                            <SelectValue placeholder="Tool" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-50 dark:bg-card border-gray-200 dark:border-border">
                            <SelectItem value="midjourney" className="text-sm">Midjourney</SelectItem>
                            <SelectItem value="grok" className="text-sm">Grok</SelectItem>
                            <SelectItem value="chatgpt" className="text-sm">ChatGPT</SelectItem>
                            <SelectItem value="kling" className="text-sm">Kling AI</SelectItem>
                            <SelectItem value="runway" className="text-sm">Runway ML</SelectItem>
                            <SelectItem value="pika" className="text-sm">Pika</SelectItem>
                          </SelectContent>
                        </Select>
                        <ToggleGroup
                          type="single"
                          value={getMediaType(i)}
                          onValueChange={(v) => {
                            if (v) setMediaTypeByScene((prev) => ({ ...prev, [i]: v as "still" | "video" }));
                          }}
                          className="inline-flex rounded-md border border-gray-200 dark:border-border bg-gray-100 dark:bg-background p-0.5"
                        >
                          <ToggleGroupItem value="still" className="h-7 px-2 text-xs data-[state=on]:bg-white dark:data-[state=on]:bg-muted rounded" aria-label="Still image">
                            Still Image
                          </ToggleGroupItem>
                          <ToggleGroupItem value="video" className="h-7 px-2 text-xs data-[state=on]:bg-white dark:data-[state=on]:bg-muted rounded" aria-label="Video clip">
                            Video Clip
                          </ToggleGroupItem>
                        </ToggleGroup>
                        <button
                          type="button"
                          onClick={() => {
                            const tool = copyFormatByScene[i] || "midjourney";
                            const base = fullPrompt || "";
                            const duration = (() => {
                              const parts = (scene.timing || "0-0").match(/[\d.]+/g) || ["0", "0"];
                              return Math.max(0, parseFloat(parts[1]) - parseFloat(parts[0]));
                            })();
                            const camera = (scene as { cameraAngle?: string }).cameraAngle || "medium shot";
                            const ar = guide.videoFormat?.aspectRatio ?? (scene as { format?: { aspect_ratio?: string } }).format?.aspect_ratio ?? "9:16";
                            const isHorizontal = ar === "16:9";
                            let prompt = base;
                            if (tool === "midjourney") prompt = `${base} --ar ${ar} --v 6 --style raw`;
                            else if (tool === "grok") prompt = `${base}\n\nAspect ratio: ${ar}\nStyle: photorealistic`;
                            else if (tool === "chatgpt") prompt = `Generate a photorealistic ${isHorizontal ? "horizontal" : "vertical"} image (${ar} aspect ratio): ${base}`;
                            else if (tool === "kling") prompt = `${base}\n\nFormat: ${isHorizontal ? "horizontal" : "vertical"} ${ar}\nDuration: ${duration}s\nMotion: subtle slow push in\nCamera: ${camera}`;
                            else if (tool === "runway") prompt = `${base}\nMotion amount: low\nCamera: ${camera} slow\nDuration: ${duration}s\nAspect ratio: ${ar}`;
                            else if (tool === "pika") prompt = `${base} | camera: ${camera} | motion: 1 | aspect ratio: ${ar} | duration: ${duration}s`;
                            navigator.clipboard.writeText(prompt)
                              .then(() => toast({ title: "Copied", description: "AI prompt copied for " + tool }))
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
                    <div>
                      <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-1">Visual / AI image prompt</p>
                      <p className="text-foreground whitespace-pre-wrap">{stripMarkdown(fullPrompt ?? "")}</p>
                    </div>
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
                          router.push(`/dashboard/video-timeline?scriptId=${encodeURIComponent(libraryScriptId)}`);
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
                          onClick={() => router.push(`/dashboard/video-timeline?scriptId=${encodeURIComponent(libraryScriptId)}`)}
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
                <Link href={`/dashboard/video-timeline?scriptId=${encodeURIComponent(libraryScriptId)}`}>
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
                    ? `/dashboard/video-timeline?importVoiceover=1&scriptId=${encodeURIComponent(libraryScriptId)}`
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
