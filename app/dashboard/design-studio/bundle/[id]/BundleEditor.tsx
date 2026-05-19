"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Plus, Trash2, Copy, Download, Loader2, Check,
  MoreHorizontal, ChevronUp, ChevronDown, Pencil, Package, Zap, Sparkles, Layers, X,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDashboardTheme } from "@/components/dashboard-theme-provider";
import { SelectDesign, DesignData } from "@/db/schema/designs-schema";
import { SelectBundle, ContentAssets } from "@/db/schema/bundles-schema";
import { SlidePreview } from "@/app/dashboard/design-studio/SlidePreview";
import { ContentAssetsPanel } from "./ContentAssetsPanel";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Bundle Editor ──────────────────────────────────────────────────────────

type Slide = SelectDesign & { data: DesignData };

export function BundleEditor({ bundleId }: { bundleId: string }) {
  const { theme } = useDashboardTheme();
  const isDark = theme === "dark";
  const router = useRouter();

  const [bundle, setBundle] = useState<SelectBundle | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<"slides" | "content">("slides");
  const [assets, setAssets] = useState<ContentAssets | null>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const [centerDims, setCenterDims] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const obs = new ResizeObserver(() => {
      if (centerRef.current) {
        const { width, height } = centerRef.current.getBoundingClientRect();
        setCenterDims({ w: width, h: height });
      }
    });
    if (centerRef.current) obs.observe(centerRef.current);
    return () => obs.disconnect();
  }, []);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState("Untitled Bundle");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [mobileSlideOpen, setMobileSlideOpen] = useState(false);
  const [mobileContentOpen, setMobileContentOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const panelCls = isDark ? "bg-[#1A1A1A] border-[#2A2A2A] text-white" : "bg-white border-gray-200 text-gray-900";
  const dimCls = isDark ? "text-gray-400" : "text-gray-500";

  useEffect(() => {
    fetch(`/api/design-bundles/${bundleId}`)
      .then((r) => r.json())
      .then(({ bundle: b, slides: s }) => {
        if (b) { setBundle(b); setTitle(b.title); setAssets(b.assets ?? null); }
        if (s) setSlides(s as Slide[]);
      })
      .finally(() => setLoading(false));
  }, [bundleId]);

  const scheduleTitle = useCallback((val: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true); setSaved(false);
      await fetch(`/api/design-bundles/${bundleId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: val }),
      });
      setSaving(false); setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 800);
  }, [bundleId]);

  function updateTitle(val: string) {
    setTitle(val);
    scheduleTitle(val);
  }

  async function moveSlide(idx: number, dir: -1 | 1) {
    const next = [...slides];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    // Fix slide indices
    const reordered = next.map((s, i) => ({ ...s, slideIndex: i }));
    setSlides(reordered);
    if (activeIdx === idx) setActiveIdx(target);
    else if (activeIdx === target) setActiveIdx(idx);
    await fetch(`/api/design-bundles/${bundleId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slideOrder: reordered.map((s, i) => ({ id: s.id, slideIndex: i })) }),
    });
  }

  async function duplicateSlide(idx: number) {
    const slide = slides[idx];
    const label = `${slide.title} (copy)`;
    const res = await fetch("/api/designs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: label,
        data: slide.data,
        bundleId,
        slideIndex: slides.length,
      }),
    });
    const { design } = await res.json() as { design: Slide };
    if (design) {
      setSlides((prev) => [...prev, design]);
      await fetch(`/api/design-bundles/${bundleId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slideCount: slides.length + 1 }),
      });
    }
  }

  async function deleteSlide(idx: number) {
    const slide = slides[idx];
    await fetch(`/api/designs/${slide.id}`, { method: "DELETE" });
    const next = slides.filter((_, i) => i !== idx);
    setSlides(next);
    setActiveIdx(Math.min(activeIdx, next.length - 1));
    await fetch(`/api/design-bundles/${bundleId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slideCount: next.length }),
    });
  }

  async function addBlankSlide() {
    const activeSlide = slides[activeIdx];
    const blankData: DesignData = {
      width: activeSlide?.data.width ?? 1080,
      height: activeSlide?.data.height ?? 1920,
      background: "#ffffff",
      elements: [],
    };
    const res = await fetch("/api/designs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Slide ${slides.length + 1}`,
        data: blankData,
        bundleId,
        slideIndex: slides.length,
      }),
    });
    const { design } = await res.json() as { design: Slide };
    if (design) {
      setSlides((prev) => [...prev, design]);
      setActiveIdx(slides.length);
      await fetch(`/api/design-bundles/${bundleId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slideCount: slides.length + 1 }),
      });
    }
  }

  async function exportAllAsZip() {
    setExportingZip(true);
    try {
      const [{ toPng }, { default: JSZip }] = await Promise.all([
        import("html-to-image"),
        import("jszip"),
      ]);
      const zip = new JSZip();
      const W = slides[0]?.data.width ?? 1080;
      const H = slides[0]?.data.height ?? 1920;

      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        const container = document.createElement("div");
        container.style.cssText = `position:fixed;left:-9999px;top:0;width:${W}px;height:${H}px;overflow:hidden;z-index:-1`;
        document.body.appendChild(container);

        const { createRoot } = await import("react-dom/client");
        const root = createRoot(container);
        root.render(React.createElement(SlidePreview, { data: slide.data, scale: 1 }));
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        await new Promise((r) => setTimeout(r, 200));

        const png = await toPng(container.firstElementChild as HTMLElement, { pixelRatio: 2, width: W, height: H });
        root.unmount();
        document.body.removeChild(container);

        const base64 = png.split(",")[1];
        zip.file(`slide-${String(i + 1).padStart(2, "0")}.png`, base64, { base64: true });
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-slides.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingZip(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  const activeSlide = slides[activeIdx] ?? null;
  const slideW = activeSlide?.data.width ?? 1080;
  const slideH = activeSlide?.data.height ?? 1920;

  // Fit preview into available center area (account for counter + actions ~180px)
  const maxPreviewH = Math.max(centerDims.h - 180, 300);
  const maxPreviewW = Math.max(centerDims.w - 80, 200);
  const byHeight = { w: (maxPreviewH * slideW) / slideH, h: maxPreviewH };
  const byWidth = { w: maxPreviewW, h: (maxPreviewW * slideH) / slideW };
  const useHeight = byHeight.w <= maxPreviewW;
  const previewW = useHeight ? byHeight.w : byWidth.w;
  const previewH = useHeight ? byHeight.h : byWidth.h;
  const previewScale = previewW / slideW;

  // Thumbnail scale for navigator
  const thumbW = 136;
  const thumbScale = thumbW / slideW;
  const thumbH = slideH * thumbScale;

  const styleLabels: Record<string, string> = {
    "minimal-luxury":     "Minimal Luxury",
    "dark-aesthetic":     "Dark Aesthetic",
    "wellness":           "Wellness",
    "clean-productivity": "Clean Productivity",
    "faceless-creator":   "Faceless Creator",
    "modern-business":    "Modern Business",
    "viral-storytelling": "Viral Storytelling",
    "aggressive-viral":   "Aggressive Viral",
    "educational-pro":    "Educational Pro",
    "soft-feminine":      "Soft Feminine",
    "tech-minimal":       "Tech Minimal",
    "luxury-editorial":   "Luxury Editorial",
    "chaos-raw":          "Chaos / Raw",
    "quote-focus-style":  "Quote Focus",
  };

  return (
    <div className={`flex flex-col h-full overflow-hidden ${isDark ? "bg-[#0F0F0F] text-white" : "bg-[#F9FAFB] text-gray-900"}`}>

      {/* Top bar */}
      <header className={`shrink-0 flex items-center justify-between gap-3 px-4 border-b ${isDark ? "bg-[#0F0F0F]/95 border-[#2A2A2A]" : "bg-white/95 border-gray-200"} backdrop-blur-sm shadow-sm z-40`} style={{ height: 52 }}>
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.push("/dashboard/design-studio")} className={`flex items-center gap-1 text-sm shrink-0 ${isDark ? "text-gray-400 hover:text-orange-500" : "text-gray-500 hover:text-orange-500"}`}>
            <ChevronLeft className="w-4 h-4" /> Design Studio
          </button>
          <div className={`h-5 w-px ${isDark ? "bg-[#2A2A2A]" : "bg-gray-200"}`} />
          {editingTitle
            ? <Input autoFocus value={title} onChange={(e) => updateTitle(e.target.value)} onBlur={() => setEditingTitle(false)} onKeyDown={(e) => { if (e.key === "Enter") setEditingTitle(false); }} className="h-7 text-sm font-semibold w-56 px-2" />
            : <button onClick={() => setEditingTitle(true)} className={`flex items-center gap-1.5 text-sm font-semibold truncate max-w-[280px] hover:text-orange-500 ${isDark ? "text-white" : "text-gray-900"}`}>
                {title} <Pencil className="w-3 h-3 opacity-40 shrink-0" />
              </button>}
          {saving && <span className={`flex items-center gap-1 text-xs ${dimCls}`}><Loader2 className="w-3 h-3 animate-spin" /> Saving…</span>}
          {saved && <span className="flex items-center gap-1 text-xs text-emerald-600"><Check className="w-3 h-3" /> Saved</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Tab switcher — desktop only */}
          <div className={`hidden md:flex rounded-lg p-0.5 ${isDark ? "bg-[#2A2A2A]" : "bg-gray-100"}`}>
            {(["slides", "content"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-orange-500 text-white shadow-sm"
                    : isDark
                    ? "text-gray-400 hover:text-white"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {tab === "content" && <Sparkles className="w-3 h-3" />}
                {tab === "slides" ? "Slides" : "Content Package"}
                {tab === "content" && assets && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-0.5" />
                )}
              </button>
            ))}
          </div>
          {/* Slide controls — desktop only */}
          {activeTab === "slides" && (
            <>
              <span className={`hidden md:inline text-xs ${dimCls}`}>
                {slides.length} slide{slides.length !== 1 ? "s" : ""}{bundle?.style ? ` · ${styleLabels[bundle.style] ?? bundle.style}` : ""}
              </span>
              <Button size="sm" variant="outline" onClick={addBlankSlide} className={`hidden md:inline-flex gap-1.5 ${isDark ? "border-[#2A2A2A] text-gray-300 hover:text-white" : ""}`}>
                <Plus className="w-3.5 h-3.5" /> Add Slide
              </Button>
              <Button size="sm" variant="outline" onClick={exportAllAsZip} disabled={exportingZip || slides.length === 0} className={`hidden md:inline-flex gap-1.5 ${isDark ? "border-[#2A2A2A] text-gray-300 hover:text-white" : ""}`}>
                {exportingZip ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Exporting…</> : <><Package className="w-3.5 h-3.5" /> Export ZIP</>}
              </Button>
            </>
          )}
        </div>
      </header>

      {/* ── Mobile toolbar (md:hidden) ─────────────────────────────────── */}
      <div className={`md:hidden shrink-0 flex items-center gap-2 px-3 py-2 border-b ${isDark ? "border-[#2A2A2A] bg-[#0F0F0F]" : "border-gray-200 bg-white"}`}>

        {/* Slides drawer */}
        <Sheet open={mobileSlideOpen} onOpenChange={setMobileSlideOpen}>
          <button
            onClick={() => setMobileSlideOpen(true)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              isDark ? "border-[#2A2A2A] text-gray-300 hover:border-orange-500 hover:text-orange-400" : "border-gray-200 text-gray-700 hover:border-orange-400 hover:text-orange-500"
            }`}
          >
            <Layers className="w-4 h-4" />
            Slides
            <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>({slides.length})</span>
          </button>
          <SheetContent side="left" className={`w-[82vw] max-w-[300px] p-0 flex flex-col ${isDark ? "bg-[#1A1A1A] border-[#2A2A2A]" : "bg-white border-gray-200"}`}>
            <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${isDark ? "border-[#2A2A2A]" : "border-gray-200"}`}>
              <span className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Slides</span>
              <button onClick={() => setMobileSlideOpen(false)} className={`p-1 rounded-lg ${isDark ? "text-gray-400 hover:bg-white/10" : "text-gray-500 hover:bg-black/5"}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {slides.map((slide, idx) => (
                <div
                  key={slide.id}
                  onClick={() => { setActiveIdx(idx); setMobileSlideOpen(false); }}
                  className={`group relative rounded-lg overflow-hidden cursor-pointer border-2 transition-colors ${activeIdx === idx ? "border-orange-500" : isDark ? "border-[#2A2A2A] hover:border-gray-600" : "border-gray-200 hover:border-gray-400"}`}
                >
                  <div style={{ width: thumbW, height: thumbH, position: "relative", overflow: "hidden", flexShrink: 0, margin: "0 auto" }}>
                    {slide.previewUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={slide.previewUrl} alt="" className="w-full h-full object-cover" />
                      : <SlidePreview data={slide.data} scale={thumbScale} />}
                  </div>
                  <div className={`px-1.5 py-1 text-[10px] font-medium flex items-center justify-between ${isDark ? "bg-[#111] text-gray-400" : "bg-gray-50 text-gray-500"}`}>
                    <span>Slide {idx + 1}</span>
                    {activeIdx === idx && <span className="text-orange-500 text-[10px]">●</span>}
                  </div>
                </div>
              ))}
              <button
                onClick={() => { addBlankSlide(); setMobileSlideOpen(false); }}
                className={`w-full rounded-lg border-2 border-dashed flex items-center justify-center py-3 text-xs font-medium transition-colors ${isDark ? "border-[#2A2A2A] text-gray-600 hover:border-orange-500 hover:text-orange-500" : "border-gray-200 text-gray-400 hover:border-orange-400 hover:text-orange-500"}`}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Slide
              </button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Content Package drawer */}
        <Sheet open={mobileContentOpen} onOpenChange={setMobileContentOpen}>
          <button
            onClick={() => setMobileContentOpen(true)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              isDark ? "border-[#2A2A2A] text-gray-300 hover:border-orange-500 hover:text-orange-400" : "border-gray-200 text-gray-700 hover:border-orange-400 hover:text-orange-500"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Content
            {assets && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
          </button>
          <SheetContent side="right" className={`w-full p-0 flex flex-col overflow-hidden ${isDark ? "bg-[#0F0F0F] border-[#2A2A2A]" : "bg-[#F9FAFB] border-gray-200"}`}>
            <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${isDark ? "border-[#2A2A2A]" : "border-gray-200"}`}>
              <span className={`text-sm font-semibold flex items-center gap-1.5 ${isDark ? "text-white" : "text-gray-900"}`}>
                <Sparkles className="w-3.5 h-3.5 text-orange-500" /> Content Package
              </span>
              <button onClick={() => setMobileContentOpen(false)} className={`p-1 rounded-lg ${isDark ? "text-gray-400 hover:bg-white/10" : "text-gray-500 hover:bg-black/5"}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ContentAssetsPanel
                bundleId={bundleId}
                bundleStyle={bundle?.style ?? "minimal-luxury"}
                bundleTitle={title}
                initialAssets={assets}
                isDark={isDark}
                onAssetsChange={(a) => setAssets(a)}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Add Slide */}
        <button
          onClick={addBlankSlide}
          className={`flex items-center gap-1 py-2.5 px-3 rounded-xl border text-sm font-medium transition-colors shrink-0 ${isDark ? "border-[#2A2A2A] text-gray-300 hover:border-orange-500 hover:text-orange-400" : "border-gray-200 text-gray-700 hover:border-orange-400 hover:text-orange-500"}`}
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      {/* Content Package tab — always mounted; always hidden on mobile (uses sheet instead); desktop: shown when activeTab==="content" */}
      <div className={`hidden ${activeTab === "content" ? "md:flex" : ""} flex-1 min-h-0 overflow-hidden ${isDark ? "bg-[#0F0F0F]" : "bg-[#F9FAFB]"}`}>
        <ContentAssetsPanel
          bundleId={bundleId}
          bundleStyle={bundle?.style ?? "minimal-luxury"}
          bundleTitle={title}
          initialAssets={assets}
          isDark={isDark}
          onAssetsChange={(a) => setAssets(a)}
        />
      </div>

      {/* Slides view — always visible on mobile (no tab switching); desktop: hidden when activeTab!=="slides" */}
      <div className={`flex flex-1 min-h-0 overflow-hidden ${activeTab !== "slides" ? "md:hidden" : ""}`}>

        {/* Slide navigator — desktop only (mobile uses sheet drawer) */}
        <div className={`hidden md:flex w-52 shrink-0 border-r flex-col overflow-y-auto ${panelCls}`}>
          <div className="p-2 space-y-2">
            {slides.map((slide, idx) => (
              <div
                key={slide.id}
                onClick={() => setActiveIdx(idx)}
                className={`group relative rounded-lg overflow-hidden cursor-pointer border-2 transition-colors ${activeIdx === idx ? "border-orange-500" : isDark ? "border-[#2A2A2A] hover:border-gray-600" : "border-gray-200 hover:border-gray-400"}`}
              >
                {/* Thumbnail */}
                <div style={{ width: thumbW, height: thumbH, position: "relative", overflow: "hidden", flexShrink: 0, margin: "0 auto" }}>
                  {slide.previewUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={slide.previewUrl} alt="" className="w-full h-full object-cover" />
                    : <SlidePreview data={slide.data} scale={thumbScale} />}
                </div>
                {/* Slide number */}
                <div className={`px-1.5 py-1 text-[10px] font-medium ${isDark ? "bg-[#111] text-gray-400" : "bg-gray-50 text-gray-500"}`}>
                  Slide {idx + 1}
                </div>
                {/* Hover actions */}
                <div className={`absolute top-1 right-1 hidden group-hover:flex flex-col gap-0.5`}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <button className="w-5 h-5 rounded bg-black/60 text-white flex items-center justify-center hover:bg-black/80">
                        <MoreHorizontal className="w-3 h-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="text-xs">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); moveSlide(idx, -1); }} disabled={idx === 0}>
                        <ChevronUp className="w-3.5 h-3.5 mr-1.5" /> Move Up
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); moveSlide(idx, 1); }} disabled={idx === slides.length - 1}>
                        <ChevronDown className="w-3.5 h-3.5 mr-1.5" /> Move Down
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicateSlide(idx); }}>
                        <Copy className="w-3.5 h-3.5 mr-1.5" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-500"
                        onClick={(e) => { e.stopPropagation(); deleteSlide(idx); }}
                        disabled={slides.length <= 1}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
            <button
              onClick={addBlankSlide}
              className={`w-full rounded-lg border-2 border-dashed flex items-center justify-center py-3 text-xs font-medium transition-colors ${isDark ? "border-[#2A2A2A] text-gray-600 hover:border-orange-500 hover:text-orange-500" : "border-gray-200 text-gray-400 hover:border-orange-400 hover:text-orange-500"}`}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Slide
            </button>
          </div>
        </div>

        {/* Center: active slide preview + actions */}
        <div ref={centerRef} className={`flex-1 flex flex-col items-center justify-center overflow-auto gap-4 sm:gap-6 p-4 sm:p-8 ${isDark ? "bg-[#151515]" : "bg-gray-100"}`}
          style={{ backgroundImage: isDark ? "radial-gradient(circle, #2A2A2A 1px, transparent 1px)" : "radial-gradient(circle, #d1d5db 1px, transparent 1px)", backgroundSize: "24px 24px" }}>

          {activeSlide ? (
            <>
              {/* Slide counter */}
              <div className="flex items-center gap-3">
                <button
                  disabled={activeIdx === 0}
                  onClick={() => setActiveIdx((i) => i - 1)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors disabled:opacity-30 ${isDark ? "border-[#2A2A2A] text-gray-400 hover:border-gray-500 hover:text-white" : "border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-900"}`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className={`text-sm font-medium ${dimCls}`}>
                  Slide {activeIdx + 1} of {slides.length}
                </span>
                <button
                  disabled={activeIdx === slides.length - 1}
                  onClick={() => setActiveIdx((i) => i + 1)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors disabled:opacity-30 ${isDark ? "border-[#2A2A2A] text-gray-400 hover:border-gray-500 hover:text-white" : "border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-900"}`}
                >
                  <ChevronLeft className="w-4 h-4 rotate-180" />
                </button>
              </div>

              {/* Preview */}
              <div style={{ width: previewW, height: previewH, boxShadow: "0 8px 48px rgba(0,0,0,0.3)", borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                <SlidePreview data={activeSlide.data} scale={previewScale} />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap justify-center px-2">
                <Button
                  size="sm"
                  onClick={() => router.push(`/dashboard/design-studio/${activeSlide.id}?bundle=${bundleId}`)}
                  className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit Slide
                </Button>
                <Button size="sm" variant="outline" onClick={() => duplicateSlide(activeIdx)} className={`gap-1.5 ${isDark ? "border-[#2A2A2A] text-gray-300 hover:text-white" : ""}`}>
                  <Copy className="w-3.5 h-3.5" /> Duplicate
                </Button>
                <Button size="sm" variant="outline" onClick={() => deleteSlide(activeIdx)} disabled={slides.length <= 1} className={`gap-1.5 text-red-500 hover:text-red-600 ${isDark ? "border-[#2A2A2A]" : ""}`}>
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </Button>
              </div>

              <p className={`text-xs ${dimCls}`}>{activeSlide.title}</p>
            </>
          ) : (
            <div className="text-center">
              <p className={`text-sm ${dimCls} mb-4`}>No slides yet.</p>
              <Button onClick={addBlankSlide} className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
                <Plus className="w-4 h-4" /> Add First Slide
              </Button>
            </div>
          )}
        </div>

        {/* Right info panel — desktop only (mobile uses sheet drawer) */}
        <div className={`hidden md:block w-56 shrink-0 border-l overflow-y-auto ${panelCls}`}>
          <div className="p-4 space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2 text-gray-400">Bundle Info</p>
              <div className="space-y-1.5">
                <div className={`flex justify-between text-xs ${dimCls}`}>
                  <span>Slides</span><span className="font-semibold">{slides.length}</span>
                </div>
                <div className={`flex justify-between text-xs ${dimCls}`}>
                  <span>Style</span><span className="font-semibold">{styleLabels[bundle?.style ?? ""] ?? bundle?.style ?? "—"}</span>
                </div>
                <div className={`flex justify-between text-xs ${dimCls}`}>
                  <span>Canvas</span>
                  <span className="font-semibold">{slides[0]?.data.width ?? 1080}×{slides[0]?.data.height ?? 1920}</span>
                </div>
              </div>
            </div>

            <div className={`h-px ${isDark ? "bg-[#2A2A2A]" : "bg-gray-100"}`} />

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2 text-gray-400">Content Package</p>
              <button
                onClick={() => setActiveTab("content")}
                className={`w-full text-left rounded-xl border p-3 flex items-start gap-2.5 transition-colors ${isDark ? "border-[#2A2A2A] hover:border-orange-500/50 hover:bg-orange-500/5" : "border-gray-200 hover:border-orange-300 hover:bg-orange-50"}`}
              >
                <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Captions + Hooks</p>
                  <p className={`text-[10px] mt-0.5 ${dimCls}`}>{assets ? "View your content package" : "Generate ready-to-post copy"}</p>
                </div>
              </button>
            </div>

            <div className={`h-px ${isDark ? "bg-[#2A2A2A]" : "bg-gray-100"}`} />

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2 text-gray-400">Generate More</p>
              <button
                onClick={() => router.push("/dashboard/design-studio/bulk")}
                className={`w-full text-left rounded-xl border p-3 flex items-start gap-2.5 transition-colors ${isDark ? "border-[#2A2A2A] hover:border-orange-500/50 hover:bg-orange-500/5" : "border-gray-200 hover:border-orange-300 hover:bg-orange-50"}`}
              >
                <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Zap className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Bulk Designer</p>
                  <p className={`text-[10px] mt-0.5 ${dimCls}`}>AI-generate a new batch of slides</p>
                </div>
              </button>
            </div>

            <div className={`h-px ${isDark ? "bg-[#2A2A2A]" : "bg-gray-100"}`} />

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2 text-gray-400">Export</p>
              <div className="space-y-2">
                <Button size="sm" variant="outline" onClick={exportAllAsZip} disabled={exportingZip || slides.length === 0} className={`w-full gap-1.5 text-xs ${isDark ? "border-[#2A2A2A] text-gray-300 hover:text-white" : ""}`}>
                  {exportingZip ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                  Download ZIP
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
