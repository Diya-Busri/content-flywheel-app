"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Download, Copy, FileText, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { VideoCustomizationModal } from "@/components/digital-products/VideoCustomizationModal";
import type { VideoCustomizationSettings } from "@/components/digital-products/VideoCustomizationModal";

/** Matches the 4 angles from generate-scripts; used for Regenerate dropdown. */
const SCRIPT_ANGLES = [
  "Story Angle",
  "Problem/Solution Angle",
  "Social Proof/Results Angle",
  "Curiosity/Controversy Angle",
] as const;

/** Strip [PAIN]...[/PAIN] and [BENEFIT]...[/BENEFIT] tags for clipboard/download. */
function stripScriptTags(text: string): string {
  return text
    .replace(/\[PAIN\](.*?)\[\/PAIN\]/gs, "$1")
    .replace(/\[BENEFIT\](.*?)\[\/BENEFIT\]/gs, "$1");
}

/** Pain/benefit keywords for fallback when script has no [PAIN]/[BENEFIT] tags. */
const PAIN_WORDS = /\b(struggling|stressed|stressing|frustrated|overwhelmed|broke|stuck|failing|worried|anxious|broke|can't afford|tired of|exhausted|stressed out|struggle|frustration|overwhelm|worry|anxiety|fear|scared|confused|lost|broken|stuck)\b/gi;
const BENEFIT_WORDS = /\b(thriving|freedom|transformed|saved|confident|calm|organized|successful|easy|finally|peace of mind|financial freedom|transformation|results|winning|confident|clarity|relief|simple|quick|powerful)\b/gi;

type Segment = { type: "normal" | "pain" | "benefit"; text: string };

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  const re = /\[PAIN\](.*?)\[\/PAIN\]|\[BENEFIT\](.*?)\[\/BENEFIT\]/gs;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: "normal", text: text.slice(lastIndex, m.index) });
    }
    if (m[1] !== undefined) segments.push({ type: "pain", text: m[1] });
    if (m[2] !== undefined) segments.push({ type: "benefit", text: m[2] });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "normal", text: text.slice(lastIndex) });
  }
  return segments;
}

/** Apply keyword-based highlighting to normal text when no tags present. */
function highlightKeywords(text: string): Segment[] {
  const segments: Segment[] = [];
  let lastEnd = 0;
  const combined = new RegExp(
    `(${PAIN_WORDS.source})|(${BENEFIT_WORDS.source})`,
    "gi"
  );
  let match: RegExpExecArray | null;
  while ((match = combined.exec(text)) !== null) {
    if (match.index > lastEnd) {
      segments.push({ type: "normal", text: text.slice(lastEnd, match.index) });
    }
    if (match[1]) segments.push({ type: "pain", text: match[1] });
    if (match[2]) segments.push({ type: "benefit", text: match[2] });
    lastEnd = match.index + match[0].length;
  }
  if (lastEnd < text.length) {
    segments.push({ type: "normal", text: text.slice(lastEnd) });
  }
  return segments.length > 0 ? segments : [{ type: "normal", text: text }];
}

function getSegments(text: string): Segment[] {
  const parsed = parseSegments(text);
  const hasTags = parsed.some((s) => s.type !== "normal");
  if (hasTags) return parsed;
  return highlightKeywords(text);
}

function ScriptHighlightedText({
  text,
  isCta,
}: {
  text: string;
  isCta?: boolean;
}) {
  const segments = getSegments(text);
  return (
    <span className={isCta ? "font-bold text-amber-400" : undefined}>
      {segments.map((seg, i) => {
        if (seg.type === "normal")
          return <span key={i}>{seg.text}</span>;
        if (seg.type === "pain")
          return (
            <span key={i} className="bg-red-500/25 text-red-300 rounded px-0.5">
              {seg.text}
            </span>
          );
        return (
          <span key={i} className="bg-emerald-500/25 text-emerald-300 rounded px-0.5">
            {seg.text}
          </span>
        );
      })}
    </span>
  );
}

type ScriptForDisplay = {
  id: string;
  title: string;
  length: number;
  hook: string;
  body: string;
  cta: string;
};

