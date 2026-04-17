"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, Shirt, Upload, Sparkles, ExternalLink, Loader2,
  CheckCircle2, AlertCircle, X, ChevronRight, Settings,
  ArrowLeft, RefreshCw, ChevronDown, ChevronUp, Wand2, Shuffle,
  Download, Share2, Copy, Check, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { SelectPodProduct } from "@/db/schema/pod-products-schema";

type Props = {
  isPrintifyConnected: boolean;
  initialProducts: SelectPodProduct[];
};

type Blueprint = { id: number; title: string; brand: string; images: string[] };
type Provider = { id: number; title: string; location: { country: string } };
type Variant = { id: number; title: string; options: Record<string, string>; placeholders: Array<{ position: string }>; cost?: number };

// Brand / typography chips shown when user has no prompt
const BRAND_PROMPTS = [
  { label: "Brand name", prompt: `"Your Brand" elegant luxury brand name, serif lettering, fashion label style`, style: "typography" },
  { label: "Initials / monogram", prompt: `"VH" luxury monogram initials, elegant interlocking letters, high-end fashion logo`, style: "typography" },
  { label: "Script logo", prompt: `"Your Brand" flowing cursive script signature logo, elegant handwritten style`, style: "typography" },
  { label: "Gothic type", prompt: `"Your Brand" blackletter gothic typography, dark dramatic font, premium streetwear`, style: "typography" },
  { label: "Stacked wordmark", prompt: `"YOUR BRAND" bold stacked uppercase wordmark, clean modern sans-serif, minimalist logo`, style: "typography" },
  { label: "Retro badge", prompt: `"Your Brand" vintage badge logo with ornate border, est. 2024, retro crest style`, style: "vintage" },
];

const DESIGN_PROMPTS = [
  { label: "Wolf & moon", prompt: "A lone wolf howling at a full moon with a geometric mountain landscape", style: "bold" },
  { label: "Snake & roses", prompt: "A coiled snake wrapped around a blooming rose, detailed illustration", style: "lineart" },
  { label: "Sunset mountains", prompt: "Layered mountain range silhouette at sunset with gradient sky", style: "minimalist" },
  { label: "Skull floral", prompt: "A decorative skull surrounded by intricate flowers and vines", style: "vintage" },
  { label: "Tiger face", prompt: "A fierce symmetrical tiger face, bold and graphic, frontal view", style: "bold" },
  { label: "Celestial eye", prompt: "An all-seeing eye surrounded by moon phases, stars and celestial symbols", style: "lineart" },
  { label: "City skyline", prompt: "Minimal city skyline silhouette at night with a large moon behind it", style: "minimalist" },
  { label: "Retro surf", prompt: "Retro 70s surf graphic with waves, sun and tropical palms", style: "vintage" },
  { label: "Geometric bear", prompt: "Low-poly geometric bear face with triangular facets and bold colors", style: "abstract" },
  { label: "Koi fish", prompt: "Two koi fish swimming in a yin-yang circle surrounded by waves", style: "lineart" },
  { label: "Eagle wings", prompt: "Spread eagle wings with a bold banner, American eagle style graphic", style: "bold" },
  { label: "Desert cactus", prompt: "A single saguaro cactus under a starry desert night sky, minimal", style: "minimalist" },
];

// ─── Design Studio fonts (loaded from Google Fonts) ─────────────────────────
const STUDIO_FONTS = [
  { label: "Bebas Neue",   value: "Bebas Neue",        google: "Bebas+Neue" },
  { label: "Anton",        value: "Anton",             google: "Anton" },
  { label: "Oswald",       value: "Oswald",            google: "Oswald:wght@700" },
  { label: "Cinzel",       value: "Cinzel",            google: "Cinzel:wght@700;900" },
  { label: "Playfair",     value: "Playfair Display",  google: "Playfair+Display:wght@700;900" },
  { label: "Cormorant",    value: "Cormorant",         google: "Cormorant:wght@700" },
  { label: "Space Grotesk",value: "Space Grotesk",     google: "Space+Grotesk:wght@700" },
  { label: "DM Serif",     value: "DM Serif Display",  google: "DM+Serif+Display" },
  { label: "Raleway",      value: "Raleway",           google: "Raleway:wght@700;900" },
  { label: "Italiana",     value: "Italiana",          google: "Italiana" },
] as const;

const MOCKUP_STYLES = [
  { id: "lifestyle", label: "Lifestyle", desc: "Candid street / outdoor" },
  { id: "studio", label: "Studio", desc: "Clean white background" },
  { id: "outdoor", label: "Outdoor", desc: "Golden hour editorial" },
  { id: "flat", label: "Flat Lay", desc: "Product only, top-down" },
];

// Print placement positions supported
const PLACEMENTS = [
  { id: "front",         label: "Front",      hint: "Required — the primary print area" },
  { id: "back",          label: "Back",        hint: "Optional — back of the garment" },
  { id: "left_sleeve",   label: "L. Sleeve",   hint: "Optional — left sleeve print" },
  { id: "right_sleeve",  label: "R. Sleeve",   hint: "Optional — right sleeve print" },
  { id: "label",         label: "Tag/Label",   hint: "Optional — neck label inside garment" },
] as const;
type PlacementId = typeof PLACEMENTS[number]["id"];

type ExtraDesign = { file: File | null; preview: string | null; url: string | null };

// ─── Design-on-product overlay positions per product type ────────────────────
function getDesignOverlay(blueprintTitle: string | null): React.CSSProperties {
  const t = (blueprintTitle ?? "").toLowerCase();
  if (t.includes("mug"))                      return { top: "10%", left: "30%", width: "38%", height: "72%" };
  if (t.includes("poster") || t.includes("print")) return { top: "7%",  left: "10%", width: "80%", height: "84%" };
  if (t.includes("hat") || t.includes("cap")) return { top: "28%", left: "16%", width: "68%", height: "38%" };
  if (t.includes("tote"))                     return { top: "16%", left: "20%", width: "60%", height: "60%" };
  if (t.includes("phone"))                    return { top: "12%", left: "20%", width: "60%", height: "64%" };
  // Default: apparel chest print area (t-shirts, hoodies, sweatshirts)
  return { top: "20%", left: "27%", width: "46%", height: "44%" };
}

