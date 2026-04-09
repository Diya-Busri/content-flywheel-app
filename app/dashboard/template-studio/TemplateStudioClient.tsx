"use client";

import { Fragment, useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import html2canvas from "html2canvas";
import JSZip from "jszip";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Sparkles,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  Download,
  Copy,
  Save,
  Film,
  ExternalLink,
  CalendarClock,
  Send,
  Lightbulb,
} from "lucide-react";
import { getTemplateStudioPrefill, clearTemplateStudioPrefill } from "@/lib/template-studio-prefill";
import { setVideoPrefill, getTimelineUrl } from "@/lib/video-prefill";
import { SlideDeck } from "./SlideDeck";
import { SlidePreview } from "./SlidePreview";
import { parseCharacterTypes } from "@/lib/ai-story-character-style";
import { getPrimaryCharacterTypeForScene } from "@/lib/ai-story-reference-image";
import { BGM_SELECT_OPTIONS, type BgmSelectValue } from "@/lib/bgm-tracks";
import { SatisfyingBuildSetup } from "@/components/templates/SatisfyingBuildSetup";
import { AiCookingVideoSetup } from "@/components/templates/AiCookingVideoSetup";
import { CreatableSelectField } from "@/components/templates/CreatableSelectField";
import { StickmanWhiteboardSetup } from "@/components/templates/StickmanWhiteboardSetup";
import { StickmanWhiteboard } from "@/components/templates/StickmanWhiteboard";
import type { StickmanScene } from "@/components/templates/StickmanWhiteboard";
import { ViralTemplatePreview, VIRAL_SHORT_DURATION, VIRAL_LONG_DURATION } from "@/components/templates/ViralTemplatePreview";
import type { ViralTemplateData, ViralSettings } from "@/components/templates/ViralTemplatePreview";
import { KineticTypographyPreview, KINETIC_COLOR_OPTIONS, KINETIC_VOICE_OPTIONS } from "@/components/templates/KineticTypographyPreview";
import type { KineticData } from "@/components/templates/KineticTypographyPreview";
import { AiStorySceneVoiceover } from "@/components/ai-story/AiStorySceneVoiceover";
import { AiStoryAnimateSceneBlock } from "@/components/ai-story/AiStoryAnimateSceneBlock";
import {
  CREATION_MODE_OPTION_GROUPS,
  type AiCookingVideoSceneCountChoice,
  STORY_VIDEO_TONE_OPTIONS,
  TEMPLATE_STUDIO_STORY_GENERATE_ROUTES,
  type CreationMode,
  type TemplateStudioStoryTemplateId,
  FINANCE_DOC_NICHE_OPTIONS,
  FINANCE_DOC_STYLE_OPTIONS,
  FINANCE_DOC_TONE_OPTIONS,
  FINANCE_DOC_LENGTH_OPTIONS,
  FINANCE_DOC_HOOK_OPTIONS,
  FINANCE_DOC_CTA_OPTIONS,
  FINANCE_DOC_AFFILIATE_PLATFORMS,
  FINANCE_DOC_TOPIC_SUGGESTIONS,
} from "./template-studio-shared";
import { ELEVENLABS_VOICES, getDefaultVoiceId, setDefaultVoiceId } from "@/lib/elevenlabs-voices";
import { toSpeakable } from "@/lib/to-speakable";
import { deductVideoCredit } from "@/actions/video-credits-actions";
import { normalizeRawQuizRound } from "@/lib/viral-quiz-shuffle";
import { resolveViralVisualTheme } from "@/lib/viral-visual-themes";
import {
  buildStickmanLibraryTitle,
  buildViralExportFilenameBase,
  loadTemplateStudioSeriesPrefs,
  mergeSeriesIntoTimelinePayload,
  saveTemplateStudioSeriesPrefs,
} from "@/lib/template-studio-series";
import {
  STORY_VIDEO_DEFAULT_ART_STYLE,
  STORY_VIDEO_FORMAT_OPTIONS,
  STORY_VIDEO_SCENE_LONG,
  STORY_VIDEO_SCENE_SHORT,
  STORY_VIDEO_VIDEO_STRUCTURE_OPTIONS,
  clampStoryVideoSceneCount,
  type StoryVideoFormat,
  type StoryVideoVideoStructure,
} from "@/lib/story-video";
type TemplateType = "quotes" | "tips" | "affirmations";
type FontStyle = "modern" | "elegant" | "bold" | "minimal";
type SlideItem = { heading: string; body: string; bg_color?: string };
type CaptionItem = { caption: string; hashtags: string; alt_text: string };
type PublishPlatform = "instagram" | "facebook" | "tiktok" | "youtube";
type SocialMediaPack = {
  caption: string;
  title: string;
  hashtags: string[];
  youtubeDescription: string;
};

const TEMPLATE_OPTIONS: { value: TemplateType; label: string }[] = [
  { value: "quotes", label: "Quotes" },
  { value: "tips", label: "Tips" },
  { value: "affirmations", label: "Affirmations" },
];

const POST_GOAL_OPTIONS = [
  { value: "tease drop", label: "Tease drop" },
  { value: "build community", label: "Build community" },
  { value: "announce launch", label: "Announce launch" },
  { value: "aesthetic content", label: "Aesthetic content" },
];

const HOOK_ANGLE_OPTIONS = [
  { value: "Problem/Pain Point", label: "Problem/Pain Point (e.g., \"Stop dressing boring\")" },
  { value: "Controversial Take", label: "Controversial Take (e.g., \"Minimalism is overrated\")" },
  { value: "Curiosity Gap", label: "Curiosity Gap (e.g., \"3 styling secrets brands hide\")" },
  { value: "Social Proof", label: "Social Proof (e.g., \"How I grew to 10k followers\")" },
  { value: "Transformation", label: "Transformation (e.g., \"Before I knew these rules...\")" },
];

const CTA_GOAL_OPTIONS = [
  { value: "Get followers", label: "Get followers (CTA: \"Follow for more\")" },
  { value: "Get saves", label: "Get saves (CTA: \"Save this for later\")" },
  { value: "Drive link clicks", label: "Drive link clicks (CTA: \"Link in bio\")" },
  { value: "Get engagement", label: "Get engagement (CTA: \"Comment your favorite\")" },
];

const SLIDE_COUNT_OPTIONS = [5, 10, 20] as const;
const SLIDE_COUNT_VIRAL_OPTIONS = [5, 6, 7, 8, 9, 10] as const;

const AI_STORY_TONE_OPTIONS = [
  { value: "Sad", label: "Sad" },
  { value: "Dramatic", label: "Dramatic" },
  { value: "Shocking", label: "Shocking" },
];

const AI_STORY_STYLE_OPTIONS = [
  { value: "Brainrot", label: "Brainrot" },
  { value: "Classic Dramatic", label: "Classic Dramatic" },
  { value: "Dark & Twisted", label: "Dark & Twisted" },
  { value: "Wholesome", label: "Wholesome" },
];

const ELEVENLABS_DEFAULT_VOICE_FEMALE = "21m00Tcm4TlvDq8ikWAM";
const ELEVENLABS_DEFAULT_VOICE_MALE = "TxGEqnHWrfWFTfGW9XjX";

function getDefaultVoiceIdForCharacter(characterName: string): string {
  const n = characterName.toLowerCase();
  if (/\b(nana|berry|cherry|strawberry)\b/.test(n)) return ELEVENLABS_DEFAULT_VOICE_FEMALE;
  if (/\b(banana|skibidi|sigma|rizz)\b/.test(n)) return ELEVENLABS_DEFAULT_VOICE_MALE;
  return ELEVENLABS_DEFAULT_VOICE_FEMALE;
}

const FONT_OPTIONS: { value: FontStyle; label: string }[] = [
  { value: "modern", label: "Modern" },
  { value: "elegant", label: "Elegant" },
  { value: "bold", label: "Bold" },
  { value: "minimal", label: "Minimal" },
];

const LIBRARY_DRAFT_STORAGE_KEY = "content-flywheel-template-studio-library-draft-id";
const STICKMAN_LIBRARY_DRAFT_STORAGE_KEY = "content-flywheel-stickman-library-draft-id";
const TIMELINE_SCENE_DURATION = 5;
/** Mode 17 Finance Documentary — ~12s per scene, volume from scene count not duration */
const FINANCE_DOC_SCENE_DURATION = 12;
/** AI Story generate route returns exactly 8 scenes. */
const AI_STORY_SCENE_COUNT = 8;
const SCENE_COLOR_HEX = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

function isHttpUrl(s: string | undefined | null): boolean {
  const t = typeof s === "string" ? s.trim() : "";
  return t.startsWith("http://") || t.startsWith("https://");
}