export default function ResultsFlow() {
  const router = useRouter();
  const { toast } = useToast();
  const [scripts, setScripts] = useState<ScriptForDisplay[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [guideLoading, setGuideLoading] = useState(false);
  const [progressStage, setProgressStage] = useState<string | null>(null);
  const [customizationModalOpen, setCustomizationModalOpen] = useState(false);
  const [customizationScript, setCustomizationScript] = useState<ScriptForDisplay | null>(null);
  const [customizationScripts, setCustomizationScripts] = useState<ScriptForDisplay[] | null>(null);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [regenerateAngleByIndex, setRegenerateAngleByIndex] = useState<Record<number, string>>({});

  useEffect(() => {
    try {
      const rawScripts = sessionStorage.getItem("selectedScriptsForVideos");
      if (rawScripts) {
        const parsed = JSON.parse(rawScripts) as ScriptForDisplay[];
        setScripts(Array.isArray(parsed) ? parsed : []);
      }
      const rawContext = sessionStorage.getItem("productContextForVideos");
      if (rawContext) {
        const ctx = JSON.parse(rawContext) as { productId?: string };
        if (ctx?.productId) setProductId(ctx.productId);
      }
    } catch {
      setScripts([]);
    }
  }, []);

  const copyScript = (script: ScriptForDisplay) => {
    const full = `${stripScriptTags(script.hook)}\n\n${stripScriptTags(script.body)}\n\n${stripScriptTags(script.cta)}`;
    navigator.clipboard.writeText(full).then(
      () => toast({ title: "Copied", description: `"${script.title}" copied to clipboard` }),
      () => toast({ title: "Copy failed", variant: "destructive" })
    );
  };

  const downloadAllScripts = () => {
    if (scripts.length === 0) return;
    const text = scripts
      .map(
        (s) =>
          `=== ${s.title} (${s.length}s) ===\n\nHook:\n${stripScriptTags(s.hook)}\n\nBody:\n${stripScriptTags(s.body)}\n\nCTA:\n${stripScriptTags(s.cta)}\n\n`
      )
      .join("\n---\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "video-scripts.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: "All scripts saved as video-scripts.txt" });
  };

  const handleRegenerateScript = async (index: number) => {
    if (!productId) {
      toast({ title: "Product context missing", variant: "destructive", description: "Go back and select scripts again." });
      return;
    }
    const angle = regenerateAngleByIndex[index] ?? SCRIPT_ANGLES[0];
    setRegeneratingIndex(index);
    try {
      const res = await fetch("/api/digital-products/regenerate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, angle }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Regeneration failed");
      }
      const newScript = data.script as ScriptForDisplay;
      if (newScript) {
        const next = scripts.map((s, i) => (i === index ? { ...newScript, id: s.id } : s));
        setScripts(next);
        sessionStorage.setItem("selectedScriptsForVideos", JSON.stringify(next));
        toast({ title: "Script updated", description: `New "${angle}" variation replaced this script.` });
      }
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

  const createVideoGuide = async (script: ScriptForDisplay, settings?: VideoCustomizationSettings, platforms?: string[]) => {
    setCustomizationModalOpen(false);
    setGuideLoading(true);
    setProgressStage("Creating your multi-platform video creation guide...");
    sessionStorage.setItem("selectedScriptsForVideos", JSON.stringify(scripts));
    try {
      const res = await fetch("/api/video-guide/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook: settings?.hook ?? script.hook,
          body: settings?.body ?? script.body,
          cta: settings?.cta ?? script.cta,
          productId: productId || undefined,
          platforms: platforms && platforms.length > 0 ? platforms : ["tiktok"],
          durationSeconds: [15, 30, 60, 90].includes(script.length) ? script.length : 30,
        }),
      });
      const guide = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(guide.error || `Request failed: ${res.status}`);
      }
      sessionStorage.setItem("videoCreationGuide", JSON.stringify({ ...guide, scriptTitle: script.title }));
      toast({ title: "Guide ready", description: "Your personalised video creation guide is ready." });
      router.push("/dashboard/digital-products/video-guide");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast({
        title: "Guide creation failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setGuideLoading(false);
      setProgressStage(null);
    }
  };

  if (scripts.length === 0) {
    return (
      <main className="min-h-screen bg-[#0F0F0F] text-white p-6 md:p-10">
        <div className="max-w-2xl mx-auto text-center">
          <Link
            href="/dashboard/digital-products/videos"
            className="inline-flex items-center gap-2 text-sm text-[#A0A0A0] hover:text-orange-500 mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Video Customization
          </Link>
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-6">
            <FileText className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">No scripts found</h1>
          <p className="text-[#A0A0A0] mb-8">
            Go back to select scripts, then return here to create your video creation guide.
          </p>
          <Button asChild variant="outline" className="border-[#2A2A2A] text-[#A0A0A0]">
            <Link href="/dashboard/digital-products/scripts">Back to Scripts</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0F0F0F] text-white p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/dashboard/digital-products/videos"
          className="inline-flex items-center gap-2 text-sm text-[#A0A0A0] hover:text-orange-500 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Video Customization
        </Link>
        <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mb-6">
          <FileText className="w-8 h-8 text-orange-500" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
          {scripts.length === 4 ? "4 Scripts Ready - Post 1 per day for maximum reach" : `${scripts.length} Script${scripts.length === 1 ? "" : "s"} Ready`}
        </h1>
        <p className="text-[#A0A0A0] mb-6">
          Get a personalised Video Creation Guide for each script. Each guide includes AI image prompts, editing steps, and export settings.
        </p>

        {progressStage && (
          <Card className="mb-6 border-orange-500/30 bg-orange-500/10">
            <CardContent className="p-4 flex items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-orange-200">{progressStage}</p>
                <p className="text-xs text-orange-200/80 mt-0.5">Creating your guide. Don&apos;t close this page.</p>
              </div>
              <div className="w-24 h-2 rounded-full bg-[#2A2A2A] overflow-hidden">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-orange-500" style={{ animationDuration: "1.5s" }} />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mb-6">
          <Button
            className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 gap-2"
            size="lg"
            onClick={() => {
              setCustomizationScript(scripts[0] ?? null);
              setCustomizationScripts(undefined);
              setCustomizationModalOpen(true);
            }}
            disabled={guideLoading || scripts.length === 0}
          >
            {guideLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <FileText className="w-5 h-5" />
            )}
            Create Video Guide
          </Button>
        </div>

        <div className="space-y-6 mb-8">
          {scripts.map((script, index) => (
            <Card key={script.id} className="border-[#2A2A2A] bg-[#1A1A1A] overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <span className="inline-block text-xs font-medium text-orange-500 uppercase tracking-wide mb-1">Angle</span>
                    <p className="font-medium text-white">{script.title}</p>
                    <p className="text-xs text-[#A0A0A0]">{script.length}s • Hook + Body + CTA</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Select
                      value={regenerateAngleByIndex[index] ?? ((SCRIPT_ANGLES as readonly string[]).includes(script.title) ? script.title : SCRIPT_ANGLES[0])}
                      onValueChange={(v) => setRegenerateAngleByIndex((prev) => ({ ...prev, [index]: v }))}
                    >
                      <SelectTrigger className="w-[180px] h-8 border-[#2A2A2A] text-[#A0A0A0] bg-[#0F0F0F] text-xs">
                        <SelectValue placeholder="Angle" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1A1A1A] border-[#2A2A2A]">
                        {SCRIPT_ANGLES.map((a) => (
                          <SelectItem key={a} value={a} className="text-sm">{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[#2A2A2A] text-[#A0A0A0]"
                      onClick={() => handleRegenerateScript(index)}
                      disabled={guideLoading || !productId || regeneratingIndex !== null}
                    >
                      {regeneratingIndex === index ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Regenerate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[#2A2A2A] text-[#A0A0A0]"
                      onClick={() => copyScript(script)}
                      disabled={guideLoading}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1.5" />
                      Copy
                    </Button>
                  </div>
                </div>
                <div className="text-sm text-[#B0B0B0] space-y-2 font-mono bg-[#0F0F0F] rounded-lg p-3 overflow-x-auto mb-4">
                  <p><span className="text-orange-500">Hook:</span> <ScriptHighlightedText text={script.hook} /></p>
                  <p><span className="text-orange-500">Body:</span> <ScriptHighlightedText text={script.body} /></p>
                  <p><span className="text-orange-500">CTA:</span> <ScriptHighlightedText text={script.cta} isCta /></p>
                </div>

                <Button
                  className="w-full mt-2 bg-orange-500 hover:bg-orange-600 gap-2"
                  size="lg"
                  onClick={() => {
                    setCustomizationScript(script);
                    setCustomizationScripts(undefined);
                    setCustomizationModalOpen(true);
                  }}
                  disabled={guideLoading}
                >
                  {guideLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <FileText className="w-5 h-5" />
                  )}
                  Create Video Guide for this Script
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {customizationScript && (
          <VideoCustomizationModal
            open={customizationModalOpen}
            onClose={() => {
              if (!guideLoading) {
                setCustomizationModalOpen(false);
                setCustomizationScript(null);
                setCustomizationScripts(null);
              }
            }}
            script={customizationScript}
            scripts={customizationScripts ?? undefined}
            onGenerate={(settings, scriptsWithEdits, platforms) => {
              createVideoGuide(scriptsWithEdits[0], settings, platforms);
            }}
            isGenerating={guideLoading}
            createGuide
          />
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            className="bg-[#1A1A1A] border border-[#2A2A2A] text-[#A0A0A0] hover:bg-[#2A2A2A] gap-2"
            onClick={downloadAllScripts}
          >
            <Download className="w-4 h-4" />
            Download All Scripts (.txt)
          </Button>
          <Button asChild variant="outline" className="border-[#2A2A2A] text-[#A0A0A0]">
            <Link href="/dashboard/digital-products">Create another product</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
