"use client";

import { useState, useCallback, useEffect } from "react";
import { Loader2, Copy, Check, ChevronDown, ChevronUp, RefreshCw, Mail, Zap, BookMarked, Shirt, CheckCircle2, LayoutTemplate, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { setTemplateStudioPrefill } from "@/lib/template-studio-prefill";
import type { DropCampaign, DropDay, CarouselSlide } from "@/app/api/drop-campaign/route";

const PHASE_STYLES: Record<DropDay["phase"], { bg: string; text: string; label: string; emoji: string }> = {
  teaser:  { bg: "bg-gray-900 dark:bg-black",  text: "text-white",  label: "Teaser",   emoji: "👁" },
  reveal:  { bg: "bg-orange-500",               text: "text-white",  label: "Reveal",   emoji: "🔥" },
  hype:    { bg: "bg-amber-400",                text: "text-black",  label: "Hype",     emoji: "⚡" },
  urgency: { bg: "bg-red-600",                  text: "text-white",  label: "Urgency",  emoji: "⏳" },
  drop:    { bg: "bg-green-600",                text: "text-white",  label: "Drop Day", emoji: "🚀" },
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type PodProduct = {
  id: string;
  title: string;
  blueprintTitle: string | null;
  mockupUrls: unknown;
  designFileUrl: string | null;
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-[#2A2A2A] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function CarouselPreview({ slides, day }: { slides: CarouselSlide[]; day: DropDay }) {
  const openInStudio = () => {
    setTemplateStudioPrefill({
      slides: slides.map(s => ({ heading: s.heading, body: s.body, bg_color: "#111111" })),
      brandPrimary: "#111111",
      brandSecondary: "#f97316",
    });
    window.open("/dashboard/template-studio?mode=3&prefill=1", "_blank");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold flex items-center gap-1.5">
          <ImageIcon className="w-3 h-3" /> Carousel Slides
        </p>
        <button
          onClick={openInStudio}
          className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-black hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors"
        >
          <LayoutTemplate className="w-3 h-3" />
          Design in Template Studio
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {slides.map((slide, i) => (
          <div key={i} className="flex-shrink-0 w-36 h-36 rounded-xl bg-gray-950 dark:bg-black p-3 flex flex-col justify-between border border-gray-800">
            <p className="text-white text-xs font-bold leading-tight">{slide.heading}</p>
            <p className="text-gray-400 text-[10px] leading-snug">{slide.body}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 mt-1">↑ Click &ldquo;Design in Template Studio&rdquo; to turn these into 1080×1080 slides</p>
    </div>
  );
}

function DayCard({ day }: { day: DropDay }) {
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const phase = PHASE_STYLES[day.phase];
  const captionFull = `${day.instagramCaption}\n\n${day.hashtags.join(" ")}`;

  const saveCaption = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/caption-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Day ${day.day} — ${day.phaseLabel} (Drop Campaign)`,
          caption: day.instagramCaption,
          hashtags: day.hashtags.join(" "),
          platform: "instagram",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setSaved(true);
      toast({ title: "Saved to Caption Library ✓" });
    } catch {
      toast({ title: "Could not save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#222] transition-colors">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${phase.bg} ${phase.text}`}>
            {DAY_NAMES[day.day - 1] ?? `D${day.day}`}
          </div>
          <div className="text-left">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {phase.emoji} Day {day.day} — {day.phaseLabel}
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic truncate max-w-xs">&ldquo;{day.facelessHook}&rdquo;</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 border-t border-gray-100 dark:border-[#2A2A2A] space-y-4">

          {/* Kinetic Typography script */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Kinetic Typography Video</p>
              <button
                type="button"
                onClick={() => {
                  try {
                    const existing = JSON.parse(localStorage.getItem("cf:ts:draft") ?? "{}") as Record<string, unknown>;
                    localStorage.setItem("cf:ts:draft", JSON.stringify({
                      ...existing,
                      mode: "13",
                      kineticTopic: day.facelessScript.join(". "),
                    }));
                  } catch { /* ignore */ }
                  window.open("/dashboard/template-studio", "_blank");
                }}
                className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-black hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Make this video →
              </button>
            </div>
            <div className="rounded-xl bg-gray-950 dark:bg-black p-4 space-y-2">
              {day.facelessScript.map((line, i) => (
                <p key={i} className={`text-center font-semibold leading-snug ${i === 0 ? "text-orange-400 text-sm" : "text-white text-sm"}`}>{line}</p>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">↑ Like the dark text videos you make in Template Studio — click &ldquo;Make this video&rdquo; to open it pre-filled</p>
          </div>

          {/* Carousel (if available) */}
          {day.carousel && day.carousel.length > 0 && (
            <CarouselPreview slides={day.carousel} day={day} />
          )}

          {/* Instagram caption */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Caption + Hashtags</p>
              <div className="flex items-center gap-1">
                <button onClick={saveCaption} disabled={saving || saved}
                  className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md transition-all ${saved ? "text-green-600 bg-green-50 dark:bg-green-950/20" : "text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/20"}`}>
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? <Check className="w-3 h-3" /> : <BookMarked className="w-3 h-3" />}
                  {saved ? "Saved" : "Save"}
                </button>
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
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#222] transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
            <Mail className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Launch Day Email</span>
            <p className="text-xs text-gray-500 mt-0.5 italic truncate max-w-xs">{email.subject}</p>
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
  const [products, setProducts] = useState<PodProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [productName, setProductName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [niche, setNiche] = useState("");
  const [dropDate, setDropDate] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [allSaved, setAllSaved] = useState(false);
  const [campaign, setCampaign] = useState<DropCampaign | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/pod/list-products").then(r => r.json()).then((data: PodProduct[]) => {
      if (Array.isArray(data)) setProducts(data);
    }).catch(() => {});

    Promise.all([
      fetch("/api/brand-profile").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/content-studio/user-settings").then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([brand, settings]) => {
      if (brand?.brandName) setBrandName(brand.brandName);
      const nicheVal = brand?.nicheIndustry || settings?.selected_niche;
      if (nicheVal) setNiche(nicheVal);
    });
  }, []);

  const handleSelectProduct = (id: string) => {
    setSelectedProductId(id);
    const p = products.find(pr => pr.id === id);
    if (p) setProductName(p.title);
  };

  const generate = useCallback(async () => {
    if (!productName.trim()) {
      toast({ title: "Enter a product name", variant: "destructive" });
      return;
    }
    setLoading(true);
    setCampaign(null);
    setAllSaved(false);
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
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [productName, brandName, niche, dropDate, price, toast]);

  const saveAllCaptions = async () => {
    if (!campaign) return;
    setSavingAll(true);
    try {
      await Promise.all(campaign.days.map(day =>
        fetch("/api/caption-library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `Day ${day.day} — ${day.phaseLabel} (Drop Campaign)`,
            caption: day.instagramCaption,
            hashtags: day.hashtags.join(" "),
            platform: "instagram",
          }),
        })
      ));
      setAllSaved(true);
      toast({ title: "All 7 captions saved to Caption Library ✓" });
    } catch {
      toast({ title: "Some captions failed to save", variant: "destructive" });
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🚀</span>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Drop Campaign</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Pick a product → get 7 days of faceless content: text-on-screen video scripts, carousel slides, captions, and a launch email. No filming, no face on camera.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-5 space-y-4">
        {products.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Pick from your products</Label>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
              {products.map(p => {
                const mockups = (p.mockupUrls as string[]) ?? [];
                const thumb = mockups[0] ?? p.designFileUrl;
                const isSelected = selectedProductId === p.id;
                return (
                  <button key={p.id} type="button" onClick={() => handleSelectProduct(p.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${isSelected ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20" : "border-gray-200 dark:border-[#2A2A2A] hover:border-orange-300"}`}>
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-[#2A2A2A] flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {thumb
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={thumb} alt={p.title} className="w-full h-full object-cover" />
                        : <Shirt className="w-5 h-5 text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.title}</p>
                      {p.blueprintTitle && <p className="text-xs text-gray-400 truncate">{p.blueprintTitle}</p>}
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-orange-500 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-400">Or type a product name below</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5 col-span-2 sm:col-span-1">
            <Label className="text-xs text-gray-500">Product name <span className="text-red-400">*</span></Label>
            <Input placeholder="e.g. Void Hours Hoodie" value={productName}
              onChange={e => { setProductName(e.target.value); setSelectedProductId(""); }}
              className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#2A2A2A]" />
          </div>
          <div className="space-y-1.5 col-span-2 sm:col-span-1">
            <Label className="text-xs text-gray-500">Brand name</Label>
            <Input placeholder="e.g. Void Hours" value={brandName} onChange={e => setBrandName(e.target.value)}
              className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#2A2A2A]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Niche</Label>
            <Input placeholder="e.g. streetwear" value={niche} onChange={e => setNiche(e.target.value)}
              className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#2A2A2A]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Price <span className="text-gray-400">(optional)</span></Label>
            <Input placeholder="e.g. £65" value={price} onChange={e => setPrice(e.target.value)}
              className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#2A2A2A]" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-gray-500">Drop date <span className="text-gray-400">(optional)</span></Label>
          <Input type="date" value={dropDate} onChange={e => setDropDate(e.target.value)}
            className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#2A2A2A] w-48" />
        </div>

        <Button onClick={generate} disabled={loading}
          className="w-full bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-black gap-2 font-semibold">
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" />Building campaign...</>
            : <><Zap className="w-4 h-4" />Generate 7-Day Drop Campaign</>}
        </Button>
      </div>

      {campaign && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{campaign.productName}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{campaign.brandName} · {campaign.niche}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={saveAllCaptions} disabled={savingAll || allSaved} className="gap-1.5 text-xs">
                {savingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : allSaved ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <BookMarked className="w-3.5 h-3.5" />}
                {allSaved ? "All saved!" : "Save all captions"}
              </Button>
              <Button variant="outline" size="sm" onClick={generate} disabled={loading} className="gap-1.5 text-xs">
                <RefreshCw className="w-3.5 h-3.5" /> Regenerate
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 pb-1">
            {(Object.entries(PHASE_STYLES) as [DropDay["phase"], typeof PHASE_STYLES[DropDay["phase"]]][]).map(([, info]) => (
              <span key={info.label} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${info.bg} ${info.text}`}>
                {info.emoji} {info.label}
              </span>
            ))}
          </div>

          {campaign.days.map(day => <DayCard key={day.day} day={day} />)}
          <EmailCard email={campaign.launchEmail} discountCode={campaign.discountCode} />
        </div>
      )}
    </div>
  );
}
