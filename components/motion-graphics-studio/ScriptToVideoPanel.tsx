"use client";

/**
 * Admin → Motion Graphics Studio → AI Script to Video
 *
 * Two modes:
 *
 *  1. Content Mode (new) — paste Reddit post / complaint → structured AI
 *     storyboard (analysis + 5-scene shortForm + longForm plan) → saved as
 *     a ContentProject → opens the storyboard review page.
 *
 *  2. Custom Script (original) — paste a script → POST
 *     /api/admin/motion-graphics/ai/generate → opens the Template Builder.
 *     Preserves 100% of the original behaviour.
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles,
  Loader2,
  MessageSquare,
  FileText,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from "lucide-react";
import type { AspectRatio, CfMentionMode, ContentMode, TemplateCategory } from "@/lib/motion-graphics/types";
import { useVoiceOptions } from "./useVoiceOptions";

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTENT_MODES: { id: ContentMode; label: string; emoji: string; description: string; inputLabel: string }[] = [
  {
    id: "reddit-reaction",
    label: "Reddit Reaction",
    emoji: "🟠",
    description: "React to a Reddit post with your unique take",
    inputLabel: "Paste the Reddit post, comment, or complaint",
  },
  {
    id: "creator-complaint",
    label: "Creator Complaint Breakdown",
    emoji: "😤",
    description: "Break down a creator frustration and offer the real solution",
    inputLabel: "Paste the complaint, rant, or problem",
  },
  {
    id: "startup-breakdown",
    label: "Startup Breakdown",
    emoji: "🚀",
    description: "Analyse a startup story, failure, or strategy",
    inputLabel: "Paste the startup story or problem",
  },
  {
    id: "digital-product-advice",
    label: "Digital Product Advice",
    emoji: "📦",
    description: "Answer a question about selling digital products",
    inputLabel: "Paste the question or complaint about digital products",
  },
  {
    id: "product-demo",
    label: "Product Demo",
    emoji: "📱",
    description: "Showcase a product feature or workflow",
    inputLabel: "Describe what you want to demo",
  },
  {
    id: "tutorial",
    label: "Tutorial",
    emoji: "🎓",
    description: "Teach a specific skill or process step-by-step",
    inputLabel: "Paste or describe what to teach",
  },
  {
    id: "storytime",
    label: "Storytime",
    emoji: "📖",
    description: "Tell a relatable story with a lesson at the end",
    inputLabel: "Paste the story or describe what happened",
  },
  {
    id: "short-form",
    label: "Short-Form Video",
    emoji: "⚡",
    description: "Any topic — 30–60 seconds, optimised for engagement",
    inputLabel: "Paste your topic, idea, or source material",
  },
  {
    id: "long-form-youtube",
    label: "Long-Form YouTube",
    emoji: "▶️",
    description: "Plan a 5–10 minute deep-dive video with chapter structure",
    inputLabel: "Paste your topic, research, or source material",
  },
];

const ORIGINAL_CATEGORY_OPTIONS: { id: TemplateCategory; label: string }[] = [
  { id: "tiktok", label: "TikTok" },
  { id: "instagram_reel", label: "Instagram Reel" },
  { id: "youtube_shorts", label: "YouTube Shorts" },
  { id: "product_demo", label: "Product Demo" },
  { id: "feature_showcase", label: "Feature Showcase" },
  { id: "tutorial", label: "Tutorial" },
  { id: "promo_video", label: "Promo Video" },
  { id: "landing_page_video", label: "Landing Page Video" },
];

const NO_VOICE = "__none";

// Loading steps shown during AI generation
const LOADING_STEPS = [
  "Analysing the complaint…",
  "Finding the strongest hook…",
  "Writing the response…",
  "Building the storyboard…",
  "Matching animations…",
  "Preparing the preview…",
];

// ─── Content Mode Panel ────────────────────────────────────────────────────────

const ContentModePanel: React.FC = () => {
  const router = useRouter();

  const [selectedMode, setSelectedMode] = useState<ContentMode | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [mainOpinion, setMainOpinion] = useState("");
  const [desiredCta, setDesiredCta] = useState("");
  const [cfMention, setCfMention] = useState<CfMentionMode>("subtle");
  const [videoDuration, setVideoDuration] = useState("30-60 seconds");
  const [tone, setTone] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Cycle through loading steps
  React.useEffect(() => {
    if (!loading) { setLoadingStep(0); return; }
    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % LOADING_STEPS.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [loading]);

  const activeModeConfig = CONTENT_MODES.find((m) => m.id === selectedMode);
  const isRedditStyle =
    selectedMode === "reddit-reaction" || selectedMode === "creator-complaint";

  const handleGenerate = async () => {
    if (!selectedMode) { setError("Choose a content mode first."); return; }
    if (!sourceText.trim()) { setError("Paste your source material first."); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/motion-graphics/ai/reddit-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentMode: selectedMode,
          sourceText,
          sourceUrl: sourceUrl || undefined,
          targetAudience: targetAudience || undefined,
          mainOpinion: mainOpinion || undefined,
          desiredCta: desiredCta || undefined,
          cfMention,
          videoDuration: videoDuration || undefined,
          tone: tone || undefined,
          aspectRatio,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      router.push(`/dashboard/admin/motion-graphics-studio/projects/${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Mode grid */}
      <div>
        <Label className="text-sm font-semibold">What are we creating?</Label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {CONTENT_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => { setSelectedMode(mode.id); setError(null); }}
              className={`relative p-2.5 rounded-lg border text-left transition-all ${
                selectedMode === mode.id
                  ? "border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30"
                  : "border-border hover:border-orange-500/40"
              }`}
            >
              {selectedMode === mode.id && (
                <CheckCircle2 size={12} className="absolute top-1.5 right-1.5 text-orange-500" />
              )}
              <span className="text-lg block mb-0.5">{mode.emoji}</span>
              <span className="text-xs font-medium block leading-tight">{mode.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Source material */}
      {selectedMode && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <Label htmlFor="source-text">
                {activeModeConfig?.inputLabel ?? "Paste your source material"}
              </Label>
              {isRedditStyle && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Paste the full post, comment, question, or complaint — the more context, the better.
                </p>
              )}
              <Textarea
                id="source-text"
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder={
                  isRedditStyle
                    ? `e.g.\n"I created a digital product, posted about it three times, and got no sales. I'm starting to think the product is just bad."`
                    : "Paste your content here…"
                }
                className="mt-1.5 min-h-[160px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Aspect ratio</Label>
                <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as AspectRatio)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9:16">9:16 — Vertical (TikTok/Reels)</SelectItem>
                    <SelectItem value="16:9">16:9 — Landscape (YouTube)</SelectItem>
                    <SelectItem value="1:1">1:1 — Square</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Mention Content Flywheel</Label>
                <Select value={cfMention} onValueChange={(v) => setCfMention(v as CfMentionMode)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Off — don&apos;t mention it</SelectItem>
                    <SelectItem value="subtle">Subtle — only where natural</SelectItem>
                    <SelectItem value="direct">Direct — clear CTA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Advanced options */}
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Optional settings
            </button>

            {showAdvanced && (
              <div className="space-y-3 pl-3 border-l">
                <div>
                  <Label className="text-xs">Source URL (optional)</Label>
                  <Input
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://reddit.com/r/..."
                    className="mt-1 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Target audience</Label>
                  <Input
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="e.g. new digital product creators, side hustlers"
                    className="mt-1 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Main opinion or lesson</Label>
                  <Input
                    value={mainOpinion}
                    onChange={(e) => setMainOpinion(e.target.value)}
                    placeholder="e.g. The product is not the problem — the marketing is"
                    className="mt-1 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Desired call to action</Label>
                  <Input
                    value={desiredCta}
                    onChange={(e) => setDesiredCta(e.target.value)}
                    placeholder="e.g. Try Content Flywheel free / Follow for more"
                    className="mt-1 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Target duration</Label>
                    <Input
                      value={videoDuration}
                      onChange={(e) => setVideoDuration(e.target.value)}
                      placeholder="30-60 seconds"
                      className="mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Tone</Label>
                    <Input
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      placeholder="e.g. direct, honest, empathetic"
                      className="mt-1 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              onClick={handleGenerate}
              disabled={loading || !selectedMode || !sourceText.trim()}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-2" />
                  {LOADING_STEPS[loadingStep]}
                </>
              ) : (
                <>
                  <Sparkles size={14} className="mr-2" />
                  Generate storyboard
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ─── Original Script Panel (preserved exactly) ────────────────────────────────

const CustomScriptPanel: React.FC = () => {
  const router = useRouter();
  const [script, setScript] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("tiktok");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [tone, setTone] = useState("");
  const [voiceId, setVoiceId] = useState<string>(NO_VOICE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { voices, error: voicesError } = useVoiceOptions();

  const handleGenerate = async () => {
    if (!script.trim()) { setError("Paste a script first."); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/motion-graphics/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script,
          category,
          aspectRatio,
          tone: tone || undefined,
          voiceId: voiceId === NO_VOICE ? undefined : voiceId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      router.push(`/dashboard/admin/motion-graphics-studio/templates/${data.template.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardContent className="p-5 space-y-4">
          <div>
            <Label htmlFor="mgs-script">Paste your script</Label>
            <Textarea
              id="mgs-script"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Paste the full voiceover script here. The AI will split it into scenes, choose animations and transitions, position on-screen text, and draft captions."
              className="mt-1.5 min-h-[220px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Template category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as TemplateCategory)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORIGINAL_CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Aspect ratio</Label>
              <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as AspectRatio)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9:16">9:16 — Vertical</SelectItem>
                  <SelectItem value="16:9">16:9 — Landscape</SelectItem>
                  <SelectItem value="1:1">1:1 — Square</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="mgs-tone">Tone (optional)</Label>
            <Input
              id="mgs-tone"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="e.g. energetic, calm product demo, playful"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label>Voiceover voice (optional)</Label>
            <Select value={voiceId} onValueChange={setVoiceId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Choose a voice" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_VOICE}>No voiceover — add it later per scene</SelectItem>
                {voices.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}{v.category ? ` — ${v.category}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Pick a voice and every scene gets real ElevenLabs audio automatically.
            </p>
            {voicesError && <p className="text-xs text-destructive mt-1">{voicesError}</p>}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Sparkles size={16} className="mr-2" />}
            {loading ? "Generating scenes…" : "Generate video from script"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Tab switcher ─────────────────────────────────────────────────────────────

type InputMode = "content-mode" | "custom-script";

export const ScriptToVideoPanel: React.FC = () => {
  const [inputMode, setInputMode] = useState<InputMode>("content-mode");

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setInputMode("content-mode")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
            inputMode === "content-mode"
              ? "border-orange-500 bg-orange-500/10 text-foreground"
              : "border-border text-muted-foreground hover:border-orange-500/30"
          }`}
        >
          <MessageSquare size={14} />
          Content Mode
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-orange-500/20 text-orange-400 border-0">
            New
          </Badge>
        </button>
        <button
          type="button"
          onClick={() => setInputMode("custom-script")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
            inputMode === "custom-script"
              ? "border-orange-500 bg-orange-500/10 text-foreground"
              : "border-border text-muted-foreground hover:border-orange-500/30"
          }`}
        >
          <FileText size={14} />
          Use my own script
        </button>
      </div>

      {inputMode === "content-mode" ? <ContentModePanel /> : <CustomScriptPanel />}
    </div>
  );
};
