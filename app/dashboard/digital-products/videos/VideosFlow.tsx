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
import { ArrowLeft, Check, Play, Loader2, User, Image, Package, Sparkles } from "lucide-react";

const VOICE_OPTIONS = [
  "Professional Male (British)",
  "Friendly Female (American)",
  "Energetic Male (Australian)",
  "Professional Female (British)",
  "Calm & Authoritative (American)",
];

const BACKGROUND_OPTIONS = [
  { value: "clean", label: "Clean Minimal (white/gradient)" },
  { value: "lifestyle", label: "Lifestyle B-roll (travel/office/lifestyle)" },
  { value: "product", label: "Product Focus (your product hero shot)" },
  { value: "custom", label: "Upload Custom Image" },
];

const CAPTION_PRESETS = ["Bold sans", "Minimal serif", "High contrast", "Subtle overlay", "Animated words"];

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
  const [productName, setProductName] = useState<string>("");
  const [selectedScripts, setSelectedScripts] = useState<SelectedScriptForVideo[]>([]);
  const [videoStyle, setVideoStyle] = useState<string>("broll");
  const [voice, setVoice] = useState<string>(VOICE_OPTIONS[0]);
  const [speed, setSpeed] = useState<number[]>([1]);
  const [background, setBackground] = useState<string>("clean");
  const [captionStyle, setCaptionStyle] = useState<string>(CAPTION_PRESETS[0]);
  const [addLogo, setAddLogo] = useState(false);
  const [platforms, setPlatforms] = useState({ tiktok: true, instagram: true, youtube: false });
  const [previewLoading, setPreviewLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);

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
    } catch {
      setSelectedScripts([]);
    }
  }, []);

  const togglePlatform = (key: "tiktok" | "instagram" | "youtube") => {
    setPlatforms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePreview = () => {
    setPreviewLoading(true);
    setTimeout(() => setPreviewLoading(false), 2500);
  };

  const handleGenerateFull = () => {
    setGenerateLoading(true);
    setTimeout(() => {
      setGenerateLoading(false);
      router.push("/dashboard/digital-products/results");
    }, 2000);
  };

  const count = selectedScripts.length;
  const cardClass = "border-[#2A2A2A] bg-[#1A1A1A]";

  return (
    <main className="min-h-screen bg-[#0F0F0F] text-white pb-32">
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
                No scripts selected. Go back and select at least one script to customize and generate videos.
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
              <Label className="text-white text-base font-medium mb-4 block">Video style</Label>
              <p className="text-sm text-[#A0A0A0] mb-4">Choose how your video looks</p>
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
                    <Select value={voice} onValueChange={setVoice}>
                      <SelectTrigger className="w-full max-w-[280px] bg-[#0F0F0F] border-[#2A2A2A] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1A1A1A] border-[#2A2A2A]">
                        {VOICE_OPTIONS.map((v) => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="gap-1 border-[#2A2A2A] text-[#A0A0A0]">
                      <Play className="w-3.5 h-3.5" /> Play 5-second sample
                    </Button>
                  </div>
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
                    onCheckedChange={(c) => setAddLogo(!!c)}
                  />
                  <Label htmlFor="add-logo" className="text-sm text-[#E0E0E0] cursor-pointer">Add my logo (upload)</Label>
                </div>
                <div>
                  <Label className="text-white text-sm">Brand color</Label>
                  <p className="text-xs text-[#A0A0A0]">Auto-suggested from product</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-orange-500 border-2 border-[#2A2A2A]" />
                    <span className="text-sm text-[#A0A0A0]">#FF6B35</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* PLATFORM OPTIMIZATION */}
            <Card className={cardClass}>
              <CardHeader>
                <CardTitle className="text-lg text-white">Platform optimization</CardTitle>
                <p className="text-sm text-[#A0A0A0]">Which platforms? (select all that apply)</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox checked={platforms.tiktok} onCheckedChange={() => togglePlatform("tiktok")} />
                  <span className="text-sm text-[#E0E0E0]">TikTok (9:16, 30s recommended)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox checked={platforms.instagram} onCheckedChange={() => togglePlatform("instagram")} />
                  <span className="text-sm text-[#E0E0E0]">Instagram Reels (9:16, 60s recommended)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox checked={platforms.youtube} onCheckedChange={() => togglePlatform("youtube")} />
                  <span className="text-sm text-[#E0E0E0]">YouTube Shorts (9:16, up to 60s)</span>
                </label>
                <p className="text-xs text-[#A0A0A0] mt-2">Selecting multiple platforms creates optimized versions for each.</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Bottom bar */}
        {count > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#2A2A2A] bg-[#0F0F0F]/95 backdrop-blur py-4 px-4 md:px-6">
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handlePreview}
                  disabled={previewLoading}
                  className="gap-2 border-[#2A2A2A] text-[#A0A0A0]"
                >
                  {previewLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Preview 10s Sample
                </Button>
                <p className="text-xs text-[#A0A0A0]">Free, watermarked. See how it looks before generating.</p>
              </div>
              <div className="flex flex-col sm:items-end gap-2">
                <p className="text-sm text-[#A0A0A0]">
                  Ready to generate {count} video{count !== 1 ? "s" : ""} • Costs {count} credit{count !== 1 ? "s" : ""}
                </p>
                <Button
                  className="bg-orange-500 hover:bg-orange-600 gap-2"
                  size="lg"
                  onClick={handleGenerateFull}
                  disabled={generateLoading}
                >
                  {generateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Generate Full Videos →
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
