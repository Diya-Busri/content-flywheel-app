"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
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
} from "lucide-react";

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

type PromptPlatform = "midjourney" | "chatgpt" | "grok";

function formatPromptForPlatform(
  rawPrompt: string,
  platform: PromptPlatform,
  characterRefUrl: string | null
): string {
  const hasRef = !!characterRefUrl?.trim();
  switch (platform) {
    case "midjourney":
      const mjSuffix = hasRef
        ? ` --cref ${characterRefUrl!.trim()} --cw 100 --ar 9:16`
        : " --ar 9:16";
      return rawPrompt.trim() + mjSuffix;
    case "chatgpt":
      return hasRef
        ? `Using the same character from my reference image: ${rawPrompt.trim()}`
        : rawPrompt.trim();
    case "grok":
      return hasRef
        ? `Keep the exact same character as the reference: ${rawPrompt.trim()}`
        : rawPrompt.trim();
    default:
      return rawPrompt.trim();
  }
}

import {
  ELEVENLABS_VOICES,
  VOICE_PREVIEW_TEXT,
  VOICEOVER_STORAGE_KEY,
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
  }>;
  editingSteps?: Record<string, string[]>;
  subtitleRecs?: { style?: string; font?: string; position?: string; animation?: string };
  musicRecs?: { mood?: string; sources?: string[]; volume?: string };
  exportSettings?: { resolution?: string; fps?: number; format?: string; fileSize?: string };
  platformTips?: string[];
};

type Props = {
  guide: VideoGuideData;
  scriptTitle?: string;
};

