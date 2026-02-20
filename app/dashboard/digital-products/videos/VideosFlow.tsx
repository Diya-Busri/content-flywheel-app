"use client";

import { useState, useEffect } from "react";
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
import { ArrowLeft, Check, Play, Loader2, User, Image, Package, Sparkles, AlertCircle, FileText, Plus, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { VIDEO_GUIDE_PLATFORMS } from "@/lib/video-guide-platforms";

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

  useEffect(() => {
    try {
      const rawProduct = sessionStorage.getItem("digitalProductForm");
      if (rawProduct) {
        const data = JSON.parse(rawProduct);
        setProductName(data.productName || "Your product");
      }
      const rawScripts = sessionStorage.getItem("selectedScriptsForVideos");
      if (rawScripts) {
        const scripts = JSON.parse(rawScripts) as SelectedScriptForVideo[];
        setSelectedScripts(Array.isArray(scripts) ? scripts : []);
      }
      const rawContext = sessionStorage.getItem("productContextForVideos");
      if (rawContext) {
        const ctx = JSON.parse(rawContext) as { productId?: string };
        if (ctx.productId) setProductId(ctx.productId);
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

      const res = await fetch("/api/video-guide/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook: script.hook,
          body: script.body,
          cta: script.cta,
          productId: productId || undefined,
          platforms: selectedPlatformIds.length > 0 ? selectedPlatformIds : ["tiktok"],
          ...(logoDataUrl && { logoDataUrl }),
        }),
      });
      const guide = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(guide.error || `Request failed: ${res.status}`);
      }
      sessionStorage.setItem("videoCreationGuide", JSON.stringify({ ...guide, scriptTitle: script.title, preferredVoiceId: selectedVoiceId, scriptsForGuide: selectedScripts, productIdForGuide: productId || undefined }));
      toast({ title: "Guide ready", description: "Your personalised video creation guide is ready." });
      router.push("/dashboard/digital-products/video-guide");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast({ title: "Guide generation failed", description: msg, variant: "destructive" });
    } finally {
      setGenerateLoading(false);
      setGenerateProgress(null);
    }
  };

  const count = selectedScripts.length;
  const cardClass = "border-[#2A2A2A] bg-[#1A1A1A]";

  return (
    <main className="min-h-screen bg-[#0F0F0F] text-white mb-[100px]">
      <div className="max-w-4xl mx-auto p-6 md:p-10">
        <Link
          href="/dashboard/digital-products/scripts"
          className="inline-flex items-center gap-2 text-sm text-[#A0A0A0] hover:text-orange-500 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Scripts
        </Link>

        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-orange-500 uppercase tracking-wider">Step 3 of 3</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Customize Your Videos</h1>
        <p className="text-[#A0A0A0] mb-8">
          Based on: <span className="font-medium text-white">{productName || "Your product"}</span>
        </p>

        {count === 0 ? (
          <Card className={cardClass}>
            <CardContent className="py-12 text-center">
              <p className="text-[#A0A0A0] mb-4">
                No scripts selected. Go back and select at least one script to customize and create your Video Creation Guide.
              </p>
              <Button asChild variant="outline" className="border-[#2A2A2A] text-[#A0A0A0]">
                <Link href="/dashboard/digital-products/scripts">Back to Scripts</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-10">
            {/* VIDEO STYLE - 4 visual cards */}
            <div>
              <Label className="text-white text-base font-medium mb-4 block">What type of video are you making?</Label>
              <p className="text-sm text-[#A0A0A0] mb-4">Your guide will be tailored to your chosen style.</p>
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
                          : "border-[#2A2A2A] bg-[#1A1A1A] hover:border-[#3A3A3A]"
                      }`}
                    >
                      <Icon className="w-8 h-8 mx-auto mb-2 text-[#A0A0A0]" />
                      <p className="text-sm font-medium text-white">{s.label}</p>
                      <p className="text-xs text-[#A0A0A0] mt-0.5">{s.desc}</p>
                      <p className="text-xs text-orange-500 mt-2">{videoStyle === s.id ? "Selected" : "Select"}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* VOICE SETTINGS */}
            <Card className={cardClass}>
              <CardHeader>
                <CardTitle className="text-lg text-white">Voice settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-white">AI Voice</Label>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Select
                      value={selectedVoiceId}
                      onValueChange={setSelectedVoiceId}
                      disabled={voicesLoading}
                    >
                      <SelectTrigger className="w-full max-w-[280px] bg-[#0F0F0F] border-[#2A2A2A] text-white">
                        <SelectValue placeholder={voicesLoading ? "Loading voices…" : "Select a voice"} />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1A1A1A] border-[#2A2A2A]">
                        {voices.map((v) => (
                          <SelectItem key={v.voice_id} value={v.voice_id}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 border-[#2A2A2A] text-[#A0A0A0]"
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
                  <p className="text-xs text-[#A0A0A0] mt-2">
                    Default voices from ElevenLabs are shown. Add custom voices in your ElevenLabs account under Voices — they&apos;ll appear here automatically.
                  </p>
                </div>
                <div>
                  <Label className="text-white">Voice Speed: {speed[0].toFixed(1)}x</Label>
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
                <CardTitle className="text-lg text-white">Visual customization</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-white">Background style</Label>
                  <div className="grid gap-2 mt-2">
                    {BACKGROUND_OPTIONS.map((b) => (
                      <label
                        key={b.value}
                        className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer ${
                          background === b.value ? "border-orange-500 bg-orange-500/10" : "border-[#2A2A2A]"
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
                        <span className="text-sm text-[#E0E0E0]">{b.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-white">Text caption style</Label>
                  <p className="text-xs text-[#A0A0A0] mb-2">5 visual presets (click to select)</p>
                  <div className="flex flex-wrap gap-2">
                    {CAPTION_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCaptionStyle(c)}
                        className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                          captionStyle === c ? "border-orange-500 bg-orange-500/10 text-white" : "border-[#2A2A2A] text-[#A0A0A0]"
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
                  <Label htmlFor="add-logo" className="text-sm text-[#E0E0E0] cursor-pointer">Add my logo (upload)</Label>
                </div>
                {addLogo && (
                  <div className="rounded-lg border border-[#2A2A2A] bg-[#0F0F0F] p-3 space-y-2">
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/jpg,image/svg+xml"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setLogoFile(file);
                        e.target.value = "";
                      }}
                      className="block w-full text-sm text-[#A0A0A0] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#2A2A2A] file:text-white file:text-sm file:cursor-pointer"
                    />
                    {logoFile && (
                      <p className="text-xs text-[#A0A0A0]">
                        Selected: {logoFile.name}
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <Label className="text-white text-sm">Brand colors</Label>
                  <p className="text-xs text-[#A0A0A0] mb-2">Add up to 5 colors. Each can have a hex input and color picker.</p>
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
                          className="w-10 h-10 rounded-lg border-2 border-[#2A2A2A] cursor-pointer bg-transparent"
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
                          className="flex-1 min-w-0 rounded-lg border border-[#2A2A2A] bg-[#0F0F0F] px-3 py-2 text-sm text-white placeholder:text-[#6A6A6A]"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-9 w-9 text-[#A0A0A0] hover:text-white hover:bg-[#2A2A2A]"
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
                        className="gap-1.5 border-[#2A2A2A] text-[#A0A0A0] hover:bg-[#2A2A2A] hover:text-white"
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
                <CardTitle className="text-lg text-white">Target platforms</CardTitle>
                <p className="text-sm text-[#A0A0A0]">Select all platforms you want to post on. The guide will include platform-specific strategies for each.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {VIDEO_GUIDE_PLATFORMS.map((p) => (
                    <label
                      key={p.id}
                      className={`flex items-start gap-3 cursor-pointer rounded-lg border p-3 transition-colors ${
                        platforms[p.id] ? "border-orange-500 bg-orange-500/10" : "border-[#2A2A2A] hover:border-[#3A3A3A]"
                      }`}
                    >
                      <Checkbox checked={!!platforms[p.id]} onCheckedChange={() => togglePlatform(p.id)} />
                      <div>
                        <span className="text-sm font-medium text-white">{p.label}</span>
                        <p className="text-xs text-orange-500/90 mt-0.5">{p.contentType}</p>
                        <p className="text-xs text-[#A0A0A0] mt-0.5">{p.aspect} • {p.duration}</p>
                        <p className="text-xs text-[#6A6A6A] mt-0.5">{p.note}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-[#A0A0A0] mt-2">Platform selection happens before generation so the AI creates tailored content for each platform.</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Bottom bar */}
        {count > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#2A2A2A] bg-[#0F0F0F]/95 backdrop-blur py-4 px-4 md:px-6">
            <div className="max-w-4xl mx-auto flex flex-col gap-3">
              {generateProgress && (
                <div className="flex items-center gap-3 rounded-lg bg-orange-500/10 border border-orange-500/30 px-4 py-2">
                  <Loader2 className="w-5 h-5 animate-spin text-orange-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-orange-200">{generateProgress}</p>
                    <p className="text-xs text-orange-200/80">This may take 2–5 minutes. Don&apos;t close this page.</p>
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-[#2A2A2A] overflow-hidden">
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-orange-500" style={{ animationDuration: "1.5s" }} />
                  </div>
                </div>
              )}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="flex flex-col sm:items-end gap-2 sm:ml-auto">
                  <p className="text-sm text-[#A0A0A0]">
                    Get a personalised step-by-step guide to create your video using free tools
                  </p>
                  <Button
                    className="bg-orange-500 hover:bg-orange-600 gap-2"
                    size="lg"
                    onClick={handleGenerateGuide}
                    disabled={generateLoading}
                  >
                    {generateLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                    {generateLoading ? "Generating..." : "Create Video Guide →"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
