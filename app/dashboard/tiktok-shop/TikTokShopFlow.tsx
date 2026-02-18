"use client";

import { useState, useEffect } from "react";
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
  ChevronRight,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { VIDEO_LENGTH_OPTIONS, DEFAULT_VIDEO_LENGTH_SEC } from "@/lib/video-length-options";

const TIKTOK_PREFS_KEY = "tiktok-shop-preferences";

const STEPS = [
  { id: 1, label: "Product", short: "Product" },
  { id: 2, label: "AI Breakdown", short: "Breakdown" },
  { id: 3, label: "Script", short: "Script" },
  { id: 4, label: "Video Creation Guides", short: "Guides" },
] as const;

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
  const [guideLoading, setGuideLoading] = useState(false);

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
  const canProceedStep4 = true;

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
      setBreakdown(data);
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
          return {
            fullScript: data.fullScript as string,
            scenes: data.scenes as ScriptResult["scenes"],
            title: SCRIPT_VARIATION_LABELS[i],
          };
        })
      );
      setScriptResults(results);
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

  const handleCreateVideoGuide = async (script: ScriptResult) => {
    if (!breakdown) return;
    const { hook, body, cta } = scenesToHookBodyCta(script.scenes);
    setGuideLoading(true);
    try {
      const res = await fetch("/api/video-guide/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook,
          body,
          cta,
          productName: breakdown.productName,
          productDescription: breakdown.productDescription,
          platforms: ["tiktok"],
          durationSeconds: targetDurationSec,
        }),
      });
      const guide = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(guide.error ?? "Failed to generate guide");
      sessionStorage.setItem("videoCreationGuide", JSON.stringify({ ...guide, scriptTitle: (script as ScriptResult & { title?: string }).title ?? "TikTok Shop Script" }));
      toast({ title: "Video guide ready", description: "Opening your guide." });
      router.push("/dashboard/digital-products/video-guide");
    } catch (err) {
      toast({
        title: "Guide failed",
        description: err instanceof Error ? err.message : "Could not generate video guide",
        variant: "destructive",
      });
    } finally {
      setGuideLoading(false);
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
    <main className="p-6 md:p-10 max-w-3xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-orange-500 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </Link>

      <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
        TikTok Affiliate Control Center
      </h1>
      <p className="text-gray-400 mb-8">
        Product → AI Breakdown → Script → Video Creation Guide. No rendering—get a step-by-step guide to create your video.
      </p>

      {/* Stepper */}
      <div className="flex items-center gap-1 mb-10 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setStep(s.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                step === s.id
                  ? "bg-orange-500 text-white"
                  : "bg-[#2A2A2A] text-gray-400 hover:bg-[#3A3A3A] hover:text-white"
              }`}
            >
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs bg-white/20">
                {s.id}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{s.short}</span>
            </button>
            {i < STEPS.length - 1 && (
              <ChevronRight className="w-4 h-4 text-gray-600 mx-0.5" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Product Intelligence */}
      {step === 1 && (
        <Card className="border-[#2A2A2A] bg-[#1A1A1A]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm">1</span>
              Product Intelligence
            </CardTitle>
            <CardDescription className="text-gray-400">
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
                      <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-400">Drop or click to upload</p>
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
      )}

      {/* Step 2: AI Breakdown */}
      {step === 2 && breakdown && (
        <Card className="border-[#2A2A2A] bg-[#1A1A1A]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm">2</span>
              AI Product Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Category</p>
                <p className="text-sm font-medium text-white">{breakdown.category}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Target audience</p>
                <p className="text-sm text-gray-300">{breakdown.targetAudience}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Pain points</p>
              <ul className="text-sm list-disc list-inside space-y-0.5 text-gray-300">{breakdown.corePainPoints.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Objections</p>
              <ul className="text-sm list-disc list-inside space-y-0.5 text-gray-300">{breakdown.buyingObjections.map((o, i) => <li key={i}>{o}</li>)}</ul>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Emotional triggers</p>
              <ul className="text-sm list-disc list-inside space-y-0.5 text-gray-300">{breakdown.emotionalTriggers.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Why buy</p>
              <ul className="text-sm list-disc list-inside space-y-0.5 text-gray-300">{breakdown.whyBuy.map((r, i) => <li key={i}>{r}</li>)}</ul>
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
        <Card className="border-[#2A2A2A] bg-[#1A1A1A]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm">3</span>
              Script Builder
            </CardTitle>
            <CardDescription className="text-gray-400">Generate 4 script variations (Story, Problem/Solution, Social proof, Curiosity). Then create a video guide for any of them.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="mb-2 block">Video length</Label>
              <p className="text-xs text-gray-500 mb-3">Choose target duration before generating scripts. Word count and guide scenes will match.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {VIDEO_LENGTH_OPTIONS.map((opt) => {
                  const selected = targetDurationSec === opt.seconds;
                  return (
                    <button
                      key={opt.seconds}
                      type="button"
                      onClick={() => setTargetDurationSec(opt.seconds)}
                      className={`rounded-lg border-2 p-3 text-left transition-all ${
                        selected
                          ? "border-orange-500 bg-orange-500/20"
                          : "border-[#2A2A2A] bg-[#0F0F0F] hover:border-[#3A3A3A]"
                      }`}
                    >
                      <span className="block font-semibold text-sm text-white">{opt.seconds}s</span>
                      <span className="block text-xs text-gray-400 mt-0.5">{opt.sublabel}</span>
                      <span className="block text-xs text-gray-500 mt-1">{opt.wordRange}</span>
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
                className="w-full max-w-xs h-10 rounded-md border border-[#2A2A2A] bg-[#0F0F0F] text-white px-3 text-sm mt-1"
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
                <p className="text-sm text-gray-400">4 script variations ready. Continue to create a video guide for each.</p>
                <div className="space-y-2">
                  {scriptResults.map((s, i) => (
                    <div key={i} className="rounded-lg border border-[#2A2A2A] p-3">
                      <p className="text-xs font-medium text-orange-400 mb-1">{(s as ScriptResult & { title?: string }).title ?? `Script ${i + 1}`}</p>
                      <p className="text-sm text-gray-300 line-clamp-2">{s.scenes.hook}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                  <Button onClick={() => setStep(4)} className="flex-1 gap-2">
                    Continue to Video Creation Guides
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Video Creation Guides */}
      {step === 4 && scriptResults.length >= 4 && breakdown && (
        <Card className="border-[#2A2A2A] bg-[#1A1A1A]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm">4</span>
              Video Creation Guides
            </CardTitle>
            <CardDescription className="text-gray-400">Get a step-by-step video creation guide for each script—scene breakdowns, AI image prompts (product demos, unboxing, lifestyle), and export settings for TikTok.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {scriptResults.map((script, i) => {
              const title = (script as ScriptResult & { title?: string }).title ?? `Script ${i + 1}`;
              return (
                <div key={i} className="rounded-lg border border-[#2A2A2A] bg-[#0F0F0F] p-4 space-y-3">
                  <p className="text-sm font-medium text-white">{title}</p>
                  <div className="text-sm text-gray-400 space-y-2">
                    <p><span className="font-medium text-orange-400">Hook:</span> {script.scenes.hook}</p>
                    <p><span className="font-medium text-orange-400">Body:</span> {[script.scenes.pain, script.scenes.solution].filter(Boolean).join(" ")}</p>
                    <p><span className="font-medium text-orange-400">CTA:</span> {script.scenes.cta}</p>
                  </div>
                  <Button
                    onClick={() => handleCreateVideoGuide(script)}
                    disabled={guideLoading}
                    className="w-full gap-2 bg-orange-500 hover:bg-orange-600"
                  >
                    {guideLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    {guideLoading ? "Generating…" : "Create Video Guide"}
                  </Button>
                </div>
              );
            })}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
              <Button variant="outline" onClick={() => { setStep(1); setBreakdown(null); setScriptResults([]); }}>
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
