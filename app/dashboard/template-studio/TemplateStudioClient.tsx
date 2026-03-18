"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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
import { Loader2, Sparkles, RefreshCw, ArrowRight, ArrowLeft, Download, Copy, Save } from "lucide-react";
import { getTemplateStudioPrefill, clearTemplateStudioPrefill } from "@/lib/template-studio-prefill";
import { SlideDeck } from "./SlideDeck";
import { SlidePreview } from "./SlidePreview";

type CreationMode = "1" | "2" | "3" | "4" | "5" | "6" | "7";
type TemplateType = "quotes" | "tips" | "affirmations";
type FontStyle = "modern" | "elegant" | "bold" | "minimal";
type SlideItem = { heading: string; body: string; bg_color?: string };
type CaptionItem = { caption: string; hashtags: string; alt_text: string };

const CREATION_MODE_OPTIONS: { value: CreationMode; label: string }[] = [
  { value: "2", label: "Promote My App or Business" },
  { value: "3", label: "Promote My Clothing Brand" },
  { value: "1", label: "Share Knowledge/Tips" },
  { value: "4", label: "Motivational Content" },
  { value: "5", label: "Viral Hook Carousel (For Growth)" },
  { value: "6", label: "Sales/Product Launch Carousel" },
  { value: "7", label: "AI Story" },
];

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

