"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  Loader2,
  RefreshCw,
  Sparkles,
  FileText,
  Info,
  Clapperboard,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { VIDEO_LENGTH_OPTIONS, DEFAULT_VIDEO_LENGTH_SEC } from "@/lib/video-length-options";
import { toSpeakable } from "@/lib/to-speakable";

const TIKTOK_PREFS_KEY = "tiktok-shop-preferences";

const STEPS = [
  { id: 1, label: "Product" },
  { id: 2, label: "Breakdown" },
  { id: 3, label: "Script" },
  { id: 4, label: "Video" },
  { id: 5, label: "Guides" },
] as const;

const DEFAULT_VOICE_ID = "pNInz6obpgDQGcFmaJgB";

type ElevenLabsVoiceOption = { voice_id: string; name: string; description?: string };

const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_IMAGE_EXT = ".jpg,.jpeg,.png,.webp";

const HOOK_OPTIONS = [
  { id: "problem", label: "Problem", desc: "Start with the pain" },
  { id: "story", label: "Story", desc: "Relatable scenario" },
  { id: "controversial", label: "Controversial", desc: "Bold stance" },
  { id: "before-after", label: "Before/After", desc: "Transformation" },
  { id: "comparison", label: "Comparison", desc: "vs alternatives" },
  { id: "tiktok-made-me-buy", label: "TikTok made me buy it", desc: "FOMO, viral" },
  { id: "question", label: "Question", desc: "Compelling question" },
  { id: "stat", label: "Stat", desc: "Surprising number" },
];

const TONE_OPTIONS = [
  { id: "soft-aesthetic", label: "Soft aesthetic" },
  { id: "aggressive", label: "Aggressive" },
  { id: "luxury", label: "Luxury" },
  { id: "budget", label: "Budget" },
  { id: "ugc-style", label: "UGC style" },
];

type ProductBreakdown = {
  productName: string;
  productDescription: string;
  category: string;
  targetAudience: string;
  corePainPoints: string[];
  buyingObjections: string[];
  emotionalTriggers: string[];
  whyBuy: string[];
};

type ScriptResult = {
  fullScript: string;
  scenes: { hook: string; pain: string; solution: string; proof_points?: string[]; cta: string };
  title?: string;
};

const SCRIPT_VARIATION_LABELS = ["Story", "Problem/Solution", "Social proof", "Curiosity"] as const;

