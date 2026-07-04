"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, ChevronLeft, Loader2, Trash2, Edit3, Download,
  Check, RefreshCw, ChevronRight, Zap, BookOpen, Lightbulb,
  X, Package, Link, CheckCircle2, AlertCircle, Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardTheme } from "@/components/dashboard-theme-provider";
import { DesignData } from "@/db/schema/designs-schema";
import { MarketingAssets } from "@/db/schema/products-schema";
import { buildSlideDesign, TEMPLATE_CONFIGS, TemplateStyle as EngineTemplateStyle } from "./layoutEngine";
import { SlidePreview } from "@/app/dashboard/design-studio/SlidePreview";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ContentRow = {
  id: string;
  hook: string;
  mainText: string;
  cta: string;
  bgTheme: string;
  productTitle?: string;
  isCta?: boolean;
};

type Platform = "instagram" | "tiktok-link" | "tiktok-nolink";
type CtaType = "automatic" | "link-in-bio" | "comment-keyword" | "visit-store" | "follow-for-more" | "custom";

type TemplateStyle = EngineTemplateStyle;
type Mode = "topic" | "products" | "url";

type UserProduct = {
  id: string;
  title: string;
  format: string;
  niche: string;
  marketingAssets: MarketingAssets | null;
  status: string;
};

// ── UI-only template metadata (labels, emojis, preview colours) ───────────────

type TemplateMeta = {
  label: string; description: string; emoji: string;
  previewBg: string; previewText: string; previewAccent: string;
};

const TEMPLATE_META: Record<TemplateStyle, TemplateMeta> = {
  // ── Original 6 ──────────────────────────────────────────────────────────────
  "minimal-luxury":    { label: "Minimal Luxury",      description: "Clean, elegant, premium",            emoji: "✨", previewBg: "#FAFAF7",                              previewText: "#1A1A1A", previewAccent: "#C9A84C" },
  "dark-aesthetic":    { label: "Dark Aesthetic",      description: "Bold, edgy, raw",                    emoji: "🖤", previewBg: "#0D0D0D",                              previewText: "#FFFFFF", previewAccent: "#FF6B35" },
  "wellness":          { label: "Wellness",             description: "Calm, nurturing, natural",            emoji: "🌿", previewBg: "linear-gradient(160deg,#E8F0E8,#C5DBC5)", previewText: "#2D5016", previewAccent: "#5C9A3E" },
  "clean-productivity":{ label: "Clean Productivity",  description: "Clear, actionable, focused",          emoji: "⚡", previewBg: "#FFFFFF",                              previewText: "#1E3A5F", previewAccent: "#3B82F6" },
  "faceless-creator":  { label: "Faceless Creator",    description: "Mysterious, viral, relatable",        emoji: "🎭", previewBg: "linear-gradient(135deg,#1a1a2e,#16213e)", previewText: "#FFFFFF", previewAccent: "#E94560" },
  "modern-business":   { label: "Modern Business",     description: "Professional, confident, results",    emoji: "💼", previewBg: "#1E3A5F",                              previewText: "#FFFFFF", previewAccent: "#F59E0B" },
  // ── New 8 ───────────────────────────────────────────────────────────────────
  "viral-storytelling":{ label: "Viral Storytelling",  description: "Cinematic, emotional, curiosity-driven", emoji: "🎬", previewBg: "linear-gradient(160deg,#1A1208,#0E0B05)", previewText: "#F5EFE0", previewAccent: "#E8A44A" },
  "aggressive-viral":  { label: "Aggressive Viral",    description: "Fast, bold, high-energy",            emoji: "🔥", previewBg: "#050000",                              previewText: "#FFFFFF", previewAccent: "#FF2D00" },
  "educational-pro":   { label: "Educational Pro",     description: "Structured, swipe-worthy, saveable", emoji: "📚", previewBg: "#FFFFFF",                              previewText: "#0F172A", previewAccent: "#6366F1" },
  "soft-feminine":     { label: "Soft Feminine",       description: "Elegant, aesthetic, calming",         emoji: "🌸", previewBg: "linear-gradient(155deg,#FAF0F5,#F0E0EB)", previewText: "#3D1F3A", previewAccent: "#C97BB2" },
  "tech-minimal":      { label: "Tech Minimal",        description: "Modern AI/startup aesthetic",         emoji: "🤖", previewBg: "linear-gradient(145deg,#0A0E1A,#060910)", previewText: "#F0F9FF", previewAccent: "#22D3EE" },
  "luxury-editorial":  { label: "Luxury Editorial",    description: "Magazine-inspired premium design",    emoji: "🗞️", previewBg: "#FAF7F2",                              previewText: "#1A1008", previewAccent: "#8B7355" },
  "chaos-raw":         { label: "Chaos / Raw",         description: "Messy, authentic, internet-native",  emoji: "✏️", previewBg: "#FFFFFF",                              previewText: "#0A0A0A", previewAccent: "#FFD60A" },
  "quote-focus-style": { label: "Quote Focus",         description: "Minimal, emotional, impactful",      emoji: "💬", previewBg: "#FDFCF9",                              previewText: "#1A1A1A", previewAccent: "#C4A86A" },
};

