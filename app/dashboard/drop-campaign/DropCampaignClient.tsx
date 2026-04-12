"use client";

import { useState, useCallback } from "react";
import { Sparkles, Loader2, Copy, Check, ChevronDown, ChevronUp, RefreshCw, Mail, Zap, BookMarked } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import type { DropCampaign, DropDay } from "@/app/api/drop-campaign/route";

const PHASE_STYLES: Record<DropDay["phase"], { bg: string; text: string; border: string; label: string; emoji: string }> = {
  teaser:  { bg: "bg-gray-900 dark:bg-black",          text: "text-white",           border: "border-gray-700",                    label: "Teaser",   emoji: "👁" },
  reveal:  { bg: "bg-orange-500",                       text: "text-white",           border: "border-orange-400",                  label: "Reveal",   emoji: "🔥" },
  hype:    { bg: "bg-amber-400",                        text: "text-black",           border: "border-amber-300",                   label: "Hype",     emoji: "⚡" },
  urgency: { bg: "bg-red-600",                          text: "text-white",           border: "border-red-400",                     label: "Urgency",  emoji: "⏳" },
  drop:    { bg: "bg-green-600",                        text: "text-white",           border: "border-green-400",                   label: "Drop Day", emoji: "🚀" },
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-[#2A2A2A] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors ${className}`}>
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function SaveCaptionButton({ day, caption, hashtags }: { day: DropDay; caption: string; hashtags: string[] }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/caption-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Day ${day.day} — ${day.phaseLabel} (Drop Campaign)`,
          caption,
          hashtags: hashtags.join(" "),
          platform: "instagram",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setSaved(true);
      toast({ title: "Saved to Caption Library ✓" });
    } catch {
      toast({ title: "Error", description: "Could not save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      onClick={save}
      disabled={saving || saved}
      className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md transition-all ${
        saved
          ? "text-green-600 bg-green-50 dark:bg-green-950/20"
          : "text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/20"
      }`}
    >
      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? <Check className="w-3 h-3" /> : <BookMarked className="w-3 h-3" />}
      {saved ? "Saved" : "Save"}
    </button>
  );
}