export default function TikTokShopFlow() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [productLink, setProductLink] = useState("");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productImage, setProductImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<ProductBreakdown | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [scriptResults, setScriptResults] = useState<ScriptResult[]>([]);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [hookStyle, setHookStyle] = useState("tiktok-made-me-buy");
  const [tone, setTone] = useState("ugc-style");
  const [targetDurationSec, setTargetDurationSec] = useState(DEFAULT_VIDEO_LENGTH_SEC);
  const [affiliateProductImageUrl, setAffiliateProductImageUrl] = useState<string | null>(null);
  const [selectedScriptIndex, setSelectedScriptIndex] = useState(0);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoiceOption[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState(DEFAULT_VOICE_ID);
  const [affiliateVideoGenerating, setAffiliateVideoGenerating] = useState(false);
  const [affiliateVideoUrl, setAffiliateVideoUrl] = useState<string | null>(null);
  const [affiliateVideoError, setAffiliateVideoError] = useState<string | null>(null);
  const [expandedScriptIndex, setExpandedScriptIndex] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TIKTOK_PREFS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Record<string, unknown>;
        if (typeof p.targetDurationSec === "number") setTargetDurationSec(p.targetDurationSec);
        if (typeof p.hookStyle === "string") setHookStyle(p.hookStyle);
        if (typeof p.tone === "string") setTone(p.tone);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const prefs = { targetDurationSec, hookStyle, tone };
    try {
      localStorage.setItem(TIKTOK_PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  }, [targetDurationSec, hookStyle, tone]);

  useEffect(() => {
    if (step !== 4 || elevenLabsVoices.length > 0) return;
    (async () => {
      try {
        const res = await fetch("/api/elevenlabs/voices");
        const data = (await res.json().catch(() => ({}))) as {
          voices?: ElevenLabsVoiceOption[];
          error?: string;
        };
        if (res.ok && Array.isArray(data.voices) && data.voices.length > 0) {
          setElevenLabsVoices(data.voices);
          setSelectedVoiceId(data.voices[0]!.voice_id);
        }
      } catch {
        // keep DEFAULT_VOICE_ID
      }
    })();
  }, [step, elevenLabsVoices.length]);

  const getProductImageBase64 = (): Promise<string | undefined> => {
    if (!productImage) return Promise.resolve(undefined);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(productImage);
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !ACCEPTED_IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) return;
    setProductImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !ACCEPTED_IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) return;
    setProductImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const canProceedStep1 = productLink.trim() || productName.trim() || productDescription.trim() || productImage;
  const canProceedStep2 = !!breakdown;
  const canProceedStep3 = scriptResults.length >= 4;

  /**
   * Steps 4–5 need product metadata. Prefer API breakdown, then Step 1 description; if those are
   * empty but four scripts exist (e.g. tab jump or trimmed fields), derive minimal context from the
   * first variation so Video / Guides still mount and actions have copy to use.
   */
  const affiliateProductContext = useMemo((): ProductBreakdown | null => {
    if (breakdown) return breakdown;
    const empties = {
      category: "",
      targetAudience: "",
      corePainPoints: [] as string[],
      buyingObjections: [] as string[],
      emotionalTriggers: [] as string[],
      whyBuy: [] as string[],
    };
    const desc = productDescription.trim();
    if (desc) {
      return {
        productName: productName.trim() || "Product",
        productDescription: desc,
        ...empties,
      };
    }
    if (scriptResults.length >= 4) {
      const first = scriptResults[0];
      const fromScript =
        (typeof first?.fullScript === "string" && first.fullScript.trim()) ||
        [first?.scenes?.hook, first?.scenes?.pain, first?.scenes?.solution].filter(Boolean).join("\n\n").trim();
      if (fromScript) {
        return {
          productName: productName.trim() || "Product",
          productDescription: fromScript.slice(0, 2000),
          ...empties,
        };
      }
    }
    return null;
  }, [breakdown, productName, productDescription, scriptResults]);

  const canShowAffiliateLateSteps =
    scriptResults.length >= 4 && affiliateProductContext != null;

  const runProductBreakdown = async () => {
    if (!canProceedStep1) return;
    setBreakdownLoading(true);
    setBreakdown(null);
    setScriptResults([]);
    try {
      const productImageBase64 = await getProductImageBase64();
      const res = await fetch("/api/tiktok-shop/product-breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productLink: productLink.trim() || undefined,
          productName: productName.trim() || undefined,
          productDescription: productDescription.trim() || undefined,
          productImageBase64,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Breakdown failed");
      const raw = data as ProductBreakdown & { productImageUrl?: string };
      const { productImageUrl: fromBreakdown, ...breakdownPayload } = raw;
      const imgUrl = typeof fromBreakdown === "string" ? fromBreakdown.trim() : "";
      setAffiliateProductImageUrl(imgUrl.startsWith("http") ? imgUrl : null);
      setBreakdown(breakdownPayload);
      setStep(2);
      toast({ title: "AI Breakdown ready", description: "Review and continue to script." });
    } catch (err) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : "Breakdown failed", variant: "destructive" });
    } finally {
      setBreakdownLoading(false);
    }
  };

  const runGenerate4Scripts = async () => {
    const name = breakdown?.productName || productName.trim() || "Product";
    const desc = breakdown?.productDescription || productDescription.trim();
    if (!desc) {
      toast({ title: "Need description", description: "Add product description in Step 1.", variant: "destructive" });
      return;
    }
    setScriptLoading(true);
    setScriptResults([]);
    try {
      const productImageBase64 = await getProductImageBase64();
      const hookStyles = ["story", "problem", "stat", "controversial"] as const;
      const results = await Promise.all(
        hookStyles.map(async (hookKey, i) => {
          const res = await fetch("/api/tiktok-shop/generate-script", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productName: name,
              productDescription: desc,
              productLink: productLink.trim() || undefined,
              productImageBase64,
              videoStyle: "demo",
              targetDurationSec,
              hookStyle: hookKey,
              tone,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error ?? "Script generation failed");
          const img =
            typeof (data as { productImageUrl?: string }).productImageUrl === "string"
              ? (data as { productImageUrl: string }).productImageUrl.trim()
              : "";
          return {
            fullScript: data.fullScript as string,
            scenes: data.scenes as ScriptResult["scenes"],
            title: SCRIPT_VARIATION_LABELS[i],
            productImageUrl: img.startsWith("http") ? img : undefined,
          };
        })
      );
      const firstImg = results.find((r) => r.productImageUrl)?.productImageUrl;
      if (firstImg) setAffiliateProductImageUrl(firstImg);
      const cleaned = results.map(({ productImageUrl: _p, ...rest }) => rest);
      setScriptResults(cleaned);
      setStep(3);
      toast({ title: "4 scripts ready", description: "Continue to create a video guide for each." });
    } catch (err) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : "Script failed", variant: "destructive" });
    } finally {
      setScriptLoading(false);
    }
  };


  const scenesToHookBodyCta = (s: ScriptResult["scenes"]) => {
    const bodyParts = [s.pain, s.solution];
    if (s.proof_points?.length) bodyParts.push(s.proof_points.join(" "));
    return {
      hook: s.hook,
      body: bodyParts.filter(Boolean).join("\n\n"),
      cta: s.cta,
    };
  };

  const resolveProductImagePublicUrl = async (): Promise<string> => {
    if (affiliateProductImageUrl?.startsWith("http")) return affiliateProductImageUrl;
    const b64 = await getProductImageBase64();
    if (!b64) throw new Error("Add a product image in Step 1, or run AI Breakdown after uploading one.");
    const upRes = await fetch("/api/tiktok-shop/upload-product-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productImageBase64: b64 }),
    });
    const upData = (await upRes.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!upRes.ok) throw new Error(upData.error ?? "Could not upload product image.");
    const url = typeof upData.url === "string" ? upData.url.trim() : "";
    if (!url.startsWith("http")) throw new Error("No public image URL returned.");
    setAffiliateProductImageUrl(url);
    return url;
  };

  const runGenerateAffiliateVideo = async () => {
    const ctx = affiliateProductContext;
    if (!ctx || scriptResults.length < 4) return;
    const script = scriptResults[selectedScriptIndex];
    if (!script?.fullScript?.trim()) {
      toast({ title: "Missing script", description: "Select a script variation.", variant: "destructive" });
      return;
    }
    setAffiliateVideoGenerating(true);
    setAffiliateVideoError(null);
    setAffiliateVideoUrl(null);
    try {
      const imageUrl = await resolveProductImagePublicUrl();
      const fullScript = script.fullScript.trim();
      const speakable = toSpeakable(fullScript);
      const voRes = await fetch("/api/ai-coach/voice-over", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: speakable,
          voiceId: selectedVoiceId || DEFAULT_VOICE_ID,
        }),
      });
      const voData = (await voRes.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!voRes.ok) throw new Error(voData.error ?? "Voiceover failed");
      const voiceoverUrl = typeof voData.url === "string" ? voData.url.trim() : "";
      if (!voiceoverUrl.startsWith("http")) throw new Error("No voiceover URL returned.");

      // Split into 3 scenes (hook / body / CTA) so each gets its own Ken Burns segment
      const totalDur = Math.max(10, targetDurationSec || 30);
      const hookText = script.scenes.hook.trim();
      const bodyParts = [script.scenes.pain, script.scenes.solution];
      if (script.scenes.proof_points?.length) bodyParts.push(script.scenes.proof_points.join(" "));
      const bodyText = bodyParts.filter(Boolean).join(" ").trim();
      const ctaText = script.scenes.cta.trim();
      // Allocate: hook 25%, body 55%, cta 20% — min 3s each
      const hookDur = Math.max(3, Math.round(totalDur * 0.25));
      const ctaDur = Math.max(3, Math.round(totalDur * 0.20));
      const bodyDur = Math.max(3, totalDur - hookDur - ctaDur);
      // Pass scenes inline to compile (skips DB save, voiceover via global voiceoverUrl)
      const guideScenes = [
        { duration: hookDur, image_url: imageUrl, video_url: null, script_text: hookText },
        { duration: bodyDur, image_url: imageUrl, video_url: null, script_text: bodyText },
        { duration: ctaDur, image_url: imageUrl, video_url: null, script_text: ctaText },
      ];

      const compileRes = await fetch("/api/videos/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guideScenes,
          voiceoverUrl,
          transition: "fade",
          backgroundMusic: "none",
          outputAspect: "9:16",
        }),
      });
      const compileText = await compileRes.text();
      let compileData: { url?: string; error?: string } = {};
      try { compileData = JSON.parse(compileText); } catch { /* non-JSON response */ }
      if (!compileRes.ok) throw new Error(compileData.error ?? `Compile error (${compileRes.status}): ${compileText.slice(0, 200)}`);
      const mp4 = typeof compileData.url === "string" ? compileData.url.trim() : "";
      if (!mp4.startsWith("http")) throw new Error("No MP4 URL returned");
      setAffiliateVideoUrl(mp4);
      toast({ title: "Video ready", description: "Your vertical MP4 is ready to download." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setAffiliateVideoError(msg);
      toast({ title: "Video failed", description: msg, variant: "destructive" });
    } finally {
      setAffiliateVideoGenerating(false);
    }
  };

  /** Go to video customization page (guides flow). User completes customization there before generating the guide. */
  const goToVideoCustomization = (script: ScriptResult) => {
    const ctx = affiliateProductContext;
    if (!ctx) return;
    const { hook, body, cta } = scenesToHookBodyCta(script.scenes);
    const title = (script as ScriptResult & { title?: string }).title ?? "TikTok Shop Script";
    const scriptForVideo = {
      id: script.id ?? "tiktok-1",
      title,
      length: targetDurationSec ?? 30,
      hook,
      body,
      cta,
    };
    try {
      sessionStorage.setItem("selectedScriptsForVideos", JSON.stringify([scriptForVideo]));
      sessionStorage.setItem("productContextForVideos", JSON.stringify({ productId: undefined }));
      sessionStorage.setItem("digitalProductForm", JSON.stringify({
        productName: ctx.productName,
        productDescription: ctx.productDescription,
      }));
    } catch {
      // ignore
    }
    router.push("/dashboard/digital-products/videos");
  };

  return (
    <TooltipProvider delayDuration={300}>
    <main className="p-6 md:p-10 max-w-3xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-orange-500 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </Link>

      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
        TikTok Affiliate Control Center
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Product → AI Breakdown → Script → Video Creator (optional MP4) → Video Creation Guides. Export a vertical voiceover video with captions, or follow step-by-step guides.
      </p>

      {/* Stepper: compact 5-column row — no scroll; step index + label stacked to save width */}
      <div className="mb-10 grid w-full grid-cols-5 gap-1 sm:gap-1.5">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            className={`flex min-h-[2.625rem] flex-col items-center justify-center gap-0.5 rounded-md px-0.5 py-1 text-[10px] font-medium leading-none transition-colors sm:min-h-0 sm:gap-1 sm:px-1 sm:py-1.5 sm:text-xs ${
              step === s.id
                ? "bg-orange-500 text-white"
                : "bg-gray-200 dark:bg-[#2A2A2A] text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-[#3A3A3A] dark:hover:text-white"
            }`}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/20 text-[9px] sm:h-5 sm:w-5 sm:text-[10px]">
              {s.id}
            </span>
            <span className="max-w-full text-center">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Step 1: Product Intelligence */}
      {step === 1 && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50/90 dark:bg-[#141414]/90 px-3 py-2">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Need product ideas? Browse trending products on Kalodata
            </p>
            <Button variant="outline" size="sm" className="h-7 shrink-0 px-2.5 text-xs" asChild>
              <a href="https://www.kalodata.com" target="_blank" rel="noopener noreferrer">
                Find Trending Products
              </a>
            </Button>
          </div>
        <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm">1</span>
              Product Intelligence
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Add your product via link, name, or image. We&apos;ll analyze it with AI.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>TikTok Shop or product link</Label>
              <Input
                placeholder="https://..."
                value={productLink}
                onChange={(e) => setProductLink(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Product name (if no link)</Label>
              <Input
                placeholder="e.g. Vitamin C Serum"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Product description *</Label>
              <Textarea
                placeholder="What it is, who it's for, benefits, pain points, how to use..."
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label>Or upload image</Label>
              <div
                onDrop={handleImageDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed rounded-lg p-6 text-center"
              >
                <input type="file" accept={ACCEPTED_IMAGE_EXT} onChange={handleImageChange} className="hidden" id="product-img" />
                <label htmlFor="product-img" className="cursor-pointer block">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Product" className="max-h-24 mx-auto rounded" />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto text-gray-500 dark:text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">Drop or click to upload</p>
                    </>
                  )}
                </label>
              </div>
            </div>
            <Button
              onClick={runProductBreakdown}
              disabled={!canProceedStep1 || breakdownLoading}
              className="w-full gap-2"
            >
              {breakdownLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {breakdownLoading ? "Analyzing..." : "Get AI Breakdown"}
            </Button>
          </CardContent>
        </Card>
        </>
      )}

      {/* Step 2: AI Breakdown */}
      {step === 2 && breakdown && (
        <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm">2</span>
              AI Product Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-500 mb-1">Category</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{breakdown.category}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-500 mb-1">Target audience</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">{breakdown.targetAudience}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-500 mb-1">Pain points</p>
              <ul className="text-sm list-disc list-inside space-y-0.5 text-gray-600 dark:text-gray-300">{breakdown.corePainPoints.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-500 mb-1">Objections</p>
              <ul className="text-sm list-disc list-inside space-y-0.5 text-gray-600 dark:text-gray-300">{breakdown.buyingObjections.map((o, i) => <li key={i}>{o}</li>)}</ul>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-500 mb-1">Emotional triggers</p>
              <ul className="text-sm list-disc list-inside space-y-0.5 text-gray-600 dark:text-gray-300">{breakdown.emotionalTriggers.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-500 mb-1">Why buy</p>
              <ul className="text-sm list-disc list-inside space-y-0.5 text-gray-600 dark:text-gray-300">{breakdown.whyBuy.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={runGenerate4Scripts} disabled={scriptLoading} className="gap-2 flex-1">
                {scriptLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {scriptLoading ? "Generating 4 scripts…" : "Generate 4 Script Variations"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Script Builder */}
      {step === 3 && (
        <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm">3</span>
              Script Builder
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">Generate 4 script variations (Story, Problem/Solution, Social proof, Curiosity). Then render an MP4 in Video Creator or create a video guide for any of them.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="mb-2 block">Video length</Label>
              <p className="text-xs text-gray-700 dark:text-gray-500 mb-3">Choose target duration before generating scripts. Word count and guide scenes will match.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {VIDEO_LENGTH_OPTIONS.map((opt) => {
                  const selected = targetDurationSec === opt.seconds;
                  return (
                    <button
                      key={opt.seconds}
                      type="button"
                      onClick={() => {
                        if (opt.seconds !== targetDurationSec) {
                          setTargetDurationSec(opt.seconds);
                          setScriptResults([]); // clear stale scripts so user regenerates at new length
                        }
                      }}
                      className={`rounded-lg border-2 p-3 text-left transition-all ${
                        selected
                          ? "border-orange-500 bg-orange-500/20"
                          : "border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#0F0F0F] hover:border-gray-300 dark:hover:border-[#3A3A3A]"
                      }`}
                    >
                      <span className="block font-semibold text-sm text-gray-900 dark:text-white">{opt.seconds}s</span>
                      <span className="block text-xs text-gray-600 dark:text-gray-400 mt-0.5">{opt.sublabel}</span>
                      <span className="block text-xs text-gray-600 dark:text-gray-500 mt-1">{opt.wordRange}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Tone</Label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full max-w-xs h-10 rounded-md border border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#0F0F0F] text-gray-900 dark:text-white px-3 text-sm mt-1"
              >
                {TONE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
            {scriptResults.length < 4 ? (
              <Button onClick={runGenerate4Scripts} disabled={scriptLoading} className="w-full gap-2">
                {scriptLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {scriptLoading ? "Generating 4 script variations…" : "Generate 4 Script Variations"}
              </Button>
            ) : (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400">4 script variations ready. Continue to render a video or open video creation guides.</p>
                <div className="space-y-2">
                  {scriptResults.map((s, i) => {
                    const isExpanded = expandedScriptIndex === i;
                    return (
                      <div key={i} className="rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
                        <button
                          type="button"
                          className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-[#1f1f1f] transition-colors"
                          onClick={() => setExpandedScriptIndex(isExpanded ? null : i)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-orange-400">{(s as ScriptResult & { title?: string }).title ?? `Script ${i + 1}`}</p>
                            <span className="text-xs text-gray-400">{isExpanded ? "▲ Hide" : "▼ Full script"}</span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">{s.scenes.hook}</p>
                        </button>
                        {isExpanded && (
                          <div className="border-t border-[#E5E7EB] dark:border-[#2A2A2A] px-3 py-3 bg-gray-50 dark:bg-[#111]">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Full script</p>
                            <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{s.fullScript}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                  <Button onClick={() => setStep(4)} className="flex-1 gap-2">
                    Continue to Video Creator
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {(step === 4 || step === 5) && scriptResults.length < 4 && (
        <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Scripts required</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Generate all four script variations in Step 3 first, then return to {step === 4 ? "Video" : "Guides"}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setStep(3)}>Go to Script</Button>
          </CardContent>
        </Card>
      )}

      {(step === 4 || step === 5) && scriptResults.length >= 4 && !affiliateProductContext && (
        <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Product details needed</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Add a product description in Step 1 (or run Get AI Breakdown in Step 2), then open this step again so Video Creator and Guides have your product name and description.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setStep(1)}>Go to Step 1</Button>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Video Creator */}
      {step === 4 && canShowAffiliateLateSteps && (
        <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm">4</span>
              Video Creator
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Pick a script variation, choose a voice, and generate a vertical 9:16 MP4: ElevenLabs voiceover, your product image, and burned-in captions—same export pipeline as Template Studio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="mb-2 block">Script variation</Label>
              <div className="space-y-2">
                {scriptResults.map((s, i) => {
                  const title = (s as ScriptResult & { title?: string }).title ?? `Script ${i + 1}`;
                  const selected = selectedScriptIndex === i;
                  const isExpanded = expandedScriptIndex === i + 10; // offset to not conflict with Step 3
                  return (
                    <div
                      key={i}
                      className={`rounded-lg border-2 overflow-hidden transition-all ${
                        selected
                          ? "border-orange-500 bg-orange-500/15"
                          : "border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#0F0F0F]"
                      }`}
                    >
                      <button
                        type="button"
                        className="w-full p-3 text-left"
                        onClick={() => {
                          setSelectedScriptIndex(i);
                          setAffiliateVideoUrl(null);
                          setAffiliateVideoError(null);
                        }}
                      >
                        <p className="text-xs font-medium text-orange-400">{title}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{s.scenes.hook}</p>
                      </button>
                      <div className="px-3 pb-2">
                        <button
                          type="button"
                          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline"
                          onClick={() => setExpandedScriptIndex(isExpanded ? null : i + 10)}
                        >
                          {isExpanded ? "Hide full script ▲" : "View full script ▼"}
                        </button>
                        {isExpanded && (
                          <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap leading-relaxed mt-2 pb-1">{s.fullScript}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <Label htmlFor="affiliate-voice">Voice (ElevenLabs)</Label>
              <select
                id="affiliate-voice"
                value={selectedVoiceId}
                onChange={(e) => setSelectedVoiceId(e.target.value)}
                className="w-full max-w-md h-10 rounded-md border border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#0F0F0F] text-gray-900 dark:text-white px-3 text-sm mt-1"
              >
                {elevenLabsVoices.length === 0 ? (
                  <option value={DEFAULT_VOICE_ID}>Default voice</option>
                ) : (
                  elevenLabsVoices.map((v) => (
                    <option key={v.voice_id} value={v.voice_id}>
                      {v.name}
                      {v.description ? ` — ${v.description.slice(0, 60)}` : ""}
                    </option>
                  ))
                )}
              </select>
              {elevenLabsVoices.length === 0 ? (
                <p className="text-xs text-gray-600 dark:text-gray-500 mt-1">
                  Uses your workspace default when the voice list has not loaded yet.
                </p>
              ) : null}
            </div>
            {affiliateVideoError ? (
              <p className="text-sm text-red-600 dark:text-red-400">{affiliateVideoError}</p>
            ) : null}
            {affiliateVideoUrl ? (
              <div className="rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] p-4 space-y-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Your video</p>
                <video src={affiliateVideoUrl} controls className="w-full max-w-xs rounded-md bg-black aspect-[9/16] mx-auto" />
                <Button asChild variant="outline" className="w-full">
                  <a href={affiliateVideoUrl} download target="_blank" rel="noopener noreferrer">
                    Download MP4
                  </a>
                </Button>
              </div>
            ) : null}
            <Button
              onClick={runGenerateAffiliateVideo}
              disabled={affiliateVideoGenerating}
              className="w-full gap-2 bg-orange-500 hover:bg-orange-600"
            >
              {affiliateVideoGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clapperboard className="w-4 h-4" />}
              {affiliateVideoGenerating ? "Generating video…" : "Generate Video"}
            </Button>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
              <Button variant="outline" onClick={() => setStep(5)} className="flex-1 gap-2">
                Continue to Video Creation Guides
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Video Creation Guides */}
      {step === 5 && canShowAffiliateLateSteps && (
        <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm">5</span>
              Video Creation Guides
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">Get a step-by-step video creation guide for each script—scene breakdowns, AI image prompts (product demos, unboxing, lifestyle), and export settings for TikTok.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {scriptResults.map((script, i) => {
              const title = (script as ScriptResult & { title?: string }).title ?? `Script ${i + 1}`;
              return (
                <div key={i} className="rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#0F0F0F] p-4 space-y-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{title}</p>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                    <p><span className="font-medium text-orange-400">Hook:</span> {script.scenes.hook}</p>
                    <p><span className="font-medium text-orange-400">Body:</span> {[script.scenes.pain, script.scenes.solution].filter(Boolean).join(" ")}</p>
                    <p><span className="font-medium text-orange-400">CTA:</span> {script.scenes.cta}</p>
                  </div>
                  <Button
                    onClick={() => goToVideoCustomization(script)}
                    className="w-full gap-2 bg-orange-500 hover:bg-orange-600"
                  >
                    <FileText className="w-4 h-4" />
                    Build This Video → Step 5
                  </Button>
                </div>
              );
            })}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(4)}>Back</Button>
              <Button variant="outline" onClick={() => { setStep(1); setBreakdown(null); setScriptResults([]); setAffiliateProductImageUrl(null); }}>
                New video
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

    </main>
    </TooltipProvider>
  );
}