// ── Constants ─────────────────────────────────────────────────────────────────

const TOPIC_SUGGESTIONS = [
  "Wellness tips for busy moms", "Faceless business motivation",
  "Productivity hacks", "Skincare advice", "TikTok Shop product tips",
  "Morning routine habits", "Digital product creator tips",
  "Mindset shifts for success", "Fitness motivation", "Financial freedom tips",
];

const TONES = ["Inspirational", "Educational", "Promotional", "Casual", "Urgent"] as const;
type Tone = typeof TONES[number];

const COUNT_OPTIONS = [10, 20, 30];

const FORMAT_LABELS: Record<string, string> = {
  ebook: "eBook", workbook: "Workbook", checklist: "Checklist",
  guide: "Guide", planner: "Planner", journal: "Journal",
  spreadsheet: "Spreadsheet", notion: "Notion Template",
};

// ── Mini preview card ─────────────────────────────────────────────────────────

const PREVIEW_SCALE = 0.175;

// Canvas format options — determines exported PNG dimensions
export const CANVAS_FORMATS = [
  { label: "Carousel", sublabel: "1080×1350", height: 1350, ratio: 4 / 5 },
  { label: "Square",   sublabel: "1080×1080", height: 1080, ratio: 1 },
  { label: "Story",    sublabel: "1080×1920", height: 1920, ratio: 9 / 16 },
] as const;
export type CanvasFormatHeight = typeof CANVAS_FORMATS[number]["height"];