function DayCard({ day }: { day: DropDay }) {
  const [open, setOpen] = useState(true);
  const phase = PHASE_STYLES[day.phase];
  const captionFull = `${day.instagramCaption}\n\n${day.hashtags.join(" ")}`;

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#222] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${phase.bg} ${phase.text}`}>
            {DAY_NAMES[day.day - 1] ?? `D${day.day}`}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {phase.emoji} Day {day.day} — {day.phaseLabel}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic truncate max-w-xs">&ldquo;{day.tiktokHook}&rdquo;</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 border-t border-gray-100 dark:border-[#2A2A2A] space-y-3">
          {/* TikTok script */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">TikTok Script</p>
              <CopyButton text={day.tiktokScript.join("\n")} />
            </div>
            <div className="rounded-xl bg-gray-950 dark:bg-black p-3 space-y-1.5">
              {day.tiktokScript.map((line, i) => (
                <p key={i} className="text-white text-sm font-medium leading-snug text-center">{line}</p>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">↑ Each line appears on screen one at a time</p>
          </div>

          {/* Instagram caption */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Instagram Caption</p>
              <div className="flex items-center gap-1">
                <SaveCaptionButton day={day} caption={day.instagramCaption} hashtags={day.hashtags} />
                <CopyButton text={captionFull} />
              </div>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-[#111] p-3">
              <p className="text-sm text-gray-800 dark:text-gray-200">{day.instagramCaption}</p>
              <p className="text-xs text-orange-500 mt-2 leading-relaxed">{day.hashtags.join(" ")}</p>
            </div>
          </div>

          {/* Story idea */}
          <div className="rounded-xl border border-orange-200 dark:border-orange-900/30 bg-orange-50 dark:bg-orange-950/10 p-3">
            <p className="text-[10px] uppercase tracking-widest text-orange-500 font-semibold mb-1">Story Idea</p>
            <p className="text-xs text-gray-700 dark:text-gray-300">{day.storyIdea}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function EmailCard({ email, discountCode }: { email: DropCampaign["launchEmail"]; discountCode: string }) {
  const [open, setOpen] = useState(false);
  const full = `Subject: ${email.subject}\n\n${email.body}`;
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#222] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
            <Mail className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Launch Day Email</span>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic truncate max-w-xs">{email.subject}</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 border-t border-gray-100 dark:border-[#2A2A2A] space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Subject</p>
              <CopyButton text={email.subject} />
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-[#111] p-3">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{email.subject}</p>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Email Body</p>
              <CopyButton text={full} />
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-[#111] p-3">
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{email.body}</p>
            </div>
          </div>
          <div className="rounded-xl border border-green-200 dark:border-green-900/30 bg-green-50 dark:bg-green-950/10 p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-green-600 font-semibold mb-0.5">Discount Code</p>
              <p className="text-lg font-bold font-mono text-gray-900 dark:text-white tracking-widest">{discountCode}</p>
            </div>
            <CopyButton text={discountCode} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function DropCampaignClient() {
  const [productName, setProductName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [niche, setNiche] = useState("");
  const [dropDate, setDropDate] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [campaign, setCampaign] = useState<DropCampaign | null>(null);
  const { toast } = useToast();

  const generate = useCallback(async () => {
    if (!productName.trim()) {
      toast({ title: "Enter a product name", variant: "destructive" });
      return;
    }
    setLoading(true);
    setCampaign(null);
    try {
      const res = await fetch("/api/drop-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: productName.trim(),
          brandName: brandName.trim() || undefined,
          niche: niche.trim() || undefined,
          dropDate: dropDate || undefined,
          price: price.trim() || undefined,
        }),
      });
      const data = await res.json() as DropCampaign & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setCampaign(data);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to generate campaign", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [productName, brandName, niche, dropDate, price, toast]);

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🚀</span>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Drop Campaign</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Enter your product and get a complete 7-day launch campaign — TikTok scripts, Instagram captions, stories, and a launch email. Ready to copy and post.
        </p>
      </div>

      {/* Config */}
      <div className="rounded-2xl border border-gray-100 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5 col-span-2 sm:col-span-1">
            <Label className="text-xs text-gray-500">Product name <span className="text-red-400">*</span></Label>
            <Input
              placeholder="e.g. Void Hours Hoodie"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#2A2A2A]"
            />
          </div>
          <div className="space-y-1.5 col-span-2 sm:col-span-1">
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
              placeholder="e.g. streetwear"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#2A2A2A]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Price <span className="text-gray-400">(optional)</span></Label>
            <Input
              placeholder="e.g. £65"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#2A2A2A]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-gray-500">Drop date <span className="text-gray-400">(optional)</span></Label>
          <Input
            type="date"
            value={dropDate}
            onChange={(e) => setDropDate(e.target.value)}
            className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#2A2A2A] w-48"
          />
        </div>

        <Button
          onClick={generate}
          disabled={loading}
          className="w-full bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-black gap-2 font-semibold"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" />Building campaign...</>
            : <><Zap className="w-4 h-4" />Generate 7-Day Drop Campaign</>}
        </Button>
      </div>

      {/* Campaign output */}
      {campaign && (
        <div className="space-y-3">
          {/* Summary bar */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {campaign.productName}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">{campaign.brandName} · {campaign.niche}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold px-2 py-1 rounded-lg bg-gray-100 dark:bg-[#2A2A2A] text-gray-600 dark:text-gray-400">
                {campaign.discountCode}
              </span>
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
          </div>

          {/* Phase legend */}
          <div className="flex flex-wrap gap-1.5 pb-1">
            {(Object.entries(PHASE_STYLES) as [DropDay["phase"], typeof PHASE_STYLES[DropDay["phase"]]][]).map(([, info]) => (
              <span key={info.label} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${info.bg} ${info.text}`}>
                {info.emoji} {info.label}
              </span>
            ))}
          </div>

          {/* Day cards */}
          {campaign.days.map((day) => (
            <DayCard key={day.day} day={day} />
          ))}

          {/* Email */}
          <EmailCard email={campaign.launchEmail} discountCode={campaign.discountCode} />
        </div>
      )}
    </div>
  );
}