export default function VideoCreationGuide({ guide, scriptTitle }: Props) {
  const { toast } = useToast();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [voiceId, setVoiceId] = useState<string>(() => (typeof window !== "undefined" ? getDefaultVoiceId() : ELEVENLABS_VOICES[0].voiceId));
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.75);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [voiceoverMode, setVoiceoverMode] = useState<"full" | "scene">("full");
  const [fullVoiceoverUrl, setFullVoiceoverUrl] = useState<string | null>(null);
  const [perSceneUrls, setPerSceneUrls] = useState<(string | null)[]>([]);
  const [generatingFull, setGeneratingFull] = useState(false);
  const [generatingPerScene, setGeneratingPerScene] = useState(false);
  const [generatingSceneIndex, setGeneratingSceneIndex] = useState<number | null>(null);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [characterRefPreviewUrl, setCharacterRefPreviewUrl] = useState<string | null>(null);
  const [characterRefPublicUrl, setCharacterRefPublicUrl] = useState<string | null>(null);
  const [copyFormatByScene, setCopyFormatByScene] = useState<Record<number, PromptPlatform>>({});
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDefaultVoiceId(voiceId);
  }, [voiceId]);

  const script = guide.script;
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
    const refUrl = characterRefPublicUrl?.trim() || null;
    const lines = scenes.map((s, i) => {
      const raw = getSceneFullPrompt(s);
      return formatPromptForPlatform(raw, "midjourney", refUrl);
    });
    copyToClipboard(lines.join("\n\n---\n\n"), "All prompts (Midjourney)");
  }, [scenes, getSceneFullPrompt, characterRefPublicUrl, copyToClipboard]);

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

  const handleSocialKitUploadProof = useCallback(async () => {
    if (!socialKitProofFile) {
      toast({ title: "Select a file", description: "Upload a screenshot or video preview.", variant: "destructive" });
      return;
    }
    setSocialKitLoading(true);
    try {
      const form = new FormData();
      form.append("file", socialKitProofFile);
      form.append("scriptHook", script.hook);
      form.append("scriptBody", script.body);
      form.append("scriptCta", script.cta);
      form.append("productName", guide.productName ?? "Your product");
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
  }, [socialKitProofFile, script, guide, toast]);

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
  }, []);

  const copyFullScript = useCallback(() => {
    const text = `Hook:\n${script.hook}\n\nBody:\n${script.body}\n\nCTA:\n${script.cta}`;
    copyToClipboard(text, "Full script");
  }, [script, copyToClipboard]);

  const fullScriptText = `${script.hook}\n\n${script.body}\n\n${script.cta}`;

  const getSceneTexts = useCallback((): string[] => {
    const n = scenes.length;
    if (n === 0) return [];
    const overlayTexts = scenes.map((s) => {
      const raw = (s as { textOverlay?: unknown }).textOverlay;
      if (raw == null) return null;
      const objs: TextOverlayObj[] = typeof raw === "string" ? [{ exactText: raw }] : Array.isArray(raw) ? (raw as TextOverlayObj[]) : [raw as TextOverlayObj];
      const t = objs.map((o) => o.exactText).filter(Boolean).join(" ");
      return t || null;
    });
    if (overlayTexts.every(Boolean)) {
      return overlayTexts as string[];
    }
    if (n === 1) return [fullScriptText];
    if (n === 2) return [script.hook, script.cta];
    const parts: string[] = [script.hook];
    const numBodyScenes = n - 2;
    const bodyParas = script.body.split(/\n\n+/).filter(Boolean);
    const chunkSize = Math.max(1, Math.ceil((bodyParas.length || 1) / numBodyScenes));
    for (let i = 0; i < numBodyScenes; i++) {
      parts.push(bodyParas.slice(i * chunkSize, (i + 1) * chunkSize).join("\n\n") || script.body);
    }
    parts.push(script.cta);
    return parts;
  }, [scenes, script, fullScriptText]);

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
    if (fullVoiceoverUrl) URL.revokeObjectURL(fullVoiceoverUrl);
    setFullVoiceoverUrl(null);
    try {
      const blob = await generateVoiceover(fullScriptText);
      const url = URL.createObjectURL(blob);
      setFullVoiceoverUrl(url);
      toast({ title: "Voiceover ready", description: "Full script audio generated." });
    } catch (e) {
      toast({
        title: "Voiceover failed",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setGeneratingFull(false);
    }
  }, [fullScriptText, generateVoiceover, toast, fullVoiceoverUrl]);

  const handleGeneratePerSceneVoiceover = useCallback(async () => {
    const texts = getSceneTexts();
    if (texts.length === 0 || texts.every((t) => !t?.trim())) {
      toast({ title: "No scene text", variant: "destructive" });
      return;
    }
    setGeneratingPerScene(true);
    setPerSceneUrls((prev) => {
      prev.forEach((u) => u && URL.revokeObjectURL(u));
      return texts.map(() => null);
    });
    try {
      const urls: (string | null)[] = [];
      for (let i = 0; i < texts.length; i++) {
        setGeneratingSceneIndex(i);
        try {
          const blob = await generateVoiceover(texts[i]);
          urls.push(URL.createObjectURL(blob));
        } catch {
          urls.push(null);
        }
      }
      setPerSceneUrls(urls);
      const ok = urls.filter(Boolean).length;
      toast({ title: "Scene voiceovers ready", description: `${ok} of ${texts.length} clips generated.` });
    } catch (e) {
      toast({
        title: "Voiceover failed",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setGeneratingPerScene(false);
      setGeneratingSceneIndex(null);
    }
  }, [getSceneTexts, generateVoiceover, toast]);

  const handleRegenerateVoiceover = useCallback(() => {
    if (fullVoiceoverUrl) URL.revokeObjectURL(fullVoiceoverUrl);
    setFullVoiceoverUrl(null);
    perSceneUrls.forEach((u) => u && URL.revokeObjectURL(u));
    setPerSceneUrls([]);
    if (voiceoverMode === "full") {
      handleGenerateFullVoiceover();
    } else {
      handleGeneratePerSceneVoiceover();
    }
  }, [voiceoverMode, fullVoiceoverUrl, perSceneUrls, handleGenerateFullVoiceover, handleGeneratePerSceneVoiceover]);

  const downloadGuide = useCallback(() => {
    const lines: string[] = [];
    lines.push("VIDEO CREATION GUIDE");
    if (guide.productName) lines.push(`Product: ${guide.productName}`);
    lines.push("");
    lines.push("SCRIPT");
    lines.push(`Hook: ${script.hook}`);
    lines.push(`Body: ${script.body}`);
    lines.push(`CTA: ${script.cta}`);
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
    a.download = `video-guide-${(scriptTitle ?? guide.productName ?? "guide").replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: "Full guide saved" });
  }, [
    guide.productName,
    script,
    scenes,
    getSceneFullPrompt,
    editingSteps,
    subtitles,
    music,
    exportSettings,
    platformTips,
    scriptTitle,
    toast,
  ]);

  return (
    <main className="min-h-screen bg-[#0F0F0F] text-white p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/dashboard/digital-products/results"
          className="inline-flex items-center gap-2 text-sm text-[#A0A0A0] hover:text-orange-500 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Results
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Video Creation Guide</h1>
            <p className="text-[#A0A0A0]">
              {guide.overview ?? "Multi-platform video marketing guide."}
              {guide.productName && (
                <>
                  {" "}
                  <span className="text-white font-medium">{guide.productName}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-[#2A2A2A] text-[#A0A0A0] hover:bg-[#2A2A2A] hover:text-white"
              onClick={copyAllPrompts}
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Copy All AI Prompts
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-[#2A2A2A] text-[#A0A0A0] hover:bg-[#2A2A2A] hover:text-white"
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

        <Card className="mb-8 border-[#2A2A2A] bg-[#1A1A1A]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-white flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-500" />
                Full Script
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#2A2A2A] text-[#A0A0A0] hover:bg-[#2A2A2A] hover:text-white"
                  onClick={handleGenerateFullVoiceover}
                  disabled={generatingFull || !fullScriptText.trim()}
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
                  className="border-[#2A2A2A] text-[#A0A0A0] hover:bg-[#2A2A2A] hover:text-white"
                  onClick={copyFullScript}
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copy Script
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-[#B0B0B0] whitespace-pre-line">
            <div>
              <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-1">Hook</p>
              <p className="text-white">{script.hook}</p>
            </div>
            <div>
              <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-1">Body</p>
              <p className="text-white">{script.body}</p>
            </div>
            <div>
              <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-1">CTA</p>
              <p className="text-white">{script.cta}</p>
            </div>
            {fullVoiceoverUrl && (
              <div className="pt-2 border-t border-[#2A2A2A]">
                <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-2">Generated voiceover</p>
                <div className="flex flex-wrap items-center gap-2">
                  <AudioWithSpeed src={fullVoiceoverUrl} speed={playbackSpeed} controls className="max-w-full h-9 flex-1 min-w-0" />
                  <Button variant="outline" size="sm" className="border-[#2A2A2A] text-[#A0A0A0] shrink-0" asChild>
                    <a href={fullVoiceoverUrl} download="voiceover-full.mp3">Download</a>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="scenes" className="w-full">
          <TabsList className="bg-[#1A1A1A] border border-[#2A2A2A] flex flex-wrap gap-1 p-1">
            <TabsTrigger value="scenes" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs">
              Scene Breakdown
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
            <Card className="border-[#2A2A2A] bg-[#1A1A1A]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-white flex items-center gap-2">
                  <ImagePlus className="w-4 h-4 text-orange-500" />
                  Character Setup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-[#B0B0B0]">
                  Use the same reference image across all scenes for consistent characters. Works best with Midjourney (--cref) and ChatGPT.
                </p>
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleCharacterRefFile}
                  />
                  <div className="border-2 border-dashed border-[#2A2A2A] rounded-lg p-6 text-center hover:border-orange-500/50 transition-colors cursor-pointer bg-[#0F0F0F]">
                    <ImagePlus className="w-10 h-10 mx-auto text-[#A0A0A0] mb-2" />
                    <p className="text-sm text-[#A0A0A0]">Upload your character reference image</p>
                    <p className="text-xs text-[#6A6A6A] mt-1">PNG, JPG or WebP</p>
                  </div>
                </label>
                {characterRefPreviewUrl && (
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="relative rounded-lg overflow-hidden border border-[#2A2A2A] bg-[#0F0F0F] w-24 h-24 shrink-0">
                      <img
                        src={characterRefPreviewUrl}
                        alt="Character reference"
                        className="w-full h-full object-cover"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-0 right-0 h-6 w-6 rounded-bl bg-black/60 text-white hover:bg-black/80"
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
                          className="mt-1 w-full rounded-md bg-[#0F0F0F] border border-[#2A2A2A] px-3 py-2 text-sm text-white placeholder:text-[#6A6A6A] focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                      </label>
                      <p className="text-xs text-[#6A6A6A]">Host your image (e.g. Discord, imgur) and paste the direct image URL here for --cref.</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pro tip */}
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3">
              <Lightbulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-200/90 space-y-2">
                <p className="font-medium text-amber-100">Pro tip: Generate your main character first, then use that image as a reference for all scenes.</p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-200/80">
                  <li><strong>Midjourney:</strong> Use --cref flag (best consistency)</li>
                  <li><strong>ChatGPT:</strong> Upload reference image in each prompt</li>
                  <li><strong>Grok:</strong> Upload reference and ask to maintain character</li>
                </ul>
              </div>
            </div>

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
                <Card key={i} className="border-[#2A2A2A] bg-[#1A1A1A]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium text-white flex items-center justify-between gap-2 flex-wrap">
                      <span>Scene {i + 1} · {scene.timing}</span>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Select
                          value={getCopyFormat(i)}
                          onValueChange={(v) => setCopyFormatByScene((prev) => ({ ...prev, [i]: v as PromptPlatform }))}
                        >
                          <SelectTrigger className="w-[120px] h-8 border-[#2A2A2A] text-[#A0A0A0] bg-[#0F0F0F] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1A1A1A] border-[#2A2A2A]">
                            <SelectItem value="midjourney" className="text-sm">Midjourney</SelectItem>
                            <SelectItem value="chatgpt" className="text-sm">ChatGPT</SelectItem>
                            <SelectItem value="grok" className="text-sm">Grok</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-[#2A2A2A] text-[#A0A0A0] hover:bg-[#2A2A2A]"
                          onClick={() => {
                            const platform = getCopyFormat(i);
                            const refUrl = characterRefPublicUrl?.trim() || null;
                            const formatted = formatPromptForPlatform(fullPrompt, platform, refUrl);
                            copyToClipboard(formatted, "AI prompt");
                            setCopiedIndex(i);
                            setTimeout(() => setCopiedIndex(null), 2000);
                          }}
                        >
                          {copiedIndex === i ? "Copied" : "Copy AI Prompt"}
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-[#B0B0B0]">
                    <div>
                      <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-1">Visual / AI image prompt</p>
                      <p className="text-white whitespace-pre-wrap">{fullPrompt}</p>
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
                            <p className="text-white">{obj.exactText ?? ""}</p>
                            {(obj.fontStyle || obj.size || obj.position || obj.color || obj.animation || obj.timingNote) && (
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[#A0A0A0]">
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
            <Card className="border-[#2A2A2A] bg-[#1A1A1A]">
              <CardHeader>
                <CardTitle className="text-base font-medium text-white flex items-center gap-2">
                  <Film className="w-4 h-4 text-orange-500" />
                  Recommended tools & steps
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(editingSteps).map(([tool, steps]) => (
                  <div key={tool}>
                    <p className="text-orange-500 font-medium text-sm mb-2">{tool}</p>
                    <ul className="list-disc list-inside text-sm text-[#B0B0B0] space-y-1">
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
            <Card className="border-[#2A2A2A] bg-[#1A1A1A]">
              <CardHeader>
                <CardTitle className="text-base font-medium text-white flex items-center gap-2">
                  <Type className="w-4 h-4 text-orange-500" />
                  Subtitles & text
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-[#B0B0B0]">
                <p><span className="text-white">Style:</span> {subtitles.style ?? "—"}</p>
                <p><span className="text-white">Font:</span> {subtitles.font ?? "—"}</p>
                <p><span className="text-white">Position:</span> {subtitles.position ?? "—"}</p>
                <p><span className="text-white">Animation:</span> {subtitles.animation ?? "—"}</p>
                <p className="text-xs text-[#A0A0A0] mt-2">Use CapCut: Edit → Captions → Auto Captions for word-by-word sync.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="music" className="mt-6 space-y-4">
            <Card className="border-[#2A2A2A] bg-[#1A1A1A]">
              <CardHeader>
                <CardTitle className="text-base font-medium text-white flex items-center gap-2">
                  <Music className="w-4 h-4 text-orange-500" />
                  Music & audio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-[#B0B0B0]">
                <p><span className="text-white">Mood:</span> {music.mood ?? "—"}</p>
                <p><span className="text-white">Sources:</span> {Array.isArray(music.sources) ? music.sources.join(", ") : "—"}</p>
                <p><span className="text-white">Volume:</span> {music.volume ?? "—"}</p>
                <p className="text-xs text-[#A0A0A0] mt-2">Sync beat drops with scene transitions. Use TikTok Sounds for trending audio.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="export" className="mt-6 space-y-4">
            <Card className="border-[#2A2A2A] bg-[#1A1A1A]">
              <CardHeader>
                <CardTitle className="text-base font-medium text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-orange-500" />
                  Export settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-[#B0B0B0]">
                <p><span className="text-white">Resolution:</span> {exportSettings.resolution ?? "—"}</p>
                <p><span className="text-white">FPS:</span> {exportSettings.fps ?? "—"}</p>
                <p><span className="text-white">Format:</span> {exportSettings.format ?? "—"}</p>
                <p><span className="text-white">File size:</span> {(exportSettings as { fileSize?: string }).fileSize ?? "—"}</p>
              </CardContent>
            </Card>
            {platformTips.length > 0 && (
              <Card className="border-[#2A2A2A] bg-[#1A1A1A]">
                <CardHeader>
                  <CardTitle className="text-base font-medium text-white flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-orange-500" />
                    Platform tips
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside text-sm text-[#B0B0B0] space-y-1">
                    {platformTips.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="social-kit" className="mt-6 space-y-4">
            {!socialKit ? (
              <Card className="border-[#2A2A2A] bg-[#1A1A1A]">
                <CardContent className="pt-6 pb-6">
                  <div className="flex flex-col items-center text-center max-w-md mx-auto">
                    <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
                      <Lock className="w-8 h-8 text-amber-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Upload proof to unlock</h3>
                    <p className="text-[#A0A0A0] text-sm mb-2">
                      Upload a screenshot or video preview to unlock your Social Media Kit
                    </p>
                    <p className="text-[#6A6A6A] text-xs mb-6">
                      We want to make sure you&apos;ve created your video before optimizing your social media presence.
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
                        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors bg-[#0F0F0F] ${
                          socialKitProofFile ? "border-orange-500/50" : "border-[#2A2A2A] hover:border-orange-500/50"
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
                        <Upload className="w-10 h-10 mx-auto text-[#A0A0A0] mb-2" />
                        <p className="text-sm text-[#A0A0A0]">
                          {socialKitProofFile ? socialKitProofFile.name : "Drag and drop or click to upload"}
                        </p>
                        <p className="text-xs text-[#6A6A6A] mt-1">PNG, JPG, MP4 or MOV</p>
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
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#2A2A2A] text-[#A0A0A0] hover:bg-[#2A2A2A]"
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
                    className="border-[#2A2A2A] text-[#A0A0A0] hover:bg-[#2A2A2A]"
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
                  <Card key={section.key} className="border-[#2A2A2A] bg-[#1A1A1A]">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-medium text-white flex items-center gap-2">
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
                              className="h-7 text-[#A0A0A0] hover:text-white shrink-0"
                              onClick={() => copyToClipboard(item.value ?? "", item.label)}
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              Copy
                            </Button>
                          </div>
                          <p className="text-sm text-[#B0B0B0] whitespace-pre-wrap">{item.value || "—"}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="voiceover" className="mt-6 space-y-4">
            <Card className="border-[#2A2A2A] bg-[#1A1A1A]">
              <CardHeader>
                <CardTitle className="text-base font-medium text-white flex items-center gap-2">
                  <Mic className="w-4 h-4 text-orange-500" />
                  AI Voiceover (ElevenLabs)
                </CardTitle>
                <CardDescription className="text-[#A0A0A0]">
                  Choose a voice, adjust style, then generate. Your last selected voice is saved as default.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Voice selection grid by category */}
                <div>
                  <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-3">Voice selection</p>
                  {(["Female", "Male", "Character"] as const).map((cat) => {
                    const list = ELEVENLABS_VOICES.filter((v) => v.category === cat);
                    if (list.length === 0) return null;
                    return (
                      <div key={cat} className="mb-6 last:mb-0">
                        <p className="text-xs text-[#A0A0A0] mb-2">{cat}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {list.map((v) => {
                            const selected = voiceId === v.voiceId;
                            const loading = previewingVoiceId === v.voiceId;
                            return (
                              <div
                                key={v.voiceId}
                                className={`rounded-lg border-2 p-3 flex items-center justify-between gap-2 ${
                                  selected
                                    ? "border-orange-500 bg-orange-500/10"
                                    : "border-[#2A2A2A] bg-[#0F0F0F] hover:border-[#3A3A3A]"
                                }`}
                              >
                                <button
                                  type="button"
                                  className="flex-1 min-w-0 text-left"
                                  onClick={() => setVoiceId(v.voiceId)}
                                >
                                  <span className="block font-medium text-white text-sm">{v.name}</span>
                                  <span className="block text-xs text-[#A0A0A0]">{v.description}</span>
                                </button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-[#2A2A2A] text-[#A0A0A0] shrink-0 h-8 w-8 p-0"
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
                    );
                  })}
                </div>

                {/* Generation mode */}
                <div>
                  <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-2">Generation mode</p>
                  <div className="flex rounded-lg border border-[#2A2A2A] p-1 bg-[#0F0F0F] w-full max-w-md">
                    <button
                      type="button"
                      className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                        voiceoverMode === "full"
                          ? "bg-orange-500 text-white"
                          : "text-[#A0A0A0] hover:text-white"
                      }`}
                      onClick={() => setVoiceoverMode("full")}
                    >
                      Full Script
                    </button>
                    <button
                      type="button"
                      className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                        voiceoverMode === "scene"
                          ? "bg-orange-500 text-white"
                          : "text-[#A0A0A0] hover:text-white"
                      }`}
                      onClick={() => setVoiceoverMode("scene")}
                    >
                      Scene by Scene
                    </button>
                  </div>
                  <p className="text-xs text-[#A0A0A0] mt-1">
                    {voiceoverMode === "full" ? "One audio file for Hook + Body + CTA." : "Separate clips per scene with individual play/download."}
                  </p>
                </div>

                {/* Speed / Stability / Clarity */}
                <div className="space-y-4">
                  <p className="text-orange-500 font-medium text-xs uppercase tracking-wide">Speed &amp; style</p>
                  <div>
                    <p className="text-sm text-[#B0B0B0] mb-1">Speaking speed (playback): {(playbackSpeed * 100) / 100}x</p>
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
                    <p className="text-sm text-[#B0B0B0] mb-1">Stability: {Math.round(stability * 100)}%</p>
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
                    <p className="text-sm text-[#B0B0B0] mb-1">Clarity: {Math.round(similarity * 100)}%</p>
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

                {/* Generate / Regenerate */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
                    onClick={voiceoverMode === "full" ? handleGenerateFullVoiceover : handleGeneratePerSceneVoiceover}
                    disabled={
                      (voiceoverMode === "full" ? generatingFull : generatingPerScene) ||
                      (voiceoverMode === "full" ? !fullScriptText.trim() : getSceneTexts().length === 0)
                    }
                  >
                    {(voiceoverMode === "full" ? generatingFull : generatingPerScene) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                    {voiceoverMode === "full" ? "Generate Full Voiceover" : "Generate Scene by Scene"}
                  </Button>
                  {(fullVoiceoverUrl || perSceneUrls.some(Boolean)) && (
                    <Button
                      variant="outline"
                      className="border-[#2A2A2A] text-[#A0A0A0] hover:bg-[#2A2A2A] gap-2"
                      onClick={handleRegenerateVoiceover}
                      disabled={generatingFull || generatingPerScene}
                    >
                      <RefreshCw className="w-4 h-4" />
                      Regenerate
                    </Button>
                  )}
                </div>

                {/* Full script result */}
                {fullVoiceoverUrl && (
                  <div>
                    <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-2">Full script audio</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <AudioWithSpeed src={fullVoiceoverUrl} speed={playbackSpeed} controls className="max-w-full h-9" />
                      <Button variant="outline" size="sm" className="border-[#2A2A2A] text-[#A0A0A0]" asChild>
                        <a href={fullVoiceoverUrl} download="voiceover-full.mp3">Download</a>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Per-scene results */}
                {perSceneUrls.length > 0 && (
                  <div>
                    <p className="text-orange-500 font-medium text-xs uppercase tracking-wide mb-2">Per-scene clips</p>
                    <div className="space-y-3">
                      {perSceneUrls.map((url, i) =>
                        url ? (
                          <div key={i} className="flex flex-wrap items-center gap-3 rounded-lg bg-[#0F0F0F] p-3">
                            <span className="text-sm text-[#A0A0A0] w-20">Scene {i + 1}</span>
                            <AudioWithSpeed src={url} speed={playbackSpeed} controls className="flex-1 min-w-0 max-w-md h-9" />
                            <Button variant="outline" size="sm" className="border-[#2A2A2A] text-[#A0A0A0] shrink-0" asChild>
                              <a href={url} download={`voiceover-scene-${i + 1}.mp3`}>Download</a>
                            </Button>
                          </div>
                        ) : generatingSceneIndex === i ? (
                          <div key={i} className="flex items-center gap-2 rounded-lg bg-[#0F0F0F] p-3">
                            <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                            <span className="text-sm text-[#A0A0A0]">Scene {i + 1}…</span>
                          </div>
                        ) : (
                          <div key={i} className="flex items-center gap-2 rounded-lg bg-[#0F0F0F] p-3">
                            <span className="text-sm text-[#A0A0A0]">Scene {i + 1} — failed or pending</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
