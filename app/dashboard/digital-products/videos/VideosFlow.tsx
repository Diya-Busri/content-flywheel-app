"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Check, Play, Loader2, User, Image, Package, Sparkles, AlertCircle, FileText, Plus, X, BookOpen, PartyPopper, BarChart2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { VIDEO_GUIDE_PLATFORMS } from "@/lib/video-guide-platforms";
import { cleanProductTitle } from "@/lib/product-title";

type VoiceItem = { voice_id: string; name: string };

const VOICE_PREVIEW_SAMPLE_TEXT = "Hi, this is your AI voiceover for your digital product.";

const BACKGROUND_OPTIONS = [
  { value: "clean", label: "Clean Minimal (white/gradient)" },
  { value: "lifestyle", label: "Lifestyle B-roll (travel/office/lifestyle)" },
  { value: "product", label: "Product Focus (your product hero shot)" },
  { value: "custom", label: "Upload Custom Image" },
];

const CAPTION_PRESETS = ["Bold sans", "Minimal serif", "High contrast", "Subtle overlay", "Animated words"];

function toValidHex(hex: string): string {
  const m = hex.trim().match(/^#?([0-9A-Fa-f]{3,6})$/);
  if (!m) return "#FF6B35";
  let s = m[1];
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  return "#" + s.padEnd(6, "0").slice(0, 6);
}

export interface SelectedScriptForVideo {
  id: string;
  title: string;
  length: number;
  hook: string;
  body: string;
  cta: string;
}

const VIDEO_STYLES = [
  { id: "talkinghead", label: "Talking Head", icon: User, desc: "AI avatar" },
  { id: "broll", label: "B-roll + Text", icon: Image, desc: "Recommended for faceless" },
  { id: "showcase", label: "Product Showcase", icon: Package, desc: "Voiceover" },
  { id: "explainer", label: "Animated Explainer", icon: Sparkles, desc: "Graphics only" },
  { id: "dark_infographic", label: "Dark Infographic", icon: BarChart2, desc: "Bold text + diagram slides on dark bg" },
];

export default function VideosFlow() {
  const router = useRouter();
  const { toast } = useToast();
  const [productName, setProductName] = useState<string>("");
  const [productId, setProductId] = useState<string | null>(null);
  const [selectedScripts, setSelectedScripts] = useState<SelectedScriptForVideo[]>([]);
  const [videoStyle, setVideoStyle] = useState<string>("broll");
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [speed, setSpeed] = useState<number[]>([1]);
  const [background, setBackground] = useState<string>("clean");
  const [captionStyle, setCaptionStyle] = useState<string>(CAPTION_PRESETS[0]);
  const [addLogo, setAddLogo] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [brandColors, setBrandColors] = useState<string[]>(["#FF6B35"]);
  const [platforms, setPlatforms] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(VIDEO_GUIDE_PLATFORMS.map((p) => [p.id, p.id === "tiktok" || p.id === "instagram_reels"]))
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateProgress, setGenerateProgress] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const autoNavRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goToGuide = () => {
    if (autoNavRef.current) clearTimeout(autoNavRef.current);
    router.push("/dashboard/digital-products/video-guide");
  };

  useEffect(() => {
    try {
      let productNameSet = false;
      const rawProduct = sessionStorage.getItem("digitalProductForm");
      if (rawProduct) {
        const data = JSON.parse(rawProduct);
        const cleaned = cleanProductTitle(data.productName) || data.productName?.trim() || "Product";
        setProductName(cleaned);
        productNameSet = !!data.productName;
      }
      const rawScripts = sessionStorage.getItem("selectedScriptsForVideos");
      if (rawScripts) {
        const scripts = JSON.parse(rawScripts) as SelectedScriptForVideo[];
        setSelectedScripts(Array.isArray(scripts) ? scripts : []);
      }
      const rawContext = sessionStorage.getItem("productContextForVideos");
      if (rawContext) {
        const ctx = JSON.parse(rawContext) as { productId?: string; productName?: string };
        if (ctx.productId) setProductId(ctx.productId);
        if (!productNameSet && ctx.productName) setProductName(cleanProductTitle(ctx.productName) || ctx.productName.trim() || "Product");
      }
    } catch {
      setSelectedScripts([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setVoicesLoading(true);
    fetch("/api/elevenlabs/voices")
      .then(async (res) => {
        const data = (await res.json()) as { voices?: VoiceItem[]; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          const msg = data?.error ?? `Failed to load voices (${res.status})`;
          toast({ title: "Voices unavailable", description: msg, variant: "destructive" });
          setVoices([]);
          return;
        }
        const list = Array.isArray(data.voices) ? data.voices : [];
        setVoices(list);
        if (list.length > 0 && !selectedVoiceId) setSelectedVoiceId(list[0].voice_id);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("[VideosFlow] Fetch voices error:", err);
          toast({ title: "Voices unavailable", description: err instanceof Error ? err.message : "Network error", variant: "destructive" });
          setVoices([]);
        }
      })
      .finally(() => {
        if (!cancelled) setVoicesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const togglePlatform = (id: string) => {
    setPlatforms((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const selectedPlatformIds = VIDEO_GUIDE_PLATFORMS.filter((p) => platforms[p.id]).map((p) => p.id);

  const handlePreview = async () => {
    const voiceId = selectedVoiceId || voices[0]?.voice_id;
    if (!voiceId) {
      toast({ title: "No voice selected", variant: "destructive" });
      return;
    }
    setPreviewLoading(true);
    let objectUrl: string | null = null;
    try {
      const res = await fetch("/api/generate-voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: VOICE_PREVIEW_SAMPLE_TEXT,
          voiceId,
          stability: 0.5,
          similarity: 0.75,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Preview failed",
          description: (err as { error?: string }).error ?? "Could not play sample",
          variant: "destructive",
        });
        return;
      }
      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl);
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("Playback failed"));
        audio.play().catch(reject);
      });
    } catch (e) {
      toast({
        title: "Preview failed",
        description: e instanceof Error ? e.message : "Could not play sample",
        variant: "destructive",
      });
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setPreviewLoading(false);
    }
  };

  const handleGenerateGuide = async () => {
    const script = selectedScripts[0];
    if (!script) return;
    setGenerateLoading(true);
    setGenerateProgress("Generating guide...");
    sessionStorage.setItem("selectedScriptsForVideos", JSON.stringify(selectedScripts));

    try {
      let logoDataUrl: string | undefined;
      if (addLogo && logoFile) {
        logoDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read logo file"));
          reader.readAsDataURL(logoFile);
        });
      }

      // Generate guide + voiceover in parallel
      const fullScriptText = [script.hook, script.body, script.cta].filter(Boolean).join("\n\n");
      const voiceId = selectedVoiceId || voices[0]?.voice_id || "";

      const [guideRes, voiceoverUrl] = await Promise.all([
        fetch("/api/video-guide/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hook: script.hook,
            body: script.body,
            cta: script.cta,
            productName: (productName || "").trim() || undefined,
            productId: productId || undefined,
            platforms: selectedPlatformIds.length > 0 ? selectedPlatformIds : ["tiktok"],
            videoStyle: videoStyle || undefined,
            ...(logoDataUrl && { logoDataUrl }),
          }),
        }),
        voiceId
          ? fetch("/api/ai-coach/voice-over", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ script: fullScriptText, voiceId }),
            })
              .then((r) => (r.ok ? r.json() : null))
              .then((d: { url?: string } | null) => (typeof d?.url === "string" && d.url.startsWith("http") ? d.url : null))
              .catch(() => null)
          : Promise.resolve(null),
      ]);

      const guide = await guideRes.json().catch(() => ({}));
      if (!guideRes.ok) {
        throw new Error(guide.error || `Request failed: ${guideRes.status}`);
      }
      sessionStorage.setItem("videoCreationGuide", JSON.stringify({
        ...guide,
        scriptTitle: script.title,
        preferredVoiceId: selectedVoiceId,
        scriptsForGuide: selectedScripts,
        productIdForGuide: productId || undefined,
        // Pre-inject voiceover so guide opens with audio ready
        ...(voiceoverUrl ? { timelineVoiceoverUrl: voiceoverUrl } : {}),
      }));
      setVideoReady(true);
      setGenerateProgress(null);
      // Auto-navigate after 1.8s — user can also click "View Video Guide →" to go instantly
      autoNavRef.current = setTimeout(() => {
        router.push("/dashboard/digital-products/video-guide");
      }, 1800);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast({ title: "Guide generation failed", description: msg, variant: "destructive" });
    } finally {
      setGenerateLoading(false);
      setGenerateProgress(null);
    }
  };

  const count = selectedScripts.length;
  const cardClass = "border-border bg-card";

  return (
    <main className="min-h-dvh bg-background text-foreground pb-44">
      <div className="max-w-4xl mx-auto p-6 md:p-10">
        {/* ── Flow header (matches Step 2 style) ── */}
        <div className="mb-8">
          {/* Back link */}
          <Link
            href={productId
              ? `/dashboard/digital-products/scripts?productId=${productId}&from=video-flow`
              : "/dashboard/digital-products/scripts"
            }
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to scripts
          </Link>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-5">
            {/* Step 1 — done */}
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold">✓</div>
              <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">Select product</span>
            </div>
            <div className="h-px w-6 bg-orange-500" />
            {/* Step 2 — done */}
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold">✓</div>
              <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">Customize scripts</span>
            </div>
            <div className="h-px w-6 bg-orange-500" />
            {/* Step 3 — current */}
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold ring-2 ring-orange-500/30">3</div>
              <span className="text-xs font-semibold text-orange-500 hidden sm:inline">Create video</span>
            </div>
          </div>

          {/* Context banner */}
          {videoReady ? (
            <div className="flex items-start justify-between gap-4 rounded-xl border border-green-500/30 bg-green-500/8 dark:bg-green-500/10 px-4 py-3">
              <div className="flex items-start gap-3 min-w-0">
                <PartyPopper className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-600 dark:text-green-400 mb-0.5">
                    Complete — All 3 steps done
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Your video is ready 🎉
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Built to get clicks, saves, and sales →</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">(Opening automatically…)</p>
                </div>
              </div>
              <Button
                onClick={goToGuide}
                size="sm"
                className="shrink-0 bg-green-600 hover:bg-green-700 text-white font-semibold gap-1.5 whitespace-nowrap"
              >
                View Video Guide →
              </Button>
            </div>
          ) : (productName || !generateLoading) ? (
            <div className="flex items-start gap-3 rounded-xl border border-orange-500/20 bg-orange-500/5 dark:bg-orange-500/8 px-4 py-3">
              <BookOpen className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-500 mb-0.5">
                  Step 3 of 3 — Create Your Video
                </p>
                <p className="text-sm text-gray-900 dark:text-white font-medium truncate">
                  Creating video for:{" "}
                  <span className="text-orange-500">
                    {cleanProductTitle(productName) || productName || "your product"}
                  </span>
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {count === 0 ? (
          <Card className={cardClass}>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                No scripts selected. Go back and select at least one script to customize and create your Video Creation Guide.
              </p>
              <Button asChild variant="outline" className="border-border text-muted-foreground">
                <Link href="/dashboard/digital-products/scripts">Back to Scripts</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-10">
            {/* VIDEO STYLE - 4 visual cards */}
            <div>
              <Label className="text-foreground text-base font-medium mb-4 block">What type of video are you making?</Label>
              <p className="text-sm text-muted-foreground mb-4">Your guide will be tailored to your chosen style.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {VIDEO_STYLES.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setVideoStyle(s.id)}
                      className={`rounded-xl border-2 p-4 text-center transition-all ${
                        videoStyle === s.id
                          ? "border-orange-500 bg-orange-500/10"
                          : "border-border bg-card hover:border-border/80"
                      }`}
                    >
                      <Icon className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">{s.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                      <p className="text-xs text-orange-500 mt-2">{videoStyle === s.id ? "Selected" : "Select"}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* VOICE SETTINGS */}
            <Card className={cardClass}>
              <CardHeader>
                <CardTitle className="text-lg text-foreground">Choose your voiceover</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-foreground">AI Voice</Label>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Select
                      value={selectedVoiceId}
                      onValueChange={setSelectedVoiceId}
                      disabled={voicesLoading}
                    >
                      <SelectTrigger
                        className="w-full max-w-[280px] border border-border bg-input text-foreground placeholder:text-muted-foreground [&>svg]:text-foreground"
                      >
                        <SelectValue placeholder={voicesLoading ? "Loading voices…" : "Select a voice"} />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        data-voice-dropdown-content
                        style={{ backgroundColor: "#ffffff", color: "#111827" }}
                        className="max-h-[min(20rem,70vh)] min-w-[var(--radix-select-trigger-width)] w-full max-w-[320px] border border-gray-200 shadow-xl overflow-y-auto [&_[data-radix-select-viewport]]:p-2 [&_[data-radix-select-viewport]]:max-h-[min(18rem,65vh)]"
                      >
                        {voices.map((v) => (
                          <SelectItem
                            key={v.voice_id}
                            value={v.voice_id}
                            style={{ color: "#111827" }}
                            className="cursor-pointer rounded-md py-2.5 pl-8 pr-3 text-base bg-transparent focus:bg-orange-500 focus:text-white data-[highlighted]:bg-orange-500 data-[highlighted]:text-white data-[state=checked]:bg-orange-500 data-[state=checked]:text-white focus:outline-none [&[data-highlighted]]:!text-white [&[data-state=checked]]:!text-white"
                          >
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 border-border text-muted-foreground"
                      onClick={handlePreview}
                      disabled={previewLoading || !selectedVoiceId}
                    >
                      {previewLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      Play 5-second sample
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Default voices from ElevenLabs are shown. Add custom voices in your ElevenLabs account under Voices — they&apos;ll appear here automatically.
                  </p>
                </div>
                <div>
                  <Label className="text-foreground">Voice Speed: {speed[0].toFixed(1)}x</Label>
                  <Slider
                    value={speed}
                    onValueChange={setSpeed}
                    min={0.8}
                    max={1.2}
                    step={0.1}
                    className="mt-2 max-w-xs"
                  />
                </div>
              </CardContent>
            </Card>

            {/* VISUAL CUSTOMIZATION */}
            <Card className={cardClass}>
              <CardHeader>
                <CardTitle className="text-lg text-foreground">Look & feel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {videoStyle === "dark_infographic" ? (
                  <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                    Dark Infographic style uses a fixed black background with bold text slides — no background selection needed.
                  </div>
                ) : (
                <div>
                  <Label className="text-foreground">Background style</Label>
                  <div className="grid gap-2 mt-2">
                    {BACKGROUND_OPTIONS.map((b) => (
                      <label
                        key={b.value}
                        className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer ${
                          background === b.value ? "border-orange-500 bg-orange-500/10" : "border-border"
                        }`}
                      >
                        <input
                          type="radio"
                          name="background"
                          value={b.value}
                          checked={background === b.value}
                          onChange={() => setBackground(b.value)}
                          className="sr-only"
                        />
                        <span className="text-sm text-foreground">{b.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                )}
                <div>
                  <Label className="text-foreground">Text caption style</Label>
                  <p className="text-xs text-muted-foreground mb-2">5 visual presets (click to select)</p>
                  <div className="flex flex-wrap gap-2">
                    {CAPTION_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCaptionStyle(c)}
                        className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                          captionStyle === c ? "border-orange-500 bg-orange-500/10 text-foreground" : "border-border text-muted-foreground"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="add-logo"
                    checked={addLogo}
                    onCheckedChange={(c) => {
                      const checked = !!c;
                      setAddLogo(checked);
                      if (!checked) setLogoFile(null);
                    }}
                  />
                  <Label htmlFor="add-logo" className="text-sm text-foreground cursor-pointer">Add my logo (upload)</Label>
                </div>
                {addLogo && (
                  <div className="rounded-lg border border-border bg-muted p-3 space-y-2">
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/jpg,image/svg+xml"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setLogoFile(file);
                        e.target.value = "";
                      }}
                      className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-muted file:text-foreground file:text-sm file:cursor-pointer"
                    />
                    {logoFile && (
                      <p className="text-xs text-muted-foreground">
                        Selected: {logoFile.name}
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <Label className="text-foreground text-sm">Brand colors</Label>
                  <p className="text-xs text-muted-foreground mb-2">Add up to 5 colors. Each can have a hex input and color picker.</p>
                  <div className="space-y-2">
                    {brandColors.map((hex, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="color"
                          value={toValidHex(hex)}
                          onChange={(e) => {
                            const next = [...brandColors];
                            next[i] = e.target.value;
                            setBrandColors(next);
                          }}
                          className="w-10 h-10 rounded-lg border-2 border-border cursor-pointer bg-transparent"
                        />
                        <input
                          type="text"
                          value={hex}
                          onChange={(e) => {
                            const next = [...brandColors];
                            next[i] = e.target.value;
                            setBrandColors(next);
                          }}
                          placeholder="#FFFFFF"
                          className="flex-1 min-w-0 rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted"
                          onClick={() => setBrandColors((prev) => prev.filter((_, j) => j !== i))}
                          disabled={brandColors.length <= 1}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    {brandColors.length < 5 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={() => setBrandColors((prev) => [...prev, "#999999"])}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add color
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* PLATFORM OPTIMIZATION */}
            <Card className={cardClass}>
              <CardHeader>
                <CardTitle className="text-lg text-foreground">Where will you post?</CardTitle>
                <p className="text-sm text-muted-foreground">Select all platforms you want to post on. The guide will include platform-specific strategies for each.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {VIDEO_GUIDE_PLATFORMS.map((p) => (
                    <label
                      key={p.id}
                      className={`flex items-start gap-3 cursor-pointer rounded-lg border p-3 transition-colors ${
                        platforms[p.id] ? "border-orange-500 bg-orange-500/10" : "border-border hover:border-border/80"
                      }`}
                    >
                      <Checkbox checked={!!platforms[p.id]} onCheckedChange={() => togglePlatform(p.id)} />
                      <div>
                        <span className="text-sm font-medium text-foreground">{p.label}</span>
                        <p className="text-xs text-orange-500/90 mt-0.5">{p.contentType}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{p.aspect} • {p.duration}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{p.note}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Platform selection happens before generation so the AI creates tailored content for each platform.</p>
              </CardContent>
            </Card>

            {/* ── Inline completion CTA ──────────────────────────────────────────
                This is the visual END of the settings flow. It anchors the scroll
                and makes the final action obvious even before users spot the
                fixed bottom bar. The fixed bar still provides persistence while
                scrolling through earlier sections.
            ─────────────────────────────────────────────────────────────────── */}
            <div className="rounded-2xl border border-orange-500/25 bg-orange-500/5 dark:bg-orange-500/8 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-500 mb-1">All done — ready to generate</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Your personalised Video Creation Guide includes scene-by-scene prompts, editing steps, and platform strategies.
                </p>
                <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">Takes 30–60 seconds · Saved to My Library automatically</p>
              </div>
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold gap-2 shrink-0 h-11 px-6"
                onClick={handleGenerateGuide}
                disabled={generateLoading || videoReady}
              >
                {generateLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                ) : videoReady ? (
                  <><Check className="w-4 h-4" /> Guide Ready</>
                ) : (
                  <><FileText className="w-4 h-4" /> Generate Video Guide</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Bottom bar */}
        {count > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur pt-3 pb-mobile-nav px-4 md:px-6">
            <div className="max-w-4xl mx-auto flex flex-col gap-2">
              {generateProgress && (
                <div className="flex items-center gap-2 rounded-lg bg-orange-500/10 border border-orange-500/30 px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-orange-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-orange-200 truncate">{generateProgress}</p>
                    <p className="text-xs text-orange-200/80 hidden sm:block">This may take 2–5 minutes. Don&apos;t close this page.</p>
                  </div>
                  <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
                    <div className="h-full w-1/2 animate-pulse rounded-full bg-orange-500" style={{ animationDuration: "1.5s" }} />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                {videoReady ? (
                  <div className="flex flex-col gap-1 w-full">
                    <Button
                      onClick={goToGuide}
                      size="default"
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold gap-2 w-full sm:w-auto sm:ml-auto"
                    >
                      <Check className="w-4 h-4" />
                      View Video Guide →
                    </Button>
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center sm:text-right">(Opening automatically…)</p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground hidden sm:block flex-1">
                      Personalised guide using free tools
                    </p>
                    <Button
                      className="bg-orange-500 hover:bg-orange-600 gap-2 flex-1 sm:flex-none font-semibold"
                      size="default"
                      onClick={handleGenerateGuide}
                      disabled={generateLoading}
                    >
                      {generateLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                      {generateLoading ? "Generating…" : "Create Video Guide →"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
