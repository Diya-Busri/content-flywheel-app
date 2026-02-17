"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Calendar,
  Copy,
  Download,
  FileText,
  Image,
  ImagePlus,
  Loader2,
  Music,
  Clapperboard,
  Sparkles,
  Target,
  Unlock,
  type LucideIcon,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VIDEO_GUIDE_PLATFORMS } from "@/lib/video-guide-platforms";
import { useToast } from "@/components/ui/use-toast";
import { jsPDF } from "jspdf";

export type SceneCreativeBrief = {
  scene: string;
  timing: string;
  visualDirection?: {
    aiPrompt?: string;
    cameraAngle?: string;
    lightingMood?: string;
    colorPalette?: string;
    mediaType?: string;
  };
  textOverlay?: {
    exactText?: string;
    fontStyle?: string;
    size?: string;
    position?: string;
    color?: string;
    animation?: string;
    timingNote?: string;
  };
  transition?: { toNextScene?: string; effects?: string; pacing?: string };
  audio?: { musicVolume?: string; beatDrops?: string; soundEffects?: string; mood?: string };
};

export type VideoGuideData = {
  script: { hook: string; body: string; cta: string };
  scenePrompts: { scene: string; timing: string; prompt: string }[];
  stockSuggestions: { scene: string; suggestion: string; note: string }[];
  editingSteps: Record<string, string[]>;
  subtitleRecs: { style: string; font: string; position: string; animation: string };
  musicRecs: { mood: string; sources: string[]; volume: string };
  exportSettings: { resolution: string; fps: number; format: string; fileSize: string };
  productName: string;
  /** TikTok storytelling framework used */
  storytellingFramework?: string;
  /** Why this framework fits the product */
  frameworkRationale?: string;
  /** Full creative brief per scene (visual, text overlay, transition, audio) */
  scenes?: SceneCreativeBrief[] | null;
  /** Engagement triggers for creators */
  engagementTriggers?: string[] | null;
  /** Selected target platforms */
  platforms?: string[];
  /** Platform-specific content per platform ID */
  platformGuides?: Record<string, PlatformGuide> | null;
  /** Content calendar (day, actions) */
  contentCalendar?: Array<{ day: number; actions: string }>;
  /** Repurposing guide steps */
  repurposingGuide?: string[];
  /** Thumbnail guide (for YouTube long-form) */
  thumbnailGuide?: string | null;
};

export type PlatformGuide = {
  adaptedScript?: { hook?: string; body?: string; cta?: string };
  aiPromptHint?: string;
  platformNotes?: string;
  postingStrategy?: string;
  captionTemplate?: string;
  engagementStrategy?: string;
  exportSettings?: string;
  // X (Twitter) — threads + tweets
  tweetThread?: string[];
  tweetVariations?: string[];
  firstTweetImagePrompt?: string;
  quoteTweetGuide?: string;
  // LinkedIn — text posts + image
  linkedInPost?: { hook?: string; body?: string; takeaways?: string; cta?: string };
  linkedInCarouselOption?: string;
  imageDirection?: string;
  algorithmGuide?: string;
  // Pinterest — pins
  pinDesignDirection?: string;
  pinTitleVariations?: string[];
  pinDescription?: string;
  boardNameSuggestions?: string[];
  pinterestSeoGuide?: string;
  ideaPinsOption?: string;
  // Facebook — Reels + Groups
  facebookGroupPost?: { hookQuestion?: string; body?: string; cta?: string };
  facebookGroupsGuide?: string;
  marketplaceGuide?: string;
  // Instagram — Reels + carousel + stories
  instagramCarouselGuide?: string;
  instagramStorySequence?: string;
};

const EDITING_PLATFORMS = ["CapCut", "InShot", "Filmora", "Canva"] as const;

