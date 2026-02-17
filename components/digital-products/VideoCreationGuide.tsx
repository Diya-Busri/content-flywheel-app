"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Copy,
  Download,
  FileText,
  Film,
  Music,
  Type,
  Upload,
  Volume2,
} from "lucide-react";

export type VideoGuideData = {
  script: { hook: string; body: string; cta: string };
  scenePrompts: Array<{ scene: string; timing: string; prompt: string }>;
  productName?: string;
  overview?: string;
  scenes?: Array<{
    scene: string;
    timing: string;
    visualDescription?: string;
    textOverlay?: string;
    prompt?: string;
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

  const copyAllPrompts = useCallback(() => {
    const all = scenes
      .map(
        (s, i) =>
          `Scene ${i + 1} (${s.timing}): ${(s as { prompt?: string }).prompt ?? (s as { visualDescription?: string }).visualDescription ?? s.scene}`
      )
      .join("\n\n");
    copyToClipboard(all, "All AI prompts");
  }, [scenes, copyToClipboard]);

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
      const prompt = (s as { prompt?: string }).prompt ?? (s as { visualDescription?: string }).visualDescription ?? "";
      lines.push(`${i + 1}. ${s.scene} (${s.timing})`);
      if (prompt) lines.push(`   AI Prompt: ${prompt}`);
      if ((s as { textOverlay?: string }).textOverlay) lines.push(`   Text: ${(s as { textOverlay?: string }).textOverlay}`);
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

        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
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
              className="bg-orange-500 hover:bg-orange-600 text-white"
              size="sm"
              onClick={downloadGuide}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download Full Guide
            </Button>
          </div>
        </div>

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
          </TabsList>

          <TabsContent value="scenes" className="mt-6 space-y-4">
            {scenes.map((scene, i) => {
              const prompt = (scene as { prompt?: string }).prompt ?? (scene as { visualDescription?: string }).visualDescription ?? "";
              const textOverlay = (scene as { textOverlay?: string }).textOverlay;
              return (
                <Card key={i} className="border-[#2A2A2A] bg-[#1A1A1A]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium text-white flex items-center justify-between gap-2">
                      <span>Scene {i + 1} · {scene.timing}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 border-[#2A2A2A] text-[#A0A0A0] hover:bg-[#2A2A2A]"
                        onClick={() => {
                          copyToClipboard(prompt || scene.scene, "AI prompt");
                          setCopiedIndex(i);
                          setTimeout(() => setCopiedIndex(null), 2000);
                        }}
                      >
                        {copiedIndex === i ? "Copied" : "Copy AI Prompt"}
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-[#B0B0B0]">
                    <p><span className="text-orange-500 font-medium">Visual:</span> {prompt || scene.scene}</p>
                    {textOverlay && (
                      <p><span className="text-orange-500 font-medium">Text overlay:</span> {textOverlay}</p>
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
        </Tabs>

        <Card className="mt-8 border-[#2A2A2A] bg-[#1A1A1A]">
          <CardHeader>
            <CardTitle className="text-base font-medium text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-500" />
              Full script
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-[#B0B0B0] whitespace-pre-line">
            <p><span className="text-orange-500 font-medium">Hook:</span> {script.hook}</p>
            <p><span className="text-orange-500 font-medium">Body:</span> {script.body}</p>
            <p><span className="text-orange-500 font-medium">CTA:</span> {script.cta}</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
