"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowLeft,
  Star,
  Loader2,
  RefreshCw,
  Pencil,
  Check,
  Trash2,
  Copy,
  Plus,
  Wrench,
  BookOpen,
} from "lucide-react";
import { VIDEO_LENGTH_OPTIONS, DEFAULT_VIDEO_LENGTH_SEC } from "@/lib/video-length-options";
import { cleanProductTitle, replaceProductTitleInText } from "@/lib/product-title";

const LENGTH_OPTIONS = [15, 30, 60, 90] as const;
type LengthOption = (typeof LENGTH_OPTIONS)[number];

const CHAR_LIMITS: Record<LengthOption, { hook: number; body: number; cta: number }> = {
  15: { hook: 50, body: 150, cta: 50 },
  30: { hook: 100, body: 300, cta: 100 },
  60: { hook: 150, body: 600, cta: 150 },
  90: { hook: 200, body: 900, cta: 200 },
};

/** Section time ranges (seconds) for a given video length. Single source of truth for labels. */
function getSectionRanges(totalSec: number): { hook: string; body: string; cta: string } {
  const hookEnd = Math.round(totalSec * 0.1) || 1;
  const bodyEnd = Math.round(totalSec * 0.85);
  return {
    hook: `0-${hookEnd} seconds`,
    body: `${hookEnd}-${bodyEnd} seconds`,
    cta: `${bodyEnd}-${totalSec} seconds`,
  };
}

type SectionType = "hook" | "body" | "cta";

interface ScriptData {
  id: string;
  title: string;
  isStarred: boolean;
  length: LengthOption;
  platforms: { tiktok: boolean; instagram: boolean; youtube: boolean };
  hook: string;
  body: string;
  cta: string;
  hookStrength: "Strong" | "Good" | "Weak";
  engagementPotential: "High" | "Medium" | "Low";
  conversionFocus: boolean;
  compliance: { tiktok: string; instagram: string; youtube: string };
  isSelected: boolean;
  isCustom?: boolean;
  isLengthUpdating?: boolean;
}

interface ProductFormData {
  productName?: string;
  productDescription?: string;
  productType?: string;
  productFileOrLinkMode?: string;
  productSalesPageLink?: string;
  productUrl?: string;
  hasFile?: boolean;
  fileName?: string;
}

function isPound5SavingChallenge(product: ProductFormData | null): boolean {
  if (!product?.productName && !product?.productDescription) return false;
  const name = (product.productName ?? "").toLowerCase();
  const desc = (product.productDescription ?? "").toLowerCase();
  return (
    name.includes("£5") ||
    name.includes("5 saving") ||
    name.includes("saving challenge") ||
    desc.includes("£5") ||
    desc.includes("five pound") ||
    desc.includes("every £5 note")
  );
}

