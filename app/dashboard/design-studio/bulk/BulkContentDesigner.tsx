"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, ChevronLeft, Loader2, Trash2, Edit3, Download,
  Check, RefreshCw, ChevronRight, Zap, BookOpen, Lightbulb,
  X, Package, Link, CheckCircle2, AlertCircle, Megaphone,
  BarChart2, Star, RefreshCcw, Trophy,
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

type Platform = "instagram" | "tiktok-link" | "tiktok-nolink"; // legacy (kept for API compat)
type CtaType = "automatic" | "link-in-bio" | "comment-keyword" | "visit-store" | "follow-for-more" | "custom";
type CtaStrategy = "ai" | "manual";
type PlatformId = "instagram" | "tiktok-link" | "tiktok-comment" | "linkedin" | "pinterest" | "facebook" | "twitter" | "threads";

type PlatformCfg = { ctaType: CtaType; ctaKeyword: string; ctaCustom: string };

type PlatformOutput = {
  platformId: string;
  caption: string;
  hashtags: string[];
  ctaSlide: ContentRow | null;
  ctaSlideDesign: DesignData | null;
};

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

const COUNT_OPTIONS = [5, 7, 10, 15];

// ── Carousel types ────────────────────────────────────────────────────────────

const CAROUSEL_TYPES = [
  { id: "viral-tiktok",    label: "Viral TikTok",     emoji: "🔥", description: "Short, punchy, meme energy" },
  { id: "instagram",       label: "Instagram",         emoji: "📸", description: "Aesthetic, saveable, shareable" },
  { id: "linkedin",        label: "LinkedIn",          emoji: "💼", description: "Professional, thought-leadership" },
  { id: "storytelling",    label: "Storytelling",      emoji: "🎬", description: "Emotional, cinematic arc" },
  { id: "educational",     label: "Educational",       emoji: "📚", description: "Teach one clear thing" },
  { id: "mistakes",        label: "Mistakes",          emoji: "⚠️", description: "High engagement, relatable" },
  { id: "checklist",       label: "Checklist",         emoji: "✅", description: "Swipeable, saves-worthy" },
  { id: "before-after",    label: "Before vs After",   emoji: "🔄", description: "Transformation story" },
  { id: "myth-vs-fact",    label: "Myth vs Fact",      emoji: "💡", description: "Controversy drives shares" },
  { id: "case-study",      label: "Case Study",        emoji: "📊", description: "Social proof narrative" },
  { id: "sales",           label: "Sales Carousel",    emoji: "💰", description: "Conversion-optimised" },
  { id: "beginner-guide",  label: "Beginner Guide",    emoji: "🚀", description: "Authority-building content" },
] as const;
type CarouselTypeId = typeof CAROUSEL_TYPES[number]["id"];

// ── Quality score types ───────────────────────────────────────────────────────

type QualityScore = {
  scrollStopper: number;
  curiosity: number;
  readability: number;
  shareability: number;
  conversion: number;
  overall: number;
  weakSlides: number[];
  suggestions: string[];
};

type AbVariant = {
  id: string;
  hook: string;
  framework: string;
  styleHint: string;
  slides: ContentRow[];
  designs: DesignData[];
  qualityScore: QualityScore;
};

const FORMAT_LABELS: Record<string, string> = {
  ebook: "eBook", workbook: "Workbook", checklist: "Checklist",
  guide: "Guide", planner: "Planner", journal: "Journal",
  spreadsheet: "Spreadsheet", notion: "Notion Template",
};

const PLATFORMS: { id: PlatformId; label: string; emoji: string; sub: string; hasLink: boolean }[] = [
  { id: "instagram",      label: "Instagram",   emoji: "📸", sub: "Link in Bio",      hasLink: true  },
  { id: "tiktok-link",    label: "TikTok",      emoji: "🎵", sub: "Link in Bio",      hasLink: true  },
  { id: "tiktok-comment", label: "TikTok",      emoji: "🎵", sub: "Comment Keyword",  hasLink: false },
  { id: "linkedin",       label: "LinkedIn",    emoji: "💼", sub: "Professional",     hasLink: true  },
  { id: "pinterest",      label: "Pinterest",   emoji: "📌", sub: "Save Pin",         hasLink: true  },
  { id: "facebook",       label: "Facebook",    emoji: "👥", sub: "Social",           hasLink: true  },
  { id: "twitter",        label: "X (Twitter)", emoji: "𝕏",  sub: "Short form",      hasLink: true  },
  { id: "threads",        label: "Threads",     emoji: "🧵", sub: "Micro-blog",       hasLink: true  },
];

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

async function renderDesignToPng(design: DesignData): Promise<string> {
  const { toPng } = await import("html-to-image");
  const { createRoot } = await import("react-dom/client");
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
    return dataUrl.split(",")[1];
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}

