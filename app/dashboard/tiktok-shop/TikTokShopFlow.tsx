"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  Loader2,
  RefreshCw,
  Sparkles,
  FileText,
  Film,
  Play,
  Download,
  Library,
  ChevronRight,
  PlayCircle,
  Info,
  Copy,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { AvatarPreviewPlayer } from "@/components/tiktok-shop/AvatarPreviewPlayer";
import { PostContentCard } from "@/components/tiktok-shop/PostContentCard";
import { useToast } from "@/components/ui/use-toast";

const TIKTOK_PREFS_KEY = "tiktok-shop-preferences";

const STEPS = [
  { id: 1, label: "Product", short: "Product" },
  { id: 2, label: "AI Breakdown", short: "Breakdown" },
  { id: 3, label: "Script", short: "Script" },
  { id: 4, label: "Video Style", short: "Style" },
  { id: 5, label: "Render", short: "Render" },
] as const;

const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_IMAGE_EXT = ".jpg,.jpeg,.png,.webp";
const POLL_INTERVAL_MS = 10_000;

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

const DURATION_OPTIONS = [
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
  { value: 45, label: "45s" },
  { value: 60, label: "60s" },
];

const VIDEO_BUILD_MODES = [
  { id: "product-animation", label: "Text + product", desc: "Shotstack: text overlays + product image", icon: "🎬" },
  { id: "stock-captions", label: "TikTok-style", desc: "Shotstack: hook, body, CTA + product", icon: "📽️" },
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
};