const FONT_OPTIONS: { value: FontStyle; label: string }[] = [
  { value: "modern", label: "Modern" },
  { value: "elegant", label: "Elegant" },
  { value: "bold", label: "Bold" },
  { value: "minimal", label: "Minimal" },
];

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
  const [characters, setCharacters] = useState("");
  const [theme, setTheme] = useState("");
  const [aiStoryTone, setAiStoryTone] = useState("Dramatic");
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [aiStoryLoading, setAiStoryLoading] = useState(false);
  const [aiStoryScenes, setAiStoryScenes] = useState<{ sceneNumber: number; dialogue: string; imagePrompt: string }[]>([]);

  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [captions, setCaptions] = useState<CaptionItem[]>([]);
  const [captionsLoading, setCaptionsLoading] = useState(false);
  const [packName, setPackName] = useState("");
  const [savingPack, setSavingPack] = useState(false);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const searchParams = useSearchParams();

  const { toast } = useToast();

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

  const handleGetCaptions = useCallback(async () => {
    if (slides.length === 0) return;
    setCaptionsLoading(true);
    try {
      const res = await fetch("/api/template-studio/generate-captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: niche.trim(),
          slides: slides.map((s) => ({ heading: s.heading, body: s.body })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate captions");
      const list = Array.isArray(data.captions) ? data.captions : [];
      const padded = slides.map((_, i) => {
        const c = list[i];
        return c
          ? { caption: c.caption ?? "", hashtags: c.hashtags ?? "", alt_text: c.alt_text ?? "" }
          : { caption: "", hashtags: "", alt_text: "" };
      });
      setCaptions(padded);
      toast({ title: "Captions generated", description: "Edit any field or copy all." });
    } catch (e) {
      toast({
        title: "Failed to generate captions",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setCaptionsLoading(false);
    }
  }, [slides, niche, toast]);

  const updateCaption = (index: number, field: keyof CaptionItem, value: string) => {
    setCaptions((prev) => {
      const next = [...prev];
      if (!next[index]) next[index] = { caption: "", hashtags: "", alt_text: "" };
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleCopyAllCaptions = useCallback(() => {
    const lines: string[] = [];
    slides.forEach((_, i) => {
      const c = captions[i];
      if (!c) return;
      lines.push(`--- Slide ${i + 1} ---`);
      lines.push(`Caption:\n${c.caption || "(none)"}`);
      lines.push(`Hashtags: ${c.hashtags || "(none)"}`);
      lines.push(`Alt text: ${c.alt_text || "(none)"}`);
      lines.push("");
    });
    const text = lines.join("\n");
    navigator.clipboard.writeText(text).then(
      () => toast({ title: "Copied", description: "All captions copied to clipboard." }),
      () => toast({ title: "Copy failed", variant: "destructive" })
    );
  }, [slides, captions, toast]);

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
          captionsJson: slides.map((_, i) => captions[i] ?? { caption: "", hashtags: "", alt_text: "" }),
          status: captions.length > 0 ? "complete" : "draft",
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
  }, [packName, niche, templateType, brandPrimary, brandSecondary, fontStyle, slides, captions, toast]);

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
  }, [mode, brandName, niche, templateType, slideCount, slideCountViral, brandPrimary, brandSecondary, fontStyle, productDescription, targetAudience, painPoints, brandVibe, postGoal, hookAngle, ctaGoal]);

  useEffect(() => {
    if (setupLoaded || searchParams.get("packId")) return;
    (async () => {
      try {
        const res = await fetch("/api/template-studio/setup");
        if (!res.ok) return;
        const data = await res.json();
        setSetupLoaded(true);
        if (data.mode && ["1", "2", "3", "4", "5", "6"].includes(data.mode)) setMode(data.mode);
        const i = data.inputs || {};
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
      } catch {
        setSetupLoaded(true);
      }
    })();
  }, [setupLoaded, searchParams]);

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
        setCaptions(
          capList.map((c: { caption?: string; hashtags?: string; alt_text?: string }) => ({
            caption: c.caption ?? "",
            hashtags: c.hashtags ?? "",
            alt_text: c.alt_text ?? "",
          }))
        );
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

  const canProceedStep1 =
    mode === "7"
      ? (characters.trim().length > 0 && theme.trim().length > 0)
      : mode === "1" || mode === "4"
        ? niche.trim().length > 0
        : mode === "2" || mode === "6"
          ? brandName.trim().length > 0
          : mode === "5"
            ? niche.trim().length > 0
            : (brandName.trim().length > 0);

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
          Step 3 — Get Captions
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
                onValueChange={(v) => setMode(v as CreationMode)}
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

            {mode === "7" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="characters">Characters</Label>
                  <Input
                    id="characters"
                    placeholder="e.g. Banana, Strawberry, Cherry"
                    value={characters}
                    onChange={(e) => setCharacters(e.target.value)}
                  />
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

            {mode !== "7" && (
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

            <div className="flex justify-end">
              <Button
                onClick={async () => {
                  if (mode === "7") {
                    setAiStoryLoading(true);
                    setAiStoryScenes([]);
                    try {
                      const res = await fetch("/api/content-studio/ai-story/generate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          characters: characters.trim(),
                          theme: theme.trim(),
                          tone: aiStoryTone,
                          episodeNumber,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) {
                        throw new Error(data?.error ?? "Request failed");
                      }
                      const scenesList = Array.isArray(data.scenes) ? data.scenes : [];
                      setAiStoryScenes(scenesList.map((s: { sceneNumber?: number; dialogue?: string; imagePrompt?: string }, i: number) => ({
                        sceneNumber: typeof s.sceneNumber === "number" && s.sceneNumber >= 1 ? s.sceneNumber : i + 1,
                        dialogue: typeof s.dialogue === "string" ? s.dialogue : "",
                        imagePrompt: typeof s.imagePrompt === "string" ? s.imagePrompt : "",
                      })));
                      toast({ title: "AI Story generated", description: `${scenesList.length} scenes ready.` });
                    } catch (e) {
                      toast({
                        title: "AI Story failed",
                        description: e instanceof Error ? e.message : "Something went wrong",
                        variant: "destructive",
                      });
                    } finally {
                      setAiStoryLoading(false);
                    }
                  } else {
                    await saveSetup();
                    setStep(2);
                  }
                }}
                disabled={!canProceedStep1 || (mode === "7" && aiStoryLoading)}
              >
                Next — Generate content
                {mode === "7" && aiStoryLoading ? (
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4 ml-2" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        </>
      )}

      {step === 1 && mode === "7" && aiStoryScenes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Scenes</CardTitle>
            <CardDescription>Generated scenes for your AI Story.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {aiStoryScenes.map((scene) => (
                <Card key={scene.sceneNumber}>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm">Scene {scene.sceneNumber}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-2 text-sm">
                    <p className="font-medium">Dialogue</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{scene.dialogue}</p>
                    <p className="font-medium">Image prompt</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{scene.imagePrompt}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
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
                      Next — Get captions
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
              <CardTitle>Get Captions</CardTitle>
              <CardDescription>
                Generate Instagram/TikTok captions for each slide. Edit below then copy all.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleGetCaptions}
                  disabled={captionsLoading}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {captionsLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Get Captions
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCopyAllCaptions}
                  disabled={captions.length === 0}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy All Captions
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSavePack}
                  disabled={savingPack}
                >
                  {savingPack ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Pack
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(2)}
                  className="text-muted-foreground"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to slides
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="overflow-x-auto pb-4">
            <div className="flex gap-6" style={{ minWidth: "min-content" }}>
              {slides.map((slide, index) => (
                <Card key={index} className="shrink-0 w-[280px] flex flex-col">
                  <CardContent className="p-3 flex flex-col gap-3">
                    <div className="flex justify-center">
                      <SlidePreview
                        slide={slide}
                        brandPrimary={brandPrimary}
                        brandSecondary={brandSecondary}
                        fontStyle={fontStyle}
                        brandName={brandName.trim() || "Content Flywheel"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Caption</Label>
                      <Textarea
                        value={captions[index]?.caption ?? ""}
                        onChange={(e) => updateCaption(index, "caption", e.target.value)}
                        placeholder="2-3 sentences + CTA"
                        rows={3}
                        className="resize-none text-sm"
                      />
                      <Label className="text-xs">Hashtags</Label>
                      <Input
                        value={captions[index]?.hashtags ?? ""}
                        onChange={(e) => updateCaption(index, "hashtags", e.target.value)}
                        placeholder="15 hashtags"
                        className="text-sm"
                      />
                      <Label className="text-xs">Alt text</Label>
                      <Textarea
                        value={captions[index]?.alt_text ?? ""}
                        onChange={(e) => updateCaption(index, "alt_text", e.target.value)}
                        placeholder="1 sentence for accessibility"
                        rows={2}
                        className="resize-none text-sm"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