// ─── 3D design-on-product preview ─────────────────────────────────────────────
function DesignOnProductPreview({
  blueprintImage,
  designUrl,
  blueprintTitle,
  className = "",
}: {
  blueprintImage: string;
  designUrl: string;
  blueprintTitle: string | null;
  className?: string;
}) {
  const overlay = getDesignOverlay(blueprintTitle);

  return (
    <div className={`relative select-none mx-auto ${className}`} style={{ maxWidth: "320px" }}>
      {/* Product base image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={blueprintImage}
        alt={blueprintTitle ?? "Product"}
        className="w-full rounded-xl"
        draggable={false}
      />

      {/* Design overlay — blended onto the product fabric */}
      <div
        className="absolute pointer-events-none"
        style={{
          ...overlay,
          /* Subtle 3-D perspective tilt so it looks printed on fabric */
          transform: "perspective(420px) rotateX(4deg) rotateY(-2deg)",
          transformOrigin: "50% 0%",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={designUrl}
          alt="Your design"
          className="w-full h-full object-contain"
          draggable={false}
          style={{
            /* Multiply blends white areas away — looks like screen print */
            mixBlendMode: "multiply",
            opacity: 0.88,
            filter: "contrast(1.08) saturate(0.96)",
          }}
        />
      </div>

      {/* Subtle vignette so design edges fade naturally into fabric */}
      <div
        className="absolute pointer-events-none rounded-xl"
        style={{
          ...overlay,
          background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.08) 100%)",
          transform: "perspective(420px) rotateX(4deg) rotateY(-2deg)",
          transformOrigin: "50% 0%",
        }}
      />
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function Steps({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-1 shrink-0">
          <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all ${
            i + 1 === current
              ? "bg-orange-500 text-white"
              : i + 1 < current
              ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
              : "bg-gray-100 text-gray-400 dark:bg-[#2A2A2A] dark:text-gray-500"
          }`}>
            {i + 1 < current ? <CheckCircle2 className="w-3 h-3" /> : <span>{i + 1}</span>}
            {label}
          </div>
          {i < steps.length - 1 && <ChevronRight className="w-3 h-3 text-gray-300 shrink-0" />}
        </div>
      ))}
    </div>
  );
}

const CREATE_STEPS = ["Design", "Product type", "Provider", "Variants", "Review"];

// ─── Profit Calculator ────────────────────────────────────────────────────────
function ProfitCalculator({ avgSalePrice }: { avgSalePrice: number }) {
  const [baseCost, setBaseCost] = useState("");
  const base = parseFloat(baseCost);
  const profit = !isNaN(base) && base > 0 ? avgSalePrice - base : null;
  const margin = profit != null && avgSalePrice > 0 ? Math.round((profit / avgSalePrice) * 100) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-[10px] text-gray-400 mb-1">Printify base cost</p>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-gray-400">£</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 12.50"
              value={baseCost}
              onChange={e => setBaseCost(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#111] px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Find this in Printify → your product → Edit</p>
        </div>
        <div className="flex-1">
          <p className="text-[10px] text-gray-400 mb-1">Your sale price (avg)</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">£{avgSalePrice.toFixed(2)}</p>
        </div>
      </div>
      {profit != null ? (
        <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${profit > 0 ? "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30" : "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30"}`}>
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-400">Profit per sale</p>
            <p className={`text-2xl font-bold ${profit > 0 ? "text-green-700 dark:text-green-300" : "text-red-600"}`}>£{profit.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-400">Margin</p>
            <p className={`text-xl font-bold ${profit > 0 ? "text-green-700 dark:text-green-300" : "text-red-600"}`}>{margin}%</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-gray-50 dark:bg-[#111] border border-gray-100 dark:border-[#2A2A2A] px-4 py-3 text-center">
          <p className="text-xs text-gray-400">Enter your Printify base cost to see profit</p>
        </div>
      )}
    </div>
  );
}

// ─── Mockup grid with download + share ───────────────────────────────────────
function MockupGrid({ mockups, productTitle }: { mockups: string[]; productTitle: string }) {
  const { toast } = useToast();
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleDownload = async (url: string, idx: number) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${productTitle.replace(/\s+/g, "-").toLowerCase()}-mockup-${idx + 1}.jpg`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const handleShare = async (url: string, idx: number) => {
    const text = `Check out my new merch design: ${productTitle} 🔥`;
    // Try native Web Share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({ title: productTitle, text, url });
        return;
      } catch { /* user cancelled */ return; }
    }
    // Fallback: copy link
    try {
      await navigator.clipboard.writeText(url);
      setCopiedIdx(idx);
      toast({ title: "Link copied!" });
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {mockups.map((url, i) => (
          <div key={i} className="group relative rounded-xl overflow-hidden border border-gray-100 dark:border-[#2A2A2A] aspect-square bg-gray-50 dark:bg-[#2A2A2A]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Mockup ${i + 1}`} className="w-full h-full object-cover" />

            {/* Action overlay — appears on hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200" />
            <div className="absolute bottom-0 left-0 right-0 p-2 flex gap-1.5 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200">
              <button
                type="button"
                onClick={() => handleDownload(url, i)}
                className="flex-1 flex items-center justify-center gap-1 text-xs font-medium bg-white/90 hover:bg-white text-gray-900 rounded-lg py-1.5 transition-colors"
              >
                <Download className="w-3 h-3" /> Save
              </button>
              <button
                type="button"
                onClick={() => handleShare(url, i)}
                className="flex-1 flex items-center justify-center gap-1 text-xs font-medium bg-white/90 hover:bg-white text-gray-900 rounded-lg py-1.5 transition-colors"
              >
                {copiedIdx === i ? <><Check className="w-3 h-3 text-green-600" /> Copied</> : <><Share2 className="w-3 h-3" /> Share</>}
              </button>
            </div>

            {/* Open full size */}
            <a href={url} target="_blank" rel="noreferrer"
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ))}
      </div>

      {/* Bulk actions */}
      {mockups.length > 0 && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(mockups.join("\n"));
                toast({ title: "All links copied!" });
              } catch {
                toast({ title: "Copy failed", variant: "destructive" });
              }
            }}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium border border-gray-200 dark:border-[#2A2A2A] rounded-xl py-2 text-gray-600 dark:text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-all"
          >
            <Copy className="w-3 h-3" /> Copy all links
          </button>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Just designed new merch for ${productTitle} 🔥`)}&url=${encodeURIComponent(mockups[0] ?? "")}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium border border-gray-200 dark:border-[#2A2A2A] rounded-xl py-2 text-gray-600 dark:text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-all"
          >
            <Share2 className="w-3 h-3" /> Post to X
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Placement manager — proper component with stable refs ───────────────────
function PlacementManager({
  selectedProduct,
  setSelectedProduct,
  setProducts,
  toast,
}: {
  selectedProduct: SelectPodProduct;
  setSelectedProduct: React.Dispatch<React.SetStateAction<SelectPodProduct | null>>;
  setProducts: React.Dispatch<React.SetStateAction<SelectPodProduct[]>>;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [generatePrompts, setGeneratePrompts] = useState<Record<string, string>>({});
  const [generatedPreviews, setGeneratedPreviews] = useState<Record<string, string>>({});
  const [savingFor, setSavingFor] = useState<string | null>(null);
  const [openPanels, setOpenPanels] = useState<Record<string, "generate" | null>>({});

  const productPlacements = (selectedProduct.placements as Array<{ position: string; designFileUrl: string; designFileName?: string }> | null) ?? [];

  const savePlacement = useCallback(async (position: string, url: string, fileName?: string) => {
    const patchRes = await fetch("/api/pod/placements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: selectedProduct.id, position, designFileUrl: url, designFileName: fileName }),
    });
    if (!patchRes.ok) throw new Error("Failed to save placement");
    const { placements: updated } = await patchRes.json() as { placements: typeof productPlacements };
    const updatedProduct = { ...selectedProduct, placements: updated } as SelectPodProduct;
    setSelectedProduct(updatedProduct);
    setProducts((prev) => prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p)));
    return updatedProduct;
  }, [selectedProduct, setSelectedProduct, setProducts, productPlacements]);

  const handlePlacementUpload = async (position: string, file: File) => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await fetch("/api/upload/store-image", { method: "POST", body: fd });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { url } = await uploadRes.json() as { url: string };
      await savePlacement(position, url, file.name);
      toast({ title: `${PLACEMENTS.find((p) => p.id === position)?.label ?? position} design saved!` });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    }
  };

  const handleUseFrontDesign = async (position: string) => {
    const frontUrl = selectedProduct.designFileUrl;
    if (!frontUrl) { toast({ title: "No front design set", variant: "destructive" }); return; }
    setSavingFor(position);
    try {
      await savePlacement(position, frontUrl, selectedProduct.designFileName ?? "front-design.png");
      toast({ title: `${PLACEMENTS.find((p) => p.id === position)?.label ?? position} — front design applied!` });
    } catch (err) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setSavingFor(null);
    }
  };

  const handleGenerateForPlacement = async (position: string) => {
    const prompt = generatePrompts[position]?.trim();
    if (!prompt) { toast({ title: "Enter a prompt first", variant: "destructive" }); return; }
    setGeneratingFor(position);
    setGeneratedPreviews((prev) => ({ ...prev, [position]: "" }));
    try {
      const res = await fetch("/api/ai-design/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style: "bold" }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setGeneratedPreviews((prev) => ({ ...prev, [position]: data.url! }));
    } catch (err) {
      toast({ title: "Generation failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setGeneratingFor(null);
    }
  };

  const handleUseGeneratedDesign = async (position: string) => {
    const url = generatedPreviews[position];
    if (!url) return;
    setSavingFor(position);
    try {
      await savePlacement(position, url, `${position}-ai-design.png`);
      setGeneratedPreviews((prev) => ({ ...prev, [position]: "" }));
      setOpenPanels((prev) => ({ ...prev, [position]: null }));
      toast({ title: `${PLACEMENTS.find((p) => p.id === position)?.label ?? position} — AI design saved!` });
    } catch (err) {
      toast({ title: "Failed to save", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setSavingFor(null);
    }
  };

  const handleRemovePlacement = async (position: string) => {
    try {
      const res = await fetch("/api/pod/placements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedProduct.id, position }),
      });
      if (!res.ok) throw new Error("Remove failed");
      const { placements: updated } = await res.json() as { placements: typeof productPlacements };
      const updatedProduct = { ...selectedProduct, placements: updated } as SelectPodProduct;
      setSelectedProduct(updatedProduct);
      setProducts((prev) => prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p)));
    } catch {
      toast({ title: "Remove failed", variant: "destructive" });
    }
  };

  const extraPlacements = PLACEMENTS.filter((p) => p.id !== "front");

  return (
    <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-1.5">
        <Layers className="w-3.5 h-3.5" /> Print Areas
      </p>
      <div className="space-y-3">
        {extraPlacements.map((pl) => {
          const existing = productPlacements.find((p) => p.position === pl.id);
          const isGenerating = generatingFor === pl.id;
          const isSaving = savingFor === pl.id;
          const generatedPreview = generatedPreviews[pl.id];
          const panelOpen = openPanels[pl.id] === "generate";

          return (
            <div key={pl.id} className="rounded-xl border border-gray-100 dark:border-[#2A2A2A] overflow-hidden">
              {/* Main row */}
              <div className="flex items-center gap-3 p-3">
                <input
                  key={`file-${pl.id}`}
                  type="file"
                  accept="image/png,image/svg+xml,image/jpeg"
                  className="hidden"
                  ref={(el) => { fileInputRefs.current[pl.id] = el; }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePlacementUpload(pl.id, file);
                    e.target.value = "";
                  }}
                />
                {existing?.designFileUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={existing.designFileUrl} alt={pl.label} className="w-10 h-10 object-contain rounded-lg border border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#2A2A2A] shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg border-2 border-dashed border-gray-200 dark:border-[#2A2A2A] shrink-0 flex items-center justify-center">
                    <Upload className="w-4 h-4 text-gray-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{pl.label}</p>
                  <p className="text-[11px] text-gray-400 truncate">{existing ? "Design added" : pl.hint}</p>
                </div>
                {existing ? (
                  <div className="flex gap-1.5 shrink-0">
                    <button type="button" onClick={() => fileInputRefs.current[pl.id]?.click()}
                      className="text-xs text-orange-500 hover:text-orange-600 font-medium px-2 py-1 rounded-lg border border-orange-200 dark:border-orange-900/40">
                      Replace
                    </button>
                    <button type="button" onClick={() => handleRemovePlacement(pl.id)}
                      className="text-xs text-gray-400 hover:text-red-500 px-1.5 py-1 rounded-lg border border-gray-200 dark:border-[#2A2A2A]">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                    {/* Upload */}
                    <button type="button" onClick={() => fileInputRefs.current[pl.id]?.click()}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium px-2 py-1.5 rounded-lg border border-gray-200 dark:border-[#2A2A2A] flex items-center gap-1">
                      <Upload className="w-3 h-3" /> Upload
                    </button>
                    {/* Use front design */}
                    {selectedProduct.designFileUrl && (
                      <button type="button" onClick={() => handleUseFrontDesign(pl.id)} disabled={isSaving}
                        className="text-xs text-orange-500 hover:text-orange-600 font-medium px-2 py-1.5 rounded-lg border border-orange-200 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-950/20 flex items-center gap-1">
                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
                        Use front
                      </button>
                    )}
                    {/* AI Generate */}
                    <button type="button"
                      onClick={() => setOpenPanels((prev) => ({ ...prev, [pl.id]: prev[pl.id] === "generate" ? null : "generate" }))}
                      className={`text-xs font-medium px-2 py-1.5 rounded-lg border flex items-center gap-1 transition-all ${panelOpen ? "bg-orange-500 border-orange-500 text-white" : "border-orange-200 dark:border-orange-900/40 text-orange-500 hover:text-orange-600 bg-orange-50 dark:bg-orange-950/20"}`}>
                      <Wand2 className="w-3 h-3" /> AI
                    </button>
                  </div>
                )}
              </div>

              {/* AI Generate panel — slides open below the row */}
              {panelOpen && !existing && (
                <div className="border-t border-gray-100 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#0F0F0F] p-3 space-y-2">
                  <p className="text-[11px] text-gray-400">Describe a design for the {pl.label.toLowerCase()}</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={`e.g. small logo, "VOID" text, minimalist icon...`}
                      value={generatePrompts[pl.id] ?? ""}
                      onChange={(e) => setGeneratePrompts((prev) => ({ ...prev, [pl.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") handleGenerateForPlacement(pl.id); }}
                      className="flex-1 text-xs rounded-lg border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] px-3 py-2 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                    <button type="button" onClick={() => handleGenerateForPlacement(pl.id)} disabled={isGenerating}
                      className="shrink-0 text-xs font-medium bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg flex items-center gap-1 disabled:opacity-60">
                      {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      {isGenerating ? "Generating..." : "Generate"}
                    </button>
                  </div>

                  {/* Generated preview */}
                  {generatedPreview && (
                    <div className="flex items-start gap-3 mt-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={generatedPreview} alt="Generated design" className="w-20 h-20 object-contain rounded-lg border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] shrink-0" />
                      <div className="flex flex-col gap-1.5 pt-1">
                        <button type="button" onClick={() => handleUseGeneratedDesign(pl.id)} disabled={isSaving}
                          className="text-xs font-medium bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-60">
                          {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                          Use this design
                        </button>
                        <button type="button" onClick={() => handleGenerateForPlacement(pl.id)} disabled={isGenerating}
                          className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" /> Regenerate
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PrintOnDemandClient({ isPrintifyConnected, initialProducts }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [products, setProducts] = useState<SelectPodProduct[]>(initialProducts);
  const [view, setView] = useState<"list" | "create" | "product">("list");
  const [selectedProduct, setSelectedProduct] = useState<SelectPodProduct | null>(null);

  // ── Create wizard state ──────────────────────────────────────────────────────
  const [createStep, setCreateStep] = useState(1);
  const [title, setTitle] = useState("");
  const [designFile, setDesignFile] = useState<File | null>(null);
  const [designPreview, setDesignPreview] = useState<string | null>(null);
  const [designUrl, setDesignUrl] = useState<string | null>(null);
  const [uploadingDesign, setUploadingDesign] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Catalog state ────────────────────────────────────────────────────────────
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [selectedBlueprint, setSelectedBlueprint] = useState<Blueprint | null>(null);
  const [blueprintSearch, setBlueprintSearch] = useState("");
  // Blueprint preview dialog — shown before confirming product choice
  const [previewBlueprint, setPreviewBlueprint] = useState<Blueprint | null>(null);

  // ── Provider state ───────────────────────────────────────────────────────────
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);

  // ── Variant state ────────────────────────────────────────────────────────────
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState<Set<number>>(new Set());
  const [variantPrices, setVariantPrices] = useState<Record<number, string>>({});
  const [variantsExpanded, setVariantsExpanded] = useState(false);

  // ── Multi-placement state ────────────────────────────────────────────────────
  const [extraDesigns, setExtraDesigns] = useState<Partial<Record<PlacementId, ExtraDesign>>>({});
  const extraFileRefs = useRef<Partial<Record<PlacementId, HTMLInputElement>>>({});

  // ── AI design generator state ────────────────────────────────────────────────
  const [designTab, setDesignTab] = useState<"upload" | "generate" | "studio">("upload");

  // ── Design Studio state ──────────────────────────────────────────────────────
  const [studioText, setStudioText] = useState("");
  const [studioFont, setStudioFont] = useState("Bebas Neue");
  const [studioSize, setStudioSize] = useState(72);
  const [studioSpacing, setStudioSpacing] = useState(0.08);
  const [studioColor, setStudioColor] = useState("#FFFFFF");
  const [studioBg, setStudioBg] = useState("#000000");
  const [studioUppercase, setStudioUppercase] = useState(true);
  const [studioExporting, setStudioExporting] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStyle, setAiStyle] = useState("bold");
  const [generatingDesign, setGeneratingDesign] = useState(false);

  // ── Mockup state ─────────────────────────────────────────────────────────────
  const [generatingMockup, setGeneratingMockup] = useState(false);
  const [generatingLifestyle, setGeneratingLifestyle] = useState(false);
  const [mockupStyle, setMockupStyle] = useState("lifestyle");
  const [mockupPlacement, setMockupPlacement] = useState("front");

  // ── Caption state ─────────────────────────────────────────────────────────────
  const [generatingCaptions, setGeneratingCaptions] = useState(false);
  const [captions, setCaptions] = useState<string[]>([]);
  const [copiedCaptionIdx, setCopiedCaptionIdx] = useState<number | null>(null);

  // ── Promo video state ────────────────────────────────────────────────────────
  const [generatingPromoVideo, setGeneratingPromoVideo] = useState(false);

  // ── Sync state ───────────────────────────────────────────────────────────────
  const [syncing, setSyncing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [creating, setCreating] = useState(false);

  // ── Printify connect state ───────────────────────────────────────────────────
  const [apiKey, setApiKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(isPrintifyConnected);

  // ── Auto-fetch blueprint image for existing products that are missing it ──────
  useEffect(() => {
    if (!selectedProduct || !selectedProduct.blueprintId || selectedProduct.blueprintImageUrl || !connected) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/printify/blueprint?blueprintId=${selectedProduct.blueprintId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json() as { images?: string[] };
        const imageUrl = data.images?.[0];
        if (!imageUrl || cancelled) return;
        // Update local state immediately
        const withImage = { ...selectedProduct, blueprintImageUrl: imageUrl } as SelectPodProduct;
        setSelectedProduct(withImage);
        setProducts((prev) => prev.map((p) => p.id === selectedProduct.id ? withImage : p));
        // Persist to DB so it's not re-fetched next time
        await fetch("/api/pod/update-product", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: selectedProduct.id, blueprintImageUrl: imageUrl }),
        });
      } catch { /* non-blocking */ }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct?.id, connected]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const resetCreate = () => {
    setCreateStep(1);
    setTitle("");
    setDesignFile(null);
    setDesignPreview(null);
    setDesignUrl(null);
    setSelectedBlueprint(null);
    setSelectedProvider(null);
    setVariants([]);
    setSelectedVariants(new Set());
    setVariantPrices({});
    setBlueprintSearch("");
    setDesignTab("upload");
    setAiPrompt("");
    setAiStyle("bold");
    setExtraDesigns({});
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDesignFile(file);
    setDesignPreview(URL.createObjectURL(file));
  };

  // AI design generation
  const handleGenerateDesign = async () => {
    if (!aiPrompt.trim()) { toast({ title: "Enter a prompt first", variant: "destructive" }); return; }
    setGeneratingDesign(true);
    setDesignPreview(null);
    setDesignUrl(null);
    setDesignFile(null);
    try {
      const res = await fetch("/api/ai-design/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt.trim(), style: aiStyle }),
      });
      const data = await res.json() as { url?: string; error?: string; code?: string; redirectTo?: string };
      if (res.status === 402) {
        toast({
          title: "No credits",
          description: "You need 1 video credit to generate a design.",
          variant: "destructive",
        });
        router.push(data.redirectTo ?? "/dashboard/video-credits");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setDesignPreview(data.url!);
      setDesignUrl(data.url!);
      // Auto-fill product name from prompt if user hasn't typed one yet
      if (!title.trim()) {
        const words = aiPrompt.trim().split(/\s+/).slice(0, 4).join(" ");
        const suggested = words.charAt(0).toUpperCase() + words.slice(1);
        setTitle(suggested);
      }
    } catch (err) {
      toast({ title: "Generation failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setGeneratingDesign(false);
    }
  };

  // ── Design Studio: load Google Fonts when studio tab is active ──────────────
  useEffect(() => {
    if (designTab !== "studio") return;
    const id = "pod-studio-fonts";
    if (document.getElementById(id)) return;
    const families = STUDIO_FONTS.map((f) => f.google).join("&family=");
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
    document.head.appendChild(link);
  }, [designTab]);

  // ── Design Studio: export canvas design as PNG ────────────────────────────
  const handleUseStudioDesign = useCallback(async () => {
    if (!studioText.trim()) return;
    setStudioExporting(true);
    try {
      await document.fonts.ready;
      try { await document.fonts.load(`700 48px "${studioFont}"`); } catch { /* ignore */ }

      const SIZE = 1200;
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      ctx.fillStyle = studioBg;
      ctx.fillRect(0, 0, SIZE, SIZE);

      const text = studioUppercase ? studioText.toUpperCase() : studioText;
      const fontPx = Math.round((studioSize / 100) * SIZE * 0.55);
      ctx.font = `700 ${fontPx}px "${studioFont}", serif`;
      ctx.fillStyle = studioColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Manual letter spacing (draw char by char)
      if (studioSpacing > 0) {
        const spacing = studioSpacing * fontPx;
        const chars = [...text];
        const totalWidth = chars.reduce((w, c) => w + ctx.measureText(c).width, 0) + spacing * (chars.length - 1);
        let x = SIZE / 2 - totalWidth / 2;
        for (const char of chars) {
          const cw = ctx.measureText(char).width;
          ctx.fillText(char, x + cw / 2, SIZE / 2);
          x += cw + spacing;
        }
      } else {
        ctx.fillText(text, SIZE / 2, SIZE / 2);
      }

      await new Promise<void>((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(); return; }
          const file = new File([blob], "studio-design.png", { type: "image/png" });
          setDesignFile(file);
          setDesignPreview(URL.createObjectURL(blob));
          setDesignUrl(null);
          resolve();
        }, "image/png");
      });
      toast({ title: "Design ready! Hit Next to continue." });
    } catch (err) {
      toast({ title: "Export failed", description: String(err), variant: "destructive" });
    } finally {
      setStudioExporting(false);
    }
  }, [studioText, studioFont, studioSize, studioSpacing, studioColor, studioBg, studioUppercase, toast]);

  // Step 1 → 2: upload design (or use AI-generated URL), then load catalog
  const handleStep1Next = async () => {
    if (!title.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    if (!designPreview) { toast({ title: designTab === "generate" ? "Generate a design first" : "Upload a design first", variant: "destructive" }); return; }

    // AI path: designUrl already set from generation
    if (designUrl) {
      // Skip upload, go straight to catalog
    } else {
      if (!designFile) { toast({ title: "Upload a design first", variant: "destructive" }); return; }
      setUploadingDesign(true);
      try {
        const formData = new FormData();
        formData.append("file", designFile);
        const res = await fetch("/api/upload/store-image", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json() as { url?: string };
        setDesignUrl(data.url!);
      } catch {
        toast({ title: "Upload failed", variant: "destructive" });
        setUploadingDesign(false);
        return;
      }
      setUploadingDesign(false);
    }

    // Upload any extra placement files that haven't been uploaded yet
    const pendingExtras = Object.entries(extraDesigns).filter(
      ([, d]) => d?.file && !d.url
    ) as Array<[PlacementId, ExtraDesign]>;

    if (pendingExtras.length > 0) {
      const updated = { ...extraDesigns };
      for (const [position, extra] of pendingExtras) {
        try {
          const fd = new FormData();
          fd.append("file", extra.file!);
          const r = await fetch("/api/upload/store-image", { method: "POST", body: fd });
          if (r.ok) {
            const d = await r.json() as { url?: string };
            updated[position] = { ...extra, url: d.url ?? null };
          }
        } catch { /* non-blocking — placement upload failure shouldn't block progress */ }
      }
      setExtraDesigns(updated);
    }

    // Load catalog
    if (blueprints.length === 0 && connected) {
      setLoadingCatalog(true);
      try {
        const res = await fetch("/api/printify/catalog");
        const data = await res.json();
        setBlueprints(data.blueprints ?? []);
      } catch {
        toast({ title: "Could not load catalog", variant: "destructive" });
      } finally {
        setLoadingCatalog(false);
      }
    }
    setCreateStep(2);
  };

  // Step 2: pick blueprint — open 3D preview dialog, load providers in background
  const handleSelectBlueprint = async (bp: Blueprint) => {
    setPreviewBlueprint(bp);
    setSelectedProvider(null);
    setVariants([]);
    setSelectedVariants(new Set());
    // Pre-fetch providers in the background so Step 3 is instant when user confirms
    setLoadingProviders(true);
    try {
      const res = await fetch(`/api/printify/catalog?blueprintId=${bp.id}`);
      const data = await res.json();
      setProviders(data.providers ?? []);
    } catch {
      toast({ title: "Could not load providers", variant: "destructive" });
    } finally {
      setLoadingProviders(false);
    }
  };

  // User confirms product choice from preview dialog → proceed to Step 3
  const handleConfirmBlueprint = () => {
    if (!previewBlueprint) return;
    setSelectedBlueprint(previewBlueprint);
    setPreviewBlueprint(null);
    setCreateStep(3);
  };

  // Step 3 → 4: pick provider, load variants
  const handleSelectProvider = async (prov: Provider) => {
    setSelectedProvider(prov);
    setVariants([]);
    setSelectedVariants(new Set());
    setLoadingVariants(true);
    setCreateStep(4);
    try {
      const res = await fetch(`/api/printify/catalog?blueprintId=${selectedBlueprint!.id}&providerId=${prov.id}`);
      const data = await res.json();
      const variantList: Variant[] = data.variants?.variants ?? data.variants ?? [];
      setVariants(variantList);
      // Default: select all, price £25.00
      const ids = new Set(variantList.map((v) => v.id));
      setSelectedVariants(ids);
      const prices: Record<number, string> = {};
      variantList.forEach((v) => { prices[v.id] = "25.00"; });
      setVariantPrices(prices);
    } catch {
      toast({ title: "Could not load variants", variant: "destructive" });
    } finally {
      setLoadingVariants(false);
    }
  };

  // Step 4 → 5: confirm variants
  const handleStep4Next = () => {
    if (selectedVariants.size === 0) { toast({ title: "Select at least one variant", variant: "destructive" }); return; }
    setCreateStep(5);
  };

  // Step 5: create product + sync to Printify
  const handleFinish = async () => {
    setCreating(true);
    try {
      // 1. Upload all placement designs to Printify image library
      const placementImages: Array<{ position: string; printifyImageId: string }> = [];

      if (designUrl) {
        try {
          const imgRes = await fetch("/api/printify/upload-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: designUrl, fileName: designFile?.name ?? "design.png" }),
          });
          const imgData = await imgRes.json() as { imageId?: string };
          if (imgData.imageId) placementImages.push({ position: "front", printifyImageId: imgData.imageId });
        } catch { /* Non-blocking */ }
      }

      // Upload extra placements (back, sleeves, label)
      for (const [position, extra] of Object.entries(extraDesigns)) {
        if (extra?.url) {
          try {
            const imgRes = await fetch("/api/printify/upload-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageUrl: extra.url, fileName: extra.file?.name ?? `${position}-design.png` }),
            });
            const imgData = await imgRes.json() as { imageId?: string };
            if (imgData.imageId) placementImages.push({ position, printifyImageId: imgData.imageId });
          } catch { /* Non-blocking */ }
        }
      }

      // Build placements array for DB (all positions that have a design)
      const placementsForDb = [
        ...(designUrl ? [{ position: "front", designFileUrl: designUrl, designFileName: designFile?.name }] : []),
        ...Object.entries(extraDesigns)
          .filter(([, d]) => d?.url)
          .map(([pos, d]) => ({ position: pos, designFileUrl: d!.url!, designFileName: d?.file?.name })),
      ];

      // 2. Create local product record
      const createRes = await fetch("/api/printify/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          designFileUrl: designUrl,
          designFileName: designFile?.name,
          blueprintId: selectedBlueprint?.id,
          blueprintTitle: selectedBlueprint?.title,
          blueprintImageUrl: selectedBlueprint?.images?.[0] ?? null,
          printProviderId: selectedProvider?.id,
          printProviderTitle: selectedProvider?.title,
          placements: placementsForDb,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error);

      const productId = createData.product.id;

      // 3. Sync to Printify if connected
      let syncedOk = false;
      if (connected && selectedBlueprint && selectedProvider) {
        const variantPayload = variants
          .filter((v) => selectedVariants.has(v.id))
          .map((v) => ({
            id: v.id,
            price: Math.round(parseFloat(variantPrices[v.id] ?? "25") * 100),
            enabled: true,
          }));

        try {
          const patchRes = await fetch("/api/printify/products", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId, variants: variantPayload, placementImages }),
          });
          syncedOk = patchRes.ok;
        } catch { /* non-blocking — show product even if sync fails */ }
      }

      // 4. Fetch updated product list (bypass cache) and show it
      const listRes = await fetch("/api/printify/products", { cache: "no-store" });
      const listData = await listRes.json();
      const foundProduct = (listData.products ?? []).find((p: SelectPodProduct) => p.id === productId);

      // Enrich product state with data we know from the wizard (blueprint image, sync status)
      // This ensures 3D preview and correct status show immediately even if DB hasn't flushed
      const baseProduct = foundProduct ?? createData.product;
      const newProduct: SelectPodProduct = {
        ...baseProduct,
        blueprintImageUrl: baseProduct.blueprintImageUrl ?? selectedBlueprint?.images?.[0] ?? null,
        printifyStatus: (syncedOk ? "synced" : baseProduct.printifyStatus) as string,
      } as SelectPodProduct;

      setProducts((listData.products ?? [createData.product]).map((p: SelectPodProduct) =>
        p.id === productId ? newProduct : p
      ));
      setSelectedProduct(newProduct);
      setView("product");
      resetCreate();
      toast({
        title: "Product created!",
        description: syncedOk ? "Synced to Printify ✓" : connected ? "Sync to Printify from the product page." : "Generate mockups next.",
      });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleSyncToPrintify = async () => {
    if (!selectedProduct) return;
    setSyncing(true);
    try {
      // Step 1: Upload the front design (and any extra placements) to Printify's image library
      const placementImages: Array<{ position: string; printifyImageId: string }> = [];

      if (selectedProduct.designFileUrl) {
        const uploadRes = await fetch("/api/printify/upload-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: selectedProduct.designFileUrl, fileName: selectedProduct.designFileName ?? "front-design.png" }),
        });
        const uploadData = await uploadRes.json() as { imageId?: string; error?: string };
        if (!uploadRes.ok) throw new Error(uploadData.error ?? "Design upload failed");
        if (uploadData.imageId) placementImages.push({ position: "front", printifyImageId: uploadData.imageId });
      }

      // Upload any extra placements (back, sleeves, label)
      const extraPlacements = (selectedProduct.placements as Array<{ position: string; designFileUrl: string; designFileName?: string }> | null) ?? [];
      for (const p of extraPlacements) {
        if (!p.designFileUrl || p.position === "front") continue;
        const uploadRes = await fetch("/api/printify/upload-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: p.designFileUrl, fileName: p.designFileName ?? `${p.position}-design.png` }),
        });
        const uploadData = await uploadRes.json() as { imageId?: string };
        if (uploadData.imageId) placementImages.push({ position: p.position, printifyImageId: uploadData.imageId });
      }

      // Step 2: Sync to Printify with uploaded image IDs (no variants override — use what's stored in DB)
      const res = await fetch("/api/printify/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedProduct.id, placementImages }),
      });
      const data = await res.json() as { error?: string; mockupUrls?: string[] };
      if (!res.ok) throw new Error(data.error ?? "Sync failed");

      const updated = {
        ...selectedProduct,
        printifyStatus: "synced",
        ...(data.mockupUrls && data.mockupUrls.length > 0 ? { mockupUrls: data.mockupUrls } : {}),
      } as SelectPodProduct;
      setSelectedProduct(updated);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      toast({ title: "Synced to Printify!", description: "Your product is now live in Printify." });
    } catch (err) {
      toast({ title: "Sync failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedProduct) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/printify/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedProduct.id }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Publish failed");
      const updated = { ...selectedProduct, status: "published", printifyStatus: "published" } as SelectPodProduct;
      setSelectedProduct(updated);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      toast({ title: "🎉 Published!", description: "Your product is now live in your store." });
    } catch (err) {
      toast({ title: "Publish failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const handleFetchPrintifyMockups = async () => {
    if (!selectedProduct) return;
    setGeneratingMockup(true);
    try {
      const res = await fetch(`/api/printify/product-images?productId=${selectedProduct.id}`, { cache: "no-store" });
      const data = await res.json() as { mockupUrls?: string[]; message?: string; error?: string };
      if (!res.ok) throw new Error(data.error);
      const mockupUrls = data.mockupUrls ?? [];
      if (mockupUrls.length === 0) {
        toast({ title: "No mockups yet", description: data.message ?? "Printify may still be generating them — try again in a moment." });
        return;
      }
      const updated = { ...selectedProduct, mockupUrls } as SelectPodProduct;
      setSelectedProduct(updated);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      toast({ title: `${mockupUrls.length} Printify mockups loaded!` });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setGeneratingMockup(false);
    }
  };

  const handleGenerateMockup = async () => {
    if (!selectedProduct) return;
    setGeneratingMockup(true);
    try {
      const res = await fetch("/api/ai-mockup/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedProduct.id, style: mockupStyle, placement: mockupPlacement }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const updated = { ...selectedProduct, mockupUrls: [...((selectedProduct.mockupUrls as string[]) ?? []), data.mockupUrl] } as SelectPodProduct;
      setSelectedProduct(updated);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      toast({ title: "Mockup generated!" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setGeneratingMockup(false);
    }
  };

  const handleGenerateLifestyle = async () => {
    if (!selectedProduct) return;
    setGeneratingLifestyle(true);
    try {
      const res = await fetch("/api/ai-mockup/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedProduct.id, style: "lifestyle", placement: "front" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const updated = { ...selectedProduct, mockupUrls: [...((selectedProduct.mockupUrls as string[]) ?? []), data.mockupUrl] } as SelectPodProduct;
      setSelectedProduct(updated);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      toast({ title: "Lifestyle shot generated! 📸" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setGeneratingLifestyle(false);
    }
  };

  const handleConnectPrintify = async () => {
    if (!apiKey.trim()) return;
    setConnecting(true);
    try {
      const res = await fetch("/api/printify/shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.connected) throw new Error(data.error ?? "Connection failed");
      setConnected(true);
      setApiKey("");
      toast({ title: "Printify connected!" });
    } catch (err) {
      toast({ title: "Connection failed", description: err instanceof Error ? err.message : "Check your API key", variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const handleGenerateCaptions = async () => {
    if (!selectedProduct) return;
    setGeneratingCaptions(true);
    setCaptions([]);
    try {
      const res = await fetch("/api/pod/captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedProduct.id }),
      });
      const data = await res.json() as { captions?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setCaptions(data.captions ?? []);
    } catch (err) {
      toast({ title: "Caption generation failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setGeneratingCaptions(false);
    }
  };

  const handleCopyCaption = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCaptionIdx(idx);
      toast({ title: "Caption copied!" });
      setTimeout(() => setCopiedCaptionIdx(null), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleCreatePromoVideo = async () => {
    if (!selectedProduct) return;
    setGeneratingPromoVideo(true);
    try {
      // Step 1: Generate promo script from product details
      const scriptRes = await fetch("/api/pod/promo-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedProduct.id }),
      });
      const scriptData = await scriptRes.json() as { hook?: string; body?: string; cta?: string; productName?: string; error?: string };
      if (!scriptRes.ok) throw new Error(scriptData.error ?? "Script generation failed");

      // Step 2: Generate video guide using the script + mockup images as stock images
      const mockupUrls = (selectedProduct.mockupUrls as string[] | null) ?? [];
      const guideRes = await fetch("/api/video-guide/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook: scriptData.hook ?? "",
          body: scriptData.body ?? "",
          cta: scriptData.cta ?? "",
          productName: scriptData.productName ?? selectedProduct.title ?? "",
          platforms: ["tiktok"],
          ...(mockupUrls.length > 0 ? { stockImageUrls: mockupUrls.slice(0, 6) } : {}),
        }),
      });
      const guide = await guideRes.json().catch(() => ({}));
      if (!guideRes.ok) throw new Error(guide.error ?? "Video guide generation failed");

      // Step 3: Inject real mockup images directly into scene image_urls so the guide
      // opens with the actual product photos instead of generating new AI images.
      if (mockupUrls.length > 0 && Array.isArray(guide.scenes)) {
        guide.scenes = guide.scenes.map((scene: Record<string, unknown>, i: number) => ({
          ...scene,
          image_url: mockupUrls[i % mockupUrls.length],
        }));
      }

      sessionStorage.setItem("videoCreationGuide", JSON.stringify({
        ...guide,
        scriptTitle: `${selectedProduct.title ?? "Merch"} Promo Video`,
      }));
      router.push("/dashboard/digital-products/video-guide");
    } catch (err) {
      toast({ title: "Video generation failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
      setGeneratingPromoVideo(false);
    }
  };

  const handleReuseDesign = async () => {
    if (!selectedProduct?.designFileUrl) return;
    setDesignUrl(selectedProduct.designFileUrl);
    setDesignPreview(selectedProduct.designFileUrl);
    setTitle(selectedProduct.title + " v2");
    setDesignTab("upload");
    // Load catalog if not already loaded
    if (blueprints.length === 0 && connected) {
      setLoadingCatalog(true);
      try {
        const res = await fetch("/api/printify/catalog");
        const data = await res.json();
        setBlueprints(data.blueprints ?? []);
      } catch {
        toast({ title: "Could not load catalog", variant: "destructive" });
      } finally {
        setLoadingCatalog(false);
      }
    }
    setSelectedBlueprint(null);
    setSelectedProvider(null);
    setVariants([]);
    setSelectedVariants(new Set());
    setVariantPrices({});
    setCreateStep(2);
    setView("create");
  };

  const filteredBlueprints = blueprints.filter((b) =>
    !blueprintSearch || b.title.toLowerCase().includes(blueprintSearch.toLowerCase()) || b.brand.toLowerCase().includes(blueprintSearch.toLowerCase())
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 md:p-10 max-w-[1280px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shirt className="w-6 h-6 text-orange-500" /> Print on Demand
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Design clothing & merch — AI mockups, Printify fulfilment.
          </p>
        </div>
        {view === "list" && (
          <Button onClick={() => { resetCreate(); setView("create"); }} className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
            <Plus className="w-4 h-4" /> New Product
          </Button>
        )}
        {view !== "list" && (
          <Button variant="ghost" onClick={() => { setView("list"); setSelectedProduct(null); resetCreate(); }}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        )}
      </div>

      {/* Connect banner */}
      {!connected && (
        <div className="mb-8 rounded-xl border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900/40 p-5">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">Connect Printify to sync products</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Get your API key from{" "}
                <a href="https://printify.com/app/account/api" target="_blank" rel="noreferrer" className="text-orange-500 underline">printify.com/app/account/api</a>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Input placeholder="Printify API key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="max-w-sm" type="password" />
            <Button onClick={handleConnectPrintify} disabled={connecting || !apiKey.trim()} className="bg-orange-500 hover:bg-orange-600 text-white shrink-0">
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
            </Button>
          </div>
        </div>
      )}

      {connected && view === "list" && (
        <div className="mb-5 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-4 h-4" /> Printify connected
          <Link href="/dashboard/settings" className="ml-2 text-gray-400 hover:text-gray-600 flex items-center gap-1 text-xs">
            <Settings className="w-3.5 h-3.5" /> Manage
          </Link>
        </div>
      )}

      {/* ── LIST ── */}
      {view === "list" && (
        products.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-[#2A2A2A] p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-950/20 flex items-center justify-center mb-4">
              <Shirt className="w-8 h-8 text-orange-400" />
            </div>
            <p className="font-semibold text-gray-900 dark:text-white mb-1">No products yet</p>
            <p className="text-sm text-gray-500 mb-6 max-w-sm">Upload a design, pick a product type and variants, then let AI generate lifestyle mockups.</p>
            <Button onClick={() => { resetCreate(); setView("create"); }} className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
              <Plus className="w-4 h-4" /> Create first product
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => {
              const mockups = (product.mockupUrls as string[]) ?? [];
              return (
                <div key={product.id} className="group rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] hover:border-orange-300 dark:hover:border-orange-700 hover:shadow-md transition-all overflow-hidden relative">
                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm(`Delete "${product.title}"? This cannot be undone.`)) return;
                      await fetch("/api/pod/delete-product", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ productId: product.id }),
                      });
                      setProducts((prev) => prev.filter((p) => p.id !== product.id));
                    }}
                    className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/40 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete product"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>

                  <button type="button" onClick={() => { setSelectedProduct(product); setView("product"); }} className="w-full text-left">
                    <div className="aspect-square bg-gray-50 dark:bg-[#2A2A2A] relative overflow-hidden flex items-center justify-center">
                      {mockups[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mockups[0]} alt={product.title} className="w-full h-full object-cover" />
                      ) : product.designFileUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.designFileUrl} alt={product.title} className="w-full h-full object-contain p-6" />
                      ) : (
                        <Shirt className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                      )}
                    </div>
                    <div className="p-4">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{product.title}</p>
                      {product.blueprintTitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{product.blueprintTitle}</p>}
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${product.printifyStatus === "synced" ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-[#2A2A2A] dark:text-gray-400"}`}>
                          {product.printifyStatus === "synced" ? "Synced" : "Draft"}
                        </span>
                        <span className="text-xs text-gray-400">{mockups.length} mockup{mockups.length !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── CREATE WIZARD ── */}
      {view === "create" && (
        <div className="max-w-2xl">
          <Steps current={createStep} steps={CREATE_STEPS} />

          {/* Step 1: Design + name */}
          {createStep === 1 && (
            <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-6 space-y-5">
              <h2 className="font-bold text-gray-900 dark:text-white">Your design</h2>

              {/* Product name */}
              <div>
                <Label htmlFor="pod-title">Product name</Label>
                <Input id="pod-title" placeholder="e.g. Void Hours Classic Tee" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
              </div>

              {/* Placement tabs */}
              {/* ── FRONT placement (required) ── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Front <span className="text-orange-400">*</span></span>
                  <span className="text-[10px] text-gray-400">Required — primary print area</span>
                  {designPreview && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto" />}
                </div>

                {/* Tab switcher — Upload / Design / Generate */}
                <div className="flex rounded-xl bg-gray-100 dark:bg-[#2A2A2A] p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => { setDesignTab("upload"); setDesignPreview(null); setDesignUrl(null); setDesignFile(null); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg transition-all ${designTab === "upload" ? "bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
                  >
                    <Upload className="w-3 h-3" /> Upload
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDesignTab("studio"); setDesignPreview(null); setDesignUrl(null); setDesignFile(null); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg transition-all ${designTab === "studio" ? "bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
                  >
                    <Layers className="w-3 h-3" /> Design
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDesignTab("generate"); setDesignPreview(null); setDesignUrl(null); setDesignFile(null); setAiStyle("typography"); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg transition-all ${designTab === "generate" ? "bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
                  >
                    <Wand2 className="w-3 h-3" /> AI Generate
                  </button>
                </div>
              </div>

              {/* Upload tab */}
              {designTab === "upload" && (
                <div>
                  <input ref={fileInputRef} type="file" accept="image/png,image/svg+xml,image/jpeg" className="hidden" onChange={handleFileChange} />
                  {designPreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#2A2A2A] w-40 h-40">
                      <Image src={designPreview} alt="Design" fill className="object-contain p-3" />
                      <button type="button" onClick={() => { setDesignFile(null); setDesignPreview(null); setDesignUrl(null); }}
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 dark:border-[#2A2A2A] py-8 text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-colors">
                      <Upload className="w-6 h-6" />
                      <span className="text-sm">Click to upload design</span>
                      <span className="text-xs">PNG with transparent background recommended</span>
                    </button>
                  )}
                </div>
              )}

              {/* ── Design Studio tab ── */}
              {designTab === "studio" && (
                <div className="space-y-4">
                  {/* Font picker */}
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2 font-semibold">Font</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                      {STUDIO_FONTS.map((f) => (
                        <button
                          key={f.value}
                          type="button"
                          onClick={() => setStudioFont(f.value)}
                          className={`shrink-0 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${studioFont === f.value ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400" : "border-gray-200 dark:border-[#2A2A2A] text-gray-500 hover:border-orange-300"}`}
                          style={{ fontFamily: f.value }}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Text input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Text</p>
                      <button
                        type="button"
                        onClick={() => setStudioUppercase((u) => !u)}
                        className={`text-[10px] px-2 py-0.5 rounded border font-semibold transition-all ${studioUppercase ? "border-gray-900 dark:border-white bg-gray-900 dark:bg-white text-white dark:text-black" : "border-gray-200 dark:border-[#2A2A2A] text-gray-400"}`}
                      >
                        AA / aa
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. VOID HOURS"
                      value={studioText}
                      onChange={(e) => setStudioText(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0F0F0F] px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>

                  {/* Size + Spacing sliders */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Size</p>
                        <span className="text-[10px] text-gray-400">{studioSize}</span>
                      </div>
                      <input type="range" min={30} max={120} value={studioSize} onChange={(e) => setStudioSize(Number(e.target.value))}
                        className="w-full accent-orange-500" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Spacing</p>
                        <span className="text-[10px] text-gray-400">{studioSpacing.toFixed(2)}</span>
                      </div>
                      <input type="range" min={0} max={0.5} step={0.01} value={studioSpacing} onChange={(e) => setStudioSpacing(Number(e.target.value))}
                        className="w-full accent-orange-500" />
                    </div>
                  </div>

                  {/* Colour pickers */}
                  <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold whitespace-nowrap">Text</label>
                      <input type="color" value={studioColor} onChange={(e) => setStudioColor(e.target.value)}
                        className="w-8 h-8 rounded-lg border border-gray-200 dark:border-[#2A2A2A] cursor-pointer p-0.5 bg-white dark:bg-[#1A1A1A]" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold whitespace-nowrap">Background</label>
                      <input type="color" value={studioBg === "transparent" ? "#000000" : studioBg} onChange={(e) => setStudioBg(e.target.value)}
                        className="w-8 h-8 rounded-lg border border-gray-200 dark:border-[#2A2A2A] cursor-pointer p-0.5 bg-white dark:bg-[#1A1A1A]" />
                    </div>
                    {/* Quick colour presets */}
                    <div className="flex gap-1.5 ml-auto">
                      {["#000000", "#FFFFFF", "#1A1A2E", "#2D2D2D"].map((c) => (
                        <button key={c} type="button" onClick={() => setStudioBg(c)}
                          title={c}
                          className={`w-5 h-5 rounded-full border-2 transition-all ${studioBg === c ? "border-orange-500 scale-110" : "border-gray-300 dark:border-[#444]"}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>

                  {/* Live preview */}
                  <div
                    className="w-full rounded-xl overflow-hidden flex items-center justify-center"
                    style={{ background: studioBg, minHeight: 140 }}
                  >
                    <span
                      className="px-4 py-6 text-center leading-tight select-none"
                      style={{
                        fontFamily: `"${studioFont}", serif`,
                        fontSize: `${Math.round(studioSize * 0.5)}px`,
                        letterSpacing: `${studioSpacing}em`,
                        color: studioColor,
                        fontWeight: 700,
                        textTransform: studioUppercase ? "uppercase" : "none",
                        wordBreak: "break-word",
                      }}
                    >
                      {studioText || "Your text here"}
                    </span>
                  </div>

                  {/* Exported preview */}
                  {designPreview && (
                    <div className="flex items-center gap-3 p-2 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={designPreview} alt="Exported design" className="w-12 h-12 object-contain rounded-lg bg-gray-100 dark:bg-[#2A2A2A] p-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-green-700 dark:text-green-400">Design exported ✓</p>
                        <p className="text-[10px] text-gray-500">Hit &ldquo;Next&rdquo; to continue, or adjust and re-export</p>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleUseStudioDesign}
                    disabled={studioExporting || !studioText.trim()}
                    className="w-full bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-black gap-2"
                  >
                    {studioExporting
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Exporting...</>
                      : <><CheckCircle2 className="w-4 h-4" />Use this design</>}
                  </Button>
                </div>
              )}

              {/* Generate tab */}
              {designTab === "generate" && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label htmlFor="ai-prompt">Describe your design</Label>
                      <button
                        type="button"
                        onClick={() => {
                          const pick = DESIGN_PROMPTS[Math.floor(Math.random() * DESIGN_PROMPTS.length)];
                          setAiPrompt(pick.prompt);
                          setAiStyle(pick.style);
                        }}
                        className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 font-medium"
                      >
                        <Shuffle className="w-3 h-3" /> Inspire me
                      </button>
                    </div>
                    <textarea
                      id="ai-prompt"
                      rows={3}
                      placeholder="e.g. A wolf howling at the moon with a geometric mountain landscape..."
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0F0F0F] px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                    />
                    {/* Quick idea chips */}
                    {!aiPrompt && (
                      <div className="mt-2 space-y-2">
                        {/* Brand / text row */}
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1.5">Brand &amp; text <span className="normal-case tracking-normal text-orange-400">→ auto-selects Typography style</span></p>
                          <div className="flex flex-wrap gap-1.5">
                            {BRAND_PROMPTS.map((idea) => (
                              <button
                                key={idea.label}
                                type="button"
                                onClick={() => { setAiPrompt(idea.prompt); setAiStyle(idea.style); }}
                                className="text-xs px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-900/40 hover:bg-orange-100 dark:hover:bg-orange-950/30 transition-all"
                              >
                                {idea.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Graphics row */}
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1.5">Graphics</p>
                          <div className="flex flex-wrap gap-1.5">
                            {DESIGN_PROMPTS.slice(0, 6).map((idea) => (
                              <button
                                key={idea.label}
                                type="button"
                                onClick={() => { setAiPrompt(idea.prompt); setAiStyle(idea.style); }}
                                className="text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-[#2A2A2A] text-gray-600 dark:text-gray-400 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-950/20 dark:hover:text-orange-400 border border-transparent hover:border-orange-200 dark:hover:border-orange-900/40 transition-all"
                              >
                                {idea.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">
                          💡 Put text in <span className="font-mono bg-gray-100 dark:bg-[#2A2A2A] px-1 rounded">&quot;quotes&quot;</span> for accurate lettering — e.g. <em>&quot;Void Hours&quot;</em>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Style presets */}
                  <div>
                    <Label>Style</Label>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {[
                        { id: "typography", label: "Typography" },
                        { id: "bold", label: "Bold Graphic" },
                        { id: "vintage", label: "Vintage" },
                        { id: "minimalist", label: "Minimalist" },
                        { id: "lineart", label: "Line Art" },
                        { id: "abstract", label: "Abstract" },
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setAiStyle(s.id)}
                          className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${aiStyle === s.id ? "bg-orange-500 border-orange-500 text-white" : "border-gray-200 dark:border-[#2A2A2A] text-gray-600 dark:text-gray-400 hover:border-orange-300"}`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Generate button */}
                  <Button
                    type="button"
                    onClick={handleGenerateDesign}
                    disabled={generatingDesign || !aiPrompt.trim()}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {generatingDesign ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" />{designPreview ? "Regenerate" : "Generate design"}</>
                    )}
                  </Button>

                  {/* Preview */}
                  {designPreview && !generatingDesign && (
                    <div className="space-y-3">
                      <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-[#2A2A2A] bg-[#f8f8f8] dark:bg-[#2A2A2A] aspect-square w-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={designPreview} alt="Generated design" className="w-full h-full object-contain p-6" />
                        <button
                          type="button"
                          onClick={() => { setDesignPreview(null); setDesignUrl(null); }}
                          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-center text-gray-400 dark:text-gray-500">
                        Not quite right? Tweak the prompt or style and regenerate.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Optional placements — all shown at once ── */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-gray-100 dark:bg-[#2A2A2A]" />
                  <span className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold whitespace-nowrap">Optional print areas</span>
                  <div className="h-px flex-1 bg-gray-100 dark:bg-[#2A2A2A]" />
                </div>
                {PLACEMENTS.filter(p => p.id !== "front").map((p) => {
                  const pos = p.id as PlacementId;
                  const data = extraDesigns[pos];
                  return (
                    <div key={pos} className="rounded-xl border border-gray-100 dark:border-[#2A2A2A] overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-[#111]">
                        <div className="flex items-center gap-2">
                          {data?.preview && data.preview !== "loading"
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            : data?.preview === "loading"
                            ? <Loader2 className="w-3.5 h-3.5 text-orange-400 animate-spin" />
                            : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 dark:border-[#444]" />}
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{p.label}</span>
                          <span className="text-[10px] text-gray-400">{p.hint}</span>
                        </div>
                        {data?.preview && (
                          <button type="button" onClick={() => setExtraDesigns(prev => ({ ...prev, [pos]: { file: null, preview: null, url: null } }))}
                            className="text-[10px] text-gray-400 hover:text-red-500 transition-colors">Remove</button>
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/png,image/svg+xml,image/jpeg"
                        className="hidden"
                        ref={(el) => { if (el) extraFileRefs.current[pos] = el; }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setExtraDesigns(prev => ({ ...prev, [pos]: { file, preview: URL.createObjectURL(file), url: null } }));
                        }}
                      />
                      {data?.preview && data.preview !== "loading" ? (
                        <div className="flex items-center gap-3 px-3 py-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={data.preview} alt={p.label} className="w-12 h-12 object-contain rounded-lg bg-gray-100 dark:bg-[#2A2A2A] p-1" />
                          <div className="flex gap-2">
                            <button type="button" onClick={() => extraFileRefs.current[pos]?.click()}
                              className="text-xs text-orange-500 hover:text-orange-600 font-medium">
                              Replace
                            </button>
                            <button type="button" onClick={() => setExtraDesigns(prev => ({ ...prev, [pos]: { file: null, preview: null, url: null } }))}
                              className="text-xs text-gray-400 hover:text-red-500 font-medium">
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col divide-y divide-gray-100 dark:divide-[#2A2A2A]">
                          {/* Upload row */}
                          <button type="button" onClick={() => extraFileRefs.current[pos]?.click()}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-gray-500 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/10 transition-colors text-left">
                            <Upload className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="text-xs font-medium">Upload my own design</span>
                          </button>
                          {/* Use front design */}
                          {designPreview && (
                            <button
                              type="button"
                              onClick={() => {
                                if (!designFile && !designPreview) return;
                                // Copy front design (file or preview URL) to this placement
                                if (designFile) {
                                  setExtraDesigns(prev => ({ ...prev, [pos]: { file: designFile, preview: designPreview, url: designUrl } }));
                                } else if (designPreview) {
                                  // AI-generated URL — store as url with no file
                                  setExtraDesigns(prev => ({ ...prev, [pos]: { file: null, preview: designPreview, url: designUrl } }));
                                }
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-gray-500 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/10 transition-colors text-left"
                            >
                              <Copy className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="text-xs font-medium">Use front design</span>
                            </button>
                          )}
                          {/* AI Generate shortcut */}
                          <button
                            type="button"
                            onClick={async () => {
                              if (!aiPrompt.trim() && !title.trim()) {
                                toast({ title: "Add a product name or AI prompt first" });
                                return;
                              }
                              // Use the product title as prompt if no AI prompt set
                              const prompt = aiPrompt.trim() || `Logo design for "${title}" brand, minimal, transparent background`;
                              setExtraDesigns(prev => ({ ...prev, [pos]: { file: null, preview: "loading", url: null } }));
                              try {
                                const res = await fetch("/api/ai-design/generate", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ prompt, style: aiStyle }),
                                });
                                const data2 = await res.json() as { url?: string; imageUrl?: string; error?: string };
                                const generatedUrl = data2.url ?? data2.imageUrl;
                                if (!res.ok || !generatedUrl) throw new Error(data2.error ?? "Failed");
                                setExtraDesigns(prev => ({ ...prev, [pos]: { file: null, preview: generatedUrl, url: generatedUrl } }));
                              } catch (err) {
                                setExtraDesigns(prev => ({ ...prev, [pos]: { file: null, preview: null, url: null } }));
                                toast({ title: "AI generation failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
                              }
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-gray-500 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/10 transition-colors text-left"
                          >
                            {extraDesigns[pos]?.preview === "loading"
                              ? <><Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" /><span className="text-xs font-medium">Generating...</span></>
                              : <><Wand2 className="w-3.5 h-3.5 flex-shrink-0" /><span className="text-xs font-medium">Generate with AI</span></>}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <Button
                onClick={handleStep1Next}
                disabled={uploadingDesign || !title.trim() || !designPreview}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              >
                {uploadingDesign ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Uploading...</>
                ) : !designPreview ? (
                  <>Add a design to continue</>
                ) : !title.trim() ? (
                  <>Add a product name to continue</>
                ) : (
                  <>Next: Pick product type <ChevronRight className="w-4 h-4 ml-1" /></>
                )}
              </Button>
            </div>
          )}

          {/* Sticky mini design preview — shown in Steps 3, 4, 5 */}
          {createStep >= 3 && selectedBlueprint && designPreview && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-gray-100 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-3">
              <div className="relative w-14 h-14 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedBlueprint.images[0]} alt="" className="w-full h-full object-contain rounded-lg" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={designPreview}
                  alt="design"
                  className="absolute"
                  style={{
                    ...getDesignOverlay(selectedBlueprint.title),
                    mixBlendMode: "multiply" as React.CSSProperties["mixBlendMode"],
                    opacity: 0.85,
                  }}
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{title}</p>
                <p className="text-[11px] text-gray-400 truncate">{selectedBlueprint.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setCreateStep(2)}
                className="ml-auto shrink-0 text-[11px] text-orange-500 hover:text-orange-600 font-medium whitespace-nowrap"
              >
                Change
              </button>
            </div>
          )}

          {/* Step 2: Blueprint catalog */}
          {createStep === 2 && (
            <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-900 dark:text-white">Choose product type</h2>
                <button type="button" onClick={() => setCreateStep(1)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <ArrowLeft className="w-3 h-3" /> Back
                </button>
              </div>
              {!connected ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">Connect Printify above to browse the catalog.</p>
              ) : loadingCatalog ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading catalog...
                </div>
              ) : (
                <>
                  <Input placeholder="Search t-shirts, hoodies, mugs..." value={blueprintSearch} onChange={(e) => setBlueprintSearch(e.target.value)} />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1">
                    {filteredBlueprints.map((bp) => (
                      <button key={bp.id} type="button" onClick={() => handleSelectBlueprint(bp)}
                        className="rounded-xl border border-gray-200 dark:border-[#2A2A2A] hover:border-orange-400 hover:shadow-sm transition-all p-3 text-left">
                        {bp.images?.[0] && (
                          <div className="aspect-square rounded-lg overflow-hidden bg-gray-50 dark:bg-[#2A2A2A] mb-2 relative">
                            <Image src={bp.images[0]} alt={bp.title} fill className="object-contain p-1" />
                          </div>
                        )}
                        <p className="text-xs font-semibold text-gray-900 dark:text-white leading-tight">{bp.title}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{bp.brand}</p>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Print provider */}
          {createStep === 3 && (
            <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-white">Choose print provider</h2>
                  <p className="text-xs text-gray-400 mt-0.5">for {selectedBlueprint?.title}</p>
                </div>
                <button type="button" onClick={() => setCreateStep(2)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <ArrowLeft className="w-3 h-3" /> Back
                </button>
              </div>
              {loadingProviders ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading providers...
                </div>
              ) : (
                <div className="space-y-2">
                  {providers.map((prov) => (
                    <button key={prov.id} type="button" onClick={() => handleSelectProvider(prov)}
                      className="w-full flex items-center justify-between rounded-xl border border-gray-200 dark:border-[#2A2A2A] hover:border-orange-400 p-4 text-left transition-all">
                      <div>
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">{prov.title}</p>
                        <p className="text-xs text-gray-400">{prov.location?.country}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Variants */}
          {createStep === 4 && (
            <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-white">Select variants & set prices</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{selectedBlueprint?.title} · {selectedProvider?.title}</p>
                </div>
                <button type="button" onClick={() => setCreateStep(3)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <ArrowLeft className="w-3 h-3" /> Back
                </button>
              </div>

              {loadingVariants ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading variants...
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{selectedVariants.size} of {variants.length} selected</span>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setSelectedVariants(new Set(variants.map((v) => v.id)))} className="text-orange-500 hover:text-orange-600">Select all</button>
                      <button type="button" onClick={() => setSelectedVariants(new Set())} className="hover:text-gray-700">Clear</button>
                    </div>
                  </div>

                  {/* Profit summary banner */}
                  {selectedVariants.size > 0 && (() => {
                    const enabledVars = variants.filter(v => selectedVariants.has(v.id));
                    const withCost = enabledVars.filter(v => v.cost != null);
                    if (withCost.length === 0) return null;
                    const avgBase = withCost.reduce((s, v) => s + v.cost!, 0) / withCost.length / 100;
                    const avgSale = enabledVars.reduce((s, v) => s + parseFloat(variantPrices[v.id] ?? "25"), 0) / enabledVars.length;
                    const profit = avgSale - avgBase;
                    const margin = avgSale > 0 ? Math.round((profit / avgSale) * 100) : 0;
                    return (
                      <div className="rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30 px-4 py-3 flex items-center gap-4">
                        <div className="flex-1">
                          <p className="text-[10px] uppercase tracking-widest text-green-600 dark:text-green-400 font-semibold">Est. profit per sale</p>
                          <p className="text-xl font-bold text-green-700 dark:text-green-300">£{profit.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400">Base cost</p>
                          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">£{avgBase.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400">Margin</p>
                          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">{margin}%</p>
                        </div>
                      </div>
                    );
                  })()}

                  <div className={`space-y-1.5 overflow-y-auto transition-all ${variantsExpanded ? "max-h-[500px]" : "max-h-[280px]"}`}>
                    {variants.map((v) => {
                      const checked = selectedVariants.has(v.id);
                      const baseCost = v.cost != null ? v.cost / 100 : null;
                      const salePrice = parseFloat(variantPrices[v.id] ?? "25");
                      const profit = baseCost != null ? salePrice - baseCost : null;
                      return (
                        <div key={v.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 border transition-all ${checked ? "border-orange-200 bg-orange-50/50 dark:bg-orange-950/10 dark:border-orange-900/30" : "border-gray-100 dark:border-[#2A2A2A]"}`}>
                          <input type="checkbox" checked={checked} onChange={() => setSelectedVariants((prev) => {
                            const next = new Set(prev);
                            if (next.has(v.id)) next.delete(v.id); else next.add(v.id);
                            return next;
                          })} className="accent-orange-500" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate block">{v.title}</span>
                            {baseCost != null && checked && (
                              <span className="text-[10px] text-gray-400">
                                Base: £{baseCost.toFixed(2)}
                                {profit != null && <span className={`ml-2 font-medium ${profit > 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                                  Profit: £{profit.toFixed(2)}
                                </span>}
                              </span>
                            )}
                          </div>
                          {checked && (
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-xs text-gray-400">£</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={variantPrices[v.id] ?? "25.00"}
                                onChange={(e) => setVariantPrices((prev) => ({ ...prev, [v.id]: e.target.value }))}
                                className="w-16 text-xs rounded-md border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0F0F0F] px-2 py-1 text-right"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {variants.length > 6 && (
                    <button type="button" onClick={() => setVariantsExpanded((e) => !e)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mx-auto">
                      {variantsExpanded ? <><ChevronUp className="w-3 h-3" />Show less</> : <><ChevronDown className="w-3 h-3" />Show all {variants.length}</>}
                    </button>
                  )}

                  <Button onClick={handleStep4Next} disabled={selectedVariants.size === 0} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                    Review & create <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Step 5: Review */}
          {createStep === 5 && (
            <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-900 dark:text-white">Review & create</h2>
                <button type="button" onClick={() => setCreateStep(4)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <ArrowLeft className="w-3 h-3" /> Back
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex gap-4">
                  {designPreview && (
                    <div className="w-20 h-20 rounded-xl border border-gray-100 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#2A2A2A] relative shrink-0 overflow-hidden">
                      <Image src={designPreview} alt="Design" fill className="object-contain p-2" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="font-semibold text-gray-900 dark:text-white">{title}</p>
                    <p className="text-gray-500">{selectedBlueprint?.title}</p>
                    <p className="text-gray-400 text-xs">{selectedProvider?.title} · {selectedProvider?.location?.country}</p>
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-[#2A2A2A] px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-semibold text-gray-900 dark:text-white">{selectedVariants.size}</span> variant{selectedVariants.size !== 1 ? "s" : ""} selected
                  {connected && <span className="ml-2 text-green-600 dark:text-green-400">· Will sync to Printify</span>}
                </div>
              </div>

              <Button onClick={handleFinish} disabled={creating} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                {creating ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating...</> : "Create product"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── 3D PRODUCT PREVIEW DIALOG ── */}
      <Dialog open={!!previewBlueprint} onOpenChange={(open) => { if (!open) setPreviewBlueprint(null); }}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-2xl">
          {previewBlueprint && (
            <div className="flex flex-col sm:flex-row">
              {/* Left: design-on-product preview */}
              <div className="sm:w-[55%] bg-gray-50 dark:bg-[#1A1A1A] p-5 flex items-center justify-center">
                {designPreview ? (
                  <DesignOnProductPreview
                    blueprintImage={previewBlueprint.images[0]}
                    designUrl={designPreview}
                    blueprintTitle={previewBlueprint.title}
                    className="w-full max-w-xs"
                  />
                ) : (
                  // No design yet — just show the blank product image
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewBlueprint.images[0]}
                    alt={previewBlueprint.title}
                    className="w-full max-w-xs rounded-xl"
                  />
                )}
                <p className="absolute bottom-3 left-0 right-0 text-center text-[10px] text-gray-400">
                  Preview — final print position may vary slightly
                </p>
              </div>

              {/* Right: product info + actions */}
              <div className="sm:w-[45%] p-6 flex flex-col justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-orange-500 font-semibold mb-1">
                    {previewBlueprint.brand}
                  </p>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                    {previewBlueprint.title}
                  </h2>

                  {designPreview ? (
                    <div className="mt-3 flex items-start gap-2 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 px-3 py-2.5">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-green-700 dark:text-green-400">
                        Your design is composited on the product above. The print position and scale will be finalised in Printify.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 px-3 py-2.5">
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        No design uploaded yet — you&apos;ll see the preview once you add one in Step 1.
                      </p>
                    </div>
                  )}

                  {/* Quick product images strip */}
                  {previewBlueprint.images.length > 1 && (
                    <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
                      {previewBlueprint.images.slice(0, 4).map((img, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={img}
                          alt=""
                          className="w-14 h-14 object-contain rounded-lg border border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#2A2A2A] shrink-0"
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={handleConfirmBlueprint}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2"
                  >
                    {loadingProviders ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Loading providers...</>
                    ) : (
                      <>Use this product <ChevronRight className="w-4 h-4" /></>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setPreviewBlueprint(null)}
                    className="w-full text-gray-500"
                  >
                    Choose a different product
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── PRODUCT DETAIL ── */}
      {view === "product" && selectedProduct && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {/* 3D design-on-product preview (if we have blueprint image) or flat design */}
            {selectedProduct.designFileUrl && (
              <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                  {selectedProduct.blueprintImageUrl ? "Product Preview" : "Design File"}
                </p>
                {selectedProduct.blueprintImageUrl ? (
                  <DesignOnProductPreview
                    blueprintImage={selectedProduct.blueprintImageUrl}
                    designUrl={selectedProduct.designFileUrl}
                    blueprintTitle={selectedProduct.blueprintTitle}
                    className="w-full max-h-72 object-contain"
                  />
                ) : (
                  <div className="w-full max-h-64 bg-gray-50 dark:bg-[#2A2A2A] rounded-xl flex items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedProduct.designFileUrl} alt="Design" className="max-h-64 w-auto object-contain p-4" />
                  </div>
                )}
              </div>
            )}

            {/* Print areas — manage placements (Back, Sleeves, Label) */}
            <PlacementManager
              selectedProduct={selectedProduct}
              setSelectedProduct={setSelectedProduct}
              setProducts={setProducts}
              toast={toast}
            />

            <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Mockups</p>

              {/* ── Hero: Lifestyle Shot (AI person wearing it) ── */}
              <div className="rounded-xl border border-orange-200 dark:border-orange-900/40 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/10 p-3.5 mb-3">
                <div className="flex items-start gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center flex-shrink-0">
                    <span className="text-base">👤</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Lifestyle Shot</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">AI generates a photo of someone wearing your product on the street</p>
                  </div>
                </div>
                <Button
                  onClick={handleGenerateLifestyle}
                  disabled={generatingLifestyle || generatingMockup}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2 font-semibold"
                >
                  {generatingLifestyle
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Generating lifestyle shot...</>
                    : <><Sparkles className="w-4 h-4" />Generate Lifestyle Shot</>}
                </Button>
              </div>

              {/* ── Printify official mockups (when synced) ── */}
              {selectedProduct.printifyProductId && (
                <div className="mb-3">
                  <Button
                    onClick={handleFetchPrintifyMockups}
                    disabled={generatingMockup}
                    variant="outline"
                    className="w-full gap-2 font-semibold border-gray-200 dark:border-[#2A2A2A]"
                  >
                    {generatingMockup
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Loading...</>
                      : <><RefreshCw className="w-4 h-4" />Get Printify Mockups</>}
                  </Button>
                  <p className="text-[10px] text-gray-400 text-center mt-1.5">Official renders from Printify — wearing, flat lay, folded &amp; more</p>
                </div>
              )}

              {/* ── More AI mockup styles ── */}
              <details className="mt-1">
                <summary className="text-[10px] uppercase tracking-widest text-gray-400 cursor-pointer select-none mb-2 hover:text-gray-600 transition-colors flex items-center gap-1">
                  ✦ More AI mockup styles
                </summary>
                <div className="mt-2">
                  {/* Style selector */}
                  <div className="grid grid-cols-2 gap-1.5 mb-3">
                    {MOCKUP_STYLES.map((s) => (
                      <button key={s.id} type="button" onClick={() => setMockupStyle(s.id)}
                        className={`rounded-lg border p-2 text-center text-xs font-medium transition-all ${mockupStyle === s.id ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400" : "border-gray-200 dark:border-[#2A2A2A] text-gray-500 hover:border-orange-300"}`}>
                        <span className="block font-semibold">{s.label}</span>
                        <span className="text-gray-400 text-[10px]">{s.desc}</span>
                      </button>
                    ))}
                  </div>

                  {/* Placement selector */}
                  {(() => {
                    const productPlacements = (selectedProduct.placements as Array<{ position: string }> | null) ?? [];
                    const availablePlacements = [
                      { id: "front", label: "Front" },
                      ...productPlacements
                        .filter((p) => p.position !== "front")
                        .map((p) => ({
                          id: p.position,
                          label: PLACEMENTS.find((pl) => pl.id === p.position)?.label ?? p.position,
                        })),
                    ];
                    if (availablePlacements.length <= 1) return null;
                    return (
                      <div className="mb-3">
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1.5">Mockup view</p>
                        <div className="flex flex-wrap gap-1.5">
                          {availablePlacements.map((p) => (
                            <button key={p.id} type="button" onClick={() => setMockupPlacement(p.id)}
                              className={`text-xs px-3 py-1 rounded-full border transition-all ${mockupPlacement === p.id ? "bg-orange-500 border-orange-500 text-white" : "border-gray-200 dark:border-[#2A2A2A] text-gray-500 hover:border-orange-300"}`}>
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <Button onClick={handleGenerateMockup} disabled={generatingMockup || generatingLifestyle} className="w-full bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-black gap-2">
                    {generatingMockup ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</> : <><Sparkles className="w-4 h-4" />Generate with selected style</>}
                  </Button>
                </div>
              </details>

              {((selectedProduct.mockupUrls as string[]) ?? []).length > 0 && (
                <MockupGrid mockups={(selectedProduct.mockupUrls as string[]) ?? []} productTitle={selectedProduct.title} />
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Product Details</p>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{selectedProduct.title}</h2>
              {selectedProduct.blueprintTitle && <p className="text-sm text-gray-500">{selectedProduct.blueprintTitle}</p>}
              {selectedProduct.printProviderTitle && <p className="text-xs text-gray-400 mt-0.5">{selectedProduct.printProviderTitle}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${selectedProduct.printifyStatus === "synced" ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-[#2A2A2A] dark:text-gray-400"}`}>
                  {selectedProduct.printifyStatus === "synced" ? "✓ Synced to Printify" : "Draft"}
                </span>
              </div>
              {selectedProduct.designFileUrl && (
                <button
                  type="button"
                  onClick={handleReuseDesign}
                  className="mt-4 w-full flex items-center justify-center gap-2 text-sm font-medium border border-gray-200 dark:border-[#2A2A2A] rounded-xl py-2.5 text-gray-600 dark:text-gray-400 hover:border-orange-300 hover:text-orange-500 dark:hover:border-orange-700 dark:hover:text-orange-400 transition-all"
                >
                  <RefreshCw className="w-4 h-4" /> Use this design for another product
                </button>
              )}
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Printify</p>
              {selectedProduct.printifyProductId ? (
                <div className="space-y-3">
                  {/* Status */}
                  {selectedProduct.printifyStatus === "published" ? (
                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                      <CheckCircle2 className="w-4 h-4" /> Live in your store
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                      <AlertCircle className="w-4 h-4" /> Synced but not yet published
                    </div>
                  )}

                  {/* Publish button — shown when synced but not published */}
                  {selectedProduct.printifyStatus !== "published" && (
                    <Button
                      onClick={handlePublish}
                      disabled={publishing}
                      className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
                    >
                      {publishing
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Publishing...</>
                        : <><CheckCircle2 className="w-4 h-4" />Publish to store</>}
                    </Button>
                  )}

                  <a href={`https://printify.com/app/store/products/${selectedProduct.printifyProductId}/edit`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-orange-500 hover:text-orange-600">
                    Edit in Printify <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">Not yet synced to Printify.</p>
                  <Button
                    onClick={handleSyncToPrintify}
                    disabled={syncing || !connected}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2"
                  >
                    {syncing ? <><Loader2 className="w-4 h-4 animate-spin" />Syncing...</> : <><RefreshCw className="w-4 h-4" />Sync to Printify now</>}
                  </Button>
                  {!connected && (
                    <p className="text-xs text-amber-600">Connect Printify above to enable sync.</p>
                  )}
                </div>
              )}
            </div>

            {/* Profit Calculator */}
            {(() => {
              const storedVariants = (selectedProduct.variants as Array<{ id: number; price: number; title?: string; enabled?: boolean }> | null) ?? [];
              const enabledVariants = storedVariants.filter(v => v.enabled !== false && v.price > 0);
              if (enabledVariants.length === 0) return null;
              const avgPrice = enabledVariants.reduce((s, v) => s + v.price, 0) / enabledVariants.length / 100;
              return (
                <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">💰 Profit Calculator</p>
                  <ProfitCalculator avgSalePrice={avgPrice} />
                </div>
              );
            })()}

            <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/10 border border-orange-100 dark:border-orange-900/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-orange-500 mb-2">Marketing Tip</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Generate 3–5 AI mockups in different styles, then use them in TikTok videos and your email list to drive sales.
              </p>
            </div>

            {/* Promo Video Guide */}
            <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Promo Video</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Generate a full TikTok/Instagram promo video with AI scenes, voiceover and captions.</p>
              <Button
                onClick={handleCreatePromoVideo}
                disabled={generatingPromoVideo}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2"
              >
                {generatingPromoVideo ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Creating promo video…</>
                ) : (
                  <><Sparkles className="w-4 h-4" />Create Promo Video</>
                )}
              </Button>
            </div>

            {/* TikTok Caption Generator */}
            <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">TikTok Captions</p>
              </div>
              <Button
                onClick={handleGenerateCaptions}
                disabled={generatingCaptions}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2"
              >
                {generatingCaptions ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Generating captions...</>
                ) : (
                  <><Sparkles className="w-4 h-4" />Generate TikTok Captions</>
                )}
              </Button>

              {captions.length > 0 && (
                <div className="mt-4 space-y-3">
                  {captions.map((caption, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl bg-gray-50 dark:bg-[#0F0F0F] border border-gray-100 dark:border-[#2A2A2A] p-4"
                    >
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {caption}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCopyCaption(caption, idx)}
                        className="mt-3 flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-orange-500 transition-colors"
                      >
                        {copiedCaptionIdx === idx ? (
                          <><Check className="w-3.5 h-3.5 text-green-500" /> Copied!</>
                        ) : (
                          <><Copy className="w-3.5 h-3.5" /> Copy caption</>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