function generateMockScripts(product: ProductFormData | null): ScriptData[] {
  const name = product?.productName?.trim() || "Product";
  const desc = product?.productDescription?.trim() || "";

  if (isPound5SavingChallenge(product)) {
    return [
      {
        id: "1",
        title: "Problem-Solution Angle",
        isStarred: false,
        length: 30,
        platforms: { tiktok: true, instagram: true, youtube: false },
        hook: "Stop struggling to save money. This £5 trick changed everything.",
        body: "The £5 Saving Challenge is simple: every time you get a £5 note, you save it. No budgeting apps, no complicated rules. Just put it away and watch your emergency fund grow.\n\nWhat you get:\n• A PDF tracker so you never lose count\n• See your progress week by week\n• Perfect for building a first emergency fund or a holiday fund\n\nSo many people say they can't save—but you get £5 notes all the time. This turns that into real money.",
        cta: "Download the tracker now and start your challenge. Link in bio.",
        hookStrength: "Strong",
        engagementPotential: "High",
        conversionFocus: true,
        compliance: { tiktok: "Approved", instagram: "Approved", youtube: "Approved" },
        isSelected: false,
      },
      {
        id: "2",
        title: "Results / Transformation Angle",
        isStarred: true,
        length: 30,
        platforms: { tiktok: true, instagram: true, youtube: true },
        hook: "I saved over £1,000 without even trying. Here's how...",
        body: "I did the £5 Saving Challenge for 6 months. Every £5 note went into an envelope. I didn't change my spending—I just saved the fivers. The tracker kept me honest.\n\nBy the end I had over £1,000. No stress, no spreadsheets. Just a simple rule: see a £5, save a £5.\n\nThe PDF tracker is in my bio. You get the guide and the tracker. Start this week and see how fast it adds up.",
        cta: "Link in bio for the full £5 Saving Challenge guide. Comment SAVE if you're starting today!",
        hookStrength: "Strong",
        engagementPotential: "High",
        conversionFocus: true,
        compliance: { tiktok: "Approved", instagram: "Approved", youtube: "Approved" },
        isSelected: true,
      },
      {
        id: "3",
        title: "How-It-Works Angle",
        isStarred: false,
        length: 30,
        platforms: { tiktok: true, instagram: true, youtube: true },
        hook: "Every time I get a £5 note, I do this one thing...",
        body: "The £5 Saving Challenge: whenever you receive a £5 note—change from a coffee, a sale, whatever—you set it aside instead of spending it. That's it.\n\nYou get a digital PDF tracker to log how many you save. Most people save £50–£200 a month without feeling it. Great for emergency funds or a specific goal.\n\n'What if I don't get many £5 notes?' You'll get more than you think. And every one counts.",
        cta: "Comment SAVE to get started today. Full guide and tracker in my bio.",
        hookStrength: "Strong",
        engagementPotential: "High",
        conversionFocus: true,
        compliance: { tiktok: "Approved", instagram: "Approved", youtube: "Approved" },
        isSelected: false,
      },
    ];
  }

  const shortDesc = desc.slice(0, 120) + (desc.length > 120 ? "..." : "");
  return [
    {
      id: "1",
      title: "Problem-Solution Angle",
      isStarred: false,
      length: 30,
      platforms: { tiktok: true, instagram: true, youtube: false },
      hook: `Struggling with the same old problem? ${name} is designed to fix that.`,
      body: `${name} gives you a clear way to get results. ${shortDesc}\n\nWhat you get:\n• A simple system you can follow\n• Support so you stay on track\n• Real outcomes when you stick with it\n\nIf you're tired of the same results, this is built for you.`,
      cta: `Link in bio to get ${name}. Start today.`,
      hookStrength: "Strong",
      engagementPotential: "High",
      conversionFocus: true,
      compliance: { tiktok: "Approved", instagram: "Approved", youtube: "Approved" },
      isSelected: false,
    },
    {
      id: "2",
      title: "Transformation Angle",
      isStarred: true,
      length: 30,
      platforms: { tiktok: true, instagram: true, youtube: true },
      hook: `The change happened when I started using ${name}. Here's what changed.`,
      body: `${name} isn't just another product—it's a different approach. ${shortDesc}\n\nWhat made the difference:\n• Clear steps, no overwhelm\n• Built for real life\n• You'll see progress fast\n\nIf you're ready for a change, this is it.`,
      cta: `Comment YES and I'll send you the link. Or check my bio for ${name}.`,
      hookStrength: "Strong",
      engagementPotential: "High",
      conversionFocus: true,
      compliance: { tiktok: "Approved", instagram: "Approved", youtube: "Approved" },
      isSelected: true,
    },
    {
      id: "3",
      title: "How-It-Works Angle",
      isStarred: false,
      length: 30,
      platforms: { tiktok: true, instagram: true, youtube: true },
      hook: `People keep asking how ${name} works. Here's the simple version.`,
      body: `${name} in a nutshell: ${shortDesc}\n\nHow it works:\n• Easy to start, easy to keep going\n• You get everything you need (including any tracker or guide)\n• Works for real people with busy lives\n\nNo guesswork—just follow the steps.`,
      cta: `Link in bio for the full ${name} guide. Get started this week.`,
      hookStrength: "Strong",
      engagementPotential: "High",
      conversionFocus: true,
      compliance: { tiktok: "Approved", instagram: "Approved", youtube: "Approved" },
      isSelected: false,
    },
  ];
}