export default function TikTokShopFlow() {
  const [step, setStep] = useState(1);
  const [productLink, setProductLink] = useState("");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productImage, setProductImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<ProductBreakdown | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [scriptResult, setScriptResult] = useState<ScriptResult | null>(null);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [hookStyle, setHookStyle] = useState("tiktok-made-me-buy");
  const [tone, setTone] = useState("ugc-style");
  const [targetDurationSec, setTargetDurationSec] = useState(30);
  const [videoBuildMode, setVideoBuildMode] = useState("product-animation");
  const [subtitleStyle, setSubtitleStyle] = useState("bold");
  const [fontChoice, setFontChoice] = useState("sans");
  const [captionColor, setCaptionColor] = useState("#FFFFFF");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [previewScriptText, setPreviewScriptText] = useState<string>("");
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<"idle" | "polling" | "completed" | "failed">("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [pollElapsedSec, setPollElapsedSec] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number | null>(null);
  const { toast } = useToast();
  const [hasShotstack, setHasShotstack] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TIKTOK_PREFS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Record<string, unknown>;
        if (typeof p.videoBuildMode === "string") setVideoBuildMode(p.videoBuildMode);
        if (typeof p.targetDurationSec === "number") setTargetDurationSec(p.targetDurationSec);
        if (typeof p.hookStyle === "string") setHookStyle(p.hookStyle);
        if (typeof p.tone === "string") setTone(p.tone);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const prefs = {
      videoBuildMode,
      targetDurationSec,
      hookStyle,
      tone,
    };
    try {
      localStorage.setItem(TIKTOK_PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  }, [videoBuildMode, targetDurationSec, hookStyle, tone]);

  useEffect(() => {
    fetch("/api/tiktok-shop/video-mode")
      .then((r) => r.json())
      .then((d) => setHasShotstack(d.mode === "shotstack"))
      .catch(() => setHasShotstack(false));
  }, []);

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
  const canProceedStep3 = !!scriptResult;
  const canProceedStep4 = true;

  const runProductBreakdown = async () => {
    if (!canProceedStep1) return;
    setBreakdownLoading(true);
    setBreakdown(null);
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

  const runGenerateScript = async () => {
    const name = breakdown?.productName || productName.trim() || "Product";
    const desc = breakdown?.productDescription || productDescription.trim();
    if (!desc) {
      toast({ title: "Need description", description: "Add product description in Step 1.", variant: "destructive" });
      return;
    }
    setScriptLoading(true);
    setScriptResult(null);
    try {
      const productImageBase64 = await getProductImageBase64();
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
          hookStyle,
          tone,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Script generation failed");
      setScriptResult({ fullScript: data.fullScript, scenes: data.scenes });
      setStep(3);
      toast({ title: "Script ready", description: "Edit if needed, then choose video style." });
    } catch (err) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : "Script failed", variant: "destructive" });
    } finally {
      setScriptLoading(false);
    }
  };

  const regenerateSection = async (section: "hook" | "pain" | "solution" | "proof" | "cta") => {
    if (!scriptResult || !breakdown) return;
    setScriptLoading(true);
    try {
      const res = await fetch("/api/tiktok-shop/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: breakdown.productName,
          productDescription: breakdown.productDescription,
          videoStyle: "demo",
          targetDurationSec,
          hookStyle,
          tone,
          regenerateSection: section,
          existingScenes: scriptResult.scenes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Regenerate failed");
      setScriptResult({ fullScript: data.fullScript, scenes: data.scenes });
      toast({ title: "Section updated", description: `${section} regenerated.` });
    } catch (err) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : "Regenerate failed", variant: "destructive" });
    } finally {
      setScriptLoading(false);
    }
  };

  const startRender = async () => {
    if (!scriptResult || !breakdown) return;
    setJobId(null);
    setVideoUrl(null);
    setJobError(null);
    setPollElapsedSec(0);
    pollStartRef.current = Date.now();
    setJobStatus("polling");
    try {
      const productImageBase64 = await getProductImageBase64();
      const res = await fetch("/api/tiktok-shop/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productLink: productLink.trim() || "https://example.com/product",
          productDescription: breakdown.productDescription,
          script: scriptResult,
          productImageBase64,
          videoStyle: "demo",
          platforms: ["tiktok"],
          targetDurationSec,
          videoBuildMode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to start render");
      setJobId(data.jobId);
      toast({ title: "Render started", description: "Polling every 10s. You can navigate away." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start render";
      setJobStatus("failed");
      setJobError(msg);
      toast({ title: "Render failed", description: msg, variant: "destructive" });
    }
  };

  useEffect(() => {
    if (!jobId || jobStatus !== "polling") return;
    const poll = async () => {
      try {
        if (pollStartRef.current) setPollElapsedSec(Math.floor((Date.now() - pollStartRef.current) / 1000));
        const res = await fetch(`/api/tiktok-shop/render/${jobId}`);
        const data = await res.json().catch(() => ({}));
        if (data.status === "completed" && data.videoUrl) {
          setVideoUrl(data.videoUrl);
          setJobStatus("completed");
          pollStartRef.current = null;
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          toast({ title: "Video ready!", description: "Your video is ready." });
        } else if (data.status === "failed") {
          setJobError(data.error ?? "Render failed");
          setJobStatus("failed");
          pollStartRef.current = null;
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          toast({ title: "Render failed", description: data.error, variant: "destructive" });
        }
      } catch {
        // keep polling
      }
    };
    poll();
    const elapsedInterval = setInterval(() => {
      if (pollStartRef.current) setPollElapsedSec(Math.floor((Date.now() - pollStartRef.current) / 1000));
    }, 1000);
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      clearInterval(elapsedInterval);
    };
  }, [jobId, jobStatus, toast]);

  const handlePreviewShotstack = async () => {
    if (!scriptResult?.fullScript) return;
    setPreviewLoading(true);
    setPreviewVideoUrl(null);
    try {
      const res = await fetch("/api/tiktok-shop/avatar-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullScript: scriptResult.fullScript,
          productImageUrl: undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      if (data.videoUrl) {
        const full = scriptResult.fullScript.trim();
        const words = full.split(/\s+/);
        setPreviewScriptText(words.slice(0, 20).join(" ") || full.slice(0, 100));
        setPreviewVideoUrl(data.videoUrl);
        setPreviewModalOpen(true);
      } else {
        throw new Error("No video URL returned");
      }
    } catch (err) {
      toast({
        title: "Preview failed",
        description: err instanceof Error ? err.message : "Could not generate preview",
        variant: "destructive",
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const saveToLibrary = async () => {
    if (!videoUrl) return;
    const res = await fetch("/api/library/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: breakdown?.productName || "TikTok Shop Video",
        thumbnailUrl: videoUrl,
        platforms: ["tiktok"],
      }),
    });
    if (!res.ok) throw new Error("Failed to save");
    toast({ title: "Saved to library" });
  };

  return (
    <TooltipProvider delayDuration={300}>
    <main className="p-6 md:p-10 max-w-3xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-orange-500 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </Link>

      <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2">
        TikTok Affiliate Control Center
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8">
        Create conversion-optimized videos in 5 focused steps.
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
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs bg-white/20">
                {s.id}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{s.short}</span>
            </button>
            {i < STEPS.length - 1 && (
              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-0.5" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Product Intelligence */}
      {step === 1 && (
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm">1</span>
              Product Intelligence
            </CardTitle>
            <CardDescription>
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
                      <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                      <p className="text-sm text-slate-600 dark:text-slate-400">Drop or click to upload</p>
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
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm">2</span>
              AI Product Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Category</p>
                <p className="text-sm font-medium">{breakdown.category}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Target audience</p>
                <p className="text-sm">{breakdown.targetAudience}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Pain points</p>
              <ul className="text-sm list-disc list-inside space-y-0.5">{breakdown.corePainPoints.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Objections</p>
              <ul className="text-sm list-disc list-inside space-y-0.5">{breakdown.buyingObjections.map((o, i) => <li key={i}>{o}</li>)}</ul>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Emotional triggers</p>
              <ul className="text-sm list-disc list-inside space-y-0.5">{breakdown.emotionalTriggers.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Why buy</p>
              <ul className="text-sm list-disc list-inside space-y-0.5">{breakdown.whyBuy.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={runGenerateScript} disabled={scriptLoading} className="gap-2 flex-1">
                {scriptLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {scriptLoading ? "Generating script..." : "Continue to Script"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Script Builder */}
      {step === 3 && (
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm">3</span>
              Script Builder
            </CardTitle>
            <CardDescription>Choose hook style, tone, and length. Regenerate individual sections if needed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="flex items-center gap-1">
                  <Label>Hook style</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>How the script opens—e.g. problem (start with the pain), story (relatable scenario), or stat (surprising number).</TooltipContent>
                  </Tooltip>
                </div>
                <select
                  value={hookStyle}
                  onChange={(e) => setHookStyle(e.target.value)}
                  className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm mt-1"
                >
                  {HOOK_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>{o.label} — {o.desc}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <Label>Tone</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>Overall voice of the script—e.g. soft aesthetic, aggressive, luxury, or UGC style.</TooltipContent>
                  </Tooltip>
                </div>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm mt-1"
                >
                  {TONE_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Length</Label>
                <select
                  value={targetDurationSec}
                  onChange={(e) => setTargetDurationSec(Number(e.target.value))}
                  className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm mt-1"
                >
                  {DURATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {!scriptResult ? (
              <Button onClick={runGenerateScript} disabled={scriptLoading} className="w-full gap-2">
                {scriptLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Generate script
              </Button>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Full script</Label>
                  <Textarea
                    value={scriptResult.fullScript}
                    onChange={(e) => setScriptResult((p) => p ? { ...p, fullScript: e.target.value } : null)}
                    rows={8}
                    className="resize-none"
                  />
                  {scriptResult.fullScript.trim() && (() => {
                    const words = scriptResult.fullScript.trim().split(/\s+/).filter(Boolean).length;
                    const estSec = Math.round(words / 2.5);
                    const diff = estSec - targetDurationSec;
                    return (
                      <p className="text-xs text-slate-500">
                        {words} words · ~{estSec}s speech
                        {Math.abs(diff) > 10 && (
                          <span className={diff > 0 ? " text-amber-600 dark:text-amber-400" : " text-slate-400"}>
                            {" "}(target {targetDurationSec}s{diff > 0 ? " — consider shortening" : " — room for more"})
                          </span>
                        )}
                      </p>
                    );
                  })()}
                </div>
                <div className="space-y-2">
                  <Label>Regenerate section</Label>
                  <div className="flex flex-wrap gap-2">
                    {(["hook", "pain", "solution", "proof", "cta"] as const).map((sec) => (
                      <Button
                        key={sec}
                        variant="outline"
                        size="sm"
                        onClick={() => regenerateSection(sec)}
                        disabled={scriptLoading}
                      >
                        {scriptLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        {sec}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                  <Button onClick={() => setStep(4)} className="flex-1 gap-2">
                    Continue to Video Style
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Video Build Mode + Creative Controls */}
      {step === 4 && (
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm">4</span>
              Video Style & Creative
            </CardTitle>
            <CardDescription>Choose build mode and creative controls.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label>Build mode</Label>
              <div className="grid gap-2 mt-2 sm:grid-cols-2">
                {VIDEO_BUILD_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setVideoBuildMode(m.id)}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-left ${
                      videoBuildMode === m.id ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30" : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <span className="text-xl">{m.icon}</span>
                    <div>
                      <p className="font-medium text-sm">{m.label}</p>
                      <p className="text-xs text-slate-500">{m.desc}</p>
                      {hasShotstack && <Badge variant="secondary" className="mt-1 text-xs">Shotstack</Badge>}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {hasShotstack && (
              <div className="space-y-4 rounded-lg border border-orange-200 dark:border-orange-900/50 bg-orange-50/30 dark:bg-orange-950/20 p-4">
                <Label className="text-base">Preview video</Label>
                <p className="text-xs text-slate-600 dark:text-slate-400">Shotstack: text overlays + product image. Generate a short preview to see how it looks.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePreviewShotstack}
                  disabled={!scriptResult?.fullScript || previewLoading}
                  className="gap-2"
                >
                  {previewLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <PlayCircle className="w-4 h-4" />
                  )}
                  {previewLoading ? "Generating preview (~30s)…" : "Preview video"}
                </Button>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Subtitle style</Label>
                <select
                  value={subtitleStyle}
                  onChange={(e) => setSubtitleStyle(e.target.value)}
                  className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm mt-1"
                >
                  <option value="bold">Bold</option>
                  <option value="outline">Outline</option>
                  <option value="minimal">Minimal</option>
                </select>
              </div>
              <div>
                <Label>Font</Label>
                <select
                  value={fontChoice}
                  onChange={(e) => setFontChoice(e.target.value)}
                  className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm mt-1"
                >
                  <option value="sans">Sans</option>
                  <option value="serif">Serif</option>
                  <option value="display">Display</option>
                </select>
              </div>
              <div>
                <Label>Caption color</Label>
                <input
                  type="color"
                  value={captionColor}
                  onChange={(e) => setCaptionColor(e.target.value)}
                  className="h-10 w-full rounded border border-slate-200 dark:border-slate-700 cursor-pointer"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
              <Button onClick={() => { setStep(5); startRender(); }} className="flex-1 gap-2">
                <Play className="w-4 h-4" />
                Start render
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Render */}
      {step === 5 && (
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm">5</span>
              Render
            </CardTitle>
            <CardDescription>Job runs in the background. Poll every 10s—never blocks UI.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {jobStatus === "idle" && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  ~1–2 min (Shotstack: text + product image)
                </p>
                <Button onClick={startRender} disabled={!breakdown || !scriptResult} className="w-full gap-2">
                  <Play className="w-4 h-4" />
                  Start render
                </Button>
              </div>
            )}
            {(jobStatus === "polling" || jobStatus === "completed" || jobStatus === "failed") && (
              <>
                {jobStatus === "polling" && (
                  <div className="space-y-2">
                    <Progress value={33} className="h-2" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Rendering TikTok-style video with Shotstack. Usually 1–2 min.
                    </p>
                    <p className="text-xs text-slate-500">Elapsed: {Math.floor(pollElapsedSec / 60)}m {pollElapsedSec % 60}s · Polling every 10s</p>
                  </div>
                )}
                {jobStatus === "failed" && jobError && (
                  <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-4 space-y-3">
                    <p className="text-sm text-red-700 dark:text-red-400 font-medium">{jobError}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">If this keeps failing, try shortening the script or ensuring a product image is available.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={startRender} className="gap-1">
                        <RefreshCw className="w-3.5 h-3.5" />
                        Try again
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setJobStatus("idle"); setJobError(null); setJobId(null); setVideoUrl(null); }}>
                        Adjust settings
                      </Button>
                    </div>
                  </div>
                )}
                {jobStatus === "completed" && videoUrl && (
                  <div className="space-y-4">
                    <div className="rounded-lg overflow-hidden bg-slate-900 aspect-[9/16] max-h-[400px]">
                      <video src={videoUrl} controls className="w-full h-full object-contain" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild className="gap-2">
                        <a href={videoUrl} download target="_blank" rel="noopener noreferrer">
                          <Download className="w-4 h-4" />
                          Download
                        </a>
                      </Button>
                      <Button variant="outline" className="gap-2" onClick={saveToLibrary}>
                        <Library className="w-4 h-4" />
                        Save to library
                      </Button>
                    </div>
                    {jobId && <PostContentCard jobId={jobId} />}
                  </div>
                )}
              </>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(4)}>Back</Button>
              <Button variant="outline" onClick={() => { setStep(1); setBreakdown(null); setScriptResult(null); setJobId(null); setVideoUrl(null); setJobStatus("idle"); }}>
                New video
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden max-h-[95vh] overflow-y-auto">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Video preview</DialogTitle>
          </DialogHeader>
          {previewVideoUrl && (
            <div className="p-4 pt-2">
              <AvatarPreviewPlayer
                videoUrl={previewVideoUrl}
                scriptText={previewScriptText}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

    </main>
    </TooltipProvider>
  );
}
