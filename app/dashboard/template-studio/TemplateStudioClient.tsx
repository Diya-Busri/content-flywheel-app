"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
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
} from "lucide-react";
import { getTemplateStudioPrefill, clearTemplateStudioPrefill } from "@/lib/template-studio-prefill";
import { setVideoPrefill, getTimelineUrl } from "@/lib/video-prefill";
import { SlideDeck } from "./SlideDeck";
import { SlidePreview } from "./SlidePreview";
import { parseCharacterTypes } from "@/lib/ai-story-character-style";
import { getPrimaryCharacterTypeForScene } from "@/lib/ai-story-reference-image";
import { BGM_SELECT_OPTIONS, type BgmSelectValue } from "@/lib/bgm-tracks";
import { SatisfyingBuildSetup } from "@/components/templates/SatisfyingBuildSetup";
import { AiStorySceneVoiceover } from "@/components/ai-story/AiStorySceneVoiceover";
import { AiStoryAnimateSceneBlock } from "@/components/ai-story/AiStoryAnimateSceneBlock";
import {
  CREATION_MODE_OPTIONS,
  TEMPLATE_STUDIO_STORY_GENERATE_ROUTES,
  type CreationMode,
  type TemplateStudioStoryTemplateId,
} from "./template-studio-shared";
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
const TIMELINE_SCENE_DURATION = 5;
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
  voiceoverUrls: Record<number, string>
): { scenes: unknown[]; captions: unknown[]; totalDuration: number } {
  const scenes = aiStoryScenes.map((scene, i) => {
    const duration = TIMELINE_SCENE_DURATION;
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
}): string {
  const ep = params.episodeNumber >= 1 ? params.episodeNumber : 1;
  if (params.mode === "8") {
    const wb = params.whatBuilding.trim();
    const base = wb
      ? `Satisfying Build - ${wb.slice(0, 70)}${wb.length > 70 ? "…" : ""} - Episode ${ep}`
      : `Satisfying Build - Episode ${ep}`;
    return base.length > MAX_LIBRARY_TITLE_LEN
      ? `${base.slice(0, MAX_LIBRARY_TITLE_LEN - 1)}…`
      : base;
  }
  const storyTitle = params.theme.trim() || "Story";
  const st = storyTitle.length > 60 ? `${storyTitle.slice(0, 59)}…` : storyTitle;
  const base = `AI Story - ${st} - Episode ${ep}`;
  return base.length > MAX_LIBRARY_TITLE_LEN
    ? `${base.slice(0, MAX_LIBRARY_TITLE_LEN - 1)}…`
    : base;
}

export default function TemplateStudioClient() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<CreationMode>("1");
  const [brandName, setBrandName] = useState("");
  const [niche, setNiche] = useState("");
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
  const [satisfyingCharacterType, setSatisfyingCharacterType] = useState("Person");
  const [whatBuilding, setWhatBuilding] = useState("");
  const [satisfyingBuildStyle, setSatisfyingBuildStyle] = useState("Miniature Construction");
  const [satisfyingBuildTone, setSatisfyingBuildTone] = useState("Satisfying");
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

  const [storyVideoExporting, setStoryVideoExporting] = useState(false);
  const [storyVideoExportPhase, setStoryVideoExportPhase] = useState<"saving" | "compiling" | null>(null);
  const [storyVideoExportUrl, setStoryVideoExportUrl] = useState<string | null>(null);
  const [storyVideoExportScriptId, setStoryVideoExportScriptId] = useState<string | null>(null);
  const [storyVideoExportError, setStoryVideoExportError] = useState<string | null>(null);
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
    mode === "7" ? "ai_story" : mode === "8" ? "satisfying_build" : undefined;
  const isStoryTemplateMode = mode === "7" || mode === "8";
  const isAiStoryMode = mode === "7";

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
    mode === "7"
      ? characters.trim().length > 0 && theme.trim().length > 0
      : mode === "8"
        ? satisfyingCharacterType.trim().length > 0 && whatBuilding.trim().length > 0
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
            : TEMPLATE_STUDIO_STORY_GENERATE_ROUTES.satisfying_build;
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
              : {
                  character_type: satisfyingCharacterType,
                  what_building: whatBuilding.trim(),
                  build_style: satisfyingBuildStyle,
                  tone: satisfyingBuildTone,
                  episode_number: episodeForApi,
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
              sourceType: mode === "8" ? "satisfying-build" : "ai-story",
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
          title: mode === "8" ? "Satisfying Build generated" : "AI Story generated",
          description: `${scenesList.length} scenes ready.`,
        });
        return true;
      } catch (e) {
        toast({
          title: mode === "8" ? "Satisfying Build failed" : "AI Story failed",
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
          : {
              characters: satisfyingCharacterType,
              characterNames: "",
              theme: whatBuilding.trim(),
              tone: satisfyingBuildTone,
              style: satisfyingBuildStyle,
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
  ]);

  /** SessionStorage prefill for /dashboard/video-timeline (must run before navigation). */
  const writeAiStoryTimelinePrefill = useCallback(() => {
    if (!isStoryTemplateMode || aiStoryScenes.length === 0) return;
    const timelineScenes = aiStoryScenes.map((scene) => ({
      scene_number: scene.sceneNumber,
      duration_seconds: TIMELINE_SCENE_DURATION,
      imageUrl: sceneImageUrls[scene.sceneNumber] ?? undefined,
      videoUrl: sceneVideoUrls[scene.sceneNumber] ?? undefined,
      audioUrl: voiceoverUrls[scene.sceneNumber] ?? undefined,
      captionText: scene.dialogue?.trim() || undefined,
    }));
    setVideoPrefill({
      source: "template-studio",
      title: mode === "8" ? "Satisfying Build" : "AI Story",
      timelineScenes,
    });
  }, [isStoryTemplateMode, mode, aiStoryScenes, sceneImageUrls, sceneVideoUrls, voiceoverUrls]);

  /** Ensure My Library draft row has latest per-scene audioUrl before timeline GET (avoids race with debounced PATCH). */
  const flushAiStoryDraftToLibrary = useCallback(async (): Promise<boolean> => {
    if (!libraryDraftVideoId || !isStoryTemplateMode || aiStoryScenes.length === 0) return true;
    const { scenes, captions, totalDuration } = buildTimelineContentFromAiStory(
      aiStoryScenes,
      sceneImageUrls,
      sceneVideoUrls,
      voiceoverUrls
    );
    try {
      const res = await fetch(`/api/video-timeline/videos/${encodeURIComponent(libraryDraftVideoId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: {
            scenes,
            captions,
            totalDuration,
            sourceType: "ai-story",
            savedAt: new Date().toISOString(),
            ...(Object.keys(characterReferenceUrls).length > 0
              ? { aiStoryCharacterReferenceUrls: characterReferenceUrls }
              : {}),
          },
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
    voiceoverUrls,
    characterReferenceUrlsSerializeKey,
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
    if (!isStoryTemplateMode || step !== 1 || aiStoryScenes.length !== AI_STORY_SCENE_COUNT) return false;
    return aiStoryScenes.every((s) => {
      const v = sceneVideoUrls[s.sceneNumber];
      const vo = voiceoverUrls[s.sceneNumber];
      const hasVideo = isHttpUrl(v);
      if (!voiceoverEnabled) return hasVideo;
      return hasVideo && isHttpUrl(vo);
    });
  }, [isStoryTemplateMode, step, aiStoryScenes, sceneVideoUrls, voiceoverUrls, voiceoverEnabled]);

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
        const voiceover_url = voiceoverUrls[scene.sceneNumber]?.trim() ?? null;
        const dialogue = scene.dialogue?.trim() ?? "";
        return {
          scene_number: scene.sceneNumber,
          duration: TIMELINE_SCENE_DURATION,
          script_text: dialogue,
          image_url: image_url && isHttpUrl(image_url) ? image_url : null,
          video_url: video_url && isHttpUrl(video_url) ? video_url : null,
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
          title:
            mode === "8"
              ? `Satisfying Build — Episode ${episodeNumber}`
              : `AI Story — Episode ${episodeNumber}`,
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
    episodeNumber,
    flushAiStoryDraftToLibrary,
    libraryDraftVideoId,
    mode,
    sceneImageUrls,
    sceneVideoUrls,
    storyBackgroundMusic,
    toast,
    voiceoverUrls,
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
        if (data.mode && ["1", "2", "3", "4", "5", "6", "7", "8"].includes(data.mode)) {
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
      voiceoverUrls
    );
    const metadata = {
      scenes,
      captions,
      totalDuration,
      sourceType: "ai-story" as const,
      savedAt: new Date().toISOString(),
      ...(Object.keys(characterReferenceUrls).length > 0
        ? { aiStoryCharacterReferenceUrls: characterReferenceUrls }
        : {}),
    };

    let cancelled = false;
    setLibraryDraftSaving(true);
    if (libraryDraftVideoId) {
      fetch(`/api/video-timeline/videos/${encodeURIComponent(libraryDraftVideoId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata }),
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
          title: mode === "8" ? "Satisfying Build (Draft)" : "AI Story (Draft)",
          content: {
            scenes,
            captions,
            totalDuration,
            sourceType: "ai-story",
          },
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

  useEffect(() => {
    if (!voiceoverEnabled || !isStoryTemplateMode || aiStoryScenes.length === 0 || elevenLabsVoices.length > 0) return;
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
  }, [voiceoverEnabled, isStoryTemplateMode, aiStoryScenes.length, elevenLabsVoices.length]);

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
      if (
        next !== mode &&
        (next === "7" || next === "8" || mode === "7" || mode === "8")
      ) {
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
      setMode(next);
    },
    [mode]
  );

  return (
    <div className="space-y-8">
      {/* Step indicator */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
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
              Choose what you&apos;re creating, then fill in the fields. Your choices are saved so you can regenerate later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>What are you creating this for?</Label>
              <Select
                value={mode}
                onValueChange={(v) => handleCreationModeChange(v as CreationMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREATION_MODE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-row items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="voiceover-enabled" className="text-base">
                  Voiceover
                </Label>
                <p className="text-xs text-muted-foreground">
                  Turn off to hide voice generation and audio on story scene cards.
                </p>
              </div>
              <Switch
                id="voiceover-enabled"
                checked={voiceoverEnabled}
                onCheckedChange={setVoiceoverEnabled}
                aria-label="Enable voiceover for story scenes"
              />
            </div>

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
                  <Label>Template type</Label>
                  <Select
                    value={templateType}
                    onValueChange={(v) => setTemplateType(v as TemplateType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <div className="space-y-2">
                  <Label htmlFor="episodeNumber">Episode number</Label>
                  <Input
                    id="episodeNumber"
                    type="number"
                    min={1}
                    value={episodeNumber}
                    onChange={(e) => setEpisodeNumber(Number(e.target.value) || 1)}
                  />
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
                episodeNumber={episodeNumber}
                setEpisodeNumber={setEpisodeNumber}
              />
            )}

            {!isStoryTemplateMode && (
              <>
            <div className="space-y-2">
              <Label>Number of slides</Label>
              <Select
                value={mode === "5" ? String(slideCountViral) : String(slideCount)}
                onValueChange={(v) => {
                  const n = Number(v);
                  if (mode === "5") {
                    if ([5, 6, 7, 8, 9, 10].includes(n)) setSlideCountViral(n as 5 | 6 | 7 | 8 | 9 | 10);
                  } else {
                    if ([5, 10, 20].includes(n)) setSlideCount(n as 5 | 10 | 20);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mode === "5"
                    ? SLIDE_COUNT_VIRAL_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} slides
                        </SelectItem>
                      ))
                    : SLIDE_COUNT_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} slides
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
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
              <Label>Font style</Label>
              <Select
                value={fontStyle}
                onValueChange={(v) => setFontStyle(v as FontStyle)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
              </>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              {isAiStoryMode && aiStoryScenes.length === 0 && aiStoryUiPhase === "characterPreview" ? (
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
                    } else if (mode === "8") {
                      await runGenerateAiStory();
                    } else {
                      await saveSetup();
                      setStep(2);
                    }
                  }}
                  disabled={
                    !canProceedStep1 ||
                    (isAiStoryMode && (aiStoryLoading || characterPreviewLoading)) ||
                    (mode === "8" && aiStoryLoading)
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
                      : "Next — Generate content"}
                  {(isAiStoryMode && (aiStoryLoading || characterPreviewLoading)) ||
                  (mode === "8" && aiStoryLoading) ? (
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
                ~40-word visual seed prepended to every scene&apos;s image prompt. Regenerating a scene image reuses the full prompt below (including this lock).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                readOnly
                value={characterSeed}
                className="min-h-[100px] text-sm resize-none"
                aria-label="Character visual seed"
              />
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Scenes</CardTitle>
            <CardDescription>
              {mode === "8"
                ? "Generated scenes for your Satisfying Build."
                : "Generated scenes for your AI Story."}
            </CardDescription>
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
                return (
                <Card key={scene.sceneNumber}>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm">Scene {scene.sceneNumber}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-2 text-sm">
                    {sceneImageUrl ? (
                      <img src={sceneImageUrl} alt={`Scene ${scene.sceneNumber}`} className="w-full rounded-md object-cover aspect-square" />
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={imageLoading}
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

                          if (useImg2ImgSceneImages && refUrl) {
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
                            if (hasEmbeddedSeed) {
                              if (mode === "7") {
                                imageBody.aiStoryLocked = true;
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
                    {sceneImageUrl ? (
                      <AiStoryAnimateSceneBlock
                        imageUrl={sceneImageUrl}
                        motionPrompt={scene.motionPrompt || scene.imagePrompt}
                        videoUrl={sceneVideoUrl}
                        onVideoUrl={(url) =>
                          setSceneVideoUrls((prev) => ({ ...prev, [scene.sceneNumber]: url }))
                        }
                      />
                    ) : null}
                    <p className="font-medium">Dialogue</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{scene.dialogue}</p>
                    <p className="font-medium">Image prompt</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{scene.imagePrompt}</p>
                    {voiceoverEnabled && (
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
              {canExportStoryVideo && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Export story video</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      All {AI_STORY_SCENE_COUNT} scenes have animation
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
                    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 pt-1">
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

      {step === 2 && (
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