export default function ScriptsFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productIdFromUrl = searchParams.get("productId");
  const intentVideoGuide = searchParams.get("intent") === "video-guide";
  const fromVideoFlow = searchParams.get("from") === "video-flow";
  const [loading, setLoading] = useState(true);
  const [scripts, setScripts] = useState<ScriptData[]>([]);
  const [editModal, setEditModal] = useState<{ scriptId: string; section: SectionType } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showCustomScript, setShowCustomScript] = useState(false);
  const [customScriptText, setCustomScriptText] = useState("");
  const [productName, setProductName] = useState<string | null>(null);
  const [scriptVideoLengthSec, setScriptVideoLengthSec] = useState(DEFAULT_VIDEO_LENGTH_SEC);
  const [regeneratingScripts, setRegeneratingScripts] = useState(false);

  const goToVideos = () => {
    const selected = scripts.filter((s) => s.isSelected).map((s) => ({
      id: s.id,
      title: s.title,
      length: scriptVideoLengthSec,
      hook: s.hook,
      body: s.body,
      cta: s.cta,
    }));
    try {
      sessionStorage.setItem("selectedScriptsForVideos", JSON.stringify(selected));
    } catch {
      // ignore
    }
    if (intentVideoGuide && productIdFromUrl) {
      router.push(`/dashboard/digital-products/results?productId=${encodeURIComponent(productIdFromUrl)}&intent=video-guide`);
    } else {
      router.push("/dashboard/digital-products/videos");
    }
  };

  useEffect(() => {
    if (!productIdFromUrl) {
      try {
        const raw = sessionStorage.getItem("digitalProductForm");
        if (raw) {
          const data = JSON.parse(raw) as ProductFormData;
          if (data.productName) setProductName(data.productName);
        }
      } catch {
        // ignore
      }
    }
  }, [productIdFromUrl]);

  useEffect(() => {
    if (productIdFromUrl) {
      // Clear cached scripts and videos so results page never shows stale data from a previous run
      try {
        sessionStorage.removeItem("selectedScriptsForVideos");
        sessionStorage.removeItem("digitalProductsGeneratedVideos");
      } catch {
        // ignore
      }
      let cancelled = false;
      (async () => {
        try {
          const res = await fetch(`/api/products/${productIdFromUrl}`);
          if (!res.ok || cancelled) {
            if (!cancelled) setLoading(false);
            return;
          }
          const product = (await res.json()) as {
            id: string;
            title: string;
            niche: string;
            marketingAssets?: { productTitle?: string; productDescription?: string } | null;
          };
          const title = product.marketingAssets?.productTitle ?? product.title;
          const description = product.marketingAssets?.productDescription ?? "";
          const cleanedName = title ? String(title).split("|")[0].split("-")[0].trim() : null;
          if (cleanedName) setProductName(cleanedName);
          const formData: ProductFormData = {
            productName: title,
            productDescription: description,
            productType: "digital",
            productFileOrLinkMode: "file",
            hasFile: true,
            fileName: `${(title || "product").replace(/\s+/g, "-")}.pdf`,
          };
          try {
            sessionStorage.setItem("digitalProductForm", JSON.stringify(formData));
            sessionStorage.setItem(
              "productContextForVideos",
              JSON.stringify({
                productId: productIdFromUrl,
                productName: title,
                productDescription: description,
                niche: product.niche,
              })
            );
          } catch {
            // ignore
          }
          if (cancelled) return;
          setProductName(title);
          // Generate fresh scripts via API (no cache); fallback to mock if API fails
          const genRes = await fetch("/api/digital-products/generate-scripts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId: productIdFromUrl,
              targetDurationSec: scriptVideoLengthSec,
            }),
          });
          const genData = (await genRes.json().catch(() => ({}))) as {
            scripts?: Array<{ id: string; title: string; length: number; hook: string; body: string; cta: string }>;
          };
          if (cancelled) return;
          if (genRes.ok && Array.isArray(genData.scripts) && genData.scripts.length > 0) {
            const count = genData.scripts.length;
            const selectAllForVideoGuide = count === 4 || intentVideoGuide;
            const defaults = {
              isStarred: false,
              platforms: { tiktok: true, instagram: true, youtube: false } as const,
              hookStrength: "Strong" as const,
              engagementPotential: "High" as const,
              conversionFocus: true,
              compliance: { tiktok: "Approved", instagram: "Approved", youtube: "Approved" } as const,
              isSelected: selectAllForVideoGuide,
            };
            setScripts(
              genData.scripts.map((s, i) => ({
                ...defaults,
                id: s.id,
                title: s.title,
                length: s.length as LengthOption,
                hook: s.hook,
                body: s.body,
                cta: s.cta,
                isSelected: selectAllForVideoGuide || i === 1,
                isStarred: i === 1,
              }))
            );
          } else {
            setScripts(generateMockScripts(formData));
          }
        } catch {
          if (!cancelled) setScripts(generateMockScripts(null));
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    // No productId: clear cached scripts/videos so results don't show stale data; use form + mock
    try {
      sessionStorage.removeItem("selectedScriptsForVideos");
      sessionStorage.removeItem("digitalProductsGeneratedVideos");
    } catch {
      // ignore
    }
    const t = setTimeout(() => {
      let product: ProductFormData | null = null;
      try {
        const raw = sessionStorage.getItem("digitalProductForm");
        if (raw) product = JSON.parse(raw) as ProductFormData;
      } catch {
        // ignore
      }
      setScripts(generateMockScripts(product));
      setLoading(false);
    }, 2000);
    return () => clearTimeout(t);
  }, [productIdFromUrl]);

  const updateScript = (id: string, updates: Partial<ScriptData>) => {
    setScripts((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const toggleSelect = (id: string) => {
    setScripts((prev) => prev.map((s) => (s.id === id ? { ...s, isSelected: !s.isSelected } : s)));
  };

  const selectedCount = scripts.filter((s) => s.isSelected).length;
  const selectAll = () => setScripts((prev) => prev.map((s) => ({ ...s, isSelected: true })));
  const deselectAll = () => setScripts((prev) => prev.map((s) => ({ ...s, isSelected: false })));

  const runRegenerateWithDuration = async (targetSec: number) => {
    if (!productIdFromUrl || scripts.length === 0) return;
    setRegeneratingScripts(true);
    try {
      const genRes = await fetch("/api/digital-products/generate-scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: productIdFromUrl,
          targetDurationSec: targetSec,
        }),
      });
      const genData = (await genRes.json().catch(() => ({}))) as {
        scripts?: Array<{ id: string; title: string; length: number; hook: string; body: string; cta: string }>;
      };
      if (genRes.ok && Array.isArray(genData.scripts) && genData.scripts.length > 0) {
        const count = genData.scripts.length;
        const selectAllForVideoGuide = count === 4 || intentVideoGuide;
        const defaults = {
          isStarred: false,
          platforms: { tiktok: true, instagram: true, youtube: false } as const,
          hookStrength: "Strong" as const,
          engagementPotential: "High" as const,
          conversionFocus: true,
          compliance: { tiktok: "Approved", instagram: "Approved", youtube: "Approved" } as const,
          isSelected: selectAllForVideoGuide,
        };
        const newLength = (targetSec as LengthOption) || (genData.scripts[0]?.length as LengthOption);
        setScripts(
          genData.scripts.map((s, i) => ({
            ...defaults,
            id: s.id,
            title: s.title,
            length: (s.length as LengthOption) || newLength,
            hook: s.hook,
            body: s.body,
            cta: s.cta,
            isSelected: selectAllForVideoGuide || i === 1,
            isStarred: i === 1,
          }))
        );
        setScriptVideoLengthSec(newLength);
      }
    } finally {
      setRegeneratingScripts(false);
    }
  };

  const handleRegenerateScripts = () => runRegenerateWithDuration(scriptVideoLengthSec);

  const handleTopLengthChange = (newSec: number) => {
    setScriptVideoLengthSec(newSec);
    setScripts((prev) => prev.map((s) => ({ ...s, length: newSec as LengthOption })));
    if (scripts.length > 0 && productIdFromUrl) {
      runRegenerateWithDuration(newSec);
    }
  };

  const openEdit = (scriptId: string, section: SectionType) => {
    const script = scripts.find((s) => s.id === scriptId);
    if (!script) return;
    const raw = section === "hook" ? script.hook : section === "body" ? script.body : script.cta;
    setEditValue(replaceProductTitleInText(raw, productName ?? undefined));
    setEditModal({ scriptId, section });
  };

  const saveEdit = () => {
    if (!editModal) return;
    const { scriptId, section } = editModal;
    updateScript(scriptId, section === "hook" ? { hook: editValue } : section === "body" ? { body: editValue } : { cta: editValue });
    setEditModal(null);
  };

  const selectedScript = editModal ? scripts.find((s) => s.id === editModal.scriptId) : null;
  const limits = selectedScript ? CHAR_LIMITS[selectedScript.length] : CHAR_LIMITS[30];
  const editLimit = editModal?.section === "hook" ? limits.hook : editModal?.section === "body" ? limits.body : limits.cta;

  return (
    <main className="min-h-screen bg-white dark:bg-[#0F0F0F] text-gray-900 dark:text-white p-6 md:p-10 max-w-6xl mx-auto pb-28">

      {/* ── Flow header ── */}
      <div className="mb-8">
        {/* Back link */}
        <Link
          href={
            fromVideoFlow
              ? "/dashboard/videos/select-product"
              : productIdFromUrl
                ? `/dashboard/digital-products/${productIdFromUrl}/edit`
                : "/dashboard/digital-products/create"
          }
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {fromVideoFlow ? "Change product" : productIdFromUrl ? "Back to Product Editor" : "Back to Product"}
        </Link>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-5">
          {/* Step 1 — done */}
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold">✓</div>
            <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">Select product</span>
          </div>
          <div className="h-px w-6 bg-orange-500" />
          {/* Step 2 — current */}
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold ring-2 ring-orange-500/30">2</div>
            <span className="text-xs font-semibold text-orange-500 hidden sm:inline">Customize scripts</span>
          </div>
          <div className="h-px w-6 bg-gray-200 dark:bg-[#2A2A2A]" />
          {/* Step 3 — upcoming */}
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-[#2A2A2A] text-gray-500 dark:text-gray-400 flex items-center justify-center text-xs font-bold">3</div>
            <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">Create video</span>
          </div>
        </div>

        {/* Context banner */}
        {productName && (
          <div className="flex items-start gap-3 rounded-xl border border-orange-500/20 bg-orange-500/5 dark:bg-orange-500/8 px-4 py-3">
            <BookOpen className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-500 mb-0.5">
                Step 2 of 3 — Customize Your Scripts
              </p>
              <p className="text-sm text-gray-900 dark:text-white font-medium truncate">
                Creating video for:{" "}
                <span className="text-orange-500">{cleanProductTitle(productName) || productName}</span>
              </p>
            </div>
          </div>
        )}

        {/* Fallback heading when no product name yet */}
        {!productName && !loading && (
          <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-500 mb-0.5">
              Step 2 of 3 — Customize Your Scripts
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Customize the scripts below for your video</p>
          </div>
        )}
      </div>

      {loading ? (
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="py-24 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
            <p className="text-slate-600 dark:text-slate-400">
              Analyzing your product and generating conversion-focused scripts...
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {productIdFromUrl && (
            <div className="mb-6">
              <Label className="text-gray-900 dark:text-white block mb-2">Video length (controls all scripts)</Label>
              <p className="text-xs text-gray-700 dark:text-gray-400 mb-3">One length for every script. Changing it updates all cards and regenerates scripts to the new word count.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {VIDEO_LENGTH_OPTIONS.map((opt) => {
                  const selected = scriptVideoLengthSec === opt.seconds;
                  return (
                    <button
                      key={opt.seconds}
                      type="button"
                      disabled={regeneratingScripts}
                      onClick={() => handleTopLengthChange(opt.seconds)}
                      className={`rounded-lg border-2 p-3 text-left transition-all ${
                        selected
                          ? "border-orange-500 bg-orange-500/10 text-gray-900 dark:bg-orange-900/40 dark:text-white"
                          : "border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#1A1A1A] text-gray-900 dark:text-gray-300 hover:border-gray-300 dark:hover:border-[#3A3A3A] hover:text-gray-900 dark:hover:text-white"
                      }`}
                    >
                      <span className="block font-semibold text-sm">{opt.seconds}s</span>
                      <span className="block text-xs mt-0.5 opacity-90">{opt.sublabel}</span>
                      <span className="block text-xs mt-1 opacity-75">{opt.wordRange}</span>
                    </button>
                  );
                })}
              </div>
              {scripts.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-2 border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-[#A0A0A0]"
                  onClick={handleRegenerateScripts}
                  disabled={regeneratingScripts}
                >
                  {regeneratingScripts ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Regenerate Scripts
                </Button>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {scripts.map((script) => (
              <ScriptCard
                key={script.id}
                script={script}
                productName={productName ?? undefined}
                onUpdate={(updates) => updateScript(script.id, updates)}
                onToggleSelect={() => toggleSelect(script.id)}
                onOpenEdit={openEdit}
                charLimits={CHAR_LIMITS[scriptVideoLengthSec]}
                globalLengthSec={scriptVideoLengthSec}
                isRegenerating={regeneratingScripts}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            <Button variant="outline" className="gap-2 border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-[#A0A0A0]" onClick={() => setShowCustomScript(true)}>
              <Plus className="w-4 h-4" />
              Add Custom Script
            </Button>
            <Button variant="outline" className="gap-2 border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-[#A0A0A0]">
              <BookOpen className="w-4 h-4" />
              Browse Script Templates
            </Button>
          </div>

          {showCustomScript && (
            <Card className="border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#1A1A1A] mb-8">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg text-gray-900 dark:text-white">Custom Script</CardTitle>
                <Button variant="ghost" size="sm" className="text-gray-700 dark:text-[#A0A0A0]" onClick={() => setShowCustomScript(false)}>Close</Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-gray-900 dark:text-white">Write your script</Label>
                  <Textarea
                    placeholder="Paste or write your full script here..."
                    value={customScriptText}
                    onChange={(e) => setCustomScriptText(e.target.value)}
                    rows={8}
                    className="mt-2 bg-gray-100 dark:bg-[#0F0F0F] border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-[#A0A0A0]">AI Enhance This Script</Button>
                  <Button variant="outline" size="sm" className="border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-[#A0A0A0]">Check Compliance</Button>
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={() => setShowCustomScript(false)}>Save</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Accordion type="single" collapsible className="mb-8">
            <AccordionItem value="advanced" className="border-gray-200 dark:border-[#2A2A2A]">
              <AccordionTrigger className="text-gray-900 dark:text-white hover:no-underline">Advanced Script Settings</AccordionTrigger>
              <AccordionContent className="space-y-6 pt-2">
                <div>
                  <Label>Video length</Label>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 mb-2">Same as the control above. Changing here updates all scripts and triggers regeneration.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                    {VIDEO_LENGTH_OPTIONS.map((opt) => {
                      const selected = scriptVideoLengthSec === opt.seconds;
                      return (
                        <button
                          key={opt.seconds}
                          type="button"
                          disabled={regeneratingScripts}
                          onClick={() => handleTopLengthChange(opt.seconds)}
                          className={`rounded-lg border-2 p-3 text-left transition-all ${
                            selected
                              ? "border-orange-500 bg-orange-500/10 text-gray-900 dark:bg-orange-900/40 dark:text-white"
                              : "border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#1A1A1A] text-gray-900 dark:text-gray-300 hover:border-gray-300 dark:hover:border-[#3A3A3A]"
                          }`}
                        >
                          <span className="block font-semibold text-sm">{opt.seconds}s</span>
                          <span className="block text-xs mt-0.5 opacity-90">{opt.sublabel}</span>
                          <span className="block text-xs mt-1 opacity-75">{opt.wordRange}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label>Tone & style</Label>
                  <Select defaultValue="professional">
                    <SelectTrigger className="w-full max-w-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional & Authoritative</SelectItem>
                      <SelectItem value="casual">Casual & Friendly</SelectItem>
                      <SelectItem value="energetic">Energetic & Hype</SelectItem>
                      <SelectItem value="educational">Educational & Helpful</SelectItem>
                      <SelectItem value="conversational">Conversational</SelectItem>
                      <SelectItem value="storytelling">Storytelling</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Checkbox id="price" defaultChecked />
                    <Label htmlFor="price">Include price mention</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="social" defaultChecked />
                    <Label htmlFor="social">Add social proof</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="objection" defaultChecked />
                    <Label htmlFor="objection">Add objection handling</Label>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}

      {/* Edit modal */}
      <Dialog open={!!editModal} onOpenChange={(open) => !open && setEditModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Edit {editModal?.section === "hook" ? "Hook" : editModal?.section === "body" ? "Body" : "CTA"}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={6}
            className="resize-none"
            placeholder="Enter text..."
          />
          {editModal?.section === "hook" && (
            <p className="text-xs text-slate-500">
              Tips: Start with a pattern interrupt, address a pain point, create curiosity.
            </p>
          )}
          <p className="text-xs text-slate-500">
            Character count: {editValue.length}/{editLimit} {editValue.length <= editLimit ? "✓" : "— over limit"}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(null)}>Cancel</Button>
            <Button variant="outline" size="sm" className="gap-1"><RefreshCw className="w-3.5 h-3.5" /> Regenerate</Button>
            <Button className="bg-orange-500 hover:bg-orange-600" onClick={saveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sticky bottom bar */}
      {!loading && scripts.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 dark:border-[#2A2A2A] bg-white/95 dark:bg-[#0F0F0F]/95 backdrop-blur py-4 px-4 md:px-6">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {selectedCount} script{selectedCount !== 1 ? "s" : ""} selected • Each video costs 1 credit
              </span>
              <Button variant="ghost" size="sm" className="text-gray-700 dark:text-[#A0A0A0] hover:text-gray-900 dark:hover:text-white" onClick={selectAll}>Select All</Button>
              <Button variant="ghost" size="sm" className="text-gray-700 dark:text-[#A0A0A0] hover:text-gray-900 dark:hover:text-white" onClick={deselectAll}>Deselect All</Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-[#A0A0A0]" asChild>
                <Link href="/dashboard/digital-products/create">← Back to Product</Link>
              </Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600"
                size="lg"
                disabled={selectedCount === 0}
                title={selectedCount > 0 ? undefined : "Select at least one script"}
                onClick={goToVideos}
              >
                Create Video Guide →
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ScriptCard({
  script,
  productName,
  onUpdate,
  onToggleSelect,
  onOpenEdit,
  charLimits,
  globalLengthSec,
  isRegenerating,
}: {
  script: ScriptData;
  productName?: string;
  onUpdate: (u: Partial<ScriptData>) => void;
  onToggleSelect: () => void;
  onOpenEdit: (scriptId: string, section: SectionType) => void;
  charLimits: { hook: number; body: number; cta: number };
  globalLengthSec: number;
  isRegenerating?: boolean;
}) {
  const sectionRanges = getSectionRanges(globalLengthSec);
  return (
    <Card className={`relative border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#1A1A1A] overflow-hidden transition-all ${script.isSelected ? "ring-2 ring-orange-500" : ""}`}>
      {isRegenerating && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50/90 dark:bg-[#1A1A1A]/90 rounded-lg">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      )}
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base text-gray-900 dark:text-white">{script.title}</CardTitle>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{globalLengthSec}s · same for all scripts</p>
        </div>
        <button type="button" onClick={() => onUpdate({ isStarred: !script.isStarred })} className="p-1">
          <Star className={`w-5 h-5 ${script.isStarred ? "fill-orange-500 text-orange-500" : "text-gray-600 dark:text-gray-400"}`} />
        </button>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <Label className="text-xs text-gray-700 dark:text-gray-400">PLATFORM</Label>
          <div className="flex gap-3 mt-1">
            <label className="flex items-center gap-1.5 cursor-pointer text-gray-900 dark:text-[#E0E0E0]">
              <Checkbox checked={script.platforms.tiktok} onCheckedChange={(c) => onUpdate({ platforms: { ...script.platforms, tiktok: !!c } })} />
              <span>TikTok</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-gray-900 dark:text-[#E0E0E0]">
              <Checkbox checked={script.platforms.instagram} onCheckedChange={(c) => onUpdate({ platforms: { ...script.platforms, instagram: !!c } })} />
              <span>Instagram</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-gray-900 dark:text-[#E0E0E0]">
              <Checkbox checked={script.platforms.youtube} onCheckedChange={(c) => onUpdate({ platforms: { ...script.platforms, youtube: !!c } })} />
              <span>YouTube</span>
            </label>
          </div>
        </div>
        <SectionBlock label={`HOOK (${sectionRanges.hook})`} text={replaceProductTitleInText(script.hook, productName ?? undefined)} limit={charLimits.hook} onEdit={() => onOpenEdit(script.id, "hook")} />
        <SectionBlock label={`BODY (${sectionRanges.body})`} text={replaceProductTitleInText(script.body, productName ?? undefined)} limit={charLimits.body} onEdit={() => onOpenEdit(script.id, "body")} />
        <SectionBlock label={`CTA (${sectionRanges.cta})`} text={replaceProductTitleInText(script.cta, productName ?? undefined)} limit={charLimits.cta} onEdit={() => onOpenEdit(script.id, "cta")} />
        <div className="pt-2 border-t border-gray-200 dark:border-[#2A2A2A] space-y-1">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-400">Estimated Performance</p>
          <p className="text-xs text-gray-700 dark:text-[#E0E0E0]">Hook strength: ⭐⭐⭐⭐⭐ ({script.hookStrength})</p>
          <p className="text-xs text-gray-700 dark:text-[#E0E0E0]">Engagement: {script.engagementPotential} · Conversion: {script.conversionFocus ? "✓ Sales-optimized" : "—"}</p>
        </div>
        <div className="pt-2 border-t border-gray-200 dark:border-[#2A2A2A] space-y-1">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-400">Compliance Check</p>
          <p className="text-xs text-gray-700 dark:text-[#E0E0E0]">TikTok: {script.compliance.tiktok}</p>
          <p className="text-xs text-gray-700 dark:text-[#E0E0E0]">Instagram: {script.compliance.instagram}</p>
          <p className="text-xs text-gray-700 dark:text-[#E0E0E0]">YouTube: {script.compliance.youtube}</p>
          {(script.compliance.tiktok.includes("Consider") || script.compliance.instagram.includes("Consider") || script.compliance.youtube.includes("Consider")) && (
            <Button variant="outline" size="sm" className="mt-2 h-7 text-xs gap-1 border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-[#A0A0A0]">
              <Wrench className="w-3 h-3" /> Auto-fix
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" className={script.isSelected ? "bg-orange-500 hover:bg-orange-600" : "border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-[#A0A0A0]"} onClick={onToggleSelect}>
            <Check className="w-3.5 h-3.5 mr-1" /> Select This Script
          </Button>
          <Button variant="outline" size="sm" className="border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-[#A0A0A0]"><Trash2 className="w-3.5 h-3.5 mr-1" /> Discard</Button>
          <Button variant="outline" size="sm" className="border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-[#A0A0A0]"><Copy className="w-3.5 h-3.5 mr-1" /> Duplicate</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionBlock({ label, text, limit, onEdit }: { label: string; text: string; limit: number; onEdit: () => void }) {
  return (
    <div>
      <Label className="text-xs text-gray-700 dark:text-gray-400">{label}</Label>
      <div className="mt-1 p-3 rounded-md bg-gray-100 dark:bg-[#0F0F0F] border border-gray-200 dark:border-[#2A2A2A] min-h-[80px]">
        <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{text}</p>
      </div>
      <p className="text-xs text-gray-700 dark:text-gray-400 mt-1">Character count: {text.length}/{limit}</p>
      <div className="flex flex-wrap gap-2 mt-1">
        <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-700 dark:text-[#A0A0A0] hover:text-gray-900 dark:hover:text-white"><RefreshCw className="w-3 h-3 mr-1" /> Regenerate</Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-700 dark:text-[#A0A0A0] hover:text-gray-900 dark:hover:text-white" onClick={onEdit}><Pencil className="w-3 h-3 mr-1" /> Edit</Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-700 dark:text-[#A0A0A0] hover:text-gray-900 dark:hover:text-white"><Copy className="w-3 h-3 mr-1" /> Copy to other scripts</Button>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5"><button type="button" className="underline hover:no-underline">See previous versions</button></p>
    </div>
  );
}
