"use client";

import { useState, useCallback } from "react";
import { Sparkles, Loader2, Copy, Check, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import type { FacelessPost, FacelessPlan } from "@/app/api/content-studio/faceless-content/route";

const TYPE_LABELS: Record<FacelessPost["type"], { label: string; emoji: string; desc: string }> = {
  "text-video":     { label: "Text Video",      emoji: "📝", desc: "Dark screen, text line by line" },
  "product-reveal": { label: "Product Reveal",  emoji: "🖤", desc: "Mockup or product shot only" },
  "screen-record":  { label: "Screen Record",   emoji: "🎬", desc: "App or build process recording" },
  "quote-card":     { label: "Quote Card",      emoji: "✦",  desc: "Static image for Instagram" },
  "teaser":         { label: "Teaser",          emoji: "👁",  desc: "Mystery — something is coming" },
};

const PLATFORM_LABELS: Record<FacelessPost["platform"], string> = {
  tiktok:    "TikTok",
  instagram: "Instagram",
  both:      "TikTok + Instagram",
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="ml-1 p-1 rounded hover:bg-gray-100 dark:hover:bg-[#2A2A2A] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function PostCard({ post }: { post: FacelessPost }) {
  const [open, setOpen] = useState(true);
  const typeInfo = TYPE_LABELS[post.type];
  const captionWithHashtags = `${post.caption}\n\n${post.hashtags.join(" ")}`;

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#222] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-900 dark:bg-white text-white dark:text-black flex items-center justify-center text-xs font-bold flex-shrink-0">
            {DAY_NAMES[post.day - 1] ?? `D${post.day}`}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {typeInfo.emoji} {typeInfo.label}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#2A2A2A] text-gray-500 dark:text-gray-400">
                {PLATFORM_LABELS[post.platform]}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">&ldquo;{post.hook}&rdquo;</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-[#2A2A2A] pt-3">

          {/* Script (text-video / teaser) */}
          {post.script.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Script</p>
                <CopyButton text={post.script.join("\n")} />
              </div>
              <div className="rounded-xl bg-gray-950 dark:bg-black p-3 space-y-1.5">
                {post.script.map((line, i) => (
                  <p key={i} className="text-white text-sm font-medium leading-snug text-center">
                    {line}
                  </p>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">↑ Each line appears one at a time on screen</p>
            </div>
          )}

          {/* Caption + hashtags */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Caption + Hashtags</p>
              <CopyButton text={captionWithHashtags} />
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-[#111] p-3">
              <p className="text-sm text-gray-800 dark:text-gray-200">{post.caption}</p>
              <p className="text-xs text-orange-500 mt-2 leading-relaxed">{post.hashtags.join(" ")}</p>
            </div>
          </div>

          {/* Production tip */}
          {post.tip && (
            <div className="rounded-xl border border-orange-200 dark:border-orange-900/30 bg-orange-50 dark:bg-orange-950/10 p-3">
              <p className="text-[10px] uppercase tracking-widest text-orange-500 font-semibold mb-1">How to make it</p>
              <p className="text-xs text-gray-700 dark:text-gray-300">{post.tip}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FacelessPlannerClient() {
  const [brandName, setBrandName] = useState("");
  const [niche, setNiche] = useState("");
  const [week, setWeek] = useState(1);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<FacelessPlan | null>(null);
  const { toast } = useToast();

  const generate = useCallback(async () => {
    setLoading(true);
    setPlan(null);
    try {
      const res = await fetch("/api/content-studio/faceless-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName: brandName.trim() || undefined, niche: niche.trim() || undefined, week }),
      });
      const data = await res.json() as FacelessPlan & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setPlan(data);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to generate plan", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [brandName, niche, week, toast]);

  return (
    <div className="max-w-2xl space-y-6">
      {/* Config */}
      <div className="rounded-2xl border border-gray-100 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Brand name <span className="text-gray-400">(optional)</span></Label>
            <Input
              placeholder="e.g. Void Hours"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#2A2A2A]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Niche <span className="text-gray-400">(optional)</span></Label>
            <Input
              placeholder="e.g. streetwear brand"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#2A2A2A]"
            />
          </div>
        </div>
        <p className="text-[11px] text-gray-400">Leave blank to use your saved brand profile. Niche Research → saves your niche automatically.</p>

        {/* Week selector */}
        <div>
          <Label className="text-xs text-gray-500 mb-2 block">Week</Label>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWeek(w)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all ${week === w ? "bg-gray-900 dark:bg-white text-white dark:text-black border-gray-900 dark:border-white" : "border-gray-200 dark:border-[#2A2A2A] text-gray-500 hover:border-gray-400"}`}
              >
                Week {w}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={generate}
          disabled={loading}
          className="w-full bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-black gap-2 font-semibold"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" />Generating plan...</>
            : <><Sparkles className="w-4 h-4" />Generate 7-day plan</>}
        </Button>
      </div>

      {/* Plan */}
      {plan && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Week {plan.week} — {plan.brandName}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">{plan.niche}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={generate}
              disabled={loading}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate
            </Button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-2 pb-1">
            {Object.entries(TYPE_LABELS).map(([type, info]) => (
              <span key={type} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#2A2A2A] text-gray-500 dark:text-gray-400">
                {info.emoji} {info.label}
              </span>
            ))}
          </div>

          {plan.posts.map((post) => (
            <PostCard key={post.day} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