function CopyButton({ text, label }: { text: string; label?: string }) {
  const { toast } = useToast();
  const copy = () => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast({ title: "Copied", description: label ? `${label} copied to clipboard` : "Copied to clipboard" }))
      .catch(() => toast({ title: "Copy failed", variant: "destructive" }));
  };
  return (
    <Button
      variant="outline"
      size="sm"
      className="shrink-0 border-[#2A2A2A] text-[#A0A0A0] hover:bg-[#2A2A2A]"
      onClick={copy}
    >
      <Copy className="w-3.5 h-3.5 mr-1.5" />
      Copy
    </Button>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
  copyText,
  copyLabel,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  copyText?: string;
  copyLabel?: string;
}) {
  return (
    <Card className="border-[#2A2A2A] bg-[#1A1A1A]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-medium text-white flex items-center gap-2">
            <Icon className="w-4 h-4 text-orange-500" />
            {title}
          </CardTitle>
          {copyText && <CopyButton text={copyText} label={copyLabel} />}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

export type UnlockAssets = Record<
  string,
  {
    hashtags?: string[];
    title?: string;
    caption?: string;
    bestPostingTimes?: string;
    bestTimes?: string;
    engagementInstructions?: string;
  }
>;

export default function VideoCreationGuide({ guide, scriptTitle }: { guide: VideoGuideData; scriptTitle?: string }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingPlatform, setEditingPlatform] = useState<string>("CapCut");
  const [unlockedAssets, setUnlockedAssets] = useState<UnlockAssets | null>(null);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const editingSteps = guide.editingSteps[editingPlatform] ?? guide.editingSteps.CapCut ?? [];

  const handleUnlockUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith("image/")) {
        toast({ title: "Please select an image file", variant: "destructive" });
        return;
      }
      setUnlockError(null);
      setUnlockLoading(true);
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        fetch("/api/video-guide/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64,
            productName: guide.productName,
            script: guide.script,
            platforms: guide.platforms && guide.platforms.length > 0 ? guide.platforms : ["tiktok"],
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.error) throw new Error(data.error);
            const raw = data.postingAssets ?? data.assets ?? {};
            const mapped: UnlockAssets = {};
            for (const [id, a] of Object.entries(raw)) {
              const asset = a as Record<string, unknown>;
              mapped[id] = {
                hashtags: Array.isArray(asset.hashtags) ? asset.hashtags : [],
                title: typeof asset.title === "string" ? asset.title : "",
                caption: typeof asset.caption === "string" ? asset.caption : "",
                bestPostingTimes: typeof asset.bestPostingTimes === "string" ? asset.bestPostingTimes : undefined,
                bestTimes: typeof asset.bestTimes === "string" ? asset.bestTimes : (typeof asset.bestPostingTimes === "string" ? asset.bestPostingTimes : undefined),
                engagementInstructions: typeof asset.engagementInstructions === "string" ? asset.engagementInstructions : undefined,
              };
            }
            setUnlockedAssets(mapped);
            toast({ title: "Posting assets unlocked", description: "Copy hashtags, titles, and captions for each platform." });
          })
          .catch((err) => {
            setUnlockError(err instanceof Error ? err.message : "Unlock failed");
            toast({ title: "Unlock failed", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
          })
          .finally(() => {
            setUnlockLoading(false);
            e.target.value = "";
          });
      };
      reader.readAsDataURL(file);
    },
    [guide.productName, guide.script, guide.platforms, toast]
  );

  const copySection = useCallback(
    (text: string, label?: string) => {
      navigator.clipboard
        .writeText(text)
        .then(() => toast({ title: "Copied", description: label ? `${label} copied` : "Copied" }))
        .catch(() => toast({ title: "Copy failed", variant: "destructive" }));
    },
    [toast]
  );

  const downloadPdf = useCallback(() => {
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      let y = 20;
      const lineH = 6;
      const addText = (text: string, bold = false) => {
        doc.setFontSize(bold ? 12 : 10);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        const lines = doc.splitTextToSize(text, 180);
        lines.forEach((line: string) => {
          doc.text(line, 15, y);
          y += lineH;
        });
      };
      const addSpace = () => (y += 4);

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Video Creation Guide", 15, y);
      y += 10;
      if (guide.productName) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text(`Product: ${guide.productName}`, 15, y);
        y += 8;
      }
      if (guide.storytellingFramework) {
        doc.setFont("helvetica", "bold");
        doc.text(`Storytelling: ${guide.storytellingFramework}`, 15, y);
        y += 6;
        if (guide.frameworkRationale) {
          doc.setFont("helvetica", "normal");
          addText(guide.frameworkRationale);
          addSpace();
        }
      }
      addSpace();

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("1. Script", 15, y);
      y += 8;
      addText(`Hook: ${guide.script.hook}`);
      addText(`Body: ${guide.script.body}`);
      addText(`CTA: ${guide.script.cta}`);
      addSpace();

      if (guide.engagementTriggers && guide.engagementTriggers.length > 0) {
        doc.text("2. Engagement Triggers", 15, y);
        y += 8;
        guide.engagementTriggers.forEach((t) => addText(`• ${t}`));
        addSpace();
      }

      const promptsStart = guide.engagementTriggers?.length ? "3" : "2";
      doc.text(`${promptsStart}. AI Image/Video Prompts & Creative Brief`, 15, y);
      y += 8;
      if (guide.scenes && guide.scenes.length > 0) {
        guide.scenes.forEach((s, i) => {
          addText(`Scene ${i + 1}: ${s.scene} (${s.timing})`, true);
          if (s.visualDirection?.aiPrompt) addText(`Visual: ${s.visualDirection.aiPrompt}`);
          if (s.textOverlay?.exactText) addText(`Text: "${s.textOverlay.exactText}"`);
          if (s.transition?.toNextScene) addText(`Transition: ${s.transition.toNextScene} | ${s.transition.effects || ""}`);
          if (s.audio?.mood) addText(`Audio: ${s.audio.mood}, ${s.audio.musicVolume || ""}`);
          addSpace();
        });
      } else {
        guide.scenePrompts.forEach((s) => {
          addText(`${s.scene} (${s.timing}):`, true);
          addText(s.prompt);
          addSpace();
        });
      }

      const subStart = guide.engagementTriggers?.length ? "4" : "3";
      doc.text(`${subStart}. Subtitle Recommendations`, 15, y);
      y += 8;
      addText(`Style: ${guide.subtitleRecs.style}`);
      addText(`Font: ${guide.subtitleRecs.font}`);
      addText(`Position: ${guide.subtitleRecs.position}`);
      addText(`Animation: ${guide.subtitleRecs.animation}`);
      addSpace();

      doc.text(`${Number(subStart) + 1}. Music Recommendations`, 15, y);
      y += 8;
      addText(`Mood: ${guide.musicRecs.mood}`);
      addText(`Sources: ${guide.musicRecs.sources.join(", ")}`);
      addText(`Volume: ${guide.musicRecs.volume}`);
      addSpace();

      doc.text(`${Number(subStart) + 2}. Export Settings`, 15, y);
      y += 8;
      addText(`Resolution: ${guide.exportSettings.resolution}`);
      addText(`FPS: ${guide.exportSettings.fps}`);
      addText(`Format: ${guide.exportSettings.format}`);
      addText(`File size: ${guide.exportSettings.fileSize}`);
      addSpace();

      if (guide.platforms && guide.platforms.length > 0) {
        doc.text("Platforms", 15, y);
        y += 6;
        addText(guide.platforms.map((id) => VIDEO_GUIDE_PLATFORMS.find((p) => p.id === id)?.label ?? id).join(", "));
        addSpace();
      }
      if (guide.platformGuides && Object.keys(guide.platformGuides).length > 0) {
        doc.text("Platform-Specific Strategies", 15, y);
        y += 8;
        Object.entries(guide.platformGuides).forEach(([id, pg]) => {
          const label = VIDEO_GUIDE_PLATFORMS.find((p) => p.id === id)?.label ?? id;
          const p = pg as PlatformGuide;
          addText(`${label}:`, true);
          if (p.postingStrategy) addText(`Posting: ${p.postingStrategy}`);
          if (p.captionTemplate) addText(`Caption: ${p.captionTemplate}`);
          if (p.exportSettings) addText(`Export: ${p.exportSettings}`);
          addSpace();
        });
      }
      if (guide.contentCalendar && guide.contentCalendar.length > 0) {
        doc.text("Content Calendar", 15, y);
        y += 8;
        guide.contentCalendar.forEach((d) => addText(`Day ${d.day}: ${d.actions}`));
        addSpace();
      }
      if (guide.repurposingGuide && guide.repurposingGuide.length > 0) {
        doc.text("Repurposing Guide", 15, y);
        y += 8;
        guide.repurposingGuide.forEach((s, i) => addText(`${i + 1}. ${s}`));
        addSpace();
      }
      if (guide.thumbnailGuide) {
        doc.text("YouTube Thumbnail Guide", 15, y);
        y += 8;
        addText(guide.thumbnailGuide);
      }

      doc.save(`video-creation-guide-${(scriptTitle || guide.productName || "guide").replace(/\s+/g, "-")}.pdf`);
      toast({ title: "PDF downloaded", description: "Guide saved to your device" });
    } catch (e) {
      toast({
        title: "PDF download failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  }, [guide, scriptTitle, toast]);

  const fullScript = `${guide.script.hook}\n\n${guide.script.body}\n\n${guide.script.cta}`;

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

        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Video Creation Guide</h1>
            <p className="text-[#A0A0A0]">
              Multi-platform video marketing guide. Customized for{" "}
              <span className="text-white font-medium">{guide.productName}</span>.
            </p>
            {guide.platforms && guide.platforms.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {guide.platforms.map((id) => {
                  const p = VIDEO_GUIDE_PLATFORMS.find((x) => x.id === id);
                  return (
                    <span
                      key={id}
                      className="rounded-md bg-[#2A2A2A] px-2 py-0.5 text-xs text-[#B0B0B0]"
                    >
                      {p?.label ?? id}
                    </span>
                  );
                })}
              </div>
            )}
            {guide.storytellingFramework && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-orange-500/10 border border-orange-500/30 px-3 py-1.5">
                <Sparkles className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-medium text-orange-200">{guide.storytellingFramework}</span>
                {guide.frameworkRationale && (
                  <span className="text-xs text-orange-200/80">— {guide.frameworkRationale}</span>
                )}
              </div>
            )}
          </div>
          <Button
            className="bg-orange-500 hover:bg-orange-600 gap-2 shrink-0"
            onClick={downloadPdf}
          >
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
        </div>

        {/* Storyboard Timeline */}
        <Card className="border-[#2A2A2A] bg-[#1A1A1A] mb-8 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-white flex items-center gap-2">
              <Clapperboard className="w-4 h-4 text-orange-500" />
              Storyboard Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              {guide.scenePrompts.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#0F0F0F] px-3 py-2"
                >
                  <span className="text-xs font-medium text-orange-500">Scene {i + 1}</span>
                  <span className="text-sm text-[#B0B0B0]">{s.timing}</span>
                  <span className="text-sm text-white truncate max-w-[180px]">{s.scene}</span>
                  {i < guide.scenePrompts.length - 1 && (
                    <span className="text-[#4A4A4A]">→</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Engagement Triggers */}
        {guide.engagementTriggers && guide.engagementTriggers.length > 0 && (
          <div className="mb-8">
            <Card className="border-[#2A2A2A] bg-[#1A1A1A]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-white flex items-center gap-2">
                  <Target className="w-4 h-4 text-orange-500" />
                  Engagement Triggers
                </CardTitle>
                <p className="text-xs text-[#A0A0A0] mt-1">
                  Critical rules for TikTok conversion — follow these for maximum reach
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {guide.engagementTriggers.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#B0B0B0]">
                      <span className="text-orange-500 shrink-0">•</span>
                      <span className="text-[#E0E0E0]">{t}</span>
                    </li>
                  ))}
                </ul>
                <CopyButton
                  text={guide.engagementTriggers.join("\n")}
                  label="Engagement triggers"
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Script */}
        <SectionCard title="Script (Hook, Body, CTA)" icon={FileText} copyText={fullScript} copyLabel="Script">
          <div className="text-sm space-y-2 text-[#B0B0B0]">
            <p><span className="text-orange-500 font-medium">Hook:</span> {guide.script.hook}</p>
            <p><span className="text-orange-500 font-medium">Body:</span> {guide.script.body}</p>
            <p><span className="text-orange-500 font-medium">CTA:</span> {guide.script.cta}</p>
          </div>
        </SectionCard>

        {/* Creative Brief per Scene (full) */}
        {guide.scenes && guide.scenes.length > 0 ? (
          <div className="mt-6 space-y-6">
            {guide.scenes.map((scene, i) => {
              const v = scene.visualDirection;
              const t = scene.textOverlay;
              const tr = scene.transition;
              const a = scene.audio;
              const prompt = v?.aiPrompt ?? guide.scenePrompts[i]?.prompt ?? "";
              return (
                <Card key={i} className="border-[#2A2A2A] bg-[#1A1A1A] overflow-hidden">
                  <CardHeader className="pb-2 bg-[#0F0F0F]/50">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base font-medium text-white flex items-center gap-2">
                        <span className="text-orange-500">Scene {i + 1}</span>
                        <span className="text-[#A0A0A0] font-normal">—</span>
                        <span>{scene.scene}</span>
                        <span className="text-sm text-[#A0A0A0] font-normal">({scene.timing})</span>
                      </CardTitle>
                      <CopyButton
                        text={[
                          `VISUAL: ${prompt}`,
                          t?.exactText ? `TEXT: ${t.exactText}` : "",
                          tr?.toNextScene ? `TRANSITION: ${tr.toNextScene} | ${tr.effects || ""}` : "",
                          a?.mood ? `AUDIO: ${a.mood}, ${a.musicVolume || ""}` : "",
                        ]
                          .filter(Boolean)
                          .join("\n")}
                        label={`Scene ${i + 1} brief`}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    {/* Visual Direction */}
                    <div>
                      <p className="text-xs font-medium text-orange-500 uppercase tracking-wider mb-2">Visual Direction</p>
                      <p className="text-sm text-[#E0E0E0] mb-2">{prompt}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-[#A0A0A0]">
                        {v?.cameraAngle && <span className="rounded bg-[#2A2A2A] px-2 py-0.5">📷 {v.cameraAngle}</span>}
                        {v?.lightingMood && <span className="rounded bg-[#2A2A2A] px-2 py-0.5">💡 {v.lightingMood}</span>}
                        {v?.colorPalette && <span className="rounded bg-[#2A2A2A] px-2 py-0.5">🎨 {v.colorPalette}</span>}
                        {v?.mediaType && <span className="rounded bg-[#2A2A2A] px-2 py-0.5">📹 {v.mediaType}</span>}
                      </div>
                    </div>

                    {/* Text Overlay */}
                    {t?.exactText && (
                      <div>
                        <p className="text-xs font-medium text-orange-500 uppercase tracking-wider mb-1">Text Overlay</p>
                        <p className="text-sm text-white font-medium mb-1">&quot;{t.exactText}&quot;</p>
                        <div className="flex flex-wrap gap-2 text-xs text-[#A0A0A0]">
                          {t.fontStyle && <span>{t.fontStyle}</span>}
                          {t.size && <span>• {t.size}</span>}
                          {t.position && <span>• {t.position}</span>}
                          {t.animation && <span>• {t.animation}</span>}
                          {t.timingNote && <span>• {t.timingNote}</span>}
                        </div>
                      </div>
                    )}

                    {/* Transition */}
                    {(tr?.toNextScene || tr?.effects || tr?.pacing) && (
                      <div>
                        <p className="text-xs font-medium text-orange-500 uppercase tracking-wider mb-1">Transition</p>
                        <div className="text-sm text-[#B0B0B0]">
                          {tr.toNextScene && <span>To next: {tr.toNextScene}</span>}
                          {tr.effects && <span className="ml-2">• {tr.effects}</span>}
                          {tr.pacing && <span className="ml-2">• {tr.pacing}</span>}
                        </div>
                      </div>
                    )}

                    {/* Audio */}
                    {(a?.musicVolume || a?.beatDrops || a?.soundEffects || a?.mood) && (
                      <div>
                        <p className="text-xs font-medium text-orange-500 uppercase tracking-wider mb-1">Audio</p>
                        <div className="text-sm text-[#B0B0B0] space-y-0.5">
                          {a.mood && <p>Mood: {a.mood}</p>}
                          {a.musicVolume && <p>Volume: {a.musicVolume}</p>}
                          {a.beatDrops && <p>Beat drops: {a.beatDrops}</p>}
                          {a.soundEffects && <p>SFX: {a.soundEffects}</p>}
                        </div>
                      </div>
                    )}

                    <CopyButton text={prompt} label={`Scene ${i + 1} AI prompt`} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Fallback: AI Prompts only */
          <div className="mt-6">
            <Card className="border-[#2A2A2A] bg-[#1A1A1A]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-white flex items-center gap-2">
                  <Image className="w-4 h-4 text-orange-500" />
                  AI Image/Video Prompts
                </CardTitle>
                <p className="text-xs text-[#A0A0A0] mt-1">
                  Paste these into ChatGPT, Gemini, Midjourney, or similar tools
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {guide.scenePrompts.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-[#2A2A2A] bg-[#0F0F0F] p-3 flex items-start justify-between gap-2"
                  >
                    <div>
                      <p className="text-xs font-medium text-orange-500 mb-1">{s.scene} ({s.timing})</p>
                      <p className="text-sm text-[#E0E0E0]">{s.prompt}</p>
                    </div>
                    <CopyButton text={s.prompt} label={`Scene ${i + 1} prompt`} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Stock Image Suggestions */}
        {guide.stockSuggestions.length > 0 && (
          <div className="mt-6">
            <SectionCard
              title="Stock Image Suggestions"
              icon={Image}
              copyText={guide.stockSuggestions.map((s) => `${s.scene}: ${s.note} - ${s.suggestion}`).join("\n")}
            >
              {guide.stockSuggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  {s.suggestion && (
                    <img
                      src={s.suggestion}
                      alt=""
                      className="w-16 h-16 rounded object-cover border border-[#2A2A2A]"
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">{s.scene}</p>
                    <p className="text-xs text-[#A0A0A0]">{s.note}</p>
                  </div>
                </div>
              ))}
            </SectionCard>
          </div>
        )}

        {/* Editing Guide */}
        <div className="mt-6">
          <Card className="border-[#2A2A2A] bg-[#1A1A1A]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-white flex items-center gap-2">
                <Clapperboard className="w-4 h-4 text-orange-500" />
                Editing Guide
              </CardTitle>
              <Select value={editingPlatform} onValueChange={setEditingPlatform}>
                <SelectTrigger className="w-[180px] mt-2 bg-[#0F0F0F] border-[#2A2A2A] text-white">
                  <SelectValue placeholder="Choose platform" />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1A1A] border-[#2A2A2A]">
                  {EDITING_PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-sm text-[#B0B0B0]">
                {editingSteps.map((step, i) => (
                  <li key={i} className="pl-1">
                    <span className="text-[#E0E0E0]">{step}</span>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-[#A0A0A0] mt-3">
                Text overlays: Hook — Montserrat Bold, large, center. Body — slide up animation. Transitions at 0:03, 0:08, 0:12.
              </p>
              <CopyButton
                text={editingSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}
                label="Editing steps"
              />
            </CardContent>
          </Card>
        </div>

        {/* Subtitles */}
        <div className="mt-6">
          <SectionCard
            title="Subtitle Recommendations"
            icon={FileText}
            copyText={`Style: ${guide.subtitleRecs.style}\nFont: ${guide.subtitleRecs.font}\nPosition: ${guide.subtitleRecs.position}\nAnimation: ${guide.subtitleRecs.animation}`}
          >
            <ul className="text-sm text-[#B0B0B0] space-y-1">
              <li><span className="text-white">Style:</span> {guide.subtitleRecs.style}</li>
              <li><span className="text-white">Font:</span> {guide.subtitleRecs.font}</li>
              <li><span className="text-white">Position:</span> {guide.subtitleRecs.position}</li>
              <li><span className="text-white">Animation:</span> {guide.subtitleRecs.animation}</li>
            </ul>
          </SectionCard>
        </div>

        {/* Music */}
        <div className="mt-6">
          <SectionCard
            title="Music Recommendations"
            icon={Music}
            copyText={`Mood: ${guide.musicRecs.mood}\nSources: ${guide.musicRecs.sources.join(", ")}\nVolume: ${guide.musicRecs.volume}`}
          >
            <ul className="text-sm text-[#B0B0B0] space-y-1">
              <li><span className="text-white">Mood:</span> {guide.musicRecs.mood}</li>
              <li><span className="text-white">Sources:</span> {guide.musicRecs.sources.join(", ")}</li>
              <li><span className="text-white">Volume:</span> {guide.musicRecs.volume}</li>
            </ul>
          </SectionCard>
        </div>

        {/* Export Settings */}
        <div className="mt-6">
          <SectionCard
            title="Export Settings"
            icon={FileText}
            copyText={`Resolution: ${guide.exportSettings.resolution}\nFPS: ${guide.exportSettings.fps}\nFormat: ${guide.exportSettings.format}\nFile size: ${guide.exportSettings.fileSize}`}
          >
            <ul className="text-sm text-[#B0B0B0] space-y-1">
              <li><span className="text-white">Resolution:</span> {guide.exportSettings.resolution}</li>
              <li><span className="text-white">FPS:</span> {guide.exportSettings.fps}</li>
              <li><span className="text-white">Format:</span> {guide.exportSettings.format}</li>
              <li><span className="text-white">File size:</span> {guide.exportSettings.fileSize}</li>
            </ul>
          </SectionCard>
        </div>

        {/* Platform-Specific Guides */}
        {guide.platformGuides && Object.keys(guide.platformGuides).length > 0 && (
          <div className="mt-8">
            <Card className="border-[#2A2A2A] bg-[#1A1A1A]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-white flex items-center gap-2">
                  <Clapperboard className="w-4 h-4 text-orange-500" />
                  Platform-Specific Strategies
                </CardTitle>
                <p className="text-xs text-[#A0A0A0] mt-1">
                  Adapted scripts, posting strategies, and export settings for each platform
                </p>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue={Object.keys(guide.platformGuides)[0]} className="w-full">
                  <TabsList className="bg-[#0F0F0F] border border-[#2A2A2A] flex flex-wrap gap-1 p-1">
                    {Object.keys(guide.platformGuides).map((id) => {
                      const p = VIDEO_GUIDE_PLATFORMS.find((x) => x.id === id);
                      return (
                        <TabsTrigger
                          key={id}
                          value={id}
                          className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs"
                        >
                          {p?.label ?? id}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                  {Object.entries(guide.platformGuides).map(([id, pg]) => {
                    const p = pg as import("./VideoCreationGuide").PlatformGuide;
                    const label = VIDEO_GUIDE_PLATFORMS.find((x) => x.id === id)?.label ?? id;
                    const copyText = [
                      p.platformNotes ? `Notes: ${p.platformNotes}` : "",
                      p.adaptedScript ? `Script: ${JSON.stringify(p.adaptedScript)}` : "",
                      p.tweetThread ? `Thread:\n${p.tweetThread.map((t, i) => `${i + 1}. ${t}`).join("\n")}` : "",
                      p.linkedInPost ? `LinkedIn Post: ${JSON.stringify(p.linkedInPost)}` : "",
                      p.pinTitleVariations ? `Pin titles: ${p.pinTitleVariations.join(" | ")}` : "",
                      p.pinDescription ? `Pin description: ${p.pinDescription}` : "",
                      p.facebookGroupPost ? `Group post: ${JSON.stringify(p.facebookGroupPost)}` : "",
                      p.instagramCarouselGuide ? `Carousel: ${p.instagramCarouselGuide}` : "",
                      p.aiPromptHint ? `AI Prompts: ${p.aiPromptHint}` : "",
                      p.postingStrategy ? `Posting: ${p.postingStrategy}` : "",
                      p.captionTemplate ? `Caption: ${p.captionTemplate}` : "",
                      p.engagementStrategy ? `Engagement: ${p.engagementStrategy}` : "",
                      p.exportSettings ? `Export: ${p.exportSettings}` : "",
                    ]
                      .filter(Boolean)
                      .join("\n\n");
                    return (
                      <TabsContent key={id} value={id} className="mt-4 space-y-4">
                        {p.platformNotes && (
                          <p className="text-sm text-[#A0A0A0] italic border-l-2 border-orange-500/50 pl-3">{p.platformNotes}</p>
                        )}
                        {/* X (Twitter) — thread + tweets */}
                        {p.tweetThread && p.tweetThread.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-orange-500 mb-2">Tweet Thread (post in order, then reply to yourself with link)</p>
                            <ol className="text-sm text-[#B0B0B0] space-y-2 bg-[#0F0F0F] rounded-lg p-3 list-decimal list-inside">
                              {p.tweetThread.map((t, i) => (
                                <li key={i} className="pl-1"><span className="text-[#E0E0E0]">{t}</span></li>
                              ))}
                            </ol>
                            {p.tweetVariations && p.tweetVariations.length > 0 && (
                              <p className="text-xs font-medium text-orange-500 mt-2 mb-1">Standalone tweet variations (A/B test)</p>
                              <ul className="text-sm text-[#B0B0B0] space-y-1 list-disc list-inside">{p.tweetVariations.map((v, i) => <li key={i}>{v}</li>)}</ul>
                            )}
                            {p.firstTweetImagePrompt && <p className="text-sm text-[#B0B0B0] mt-2"><span className="text-white">Image for Tweet 1:</span> {p.firstTweetImagePrompt}</p>}
                            {p.quoteTweetGuide && <p className="text-sm text-[#B0B0B0]"><span className="text-white">Quote-tweet & replies:</span> {p.quoteTweetGuide}</p>}
                          </div>
                        )}
                        {/* LinkedIn — post + carousel */}
                        {p.linkedInPost && (p.linkedInPost.hook || p.linkedInPost.body) && (
                          <div>
                            <p className="text-xs font-medium text-orange-500 mb-2">LinkedIn Post</p>
                            <div className="text-sm text-[#B0B0B0] space-y-1 bg-[#0F0F0F] rounded-lg p-3">
                              {p.linkedInPost.hook && <p><span className="text-orange-500">Hook (before &quot;see more&quot;):</span> {p.linkedInPost.hook}</p>}
                              {p.linkedInPost.body && <p className="whitespace-pre-line">{p.linkedInPost.body}</p>}
                              {p.linkedInPost.takeaways && <p><span className="text-orange-500">Key takeaways:</span><br /><span className="whitespace-pre-line">{p.linkedInPost.takeaways}</span></p>}
                              {p.linkedInPost.cta && <p><span className="text-orange-500">CTA:</span> {p.linkedInPost.cta}</p>}
                            </div>
                            {p.linkedInCarouselOption && <p className="text-sm text-[#B0B0B0] mt-2"><span className="text-white">Carousel option:</span> {p.linkedInCarouselOption}</p>}
                            {p.imageDirection && <p className="text-sm text-[#B0B0B0]"><span className="text-white">Image:</span> {p.imageDirection}</p>}
                            {p.algorithmGuide && <p className="text-sm text-[#B0B0B0]"><span className="text-white">Algorithm:</span> {p.algorithmGuide}</p>}
                          </div>
                        )}
                        {/* Pinterest — pins */}
                        {(p.pinDesignDirection || p.pinTitleVariations?.length) && (
                          <div>
                            {p.pinDesignDirection && <p className="text-sm text-[#B0B0B0]"><span className="text-white">Pin design (1000×1500):</span> {p.pinDesignDirection}</p>}
                            {p.pinTitleVariations && p.pinTitleVariations.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-medium text-orange-500 mb-1">Pin title variations</p>
                                <ul className="text-sm text-[#B0B0B0] list-disc list-inside">{p.pinTitleVariations.map((t, i) => <li key={i}>{t}</li>)}</ul>
                              </div>
                            )}
                            {p.pinDescription && <p className="text-sm text-[#B0B0B0] mt-2"><span className="text-white">Pin description (SEO):</span> {p.pinDescription}</p>}
                            {p.boardNameSuggestions && p.boardNameSuggestions.length > 0 && <p className="text-sm text-[#B0B0B0]"><span className="text-white">Boards:</span> {p.boardNameSuggestions.join(", ")}</p>}
                            {p.pinterestSeoGuide && <p className="text-sm text-[#B0B0B0]"><span className="text-white">Pinterest SEO:</span> {p.pinterestSeoGuide}</p>}
                            {p.ideaPinsOption && <p className="text-sm text-[#B0B0B0]"><span className="text-white">Idea Pins:</span> {p.ideaPinsOption}</p>}
                          </div>
                        )}
                        {/* Facebook — Group post */}
                        {p.facebookGroupPost && (p.facebookGroupPost.hookQuestion || p.facebookGroupPost.body) && (
                          <div>
                            <p className="text-xs font-medium text-orange-500 mb-2">Facebook Group post</p>
                            <div className="text-sm text-[#B0B0B0] space-y-1 bg-[#0F0F0F] rounded-lg p-3">
                              {p.facebookGroupPost.hookQuestion && <p><span className="text-orange-500">Hook question:</span> {p.facebookGroupPost.hookQuestion}</p>}
                              {p.facebookGroupPost.body && <p>{p.facebookGroupPost.body}</p>}
                              {p.facebookGroupPost.cta && <p><span className="text-orange-500">CTA:</span> {p.facebookGroupPost.cta}</p>}
                            </div>
                            {p.facebookGroupsGuide && <p className="text-sm text-[#B0B0B0] mt-2"><span className="text-white">Which Groups:</span> {p.facebookGroupsGuide}</p>}
                            {p.marketplaceGuide && <p className="text-sm text-[#B0B0B0]"><span className="text-white">Marketplace:</span> {p.marketplaceGuide}</p>}
                          </div>
                        )}
                        {/* Instagram — carousel + stories */}
                        {p.instagramCarouselGuide && (
                          <div>
                            <p className="text-xs font-medium text-orange-500 mb-1">Carousel (10 slides)</p>
                            <p className="text-sm text-[#B0B0B0]">{p.instagramCarouselGuide}</p>
                            {p.instagramStorySequence && <p className="text-sm text-[#B0B0B0] mt-2"><span className="text-white">Story sequence:</span> {p.instagramStorySequence}</p>}
                          </div>
                        )}
                        {/* Video platforms — adapted script + strategy */}
                        {p.adaptedScript && (p.adaptedScript.hook || p.adaptedScript.body || p.adaptedScript.cta) && (
                          <div>
                            <p className="text-xs font-medium text-orange-500 mb-2">Adapted Script for {label}</p>
                            <div className="text-sm text-[#B0B0B0] space-y-1 bg-[#0F0F0F] rounded-lg p-3">
                              {p.adaptedScript.hook && <p><span className="text-orange-500">Hook:</span> {p.adaptedScript.hook}</p>}
                              {p.adaptedScript.body && <p><span className="text-orange-500">Body:</span> {p.adaptedScript.body}</p>}
                              {p.adaptedScript.cta && <p><span className="text-orange-500">CTA:</span> {p.adaptedScript.cta}</p>}
                            </div>
                          </div>
                        )}
                        {p.aiPromptHint && <p className="text-sm text-[#B0B0B0]"><span className="text-white">AI Prompts:</span> {p.aiPromptHint}</p>}
                        {p.postingStrategy && <p className="text-sm text-[#B0B0B0]"><span className="text-white">Posting Strategy:</span> {p.postingStrategy}</p>}
                        {p.captionTemplate && <p className="text-sm text-[#B0B0B0]"><span className="text-white">Caption Template:</span> {p.captionTemplate}</p>}
                        {p.engagementStrategy && <p className="text-sm text-[#B0B0B0]"><span className="text-white">Engagement:</span> {p.engagementStrategy}</p>}
                        {p.exportSettings && <p className="text-sm text-[#B0B0B0]"><span className="text-white">Export:</span> {p.exportSettings}</p>}
                        <CopyButton text={copyText} label={`${label} guide`} />
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Unlock Posting Assets */}
        <div className="mt-8">
          <Card className="border-[#2A2A2A] bg-[#1A1A1A]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-white flex items-center gap-2">
                <Unlock className="w-4 h-4 text-orange-500" />
                Unlock Posting Assets
              </CardTitle>
              {!unlockedAssets ? (
                <p className="text-sm text-[#A0A0A0] mt-1">
                  Upload a screenshot of your finished video/content to unlock optimized hashtags, titles, and descriptions for each platform.
                </p>
              ) : (
                <p className="text-sm text-green-500/90 mt-1">Unlocked! Copy the assets below for each platform.</p>
              )}
            </CardHeader>
            <CardContent>
              {!unlockedAssets ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUnlockUpload}
                  />
                  <Button
                    className="bg-orange-500 hover:bg-orange-600 gap-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={unlockLoading}
                  >
                    {unlockLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Unlock className="w-4 h-4" />
                    )}
                    {unlockLoading ? "Uploading & generating..." : "Unlock Posting Assets"}
                  </Button>
                  {unlockError && <p className="text-sm text-red-400 mt-2">{unlockError}</p>}
                </>
              ) : (
                <div className="space-y-6">
                  {Object.entries(unlockedAssets).map(([platformId, a]) => {
                    const label = VIDEO_GUIDE_PLATFORMS.find((p) => p.id === platformId)?.label ?? platformId;
                    return (
                      <div key={platformId} className="rounded-lg border border-[#2A2A2A] bg-[#0F0F0F] p-4 space-y-3">
                        <p className="text-sm font-medium text-orange-500">{label}</p>
                        {a.hashtags?.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-[#A0A0A0]">Hashtags:</span>
                            <span className="text-sm text-[#E0E0E0]">{a.hashtags.join(" ")}</span>
                            <CopyButton text={a.hashtags.join(" ")} label={`${label} hashtags`} />
                          </div>
                        )}
                        {a.title && (
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs text-[#A0A0A0]">Title</p>
                              <p className="text-sm text-[#E0E0E0]">{a.title}</p>
                            </div>
                            <CopyButton text={a.title} label={`${label} title`} />
                          </div>
                        )}
                        {a.caption && (
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs text-[#A0A0A0]">Caption / Description</p>
                              <p className="text-sm text-[#E0E0E0] whitespace-pre-line">{a.caption}</p>
                            </div>
                            <CopyButton text={a.caption} label={`${label} caption`} />
                          </div>
                        )}
                        {(a.bestTimes ?? a.bestPostingTimes) && (
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm text-[#B0B0B0]"><span className="text-white">Best times:</span> {a.bestTimes ?? a.bestPostingTimes}</p>
                            <CopyButton text={a.bestTimes ?? a.bestPostingTimes ?? ""} label={`${label} best times`} />
                          </div>
                        )}
                        {a.engagementInstructions && (
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-[#B0B0B0]"><span className="text-white">Engagement:</span> {a.engagementInstructions}</p>
                            <CopyButton text={a.engagementInstructions} label={`${label} engagement`} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <p className="text-sm text-[#A0A0A0] text-center pt-2 border-t border-[#2A2A2A]">
                    Want to share your results? Tag <span className="text-orange-500 font-medium">@contentflywheel</span> for a feature!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Content Calendar */}
        {guide.contentCalendar && guide.contentCalendar.length > 0 && (
          <div className="mt-8">
            <Card className="border-[#2A2A2A] bg-[#1A1A1A]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-500" />
                  Content Calendar
                </CardTitle>
                <p className="text-xs text-[#A0A0A0] mt-1">
                  Week-by-week posting schedule across your platforms
                </p>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {guide.contentCalendar.map((day) => (
                    <li key={day.day} className="flex gap-4 text-sm">
                      <span className="font-medium text-orange-500 shrink-0 w-16">Day {day.day}</span>
                      <span className="text-[#B0B0B0]">{day.actions}</span>
                    </li>
                  ))}
                </ol>
                <CopyButton
                  text={guide.contentCalendar.map((d) => `Day ${d.day}: ${d.actions}`).join("\n")}
                  label="Content calendar"
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Repurposing Guide */}
        {guide.repurposingGuide && guide.repurposingGuide.length > 0 && (
          <div className="mt-8">
            <Card className="border-[#2A2A2A] bg-[#1A1A1A]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-orange-500" />
                  Repurposing Guide
                </CardTitle>
                <p className="text-xs text-[#A0A0A0] mt-1">
                  Turn one video into content for all platforms
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {guide.repurposingGuide.map((step, i) => (
                    <li key={i} className="flex gap-2 text-sm text-[#B0B0B0]">
                      <span className="text-orange-500 shrink-0">{i + 1}.</span>
                      <span className="text-[#E0E0E0]">{step}</span>
                    </li>
                  ))}
                </ul>
                <CopyButton
                  text={guide.repurposingGuide.map((s, i) => `${i + 1}. ${s}`).join("\n")}
                  label="Repurposing guide"
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Thumbnail Guide (YouTube Long-form) */}
        {guide.thumbnailGuide && (
          <div className="mt-8">
            <SectionCard
              title="YouTube Thumbnail Guide"
              icon={ImagePlus}
              copyText={guide.thumbnailGuide}
            >
              <p className="text-sm text-[#B0B0B0] whitespace-pre-line">{guide.thumbnailGuide}</p>
            </SectionCard>
          </div>
        )}
      </div>
    </main>
  );
}