/** Build timeline-format content (Scene[] + captions) for video-timeline save/update. */
function buildTimelineContentFromAiStory(
  aiStoryScenes: { sceneNumber: number; dialogue: string }[],
  sceneImageUrls: Record<number, string>,
  sceneVideoUrls: Record<number, string>,
  voiceoverUrls: Record<number, string>,
  sceneDuration?: number
): { scenes: unknown[]; captions: unknown[]; totalDuration: number } {
  const scenes = aiStoryScenes.map((scene, i) => {
    const duration = sceneDuration ?? TIMELINE_SCENE_DURATION;
    const startTime = i * duration;
    const title = (scene.dialogue?.trim() || `Scene ${i + 1}`).slice(0, 80);
    const videoUrl = sceneVideoUrls[scene.sceneNumber];
    const imageUrl = sceneImageUrls[scene.sceneNumber];
    const media = videoUrl
      ? { url: videoUrl, type: "video" as const }
      : imageUrl
        ? { url: imageUrl, type: "image" as const }
        : null;
    return {
      id: `template-scene-${i}`,
      title,
      duration,
      color: SCENE_COLOR_HEX[i % SCENE_COLOR_HEX.length],
      elements: [{ id: `template-scene-${i}-bg`, type: "background" as const, media }],
      startTime,
      ...(voiceoverUrls[scene.sceneNumber] ? { audioUrl: voiceoverUrls[scene.sceneNumber] } : {}),
    };
  });
  const captions = aiStoryScenes
    .map((s, i) => {
      const text = s.dialogue?.trim();
      if (!text) return null;
      const startTime = i * TIMELINE_SCENE_DURATION;
      return {
        id: `cap-template-${i}`,
        text,
        startTime,
        endTime: startTime + TIMELINE_SCENE_DURATION,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c != null);
  const totalDuration = scenes.length * TIMELINE_SCENE_DURATION;
  return { scenes, captions, totalDuration };
}

const MAX_LIBRARY_TITLE_LEN = 120;

function buildTemplateStudioLibraryTitle(params: {
  mode: CreationMode;
  episodeNumber: number;
  theme: string;
  whatBuilding: string;
  dishName: string;
  /** Story Video (mode 15) topic line for library title. */
  storyVideoTopic?: string;
  /** Finance Documentary (mode 17) topic line for library title. */
  financeDocTopic?: string;
  /** When set, titles become `Show · Ep N: …` for My Library grouping. */
  seriesShowTitle?: string;
}): string {
  const ep = params.episodeNumber >= 1 ? params.episodeNumber : 1;
  let core: string;
  if (params.mode === "17") {
    const t = (params.financeDocTopic ?? "").trim();
    core = t
      ? `Finance Doc - ${t.slice(0, 65)}${t.length > 65 ? "…" : ""} - Ep ${ep}`
      : `Finance Documentary - Episode ${ep}`;
  } else if (params.mode === "15") {
    const t = (params.storyVideoTopic ?? "").trim();
    core = t
      ? `Story Video - ${t.slice(0, 70)}${t.length > 70 ? "…" : ""} - Episode ${ep}`
      : `Story Video - Episode ${ep}`;
  } else if (params.mode === "9") {
    const dish = params.dishName.trim();
    core = dish
      ? `AI Cooking Video - ${dish.slice(0, 70)}${dish.length > 70 ? "…" : ""} - Episode ${ep}`
      : `AI Cooking Video - Episode ${ep}`;
  } else if (params.mode === "8") {
    const wb = params.whatBuilding.trim();
    core = wb
      ? `Satisfying Build - ${wb.slice(0, 70)}${wb.length > 70 ? "…" : ""} - Episode ${ep}`
      : `Satisfying Build - Episode ${ep}`;
  } else {
    const storyTitle = params.theme.trim() || "Story";
    const st = storyTitle.length > 60 ? `${storyTitle.slice(0, 59)}…` : storyTitle;
    core = `AI Story - ${st} - Episode ${ep}`;
  }
  const show = params.seriesShowTitle?.trim();
  if (!show) {
    return core.length > MAX_LIBRARY_TITLE_LEN ? `${core.slice(0, MAX_LIBRARY_TITLE_LEN - 1)}…` : core;
  }
  const prefixed = `${show} · Ep ${ep}: ${core}`;
  return prefixed.length > MAX_LIBRARY_TITLE_LEN ? `${prefixed.slice(0, MAX_LIBRARY_TITLE_LEN - 1)}…` : prefixed;
}

export default function TemplateStudioClient() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<CreationMode>("1");
  const [brandName, setBrandName] = useState("");
  const [niche, setNiche] = useState("");
  const [customCreationTopic, setCustomCreationTopic] = useState("");
  const [templateType, setTemplateType] = useState<TemplateType>("quotes");
  const [slideCount, setSlideCount] = useState<5 | 10 | 20>(5);
  const [brandPrimary, setBrandPrimary] = useState("#FF6B35");
  const [brandSecondary, setBrandSecondary] = useState("#004E89");
  const [fontStyle, setFontStyle] = useState<FontStyle>("modern");
  const [productDescription, setProductDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [painPoints, setPainPoints] = useState("");
  const [brandVibe, setBrandVibe] = useState("");
  const [postGoal, setPostGoal] = useState("aesthetic content");
  const [hookAngle, setHookAngle] = useState("Problem/Pain Point");
  const [ctaGoal, setCtaGoal] = useState("Get followers");
  const [slideCountViral, setSlideCountViral] = useState<5 | 6 | 7 | 8 | 9 | 10>(10);
  const [setupLoaded, setSetupLoaded] = useState(false);
  /** Form state: when false, scene cards hide voiceover controls (default on). */
  const [voiceoverEnabled, setVoiceoverEnabled] = useState(true);
  const [characters, setCharacters] = useState("");
  const [characterNames, setCharacterNames] = useState("");
  const [theme, setTheme] = useState("");
  const [aiStoryTone, setAiStoryTone] = useState("Dramatic");
  const [aiStoryStyle, setAiStoryStyle] = useState("Brainrot");
  const [episodeNumber, setEpisodeNumber] = useState(1);
  /** Optional show name — groups drafts in My Library + prefixes stickman / story titles. */
  const [seriesShowTitle, setSeriesShowTitle] = useState("");
  const [seriesPrefsLoaded, setSeriesPrefsLoaded] = useState(false);
  const [satisfyingCharacterType, setSatisfyingCharacterType] = useState("Person");
  const [whatBuilding, setWhatBuilding] = useState("");
  const [satisfyingBuildStyle, setSatisfyingBuildStyle] = useState("Miniature Construction");
  const [satisfyingBuildTone, setSatisfyingBuildTone] = useState("Satisfying");
  const [satisfyingOpeningHook, setSatisfyingOpeningHook] = useState("");
  const [cookingChefType, setCookingChefType] = useState("Home Cook");
  const [cookingDishName, setCookingDishName] = useState("");
  const [cookingStyle, setCookingStyle] = useState("Cozy Home Kitchen");
  const [cookingTone, setCookingTone] = useState("Satisfying");
  const [cookingOpeningHook, setCookingOpeningHook] = useState("");
  const [cookingSceneCount, setCookingSceneCount] =
    useState<AiCookingVideoSceneCountChoice>("auto");
  const [storyVideoTopic, setStoryVideoTopic] = useState("");
  const [storyVideoChannelNiche, setStoryVideoChannelNiche] = useState("");
  type StoryTopicSuggestion = {
    title: string;
    targetAudience: string;
    tone: "motivational" | "educational" | "story";
    characterDescription: string;
  };
  const [storyVideoTopicSuggestions, setStoryVideoTopicSuggestions] = useState<StoryTopicSuggestion[]>([]);
  const [storyVideoTopicSuggestionsLoading, setStoryVideoTopicSuggestionsLoading] = useState(false);
  const [storyVideoTargetAudience, setStoryVideoTargetAudience] = useState("");
  const [storyVideoCharacterDescription, setStoryVideoCharacterDescription] = useState("");
  const [storyVideoTone, setStoryVideoTone] = useState<"motivational" | "educational" | "story">(
    "story"
  );
  const [storyVideoFormat, setStoryVideoFormat] = useState<StoryVideoFormat>("short");
  const [storyVideoVideoStructure, setStoryVideoVideoStructure] =
    useState<StoryVideoVideoStructure>("full_story");
  const [storyVideoSceneCount, setStoryVideoSceneCount] = useState(6);
  const [storyVideoArtStyle, setStoryVideoArtStyle] = useState(STORY_VIDEO_DEFAULT_ART_STYLE);
  const [brandStoryDayLabel, setBrandStoryDayLabel] = useState("Day 1");
  const [brandStoryBrandField, setBrandStoryBrandField] = useState("");
  const [brandStoryThemeLine, setBrandStoryThemeLine] = useState("");
  const [brandStoryVoiceId, setBrandStoryVoiceId] = useState("pNInz6obpgDQGcFmaJgB");
  const [brandStoryVideoLoading, setBrandStoryVideoLoading] = useState(false);
  // Mode 17 — Finance / Business Documentary
  const [financeDocTopic, setFinanceDocTopic] = useState("");
  const [financeDocNiche, setFinanceDocNiche] = useState("Personal Finance");
  const [financeDocStyle, setFinanceDocStyle] = useState("Dark Luxury");
  const [financeDocTone, setFinanceDocTone] = useState("Documentary");
  const [financeDocLength, setFinanceDocLength] = useState<"short" | "medium" | "long">("medium");
  const [financeDocHookStyle, setFinanceDocHookStyle] = useState("shocking_stat");
  const [financeDocCtaGoal, setFinanceDocCtaGoal] = useState("subscribe");
  const [financeDocChannelName, setFinanceDocChannelName] = useState("");
  const [financeDocProductName, setFinanceDocProductName] = useState("");
  const [financeDocAffiliatePlatform, setFinanceDocAffiliatePlatform] = useState("trading212");
  const [financeDocAffiliateCustomName, setFinanceDocAffiliateCustomName] = useState("");
  const [financeDocAffiliateOffer, setFinanceDocAffiliateOffer] = useState("");

  // Mode 16 — AI Animation Video Prompts
  const [animCharacterName, setAnimCharacterName] = useState("");
  const [animCharacterDescription, setAnimCharacterDescription] = useState("");
  const [animVideoStyle, setAnimVideoStyle] = useState("Relatable couple / POV comedy");
  const [animPromptCount, setAnimPromptCount] = useState<10 | 15 | 20>(10);
  const [animPrompts, setAnimPrompts] = useState<{ caption: string; animationPrompt: string; mood: string; engagementHook: string }[]>([]);
  const [animPromptsLoading, setAnimPromptsLoading] = useState(false);
  const [animCopiedIndex, setAnimCopiedIndex] = useState<number | null>(null);
  const [brandStoryVideoUrl, setBrandStoryVideoUrl] = useState<string | null>(null);
  const [brandStoryVideoError, setBrandStoryVideoError] = useState<string | null>(null);
  const [aiStoryLoading, setAiStoryLoading] = useState(false);
  const [aiStoryScenes, setAiStoryScenes] = useState<{ sceneNumber: number; dialogue: string; imagePrompt: string; motionPrompt?: string }[]>([]);
  const [socialMediaPack, setSocialMediaPack] = useState<SocialMediaPack | null>(null);
  const [socialMediaPackLoading, setSocialMediaPackLoading] = useState(false);
  const [aiStoryCharacterStyle, setAiStoryCharacterStyle] = useState<string>("");
  /** GPT-4o ~40-word visual lock; prepended to each scene image_prompt on the server. */
  const [characterSeed, setCharacterSeed] = useState("");
  /** Per-character reference image URLs (FLUX text-to-image); used as img2img anchors for scenes. */
  const [characterReferenceUrls, setCharacterReferenceUrls] = useState<Record<string, string>>({});
  const [characterPreviewLoading, setCharacterPreviewLoading] = useState(false);
  const [aiStoryUiPhase, setAiStoryUiPhase] = useState<"form" | "characterPreview">("form");
  const [characterVoices, setCharacterVoices] = useState<Record<string, string>>({});
  const [elevenLabsVoices, setElevenLabsVoices] = useState<{ voice_id: string; name: string; description?: string }[]>([]);
  const [voiceoverUrls, setVoiceoverUrls] = useState<Record<number, string>>({});
  const [sceneImageUrls, setSceneImageUrls] = useState<Record<number, string>>({});
  const [sceneImageLoadingScene, setSceneImageLoadingScene] = useState<number | null>(null);
  const [sceneVideoUrls, setSceneVideoUrls] = useState<Record<number, string>>({});
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);
  const [allImagesGenerating, setAllImagesGenerating] = useState(false);
  const [allImagesProgress, setAllImagesProgress] = useState<{ done: number; total: number } | null>(null);
  const [allVoiceoversGenerating, setAllVoiceoversGenerating] = useState(false);
  const [allVoiceoversProgress, setAllVoiceoversProgress] = useState<{ done: number; total: number } | null>(null);
  const [allAnimationsGenerating, setAllAnimationsGenerating] = useState(false);
  const [allAnimationsProgress, setAllAnimationsProgress] = useState<{ done: number; total: number } | null>(null);

  /** Mode 9: single photoreal chef reference portrait for identity anchoring (FLUX img2img). */
  const [cookingChefReferenceUrl, setCookingChefReferenceUrl] = useState<string>("");
  const [cookingChefReferenceLoading, setCookingChefReferenceLoading] = useState(false);
  // ── Stickman Whiteboard state (mode 11) ──────────────────────────────────────
  const [stickmanTopic, setStickmanTopic] = useState("");
  const [stickmanSceneCount, setStickmanSceneCount] = useState(6);
  const [stickmanLongMode, setStickmanLongMode] = useState(false);
  const [stickmanTargetMinutes, setStickmanTargetMinutes] = useState(15);
  const [stickmanVoiceId, setStickmanVoiceId] = useState("EXAVITQu4vr4xnSDxMaL");
  const [stickmanIntroScript, setStickmanIntroScript] = useState("");
  const [stickmanCtaScript, setStickmanCtaScript] = useState("");
  const [stickmanOutroScript, setStickmanOutroScript] = useState("");
  const [stickmanScenes, setStickmanScenes] = useState<StickmanScene[]>([]);
  const [stickmanLoading, setStickmanLoading] = useState(false);
  const [stickmanLibrarySaving, setStickmanLibrarySaving] = useState(false);
  const [stickmanExporting, setStickmanExporting] = useState(false);
  const [stickmanTikTokPosting, setStickmanTikTokPosting] = useState(false);
  const [stickmanLibraryVideoId, setStickmanLibraryVideoId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return sessionStorage.getItem(STICKMAN_LIBRARY_DRAFT_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  // ── Viral Template state (mode 12) ──────────────────────────────────────────
  const [viralTopic, setViralTopic] = useState("");
  const [viralType, setViralType] = useState<"would-you-rather" | "quiz">("would-you-rather");
  const [viralRoundCount, setViralRoundCount] = useState(7);
  const [viralFormLength, setViralFormLength] = useState<"short" | "long">("short");
  const [viralShowTimer, setViralShowTimer] = useState(true);
  const [viralVoiceover, setViralVoiceover] = useState(false);
  /** ElevenLabs voice for MP4 export (same catalog as Video Creation Guide). */
  const [viralExportVoiceId, setViralExportVoiceId] = useState(ELEVENLABS_VOICES[0].voiceId);
  const [viralBgm, setViralBgm] = useState<BgmSelectValue>("upbeat");
  const [viralData, setViralData] = useState<import("@/components/templates/ViralTemplatePreview").ViralTemplateData | null>(null);
  const [viralLoading, setViralLoading] = useState(false);
  const [viralExporting, setViralExporting] = useState(false);

  useEffect(() => {
    setViralExportVoiceId(getDefaultVoiceId());
  }, []);

  // ── Kinetic Typography state (mode 13) ───────────────────────────────────────
  const [kineticTopic, setKineticTopic] = useState("");
  const [kineticFormLength, setKineticFormLength] = useState<"short" | "long">("short");
  const [kineticSceneCount, setKineticSceneCount] = useState(12);
  const [kineticColorScheme, setKineticColorScheme] = useState<import("@/components/templates/KineticTypographyPreview").KineticData["colorScheme"]>("dark-orange");
  const [kineticVoiceId, setKineticVoiceId] = useState("EXAVITQu4vr4xnSDxMaL");
  const [kineticData, setKineticData] = useState<import("@/components/templates/KineticTypographyPreview").KineticData | null>(null);
  const [kineticLoading, setKineticLoading] = useState(false);
  const [kineticExporting, setKineticExporting] = useState(false);
  const [kineticPreviewVoiceover, setKineticPreviewVoiceover] = useState(false);

  const [storyVideoExporting, setStoryVideoExporting] = useState(false);
  const [storyVideoExportPhase, setStoryVideoExportPhase] = useState<"saving" | "compiling" | null>(null);
  const [storyVideoExportUrl, setStoryVideoExportUrl] = useState<string | null>(null);
  const [storyVideoExportScriptId, setStoryVideoExportScriptId] = useState<string | null>(null);
  const [storyVideoExportError, setStoryVideoExportError] = useState<string | null>(null);
  // Auto full-video generation state
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [autoGeneratePhase, setAutoGeneratePhase] = useState<string | null>(null);
  const [autoGenerateProgress, setAutoGenerateProgress] = useState<{ done: number; total: number } | null>(null);
  const [autoGenerateError, setAutoGenerateError] = useState<string | null>(null);
  const [copiedStoryVideoLink, setCopiedStoryVideoLink] = useState(false);
  const [storyBackgroundMusic, setStoryBackgroundMusic] = useState<BgmSelectValue>("none");

  const [libraryDraftVideoId, setLibraryDraftVideoId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return sessionStorage.getItem(LIBRARY_DRAFT_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [libraryDraftSaving, setLibraryDraftSaving] = useState(false);
  const libraryCreateInFlightRef = useRef(false);

  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [captions, setCaptions] = useState<CaptionItem[]>([]);
  const [carouselCaption, setCarouselCaption] = useState("");
  /** Single hashtags string for the whole carousel (space-separated, #tags). */
  const [carouselHashtags, setCarouselHashtags] = useState("");
  const [captionGenLoading, setCaptionGenLoading] = useState(false);
  const [hashtagGenLoading, setHashtagGenLoading] = useState(false);
  const [connectedPlatforms, setConnectedPlatforms] = useState<Set<PublishPlatform>>(() => new Set());
  const [publishTargets, setPublishTargets] = useState<Record<PublishPlatform, boolean>>({
    instagram: false,
    facebook: false,
    tiktok: false,
    youtube: false,
  });
  const [publishing, setPublishing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [packName, setPackName] = useState("");
  const [savingPack, setSavingPack] = useState(false);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const publishSlideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const aiStoryScenesSectionRef = useRef<HTMLDivElement | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  const { toast } = useToast();

  const selectedTemplate: TemplateStudioStoryTemplateId | undefined =
    mode === "7"
      ? "ai_story"
      : mode === "8"
        ? "satisfying_build"
        : mode === "9"
          ? "ai_cooking_video"
          : mode === "15"
            ? "story_video"
            : mode === "17"
              ? "finance_documentary"
              : undefined;
  const isStoryTemplateMode = mode === "7" || mode === "8" || mode === "9" || mode === "15" || mode === "17";
  const isAiStoryMode = mode === "7";
  const isStickmanMode = mode === "11";
  const isViralMode = mode === "12";
  const isKineticMode = mode === "13";
  /** Modes that attach show/episode into timeline metadata when saving (not the setup-only screen). */
  const isTemplateStudioSeriesMode =
    mode === "7" ||
    mode === "8" ||
    mode === "9" ||
    mode === "10" ||
    mode === "11" ||
    mode === "12" ||
    mode === "13" ||
    mode === "15" ||
    mode === "17";
  const isSeriesLibrarySetupMode = mode === "14";

  useEffect(() => {
    const p = loadTemplateStudioSeriesPrefs();
    setSeriesShowTitle(p.seriesTitle);
    setEpisodeNumber(p.episodeNumber);
    setSeriesPrefsLoaded(true);
  }, []);

  useEffect(() => {
    if (!seriesPrefsLoaded) return;
    saveTemplateStudioSeriesPrefs({ seriesTitle: seriesShowTitle, episodeNumber });
  }, [seriesPrefsLoaded, seriesShowTitle, episodeNumber]);

  const persistStickmanDraft = useCallback(async (silent = false): Promise<string | null> => {
    if (!isStickmanMode || stickmanScenes.length === 0) return null;
    if (!silent) setStickmanLibrarySaving(true);
    try {
      const baseTopic = stickmanTopic.trim() || "Stickman Whiteboard";
      const draftTitle = buildStickmanLibraryTitle(baseTopic, seriesShowTitle, episodeNumber);
      const estimatedSceneDuration = stickmanLongMode ? 28 : 12;
      let runStart = 0;
      const timelineScenes = stickmanScenes.map((scene, idx) => {
        const id = `stickman-${idx + 1}`;
        const startTime = runStart;
        runStart += estimatedSceneDuration;
        return {
          id,
          title: scene.caption.slice(0, 80),
          duration: estimatedSceneDuration,
          color: SCENE_COLOR_HEX[idx % SCENE_COLOR_HEX.length] ?? "#3B82F6",
          startTime,
          elements: [{ id: `${id}-bg`, type: "background", media: null }],
          pose: scene.pose,
          layout: scene.layout ?? "left-presenter",
          keyObject: scene.keyObject ?? "idea",
          camera: scene.camera ?? "medium",
          shotTemplate: scene.shotTemplate ?? "stand-explain",
        };
      });
      const totalDuration = timelineScenes.reduce((acc, s) => acc + s.duration, 0);
      const timedCaptions = timelineScenes.map((s, i) => ({
        id: `cap-stickman-${i + 1}`,
        text: stickmanScenes[i]?.caption ?? "",
        startTime: s.startTime,
        endTime: s.startTime + s.duration,
      }));
      const payloadContent = mergeSeriesIntoTimelinePayload(
        {
          scenes: timelineScenes,
          captions: timedCaptions,
          totalDuration,
          aspectRatio: "16:9",
          sourceType: "stickman-whiteboard",
          stickmanScenes,
        },
        seriesShowTitle,
        episodeNumber
      );

      if (stickmanLibraryVideoId) {
        const patchRes = await fetch(`/api/video-timeline/videos/${encodeURIComponent(stickmanLibraryVideoId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: draftTitle,
            metadata: payloadContent,
          }),
        });
        const patchData = await patchRes.json().catch(() => ({}));
        if (!patchRes.ok) {
          throw new Error(typeof patchData?.error === "string" ? patchData.error : "Failed to update stickman draft");
        }
        if (!silent) {
          toast({ title: "Saved to My Library", description: "Your stickman draft is now in My Library." });
        }
        return stickmanLibraryVideoId;
      } else {
        const res = await fetch("/api/video-timeline/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: draftTitle,
            content: payloadContent,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.id) {
          throw new Error(typeof data?.error === "string" ? data.error : "Failed to save stickman draft");
        }
        setStickmanLibraryVideoId(data.id as string);
        try {
          sessionStorage.setItem(STICKMAN_LIBRARY_DRAFT_STORAGE_KEY, data.id as string);
        } catch {
          // ignore
        }
        if (!silent) {
          toast({ title: "Saved to My Library", description: "Your stickman draft is now in My Library." });
        }
        return data.id as string;
      }
    } catch (e) {
      if (!silent) {
        toast({
          title: "Could not save",
          description: e instanceof Error ? e.message : "Failed to save stickman draft",
          variant: "destructive",
        });
      }
      return null;
    } finally {
      if (!silent) setStickmanLibrarySaving(false);
    }
  }, [isStickmanMode, stickmanLibraryVideoId, stickmanLongMode, stickmanScenes, stickmanTopic, toast, seriesShowTitle, episodeNumber]);

  const saveStickmanToLibrary = useCallback(async () => {
    setStickmanLibrarySaving(true);
    await persistStickmanDraft(false);
  }, [persistStickmanDraft]);

  const quickScheduleStickmanYouTube = useCallback(async () => {
    try {
      const accRes = await fetch("/api/connected-accounts");
      const accData = await accRes.json().catch(() => ({}));
      const connected = Array.isArray(accData.connected) ? accData.connected : [];
      const yt = connected.find((a: { platform?: string }) => a.platform === "youtube");
      if (!yt?.id) {
        toast({
          title: "No YouTube account connected",
          description: "Connect YouTube in Settings > Connected accounts first.",
          variant: "destructive",
        });
        return;
      }

      const scheduleDate = new Date(Date.now() + 5 * 60 * 1000);
      const title = `${stickmanTopic.trim() || "Faceless Brand"} | Stickman Whiteboard`;
      const description =
        `${stickmanTopic.trim()}\n\n` +
        `Stickman whiteboard explainer created in Content Flywheel.\n\n` +
        `#facelessbrand #youtubegrowth #contentstrategy`;

      const res = await fetch("/api/scheduled-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: "youtube-video-post",
          platform: "youtube",
          scheduledTime: scheduleDate.toISOString(),
          contentJson: {
            source: "template-studio-stickman",
            youtubeAccountId: yt.id,
            title,
            description,
            keywords: ["faceless brand", "personal brand", "youtube growth", "content strategy"],
            sceneCount: stickmanScenes.length,
            topic: stickmanTopic.trim(),
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Failed to queue YouTube post");
      }
      toast({
        title: "Saved to YouTube queue",
        description: "Post metadata is scheduled and ready for YouTube publishing flow.",
      });
    } catch (e) {
      toast({
        title: "Could not save to YouTube queue",
        description: e instanceof Error ? e.message : "Failed",
        variant: "destructive",
      });
    }
  }, [stickmanScenes.length, stickmanTopic, toast]);

  const exportStickmanFromHere = useCallback(async () => {
    if (stickmanScenes.length === 0) {
      toast({ title: "Nothing to export", description: "Generate stickman scenes first.", variant: "destructive" });
      return;
    }
    setStickmanExporting(true);
    try {
      // Direct export — bypasses Video Timeline entirely.
      const res = await fetch("/api/templates/stickman/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: stickmanTopic.trim(),
          longMode: stickmanLongMode,
          voiceId: stickmanVoiceId,
          scenes: stickmanScenes,
        }),
      });
      const data = await res.json().catch(() => ({} as { url?: string; error?: string }));
      if (!res.ok || !data?.url) {
        throw new Error(typeof data?.error === "string" ? data.error : "Export failed — please try again");
      }

      // fetch → blob so the browser saves with the right filename regardless of CORS headers.
      const fileName = `${(stickmanTopic.trim() || "stickman-video").slice(0, 64)}.mp4`;
      try {
        const fileRes = await fetch(data.url);
        if (!fileRes.ok) throw new Error(`Fetch ${fileRes.status}`);
        const blob = await fileRes.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = fileName;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
      } catch {
        // Fallback: open in new tab if blob download fails
        window.open(data.url, "_blank", "noopener,noreferrer");
      }

      toast({
        title: "MP4 downloading",
        description: "Check your Downloads folder. In Chrome: ⌘⇧J · In Finder: Go → Downloads.",
      });
    } catch (e) {
      toast({
        title: "Export failed",
        description: e instanceof Error ? e.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setStickmanExporting(false);
    }
  }, [stickmanLongMode, stickmanScenes, stickmanTopic, stickmanVoiceId, toast]);

  /** Export the video then post it directly to TikTok via the Content Posting API. */
  const postStickmanToTikTok = useCallback(async () => {
    if (stickmanScenes.length === 0) {
      toast({ title: "Nothing to post", description: "Generate scenes first.", variant: "destructive" });
      return;
    }
    setStickmanTikTokPosting(true);
    try {
      // Step 1 — check TikTok is connected
      const accRes = await fetch("/api/connected-accounts");
      const accData = await accRes.json().catch(() => ({}));
      const connected = Array.isArray(accData.connected) ? accData.connected : [];
      const tiktokAccount = connected.find((a: { platform?: string }) => a.platform === "tiktok");
      if (!tiktokAccount?.id) {
        toast({
          title: "No TikTok account connected",
          description: "Go to Settings → Connected accounts to link your TikTok.",
          variant: "destructive",
        });
        return;
      }

      // Step 2 — export video to get a public URL
      toast({ title: "Exporting video…", description: "Rendering your stickman video for TikTok." });
      const exportRes = await fetch("/api/templates/stickman/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: stickmanTopic.trim(),
          longMode: stickmanLongMode,
          voiceId: stickmanVoiceId,
          scenes: stickmanScenes,
        }),
      });
      const exportData = (await exportRes.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!exportRes.ok || !exportData.url) {
        throw new Error(exportData.error ?? "Video export failed — please try again.");
      }

      // Step 3 — post to TikTok
      const title = (stickmanTopic.trim() || "Stickman Whiteboard").slice(0, 150);
      const postRes = await fetch("/api/tiktok/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: exportData.url,
          title,
          privacyLevel: "SELF_ONLY", // saved as draft — user publishes from TikTok
          accountId: tiktokAccount.id,
        }),
      });
      const postData = (await postRes.json().catch(() => ({}))) as {
        publishId?: string;
        ok?: boolean;
        error?: string;
      };
      if (!postRes.ok || !postData.ok) {
        throw new Error(postData.error ?? "TikTok upload failed.");
      }

      toast({
        title: "Posted to TikTok",
        description: `Saved as a draft on @${tiktokAccount.platformUsername ?? "your account"}. Open TikTok to review and publish.`,
      });
    } catch (e) {
      toast({
        title: "TikTok post failed",
        description: e instanceof Error ? e.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setStickmanTikTokPosting(false);
    }
  }, [stickmanLongMode, stickmanScenes, stickmanTopic, stickmanVoiceId, toast]);

  // Auto-save stickman drafts once scenes are generated.
  useEffect(() => {
    if (!isStickmanMode || stickmanScenes.length === 0) return;
    void persistStickmanDraft(true);
  }, [isStickmanMode, stickmanScenes, stickmanTopic, persistStickmanDraft]);

  const socialMediaPackText = useMemo(() => {
    if (!socialMediaPack) return "";
    const hashtagsLine = socialMediaPack.hashtags.join(" ");
    return [
      "TikTok/Instagram Caption:",
      socialMediaPack.caption,
      "",
      "Title:",
      socialMediaPack.title,
      "",
      "Hashtags:",
      hashtagsLine,
      "",
      "YouTube Description:",
      socialMediaPack.youtubeDescription,
    ].join("\n");
  }, [socialMediaPack]);

  const canProceedStep1 =
    mode === "14"
      ? false
      : mode === "7"
      ? characters.trim().length > 0 && theme.trim().length > 0
      : mode === "8"
        ? satisfyingCharacterType.trim().length > 0 && whatBuilding.trim().length > 0
        : mode === "9"
          ? cookingChefType.trim().length > 0 && cookingDishName.trim().length > 0
          : mode === "15"
            ? storyVideoTopic.trim().length > 0 && storyVideoTargetAudience.trim().length > 0
          : mode === "10"
            ? brandStoryDayLabel.trim().length > 0 &&
              brandStoryBrandField.trim().length > 0 &&
              brandStoryThemeLine.trim().length > 0
            : mode === "11"
              ? stickmanTopic.trim().length > 0
              : mode === "12"
                ? viralTopic.trim().length > 0
                : mode === "13"
                  ? kineticTopic.trim().length > 0
                  : mode === "16"
                    ? animCharacterDescription.trim().length > 0
                  : mode === "17"
                    ? financeDocTopic.trim().length > 0
                  : mode === "1" || mode === "4"
                ? niche.trim().length > 0
                : mode === "2" || mode === "6"
                  ? brandName.trim().length > 0
                  : mode === "5"
                    ? niche.trim().length > 0
                    : brandName.trim().length > 0;

  const useImg2ImgSceneImages = useMemo(
    () => Object.keys(characterReferenceUrls).length > 0,
    [characterReferenceUrls]
  );

  const characterReferenceUrlsSerializeKey = useMemo(
    () => JSON.stringify(characterReferenceUrls),
    [characterReferenceUrls]
  );
  const effectiveVoiceoverUrls = useMemo(
    () => (voiceoverEnabled ? voiceoverUrls : {}),
    [voiceoverEnabled, voiceoverUrls]
  );

  const runCharacterStylePreview = useCallback(async () => {
    if (!isAiStoryMode || !canProceedStep1) return;
    setCharacterPreviewLoading(true);
    setCharacterReferenceUrls({});
    try {
      const res = await fetch("/api/content-studio/ai-story/reference-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characters: characters.trim(),
          theme: theme.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Failed to generate reference images");
      const refs = (data.referenceUrls as Record<string, string>) ?? {};
      setCharacterReferenceUrls(refs);
      setAiStoryUiPhase("characterPreview");
      toast({
        title: "Reference images ready",
        description: "These anchors FLUX image-to-image for each scene. Generate your story when ready.",
      });
    } catch (e) {
      toast({
        title: "Reference images failed",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setCharacterPreviewLoading(false);
    }
  }, [isAiStoryMode, canProceedStep1, characters, theme, toast]);

  const runAnimationPrompts = useCallback(async () => {
    if (mode !== "16" || !canProceedStep1) return;
    setAnimPromptsLoading(true);
    setAnimPrompts([]);
    try {
      const res = await fetch("/api/template-studio/animation-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterName: animCharacterName.trim(),
          characterDescription: animCharacterDescription.trim(),
          videoStyle: animVideoStyle.trim(),
          count: animPromptCount,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { prompts?: { caption: string; animationPrompt: string; mood: string; engagementHook: string }[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to generate prompts");
      setAnimPrompts(Array.isArray(data.prompts) ? data.prompts : []);
      setStep(2);
    } catch (e) {
      toast({ title: "Generation failed", description: e instanceof Error ? e.message : "Something went wrong", variant: "destructive" });
    } finally {
      setAnimPromptsLoading(false);
    }
  }, [mode, canProceedStep1, animCharacterName, animCharacterDescription, animVideoStyle, animPromptCount, toast]);

  const runBrandStoryVideo = useCallback(async () => {
    if (mode !== "10" || !canProceedStep1) return;
    setBrandStoryVideoLoading(true);
    setBrandStoryVideoError(null);
    setBrandStoryVideoUrl(null);
    try {
      const res = await fetch("/api/template-studio/brand-story-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayLabel: brandStoryDayLabel.trim(),
          brandName: brandStoryBrandField.trim(),
          themeLine: brandStoryThemeLine.trim(),
          voiceId: brandStoryVoiceId.trim() || "pNInz6obpgDQGcFmaJgB",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string; code?: string; redirectTo?: string };
      if (res.status === 402 || data.code === "NO_VIDEO_CREDITS") {
        toast({
          title: "No video credits",
          description: "You need to buy video credits to generate this video.",
          variant: "destructive",
        });
        window.location.href = "/dashboard/video-credits";
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Brand story video failed");
      const url = typeof data.url === "string" ? data.url.trim() : "";
      if (!url.startsWith("http")) throw new Error("No video URL returned.");
      setBrandStoryVideoUrl(url);
      toast({
        title: "Vertical video ready",
        description: "Your 9:16 Brand Story MP4 is ready to download.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      setBrandStoryVideoError(msg);
      toast({ title: "Video failed", description: msg, variant: "destructive" });
    } finally {
      setBrandStoryVideoLoading(false);
    }
  }, [
    mode,
    canProceedStep1,
    brandStoryDayLabel,
    brandStoryBrandField,
    brandStoryThemeLine,
    brandStoryVoiceId,
    toast,
  ]);

  const executeAiStoryGenerate = useCallback(
    async (
      episodeForApi: number,
      opts?: { keepPreviousScenesUntilSuccess?: boolean }
    ): Promise<boolean> => {
      if (!isStoryTemplateMode) return false;
      setAiStoryLoading(true);
      if (!opts?.keepPreviousScenesUntilSuccess) {
        setAiStoryScenes([]);
        setSocialMediaPack(null);
        setCharacterSeed("");
      }
      try {
        const generateUrl =
          mode === "7"
            ? TEMPLATE_STUDIO_STORY_GENERATE_ROUTES.ai_story
            : mode === "8"
              ? TEMPLATE_STUDIO_STORY_GENERATE_ROUTES.satisfying_build
              : mode === "15"
                ? TEMPLATE_STUDIO_STORY_GENERATE_ROUTES.story_video
                : mode === "17"
                  ? TEMPLATE_STUDIO_STORY_GENERATE_ROUTES.finance_documentary
                  : TEMPLATE_STUDIO_STORY_GENERATE_ROUTES.ai_cooking_video;
        const res = await fetch(generateUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            mode === "7"
              ? {
                  characters: characters.trim(),
                  characterNames: characterNames.trim() || undefined,
                  theme: theme.trim(),
                  tone: aiStoryTone,
                  style: aiStoryStyle,
                  episodeNumber: episodeForApi,
                  ...(Object.keys(characterReferenceUrls).length > 0
                    ? { consistencyMode: "img2img" as const }
                    : {}),
                }
              : mode === "15"
                ? {
                    topic: storyVideoTopic.trim(),
                    target_audience: storyVideoTargetAudience.trim(),
                    ...(storyVideoCharacterDescription.trim()
                      ? { character_description: storyVideoCharacterDescription.trim() }
                      : {}),
                    tone: storyVideoTone,
                    format: storyVideoFormat,
                    ...(storyVideoFormat === "long"
                      ? { video_structure: storyVideoVideoStructure }
                      : {}),
                    scene_count: storyVideoSceneCount,
                    episode_number: episodeForApi,
                  }
                : mode === "17"
                  ? {
                      topic: financeDocTopic.trim(),
                      niche: financeDocNiche,
                      style: financeDocStyle,
                      tone: financeDocTone,
                      length: financeDocLength,
                      hookStyle: financeDocHookStyle,
                      ctaGoal: financeDocCtaGoal,
                      channelName: financeDocChannelName.trim(),
                      productName: financeDocProductName.trim(),
                      affiliatePlatform: financeDocCtaGoal === "affiliate"
                        ? (financeDocAffiliatePlatform === "other" ? financeDocAffiliateCustomName.trim() : financeDocAffiliatePlatform)
                        : undefined,
                      affiliateOffer: financeDocCtaGoal === "affiliate" ? financeDocAffiliateOffer.trim() : undefined,
                    }
                  : {
                    ...(mode === "8"
                      ? {
                          character_type: satisfyingCharacterType,
                          what_building: whatBuilding.trim(),
                          build_style: satisfyingBuildStyle,
                          tone: satisfyingBuildTone,
                          episode_number: episodeForApi,
                          ...(satisfyingOpeningHook.trim()
                            ? { opening_hook: satisfyingOpeningHook.trim() }
                            : {}),
                        }
                      : {
                          chef_type: cookingChefType,
                          dish_name: cookingDishName.trim(),
                          cooking_style: cookingStyle,
                          tone: cookingTone,
                          episode_number: episodeForApi,
                          scene_count:
                            cookingSceneCount === "auto" ? "auto" : cookingSceneCount,
                          ...(cookingOpeningHook.trim()
                            ? { opening_hook: cookingOpeningHook.trim() }
                            : {}),
                        }),
                  }
          ),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? "Request failed");
        }
        const scenesList = Array.isArray(data.scenes) ? data.scenes : [];
        const nextScenes = scenesList.map(
          (
            s: { sceneNumber?: number; dialogue?: string; imagePrompt?: string; motionPrompt?: string },
            i: number
          ) => ({
            sceneNumber: typeof s.sceneNumber === "number" && s.sceneNumber >= 1 ? s.sceneNumber : i + 1,
            dialogue: typeof s.dialogue === "string" ? s.dialogue : "",
            imagePrompt: typeof s.imagePrompt === "string" ? s.imagePrompt : "",
            motionPrompt: typeof s.motionPrompt === "string" ? s.motionPrompt : "",
          })
        );

        libraryCreateInFlightRef.current = true;
        setAiStoryScenes(nextScenes);
        setAiStoryCharacterStyle(typeof data.characterStyle === "string" ? data.characterStyle : "");
        setCharacterSeed(
          typeof data.character_seed === "string" ? data.character_seed.trim() : ""
        );
        const pack = data.socialMediaPack as {
          caption?: string;
          title?: string;
          hashtags?: string[];
          youtubeDescription?: string;
        } | undefined;
        setSocialMediaPack({
          caption: typeof pack?.caption === "string" ? pack.caption : "",
          title: typeof pack?.title === "string" ? pack.title : "",
          hashtags: Array.isArray(pack?.hashtags) ? pack.hashtags.filter((h): h is string => typeof h === "string") : [],
          youtubeDescription: typeof pack?.youtubeDescription === "string" ? pack.youtubeDescription : "",
        });
        setVoiceoverUrls({});
        setSceneImageUrls({});
        setSceneVideoUrls({});
        setLibraryDraftVideoId(null);
        // Mode 9: generate a single chef reference portrait for consistent identity.
        if (mode === "9") {
          const locked = typeof data.character_seed === "string" ? data.character_seed.trim() : "";
          if (!locked) {
            // If for some reason character_seed is missing, fall back to using chef_type as identity.
            // (Still better than DALL-E-only locking.)
          }
          try {
            setCookingChefReferenceLoading(true);
            const refRes = await fetch("/api/content-studio/ai-cooking-video/reference-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chefType: cookingChefType,
                cookingStyle,
                tone: cookingTone,
                lockedIdentitySeed: locked || characterSeed.trim() || undefined,
              }),
            });
            const refData = await refRes.json();
            if (!refRes.ok) throw new Error(typeof refData?.error === "string" ? refData.error : "Reference image failed");
            setCookingChefReferenceUrl(typeof refData?.referenceUrl === "string" ? refData.referenceUrl.trim() : "");
          } catch (e) {
            setCookingChefReferenceUrl("");
            toast({
              title: "Chef reference image failed",
              description: e instanceof Error ? e.message : "Something went wrong",
              variant: "destructive",
            });
          } finally {
            setCookingChefReferenceLoading(false);
          }
        }

        try {
          sessionStorage.removeItem(LIBRARY_DRAFT_STORAGE_KEY);
        } catch {
          // ignore
        }

        const { scenes: timelineScenes, captions: timelineCaptions, totalDuration } =
          buildTimelineContentFromAiStory(nextScenes, {}, {}, {});
        const libraryTitle = buildTemplateStudioLibraryTitle({
          mode,
          episodeNumber: episodeForApi,
          theme,
          whatBuilding,
          dishName: cookingDishName,
          storyVideoTopic,
          financeDocTopic,
          seriesShowTitle,
        });
        void fetch("/api/video-timeline/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: libraryTitle,
            content: {
              scenes: timelineScenes,
              captions: timelineCaptions,
              totalDuration,
              sourceType:
                mode === "8"
                  ? "satisfying-build"
                  : mode === "9"
                    ? "ai-cooking-video"
                    : mode === "15"
                      ? "story-video"
                      : "ai-story",
              templateStudioScenes: nextScenes,
              libraryItemType: "Video",
              ...(Object.keys(characterReferenceUrls).length > 0
                ? { aiStoryCharacterReferenceUrls: characterReferenceUrls }
                : {}),
            },
          }),
        })
          .then((r) =>
            r.json().then((d: { id?: string; message?: string; error?: string }) => ({
              ok: r.ok,
              d,
            }))
          )
          .then(({ ok, d }) => {
            if (ok && d?.id && typeof d.id === "string") {
              setLibraryDraftVideoId(d.id);
              try {
                sessionStorage.setItem(LIBRARY_DRAFT_STORAGE_KEY, d.id);
              } catch {
                // ignore
              }
              toast({
                title: "Saved to My Library",
                description:
                  typeof d.message === "string" && d.message.trim()
                    ? d.message
                    : "Draft saved automatically.",
              });
            }
          })
          .catch(() => {
            /* background save failed — useEffect may create a draft on next run */
          })
          .finally(() => {
            libraryCreateInFlightRef.current = false;
          });

        toast({
          title:
            mode === "8"
              ? "Satisfying Build generated"
              : mode === "9"
                ? "AI Cooking Video generated"
                : mode === "15"
                  ? "Story Video generated"
                  : "AI Story generated",
          description: `${scenesList.length} scenes ready.`,
        });
        return true;
      } catch (e) {
        toast({
          title:
            mode === "8"
              ? "Satisfying Build failed"
              : mode === "9"
                ? "AI Cooking Video failed"
                : mode === "15"
                  ? "Story Video failed"
                  : "AI Story failed",
          description: e instanceof Error ? e.message : "Something went wrong",
          variant: "destructive",
        });
        return false;
      } finally {
        setAiStoryLoading(false);
      }
    },
    [
      isStoryTemplateMode,
      mode,
      characters,
      characterNames,
      theme,
      aiStoryTone,
      aiStoryStyle,
      characterReferenceUrls,
      satisfyingCharacterType,
      whatBuilding,
      satisfyingBuildStyle,
      satisfyingBuildTone,
      satisfyingOpeningHook,
      cookingChefType,
      cookingDishName,
      cookingStyle,
      cookingTone,
      cookingOpeningHook,
      cookingSceneCount,
      storyVideoTopic,
      storyVideoTargetAudience,
      storyVideoCharacterDescription,
      storyVideoTone,
      storyVideoSceneCount,
      storyVideoFormat,
      storyVideoVideoStructure,
      toast,
    ]
  );

  const runGenerateAiStory = useCallback(async () => {
    await executeAiStoryGenerate(episodeNumber);
  }, [executeAiStoryGenerate, episodeNumber]);

  const handleGenerateNextEpisode = useCallback(async () => {
    if (!isStoryTemplateMode || aiStoryScenes.length === 0 || aiStoryLoading) return;
    const nextEp = episodeNumber + 1;
    const ok = await executeAiStoryGenerate(nextEp, { keepPreviousScenesUntilSuccess: true });
    if (ok) {
      setEpisodeNumber(nextEp);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          aiStoryScenesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
    }
  }, [isStoryTemplateMode, aiStoryScenes.length, episodeNumber, aiStoryLoading, executeAiStoryGenerate]);

  const handleCopySocialMediaPack = useCallback(() => {
    if (!socialMediaPackText.trim()) return;
    navigator.clipboard.writeText(socialMediaPackText).then(
      () => toast({ title: "Copied", description: "Social Media Pack copied to clipboard." }),
      () => toast({ title: "Copy failed", variant: "destructive" })
    );
  }, [socialMediaPackText, toast]);

  const applyCharacterLookToScenes = useCallback(async () => {
    const seed = characterSeed.trim();
    if (!seed) {
      toast({
        title: "Character look is empty",
        description: "Add a look description first, then apply it to scenes.",
        variant: "destructive",
      });
      return;
    }
    const LOCK_WORD_TARGET = 40;
    const seedHeader = "CHARACTER SEED (locked identity; reproduce EXACTLY in every image):";
    setAiStoryScenes((prev) =>
      prev.map((scene) => {
        const prompt = scene.imagePrompt.trim();
        // Remove any existing locked seed block from the beginning of the prompt.
        // In practice, prompts are often whitespace-sanitized (newlines collapsed),
        // so we can't rely on "\n\n" splitting alone.
        let scenePromptOnly = prompt;
        const headerMatch = prompt.match(/^CHARACTER SEED.*?:\s*/);
        if (headerMatch) {
          const afterHeader = prompt.slice(headerMatch[0].length).trim();
          const words = afterHeader.split(/\s+/).filter(Boolean);
          if (words.length > LOCK_WORD_TARGET) {
            scenePromptOnly = words.slice(LOCK_WORD_TARGET).join(" ").trim();
          } else {
            scenePromptOnly = "";
          }
        } else {
          // Fallback for older prompts without the header: try to split by double-newline.
          const splitAt = prompt.indexOf("\n\n");
          scenePromptOnly = splitAt >= 0 ? prompt.slice(splitAt + 2).trim() : prompt;
        }
        return {
          ...scene,
          imagePrompt: `${seedHeader}\n${seed}\n\n${scenePromptOnly}`.trim(),
        };
      })
    );
    // Existing generated images no longer match the updated look.
    setSceneImageUrls({});
    setSceneVideoUrls({});
    toast({
      title: "Character look applied",
      description: "Scene prompts were updated. Regenerate images to use the new look.",
    });
    // Mode 9: regenerate the single identity reference portrait so img2img anchors to the updated look.
    if (mode === "9") {
      try {
        setCookingChefReferenceLoading(true);
        const refRes = await fetch("/api/content-studio/ai-cooking-video/reference-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chefType: cookingChefType,
            cookingStyle,
            tone: cookingTone,
            lockedIdentitySeed: seed,
          }),
        });
        const refData = await refRes.json();
        if (!refRes.ok) {
          throw new Error(typeof refData?.error === "string" ? refData.error : "Reference image failed");
        }
        setCookingChefReferenceUrl(typeof refData?.referenceUrl === "string" ? refData.referenceUrl.trim() : "");
      } catch (e) {
        setCookingChefReferenceUrl("");
        toast({
          title: "Chef reference image failed",
          description: e instanceof Error ? e.message : "Something went wrong",
          variant: "destructive",
        });
      } finally {
        setCookingChefReferenceLoading(false);
      }
    }
  }, [characterSeed, toast, mode, cookingChefType, cookingStyle, cookingTone]);

  const stripLockedCharacterSeedFromPrompt = useCallback((prompt: string) => {
    const LOCK_WORD_TARGET = 40;
    const s = prompt.trim();
    if (!s.startsWith("CHARACTER SEED")) return s;
    const m = s.match(/^CHARACTER SEED.*?:\s*/);
    if (!m) return s;
    const afterHeader = s.slice(m[0].length).trim();
    const words = afterHeader.split(/\s+/).filter(Boolean);
    if (words.length <= LOCK_WORD_TARGET) return "";
    return words.slice(LOCK_WORD_TARGET).join(" ").trim();
  }, []);

  const handleRegenerateSocialMediaPack = useCallback(async () => {
    if (!isStoryTemplateMode || aiStoryScenes.length === 0) return;
    setSocialMediaPackLoading(true);
    try {
      const packBody =
        mode === "7"
          ? {
              characters: characters.trim(),
              characterNames: characterNames.trim(),
              theme: theme.trim(),
              tone: aiStoryTone,
              style: aiStoryStyle,
              episodeNumber,
              scenes: aiStoryScenes.map((s) => ({ dialogue: s.dialogue })),
            }
          : mode === "15"
            ? {
                characters: storyVideoCharacterDescription.trim() || "Narrator / unspecified",
                characterNames: "",
                theme: `${storyVideoTopic.trim()} | Audience: ${storyVideoTargetAudience.trim()}`,
                tone: storyVideoTone,
                style: "Story Video",
                episodeNumber,
                scenes: aiStoryScenes.map((s) => ({ dialogue: s.dialogue })),
              }
            : {
                characters: mode === "8" ? satisfyingCharacterType : cookingChefType,
                characterNames: "",
                theme: mode === "8" ? whatBuilding.trim() : cookingDishName.trim(),
                tone: mode === "8" ? satisfyingBuildTone : cookingTone,
                style: mode === "8" ? satisfyingBuildStyle : cookingStyle,
                episodeNumber,
                scenes: aiStoryScenes.map((s) => ({ dialogue: s.dialogue })),
              };
      const res = await fetch("/api/content-studio/ai-story/social-media-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(packBody),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Failed to regenerate social pack");
      const pack = data.socialMediaPack as {
        caption?: string;
        title?: string;
        hashtags?: string[];
        youtubeDescription?: string;
      } | undefined;
      setSocialMediaPack({
        caption: typeof pack?.caption === "string" ? pack.caption : "",
        title: typeof pack?.title === "string" ? pack.title : "",
        hashtags: Array.isArray(pack?.hashtags) ? pack.hashtags.filter((h): h is string => typeof h === "string") : [],
        youtubeDescription: typeof pack?.youtubeDescription === "string" ? pack.youtubeDescription : "",
      });
      toast({ title: "Social Media Pack regenerated" });
    } catch (e) {
      toast({
        title: "Failed to regenerate social pack",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSocialMediaPackLoading(false);
    }
  }, [
    isStoryTemplateMode,
    mode,
    aiStoryScenes,
    characters,
    characterNames,
    theme,
    aiStoryTone,
    aiStoryStyle,
    episodeNumber,
    satisfyingCharacterType,
    whatBuilding,
    satisfyingBuildTone,
    satisfyingBuildStyle,
    cookingChefType,
    cookingDishName,
    cookingTone,
    cookingStyle,
    storyVideoCharacterDescription,
    storyVideoTopic,
    storyVideoTargetAudience,
    storyVideoTone,
    toast,
  ]);

  const generateSlides = useCallback(
    async (regenerateIndex?: number) => {
      const countForMode = mode === "5" ? slideCountViral : slideCount;
      const count = regenerateIndex !== undefined ? 1 : countForMode;
      const payload: Record<string, unknown> = {
        mode,
        count: regenerateIndex !== undefined ? 1 : countForMode,
        ...(regenerateIndex !== undefined && { regenerateIndex }),
      };
      if (mode === "1" || mode === "4") {
        payload.niche = niche.trim();
        payload.templateType = templateType;
      } else if (mode === "2" || mode === "6") {
        payload.brandName = brandName.trim();
        payload.productDescription = productDescription.trim();
        payload.targetAudience = targetAudience.trim();
        payload.painPoints = painPoints.trim();
      } else if (mode === "3") {
        payload.brandName = brandName.trim();
        payload.brandVibe = brandVibe.trim();
        payload.postGoal = postGoal.trim();
        payload.brandTopic = niche.trim();
      } else if (mode === "5") {
        payload.niche = niche.trim();
        payload.hookAngle = hookAngle.trim();
        payload.ctaGoal = ctaGoal.trim();
      }
      const res = await fetch("/api/template-studio/generate-slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to generate");
      }
      const newSlides = (data.slides ?? []).map((s: { heading: string; body: string }) => ({
        heading: s.heading ?? "",
        body: s.body ?? "",
        bg_color: brandPrimary,
      }));
      if (regenerateIndex !== undefined && newSlides.length > 0) {
        setSlides((prev) => {
          const next = [...prev];
          next[regenerateIndex] = { ...newSlides[0], bg_color: next[regenerateIndex]?.bg_color ?? brandPrimary };
          return next;
        });
      } else {
        setSlides(newSlides.map((s) => ({ ...s, bg_color: brandPrimary })));
      }
      return newSlides;
    },
    [mode, brandName, niche, templateType, slideCount, slideCountViral, brandPrimary, productDescription, targetAudience, painPoints, brandVibe, postGoal, hookAngle, ctaGoal]
  );

  const handleGenerateContent = async () => {
    setGenerating(true);
    try {
      await saveSetup();
      await generateSlides();
      toast({ title: "Content generated", description: "Edit any slide or regenerate individually." });
    } catch (e) {
      toast({
        title: "Generation failed",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateSlide = async (index: number) => {
    setRegeneratingIndex(index);
    try {
      await generateSlides(index);
      toast({ title: "Slide regenerated" });
    } catch (e) {
      toast({
        title: "Regenerate failed",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setRegeneratingIndex(null);
    }
  };

  const updateSlide = (index: number, field: "heading" | "body", value: string) => {
    setSlides((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleExportPack = useCallback(async () => {
    if (slides.length === 0) {
      toast({ title: "No slides to export", variant: "destructive" });
      return;
    }
    setExporting(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < slides.length; i++) {
        const el = slideRefs.current[i];
        if (!el) continue;
        const canvas = await html2canvas(el, {
          scale: 4,
          useCORS: true,
          backgroundColor: null,
          logging: false,
        });
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), "image/png", 1)
        );
        if (blob) zip.file(`slide-${String(i + 1).padStart(2, "0")}.png`, blob);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `template-pack-${niche.trim() || "pack"}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Pack exported", description: "ZIP download started." });
    } catch (e) {
      toast({
        title: "Export failed",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }, [slides, niche, toast]);

  const handleGenerateCaption = useCallback(async () => {
    if (slides.length === 0) return;
    setCaptionGenLoading(true);
    try {
      const res = await fetch("/api/generate-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: niche.trim(),
          slides: slides.map((s) => ({ heading: s.heading, body: s.body })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate caption");
      setCarouselCaption(typeof data.caption === "string" ? data.caption : "");
      toast({ title: "Caption generated", description: "Edit the text area before publishing." });
    } catch (e) {
      toast({
        title: "Caption generation failed",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setCaptionGenLoading(false);
    }
  }, [slides, niche, toast]);

  const handleGenerateHashtags = useCallback(async () => {
    if (slides.length === 0) return;
    setHashtagGenLoading(true);
    try {
      const res = await fetch("/api/generate-hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: niche.trim(),
          slides: slides.map((s) => ({ heading: s.heading, body: s.body })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate hashtags");
      const list = Array.isArray(data.hashtags) ? data.hashtags : [];
      const normalized = list.filter((h: unknown): h is string => typeof h === "string" && h.trim().length > 0);
      setCarouselHashtags(normalized.join(" "));
      toast({ title: "Hashtags generated", description: `${normalized.length} tags — edit the field as needed.` });
    } catch (e) {
      toast({
        title: "Hashtag generation failed",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setHashtagGenLoading(false);
    }
  }, [slides, niche, toast]);

  const handleCopyPublishBlock = useCallback(() => {
    const text = [carouselCaption.trim(), carouselHashtags.trim()].filter(Boolean).join("\n\n");
    if (!text) {
      toast({ title: "Nothing to copy", variant: "destructive" });
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => toast({ title: "Copied", description: "Caption and hashtags copied." }),
      () => toast({ title: "Copy failed", variant: "destructive" })
    );
  }, [carouselCaption, carouselHashtags, toast]);

  const captureSlidesAsBase64 = useCallback(async (): Promise<string[]> => {
    const out: string[] = [];
    for (let i = 0; i < slides.length; i++) {
      const el = publishSlideRefs.current[i];
      if (!el) {
        throw new Error(`Slide ${i + 1} is not ready — wait for previews to load.`);
      }
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });
      const dataUrl = await new Promise<string>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Could not render slide image"));
              return;
            }
            const reader = new FileReader();
            reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : "");
            reader.onerror = () => reject(new Error("Read failed"));
            reader.readAsDataURL(blob);
          },
          "image/png",
          1
        );
      });
      if (!dataUrl) throw new Error(`Slide ${i + 1} export failed`);
      out.push(dataUrl);
    }
    return out;
  }, [slides.length]);

  const handlePublishNow = useCallback(async () => {
    const selected = (["instagram", "facebook", "tiktok", "youtube"] as const).filter(
      (p) => publishTargets[p] && connectedPlatforms.has(p)
    );
    if (selected.length === 0) {
      toast({
        title: "Select a connected platform",
        description: "Choose at least one account you’ve connected in Settings.",
        variant: "destructive",
      });
      return;
    }
    const caption = [carouselCaption.trim(), carouselHashtags.trim()].filter(Boolean).join("\n\n");
    if (!caption.trim()) {
      toast({
        title: "Add a caption",
        description: "Write or generate a caption before publishing.",
        variant: "destructive",
      });
      return;
    }
    if (!selected.includes("instagram")) {
      toast({
        title: "Instagram required for auto-publish",
        description:
          "In-app carousel upload is implemented for Instagram. Select Instagram, or export slides for other platforms.",
        variant: "destructive",
      });
      return;
    }
    setPublishing(true);
    const skipped: string[] = [];
    try {
      const imagesBase64 = await captureSlidesAsBase64();
      for (const p of selected) {
        if (p === "instagram") {
          const res = await fetch("/api/publish/instagram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ caption, imagesBase64 }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(typeof data.error === "string" ? data.error : "Instagram publish failed");
          }
          toast({
            title: "Published to Instagram",
            description: data.mediaId ? `Media id: ${data.mediaId}` : "Your carousel is live.",
          });
        } else {
          skipped.push(p);
        }
      }
      if (skipped.length > 0) {
        toast({
          title: "Not published everywhere",
          description: `Carousel auto-publish is only on Instagram for now. Skipped: ${skipped.join(", ")}.`,
        });
      }
    } catch (e) {
      toast({
        title: "Publish failed",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setPublishing(false);
    }
  }, [
    publishTargets,
    connectedPlatforms,
    captureSlidesAsBase64,
    carouselCaption,
    carouselHashtags,
    toast,
  ]);

  const handleSchedulePost = useCallback(async () => {
    const selected = (["instagram", "facebook", "tiktok", "youtube"] as const).filter(
      (p) => publishTargets[p] && connectedPlatforms.has(p)
    );
    if (selected.length === 0) {
      toast({
        title: "Select a connected platform",
        variant: "destructive",
      });
      return;
    }
    if (!scheduleAt) {
      toast({ title: "Pick a date and time", variant: "destructive" });
      return;
    }
    const when = new Date(scheduleAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      toast({ title: "Invalid schedule time", description: "Choose a future date and time.", variant: "destructive" });
      return;
    }
    setScheduling(true);
    try {
      const platform = selected.length === 1 ? selected[0] : "multi";
      const res = await fetch("/api/scheduled-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: "template_studio_carousel",
          platform,
          scheduledTime: when.toISOString(),
          contentJson: {
            source: "template-studio",
            caption: carouselCaption.trim(),
            hashtags: carouselHashtags.trim(),
            platforms: selected,
            packName: packName.trim() || niche.trim() || "Template Pack",
            slides: slides.map((s) => ({
              heading: s.heading,
              body: s.body,
              bg_color: s.bg_color ?? brandPrimary,
            })),
            brandPrimary,
            brandSecondary,
            fontStyle,
            brandName: brandName.trim() || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to schedule");
      toast({
        title: "Scheduled",
        description: `Saved for ${when.toLocaleString()}. View in Content Calendar.`,
      });
    } catch (e) {
      toast({
        title: "Schedule failed",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setScheduling(false);
    }
  }, [
    publishTargets,
    connectedPlatforms,
    scheduleAt,
    carouselCaption,
    carouselHashtags,
    packName,
    niche,
    slides,
    brandPrimary,
    brandSecondary,
    fontStyle,
    brandName,
    toast,
  ]);

  const handleSavePack = useCallback(async () => {
    const name = packName.trim() || niche.trim() || "Template Pack";
    if (slides.length === 0) {
      toast({ title: "Add slides first", variant: "destructive" });
      return;
    }
    setSavingPack(true);
    try {
      const res = await fetch("/api/template-packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packName: name,
          templateType,
          niche: niche.trim() || undefined,
          brandColourPrimary: brandPrimary,
          brandColourSecondary: brandSecondary,
          fontStyle,
          slidesJson: slides.map((s) => ({
            heading: s.heading,
            body: s.body,
            bg_color: s.bg_color ?? brandPrimary,
          })),
          captionsJson: slides.map((_, i) =>
            i === 0
              ? {
                  caption: carouselCaption.trim(),
                  hashtags: carouselHashtags.trim(),
                  alt_text: captions[0]?.alt_text ?? "",
                }
              : (captions[i] ?? { caption: "", hashtags: "", alt_text: "" })
          ),
          status:
            carouselCaption.trim().length > 0 || carouselHashtags.trim().length > 0 ? "complete" : "draft",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      toast({ title: "Pack saved", description: "Find it in My Library → Template Packs." });
      setPackName(name);
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSavingPack(false);
    }
  }, [
    packName,
    niche,
    templateType,
    brandPrimary,
    brandSecondary,
    fontStyle,
    slides,
    captions,
    carouselCaption,
    carouselHashtags,
    toast,
  ]);

  const handleExportPackRef = useRef(handleExportPack);

  useEffect(() => {
    handleExportPackRef.current = handleExportPack;
  }, [handleExportPack]);

  const saveSetup = useCallback(async () => {
    const inputs: Record<string, unknown> = {
      brandName,
      niche,
      customCreationTopic,
      templateType,
      slideCount,
      slideCountViral,
      brandPrimary,
      brandSecondary,
      fontStyle,
      productDescription,
      targetAudience,
      painPoints,
      brandVibe,
      postGoal,
      hookAngle,
      ctaGoal,
      voiceover_enabled: voiceoverEnabled,
      storyVideoTopic,
      storyVideoTargetAudience,
      storyVideoCharacterDescription,
      storyVideoTone,
      storyVideoSceneCount,
      storyVideoArtStyle,
      storyVideoFormat,
      storyVideoVideoStructure,
    };
    try {
      await fetch("/api/template-studio/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, inputs }),
      });
    } catch {
      // ignore
    }
  }, [
    mode,
    brandName,
    niche,
    customCreationTopic,
    templateType,
    slideCount,
    slideCountViral,
    brandPrimary,
    brandSecondary,
    fontStyle,
    productDescription,
    targetAudience,
    painPoints,
    brandVibe,
    postGoal,
    hookAngle,
    ctaGoal,
    voiceoverEnabled,
    storyVideoTopic,
    storyVideoTargetAudience,
    storyVideoCharacterDescription,
    storyVideoTone,
    storyVideoSceneCount,
    storyVideoArtStyle,
    storyVideoFormat,
    storyVideoVideoStructure,
  ]);

  /** SessionStorage prefill for /dashboard/video-timeline (must run before navigation). */
  const writeAiStoryTimelinePrefill = useCallback(() => {
    if (!isStoryTemplateMode || aiStoryScenes.length === 0) return;
    const timelineScenes = aiStoryScenes.map((scene) => ({
      scene_number: scene.sceneNumber,
      duration_seconds: TIMELINE_SCENE_DURATION,
      imageUrl: sceneImageUrls[scene.sceneNumber] ?? undefined,
      videoUrl: sceneVideoUrls[scene.sceneNumber] ?? undefined,
      audioUrl: effectiveVoiceoverUrls[scene.sceneNumber] ?? undefined,
      captionText: scene.dialogue?.trim() || undefined,
    }));
    setVideoPrefill({
      source: "template-studio",
      title:
        mode === "8"
          ? "Satisfying Build"
          : mode === "9"
            ? "AI Cooking Video"
            : mode === "15"
              ? "Story Video"
              : "AI Story",
      timelineScenes,
    });
  }, [isStoryTemplateMode, mode, aiStoryScenes, sceneImageUrls, sceneVideoUrls, effectiveVoiceoverUrls]);

  /** Ensure My Library draft row has latest per-scene audioUrl before timeline GET (avoids race with debounced PATCH). */
  const flushAiStoryDraftToLibrary = useCallback(async (): Promise<boolean> => {
    if (!libraryDraftVideoId || !isStoryTemplateMode || aiStoryScenes.length === 0) return true;
    const { scenes, captions, totalDuration } = buildTimelineContentFromAiStory(
      aiStoryScenes,
      sceneImageUrls,
      sceneVideoUrls,
      effectiveVoiceoverUrls,
      mode === "17" ? FINANCE_DOC_SCENE_DURATION : undefined
    );
    try {
      const draftTitle = buildTemplateStudioLibraryTitle({
        mode,
        episodeNumber,
        theme,
        whatBuilding,
        dishName: cookingDishName,
        storyVideoTopic,
        seriesShowTitle,
      });
      const metaBase = {
        scenes,
        captions,
        totalDuration,
        sourceType: (mode === "15" ? "story-video" : "ai-story") as "ai-story" | "story-video",
        savedAt: new Date().toISOString(),
        ...(Object.keys(characterReferenceUrls).length > 0
          ? { aiStoryCharacterReferenceUrls: characterReferenceUrls }
          : {}),
      };
      const metadata = mergeSeriesIntoTimelinePayload(metaBase, seriesShowTitle, episodeNumber);
      const res = await fetch(`/api/video-timeline/videos/${encodeURIComponent(libraryDraftVideoId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draftTitle,
          metadata,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, [
    libraryDraftVideoId,
    isStoryTemplateMode,
    aiStoryScenes,
    sceneImageUrls,
    sceneVideoUrls,
    effectiveVoiceoverUrls,
    characterReferenceUrlsSerializeKey,
    cookingDishName,
    episodeNumber,
    mode,
    seriesShowTitle,
    storyVideoTopic,
    theme,
    whatBuilding,
  ]);

  const openVideoTimeline = useCallback(async () => {
    writeAiStoryTimelinePrefill();
    if (libraryDraftVideoId) {
      const ok = await flushAiStoryDraftToLibrary();
      if (!ok) {
        toast({
          title: "Could not sync draft",
          description: "Opening the timeline anyway. If clip audio is missing, refresh the page.",
          variant: "destructive",
        });
      }
      router.push(`/dashboard/video-timeline?projectId=${encodeURIComponent(libraryDraftVideoId)}`);
    } else {
      router.push(getTimelineUrl());
    }
    toast({
      title: "Opening Video Timeline",
      description: "Scenes are pre-loaded. Reorder, trim, and export your MP4.",
    });
  }, [writeAiStoryTimelinePrefill, flushAiStoryDraftToLibrary, libraryDraftVideoId, router, toast]);

  const canExportStoryVideo = useMemo(() => {
    if (!isStoryTemplateMode || step !== 1 || aiStoryScenes.length === 0) return false;
    if (mode === "7" || mode === "8") {
      if (aiStoryScenes.length !== AI_STORY_SCENE_COUNT) return false;
    }
    return aiStoryScenes.every((s) => {
      const v = sceneVideoUrls[s.sceneNumber];
      const vo = effectiveVoiceoverUrls[s.sceneNumber];
      const hasVideo = isHttpUrl(v);
      if (!voiceoverEnabled) return hasVideo;
      return hasVideo && isHttpUrl(vo);
    });
  }, [isStoryTemplateMode, step, mode, aiStoryScenes, sceneVideoUrls, effectiveVoiceoverUrls, voiceoverEnabled]);

  const handleSuggestTopics = useCallback(async () => {
    const niche = storyVideoChannelNiche.trim() || storyVideoTargetAudience.trim();
    if (!niche) {
      toast({ title: "Add your channel or niche first", description: "Type your channel name or niche above, then hit Suggest.", variant: "destructive" });
      return;
    }
    setStoryVideoTopicSuggestionsLoading(true);
    setStoryVideoTopicSuggestions([]);
    try {
      const res = await fetch("/api/template-studio/suggest-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche }),
      });
      if (!res.ok) throw new Error("Could not fetch ideas");
      const data = (await res.json()) as { topics?: Array<{ title: string; targetAudience: string; tone: "motivational" | "educational" | "story"; characterDescription: string }> };
      const topics = Array.isArray(data.topics) ? data.topics.filter((t) => t.title?.trim()) : [];
      if (topics.length === 0) throw new Error("No suggestions returned");
      setStoryVideoTopicSuggestions(topics);
    } catch {
      toast({ title: "Couldn't generate ideas", description: "Try again or type a more specific niche.", variant: "destructive" });
    } finally {
      setStoryVideoTopicSuggestionsLoading(false);
    }
  }, [storyVideoChannelNiche, storyVideoTargetAudience, toast]);

  const handleGenerateFullVideo = useCallback(async () => {
    if (autoGenerating || aiStoryScenes.length === 0) return;
    setAutoGenerating(true);
    setAutoGenerateError(null);
    setAutoGeneratePhase(null);
    setAutoGenerateProgress(null);

    try {
      // Check credits
      const creditRes = await fetch("/api/video-credits/balance");
      const creditData = (await creditRes.json().catch(() => ({}))) as { balance?: number };
      if ((creditData.balance ?? 0) < 1) {
        toast({ title: "No video credits", description: "Buy credits to generate a full video.", variant: "destructive" });
        setAutoGenerateError("You need at least 1 video credit. Buy credits to continue.");
        return;
      }

      const ordered = [...aiStoryScenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
      const total = ordered.length;

      // Step 1: Generate images
      setAutoGeneratePhase("Generating scene images");
      setAutoGenerateProgress({ done: 0, total });
      const latestImageUrls: Record<number, string> = { ...sceneImageUrls };

      for (let i = 0; i < ordered.length; i++) {
        const scene = ordered[i]!;
        if (latestImageUrls[scene.sceneNumber]) {
          setAutoGenerateProgress({ done: i + 1, total });
          continue;
        }
        try {
          let res: Response;
          let data: { url?: string; imageUrl?: string; data?: { url?: string }[]; error?: string };
          if (mode === "9") {
            const rawPrompt = scene.imagePrompt;
            const sceneComposition = rawPrompt;
            res = await fetch("/api/content-studio/ai-cooking-video/scene-image", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sceneComposition, characterSeed: characterSeed.trim(), dialogue: scene.dialogue.trim() }),
            });
            data = await res.json();
          } else {
            const imageBody: Record<string, unknown> = { prompt: scene.imagePrompt };
            if (mode === "15") imageBody.storyVideoFormat = storyVideoFormat;
            if (mode === "7") imageBody.aiStoryLocked = true;
            if (mode === "8") { imageBody.photoreal = true; imageBody.identityLock = true; }
            res = await fetch("/api/generate-image", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify(imageBody),
            });
            data = await res.json();
          }
          const url = (typeof data?.url === "string" ? data.url : "") ||
            (typeof (data as { imageUrl?: string }).imageUrl === "string" ? (data as { imageUrl: string }).imageUrl : "") ||
            (Array.isArray((data as { data?: { url?: string }[] }).data) ? ((data as { data: { url?: string }[] }).data[0]?.url ?? "") : "");
          if (url && (url.startsWith("https://") || url.startsWith("http://"))) {
            latestImageUrls[scene.sceneNumber] = url;
            setSceneImageUrls((prev) => ({ ...prev, [scene.sceneNumber]: url }));
          }
        } catch {
          // Non-fatal: continue with other scenes
        }
        setAutoGenerateProgress({ done: i + 1, total });
      }

      // Step 2: Animate scenes
      setAutoGeneratePhase("Animating scenes");
      setAutoGenerateProgress({ done: 0, total });
      const latestVideoUrls: Record<number, string> = { ...sceneVideoUrls };
      const aspectRatio = (mode === "15" || mode === "17") ? "16:9" : "9:16";

      for (let i = 0; i < ordered.length; i++) {
        const scene = ordered[i]!;
        if (latestVideoUrls[scene.sceneNumber]) {
          setAutoGenerateProgress({ done: i + 1, total });
          continue;
        }
        const imageUrl = latestImageUrls[scene.sceneNumber];
        if (!imageUrl) { setAutoGenerateProgress({ done: i + 1, total }); continue; }
        try {
          const animRes = await fetch("/api/content-studio/ai-story/animate", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl, motionPrompt: scene.motionPrompt || scene.imagePrompt, aspectRatio }),
          });
          const animData = (await animRes.json().catch(() => ({}))) as { requestId?: string; videoUrl?: string };
          if (animData.videoUrl) {
            latestVideoUrls[scene.sceneNumber] = animData.videoUrl;
            setSceneVideoUrls((prev) => ({ ...prev, [scene.sceneNumber]: animData.videoUrl! }));
          } else if (animData.requestId) {
            // Poll until done
            let videoUrl: string | null = null;
            for (let p = 0; p < 120; p++) {
              await new Promise((r) => setTimeout(r, 5000));
              const statusRes = await fetch(`/api/content-studio/ai-story/animate/status?requestId=${encodeURIComponent(animData.requestId)}`);
              const statusData = (await statusRes.json().catch(() => ({}))) as { status?: string; videoUrl?: string };
              if (statusData.videoUrl) { videoUrl = statusData.videoUrl; break; }
              if (statusData.status === "FAILED") break;
            }
            if (videoUrl) {
              latestVideoUrls[scene.sceneNumber] = videoUrl;
              setSceneVideoUrls((prev) => ({ ...prev, [scene.sceneNumber]: videoUrl! }));
            }
          }
        } catch {
          // Non-fatal
        }
        setAutoGenerateProgress({ done: i + 1, total });
      }

      // Step 3: Generate voiceovers
      setAutoGeneratePhase("Generating voiceovers");
      setAutoGenerateProgress({ done: 0, total });
      const latestVoiceoverUrls: Record<number, string> = { ...voiceoverUrls };
      const defaultVoiceId = elevenLabsVoices[0]?.voice_id ?? "EXAVITQu4vr4xnSDxMaL";

      for (let i = 0; i < ordered.length; i++) {
        const scene = ordered[i]!;
        if (latestVoiceoverUrls[scene.sceneNumber]) {
          setAutoGenerateProgress({ done: i + 1, total });
          continue;
        }
        const dialogue = scene.dialogue?.trim() ?? "";
        if (!dialogue) { setAutoGenerateProgress({ done: i + 1, total }); continue; }
        const speakable = dialogue.replace(/^[^:]+:\s*/, "").replace(/[*_~`#[\]()]/g, "");
        try {
          const voiceRes = await fetch("/api/ai-coach/voice-over", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ script: speakable, voiceId: defaultVoiceId, maxDurationSeconds: mode === "17" ? FINANCE_DOC_SCENE_DURATION : TIMELINE_SCENE_DURATION }),
          });
          const voiceData = (await voiceRes.json().catch(() => ({}))) as { url?: string; publicUrl?: string; audioUrl?: string };
          const voiceUrl = voiceData.url ?? voiceData.publicUrl ?? voiceData.audioUrl ?? "";
          if (voiceUrl) {
            latestVoiceoverUrls[scene.sceneNumber] = voiceUrl;
            setVoiceoverUrls((prev) => ({ ...prev, [scene.sceneNumber]: voiceUrl }));
          }
        } catch {
          // Non-fatal
        }
        setAutoGenerateProgress({ done: i + 1, total });
      }

      // Step 4: Compile MP4
      setAutoGeneratePhase("Stitching video");
      setAutoGenerateProgress(null);
      const scenes_json = ordered.map((scene) => ({
        scene_number: scene.sceneNumber,
        duration: mode === "17" ? FINANCE_DOC_SCENE_DURATION : TIMELINE_SCENE_DURATION,
        script_text: scene.dialogue?.trim() ?? "",
        image_url: latestImageUrls[scene.sceneNumber] ?? null,
        // Mode 17 documentary: use image (Ken Burns) not Kling clip — Kling clips are 5s fixed
        // which makes a 35-scene video only 3 mins. Ken Burns fills the full voiceover duration.
        video_url: mode === "17" ? null : (latestVideoUrls[scene.sceneNumber] ?? null),
        voiceover_url: latestVoiceoverUrls[scene.sceneNumber] ?? null,
        caption: scene.dialogue?.trim() ?? null,
        animation_type: "video",
        section_label: `Scene ${scene.sceneNumber}`,
      }));
      const saveRes = await fetch("/api/saved-scripts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: buildTemplateStudioLibraryTitle({ mode, episodeNumber, theme, whatBuilding, dishName: cookingDishName, storyVideoTopic, financeDocTopic, seriesShowTitle }),
          scenes_json,
        }),
      });
      const saveData = (await saveRes.json().catch(() => ({}))) as { id?: string };
      if (!saveData.id) throw new Error("Failed to save script");

      const compileRes = await fetch("/api/videos/compile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scriptId: saveData.id,
          transition: "fade",
          backgroundMusic: storyBackgroundMusic,
          ...((mode === "15" && storyVideoFormat === "long") || mode === "17" ? { outputAspect: "16:9" } : {}),
        }),
      });
      const compileData = (await compileRes.json().catch(() => ({}))) as { url?: string; error?: string; code?: string };

      if (!compileRes.ok) {
        if (compileData.code === "NO_VIDEO_CREDITS") {
          toast({ title: "No video credits", description: "Buy credits to export.", variant: "destructive" });
          setAutoGenerateError("You need video credits to export. Buy credits to continue.");
          return;
        }
        throw new Error(compileData.error ?? "Compile failed");
      }

      const finalUrl = compileData.url ?? "";
      if (!finalUrl) throw new Error("No video URL returned");

      setStoryVideoExportUrl(finalUrl);
      setStoryVideoExportScriptId(saveData.id);
      toast({ title: "🎉 Your video is ready!", description: "Download it below." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      setAutoGenerateError(msg);
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
    } finally {
      setAutoGenerating(false);
      setAutoGeneratePhase(null);
      setAutoGenerateProgress(null);
    }
  }, [
    autoGenerating, aiStoryScenes, mode, sceneImageUrls, sceneVideoUrls, voiceoverUrls,
    characterSeed, storyVideoFormat, elevenLabsVoices, storyBackgroundMusic,
    episodeNumber, theme, whatBuilding, cookingDishName, storyVideoTopic, seriesShowTitle,
    toast,
  ]);

  const handleExportStoryVideo = useCallback(async () => {
    if (!canExportStoryVideo) return;
    setStoryVideoExportError(null);
    setStoryVideoExportUrl(null);
    setStoryVideoExporting(true);
    setStoryVideoExportPhase("saving");
    writeAiStoryTimelinePrefill();
    if (libraryDraftVideoId) {
      await flushAiStoryDraftToLibrary();
    }
    try {
      const ordered = [...aiStoryScenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
      const scenes_json = ordered.map((scene) => {
        const video_url = sceneVideoUrls[scene.sceneNumber]?.trim() ?? null;
        const image_url = sceneImageUrls[scene.sceneNumber]?.trim() ?? null;
        const voiceover_url = effectiveVoiceoverUrls[scene.sceneNumber]?.trim() ?? null;
        const dialogue = scene.dialogue?.trim() ?? "";
        return {
          scene_number: scene.sceneNumber,
          duration: mode === "17" ? FINANCE_DOC_SCENE_DURATION : TIMELINE_SCENE_DURATION,
          script_text: dialogue,
          image_url: image_url && isHttpUrl(image_url) ? image_url : null,
          // Mode 17: use image (Ken Burns) not Kling clip — Kling is 5s fixed, voiceover is 12-15s
          video_url: mode === "17" ? null : (video_url && isHttpUrl(video_url) ? video_url : null),
          caption: dialogue || null,
          animation_type: "video",
          voiceover_url: voiceover_url && isHttpUrl(voiceover_url) ? voiceover_url : null,
          section_label: `Scene ${scene.sceneNumber}`,
        };
      });
      const saveRes = await fetch("/api/saved-scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: buildTemplateStudioLibraryTitle({
            mode,
            episodeNumber,
            theme,
            whatBuilding,
            dishName: cookingDishName,
            storyVideoTopic,
            seriesShowTitle,
          }),
          scenes_json,
        }),
      });
      const saveData = (await saveRes.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!saveRes.ok) {
        throw new Error(typeof saveData.error === "string" ? saveData.error : "Failed to save script for export");
      }
      const scriptId = typeof saveData.id === "string" ? saveData.id : "";
      if (!scriptId) throw new Error("No script id returned");
      setStoryVideoExportScriptId(scriptId);

      setStoryVideoExportPhase("compiling");
      const compileRes = await fetch("/api/videos/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scriptId,
          transition: "fade",
          backgroundMusic: storyBackgroundMusic,
          ...((mode === "15" && storyVideoFormat === "long") || mode === "17" ? { outputAspect: "16:9" } : {}),
        }),
      });
      const compileData = (await compileRes.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!compileRes.ok) {
        throw new Error(typeof compileData.error === "string" ? compileData.error : "Video compile failed");
      }
      const url = typeof compileData.url === "string" ? compileData.url.trim() : "";
      if (!url) throw new Error("No MP4 URL returned");
      setStoryVideoExportUrl(url);
      toast({
        title: "Story video ready",
        description: "Your MP4 is ready to download.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Export failed";
      setStoryVideoExportError(msg);
      toast({ title: "Export failed", description: msg, variant: "destructive" });
    } finally {
      setStoryVideoExporting(false);
      setStoryVideoExportPhase(null);
    }
  }, [
    aiStoryScenes,
    canExportStoryVideo,
    cookingDishName,
    episodeNumber,
    flushAiStoryDraftToLibrary,
    libraryDraftVideoId,
    mode,
    sceneImageUrls,
    sceneVideoUrls,
    seriesShowTitle,
    storyBackgroundMusic,
    theme,
    toast,
    effectiveVoiceoverUrls,
    whatBuilding,
    storyVideoTopic,
    storyVideoFormat,
    writeAiStoryTimelinePrefill,
  ]);

  useEffect(() => {
    if (!canExportStoryVideo) {
      setStoryVideoExportUrl(null);
      setStoryVideoExportScriptId(null);
      setStoryVideoExportError(null);
    }
  }, [canExportStoryVideo]);

  useEffect(() => {
    if (setupLoaded || searchParams.get("packId")) return;
    (async () => {
      try {
        const res = await fetch("/api/template-studio/setup");
        if (!res.ok) return;
        const data = await res.json();
        setSetupLoaded(true);
        const allowedModes = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"];
        if (data.mode && allowedModes.includes(data.mode)) {
          setMode(data.mode as CreationMode);
        }
        const i = data.inputs || {};
        if (Array.isArray(data.scenes) && data.scenes.length > 0) {
          setAiStoryScenes(
            data.scenes.map((s: { sceneNumber?: number; id?: number; dialogue?: string; imagePrompt?: string; motionPrompt?: string }, idx: number) => ({
              sceneNumber: typeof s.sceneNumber === "number" && s.sceneNumber >= 1 ? s.sceneNumber : (typeof s.id === "number" ? s.id : idx + 1),
              dialogue: typeof s.dialogue === "string" ? s.dialogue : "",
              imagePrompt: typeof s.imagePrompt === "string" ? s.imagePrompt : "",
              motionPrompt: typeof s.motionPrompt === "string" ? s.motionPrompt : "",
            }))
          );
        }
        if (typeof i.brandName === "string") setBrandName(i.brandName);
        if (typeof i.niche === "string") setNiche(i.niche);
        if (typeof i.customCreationTopic === "string") setCustomCreationTopic(i.customCreationTopic);
        if (["quotes", "tips", "affirmations"].includes(i.templateType)) setTemplateType(i.templateType);
        if ([5, 10, 20].includes(Number(i.slideCount))) setSlideCount(Number(i.slideCount) as 5 | 10 | 20);
        if ([5, 6, 7, 8, 9, 10].includes(Number(i.slideCountViral))) setSlideCountViral(Number(i.slideCountViral) as 5 | 6 | 7 | 8 | 9 | 10);
        if (typeof i.brandPrimary === "string") setBrandPrimary(i.brandPrimary);
        if (typeof i.brandSecondary === "string") setBrandSecondary(i.brandSecondary);
        if (["modern", "elegant", "bold", "minimal"].includes(i.fontStyle)) setFontStyle(i.fontStyle);
        if (typeof i.productDescription === "string") setProductDescription(i.productDescription);
        if (typeof i.targetAudience === "string") setTargetAudience(i.targetAudience);
        if (typeof i.painPoints === "string") setPainPoints(i.painPoints);
        if (typeof i.brandVibe === "string") setBrandVibe(i.brandVibe);
        if (typeof i.postGoal === "string") setPostGoal(i.postGoal);
        if (typeof i.hookAngle === "string") setHookAngle(i.hookAngle);
        if (typeof i.ctaGoal === "string") setCtaGoal(i.ctaGoal);
        if (typeof i.voiceover_enabled === "boolean") setVoiceoverEnabled(i.voiceover_enabled);
        if (typeof i.storyVideoTopic === "string") setStoryVideoTopic(i.storyVideoTopic);
        if (typeof i.storyVideoTargetAudience === "string") setStoryVideoTargetAudience(i.storyVideoTargetAudience);
        if (typeof i.storyVideoCharacterDescription === "string") {
          setStoryVideoCharacterDescription(i.storyVideoCharacterDescription);
        }
        if (i.storyVideoTone === "motivational" || i.storyVideoTone === "educational" || i.storyVideoTone === "story") {
          setStoryVideoTone(i.storyVideoTone);
        }
        const loadedStoryFmt: StoryVideoFormat = i.storyVideoFormat === "long" ? "long" : "short";
        if (i.storyVideoFormat === "long" || i.storyVideoFormat === "short") {
          setStoryVideoFormat(loadedStoryFmt);
        }
        if (
          i.storyVideoVideoStructure === "full_story" ||
          i.storyVideoVideoStructure === "educational" ||
          i.storyVideoVideoStructure === "motivational"
        ) {
          setStoryVideoVideoStructure(i.storyVideoVideoStructure);
        }
        const svc = Number(i.storyVideoSceneCount);
        if (Number.isFinite(svc)) {
          setStoryVideoSceneCount(clampStoryVideoSceneCount(svc, loadedStoryFmt));
        }
        if (typeof i.storyVideoArtStyle === "string" && i.storyVideoArtStyle.trim()) {
          setStoryVideoArtStyle(i.storyVideoArtStyle);
        }
      } catch {
        setSetupLoaded(true);
      }
    })();
  }, [setupLoaded, searchParams]);

  // Auto-sync AI Story scenes to Video Timeline prefill (sessionStorage). Timeline stays up to date as images/animations/voiceovers are generated.
  useEffect(() => {
    writeAiStoryTimelinePrefill();
  }, [writeAiStoryTimelinePrefill]);

  // Auto-save AI Story to My Library (draft). Create once, then PATCH on every scene/content update.
  useEffect(() => {
    if (!isStoryTemplateMode || aiStoryScenes.length === 0) return;
    const { scenes, captions, totalDuration } = buildTimelineContentFromAiStory(
      aiStoryScenes,
      sceneImageUrls,
      sceneVideoUrls,
      voiceoverUrls,
      mode === "17" ? FINANCE_DOC_SCENE_DURATION : undefined
    );
    const draftTitle = buildTemplateStudioLibraryTitle({
      mode,
      episodeNumber,
      theme,
      whatBuilding,
      dishName: cookingDishName,
      storyVideoTopic,
      financeDocTopic,
      seriesShowTitle,
    });
    const metaBase = {
      scenes,
      captions,
      totalDuration,
      sourceType: (mode === "15" ? "story-video" : "ai-story") as "ai-story" | "story-video",
      savedAt: new Date().toISOString(),
      ...(Object.keys(characterReferenceUrls).length > 0
        ? { aiStoryCharacterReferenceUrls: characterReferenceUrls }
        : {}),
    };
    const metadata = mergeSeriesIntoTimelinePayload(metaBase, seriesShowTitle, episodeNumber);

    let cancelled = false;
    setLibraryDraftSaving(true);
    if (libraryDraftVideoId) {
      fetch(`/api/video-timeline/videos/${encodeURIComponent(libraryDraftVideoId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: draftTitle, metadata }),
      })
        .then((res) => {
          if (cancelled) return;
          if (!res.ok) throw new Error("Update failed");
        })
        .catch(() => {
          if (!cancelled) setLibraryDraftSaving(false);
        })
        .finally(() => {
          if (!cancelled) setLibraryDraftSaving(false);
        });
    } else if (!libraryCreateInFlightRef.current) {
      libraryCreateInFlightRef.current = true;
      fetch("/api/video-timeline/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draftTitle,
          content: mergeSeriesIntoTimelinePayload(
            {
              scenes,
              captions,
              totalDuration,
              sourceType: mode === "15" ? "story-video" : "ai-story",
            },
            seriesShowTitle,
            episodeNumber
          ),
        }),
      })
        .then((res) => res.json())
        .then((data: { id?: string; error?: string }) => {
          if (cancelled) return;
          libraryCreateInFlightRef.current = false;
          if (data.error || !data.id) return;
          setLibraryDraftVideoId(data.id);
          try {
            sessionStorage.setItem(LIBRARY_DRAFT_STORAGE_KEY, data.id);
          } catch {
            // ignore
          }
        })
        .catch(() => {
          libraryCreateInFlightRef.current = false;
        })
        .finally(() => {
          if (!cancelled) setLibraryDraftSaving(false);
        });
    } else {
      setLibraryDraftSaving(false);
    }
    return () => {
      cancelled = true;
    };
  }, [
    mode,
    isStoryTemplateMode,
    aiStoryScenes,
    sceneImageUrls,
    sceneVideoUrls,
    voiceoverUrls,
    libraryDraftVideoId,
    characterReferenceUrlsSerializeKey,
    cookingDishName,
    episodeNumber,
    seriesShowTitle,
    storyVideoTopic,
    theme,
    whatBuilding,
  ]);

  // Prefill from Campaign Mode (carousel): slides + brand colours
  useEffect(() => {
    if (searchParams.get("packId")) return;
    const prefill = getTemplateStudioPrefill();
    if (!prefill?.slides?.length) return;
    setSlides(
      prefill.slides.map((s) => ({
        heading: s.heading ?? "",
        body: s.body ?? "",
        bg_color: s.bg_color ?? undefined,
      }))
    );
    if (prefill.brandPrimary) setBrandPrimary(prefill.brandPrimary);
    if (prefill.brandSecondary) setBrandSecondary(prefill.brandSecondary);
    setStep(2);
    clearTemplateStudioPrefill();
  }, [searchParams]);

  useEffect(() => {
    if (step !== 3) return;
    (async () => {
      try {
        const res = await fetch("/api/connected-accounts");
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data.connected) ? data.connected : [];
        const next = new Set<PublishPlatform>();
        for (const row of list as { platform?: string }[]) {
          const p = row.platform;
          if (p === "instagram" || p === "facebook" || p === "tiktok" || p === "youtube") {
            next.add(p);
          }
        }
        setConnectedPlatforms(next);
      } catch {
        // ignore
      }
    })();
  }, [step]);

  useEffect(() => {
    const packId = searchParams.get("packId");
    const wantDownload = searchParams.get("download") === "1";
    if (!packId) return;
    (async () => {
      try {
        const res = await fetch(`/api/template-packs/${packId}`);
        if (!res.ok) return;
        const pack = await res.json();
        setPackName(pack.packName ?? "");
        setNiche(pack.niche ?? "");
        const pt = pack.templateType ?? "quotes";
        setTemplateType(
          (["quotes", "tips", "affirmations"].includes(pt) ? pt : "quotes") as TemplateType
        );
        setBrandPrimary(pack.brandColourPrimary ?? "#FF6B35");
        setBrandSecondary(pack.brandColourSecondary ?? "#004E89");
        setFontStyle((pack.fontStyle ?? "modern") as FontStyle);
        const slideList = Array.isArray(pack.slidesJson) ? pack.slidesJson : [];
        setSlides(
          slideList.map((s: { heading?: string; body?: string; bg_color?: string }) => ({
            heading: s.heading ?? "",
            body: s.body ?? "",
            bg_color: s.bg_color ?? undefined,
          }))
        );
        const capList = Array.isArray(pack.captionsJson) ? pack.captionsJson : [];
        const mappedCaps = capList.map((c: { caption?: string; hashtags?: string; alt_text?: string }) => ({
          caption: c.caption ?? "",
          hashtags: c.hashtags ?? "",
          alt_text: c.alt_text ?? "",
        }));
        setCaptions(mappedCaps);
        const first = mappedCaps[0];
        if (first?.caption) setCarouselCaption(first.caption);
        if (first?.hashtags) setCarouselHashtags(first.hashtags);
        setStep(3);
        if (wantDownload) {
          setTimeout(() => {
            handleExportPackRef.current();
          }, 800);
        }
      } catch {
        // ignore
      }
    })();
  }, [searchParams]);

  const needElevenLabsVoiceList =
    (voiceoverEnabled && isStoryTemplateMode && aiStoryScenes.length > 0) || mode === "10";

  useEffect(() => {
    if (!needElevenLabsVoiceList || elevenLabsVoices.length > 0) return;
    (async () => {
      try {
        const res = await fetch("/api/elevenlabs/voices");
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data?.voices) ? data.voices : [];
        setElevenLabsVoices(list);
      } catch {
        // ignore
      }
    })();
  }, [needElevenLabsVoiceList, elevenLabsVoices.length, mode]);

  useEffect(() => {
    if (voiceoverEnabled) return;
    setVoiceoverUrls({});
  }, [voiceoverEnabled]);

  // ── LocalStorage persistence ────────────────────────────────────────────────
  const TS_DRAFT_KEY = "cf:ts:draft";

  // RESTORE: on mount, reload all saved state from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TS_DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Record<string, unknown>;
      if (typeof d.mode === "string") setMode(d.mode as CreationMode);
      if (typeof d.step === "number") setStep(d.step as 1 | 2 | 3);
      // Finance Documentary fields
      if (typeof d.financeDocTopic === "string") setFinanceDocTopic(d.financeDocTopic);
      if (typeof d.financeDocNiche === "string") setFinanceDocNiche(d.financeDocNiche);
      if (typeof d.financeDocStyle === "string") setFinanceDocStyle(d.financeDocStyle);
      if (typeof d.financeDocTone === "string") setFinanceDocTone(d.financeDocTone);
      if (typeof d.financeDocLength === "string") setFinanceDocLength(d.financeDocLength as "short" | "medium" | "long");
      if (typeof d.financeDocHookStyle === "string") setFinanceDocHookStyle(d.financeDocHookStyle);
      if (typeof d.financeDocCtaGoal === "string") setFinanceDocCtaGoal(d.financeDocCtaGoal);
      if (typeof d.financeDocChannelName === "string") setFinanceDocChannelName(d.financeDocChannelName);
      if (typeof d.financeDocProductName === "string") setFinanceDocProductName(d.financeDocProductName);
      // Generated content
      if (Array.isArray(d.aiStoryScenes) && d.aiStoryScenes.length > 0) setAiStoryScenes(d.aiStoryScenes as typeof aiStoryScenes);
      if (d.sceneImageUrls && typeof d.sceneImageUrls === "object") setSceneImageUrls(d.sceneImageUrls as Record<number, string>);
      if (d.sceneVideoUrls && typeof d.sceneVideoUrls === "object") setSceneVideoUrls(d.sceneVideoUrls as Record<number, string>);
      if (d.voiceoverUrls && typeof d.voiceoverUrls === "object") setVoiceoverUrls(d.voiceoverUrls as Record<number, string>);
      if (d.socialMediaPack) setSocialMediaPack(d.socialMediaPack as SocialMediaPack);
      // Other commonly-used fields
      if (typeof d.storyVideoTopic === "string") setStoryVideoTopic(d.storyVideoTopic);
      if (typeof d.storyVideoTargetAudience === "string") setStoryVideoTargetAudience(d.storyVideoTargetAudience);
      if (typeof d.stickmanTopic === "string") setStickmanTopic(d.stickmanTopic);
      if (typeof d.viralTopic === "string") setViralTopic(d.viralTopic);
      if (typeof d.kineticTopic === "string") setKineticTopic(d.kineticTopic);
    } catch {
      // ignore corrupt data
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SAVE: debounced 1s — persist all key state to localStorage on every change
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        // Filter out data: URLs (too large for localStorage) — only keep https:// URLs
        const filteredImageUrls = Object.fromEntries(
          Object.entries(sceneImageUrls).filter(([, v]) => typeof v === "string" && (v.startsWith("https://") || v.startsWith("http://")))
        );
        localStorage.setItem(TS_DRAFT_KEY, JSON.stringify({
          mode,
          step,
          financeDocTopic,
          financeDocNiche,
          financeDocStyle,
          financeDocTone,
          financeDocLength,
          financeDocHookStyle,
          financeDocCtaGoal,
          financeDocChannelName,
          financeDocProductName,
          aiStoryScenes,
          sceneImageUrls: filteredImageUrls,
          sceneVideoUrls,
          voiceoverUrls,
          socialMediaPack,
          storyVideoTopic,
          storyVideoTargetAudience,
          stickmanTopic,
          viralTopic,
          kineticTopic,
          savedAt: Date.now(),
        }));
      } catch {
        // localStorage full or unavailable — ignore
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    mode, step,
    financeDocTopic, financeDocNiche, financeDocStyle, financeDocTone,
    financeDocLength, financeDocHookStyle, financeDocCtaGoal,
    financeDocChannelName, financeDocProductName,
    aiStoryScenes, sceneImageUrls, sceneVideoUrls, voiceoverUrls,
    socialMediaPack, storyVideoTopic, storyVideoTargetAudience,
    stickmanTopic, viralTopic, kineticTopic,
  ]);
  // ── End LocalStorage persistence ─────────────────────────────────────────────

  // Fetch video credits balance once on mount
  // null = loading/unknown (don't gate), 0 = confirmed zero, >0 = has credits
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/video-credits/balance");
        if (!res.ok) {
          // If the request fails, leave as null so we never incorrectly block users
          return;
        }
        const data = await res.json().catch(() => ({})) as { balance?: number };
        setCreditsBalance(typeof data.balance === "number" ? data.balance : null);
      } catch {
        // On error, leave as null — don't show the no-credits gate
      }
    })();
  }, []);

  const handleGenerateAllImages = useCallback(async () => {
    if (allImagesGenerating || aiStoryScenes.length === 0) return;
    setAllImagesGenerating(true);
    const ordered = [...aiStoryScenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
    setAllImagesProgress({ done: 0, total: ordered.length });
    for (let i = 0; i < ordered.length; i++) {
      const scene = ordered[i]!;
      // Skip scenes that already have a valid image
      const existing = sceneImageUrls[scene.sceneNumber];
      if (existing && (existing.startsWith("https://") || existing.startsWith("http://") || existing.startsWith("data:image/"))) {
        setAllImagesProgress({ done: i + 1, total: ordered.length });
        continue;
      }
      try {
        const imageBody: Record<string, unknown> = { prompt: scene.imagePrompt };
        if (mode === "15") imageBody.storyVideoFormat = storyVideoFormat;
        if (mode === "17") imageBody.storyVideoFormat = "long"; // 16:9 landscape for YouTube documentary
        const res = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(imageBody),
        });
        const data = await res.json().catch(() => ({})) as { url?: string; imageUrl?: string; data?: { url?: string }[] };
        const url =
          (typeof data?.url === "string" ? data.url.trim() : "") ||
          (typeof data?.imageUrl === "string" ? data.imageUrl.trim() : "") ||
          (Array.isArray(data?.data) && typeof data.data[0]?.url === "string" ? data.data[0].url.trim() : "");
        if (url && (url.startsWith("https://") || url.startsWith("http://") || url.startsWith("data:image/"))) {
          setSceneImageUrls((prev) => ({ ...prev, [scene.sceneNumber]: url }));
        }
      } catch {
        // continue to next scene on error
      }
      setAllImagesProgress({ done: i + 1, total: ordered.length });
    }
    setAllImagesGenerating(false);
    setAllImagesProgress(null);
  }, [allImagesGenerating, aiStoryScenes, sceneImageUrls, mode, storyVideoFormat]);

  const handleGenerateAllVoiceovers = useCallback(async () => {
    if (allVoiceoversGenerating || aiStoryScenes.length === 0) return;
    setAllVoiceoversGenerating(true);
    const ordered = [...aiStoryScenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
    setAllVoiceoversProgress({ done: 0, total: ordered.length });
    for (let i = 0; i < ordered.length; i++) {
      const scene = ordered[i]!;
      // Skip if already has voiceover
      if (voiceoverUrls[scene.sceneNumber]) {
        setAllVoiceoversProgress({ done: i + 1, total: ordered.length });
        continue;
      }
      // Resolve the voice ID for this scene (same logic as per-scene card)
      const characterNameMatch = scene.dialogue.match(/^([^:]+):/);
      const characterName = characterNameMatch ? characterNameMatch[1].trim() : null;
      const voiceId = characterName && characterVoices[characterName]
        ? characterVoices[characterName]
        : characterName
          ? getDefaultVoiceIdForCharacter(characterName)
          : elevenLabsVoices[0]?.voice_id ?? "";
      if (!voiceId) {
        setAllVoiceoversProgress({ done: i + 1, total: ordered.length });
        continue;
      }
      // Build the speakable script (strip "Name:" prefix)
      const scriptText = scene.dialogue.includes(":")
        ? scene.dialogue.slice(scene.dialogue.indexOf(":") + 1).trim()
        : scene.dialogue;
      const speakableText = toSpeakable(scriptText);
      try {
        const res = await fetch("/api/ai-coach/voice-over", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script: speakableText, voiceId, maxDurationSeconds: mode === "17" ? FINANCE_DOC_SCENE_DURATION : TIMELINE_SCENE_DURATION }),
        });
        const data = await res.json().catch(() => ({})) as { url?: string; publicUrl?: string; audioUrl?: string };
        const voUrl =
          (typeof data.url === "string" ? data.url : "") ||
          (typeof data.publicUrl === "string" ? data.publicUrl : "") ||
          (typeof data.audioUrl === "string" ? data.audioUrl : "");
        if (voUrl.trim()) {
          setVoiceoverUrls((prev) => ({ ...prev, [scene.sceneNumber]: voUrl.trim() }));
        }
      } catch {
        // continue to next scene on error
      }
      setAllVoiceoversProgress({ done: i + 1, total: ordered.length });
    }
    setAllVoiceoversGenerating(false);
    setAllVoiceoversProgress(null);
  }, [allVoiceoversGenerating, aiStoryScenes, voiceoverUrls, characterVoices, elevenLabsVoices]);

  const handleGenerateAllAnimations = useCallback(async () => {
    if (allAnimationsGenerating || aiStoryScenes.length === 0) return;
    // Only animate scenes that have an image but no video
    const scenesToAnimate = aiStoryScenes
      .filter((s) => {
        const img = sceneImageUrls[s.sceneNumber];
        const vid = sceneVideoUrls[s.sceneNumber];
        return img && (img.startsWith("https://") || img.startsWith("http://")) && !vid;
      })
      .sort((a, b) => a.sceneNumber - b.sceneNumber);
    if (scenesToAnimate.length === 0) return;
    setAllAnimationsGenerating(true);
    setAllAnimationsProgress({ done: 0, total: scenesToAnimate.length });
    const aspectRatio = (mode === "15" || mode === "17") ? "16:9" : "9:16";
    // Step 1: Fire all animation requests in parallel to get requestIds
    const pending: { scene: typeof scenesToAnimate[0]; requestId: string }[] = [];
    await Promise.all(
      scenesToAnimate.map(async (scene) => {
        try {
          const res = await fetch("/api/content-studio/ai-story/animate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageUrl: sceneImageUrls[scene.sceneNumber],
              motionPrompt: scene.motionPrompt || scene.imagePrompt,
              aspectRatio,
            }),
          });
          const data = await res.json().catch(() => ({})) as { requestId?: string; request_id?: string; videoUrl?: string };
          if (data.videoUrl) {
            // Synchronous result — save immediately
            setSceneVideoUrls((prev) => ({ ...prev, [scene.sceneNumber]: data.videoUrl! }));
            setAllAnimationsProgress((p) => p ? { done: p.done + 1, total: p.total } : null);
          } else {
            const reqId = data.requestId ?? data.request_id ?? null;
            if (reqId) pending.push({ scene, requestId: reqId });
          }
        } catch {
          // skip scene on error
        }
      })
    );
    // Step 2: Poll all pending requestIds until each one completes
    const pollOne = async (requestId: string): Promise<string | null> => {
      for (let attempt = 0; attempt < 120; attempt++) {
        await new Promise((r) => setTimeout(r, 5000));
        try {
          const res = await fetch(`/api/content-studio/ai-story/animate/status?requestId=${encodeURIComponent(requestId)}`);
          const data = await res.json().catch(() => ({})) as { status?: string; videoUrl?: string };
          if (data.status === "COMPLETED" && data.videoUrl) return data.videoUrl;
          if (data.status === "FAILED") return null;
        } catch {
          // keep polling
        }
      }
      return null; // timed out
    };
    // Poll all pending in parallel
    await Promise.all(
      pending.map(async ({ scene, requestId }) => {
        const videoUrl = await pollOne(requestId);
        if (videoUrl) {
          setSceneVideoUrls((prev) => ({ ...prev, [scene.sceneNumber]: videoUrl }));
        }
        setAllAnimationsProgress((p) => p ? { done: p.done + 1, total: p.total } : null);
      })
    );
    setAllAnimationsGenerating(false);
    setAllAnimationsProgress(null);
    // Deduct 1 credit for the animation batch (Kling AI costs per scene)
    await deductVideoCredit("brandStoryVideo").catch((e) => console.warn("[animations] credit deduction failed:", e));
  }, [allAnimationsGenerating, aiStoryScenes, sceneImageUrls, sceneVideoUrls, mode]);

  useEffect(() => {
    const value = stickmanTopic.trim();
    if (!value) return;
    try {
      localStorage.setItem("cf:lastThumbnailTopic", value);
    } catch {
      // ignore
    }
  }, [stickmanTopic]);

  // Dev: expose scenes with imageUrl so you can run console.log(scenes) and verify full URLs
  useEffect(() => {
    if (typeof window === "undefined" || process.env.NODE_ENV !== "development") return;
    const scenesWithImageUrls = aiStoryScenes.map((s) => ({
      ...s,
      imageUrl: sceneImageUrls[s.sceneNumber] ?? undefined,
    }));
    const win = window as unknown as Record<string, unknown>;
    win.__templateStudioDebug = {
      scenes: scenesWithImageUrls,
      sceneImageUrls: { ...sceneImageUrls },
    };
  }, [aiStoryScenes, sceneImageUrls]);

  const handleCreationModeChange = useCallback(
    (next: CreationMode) => {
      if (next !== mode) {
        const storyM = mode === "7" || mode === "8" || mode === "9" || mode === "15" || mode === "17";
        const storyN = next === "7" || next === "8" || next === "9" || next === "15" || next === "17";
        const brandM = mode === "10";
        const brandN = next === "10";
        const skipPipelineReset = mode === "14" || next === "14";
        if (!skipPipelineReset && (storyM || storyN || brandM || brandN)) {
          setAiStoryScenes([]);
          setSocialMediaPack(null);
          setVoiceoverUrls({});
          setSceneImageUrls({});
          setSceneVideoUrls({});
          setAiStoryUiPhase("form");
          setCharacterReferenceUrls({});
          setCharacterSeed("");
          setLibraryDraftVideoId(null);
          try {
            sessionStorage.removeItem(LIBRARY_DRAFT_STORAGE_KEY);
          } catch {
            // ignore
          }
        }
        if (!skipPipelineReset && brandM && !brandN) {
          setBrandStoryVideoUrl(null);
          setBrandStoryVideoError(null);
        }

        const stickM = mode === "11";
        const stickN = next === "11";
        if (!skipPipelineReset && (stickM || stickN)) {
          setStickmanScenes([]);
        }

        // Saved "custom topic" only applies to slide-pack modes; drop it when switching to AI video, etc.
        if (next !== "1" && next !== "4") {
          setCustomCreationTopic("");
        }
      }
      setMode(next);
    },
    [mode]
  );

  return (
    <div className="min-w-0 max-w-full space-y-8">
      {/* Step indicator */}
      <div data-tour="template-steps" className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={step === 1 ? "font-medium text-foreground" : "text-muted-foreground"}
        >
          Step 1 — Setup
        </span>
        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
        <span
          className={step === 2 ? "font-medium text-foreground" : "text-muted-foreground"}
        >
          Step 2 — Slides
        </span>
        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
        <span
          className={step === 3 ? "font-medium text-foreground" : "text-muted-foreground"}
        >
          Step 3 — Get Captions & Publish
        </span>
      </div>

      {step === 1 && (
        <>
        <Card>
          <CardHeader>
            <CardTitle>Template Setup</CardTitle>
            <CardDescription>
              {isSeriesLibrarySetupMode
                ? "Set your show name and episode number once. They apply when you save or export from AI Story, Stickman, Quiz, Kinetic, and similar templates. Switch back to a format when you're ready to create."
                : "Pick a format from the menu — the form below updates for that mode only. Your setup is saved automatically."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="template-studio-creation-mode">What are you creating?</Label>
              <select
                data-tour="template-type-select"
                id="template-studio-creation-mode"
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground",
                  "ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50"
                )}
                value={mode}
                onChange={(e) => {
                  const v = e.target.value as CreationMode;
                  if (!v) return;
                  handleCreationModeChange(v);
                }}
              >
                <option value="" disabled>
                  Choose a format…
                </option>
                {CREATION_MODE_OPTION_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {isSeriesLibrarySetupMode ? null : !isTemplateStudioSeriesMode ? (
                <p className="text-xs text-muted-foreground">
                  Optional <span className="font-medium text-foreground">show name &amp; episode</span> for My Library: choose{" "}
                  <span className="font-medium text-foreground">Show &amp; episode (My Library grouping)</span> under Library above.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  To change show or episode without leaving this template, switch to{" "}
                  <span className="font-medium text-foreground">Show &amp; episode (My Library grouping)</span> under Library.
                </p>
              )}
            </div>

            {(mode === "1" || mode === "4") && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">Slide pack topic (quotes / tips)</p>
                <p className="text-xs text-muted-foreground">
                  Saved topics fill your niche field. This section is only for Share Knowledge and Motivational slide packs — not for Stickman or other AI videos.
                </p>
                <CreatableSelectField
                  label="Saved topics (optional)"
                  value={customCreationTopic}
                  onValueChange={(v) => {
                    setCustomCreationTopic(v);
                    setNiche(v);
                  }}
                  options={[]}
                  storageKey="template-studio/custom-creation-topics"
                  addPlaceholder="Type a topic and click Save"
                />
              </div>
            )}

            {isSeriesLibrarySetupMode ? (
              <div className="rounded-xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-violet-500/5 p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Show &amp; episode</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    These values are saved on this device and merged into My Library when you use AI templates (story, stickman, quiz, kinetic, brand story, etc.).
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="series-show-title">Show name</Label>
                  <Input
                    id="series-show-title"
                    placeholder='e.g. "Money myths Monday" or "Coach Jay explains"'
                    value={seriesShowTitle}
                    onChange={(e) => setSeriesShowTitle(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-2 flex-1 min-w-[140px]">
                    <Label htmlFor="global-episode-number">Episode #</Label>
                    <Input
                      id="global-episode-number"
                      type="number"
                      min={1}
                      value={episodeNumber}
                      onChange={(e) => setEpisodeNumber(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mb-0.5"
                    onClick={() => setEpisodeNumber((n) => n + 1)}
                  >
                    Next episode +1
                  </Button>
                </div>
              </div>
            ) : null}

            {isStoryTemplateMode ? (
              <div className="flex flex-row items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
                <div className="space-y-0.5">
                  <Label htmlFor="voiceover-enabled" className="text-base">
                    Voiceover
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Turn off to hide voice generation and audio on AI Story / Satisfying Build / Cooking / Story Video scene cards.
                  </p>
                </div>
                <Switch
                  id="voiceover-enabled"
                  checked={voiceoverEnabled}
                  onCheckedChange={(checked) => {
                    setVoiceoverEnabled(checked);
                    if (!checked) setVoiceoverUrls({});
                  }}
                  aria-label="Enable voiceover for story scenes"
                />
              </div>
            ) : null}

            {(mode === "1" || mode === "4") && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="niche">Niche / topic</Label>
                  <Input
                    id="niche"
                    placeholder="e.g. Fitness, Productivity, Self-care"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-studio-template-type">Template type</Label>
                  <select
                    id="template-studio-template-type"
                    className={cn(
                      "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground",
                      "ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    )}
                    value={templateType}
                    onChange={(e) => setTemplateType(e.target.value as TemplateType)}
                  >
                    {TEMPLATE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {mode === "2" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="brandName">Brand name</Label>
                  <Input
                    id="brandName"
                    placeholder="e.g. My App"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="productDescription">What does your product/app do?</Label>
                  <Textarea
                    id="productDescription"
                    placeholder="e.g. A habit tracker that helps quiet builders ship without burnout"
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetAudience">Who is it for?</Label>
                  <Input
                    id="targetAudience"
                    placeholder="e.g. Indie hackers, side-project founders"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="painPoints">Pain points it solves</Label>
                  <Textarea
                    id="painPoints"
                    placeholder="e.g. Overwhelm, procrastination, lack of focus"
                    value={painPoints}
                    onChange={(e) => setPainPoints(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </>
            )}

            {mode === "3" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="brandName">Brand name</Label>
                  <Input
                    id="brandName"
                    placeholder="e.g. Void Hours"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brandVibe">Brand vibe / aesthetic</Label>
                  <Input
                    id="brandVibe"
                    placeholder="e.g. Minimal, dark, streetwear"
                    value={brandVibe}
                    onChange={(e) => setBrandVibe(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Post goal</Label>
                  <Select
                    value={postGoal}
                    onValueChange={(v) => setPostGoal(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POST_GOAL_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {mode === "5" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="niche-viral">What niche/topic?</Label>
                  <Input
                    id="niche-viral"
                    placeholder="e.g. streetwear styling, minimalist fashion, sneaker culture"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>What&apos;s your hook angle?</Label>
                  <Select
                    value={hookAngle}
                    onValueChange={(v) => setHookAngle(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOOK_ANGLE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Call-to-action goal?</Label>
                  <Select
                    value={ctaGoal}
                    onValueChange={(v) => setCtaGoal(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CTA_GOAL_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {mode === "6" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="brandName">Brand name</Label>
                  <Input
                    id="brandName"
                    placeholder="e.g. My Brand"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="productDescription">What are you launching?</Label>
                  <Textarea
                    id="productDescription"
                    placeholder="e.g. New collection, limited drop, course launch"
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetAudience">Who is it for?</Label>
                  <Input
                    id="targetAudience"
                    placeholder="e.g. Your audience"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="painPoints">Pain points or benefits to highlight</Label>
                  <Textarea
                    id="painPoints"
                    placeholder="e.g. Limited stock, early-bird pricing"
                    value={painPoints}
                    onChange={(e) => setPainPoints(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </>
            )}

            {mode === "10" && (
              <>
                <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 space-y-1">
                  <p className="text-sm font-medium">Brand Story Video</p>
                  <p className="text-xs text-muted-foreground">
                    Five scenes, ElevenLabs narration per scene, dark cinematic backgrounds, and a 9:16 MP4 with burned-in captions—same export pipeline as TikTok Shop video.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand-story-day">Day label</Label>
                  <Input
                    id="brand-story-day"
                    placeholder='e.g. "Day 1", "Day 12"'
                    value={brandStoryDayLabel}
                    onChange={(e) => setBrandStoryDayLabel(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand-story-brand">Brand name</Label>
                  <Input
                    id="brand-story-brand"
                    placeholder="e.g. Void Hours"
                    value={brandStoryBrandField}
                    onChange={(e) => setBrandStoryBrandField(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand-story-theme">One-line theme</Label>
                  <Input
                    id="brand-story-theme"
                    placeholder='e.g. building in silence'
                    value={brandStoryThemeLine}
                    onChange={(e) => setBrandStoryThemeLine(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand-story-voice">Voice (ElevenLabs)</Label>
                  <Select value={brandStoryVoiceId} onValueChange={setBrandStoryVoiceId}>
                    <SelectTrigger id="brand-story-voice">
                      <SelectValue placeholder="Select a voice" />
                    </SelectTrigger>
                    <SelectContent>
                      {elevenLabsVoices.length === 0 ? (
                        <SelectItem value={brandStoryVoiceId}>Default voice</SelectItem>
                      ) : (
                        elevenLabsVoices.map((v) => (
                          <SelectItem key={v.voice_id} value={v.voice_id}>
                            {v.name}
                            {v.description ? ` — ${v.description.slice(0, 80)}` : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {brandStoryVideoError ? (
                  <p className="text-sm text-destructive">{brandStoryVideoError}</p>
                ) : null}
                {brandStoryVideoUrl ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                    <p className="text-sm font-medium">Your video is ready.</p>
                    <Button type="button" variant="secondary" size="sm" asChild>
                      <a href={brandStoryVideoUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open / download MP4
                      </a>
                    </Button>
                  </div>
                ) : null}
              </>
            )}

            {selectedTemplate === "ai_story" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="characters">Character Types</Label>
                  <Input
                    id="characters"
                    placeholder="e.g. Banana, Strawberry, Cherry"
                    value={characters}
                    onChange={(e) => setCharacters(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="characterNames">Character Names (optional)</Label>
                  <Input
                    id="characterNames"
                    placeholder="e.g. Skibidi Nana, Rizz Berry, Based Cherry"
                    value={characterNames}
                    onChange={(e) => setCharacterNames(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Leave blank to auto-generate names</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Input
                    id="theme"
                    placeholder="e.g. hospital drama, cheating scandal"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tone</Label>
                  <Select
                    value={aiStoryTone}
                    onValueChange={(v) => setAiStoryTone(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_STORY_TONE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Story Style</Label>
                  <Select
                    value={aiStoryStyle}
                    onValueChange={(v) => setAiStoryStyle(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_STORY_STYLE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {selectedTemplate === "satisfying_build" && (
              <SatisfyingBuildSetup
                characterType={satisfyingCharacterType}
                setCharacterType={setSatisfyingCharacterType}
                whatBuilding={whatBuilding}
                setWhatBuilding={setWhatBuilding}
                buildStyle={satisfyingBuildStyle}
                setBuildStyle={setSatisfyingBuildStyle}
                tone={satisfyingBuildTone}
                setTone={setSatisfyingBuildTone}
                openingHook={satisfyingOpeningHook}
                setOpeningHook={setSatisfyingOpeningHook}
              />
            )}

            {selectedTemplate === "ai_cooking_video" && (
              <AiCookingVideoSetup
                chefType={cookingChefType}
                setChefType={setCookingChefType}
                dishName={cookingDishName}
                setDishName={setCookingDishName}
                cookingStyle={cookingStyle}
                setCookingStyle={setCookingStyle}
                tone={cookingTone}
                setTone={setCookingTone}
                openingHook={cookingOpeningHook}
                setOpeningHook={setCookingOpeningHook}
                sceneCount={cookingSceneCount}
                setSceneCount={setCookingSceneCount}
              />
            )}

            {selectedTemplate === "story_video" && (
              <>
                <div className="space-y-2">
                  <Label>Format</Label>
                  <div className="flex gap-2">
                    {STORY_VIDEO_FORMAT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          const next = opt.value;
                          setStoryVideoFormat(next);
                          if (next === "long") {
                            setStoryVideoSceneCount(STORY_VIDEO_SCENE_LONG.default);
                          } else {
                            setStoryVideoSceneCount((prev) => clampStoryVideoSceneCount(prev, "short"));
                          }
                        }}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-sm font-semibold border transition",
                          storyVideoFormat === opt.value
                            ? "bg-orange-500 text-white border-orange-500"
                            : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-orange-400"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {storyVideoFormat === "short"
                      ? "Vertical short-form — scene count 3–16 (default 6)."
                      : "YouTube-style long-form — scene count 15–50 (default 15), 16:9 images and export."}
                  </p>
                </div>
                {storyVideoFormat === "long" && (
                  <div className="space-y-2">
                    <Label>Video structure</Label>
                    <Select
                      value={storyVideoVideoStructure}
                      onValueChange={(v) => setStoryVideoVideoStructure(v as StoryVideoVideoStructure)}
                    >
                      <SelectTrigger id="story-video-structure">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STORY_VIDEO_VIDEO_STRUCTURE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="story-video-channel-niche">Your channel / niche</Label>
                  <div className="flex gap-2">
                    <Input
                      id="story-video-channel-niche"
                      placeholder="e.g. Mindset for entrepreneurs, True crime, Budget cooking"
                      value={storyVideoChannelNiche}
                      onChange={(e) => setStoryVideoChannelNiche(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSuggestTopics(); } }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSuggestTopics}
                      disabled={storyVideoTopicSuggestionsLoading}
                      className="shrink-0 gap-1.5"
                    >
                      {storyVideoTopicSuggestionsLoading
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Lightbulb className="w-3.5 h-3.5" />}
                      {storyVideoTopicSuggestionsLoading ? "Thinking…" : "Suggest topics"}
                    </Button>
                  </div>
                  {storyVideoTopicSuggestions.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-xs text-muted-foreground">Click a topic to fill all fields automatically:</p>
                      <div className="flex flex-col gap-1.5">
                        {storyVideoTopicSuggestions.map((t) => (
                          <button
                            key={t.title}
                            type="button"
                            onClick={() => {
                              setStoryVideoTopic(t.title);
                              if (t.targetAudience) setStoryVideoTargetAudience(t.targetAudience);
                              if (t.tone) setStoryVideoTone(t.tone);
                              if (t.characterDescription) setStoryVideoCharacterDescription(t.characterDescription);
                              setStoryVideoTopicSuggestions([]);
                            }}
                            className="w-full text-left text-xs px-3 py-2 rounded-lg border border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100 hover:border-orange-300 transition-colors"
                          >
                            <span className="font-medium">{t.title}</span>
                            <span className="block text-orange-600 mt-0.5">
                              {t.targetAudience} · <span className="capitalize">{t.tone}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="story-video-topic">Topic</Label>
                  <Input
                    id="story-video-topic"
                    placeholder="e.g. How to bounce back after burnout"
                    value={storyVideoTopic}
                    onChange={(e) => setStoryVideoTopic(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="story-video-audience">Target audience</Label>
                  <Input
                    id="story-video-audience"
                    placeholder="e.g. First-time founders, college students, new parents"
                    value={storyVideoTargetAudience}
                    onChange={(e) => setStoryVideoTargetAudience(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="story-video-character">Character description (optional)</Label>
                  <Textarea
                    id="story-video-character"
                    placeholder="e.g. A warm narrator in their 30s, or a specific on-screen lead"
                    value={storyVideoCharacterDescription}
                    onChange={(e) => setStoryVideoCharacterDescription(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tone</Label>
                  <Select
                    value={storyVideoTone}
                    onValueChange={(v) =>
                      setStoryVideoTone(v as "motivational" | "educational" | "story")
                    }
                  >
                    <SelectTrigger id="story-video-tone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STORY_VIDEO_TONE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="story-video-scene-count">Scene count</Label>
                  <Input
                    id="story-video-scene-count"
                    type="number"
                    min={
                      storyVideoFormat === "long" ? STORY_VIDEO_SCENE_LONG.min : STORY_VIDEO_SCENE_SHORT.min
                    }
                    max={
                      storyVideoFormat === "long" ? STORY_VIDEO_SCENE_LONG.max : STORY_VIDEO_SCENE_SHORT.max
                    }
                    value={storyVideoSceneCount}
                    onChange={(e) => {
                      const raw = Math.floor(Number(e.target.value));
                      setStoryVideoSceneCount(clampStoryVideoSceneCount(raw, storyVideoFormat));
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {storyVideoFormat === "long"
                      ? `Default ${STORY_VIDEO_SCENE_LONG.default} scenes (${STORY_VIDEO_SCENE_LONG.min}–${STORY_VIDEO_SCENE_LONG.max}).`
                      : `Default ${STORY_VIDEO_SCENE_SHORT.default} scenes (${STORY_VIDEO_SCENE_SHORT.min}–${STORY_VIDEO_SCENE_SHORT.max}).`}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="story-video-art-style">Art style (for batch image generation)</Label>
                  <Textarea
                    id="story-video-art-style"
                    value={storyVideoArtStyle}
                    onChange={(e) => setStoryVideoArtStyle(e.target.value)}
                    rows={3}
                    className="resize-none text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Used with <code className="text-xs">/api/story-video/generate-images</code>; same style is locked across all scenes.
                  </p>
                </div>
              </>
            )}

            {selectedTemplate === "finance_documentary" && (
              <>
                {/* Niche */}
                <div className="space-y-2">
                  <Label>Niche / Channel type</Label>
                  <Select value={financeDocNiche} onValueChange={setFinanceDocNiche}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FINANCE_DOC_NICHE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Topic */}
                <div className="space-y-2">
                  <Label htmlFor="finance-topic">Video topic *</Label>
                  <Input
                    id="finance-topic"
                    placeholder="e.g. How to build a £100k portfolio from scratch"
                    value={financeDocTopic}
                    onChange={(e) => setFinanceDocTopic(e.target.value)}
                  />
                  {FINANCE_DOC_TOPIC_SUGGESTIONS[financeDocNiche] && (
                    <div className="flex flex-col gap-1 pt-1">
                      <p className="text-xs text-muted-foreground">Quick ideas — click to use:</p>
                      {FINANCE_DOC_TOPIC_SUGGESTIONS[financeDocNiche].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFinanceDocTopic(s)}
                          className="text-left text-xs px-3 py-1.5 rounded-lg border border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Visual style */}
                <div className="space-y-2">
                  <Label>Visual style</Label>
                  <Select value={financeDocStyle} onValueChange={setFinanceDocStyle}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FINANCE_DOC_STYLE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">This controls how every image in your video looks.</p>
                </div>

                {/* Tone */}
                <div className="space-y-2">
                  <Label>Narrator tone</Label>
                  <Select value={financeDocTone} onValueChange={setFinanceDocTone}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FINANCE_DOC_TONE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Length */}
                <div className="space-y-2">
                  <Label>Video length</Label>
                  <Select value={financeDocLength} onValueChange={(v) => setFinanceDocLength(v as "short" | "medium" | "long")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FINANCE_DOC_LENGTH_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Hook style */}
                <div className="space-y-2">
                  <Label>Opening hook style</Label>
                  <Select value={financeDocHookStyle} onValueChange={setFinanceDocHookStyle}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FINANCE_DOC_HOOK_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* CTA goal */}
                <div className="space-y-2">
                  <Label>Video CTA goal</Label>
                  <Select value={financeDocCtaGoal} onValueChange={setFinanceDocCtaGoal}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FINANCE_DOC_CTA_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Channel name */}
                <div className="space-y-2">
                  <Label htmlFor="finance-channel">Channel name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    id="finance-channel"
                    placeholder="e.g. Smart Income Circle"
                    value={financeDocChannelName}
                    onChange={(e) => setFinanceDocChannelName(e.target.value)}
                  />
                </div>

                {/* Product name (only if CTA = sell product) */}
                {financeDocCtaGoal === "sell_product" && (
                  <div className="space-y-2">
                    <Label htmlFor="finance-product">Product name</Label>
                    <Input
                      id="finance-product"
                      placeholder="e.g. The Wealth Blueprint Course"
                      value={financeDocProductName}
                      onChange={(e) => setFinanceDocProductName(e.target.value)}
                    />
                  </div>
                )}

                {/* Affiliate / referral fields */}
                {financeDocCtaGoal === "affiliate" && (
                  <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-3">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">💰 Affiliate / Referral details</p>
                    <p className="text-xs text-green-700 dark:text-green-300">The script will naturally mention your referral link at the right moment — where the topic connects to the platform.</p>
                    <div className="space-y-2">
                      <Label>Platform</Label>
                      <Select value={financeDocAffiliatePlatform} onValueChange={setFinanceDocAffiliatePlatform}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FINANCE_DOC_AFFILIATE_PLATFORMS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {financeDocAffiliatePlatform === "other" && (
                      <div className="space-y-2">
                        <Label htmlFor="finance-affiliate-custom">Platform name</Label>
                        <Input
                          id="finance-affiliate-custom"
                          placeholder="e.g. Stake, InvestEngine..."
                          value={financeDocAffiliateCustomName}
                          onChange={(e) => setFinanceDocAffiliateCustomName(e.target.value)}
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="finance-affiliate-offer">What does your referral offer? <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Input
                        id="finance-affiliate-offer"
                        placeholder="e.g. Free share worth up to £100 when you deposit £1"
                        value={financeDocAffiliateOffer}
                        onChange={(e) => setFinanceDocAffiliateOffer(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {mode === "16" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Describe your character once — get ready-to-use prompts for <strong>Kling AI</strong>, <strong>Pika</strong>, or <strong>Runway</strong>. Each prompt includes a screen caption and a full scene description.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="anim-character-name">Character name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    id="anim-character-name"
                    placeholder="e.g. Quack, Luna, Max"
                    value={animCharacterName}
                    onChange={(e) => setAnimCharacterName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="anim-character-desc">Character description <span className="text-destructive">*</span></Label>
                  <Textarea
                    id="anim-character-desc"
                    placeholder="e.g. A cute 3D yellow cartoon duck with big round eyes, wearing small sunglasses, Pixar-style animation, expressive face"
                    value={animCharacterDescription}
                    onChange={(e) => setAnimCharacterDescription(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">Be specific — this is pasted directly into the AI video generator each time.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="anim-video-style">Video style / vibe</Label>
                  <Input
                    id="anim-video-style"
                    placeholder="e.g. Relatable couple POV comedy, Daily life humor, Friendship moments"
                    value={animVideoStyle}
                    onChange={(e) => setAnimVideoStyle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Number of prompts</Label>
                  <div className="flex gap-2">
                    {([10, 15, 20] as const).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setAnimPromptCount(n)}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${animPromptCount === n ? "bg-orange-500 text-white border-orange-500" : "border-border text-foreground hover:border-orange-400"}`}
                      >
                        {n} prompts
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {isViralMode && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select value={viralType} onValueChange={(v) => setViralType(v as typeof viralType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="would-you-rather">🎯 Would You Rather</SelectItem>
                      <SelectItem value="quiz">🧠 Quiz / Trivia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Topic or niche</Label>
                  <Input
                    placeholder={viralType === "would-you-rather" ? "e.g. Food, Money, Travel, Relationships…" : "e.g. Football, Science, UK History…"}
                    value={viralTopic}
                    onChange={(e) => setViralTopic(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Number of rounds ({viralRoundCount})</Label>
                  <input
                    type="range" min={3} max={15} value={viralRoundCount}
                    onChange={(e) => setViralRoundCount(Number(e.target.value))}
                    className="w-full accent-orange-500"
                  />
                  <p className="text-xs text-muted-foreground">{viralRoundCount} rounds — approx. {Math.round(viralRoundCount * (viralFormLength === "long" ? VIRAL_LONG_DURATION : VIRAL_SHORT_DURATION))}s of content</p>
                </div>
                <div className="space-y-2" data-tour="template-format">
                  <Label>Format length</Label>
                  <div className="flex gap-2">
                    {(["short", "long"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => { setViralFormLength(v); setViralRoundCount(v === "long" ? 15 : 7); }}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${viralFormLength === v ? "bg-orange-500 text-white border-orange-500" : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-orange-400"}`}
                      >
                        {v === "short" ? "⚡ Short-form (TikTok/Reels)" : "🎬 Long-form (YouTube)"}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {viralFormLength === "short" ? `${VIRAL_SHORT_DURATION}s per slide — best for TikTok / Reels` : `${VIRAL_LONG_DURATION}s per slide — best for YouTube Shorts / long-form`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={viralShowTimer} onChange={(e) => setViralShowTimer(e.target.checked)} className="accent-orange-500 w-4 h-4" />
                    <span className="text-sm">⏱ Show countdown timer</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={viralVoiceover} onChange={(e) => setViralVoiceover(e.target.checked)} className="accent-orange-500 w-4 h-4" />
                    <span className="text-sm">🔊 Preview voiceover (browser TTS)</span>
                  </label>
                </div>
                <div className="space-y-2">
                  <Label>Voice (ElevenLabs, for MP4 export)</Label>
                  <Select
                    value={viralExportVoiceId}
                    onValueChange={(v) => {
                      setViralExportVoiceId(v);
                      setDefaultVoiceId(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select voice" />
                    </SelectTrigger>
                    <SelectContent>
                      {ELEVENLABS_VOICES.map((v) => (
                        <SelectItem key={v.voiceId} value={v.voiceId}>
                          {v.name} — {v.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Used for the full narration when you export MP4. Preview above uses browser speech unless you only need a quick listen. Requires{" "}
                    <code className="text-[11px] bg-muted px-1 rounded">ELEVENLABS_API_KEY</code>.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Background music</Label>
                  <Select value={viralBgm} onValueChange={(v) => setViralBgm(v as BgmSelectValue)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Music" />
                    </SelectTrigger>
                    <SelectContent>
                      {BGM_SELECT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Looped under the voiceover in preview and MP4. Add MP3s under <code className="text-[11px] bg-muted px-1 rounded">public/bgm/</code> per{" "}
                    <code className="text-[11px] bg-muted px-1 rounded">ATTRIBUTION.md</code>.
                  </p>
                </div>
              </div>
            )}

            {isKineticMode && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Topic</Label>
                  <Input
                    placeholder="e.g. How to start a clothing brand, 5 money rules…"
                    value={kineticTopic}
                    onChange={(e) => setKineticTopic(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Format</Label>
                  <div className="flex gap-2">
                    {(["short", "long"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => { setKineticFormLength(v); setKineticSceneCount(v === "long" ? 20 : 12); }}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${kineticFormLength === v ? "bg-orange-500 text-white border-orange-500" : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-orange-400"}`}
                      >
                        {v === "short" ? "⚡ Short-form (TikTok/Reels)" : "🎬 Long-form (YouTube)"}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {kineticFormLength === "short" ? "9:16 portrait — best for TikTok / Reels / Shorts" : "16:9 widescreen — best for YouTube"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Number of scenes ({kineticSceneCount})</Label>
                  <input
                    type="range" min={6} max={30} value={kineticSceneCount}
                    onChange={(e) => setKineticSceneCount(Number(e.target.value))}
                    className="w-full accent-orange-500"
                  />
                  <p className="text-xs text-muted-foreground">{kineticSceneCount} scenes — approx. {Math.round(kineticSceneCount * 3.5)}s video</p>
                </div>
                <div className="space-y-2">
                  <Label>Colour scheme</Label>
                  <Select value={kineticColorScheme} onValueChange={(v) => setKineticColorScheme(v as typeof kineticColorScheme)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {KINETIC_COLOR_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Voice (for export)</Label>
                  <Select value={kineticVoiceId} onValueChange={setKineticVoiceId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {KINETIC_VOICE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={kineticPreviewVoiceover} onChange={(e) => setKineticPreviewVoiceover(e.target.checked)} className="accent-orange-500 w-4 h-4" />
                  <span className="text-sm">🔊 Preview voiceover (ElevenLabs)</span>
                </label>
              </div>
            )}

            {isStickmanMode && (
              <StickmanWhiteboardSetup
                topic={stickmanTopic}
                setTopic={setStickmanTopic}
                sceneCount={stickmanSceneCount}
                setSceneCount={setStickmanSceneCount}
                longMode={stickmanLongMode}
                setLongMode={setStickmanLongMode}
                targetMinutes={stickmanTargetMinutes}
                setTargetMinutes={setStickmanTargetMinutes}
                voiceId={stickmanVoiceId}
                setVoiceId={setStickmanVoiceId}
                ctaGoal={ctaGoal}
                setCtaGoal={setCtaGoal}
                introScript={stickmanIntroScript}
                setIntroScript={setStickmanIntroScript}
                ctaScript={stickmanCtaScript}
                setCtaScript={setStickmanCtaScript}
                outroScript={stickmanOutroScript}
                setOutroScript={setStickmanOutroScript}
              />
            )}

            {!isStoryTemplateMode && mode !== "10" && !isStickmanMode && !isSeriesLibrarySetupMode && (
              <>
            <div className="space-y-2">
              <Label htmlFor="template-studio-slide-count">Number of slides</Label>
              <select
                id="template-studio-slide-count"
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground",
                  "ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                )}
                value={mode === "5" ? String(slideCountViral) : String(slideCount)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (mode === "5") {
                    if ([5, 6, 7, 8, 9, 10].includes(n)) setSlideCountViral(n as 5 | 6 | 7 | 8 | 9 | 10);
                  } else {
                    if ([5, 10, 20].includes(n)) setSlideCount(n as 5 | 10 | 20);
                  }
                }}
              >
                {mode === "5"
                  ? SLIDE_COUNT_VIRAL_OPTIONS.map((n) => (
                      <option key={n} value={String(n)}>
                        {n} slides
                      </option>
                    ))
                  : SLIDE_COUNT_OPTIONS.map((n) => (
                      <option key={n} value={String(n)}>
                        {n} slides
                      </option>
                    ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Brand colour (primary)</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={brandPrimary}
                    onChange={(e) => setBrandPrimary(e.target.value)}
                    className="h-10 w-14 rounded border border-input cursor-pointer bg-background"
                    aria-label="Primary colour"
                  />
                  <Input
                    value={brandPrimary}
                    onChange={(e) => setBrandPrimary(e.target.value)}
                    className="font-mono max-w-[8rem]"
                    placeholder="#FF6B35"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Brand colour (secondary)</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={brandSecondary}
                    onChange={(e) => setBrandSecondary(e.target.value)}
                    className="h-10 w-14 rounded border border-input cursor-pointer bg-background"
                    aria-label="Secondary colour"
                  />
                  <Input
                    value={brandSecondary}
                    onChange={(e) => setBrandSecondary(e.target.value)}
                    className="font-mono max-w-[8rem]"
                    placeholder="#004E89"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-studio-font-style">Font style</Label>
              <select
                id="template-studio-font-style"
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground",
                  "ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                )}
                value={fontStyle}
                onChange={(e) => setFontStyle(e.target.value as FontStyle)}
              >
                {FONT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
              </>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              {isSeriesLibrarySetupMode ? (
                <p className="w-full text-sm text-muted-foreground text-left border-t border-border pt-4">
                  Saved automatically on this device. When you&apos;re ready to create, choose a template from the menu above — your show and episode apply to the next My Library save or export.
                </p>
              ) : isAiStoryMode && aiStoryScenes.length === 0 && aiStoryUiPhase === "characterPreview" ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setAiStoryUiPhase("form");
                      setCharacterReferenceUrls({});
                    }}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to setup
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void runGenerateAiStory()}
                    disabled={
                      Object.keys(characterReferenceUrls).length === 0 || aiStoryLoading
                    }
                  >
                    Lock references &amp; generate story
                    {aiStoryLoading ? (
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4 ml-2" />
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  onClick={async () => {
                    if (isAiStoryMode) {
                      if (aiStoryScenes.length > 0) {
                        await runGenerateAiStory();
                        return;
                      }
                      await runCharacterStylePreview();
                    } else if (mode === "8" || mode === "9" || mode === "15" || mode === "17") {
                      await runGenerateAiStory();
                    } else if (isViralMode) {
                      setViralLoading(true);
                      setViralData(null);
                      try {
                        const res = await fetch("/api/templates/viral/generate", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ type: viralType, topic: viralTopic, roundCount: viralRoundCount }),
                        });
                        const json = await res.json() as ViralTemplateData & { error?: string };
                        if (!res.ok || json.error) throw new Error(json.error ?? "Generation failed");
                        const viralPayload: ViralTemplateData =
                          json.type === "quiz" && Array.isArray(json.rounds)
                            ? {
                                ...json,
                                rounds: json.rounds.map((r) => normalizeRawQuizRound(r)),
                              }
                            : json;
                        setViralData(viralPayload);
                        toast({ title: "Rounds ready!", description: `${(json.rounds ?? []).length} ${viralType === "quiz" ? "quiz questions" : "dilemmas"} generated.` });
                      } catch (e) {
                        toast({ title: "Generation failed", description: e instanceof Error ? e.message : "Something went wrong", variant: "destructive" });
                      } finally {
                        setViralLoading(false);
                      }
                    } else if (isKineticMode) {
                      setKineticLoading(true);
                      setKineticData(null);
                      try {
                        const res = await fetch("/api/templates/kinetic/generate", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ topic: kineticTopic, sceneCount: kineticSceneCount, colorScheme: kineticColorScheme }),
                        });
                        const json = await res.json() as KineticData & { error?: string };
                        if (!res.ok || json.error) throw new Error(json.error ?? "Generation failed");
                        setKineticData({ ...json, voiceId: kineticVoiceId, colorScheme: kineticColorScheme });
                        toast({ title: "Scenes ready!", description: `${(json.scenes ?? []).length} kinetic scenes generated.` });
                      } catch (e) {
                        toast({ title: "Generation failed", description: e instanceof Error ? e.message : "Something went wrong", variant: "destructive" });
                      } finally {
                        setKineticLoading(false);
                      }
                    } else if (isStickmanMode) {
                      setStickmanLoading(true);
                      setStickmanScenes([]);
                      try {
                        const res = await fetch("/api/templates/stickman/generate", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            topic: stickmanTopic,
                            sceneCount: stickmanSceneCount,
                            longMode: stickmanLongMode,
                            targetMinutes: stickmanTargetMinutes,
                            ctaGoal,
                            introScript: stickmanIntroScript,
                            ctaScript: stickmanCtaScript,
                            outroScript: stickmanOutroScript,
                          }),
                        });
                        const data = await res.json() as { scenes?: StickmanScene[]; error?: string; savedDraftId?: string };
                        if (!res.ok || data.error) throw new Error(data.error ?? "Generation failed");
                        const generatedScenes = data.scenes ?? [];
                        setStickmanScenes(generatedScenes);
                        const serverDraftId =
                          typeof data.savedDraftId === "string" && data.savedDraftId ? data.savedDraftId : null;
                        if (serverDraftId) {
                          setStickmanLibraryVideoId(serverDraftId);
                          try {
                            sessionStorage.setItem(STICKMAN_LIBRARY_DRAFT_STORAGE_KEY, serverDraftId);
                          } catch {
                            // ignore
                          }
                        }
                        const effectiveStickmanLibraryId = serverDraftId ?? stickmanLibraryVideoId;
                        // Save immediately when scenes are generated so it shows in My Library.
                        try {
                          const estimatedSceneDuration = stickmanLongMode ? 28 : 12;
                          let runStart = 0;
                          const timelineScenes = generatedScenes.map((scene, idx) => {
                            const id = `stickman-${idx + 1}`;
                            const startTime = runStart;
                            runStart += estimatedSceneDuration;
                            return {
                              id,
                              title: scene.caption.slice(0, 80),
                              duration: estimatedSceneDuration,
                              color: SCENE_COLOR_HEX[idx % SCENE_COLOR_HEX.length] ?? "#3B82F6",
                              startTime,
                              elements: [{ id: `${id}-bg`, type: "background", media: null }],
                              pose: scene.pose,
                              layout: scene.layout ?? "left-presenter",
                              keyObject: scene.keyObject ?? "idea",
                              camera: scene.camera ?? "medium",
                              shotTemplate: scene.shotTemplate ?? "stand-explain",
                            };
                          });
                          const totalDuration = timelineScenes.reduce((acc, s) => acc + s.duration, 0);
                          const timedCaptions = timelineScenes.map((s, i) => ({
                            id: `cap-stickman-${i + 1}`,
                            text: generatedScenes[i]?.caption ?? "",
                            startTime: s.startTime,
                            endTime: s.startTime + s.duration,
                          }));
                          const baseTopic = stickmanTopic.trim() || "Stickman Whiteboard";
                          const payloadContent = mergeSeriesIntoTimelinePayload(
                            {
                              scenes: timelineScenes,
                              captions: timedCaptions,
                              totalDuration,
                              aspectRatio: "16:9",
                              sourceType: "stickman-whiteboard",
                              stickmanScenes: generatedScenes,
                            },
                            seriesShowTitle,
                            episodeNumber
                          );
                          const draftTitle = buildStickmanLibraryTitle(baseTopic, seriesShowTitle, episodeNumber);
                          if (effectiveStickmanLibraryId) {
                            const patchRes = await fetch(`/api/video-timeline/videos/${encodeURIComponent(effectiveStickmanLibraryId)}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ title: draftTitle, metadata: payloadContent }),
                            });
                            const patchData = await patchRes.json().catch(() => ({}));
                            if (!patchRes.ok) {
                              throw new Error(
                                typeof patchData?.error === "string" ? patchData.error : "Failed to update stickman draft"
                              );
                            }
                          } else {
                            const saveRes = await fetch("/api/video-timeline/save", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ title: draftTitle, content: payloadContent }),
                            });
                            const saveData = await saveRes.json().catch(() => ({}));
                            if (!saveRes.ok || !saveData?.id) {
                              throw new Error(
                                typeof saveData?.error === "string" ? saveData.error : "Failed to save stickman draft"
                              );
                            }
                            setStickmanLibraryVideoId(saveData.id as string);
                            try {
                              sessionStorage.setItem(STICKMAN_LIBRARY_DRAFT_STORAGE_KEY, saveData.id as string);
                            } catch {
                              // ignore
                            }
                          }
                          toast({ title: "Saved to My Library", description: "Stickman draft saved." });
                        } catch (saveErr) {
                          console.error("[stickman auto-save]", saveErr);
                          toast({
                            title: "Could not save to library",
                            description: saveErr instanceof Error ? saveErr.message : "Auto-save failed",
                            variant: "destructive",
                          });
                        }
                        toast({ title: "Stickman scenes ready!", description: `${generatedScenes.length} scenes generated.` });
                      } catch (e) {
                        toast({ title: "Generation failed", description: e instanceof Error ? e.message : "Something went wrong", variant: "destructive" });
                      } finally {
                        setStickmanLoading(false);
                      }
                    } else if (mode === "10") {
                      await runBrandStoryVideo();
                    } else if (mode === "16") {
                      await runAnimationPrompts();
                    } else {
                      await saveSetup();
                      setStep(2);
                    }
                  }}
                  disabled={
                    !canProceedStep1 ||
                    (isAiStoryMode && (aiStoryLoading || characterPreviewLoading)) ||
                    ((mode === "8" || mode === "9" || mode === "15" || mode === "17") && aiStoryLoading) ||
                    (mode === "10" && brandStoryVideoLoading) ||
                    (mode === "16" && animPromptsLoading) ||
                    (isStickmanMode && stickmanLoading) ||
                    (isViralMode && viralLoading) ||
                    (isKineticMode && kineticLoading)
                  }
                >
                  {isAiStoryMode
                    ? aiStoryScenes.length > 0
                      ? "Regenerate story"
                      : "Continue to reference images"
                    : mode === "8"
                      ? aiStoryScenes.length > 0
                        ? "Regenerate story"
                        : "Generate episode"
                      : mode === "9"
                        ? aiStoryScenes.length > 0
                          ? "Regenerate story"
                          : "Generate episode"
                        : mode === "15"
                          ? aiStoryScenes.length > 0
                            ? "Regenerate story"
                            : "Generate episode"
                          : mode === "17"
                            ? aiStoryScenes.length > 0
                              ? "Regenerate documentary"
                              : "Generate documentary"
                          : mode === "10"
                          ? "Generate 9:16 Brand Story video"
                          : mode === "16"
                          ? animPrompts.length > 0 ? "Regenerate prompts" : "Generate animation prompts"
                          : isViralMode
                            ? viralData ? "Regenerate" : viralType === "quiz" ? "Generate quiz" : "Generate Would You Rather"
                            : isKineticMode
                              ? kineticData ? "Regenerate scenes" : "Generate kinetic video"
                              : isStickmanMode
                                ? stickmanScenes.length > 0
                                  ? "Regenerate scenes"
                                  : stickmanLongMode
                                    ? "Generate long YouTube storyboard"
                                    : "Generate whiteboard video"
                                : "Next — Generate content"}
                  {(isAiStoryMode && (aiStoryLoading || characterPreviewLoading)) ||
                  ((mode === "8" || mode === "9" || mode === "15" || mode === "17") && aiStoryLoading) ||
                  (mode === "10" && brandStoryVideoLoading) ||
                  (mode === "16" && animPromptsLoading) ||
                  (isStickmanMode && stickmanLoading) ||
                  (isViralMode && viralLoading) ||
                  (isKineticMode && kineticLoading) ? (
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4 ml-2" />
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {mode === "7" && aiStoryUiPhase === "characterPreview" && Object.keys(characterReferenceUrls).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Character reference images</CardTitle>
              <CardDescription>
                Each portrait is generated once with fal.ai FLUX.1 [dev]. Scene stills use FLUX image-to-image with this image as the anchor — prompts describe only action and setting, not appearance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {parseCharacterTypes(characters)
                  .filter((t) => characterReferenceUrls[t])
                  .map((t) => (
                    <div key={t} className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      <p className="font-medium text-sm">{t}</p>
                      {characterReferenceUrls[t] ? (
                        <img
                          src={characterReferenceUrls[t]}
                          alt={`${t} reference`}
                          className="w-full rounded-md aspect-square object-cover"
                        />
                      ) : (
                        <div className="aspect-square rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground">
                          No preview image
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        </>
      )}

      {/* ── Stickman Whiteboard Preview ──────────────────────────────────── */}
      {step === 1 && isStickmanMode && stickmanScenes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>🖊️ Whiteboard Preview</CardTitle>
            <CardDescription>
              Press play to watch the 3D explainer character animate scene-by-scene with AI voiceover. Each scene auto-advances when the voiceover finishes. The first scene is the intro and the last is the outro — both use a dedicated bumper-style frame (dark title card and warm closing card) in the preview and in the exported MP4. Middle scenes use the dotted whiteboard layout. With 4+ scenes, the second-to-last is your CTA beat, including subscribe or follow, like, and share alongside your chosen goal.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 space-y-6">
            <div className="mx-auto w-full min-w-0 max-w-5xl overflow-hidden rounded-xl border border-border/40 bg-muted/20 p-2 sm:p-3">
              <StickmanWhiteboard
                scenes={stickmanScenes}
                voiceId={stickmanVoiceId}
                autoPlay={false}
                topic={stickmanTopic}
                onComplete={() =>
                  toast({ title: "Playback complete!", description: "Your whiteboard video is ready." })
                }
              />
            </div>

            {/* Scene list */}
            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">All scenes</p>
              <div className="space-y-2">
                {stickmanScenes.map((s) => (
                  <div key={s.sceneIndex} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center">
                      {s.sceneIndex + 1}
                    </span>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {s.segment ? (
                          <span className="text-[10px] uppercase tracking-wide font-semibold text-orange-700 bg-orange-50 border border-orange-200/80 px-2 py-0.5 rounded">
                            {s.segment === "cta-outro"
                              ? "CTA + outro"
                              : s.segment === "intro"
                                ? "Intro"
                                : s.segment === "cta"
                                  ? "CTA"
                                  : s.segment === "outro"
                                    ? "Outro"
                                    : "Main"}
                          </span>
                        ) : null}
                      </div>
                      {s.sceneTitle?.trim() ? (
                        <p className="text-foreground font-semibold text-orange-700 dark:text-orange-400">{s.sceneTitle.trim()}</p>
                      ) : null}
                      {Array.isArray(s.bullets) && s.bullets.some((b) => b.trim()) ? (
                        <ul className="list-disc pl-4 text-muted-foreground text-xs space-y-0.5">
                          {s.bullets.filter((b) => b.trim()).map((b, j) => (
                            <li key={j}>{b.trim()}</li>
                          ))}
                        </ul>
                      ) : null}
                      <p className="text-foreground text-sm">{s.caption}</p>
                      <p className="text-xs text-muted-foreground">
                        Pose: {s.pose} · Layout: {s.layout ?? "left-presenter"} · Object: {s.keyObject ?? "idea"} · Camera: {s.camera ?? "medium"} · Shot: {s.shotTemplate ?? "stand-explain"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Export note */}
            <div className="rounded-lg bg-muted/60 border p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Next steps</p>
              <p>Once you&apos;re happy with the scenes, export your video as MP4, save it to your library, or click <strong>Regenerate scenes</strong> to tweak the content.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void exportStickmanFromHere()}
                  disabled={stickmanExporting}
                >
                  {stickmanExporting ? "Starting export..." : "Export MP4 now"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={saveStickmanToLibrary}
                  disabled={stickmanLibrarySaving}
                >
                  {stickmanLibrarySaving ? "Saving..." : "Save to My Library"}
                </Button>
                {stickmanLibraryVideoId ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/dashboard/library")}
                  >
                    View in Library
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void quickScheduleStickmanYouTube()}
                >
                  Save to YouTube queue
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void postStickmanToTikTok()}
                  disabled={stickmanTikTokPosting || stickmanExporting}
                >
                  {stickmanTikTokPosting ? "Posting to TikTok…" : "Post to TikTok"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Viral Template Preview ────────────────────────────────────────── */}
      {step === 1 && isViralMode && viralData && (
        <Card>
          <CardHeader>
            <CardTitle>{viralData.type === "quiz" ? "🧠 Quiz Preview" : "🎯 Would You Rather Preview"}</CardTitle>
            <CardDescription>
              {viralData.type === "quiz"
                ? "Click Reveal to show the answer, or press Play to auto-advance."
                : "Press Play to auto-cycle through rounds. Export as MP4 or post directly to TikTok."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ViralTemplatePreview
              data={viralData}
              settings={{
                slideDuration: viralFormLength === "long" ? VIRAL_LONG_DURATION : VIRAL_SHORT_DURATION,
                aspectRatio: viralFormLength === "long" ? "16:9" : "9:16",
                showTimer: viralShowTimer,
                voiceover: viralVoiceover,
                backgroundMusic: viralBgm,
              } satisfies ViralSettings}
            />
            <div className="rounded-lg bg-muted/60 border p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-2">Export options</p>
              <p className="text-xs mb-3">
                MP4 voiceover:{" "}
                <span className="font-medium text-foreground">
                  {ELEVENLABS_VOICES.find((v) => v.voiceId === viralExportVoiceId)?.name ?? "ElevenLabs"}
                </span>
                {" "}(set under <span className="text-foreground">Voice (ElevenLabs, for MP4 export)</span> above). Background:{" "}
                <span className="font-medium text-foreground">
                  {BGM_SELECT_OPTIONS.find((o) => o.value === viralBgm)?.label ?? viralBgm}
                </span>
                . Visual style:{" "}
                <span className="font-medium text-foreground">
                  {resolveViralVisualTheme(viralData.visualTheme).label}
                </span>
                {" "}(picked randomly when you generate — export matches preview).
              </p>
              <div data-tour="template-export" className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={viralExporting} onClick={async () => {
                  setViralExporting(true);
                  try {
                    const res = await fetch("/api/templates/viral/export", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        ...viralData,
                        slideDuration: viralFormLength === "long" ? VIRAL_LONG_DURATION : VIRAL_SHORT_DURATION,
                        aspectRatio: viralFormLength === "long" ? "16:9" : "9:16",
                        voiceId: viralExportVoiceId,
                        backgroundMusic: viralBgm,
                      }),
                    });
                    if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error((j as {error?:string}).error ?? "Export failed"); }
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${buildViralExportFilenameBase(viralData.topic || "", seriesShowTitle, episodeNumber)}.mp4`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast({ title: "MP4 downloading", description: "Check your Downloads folder." });
                  } catch (e) {
                    toast({ title: "Export failed", description: e instanceof Error ? e.message : "Something went wrong", variant: "destructive" });
                  } finally { setViralExporting(false); }
                }}>
                  {viralExporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Exporting…</> : <><Download className="mr-2 h-4 w-4" />Export MP4</>}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Kinetic Typography Preview ────────────────────────────────────── */}
      {step === 1 && isKineticMode && kineticData && (
        <Card>
          <CardHeader>
            <CardTitle>⚡ Kinetic Typography Preview</CardTitle>
            <CardDescription>
              Bold text on dark background — clean, modern, high-quality faceless format.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <KineticTypographyPreview data={kineticData} voiceover={kineticPreviewVoiceover} aspectRatio={kineticFormLength === "long" ? "16:9" : "9:16"} voiceId={kineticVoiceId} />
            <div className="rounded-lg bg-muted/60 border p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-2">Export options</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={kineticExporting} onClick={async () => {
                  setKineticExporting(true);
                  try {
                    const res = await fetch("/api/templates/kinetic/export", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ ...kineticData, voiceId: kineticVoiceId, aspectRatio: kineticFormLength === "long" ? "16:9" : "9:16" }),
                    });
                    if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error((j as {error?:string}).error ?? "Export failed"); }
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${buildViralExportFilenameBase(kineticData.topic || "", seriesShowTitle, episodeNumber)}.mp4`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast({ title: "MP4 downloading", description: "Check your Downloads folder." });
                  } catch (e) {
                    toast({ title: "Export failed", description: e instanceof Error ? e.message : "Something went wrong", variant: "destructive" });
                  } finally { setKineticExporting(false); }
                }}>
                  {kineticExporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Exporting…</> : <><Download className="mr-2 h-4 w-4" />Export MP4</>}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && isStoryTemplateMode && aiStoryScenes.length > 0 && (
        <>
        {voiceoverEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>Character Voices</CardTitle>
            <CardDescription>Assign a voice to each character. Used when generating voiceover for a scene.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(
              characterNames.trim()
                ? characterNames.split(",").map((c) => c.trim()).filter(Boolean)
                : [...new Set(aiStoryScenes.map((s) => s.dialogue.match(/^([^:]+):/)).filter(Boolean).map((m) => (m as RegExpMatchArray)[1].trim()))]
            ).map((charName) => (
              <div key={charName} className="space-y-2">
                <Label>{charName}</Label>
                <Select
                  value={characterVoices[charName] ?? ""}
                  onValueChange={(v) => setCharacterVoices((prev) => ({ ...prev, [charName]: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {elevenLabsVoices.map((v) => (
                      <SelectItem key={v.voice_id} value={v.voice_id}>
                        {v.name}
                        {v.description ? ` — ${v.description}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Leave blank and AI will auto-assign a suitable voice</p>
              </div>
            ))}
          </CardContent>
        </Card>
        )}

        <div ref={aiStoryScenesSectionRef} className="scroll-mt-24">
        {characterSeed.trim().length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Locked character look</CardTitle>
              <CardDescription>
                Edit this look, then apply it to all scene prompts. Regenerating scene images will use your updated look.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={characterSeed}
                onChange={(e) => setCharacterSeed(e.target.value)}
                className="min-h-[100px] text-sm resize-none"
                aria-label="Character visual seed"
              />
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={applyCharacterLookToScenes}>
                  Apply look to all scenes
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <CardTitle>Scenes</CardTitle>
                <CardDescription className="mt-1">
                  {mode === "8"
                    ? "Generated scenes for your Satisfying Build."
                    : mode === "9"
                      ? "Generated scenes for your AI Cooking Video."
                      : mode === "15"
                        ? "Generated scenes for your Story Video."
                        : mode === "17"
                          ? "Your Finance Documentary storyboard. Generate images to bring each scene to life."
                          : "Generated scenes for your AI Story."}
                </CardDescription>
              </div>
              {creditsBalance !== null && creditsBalance > 0 && (
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                    disabled={allImagesGenerating || allVoiceoversGenerating || allAnimationsGenerating}
                    onClick={() => void handleGenerateAllImages()}
                  >
                    {allImagesGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {allImagesProgress ? `Images ${allImagesProgress.done}/${allImagesProgress.total}…` : "Generating…"}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        All Images
                      </>
                    )}
                  </Button>
                  {voiceoverEnabled && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-orange-400 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
                      disabled={allVoiceoversGenerating || allImagesGenerating || allAnimationsGenerating}
                      onClick={() => void handleGenerateAllVoiceovers()}
                    >
                      {allVoiceoversGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {allVoiceoversProgress ? `Voiceovers ${allVoiceoversProgress.done}/${allVoiceoversProgress.total}…` : "Generating…"}
                        </>
                      ) : (
                        <>🎙 All Voiceovers</>
                      )}
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-purple-400 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950"
                    disabled={allAnimationsGenerating || allImagesGenerating || allVoiceoversGenerating || Object.keys(sceneImageUrls).length === 0}
                    onClick={() => void handleGenerateAllAnimations()}
                    title={Object.keys(sceneImageUrls).length === 0 ? "Generate images first" : "Animate all scenes (2–10 mins each, runs in parallel)"}
                  >
                    {allAnimationsGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {allAnimationsProgress ? `Animating ${allAnimationsProgress.done}/${allAnimationsProgress.total}…` : "Animating…"}
                      </>
                    ) : (
                      <>🎬 All Animations</>
                    )}
                  </Button>
                </div>
              )}
            </div>
            {/* No-credits guide banner */}
            {creditsBalance !== null && creditsBalance === 0 && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎬</span>
                  <p className="font-semibold text-amber-900 dark:text-amber-200">You have 0 video credits</p>
                </div>
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Your script and image prompts are ready! You can use them to create your video manually with free tools — or buy credits to let Content Flywheel generate everything automatically.
                </p>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 uppercase tracking-wide">How to make your video manually:</p>
                  <ol className="text-sm text-amber-800 dark:text-amber-300 space-y-1.5 list-none">
                    <li className="flex gap-2"><span className="font-bold">1.</span><span>Copy each scene&apos;s <strong>Dialogue</strong> — this is your video script / voiceover text.</span></li>
                    <li className="flex gap-2"><span className="font-bold">2.</span><span>Paste the <strong>Image prompt</strong> into <a href="https://www.midjourney.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">Midjourney</a>, <a href="https://leonardo.ai" target="_blank" rel="noopener noreferrer" className="underline font-medium">Leonardo.ai</a>, or <a href="https://openai.com/dall-e-3" target="_blank" rel="noopener noreferrer" className="underline font-medium">DALL·E</a> to generate each scene image.</span></li>
                    <li className="flex gap-2"><span className="font-bold">3.</span><span>Record your voiceover or use <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="underline font-medium">ElevenLabs</a> / <a href="https://murf.ai" target="_blank" rel="noopener noreferrer" className="underline font-medium">Murf.ai</a> to generate AI narration.</span></li>
                    <li className="flex gap-2"><span className="font-bold">4.</span><span>Assemble in <a href="https://www.capcut.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">CapCut</a> (free) or <a href="https://www.blackmagicdesign.com/products/davinciresolve" target="_blank" rel="noopener noreferrer" className="underline font-medium">DaVinci Resolve</a> — add your images, voiceover, and background music.</span></li>
                    <li className="flex gap-2"><span className="font-bold">5.</span><span>Add captions with CapCut&apos;s auto-caption feature or copy the dialogue as text overlays.</span></li>
                  </ol>
                </div>
                <a
                  href="/dashboard/video-credits"
                  className="inline-flex items-center gap-1.5 rounded-md bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3 py-1.5 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Buy video credits to automate this
                </a>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {aiStoryScenes.map((scene) => {
                const characterNameMatch = scene.dialogue.match(/^([^:]+):/);
                const characterName = characterNameMatch ? characterNameMatch[1].trim() : null;
                const voiceId = characterName && characterVoices[characterName]
                  ? characterVoices[characterName]
                  : characterName
                    ? getDefaultVoiceIdForCharacter(characterName)
                    : elevenLabsVoices[0]?.voice_id ?? "";
                const voiceoverUrl = voiceoverUrls[scene.sceneNumber];
                const storedImageUrl = sceneImageUrls[scene.sceneNumber];
                const isStoredUrlValid =
                  typeof storedImageUrl === "string" &&
                  storedImageUrl.trim() !== "" &&
                  (storedImageUrl.startsWith("http://") || storedImageUrl.startsWith("https://") || storedImageUrl.startsWith("data:image/"));
                const sceneImageUrl = isStoredUrlValid ? storedImageUrl.trim() : "";
                const imageLoading = sceneImageLoadingScene === scene.sceneNumber;
                const sceneVideoUrl = sceneVideoUrls[scene.sceneNumber];
                const trimmedSeed = characterSeed.trim();
                const trimmedPrompt = scene.imagePrompt.trim();
                const displayImagePrompt =
                  trimmedSeed && trimmedPrompt.startsWith(trimmedSeed)
                    ? trimmedPrompt.slice(trimmedSeed.length).replace(/^\s+/, "")
                    : trimmedPrompt;
                return (
                <Card key={scene.sceneNumber}>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm">Scene {scene.sceneNumber}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-2 text-sm">
                    {sceneImageUrl ? (
                      <img
                        src={sceneImageUrl}
                        alt={`Scene ${scene.sceneNumber}`}
                        className={cn(
                          "w-full rounded-md object-cover",
                          mode === "15" || mode === "17" ? "aspect-video" : "aspect-square"
                        )}
                      />
                    ) : null}
                    {creditsBalance !== null && creditsBalance === 0 ? null : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={imageLoading || allImagesGenerating}
                      onClick={async () => {
                        setSceneImageLoadingScene(scene.sceneNumber);
                        try {
                          const types = parseCharacterTypes(characters);
                          const primaryType = getPrimaryCharacterTypeForScene(
                            scene.dialogue,
                            characters,
                            characterNames
                          );
                          const refUrl =
                            (primaryType && characterReferenceUrls[primaryType]) ||
                            (types[0] ? characterReferenceUrls[types[0]] : undefined);

                          let res: Response;
                          let data: { url?: string; error?: string };

                          // AI Cooking Video: FLUX text-to-image so each scene shows food/action (portrait img2img was locking to headshots).
                          if (mode === "9") {
                            const rawPrompt = scene.imagePrompt;
                            const sceneComposition =
                              stripLockedCharacterSeedFromPrompt(rawPrompt) || rawPrompt;
                            console.log("[AI Cooking Video] fal text-to-image scene:", {
                              scene: scene.sceneNumber,
                              dialogueLen: scene.dialogue.length,
                              compositionLen: sceneComposition.length,
                            });
                            res = await fetch("/api/content-studio/ai-cooking-video/scene-image", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                sceneComposition,
                                characterSeed: characterSeed.trim(),
                                dialogue: scene.dialogue.trim(),
                              }),
                            });
                            data = await res.json();
                          } else if (useImg2ImgSceneImages && refUrl) {
                            const sceneBody = {
                              referenceImageUrl: refUrl,
                              prompt: scene.imagePrompt,
                            };
                            console.log("[AI Story] fal img2img scene-image:", sceneBody);
                            res = await fetch("/api/content-studio/ai-story/scene-image", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(sceneBody),
                            });
                            data = await res.json();
                          } else {
                            const hasEmbeddedSeed = characterSeed.trim().length > 0;
                            const imageBody: Record<string, unknown> = {
                              prompt: scene.imagePrompt,
                            };
                            if (mode === "15") {
                              imageBody.storyVideoFormat = storyVideoFormat;
                            }
                            if (mode === "17") {
                              // Finance Documentary = YouTube long-form = landscape 16:9
                              imageBody.storyVideoFormat = "long";
                            }
                            if (hasEmbeddedSeed) {
                              if (mode === "7") {
                                imageBody.aiStoryLocked = true;
                              } else if (mode === "8") {
                                imageBody.photoreal = true;
                                imageBody.identityLock = true;
                              }
                            } else if (!useImg2ImgSceneImages && aiStoryCharacterStyle) {
                              imageBody.characterStyle = aiStoryCharacterStyle;
                            }
                            console.log("[AI Story] DALL-E generate-image prompt:", scene.imagePrompt);
                            res = await fetch("/api/generate-image", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(imageBody),
                            });
                            data = await res.json();
                          }
                          console.log("[AI Story] image API response keys:", Object.keys(data));
                          if (!res.ok) throw new Error(data?.error ?? "Failed");
                          // Resolve full image URL (no truncation): API returns { url } or raw { data: [{ url }] }.
                          const rawFromUrl = typeof data?.url === "string" ? data.url.trim() : "";
                          const rawFromImageUrl = typeof (data as { imageUrl?: string }).imageUrl === "string" ? (data as { imageUrl: string }).imageUrl.trim() : "";
                          const rawFromData = Array.isArray((data as { data?: { url?: string }[] }).data) && typeof (data as { data: { url?: string }[] }).data[0]?.url === "string" ? (data as { data: { url: string }[] }).data[0].url.trim() : "";
                          const url = rawFromUrl || rawFromImageUrl || rawFromData;
                          if (url && (url.startsWith("data:image/") || url.startsWith("https://") || url.startsWith("http://"))) {
                            setSceneImageUrls((prev) => ({ ...prev, [scene.sceneNumber]: url }));
                            console.log("Scene image URL saved (full, not truncated)", { sceneNumber: scene.sceneNumber, urlLength: url.length, startsWithHttps: url.startsWith("https://"), preview: url.slice(0, 60) + (url.length > 60 ? "..." : ""), tip: "In console run: __templateStudioDebug.scenes to verify each scene.imageUrl is the full URL" });
                          } else {
                            toast({
                              title: "Invalid image URL",
                              description: "The server did not return a valid image URL. Try again.",
                              variant: "destructive",
                            });
                          }
                        } catch (e) {
                          toast({
                            title: "Image generation failed",
                            description: e instanceof Error ? e.message : "Something went wrong",
                            variant: "destructive",
                          });
                        } finally {
                          setSceneImageLoadingScene(null);
                        }
                      }}
                    >
                      {imageLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Generate Image
                    </Button>
                    )}
                    {sceneImageUrl ? (
                      <AiStoryAnimateSceneBlock
                        imageUrl={sceneImageUrl}
                        motionPrompt={scene.motionPrompt || scene.imagePrompt}
                        videoUrl={sceneVideoUrl}
                        onVideoUrl={(url) =>
                          setSceneVideoUrls((prev) => ({ ...prev, [scene.sceneNumber]: url }))
                        }
                        {...(mode === "15" || mode === "17"
                          ? {
                              aspectRatio: "16:9" as const,
                              videoClassName:
                                "w-full rounded-md mt-2 aspect-video object-cover",
                            }
                          : {})}
                      />
                    ) : null}
                    <p className="font-medium">Dialogue</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{scene.dialogue}</p>
                    <p className="font-medium">Image prompt</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{displayImagePrompt}</p>
                    {voiceoverEnabled && creditsBalance !== 0 && (
                      <AiStorySceneVoiceover
                        voiceId={voiceId}
                        dialogueLine={scene.dialogue}
                        audioUrl={voiceoverUrl}
                        onAudioUrl={(url) =>
                          setVoiceoverUrls((prev) => ({ ...prev, [scene.sceneNumber]: url }))
                        }
                        maxDurationSeconds={TIMELINE_SCENE_DURATION}
                      />
                    )}
                  </CardContent>
                </Card>
                );
              })}
            </div>
            <div className="mt-6 pt-4 border-t space-y-3">
              {(libraryDraftSaving || libraryDraftVideoId) && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/60 px-3 py-2 text-sm">
                  {libraryDraftSaving && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                  )}
                  {libraryDraftVideoId ? (
                    <>
                      <span className="text-muted-foreground">
                        {libraryDraftSaving ? "Saving to My Library…" : "Saved to My Library (draft)."}
                      </span>
                      <Button
                        variant="link"
                        className="h-auto p-0 text-primary underline"
                        onClick={() => void openVideoTimeline()}
                      >
                        {libraryDraftSaving ? "Open draft" : "View draft"}
                      </Button>
                      {!libraryDraftSaving && (
                        <>
                          <span className="text-muted-foreground">or</span>
                          <Button
                            variant="link"
                            className="h-auto p-0 text-primary underline"
                            onClick={() => router.push("/dashboard/library")}
                          >
                            Open from My Library
                          </Button>
                        </>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Saving to My Library…</span>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <Film className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">
                  Your video timeline has <strong className="text-foreground">{aiStoryScenes.length}</strong> clip{aiStoryScenes.length !== 1 ? "s" : ""} ready.
                </span>
                <Button variant="link" className="h-auto p-0 text-primary underline" onClick={() => void openVideoTimeline()}>
                  View in Video Timeline
                </Button>
              </div>
              <Button variant="default" className="w-full sm:w-auto" onClick={() => void openVideoTimeline()}>
                <Film className="w-4 h-4 mr-2" />
                View in Video Timeline
              </Button>
              <p className="text-sm text-muted-foreground">
                Timeline auto-updates as you generate images, animations
                {voiceoverEnabled ? ", and voiceovers" : ""}. Open when ready to edit or export MP4.
              </p>
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={aiStoryLoading}
                onClick={() => void handleGenerateNextEpisode()}
              >
                {aiStoryLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <span className="mr-1.5" aria-hidden>
                    ▶
                  </span>
                )}
                Generate Next Episode
              </Button>
              {/* Auto full-video generation */}
              {!storyVideoExportUrl && (
                <div className="rounded-xl border border-orange-400/40 bg-orange-500/5 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-orange-500 shrink-0" />
                      Generate Full Video — 1 credit
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Automatically generates scene images, animates every clip, adds voiceover, and stitches a ready-to-post MP4 — all in one click.
                    </p>
                  </div>
                  <div className="space-y-2 max-w-xs">
                    <Label htmlFor="auto-bgm" className="text-foreground text-xs">Background music</Label>
                    <Select
                      value={storyBackgroundMusic}
                      onValueChange={(v) => setStoryBackgroundMusic(v as BgmSelectValue)}
                    >
                      <SelectTrigger id="auto-bgm" className="w-full">
                        <SelectValue placeholder="Background music" />
                      </SelectTrigger>
                      <SelectContent>
                        {BGM_SELECT_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white"
                    disabled={autoGenerating || aiStoryLoading}
                    onClick={() => void handleGenerateFullVideo()}
                  >
                    {autoGenerating ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    {autoGenerating ? "Generating…" : "Generate Full Video (1 credit)"}
                  </Button>
                  {autoGenerating && autoGeneratePhase && (
                    <div className="space-y-1.5">
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-orange-500" />
                        {autoGeneratePhase}
                        {autoGenerateProgress ? ` (${autoGenerateProgress.done}/${autoGenerateProgress.total})` : "…"}
                      </p>
                      {autoGenerateProgress && (
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden max-w-xs">
                          <div
                            className="h-full rounded-full bg-orange-500 transition-all duration-300"
                            style={{ width: `${Math.round((autoGenerateProgress.done / autoGenerateProgress.total) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  {autoGenerateError && !autoGenerating && (
                    <p className="text-sm text-destructive">{autoGenerateError}</p>
                  )}
                </div>
              )}
              {canExportStoryVideo && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Export story video</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      All {aiStoryScenes.length} scenes have animation
                      {voiceoverEnabled ? " and voiceover" : ""}. Save a script, stitch one MP4 on the server, then download — no need to open the timeline first.
                    </p>
                  </div>
                  <div className="space-y-2 max-w-xs">
                    <Label htmlFor="story-bgm" className="text-foreground">
                      Background music
                    </Label>
                    <Select
                      value={storyBackgroundMusic}
                      onValueChange={(v) => setStoryBackgroundMusic(v as BgmSelectValue)}
                    >
                      <SelectTrigger id="story-bgm" className="w-full">
                        <SelectValue placeholder="Background music" />
                      </SelectTrigger>
                      <SelectContent>
                        {BGM_SELECT_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Looped bed track at low volume (~18%)
                      {voiceoverEnabled ? " under the voice" : " under the mix"}.{" "}
                      <a
                        href="/bgm/ATTRIBUTION.md"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-primary"
                      >
                        Attribution
                      </a>
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600"
                    disabled={storyVideoExporting}
                    onClick={() => void handleExportStoryVideo()}
                  >
                    {storyVideoExporting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Export Story Video
                  </Button>
                  {storyVideoExporting && storyVideoExportPhase && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      {storyVideoExportPhase === "saving"
                        ? "Saving script and syncing timeline…"
                        : "Stitching MP4 (this can take a few minutes)…"}
                    </p>
                  )}
                  {storyVideoExportError && (
                    <p className="text-sm text-destructive">{storyVideoExportError}</p>
                  )}
                  {storyVideoExportUrl && !storyVideoExporting && (
                    <div className="flex flex-col gap-2 pt-1">
                      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                        <Button variant="default" asChild>
                          <a href={storyVideoExportUrl} download target="_blank" rel="noopener noreferrer">
                            <Download className="w-4 h-4 mr-2" />
                            Download MP4
                          </a>
                        </Button>
                        {storyVideoExportScriptId && (
                          <Button variant="outline" asChild>
                            <a href={getTimelineUrl(storyVideoExportScriptId)}>
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Edit in Timeline
                            </a>
                          </Button>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <a
                          href="https://www.tiktok.com/upload"
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Opens TikTok upload — your video will be downloaded ready to upload"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-black hover:bg-gray-900 text-white transition-colors"
                        >
                          📱 Post to TikTok
                        </a>
                        <a
                          href="https://www.instagram.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open Instagram to upload your video via the app"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 hover:opacity-90 text-white transition-opacity"
                        >
                          📸 Post to Instagram
                        </a>
                        <a
                          href="https://studio.youtube.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Opens YouTube Studio to upload your video"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
                        >
                          🎬 Post to YouTube
                        </a>
                        <button
                          type="button"
                          title="Copy video URL to clipboard"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-foreground transition-colors"
                          onClick={() => {
                            void navigator.clipboard.writeText(storyVideoExportUrl).then(() => {
                              setCopiedStoryVideoLink(true);
                              setTimeout(() => setCopiedStoryVideoLink(false), 2000);
                            });
                          }}
                        >
                          <Copy className="w-3 h-3" />
                          {copiedStoryVideoLink ? "Copied!" : "📋 Copy video link"}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Tip: Download first, then upload to your chosen platform.
                      </p>
                    </div>
                  )}
                </div>
              )}
              {socialMediaPack && (
                <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">Social Media Pack</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Auto-generated from this episode&apos;s theme, characters, and dialogue.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={socialMediaPackLoading}
                      onClick={handleCopySocialMediaPack}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={socialMediaPackLoading}
                      onClick={() => void handleRegenerateSocialMediaPack()}
                    >
                      {socialMediaPackLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                      Regenerate
                    </Button>
                  </div>
                  <Textarea
                    readOnly
                    value={socialMediaPackText}
                    className="min-h-[260px] font-mono text-xs"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </div>
        </>
      )}

      {step === 2 && mode === "16" && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>🎬 Animation Prompts</CardTitle>
                  <CardDescription className="mt-1">
                    Copy any prompt into <strong>Kling AI</strong>, <strong>Pika</strong>, or <strong>Runway</strong>. The caption is your text overlay — the animation prompt is the scene description.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const all = animPrompts.map((p, i) =>
                      `--- Prompt ${i + 1} ---\nCaption: ${p.caption}\nAnimation Prompt: ${p.animationPrompt}\nMood: ${p.mood}`
                    ).join("\n\n");
                    void navigator.clipboard.writeText(all).then(
                      () => toast({ title: "All prompts copied!" }),
                      () => toast({ title: "Copy failed", variant: "destructive" })
                    );
                  }}
                  className="shrink-0"
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copy all
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {animPrompts.map((p, i) => (
                <div key={i} className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                  {/* Caption / text overlay */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Text overlay</p>
                      <p className="text-base font-bold text-foreground leading-snug">{p.caption}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(p.caption).then(
                          () => { setAnimCopiedIndex(i * 10 + 1); setTimeout(() => setAnimCopiedIndex(null), 1500); },
                          () => toast({ title: "Copy failed", variant: "destructive" })
                        );
                      }}
                      className="shrink-0 text-xs px-2 py-1 rounded border border-border hover:bg-accent transition-colors text-muted-foreground"
                    >
                      {animCopiedIndex === i * 10 + 1 ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  {/* Animation prompt */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Animation prompt (Kling / Pika / Runway)</p>
                    <p className="text-sm text-foreground leading-relaxed bg-background rounded-lg border border-border px-3 py-2.5">{p.animationPrompt}</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">🎵 <span className="font-medium">{p.mood}</span></span>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(p.animationPrompt).then(
                            () => { setAnimCopiedIndex(i * 10 + 2); setTimeout(() => setAnimCopiedIndex(null), 1500); },
                            () => toast({ title: "Copy failed", variant: "destructive" })
                          );
                        }}
                        className="text-xs px-2.5 py-1 rounded bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors shrink-0"
                      >
                        {animCopiedIndex === i * 10 + 2 ? "✓ Copied!" : "Copy prompt"}
                      </button>
                    </div>
                  </div>
                  {/* Engagement hook */}
                  {p.engagementHook && (
                    <div className="flex items-start gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2">
                      <span className="text-green-600 dark:text-green-400 text-sm shrink-0">💬</span>
                      <p className="text-xs text-green-800 dark:text-green-300 leading-relaxed"><span className="font-semibold">Why it works: </span>{p.engagementHook}</p>
                    </div>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep(1)}
                className="text-muted-foreground mt-2"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to setup
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {step === 2 && mode !== "16" && !isStoryTemplateMode && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Slide content</CardTitle>
              <CardDescription>
                Generate copy with AI, then edit any slide or regenerate one at a time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleGenerateContent}
                disabled={generating}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Generate Content
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(1)}
                className="text-muted-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to setup
              </Button>
            </CardContent>
          </Card>

          {slides.length > 0 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Preview</CardTitle>
                  <CardDescription>
                    Scroll to see all slides. Export Pack downloads 1080×1080 PNGs in a ZIP.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SlideDeck
                    slides={slides}
                    brandPrimary={brandPrimary}
                    brandSecondary={brandSecondary}
                    fontStyle={fontStyle}
                    brandName={brandName.trim() || "Content Flywheel"}
                    slideRefs={slideRefs}
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      onClick={handleExportPack}
                      disabled={exporting}
                      variant="outline"
                    >
                      {exporting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      Export Pack
                    </Button>
                    <Button
                      onClick={() => setStep(3)}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      Next — Caption & publish
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Edit slides</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {slides.map((slide, index) => (
                  <Card key={index} className="flex flex-col">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                      <CardTitle className="text-sm">Slide {index + 1}</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRegenerateSlide(index)}
                        disabled={regeneratingIndex !== null}
                      >
                        {regeneratingIndex === index ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Regenerate
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Heading</Label>
                        <Input
                          value={slide.heading}
                          onChange={(e) => updateSlide(index, "heading", e.target.value)}
                          placeholder="Max 6 words"
                          maxLength={50}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Body</Label>
                        <Textarea
                          value={slide.body}
                          onChange={(e) => updateSlide(index, "body", e.target.value)}
                          placeholder="Max 20 words"
                          rows={2}
                          className="resize-none"
                          maxLength={120}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
            </>
          )}
        </>
      )}

      {step === 3 && slides.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Get Captions & Publish</CardTitle>
              <CardDescription>
                One caption and one hashtag block for the entire carousel (all slides publish as a single Instagram post). Then pick
                accounts and publish or schedule.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="pack-name">Pack name</Label>
                <Input
                  id="pack-name"
                  value={packName}
                  onChange={(e) => setPackName(e.target.value)}
                  placeholder={niche.trim() || "My Template Pack"}
                  className="max-w-sm"
                />
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor="carousel-caption">Caption (whole carousel)</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleGenerateCaption()}
                    disabled={captionGenLoading}
                    className="bg-orange-500/15 text-orange-900 hover:bg-orange-500/25 dark:text-orange-100"
                  >
                    {captionGenLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Generate Caption
                  </Button>
                </div>
                <Textarea
                  id="carousel-caption"
                  value={carouselCaption}
                  onChange={(e) => setCarouselCaption(e.target.value)}
                  placeholder="One caption for the full carousel — hook, value, CTA (e.g. 150–300 words)…"
                  rows={10}
                  className="min-h-[200px] text-sm"
                />
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor="carousel-hashtags">Hashtags (whole carousel)</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleGenerateHashtags()}
                    disabled={hashtagGenLoading}
                    className="bg-orange-500/15 text-orange-900 hover:bg-orange-500/25 dark:text-orange-100"
                  >
                    {hashtagGenLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Generate Hashtags
                  </Button>
                </div>
                <Textarea
                  id="carousel-hashtags"
                  value={carouselHashtags}
                  onChange={(e) => setCarouselHashtags(e.target.value)}
                  placeholder="#yourbrand #niche #topic — space-separated tags for the whole post"
                  rows={4}
                  className="min-h-[100px] text-sm font-mono"
                />
              </div>

              <div className="space-y-3">
                <Label>Platforms</Label>
                <p className="text-xs text-muted-foreground">
                  Only connected accounts can be selected.{" "}
                  <Link href="/dashboard/settings/connected-accounts" className="underline underline-offset-2">
                    Connect accounts
                  </Link>
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      { id: "instagram" as const, label: "Instagram" },
                      { id: "facebook" as const, label: "Facebook" },
                      { id: "tiktok" as const, label: "TikTok" },
                      { id: "youtube" as const, label: "YouTube" },
                    ] as const
                  ).map(({ id, label }) => {
                    const connected = connectedPlatforms.has(id);
                    return (
                      <div
                        key={id}
                        className={`flex items-center gap-3 rounded-lg border p-3 ${connected ? "" : "opacity-60 bg-muted/30"}`}
                      >
                        <Checkbox
                          id={`publish-${id}`}
                          checked={publishTargets[id]}
                          disabled={!connected || publishing || scheduling}
                          onCheckedChange={(c) =>
                            setPublishTargets((prev) => ({ ...prev, [id]: c === true }))
                          }
                        />
                        <div className="flex flex-col gap-0.5">
                          <label htmlFor={`publish-${id}`} className="text-sm font-medium leading-none cursor-pointer">
                            {label}
                          </label>
                          {!connected && <span className="text-xs text-muted-foreground">Not connected</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 max-w-md">
                <Label htmlFor="schedule-at" className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4" />
                  Schedule for
                </Label>
                <Input
                  id="schedule-at"
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  disabled={scheduling || publishing}
                />
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  type="button"
                  onClick={() => void handlePublishNow()}
                  disabled={publishing || scheduling}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {publishing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Publish Now
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleSchedulePost()}
                  disabled={scheduling || publishing}
                >
                  {scheduling ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CalendarClock className="w-4 h-4 mr-2" />
                  )}
                  Schedule
                </Button>
                <span className="hidden sm:inline text-muted-foreground text-sm px-1">·</span>
                <Button type="button" variant="outline" onClick={handleCopyPublishBlock}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy caption + tags
                </Button>
                <Button type="button" variant="outline" onClick={handleSavePack} disabled={savingPack}>
                  {savingPack ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Pack
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setStep(2)} className="text-muted-foreground">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to slides
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Slide previews</CardTitle>
              <CardDescription>These frames are used when publishing to Instagram (same look as Export Pack).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto pb-4">
                <div className="flex gap-6" style={{ minWidth: "min-content" }}>
                  {slides.map((slide, index) => (
                    <div key={index} className="flex justify-center shrink-0">
                      <SlidePreview
                        ref={(el) => {
                          publishSlideRefs.current[index] = el;
                        }}
                        slide={slide}
                        brandPrimary={brandPrimary}
                        brandSecondary={brandSecondary}
                        fontStyle={fontStyle}
                        brandName={brandName.trim() || "Content Flywheel"}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