function PostPreview({ post, design, index, onDelete, onEdit, onQuickEdit, isDark }: {
  post: ContentRow; design: DesignData; index: number;
  onDelete: () => void; onEdit: () => void; onQuickEdit: () => void; isDark: boolean;
}) {
  const previewW = Math.round((design.width ?? 1080) * PREVIEW_SCALE);
  const previewH = Math.round((design.height ?? 1350) * PREVIEW_SCALE);

  return (
    <div className={`group rounded-xl overflow-hidden border ${isDark ? "border-white/10 bg-[#1A1A1A]" : "border-gray-200 bg-white"} shadow-sm hover:shadow-md transition-shadow`}>
      <div style={{ width: previewW, height: previewH, overflow: "hidden", position: "relative" }}>
        <SlidePreview data={design} scale={PREVIEW_SCALE} />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
          <button onClick={onQuickEdit} className="bg-white text-gray-900 rounded-lg px-2 py-1.5 text-[10px] font-semibold flex items-center gap-1 hover:bg-orange-500 hover:text-white transition-colors">
            <Edit3 className="w-2.5 h-2.5" /> Quick Edit
          </button>
          <button onClick={onEdit} className="bg-white text-gray-900 rounded-lg px-2 py-1.5 text-[10px] font-semibold flex items-center gap-1 hover:bg-blue-500 hover:text-white transition-colors">
            <Zap className="w-2.5 h-2.5" /> Full Edit
          </button>
          <button onClick={onDelete} className="bg-white text-red-500 rounded-lg p-1.5 flex items-center hover:bg-red-500 hover:text-white transition-colors">
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
      <div className={`px-2.5 py-2 border-t ${isDark ? "border-white/10" : "border-gray-100"}`}>
        <div className="flex items-center gap-1.5">
          <p className={`text-[10px] font-semibold truncate flex-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            {post.productTitle ? `${post.productTitle}` : `Post ${index + 1}`}
          </p>
          {post.isCta && (
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-orange-500/20 text-orange-400">CTA</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Quick Edit Modal ──────────────────────────────────────────────────────────

function QuickEditModal({ post, isDark, onSave, onClose }: {
  post: ContentRow; isDark: boolean;
  onSave: (updated: ContentRow) => void; onClose: () => void;
}) {
  const [hook, setHook] = useState(post.hook);
  const [mainText, setMainText] = useState(post.mainText);
  const [cta, setCta] = useState(post.cta);

  const inputCls = `w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500 resize-none ${
    isDark ? "bg-[#0F0F0F] border-white/10 text-white placeholder-gray-600" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"
  }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className={`rounded-2xl border w-full max-w-md shadow-2xl ${isDark ? "bg-[#1A1A1A] border-white/10" : "bg-white border-gray-200"}`}>
        <div className={`flex items-center justify-between p-4 border-b ${isDark ? "border-white/10" : "border-gray-100"}`}>
          <h3 className="text-sm font-bold">Quick Edit Post</h3>
          <button onClick={onClose} className={`p-1 rounded-lg ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"}`}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Hook (ALL CAPS headline)</label>
            <textarea rows={2} value={hook} onChange={(e) => setHook(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Main Text (body copy)</label>
            <textarea rows={4} value={mainText} onChange={(e) => setMainText(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>CTA (call to action)</label>
            <textarea rows={2} value={cta} onChange={(e) => setCta(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className={`flex gap-2 p-4 border-t ${isDark ? "border-white/10" : "border-gray-100"}`}>
          <Button variant="outline" size="sm" onClick={onClose} className={`flex-1 ${isDark ? "border-white/10 text-gray-300" : ""}`}>Cancel</Button>
          <Button size="sm" onClick={() => onSave({ ...post, hook, mainText, cta })} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white">Save Changes</Button>
        </div>
      </div>
    </div>
  );
}

// ── Product picker card ───────────────────────────────────────────────────────

function ProductCard({ product, selected, onToggle, isDark }: {
  product: UserProduct; selected: boolean; onToggle: () => void; isDark: boolean;
}) {
  const thumb = product.marketingAssets?.thumbnailUrl ?? product.marketingAssets?.coverThumbnailUrl;
  return (
    <button onClick={onToggle} className={`relative rounded-xl border-2 p-3 text-left transition-all w-full ${
      selected ? "border-orange-500 ring-2 ring-orange-500/20" : isDark ? "border-white/10 hover:border-white/30" : "border-gray-200 hover:border-gray-300"
    }`}>
      <div className={`w-full h-20 rounded-lg mb-2.5 overflow-hidden flex items-center justify-center ${isDark ? "bg-[#0F0F0F]" : "bg-gray-100"}`}>
        {thumb
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={thumb} alt={product.title} className="w-full h-full object-cover" />
          : <BookOpen className={`w-8 h-8 ${isDark ? "text-gray-600" : "text-gray-300"}`} />}
      </div>
      <p className="text-xs font-semibold leading-tight line-clamp-2 mb-1">{product.title}</p>
      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${isDark ? "bg-white/10 text-gray-400" : "bg-gray-100 text-gray-500"}`}>
        {FORMAT_LABELS[product.format] ?? product.format}
      </span>
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
    </button>
  );
}

// ── Export All as ZIP ─────────────────────────────────────────────────────────

async function exportAllAsZip(
  posts: ContentRow[],
  designs: DesignData[],
  batchLabel: string,
): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const { toPng } = await import("html-to-image");
  const { createRoot } = await import("react-dom/client");
  const zip = new JSZip();

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const design = designs[i];
    const W = design.width;
    const H = design.height;

    const container = document.createElement("div");
    container.style.cssText = `position:fixed;left:-9999px;top:0;width:${W}px;height:${H}px;overflow:hidden;z-index:-1`;
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(React.createElement(SlidePreview, { data: design, scale: 1 }));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 200));

    try {
      const dataUrl = await toPng(container.firstElementChild as HTMLElement, { pixelRatio: 2, width: W, height: H });
      const base64 = dataUrl.split(",")[1];
      const fileName = post.productTitle
        ? `${post.productTitle.replace(/[^a-z0-9]/gi, "-")}-post-${i + 1}.png`
        : `${batchLabel.replace(/[^a-z0-9]/gi, "-")}-post-${i + 1}.png`;
      zip.file(fileName, base64, { base64: true });
    } finally {
      root.unmount();
      document.body.removeChild(container);
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `${batchLabel.replace(/[^a-z0-9]/gi, "-")}-posts.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main component ────────────────────────────────────────────────────────────

export function BulkContentDesigner() {
  const router = useRouter();
  const { theme } = useDashboardTheme();
  const isDark = theme === "dark";

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<Mode>("topic");
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState("");
  const [tone, setTone] = useState<Tone>("Inspirational");
  const [style, setStyle] = useState<TemplateStyle>("minimal-luxury");
  const [canvasFormatHeight, setCanvasFormatHeight] = useState<CanvasFormatHeight>(1350);
  const [count, setCount] = useState(10);
  const [posts, setPosts] = useState<ContentRow[]>([]);
  const [postDesigns, setPostDesigns] = useState<DesignData[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [bundleId, setBundleId] = useState<string | null>(null);
  const [exportingZip, setExportingZip] = useState(false);
  const [editingPost, setEditingPost] = useState<ContentRow | null>(null);

  // Products mode
  const [products, setProducts] = useState<UserProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  // URL mode
  const [urlInput, setUrlInput] = useState("");
  const [urlScraped, setUrlScraped] = useState<{ title: string; description: string; excerpt: string } | null>(null);
  const [urlScraping, setUrlScraping] = useState(false);
  const [urlScrapeError, setUrlScrapeError] = useState<string | null>(null);

  // CTA settings
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [ctaType, setCtaType] = useState<CtaType>("automatic");
  const [ctaKeyword, setCtaKeyword] = useState("");
  const [ctaCustom, setCtaCustom] = useState("");

  const containerCls = isDark ? "bg-[#0F0F0F] text-white" : "bg-[#F9FAFB] text-gray-900";
  const cardCls = isDark ? "bg-[#1A1A1A] border-white/10" : "bg-white border-gray-200";

  useEffect(() => {
    if (mode !== "products" || products.length > 0) return;
    setProductsLoading(true);
    fetch("/api/products")
      .then((r) => r.json())
      .then((d: { products?: UserProduct[] }) => setProducts(d.products?.filter((p) => p.status !== "failed") ?? []))
      .finally(() => setProductsLoading(false));
  }, [mode, products.length]);

  function toggleProduct(id: string) {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const canGenerate = mode === "topic"
    ? topic.trim().length > 0
    : mode === "url"
    ? urlScraped !== null
    : selectedProductIds.size > 0;

  const batchLabel = mode === "products"
    ? `${selectedProductIds.size} product${selectedProductIds.size !== 1 ? "s" : ""}`
    : mode === "url"
    ? urlScraped?.title || urlInput || "URL"
    : topic;

  async function scrapeUrl() {
    if (!urlInput.trim()) return;
    setUrlScraping(true);
    setUrlScrapeError(null);
    setUrlScraped(null);
    try {
      const res = await fetch("/api/scrape-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const json = await res.json() as { title?: string; description?: string; excerpt?: string; error?: string };
      if (!res.ok) { setUrlScrapeError(json.error ?? "Could not fetch that URL"); return; }
      setUrlScraped({ title: json.title ?? "", description: json.description ?? "", excerpt: json.excerpt ?? "" });
    } catch {
      setUrlScrapeError("Network error — please try again.");
    } finally {
      setUrlScraping(false);
    }
  }

  async function generate() {
    if (!canGenerate) return;
    setGenerating(true);
    setGenError(null);
    try {
      const body: Record<string, unknown> = { style, count, tone, niche, platform, ctaType, ctaKeyword, ctaCustom };
      if (mode === "products") {
        const selected = products.filter((p) => selectedProductIds.has(p.id));
        body.products = selected.map((p) => ({
          title: p.title, format: p.format, niche: p.niche,
          description: p.marketingAssets?.productDescription ?? "",
        }));
      } else if (mode === "url" && urlScraped) {
        const parts = [
          urlScraped.title,
          urlScraped.description,
          urlScraped.excerpt,
        ].filter(Boolean);
        body.topic = parts.join(". ").slice(0, 800);
      } else {
        body.topic = topic;
      }
      const res = await fetch("/api/designs/bulk-generate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json() as { posts?: ContentRow[]; error?: string };
      if (!res.ok) { setGenError(json.error ?? "Generation failed"); return; }
      const newPosts = (json.posts ?? []).map((p, i) => ({
        ...p, id: `post-${i}-${Date.now()}`,
        hook: p.hook ?? "", mainText: p.mainText ?? "", cta: p.cta ?? "", bgTheme: p.bgTheme ?? "light",
      }));
      // Compute layout-varied designs immediately — one pass, carousel-aware
      const usedLayouts: string[] = [];
      const newDesigns = newPosts.map((post, idx) => {
        const { data, layoutId } = buildSlideDesign(post, style, idx, newPosts.length, usedLayouts, canvasFormatHeight);
        usedLayouts.push(layoutId);
        return data;
      });
      setPosts(newPosts);
      setPostDesigns(newDesigns);
      setStep(2);
    } catch { setGenError("Network error — please try again."); }
    finally { setGenerating(false); }
  }

  async function saveAsBundle() {
    if (posts.length === 0) return;
    setSaving(true); setSaveError(null);
    try {
      const bundleTitle = mode === "products"
        ? `Products — ${new Date().toLocaleDateString()}`
        : `${topic} — ${new Date().toLocaleDateString()}`;
      const slides = posts.map((post, idx) => ({
        title: post.productTitle ? `${post.productTitle} — Slide ${idx + 1}` : `${batchLabel} — Slide ${idx + 1}`,
        data: postDesigns[idx] ?? buildSlideDesign(post, style, idx, posts.length, [], canvasFormatHeight).data,
      }));
      const res = await fetch("/api/design-bundles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: bundleTitle, style, slides }),
      });
      const json = await res.json() as { bundle?: { id: string }; error?: string };
      if (!res.ok || !json.bundle?.id) {
        setSaveError(json.error ?? "Failed to save bundle. Please try again.");
        return;
      }
      setSavedCount(slides.length);
      setBundleId(json.bundle.id);
      setStep(3);
    } catch (err) {
      console.error("[saveAsBundle]", err);
      setSaveError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveAndEdit(post: ContentRow, index: number) {
    const label = post.productTitle ? `${post.productTitle} — Post ${index + 1}` : `${batchLabel} — Post ${index + 1}`;
    const data = postDesigns[index] ?? buildSlideDesign(post, style, index, posts.length, [], canvasFormatHeight).data;
    const res = await fetch("/api/designs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: label, data }),
    });
    const json = await res.json() as { design?: { id: string } };
    if (json.design?.id) router.push(`/dashboard/design-studio/${json.design.id}`);
  }

  function updatePost(updated: ContentRow) {
    setPosts((prev) => {
      const newPosts = prev.map((p) => p.id === updated.id ? updated : p);
      // Recompute design for the edited slide preserving same position
      const idx = newPosts.findIndex((p) => p.id === updated.id);
      if (idx >= 0) {
        setPostDesigns((prevDesigns) => {
          const next = [...prevDesigns];
          const usedBefore = next.slice(0, idx).map((d) => d.presetName ?? "");
          next[idx] = buildSlideDesign(updated, style, idx, newPosts.length, usedBefore, canvasFormatHeight).data;
          return next;
        });
      }
      return newPosts;
    });
    setEditingPost(null);
  }

  async function handleExportZip() {
    setExportingZip(true);
    try { await exportAllAsZip(posts, postDesigns, batchLabel); }
    finally { setExportingZip(false); }
  }

  const bgHeader = isDark
    ? "bg-gradient-to-r from-orange-500/20 to-purple-500/20 border-b border-white/10"
    : "bg-gradient-to-r from-orange-50 to-purple-50 border-b border-gray-200";

  return (
    <div className={`flex flex-col min-h-full ${containerCls}`}>
      {editingPost && (
        <QuickEditModal post={editingPost} isDark={isDark} onSave={updatePost} onClose={() => setEditingPost(null)} />
      )}

      {/* Header */}
      <div className={`${bgHeader} px-6 py-5`}>
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <button onClick={() => router.push("/dashboard/design-studio")} className={`flex items-center gap-1.5 text-sm ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}>
            <ChevronLeft className="w-4 h-4" /> Design Studio
          </button>
          <div className={`h-4 w-px ${isDark ? "bg-white/20" : "bg-gray-300"}`} />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold">Bulk Content Designer</h1>
              <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>Generate branded social posts from AI content</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {([1, 2, 3] as const).map((s) => (
              <React.Fragment key={s}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s ? "bg-orange-500 text-white" : step > s ? "bg-emerald-500 text-white" : isDark ? "bg-white/10 text-gray-500" : "bg-gray-200 text-gray-400"
                }`}>{step > s ? <Check className="w-3 h-3" /> : s}</div>
                {s < 3 && <div className={`w-8 h-px ${isDark ? "bg-white/10" : "bg-gray-300"}`} />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">What are you creating posts about?</h2>
                <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>AI generates {count} branded posts, ready to publish or edit</p>
              </div>

              {/* Mode toggle */}
              <div className={`rounded-2xl border p-2 flex gap-2 ${cardCls}`}>
                <button onClick={() => setMode("topic")} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  mode === "topic" ? "bg-orange-500 text-white" : isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
                }`}>
                  <Lightbulb className="w-4 h-4" /> Topic or Niche
                </button>
                <button onClick={() => setMode("products")} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  mode === "products" ? "bg-orange-500 text-white" : isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
                }`}>
                  <BookOpen className="w-4 h-4" /> My Products
                </button>
                <button onClick={() => setMode("url")} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  mode === "url" ? "bg-orange-500 text-white" : isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
                }`}>
                  <Link className="w-4 h-4" /> From URL
                </button>
              </div>

              {/* Topic mode */}
              {mode === "topic" && (
                <div className={`rounded-2xl border p-6 space-y-4 ${cardCls}`}>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Topic or niche</label>
                    <input value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && canGenerate) generate(); }}
                      placeholder="e.g. Wellness tips for busy moms"
                      className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500 ${isDark ? "bg-[#0F0F0F] border-white/10 text-white placeholder-gray-600" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"}`}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {TOPIC_SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => setTopic(s)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${topic === s ? "border-orange-500 bg-orange-500/10 text-orange-500" : isDark ? "border-white/10 text-gray-400 hover:border-orange-500/50" : "border-gray-200 text-gray-500 hover:border-orange-300"}`}>{s}</button>
                    ))}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Target audience <span className={`font-normal ${isDark ? "text-gray-500" : "text-gray-400"}`}>(optional)</span></label>
                    <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g. busy moms, Gen Z women, small business owners"
                      className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500 ${isDark ? "bg-[#0F0F0F] border-white/10 text-white placeholder-gray-600" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"}`}
                    />
                  </div>
                </div>
              )}

              {/* Products mode */}
              {mode === "products" && (
                <div className={`rounded-2xl border p-6 space-y-4 ${cardCls}`}>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold">Select your products</label>
                    {selectedProductIds.size > 0 && <span className="text-xs text-orange-500 font-semibold">{selectedProductIds.size} selected · ~{Math.ceil(count / selectedProductIds.size)} posts each</span>}
                  </div>
                  {productsLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-orange-500" /></div>
                  ) : products.length === 0 ? (
                    <div className="text-center py-8">
                      <Package className={`w-10 h-10 mx-auto mb-3 ${isDark ? "text-gray-600" : "text-gray-300"}`} />
                      <p className={`text-sm font-medium mb-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>No products yet</p>
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => router.push("/dashboard/library")}>Go to My Library</Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                      {products.map((p) => <ProductCard key={p.id} product={p} selected={selectedProductIds.has(p.id)} onToggle={() => toggleProduct(p.id)} isDark={isDark} />)}
                    </div>
                  )}
                </div>
              )}

              {/* URL mode */}
              {mode === "url" && (
                <div className={`rounded-2xl border p-6 space-y-4 ${cardCls}`}>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Paste a URL</label>
                    <p className={`text-xs mb-3 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Product page, blog post, Gumroad listing — we&apos;ll scrape it and generate posts based on what we find.</p>
                    <div className="flex gap-2">
                      <input
                        value={urlInput}
                        onChange={(e) => { setUrlInput(e.target.value); setUrlScraped(null); setUrlScrapeError(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter") scrapeUrl(); }}
                        placeholder="https://yourproduct.gumroad.com/l/…"
                        className={`flex-1 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500 ${isDark ? "bg-[#0F0F0F] border-white/10 text-white placeholder-gray-600" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"}`}
                      />
                      <button
                        onClick={scrapeUrl}
                        disabled={!urlInput.trim() || urlScraping}
                        className="shrink-0 px-4 py-3 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {urlScraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                        {urlScraping ? "Fetching…" : "Fetch"}
                      </button>
                    </div>
                  </div>

                  {urlScrapeError && (
                    <div className="flex items-start gap-2 text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p className="text-sm">{urlScrapeError}</p>
                    </div>
                  )}

                  {urlScraped && (
                    <div className={`rounded-xl border p-4 space-y-2 ${isDark ? "bg-emerald-500/5 border-emerald-500/20" : "bg-emerald-50 border-emerald-200"}`}>
                      <div className="flex items-center gap-2 text-emerald-500">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-xs font-semibold">Page fetched — ready to generate</span>
                      </div>
                      {urlScraped.title && (
                        <p className="text-sm font-semibold truncate">{urlScraped.title}</p>
                      )}
                      {urlScraped.description && (
                        <p className={`text-xs line-clamp-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>{urlScraped.description}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tone */}
              <div className={`rounded-2xl border p-6 space-y-3 ${cardCls}`}>
                <label className="block text-sm font-semibold">Tone</label>
                <div className="flex flex-wrap gap-2">
                  {TONES.map((t) => (
                    <button key={t} onClick={() => setTone(t)} className={`px-4 py-2 rounded-xl border-2 text-sm font-medium transition-colors ${tone === t ? "border-orange-500 bg-orange-500 text-white" : isDark ? "border-white/10 text-gray-300 hover:border-orange-500/50" : "border-gray-200 text-gray-700 hover:border-orange-300"}`}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Style picker */}
              <div className={`rounded-2xl border p-6 space-y-4 ${cardCls}`}>
                <label className="block text-sm font-semibold">Template style</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(Object.entries(TEMPLATE_META) as [TemplateStyle, TemplateMeta][]).map(([key, meta]) => {
                    const fonts = TEMPLATE_CONFIGS[key];
                    return (
                      <button key={key} onClick={() => setStyle(key)} className={`relative rounded-xl border-2 p-3 text-left transition-all ${style === key ? "border-orange-500 ring-2 ring-orange-500/20" : isDark ? "border-white/10 hover:border-white/30" : "border-gray-200 hover:border-gray-300"}`}>
                        <div className="w-full h-14 rounded-lg mb-2.5 flex items-center justify-center overflow-hidden" style={{ background: meta.previewBg }}>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ color: meta.previewText, fontSize: 9, fontWeight: "bold", fontFamily: fonts.hookFont, lineHeight: 1.2 }}>HOOK TEXT</div>
                            <div style={{ color: meta.previewAccent, fontSize: 7, marginTop: 2, fontFamily: fonts.bodyFont }}>→ CTA here</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{meta.emoji}</span>
                          <div>
                            <p className="text-xs font-semibold leading-tight">{meta.label}</p>
                            <p className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>{meta.description}</p>
                          </div>
                        </div>
                        {style === key && <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Canvas format */}
              <div className={`rounded-2xl border p-6 space-y-3 ${cardCls}`}>
                <div>
                  <label className="block text-sm font-semibold">Canvas format</label>
                  <p className={`text-xs mt-0.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Sets the exported PNG dimensions. Carousel (4:5) is optimised for Instagram feed posts.</p>
                </div>
                <div className="flex gap-3">
                  {CANVAS_FORMATS.map((fmt) => (
                    <button
                      key={fmt.height}
                      onClick={() => setCanvasFormatHeight(fmt.height as CanvasFormatHeight)}
                      className={`flex-1 rounded-xl border-2 py-3 px-3 flex flex-col items-center gap-1 transition-colors ${
                        canvasFormatHeight === fmt.height
                          ? "border-orange-500 bg-orange-500 text-white"
                          : isDark
                          ? "border-white/10 text-gray-300 hover:border-orange-500/50"
                          : "border-gray-200 text-gray-700 hover:border-orange-300"
                      }`}
                    >
                      {/* Aspect ratio thumbnail */}
                      <div
                        className={`rounded border ${canvasFormatHeight === fmt.height ? "border-white/40 bg-white/20" : isDark ? "border-white/20 bg-white/5" : "border-gray-300 bg-gray-100"}`}
                        style={{ width: 24, height: Math.round(24 / fmt.ratio) }}
                      />
                      <span className="text-xs font-bold leading-tight">{fmt.label}</span>
                      <span className={`text-[10px] leading-none ${canvasFormatHeight === fmt.height ? "text-white/70" : isDark ? "text-gray-500" : "text-gray-400"}`}>{fmt.sublabel}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto layout info */}
              <div className={`rounded-2xl border p-4 flex items-start gap-3 ${cardCls}`}>
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Dynamic Layout Engine</p>
                  <p className={`text-xs mt-0.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Each slide gets a unique layout based on its content and position in the carousel — hooks, body slides, and CTAs each get the right treatment automatically.</p>
                </div>
              </div>

              {/* Count */}
              <div className={`rounded-2xl border p-6 space-y-3 ${cardCls}`}>
                <label className="block text-sm font-semibold">How many posts?</label>
                <div className="flex gap-3">
                  {COUNT_OPTIONS.map((n) => (
                    <button key={n} onClick={() => setCount(n)} className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-colors ${count === n ? "border-orange-500 bg-orange-500 text-white" : isDark ? "border-white/10 text-gray-300 hover:border-orange-500/50" : "border-gray-200 text-gray-700 hover:border-orange-300"}`}>{n} posts</button>
                  ))}
                </div>
              </div>

              {/* CTA Settings */}
              <div className={`rounded-2xl border p-6 space-y-4 ${cardCls}`}>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Megaphone className="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">CTA Settings</p>
                    <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>A platform-optimised CTA slide is auto-appended to every carousel</p>
                  </div>
                </div>

                {/* Platform */}
                <div>
                  <label className="block text-xs font-semibold mb-2">Publishing platform</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: "instagram", label: "Instagram", sub: "Link in Bio" },
                      { value: "tiktok-link", label: "TikTok", sub: "Has link" },
                      { value: "tiktok-nolink", label: "TikTok", sub: "No link" },
                    ] as { value: Platform; label: string; sub: string }[]).map((p) => (
                      <button
                        key={p.value}
                        onClick={() => {
                          setPlatform(p.value);
                          if (p.value === "tiktok-nolink" && ctaType === "link-in-bio") setCtaType("comment-keyword");
                          if (p.value === "tiktok-nolink" && ctaType === "visit-store") setCtaType("comment-keyword");
                        }}
                        className={`flex flex-col items-center py-2.5 px-2 rounded-xl border-2 text-xs font-semibold transition-colors ${
                          platform === p.value ? "border-orange-500 bg-orange-500/10 text-orange-500" : isDark ? "border-white/10 text-gray-400 hover:border-white/30" : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        <span>{p.label}</span>
                        <span className={`text-[9px] font-normal mt-0.5 ${platform === p.value ? "text-orange-400" : isDark ? "text-gray-600" : "text-gray-400"}`}>{p.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* CTA Type */}
                <div>
                  <label className="block text-xs font-semibold mb-2">CTA type</label>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { value: "automatic", label: "Automatic" },
                      ...(platform !== "tiktok-nolink" ? [{ value: "link-in-bio", label: "Link in Bio" }] : []),
                      { value: "comment-keyword", label: "Comment Keyword" },
                      ...(platform !== "tiktok-nolink" ? [{ value: "visit-store", label: "Visit Store" }] : []),
                      { value: "follow-for-more", label: "Follow for More" },
                      { value: "custom", label: "Custom" },
                    ] as { value: CtaType; label: string }[]).map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setCtaType(t.value)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${ctaType === t.value ? "border-orange-500 bg-orange-500/10 text-orange-500" : isDark ? "border-white/10 text-gray-400 hover:border-white/30" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Keyword field (comment-keyword) */}
                {ctaType === "comment-keyword" && (
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Comment keyword</label>
                    <input
                      value={ctaKeyword}
                      onChange={(e) => setCtaKeyword(e.target.value)}
                      placeholder="e.g. GUIDE, LINK, FREE"
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500 ${isDark ? "bg-[#0F0F0F] border-white/10 text-white placeholder-gray-600" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"}`}
                    />
                    <p className={`text-xs mt-1 ${isDark ? "text-gray-600" : "text-gray-400"}`}>e.g. &ldquo;Comment &apos;GUIDE&apos; and I&apos;ll DM you the link&rdquo;</p>
                  </div>
                )}

                {/* Custom CTA text */}
                {ctaType === "custom" && (
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Custom CTA text</label>
                    <input
                      value={ctaCustom}
                      onChange={(e) => setCtaCustom(e.target.value)}
                      placeholder="e.g. DM me 'START' to join the waitlist"
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500 ${isDark ? "bg-[#0F0F0F] border-white/10 text-white placeholder-gray-600" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"}`}
                    />
                  </div>
                )}
              </div>

              {genError && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{genError}</p>}

              <Button disabled={!canGenerate || generating} onClick={generate} className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold gap-2 text-base rounded-xl">
                {generating ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating {count} posts…</> : <><Sparkles className="w-5 h-5" /> Generate {count} Posts</>}
              </Button>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-xl font-bold">{posts.length} posts generated</h2>
                  <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    {TEMPLATE_META[style].label} · {CANVAS_FORMATS.find((f) => f.height === canvasFormatHeight)?.sublabel ?? `1080×${canvasFormatHeight}`} · {tone}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => { setStep(1); setGenError(null); }} className={`gap-1.5 ${isDark ? "border-white/10 text-gray-300 hover:text-white" : ""}`}>
                    <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportZip} disabled={exportingZip || posts.length === 0} className={`gap-1.5 ${isDark ? "border-white/10 text-gray-300 hover:text-white" : ""}`}>
                    {exportingZip ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Exporting…</> : <><Package className="w-3.5 h-3.5" /> Export All as ZIP</>}
                  </Button>
                  <Button size="sm" onClick={saveAsBundle} disabled={saving || posts.length === 0} className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5">
                    {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Download className="w-3.5 h-3.5" /> Save as Bundle</>}
                  </Button>
                </div>
              </div>
              {saveError && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {posts.map((post, i) => (
                  <PostPreview key={post.id} post={post} design={postDesigns[i] ?? { width: 1080, height: canvasFormatHeight, background: "#fff", elements: [] }} index={i} isDark={isDark}
                    onDelete={() => { setPosts((prev) => prev.filter((p) => p.id !== post.id)); setPostDesigns((prev) => prev.filter((_, di) => di !== i)); }}
                    onQuickEdit={() => setEditingPost(post)}
                    onEdit={() => saveAndEdit(post, i)}
                  />
                ))}
              </div>

              {posts.length === 0 && (
                <div className="text-center py-16">
                  <p className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>All posts removed.</p>
                  <Button variant="outline" size="sm" onClick={() => setStep(1)} className="mt-4">Start over</Button>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <div className="max-w-md mx-auto text-center py-16 space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
                <Check className="w-10 h-10 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Bundle saved!</h2>
                <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  {savedCount} slides saved as one connected bundle. Open the bundle to reorder slides, edit individual posts, or export everything as a ZIP.
                </p>
              </div>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button variant="outline" onClick={() => { setStep(1); setPosts([]); setPostDesigns([]); setTopic(""); setSavedCount(0); setBundleId(null); setSelectedProductIds(new Set()); setUrlInput(""); setUrlScraped(null); setUrlScrapeError(null); setPlatform("instagram"); setCtaType("automatic"); setCtaKeyword(""); setCtaCustom(""); }} className={isDark ? "border-white/10 text-gray-300 hover:text-white" : ""}>
                  <RefreshCw className="w-4 h-4 mr-2" /> New Batch
                </Button>
                {bundleId ? (
                  <Button onClick={() => router.push(`/dashboard/design-studio/bundle/${bundleId}`)} className="bg-orange-500 hover:bg-orange-600 text-white">
                    Open Bundle <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button onClick={() => router.push("/dashboard/design-studio")} className="bg-orange-500 hover:bg-orange-600 text-white">
                    View in Design Studio <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