async function exportAllAsZip(
  posts: ContentRow[],
  designs: DesignData[],
  batchLabel: string,
  platformOutputs: PlatformOutput[],
): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const slug = batchLabel.replace(/[^a-z0-9]/gi, "-");

  // Core carousel slides
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const design = designs[i];
    const fileName = post.productTitle
      ? `${post.productTitle.replace(/[^a-z0-9]/gi, "-")}-post-${i + 1}.png`
      : `${slug}-post-${i + 1}.png`;
    zip.file(fileName, await renderDesignToPng(design), { base64: true });
  }

  // Per-platform CTA slides
  for (const po of platformOutputs) {
    if (po.ctaSlideDesign) {
      zip.file(`cta-${po.platformId}.png`, await renderDesignToPng(po.ctaSlideDesign), { base64: true });
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `${slug}-posts.zip`;
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

  // CTA settings — multi-platform
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<PlatformId>>(new Set<PlatformId>(["instagram"]));
  const [ctaStrategy, setCtaStrategy] = useState<CtaStrategy>("ai");
  const [perPlatformCta, setPerPlatformCta] = useState<Record<string, PlatformCfg>>({});
  const [platformOutputs, setPlatformOutputs] = useState<PlatformOutput[]>([]);
  const [activePlatformTab, setActivePlatformTab] = useState<string>("instagram");

  // Carousel-specific state
  const [carouselType, setCarouselType] = useState<CarouselTypeId>("instagram");
  const [generatedHooks, setGeneratedHooks] = useState<string[]>([]);
  const [selectedHook, setSelectedHook] = useState<string>("");
  const [hookPhase, setHookPhase] = useState(false);
  const [hooksLoading, setHooksLoading] = useState(false);
  const [hooksError, setHooksError] = useState<string | null>(null);
  const [abVariants, setAbVariants] = useState<AbVariant[]>([]);
  const [activeVariant, setActiveVariant] = useState(0);
  const [qualityScore, setQualityScore] = useState<QualityScore | null>(null);
  const [regeneratingSlideIdx, setRegeneratingSlideIdx] = useState<number | null>(null);
  const [framework, setFramework] = useState<string>("");
  const [abLoading, setAbLoading] = useState(false);

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

  function togglePlatform(id: PlatformId) {
    setSelectedPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); } // keep at least one
      else next.add(id);
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

  // ── Hook generation (phase 1 of carousel flow) ─────────────────────────────
  async function generateHooks() {
    if (!canGenerate) return;
    setHooksLoading(true);
    setHooksError(null);
    setGeneratedHooks([]);
    setHookPhase(false);
    setQualityScore(null);
    setAbVariants([]);
    try {
      let topicStr = topic;
      if (mode === "url" && urlScraped) {
        topicStr = [urlScraped.title, urlScraped.description].filter(Boolean).join(". ").slice(0, 400);
      } else if (mode === "products") {
        const sel = products.filter((p) => selectedProductIds.has(p.id));
        topicStr = sel.map((p) => p.title).join(", ");
      }
      const res = await fetch("/api/designs/bulk-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "hooks", topic: topicStr, carouselType, style, niche }),
      });
      const json = await res.json() as { hooks?: string[]; error?: string };
      if (!res.ok || !json.hooks?.length) { setHooksError(json.error ?? "Could not generate hooks"); return; }
      setGeneratedHooks(json.hooks);
      setSelectedHook(json.hooks[0]);
      setHookPhase(true);
    } catch {
      setHooksError("Network error — please try again.");
    } finally {
      setHooksLoading(false);
    }
  }

  // ── A/B generation — 3 complete carousel variants ──────────────────────────
  async function generateABVariants() {
    if (!canGenerate) return;
    setAbLoading(true);
    setAbVariants([]);
    try {
      let topicStr = topic;
      if (mode === "url" && urlScraped) topicStr = [urlScraped.title, urlScraped.description].filter(Boolean).join(". ").slice(0, 400);
      const res = await fetch("/api/designs/bulk-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "ab", topic: topicStr, carouselType, slideCount: count, style, niche, generatedHooks }),
      });
      const json = await res.json() as {
        variants?: Array<{ id: string; hook: string; framework: string; styleHint: string; slides: ContentRow[]; qualityScore: QualityScore }>;
        error?: string;
      };
      if (!res.ok || !json.variants?.length) return;

      const variants: AbVariant[] = json.variants.map((v) => {
        const usedLl: string[] = [];
        const designs = v.slides.map((slide, si) => {
          const { data, layoutId } = buildSlideDesign(slide, style, si, v.slides.length, usedLl, canvasFormatHeight);
          usedLl.push(layoutId);
          return data;
        });
        return { id: v.id, hook: v.hook, framework: v.framework, styleHint: v.styleHint, slides: v.slides.map((s, i) => ({ ...s, id: `v${v.id}-${i}-${Date.now()}` })), designs, qualityScore: v.qualityScore };
      });

      setAbVariants(variants);
      setActiveVariant(0);
      // Load first variant into the main slide view
      const first = variants[0];
      setPosts(first.slides);
      setPostDesigns(first.designs);
      setQualityScore(first.qualityScore);
      setFramework(first.framework);
      setStep(2);
    } catch { /* non-fatal */ }
    finally { setAbLoading(false); }
  }

  // ── Per-slide regeneration ──────────────────────────────────────────────────
  async function regenerateSlide(index: number) {
    setRegeneratingSlideIdx(index);
    try {
      let topicStr = topic;
      if (mode === "url" && urlScraped) topicStr = [urlScraped.title, urlScraped.description].filter(Boolean).join(". ").slice(0, 400);
      const res = await fetch("/api/designs/bulk-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "slide-regen",
          topic: topicStr,
          carouselType,
          framework,
          slideCount: posts.length,
          slideIndex: index,
          style,
          niche,
          existingSlides: posts.map((p) => ({ hook: p.hook, mainText: p.mainText })),
        }),
      });
      const json = await res.json() as { slide?: ContentRow; error?: string };
      if (json.slide) {
        const updated: ContentRow = { ...json.slide, id: posts[index].id };
        setPosts((prev) => prev.map((p, i) => i === index ? updated : p));
        setPostDesigns((prevDesigns) => {
          const next = [...prevDesigns];
          const usedBefore = next.slice(0, index).map((d) => (d as Record<string, unknown>).presetName as string ?? "");
          next[index] = buildSlideDesign(updated, style, index, posts.length, usedBefore, canvasFormatHeight).data;
          return next;
        });
      }
    } catch { /* non-fatal */ }
    finally { setRegeneratingSlideIdx(null); }
  }

  // ── Main generate (carousel mode) ──────────────────────────────────────────
  async function generate() {
    if (!canGenerate) return;
    setGenerating(true);
    setGenError(null);
    setPlatformOutputs([]);
    setQualityScore(null);
    try {
      let topicStr = topic;
      if (mode === "products") {
        const selected = products.filter((p) => selectedProductIds.has(p.id));
        topicStr = selected.map((p) => p.title).join(", ");
      } else if (mode === "url" && urlScraped) {
        const parts = [urlScraped.title, urlScraped.description, urlScraped.excerpt].filter(Boolean);
        topicStr = parts.join(". ").slice(0, 800);
      }

      // Decide mode: carousel (if hook selected) vs bulk
      const useCarouselMode = hookPhase && selectedHook;
      const body: Record<string, unknown> = useCarouselMode
        ? {
            mode: "carousel",
            topic: topicStr,
            carouselType,
            slideCount: count,
            selectedHook,
            style, niche, tone,
            platforms: Array.from(selectedPlatforms),
            ctaStrategy,
            perPlatformCta: ctaStrategy === "manual" ? perPlatformCta : undefined,
          }
        : {
            mode: "bulk",
            topic: topicStr,
            count, style, niche, tone,
            platforms: Array.from(selectedPlatforms),
            ctaStrategy,
            perPlatformCta: ctaStrategy === "manual" ? perPlatformCta : undefined,
          };

      if (mode === "products") {
        const selected = products.filter((p) => selectedProductIds.has(p.id));
        body.products = selected.map((p) => ({
          title: p.title, format: p.format, niche: p.niche,
          description: p.marketingAssets?.productDescription ?? "",
        }));
      }

      const res = await fetch("/api/designs/bulk-generate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json() as {
        // carousel mode
        slides?: ContentRow[];
        framework?: string;
        qualityScore?: QualityScore;
        // bulk mode
        posts?: ContentRow[];
        // shared
        platformOutputs?: Array<{ platformId: string; caption: string; hashtags: string[]; ctaSlide: Record<string, unknown> }>;
        error?: string;
      };
      if (!res.ok) { setGenError(json.error ?? "Generation failed"); return; }

      const rawSlides = json.slides ?? json.posts ?? [];
      const newPosts = rawSlides.map((p, i) => ({
        ...p, id: `post-${i}-${Date.now()}`,
        hook: p.hook ?? "", mainText: p.mainText ?? "", cta: p.cta ?? "", bgTheme: p.bgTheme ?? "light",
      }));

      const usedLayouts: string[] = [];
      const newDesigns = newPosts.map((post, idx) => {
        const { data, layoutId } = buildSlideDesign(post, style, idx, newPosts.length, usedLayouts, canvasFormatHeight);
        usedLayouts.push(layoutId);
        return data;
      });
      setPosts(newPosts);
      setPostDesigns(newDesigns);

      if (json.framework) setFramework(json.framework);
      if (json.qualityScore) setQualityScore(json.qualityScore);

      if (json.platformOutputs?.length) {
        const newPlatformOutputs: PlatformOutput[] = json.platformOutputs.map(po => {
          let ctaSlide: ContentRow | null = null;
          let ctaSlideDesign: DesignData | null = null;
          if (po.ctaSlide && typeof po.ctaSlide === "object") {
            const raw = po.ctaSlide;
            ctaSlide = {
              id: `cta-${po.platformId}-${Date.now()}`,
              hook: String(raw.hook ?? ""),
              mainText: String(raw.mainText ?? ""),
              cta: String(raw.cta ?? ""),
              bgTheme: String(raw.bgTheme ?? "gradient-warm"),
              isCta: true,
            };
            ctaSlideDesign = buildSlideDesign(ctaSlide, style, newPosts.length, newPosts.length + 1, [], canvasFormatHeight).data;
          }
          return { platformId: po.platformId, caption: po.caption ?? "", hashtags: po.hashtags ?? [], ctaSlide, ctaSlideDesign };
        });
        setPlatformOutputs(newPlatformOutputs);
        setActivePlatformTab(newPlatformOutputs[0].platformId);
      }

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
    try { await exportAllAsZip(posts, postDesigns, batchLabel, platformOutputs); }
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
              <h1 className="text-base font-bold">AI Carousel Generator</h1>
              <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>Hook → Framework → Viral carousel in seconds</p>
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

              {/* Carousel type */}
              <div className={`rounded-2xl border p-6 space-y-4 ${cardCls}`}>
                <div>
                  <label className="block text-sm font-semibold">Carousel type</label>
                  <p className={`text-xs mt-0.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Each type uses a different prompting strategy and narrative framework.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CAROUSEL_TYPES.map((ct) => (
                    <button
                      key={ct.id}
                      onClick={() => setCarouselType(ct.id)}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                        carouselType === ct.id
                          ? "border-orange-500 bg-orange-500/10"
                          : isDark
                          ? "border-white/10 hover:border-white/25"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <span className="text-lg leading-none shrink-0 mt-0.5">{ct.emoji}</span>
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold leading-tight ${carouselType === ct.id ? "text-orange-500" : ""}`}>{ct.label}</p>
                        <p className={`text-[10px] leading-tight mt-0.5 ${isDark ? "text-gray-600" : "text-gray-400"}`}>{ct.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hook selection phase — appears after generateHooks() */}
              {hookPhase && generatedHooks.length > 0 && (
                <div className={`rounded-2xl border overflow-hidden ${cardCls}`}>
                  <div className={`px-5 py-4 border-b flex items-center gap-2 ${isDark ? "border-white/10 bg-orange-500/5" : "border-orange-200 bg-orange-50"}`}>
                    <Sparkles className="w-4 h-4 text-orange-500" />
                    <div>
                      <p className="text-sm font-bold text-orange-500">Pick your hook</p>
                      <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>Slide 1 = everything. Choose the hook that grabs attention.</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    {generatedHooks.map((hook, hi) => (
                      <button
                        key={hi}
                        onClick={() => setSelectedHook(hook)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                          selectedHook === hook
                            ? "border-orange-500 bg-orange-500/10"
                            : isDark
                            ? "border-white/10 hover:border-white/25"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedHook === hook ? "border-orange-500 bg-orange-500" : isDark ? "border-white/20" : "border-gray-300"}`}>
                          {selectedHook === hook && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className={`text-sm font-bold tracking-wide ${selectedHook === hook ? "text-orange-500" : ""}`}>{hook}</span>
                        {hi === 0 && (
                          <span className="ml-auto shrink-0 text-[9px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold">BEST</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className={`px-4 pb-4 flex gap-2`}>
                    <button
                      onClick={generateHooks}
                      disabled={hooksLoading}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-colors ${isDark ? "border-white/10 text-gray-400 hover:text-white hover:border-white/30" : "border-gray-200 text-gray-500 hover:text-gray-900"}`}
                    >
                      <RefreshCw className="w-3 h-3" />
                      New hooks
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => void generateABVariants()}
                      disabled={!selectedHook || abLoading}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${isDark ? "border-purple-500/30 text-purple-400 hover:border-purple-500 hover:bg-purple-500/10" : "border-purple-300 text-purple-600 hover:border-purple-500 hover:bg-purple-50"} disabled:opacity-50`}
                    >
                      {abLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trophy className="w-3 h-3" />}
                      {abLoading ? "Generating A/B..." : "A/B (3 concepts)"}
                    </button>
                  </div>
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
                <div>
                  <label className="block text-sm font-semibold">How many slides?</label>
                  <p className={`text-xs mt-0.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>7–10 slides performs best for most carousel types.</p>
                </div>
                <div className="flex gap-3">
                  {COUNT_OPTIONS.map((n) => (
                    <button key={n} onClick={() => setCount(n)} className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-colors ${count === n ? "border-orange-500 bg-orange-500 text-white" : isDark ? "border-white/10 text-gray-300 hover:border-orange-500/50" : "border-gray-200 text-gray-700 hover:border-orange-300"}`}>{n}</button>
                  ))}
                </div>
              </div>

              {/* CTA Settings — multi-platform + AI strategy */}
              <div className={`rounded-2xl border p-6 space-y-5 ${cardCls}`}>
                {/* Header */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Megaphone className="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Publishing Platforms & CTA</p>
                    <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>Select where you&apos;re posting — AI will craft a unique CTA slide per platform</p>
                  </div>
                </div>

                {/* Platform multi-select grid */}
                <div>
                  <label className="block text-xs font-semibold mb-2.5">Publishing platforms <span className="font-normal opacity-60">(select all that apply)</span></label>
                  <div className="grid grid-cols-2 gap-2">
                    {PLATFORMS.map((p) => {
                      const active = selectedPlatforms.has(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => togglePlatform(p.id)}
                          className={`flex items-center gap-2.5 py-2.5 px-3 rounded-xl border-2 text-left transition-all ${
                            active
                              ? "border-orange-500 bg-orange-500/10"
                              : isDark
                              ? "border-white/10 hover:border-white/25"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <span className="text-lg leading-none">{p.emoji}</span>
                          <div className="min-w-0">
                            <p className={`text-xs font-semibold leading-tight ${active ? "text-orange-500" : ""}`}>{p.label}</p>
                            <p className={`text-[10px] leading-tight truncate ${active ? "text-orange-400" : isDark ? "text-gray-600" : "text-gray-400"}`}>{p.sub}</p>
                          </div>
                          {active && (
                            <div className="ml-auto w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className={`text-[10px] mt-2 ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                    {selectedPlatforms.size} platform{selectedPlatforms.size !== 1 ? "s" : ""} selected · Each gets its own CTA slide + caption + hashtags
                  </p>
                </div>

                {/* CTA Strategy */}
                <div>
                  <label className="block text-xs font-semibold mb-2.5">CTA Strategy</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["ai", "manual"] as CtaStrategy[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setCtaStrategy(s)}
                        className={`flex flex-col items-start py-3 px-3.5 rounded-xl border-2 transition-all text-left ${
                          ctaStrategy === s
                            ? "border-orange-500 bg-orange-500/10"
                            : isDark
                            ? "border-white/10 hover:border-white/25"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          {s === "ai" ? <Sparkles className={`w-3.5 h-3.5 ${ctaStrategy === s ? "text-orange-500" : isDark ? "text-gray-400" : "text-gray-500"}`} /> : <Megaphone className={`w-3.5 h-3.5 ${ctaStrategy === s ? "text-orange-500" : isDark ? "text-gray-400" : "text-gray-500"}`} />}
                          <span className={`text-xs font-bold ${ctaStrategy === s ? "text-orange-500" : ""}`}>
                            {s === "ai" ? "AI Optimised" : "Manual"}
                          </span>
                          {s === "ai" && <span className="text-[9px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-semibold">Recommended</span>}
                        </div>
                        <p className={`text-[10px] leading-snug ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                          {s === "ai"
                            ? "AI picks the best CTA, caption & hashtags per platform automatically"
                            : "Set a specific CTA type & keyword for each platform individually"}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* AI mode info box */}
                {ctaStrategy === "ai" && (
                  <div className={`rounded-xl border p-4 space-y-2.5 ${isDark ? "border-white/10 bg-white/3" : "border-orange-200 bg-orange-50/60"}`}>
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                      <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">What AI generates per platform</p>
                    </div>
                    <div className="space-y-1.5">
                      {Array.from(selectedPlatforms).map(pid => {
                        const pl = PLATFORMS.find(p => p.id === pid)!;
                        const examples: Record<string, string> = {
                          "instagram": "\"Tap the link in bio ↗\" + hashtag bundle",
                          "tiktok-link": "\"Link in bio 🔗\" or short comment trigger",
                          "tiktok-comment": "\"Comment 'KEYWORD' — I'll DM you instantly\"",
                          "linkedin": "Professional CTA + industry hashtags",
                          "pinterest": "\"Save this Pin + link in bio\" CTA",
                          "facebook": "\"Comment below or visit link in bio\"",
                          "twitter": "Short punchy CTA, 3–5 hashtags",
                          "threads": "Conversational reply-bait CTA",
                        };
                        return (
                          <div key={pid} className="flex items-start gap-2">
                            <span className="text-sm leading-none mt-0.5">{pl.emoji}</span>
                            <p className={`text-[11px] leading-snug ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                              <span className="font-semibold">{pl.label}</span> — {examples[pid]}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Manual mode — per-platform accordion */}
                {ctaStrategy === "manual" && (
                  <div className="space-y-3">
                    <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>Configure each platform&apos;s CTA individually:</p>
                    {Array.from(selectedPlatforms).map((pid) => {
                      const pl = PLATFORMS.find(p => p.id === pid)!;
                      const cfg: PlatformCfg = perPlatformCta[pid] ?? { ctaType: "automatic", ctaKeyword: "", ctaCustom: "" };
                      const update = (patch: Partial<PlatformCfg>) =>
                        setPerPlatformCta(prev => ({ ...prev, [pid]: { ...cfg, ...patch } }));
                      const ctaTypes: { value: CtaType; label: string }[] = [
                        { value: "automatic", label: "Auto" },
                        ...(pl.hasLink ? [{ value: "link-in-bio" as CtaType, label: "Link in Bio" }] : []),
                        { value: "comment-keyword", label: "Comment KW" },
                        ...(pl.hasLink ? [{ value: "visit-store" as CtaType, label: "Visit Store" }] : []),
                        { value: "follow-for-more", label: "Follow" },
                        { value: "custom", label: "Custom" },
                      ];
                      return (
                        <div key={pid} className={`rounded-xl border p-3.5 space-y-3 ${isDark ? "border-white/10" : "border-gray-200"}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-base">{pl.emoji}</span>
                            <span className="text-xs font-semibold">{pl.label}</span>
                            <span className={`text-[10px] ${isDark ? "text-gray-600" : "text-gray-400"}`}>· {pl.sub}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {ctaTypes.map(ct => (
                              <button
                                key={ct.value}
                                onClick={() => update({ ctaType: ct.value as CtaType })}
                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${cfg.ctaType === ct.value ? "border-orange-500 bg-orange-500/10 text-orange-500" : isDark ? "border-white/10 text-gray-400 hover:border-white/30" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                              >
                                {ct.label}
                              </button>
                            ))}
                          </div>
                          {cfg.ctaType === "comment-keyword" && (
                            <input
                              value={cfg.ctaKeyword}
                              onChange={(e) => update({ ctaKeyword: e.target.value })}
                              placeholder="Keyword e.g. GUIDE"
                              className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-orange-500 ${isDark ? "bg-[#0F0F0F] border-white/10 text-white placeholder-gray-600" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"}`}
                            />
                          )}
                          {cfg.ctaType === "custom" && (
                            <input
                              value={cfg.ctaCustom}
                              onChange={(e) => update({ ctaCustom: e.target.value })}
                              placeholder="e.g. DM me 'START' to join"
                              className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-orange-500 ${isDark ? "bg-[#0F0F0F] border-white/10 text-white placeholder-gray-600" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"}`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {(hooksError || genError) && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{hooksError ?? genError}</p>
              )}

              <div className="flex gap-2">
                {hookPhase && selectedHook && (
                  <Button
                    disabled={!canGenerate || generating}
                    onClick={generate}
                    className="flex-1 h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold gap-2 text-base rounded-xl"
                  >
                    {generating ? <><Loader2 className="w-5 h-5 animate-spin" /> Building carousel…</> : <><Zap className="w-5 h-5" /> Build Carousel</>}
                  </Button>
                )}
                <Button
                  disabled={!canGenerate || hooksLoading || generating}
                  onClick={hookPhase ? generateHooks : () => void generateHooks()}
                  className={`h-12 font-semibold gap-2 text-base rounded-xl ${hookPhase ? "flex-none px-4 border bg-transparent text-orange-500 border-orange-500 hover:bg-orange-500/10" : "flex-1 bg-orange-500 hover:bg-orange-600 text-white"}`}
                  variant={hookPhase ? "outline" : "default"}
                >
                  {hooksLoading
                    ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating hooks…</>
                    : hookPhase
                    ? <><RefreshCw className="w-4 h-4" /> New hooks</>
                    : <><Sparkles className="w-5 h-5" /> Generate Hooks</>
                  }
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-xl font-bold">{posts.length} slides generated</h2>
                  <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    {TEMPLATE_META[style].label} · {CANVAS_FORMATS.find((f) => f.height === canvasFormatHeight)?.sublabel ?? `1080×${canvasFormatHeight}`}
                    {framework && <> · <span className="text-orange-500">{framework}</span></>}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => { setStep(1); setGenError(null); setHookPhase(false); setGeneratedHooks([]); setAbVariants([]); setQualityScore(null); }} className={`gap-1.5 ${isDark ? "border-white/10 text-gray-300 hover:text-white" : ""}`}>
                    <RefreshCw className="w-3.5 h-3.5" /> Start over
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportZip} disabled={exportingZip || posts.length === 0} className={`gap-1.5 ${isDark ? "border-white/10 text-gray-300 hover:text-white" : ""}`}>
                    {exportingZip ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Exporting…</> : <><Package className="w-3.5 h-3.5" /> Export ZIP</>}
                  </Button>
                  <Button size="sm" onClick={saveAsBundle} disabled={saving || posts.length === 0} className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5">
                    {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Download className="w-3.5 h-3.5" /> Save Bundle</>}
                  </Button>
                </div>
              </div>
              {saveError && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
              )}

              {/* Quality score panel */}
              {qualityScore && (
                <div className={`rounded-2xl border p-5 ${cardCls}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart2 className="w-4 h-4 text-orange-500" />
                    <p className="text-sm font-bold">Carousel Quality Score</p>
                    <div className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-black ${
                      qualityScore.overall >= 85 ? "bg-emerald-500/15 text-emerald-500" :
                      qualityScore.overall >= 70 ? "bg-orange-500/15 text-orange-500" :
                      "bg-red-500/15 text-red-500"
                    }`}>
                      <Star className="w-3.5 h-3.5 fill-current" />
                      {qualityScore.overall}/100
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {[
                      { label: "Scroll Stopper", value: qualityScore.scrollStopper },
                      { label: "Curiosity",       value: qualityScore.curiosity },
                      { label: "Readability",     value: qualityScore.readability },
                      { label: "Shareability",    value: qualityScore.shareability },
                      { label: "Conversion",      value: qualityScore.conversion },
                    ].map(({ label, value }) => (
                      <div key={label} className={`rounded-xl p-3 ${isDark ? "bg-white/5" : "bg-gray-50"}`}>
                        <p className={`text-[10px] font-semibold mb-1.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>{label}</p>
                        <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-gray-200"} mb-1.5`}>
                          <div
                            className={`h-full rounded-full transition-all ${value >= 85 ? "bg-emerald-500" : value >= 70 ? "bg-orange-500" : "bg-red-500"}`}
                            style={{ width: `${value}%` }}
                          />
                        </div>
                        <p className={`text-xs font-bold ${value >= 85 ? "text-emerald-500" : value >= 70 ? "text-orange-500" : "text-red-500"}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                  {qualityScore.suggestions.length > 0 && (
                    <div className={`mt-3 rounded-xl px-3 py-2.5 space-y-1 ${isDark ? "bg-white/5" : "bg-gray-50"}`}>
                      {qualityScore.suggestions.map((s, si) => (
                        <p key={si} className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>• {s}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* A/B variant tabs */}
              {abVariants.length > 0 && (
                <div className={`rounded-2xl border overflow-hidden ${cardCls}`}>
                  <div className={`flex gap-1 px-4 py-3 border-b ${isDark ? "border-white/10" : "border-gray-100"}`}>
                    <Trophy className="w-4 h-4 text-orange-500 mr-1 self-center" />
                    {abVariants.map((v, vi) => (
                      <button
                        key={v.id}
                        onClick={() => {
                          setActiveVariant(vi);
                          setPosts(v.slides);
                          setPostDesigns(v.designs);
                          setQualityScore(v.qualityScore);
                          setFramework(v.framework);
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          activeVariant === vi
                            ? "bg-orange-500 text-white"
                            : isDark ? "text-gray-400 hover:text-white hover:bg-white/10" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                        }`}
                      >
                        <span className="font-black">{v.id.toUpperCase()}</span>
                        <span className="opacity-70">{v.hook.slice(0, 20)}…</span>
                        <span className={`text-[10px] font-black ${activeVariant === vi ? "text-white/80" : "text-orange-500"}`}>{v.qualityScore.overall}</span>
                      </button>
                    ))}
                    <p className={`ml-auto text-[11px] self-center ${isDark ? "text-gray-600" : "text-gray-400"}`}>3 concepts · pick the best</p>
                  </div>
                  {abVariants[activeVariant] && (
                    <div className={`px-4 py-2.5 ${isDark ? "bg-white/3" : "bg-gray-50/60"}`}>
                      <p className={`text-[11px] font-medium ${isDark ? "text-gray-500" : "text-gray-400"}`}>Framework: <span className="text-orange-500 font-semibold">{abVariants[activeVariant].framework}</span> · Style hint: {abVariants[activeVariant].styleHint}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Slide grid with per-slide regen */}
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {posts.map((post, i) => (
                  <div key={post.id} className="relative group">
                    <PostPreview
                      post={post}
                      design={postDesigns[i] ?? { width: 1080, height: canvasFormatHeight, background: "#fff", elements: [] }}
                      index={i}
                      isDark={isDark}
                      onDelete={() => { setPosts((prev) => prev.filter((p) => p.id !== post.id)); setPostDesigns((prev) => prev.filter((_, di) => di !== i)); }}
                      onQuickEdit={() => setEditingPost(post)}
                      onEdit={() => saveAndEdit(post, i)}
                    />
                    {/* Per-slide regen button */}
                    <button
                      onClick={() => void regenerateSlide(i)}
                      disabled={regeneratingSlideIdx !== null}
                      className={`absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-lg flex items-center justify-center ${isDark ? "bg-[#1A1A1A] border border-white/20 text-gray-400 hover:text-orange-400" : "bg-white border border-gray-200 text-gray-500 hover:text-orange-500"} shadow-sm`}
                      title="Regenerate this slide"
                    >
                      {regeneratingSlideIdx === i
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <RefreshCcw className="w-3 h-3" />
                      }
                    </button>
                  </div>
                ))}
              </div>

              {/* ── Platform Content Panel ── */}
              {platformOutputs.length > 0 && (
                <div className={`rounded-2xl border overflow-hidden ${cardCls}`}>
                  {/* Header */}
                  <div className={`px-5 py-4 border-b flex items-center gap-2 ${isDark ? "border-white/10" : "border-gray-100"}`}>
                    <Sparkles className="w-4 h-4 text-orange-500" />
                    <p className="text-sm font-semibold">Platform Content</p>
                    <span className={`text-xs ml-auto ${isDark ? "text-gray-500" : "text-gray-400"}`}>AI-crafted per platform</span>
                  </div>

                  {/* Platform tabs */}
                  <div className={`flex gap-1 px-4 pt-3 pb-0 overflow-x-auto border-b ${isDark ? "border-white/10" : "border-gray-100"}`}>
                    {platformOutputs.map(po => {
                      const pl = PLATFORMS.find(p => p.id === po.platformId);
                      const isActive = activePlatformTab === po.platformId;
                      return (
                        <button
                          key={po.platformId}
                          onClick={() => setActivePlatformTab(po.platformId)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-semibold whitespace-nowrap border-b-2 transition-colors -mb-px ${
                            isActive
                              ? "border-orange-500 text-orange-500"
                              : isDark
                              ? "border-transparent text-gray-500 hover:text-gray-300"
                              : "border-transparent text-gray-400 hover:text-gray-700"
                          }`}
                        >
                          <span>{pl?.emoji}</span>
                          <span>{pl?.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Active platform content */}
                  {platformOutputs.filter(po => po.platformId === activePlatformTab).map(po => {
                    const pl = PLATFORMS.find(p => p.id === po.platformId);
                    return (
                      <div key={po.platformId} className="p-5 space-y-5">
                        {/* Caption */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className={`text-xs font-semibold ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                              {pl?.emoji} Caption for {pl?.label}
                            </label>
                            <button
                              onClick={() => { navigator.clipboard.writeText(po.caption); }}
                              className={`text-[10px] font-medium px-2 py-1 rounded-lg transition-colors ${isDark ? "bg-white/10 hover:bg-white/20 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-600"}`}
                            >
                              Copy
                            </button>
                          </div>
                          <div className={`rounded-xl p-3.5 text-sm leading-relaxed whitespace-pre-wrap ${isDark ? "bg-black/30 text-gray-300 border border-white/10" : "bg-gray-50 text-gray-700 border border-gray-200"}`}>
                            {po.caption}
                          </div>
                        </div>

                        {/* Hashtags */}
                        {po.hashtags.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className={`text-xs font-semibold ${isDark ? "text-gray-400" : "text-gray-500"}`}>Hashtags ({po.hashtags.length})</label>
                              <button
                                onClick={() => { navigator.clipboard.writeText(po.hashtags.join(" ")); }}
                                className={`text-[10px] font-medium px-2 py-1 rounded-lg transition-colors ${isDark ? "bg-white/10 hover:bg-white/20 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-600"}`}
                              >
                                Copy All
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {po.hashtags.map((tag, ti) => (
                                <span key={ti} className={`text-xs px-2.5 py-1 rounded-full font-medium ${isDark ? "bg-orange-500/20 text-orange-300" : "bg-orange-100 text-orange-700"}`}>
                                  {tag.startsWith("#") ? tag : `#${tag}`}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* CTA Slide preview */}
                        {po.ctaSlide && po.ctaSlideDesign && (
                          <div>
                            <label className={`text-xs font-semibold block mb-2 ${isDark ? "text-gray-400" : "text-gray-500"}`}>CTA Slide</label>
                            <div className="flex gap-4 items-start">
                              <div style={{ width: Math.round(1080 * PREVIEW_SCALE), height: Math.round(canvasFormatHeight * PREVIEW_SCALE), overflow: "hidden", borderRadius: 8, flexShrink: 0 }}>
                                <SlidePreview data={po.ctaSlideDesign} scale={PREVIEW_SCALE} />
                              </div>
                              <div className="flex-1 space-y-1.5 min-w-0">
                                <div className={`rounded-lg p-2.5 text-xs ${isDark ? "bg-black/30 border border-white/10" : "bg-gray-50 border border-gray-200"}`}>
                                  <p className={`text-[10px] font-semibold mb-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>HOOK</p>
                                  <p className="font-semibold leading-tight">{po.ctaSlide.hook}</p>
                                </div>
                                <div className={`rounded-lg p-2.5 text-xs ${isDark ? "bg-black/30 border border-white/10" : "bg-gray-50 border border-gray-200"}`}>
                                  <p className={`text-[10px] font-semibold mb-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>CTA</p>
                                  <p className="leading-snug">{po.ctaSlide.cta}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

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
                <Button variant="outline" onClick={() => { setStep(1); setPosts([]); setPostDesigns([]); setTopic(""); setSavedCount(0); setBundleId(null); setSelectedProductIds(new Set()); setUrlInput(""); setUrlScraped(null); setUrlScrapeError(null); setPlatformOutputs([]); setPerPlatformCta({}); setSelectedPlatforms(new Set<PlatformId>(["instagram"])); setCtaStrategy("ai"); setHookPhase(false); setGeneratedHooks([]); setSelectedHook(""); setAbVariants([]); setQualityScore(null); setFramework(""); }} className={isDark ? "border-white/10 text-gray-300 hover:text-white" : ""}>
                  <RefreshCw className="w-4 h-4 mr-2" /> New Carousel
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
