"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, ChevronLeft, Loader2, Trash2, Edit3, Download,
  Check, RefreshCw, ChevronRight, Zap, BookOpen, Lightbulb,
  X, Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardTheme } from "@/components/dashboard-theme-provider";
import { DesignData, DesignElement } from "@/db/schema/designs-schema";
import { MarketingAssets } from "@/db/schema/products-schema";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ContentRow = {
  id: string;
  hook: string;
  mainText: string;
  cta: string;
  bgTheme: string;
  productTitle?: string;
};

type TemplateStyle =
  | "minimal-luxury" | "dark-aesthetic" | "wellness"
  | "clean-productivity" | "faceless-creator" | "modern-business";

type LayoutId = "centered" | "bold-hero" | "story";
type Mode = "topic" | "products";

type UserProduct = {
  id: string;
  title: string;
  format: string;
  niche: string;
  marketingAssets: MarketingAssets | null;
  status: string;
};

// ── Template configs ───────────────────────────────────────────────────────────

type TemplateCfg = {
  label: string; description: string; emoji: string;
  bg: string; bgType: "solid" | "gradient";
  bgGradient?: { color1: string; color2: string; angle: number };
  headingColor: string; bodyColor: string; accentColor: string;
  hookFont: string; bodyFont: string;
  previewBg: string; previewText: string; previewAccent: string;
};

const TEMPLATE_CONFIGS: Record<TemplateStyle, TemplateCfg> = {
  "minimal-luxury": {
    label: "Minimal Luxury", description: "Clean, elegant, premium", emoji: "✨",
    bg: "#FAFAF7", bgType: "solid",
    headingColor: "#1A1A1A", bodyColor: "#4A4A4A", accentColor: "#C9A84C",
    hookFont: "Playfair Display", bodyFont: "Georgia",
    previewBg: "#FAFAF7", previewText: "#1A1A1A", previewAccent: "#C9A84C",
  },
  "dark-aesthetic": {
    label: "Dark Aesthetic", description: "Bold, edgy, raw", emoji: "🖤",
    bg: "#0D0D0D", bgType: "solid",
    headingColor: "#FFFFFF", bodyColor: "#CCCCCC", accentColor: "#FF6B35",
    hookFont: "Oswald", bodyFont: "Inter",
    previewBg: "#0D0D0D", previewText: "#FFFFFF", previewAccent: "#FF6B35",
  },
  "wellness": {
    label: "Wellness", description: "Calm, nurturing, natural", emoji: "🌿",
    bg: "#E8F0E8", bgType: "gradient",
    bgGradient: { color1: "#E8F0E8", color2: "#C5DBC5", angle: 160 },
    headingColor: "#2D5016", bodyColor: "#3D6B2A", accentColor: "#5C9A3E",
    hookFont: "Playfair Display", bodyFont: "Georgia",
    previewBg: "linear-gradient(160deg,#E8F0E8,#C5DBC5)", previewText: "#2D5016", previewAccent: "#5C9A3E",
  },
  "clean-productivity": {
    label: "Clean Productivity", description: "Clear, actionable, focused", emoji: "⚡",
    bg: "#FFFFFF", bgType: "solid",
    headingColor: "#1E3A5F", bodyColor: "#374151", accentColor: "#3B82F6",
    hookFont: "Inter", bodyFont: "Inter",
    previewBg: "#FFFFFF", previewText: "#1E3A5F", previewAccent: "#3B82F6",
  },
  "faceless-creator": {
    label: "Faceless Creator", description: "Mysterious, viral, relatable", emoji: "🎭",
    bg: "#1a1a2e", bgType: "gradient",
    bgGradient: { color1: "#1a1a2e", color2: "#16213e", angle: 135 },
    headingColor: "#FFFFFF", bodyColor: "#B0B8D0", accentColor: "#E94560",
    hookFont: "Oswald", bodyFont: "Inter",
    previewBg: "linear-gradient(135deg,#1a1a2e,#16213e)", previewText: "#FFFFFF", previewAccent: "#E94560",
  },
  "modern-business": {
    label: "Modern Business", description: "Professional, confident, results", emoji: "💼",
    bg: "#1E3A5F", bgType: "solid",
    headingColor: "#FFFFFF", bodyColor: "#CBD5E1", accentColor: "#F59E0B",
    hookFont: "Oswald", bodyFont: "Inter",
    previewBg: "#1E3A5F", previewText: "#FFFFFF", previewAccent: "#F59E0B",
  },
};

// ── Layout variants ───────────────────────────────────────────────────────────

const LAYOUTS: Record<LayoutId, { label: string; description: string }> = {
  "centered": { label: "Centered Stack", description: "Balanced top-to-bottom" },
  "bold-hero": { label: "Bold Hero", description: "Hook fills the canvas" },
  "story": { label: "Story Card", description: "CTA in accent box" },
};

function buildElements(post: ContentRow, cfg: TemplateCfg, layoutId: LayoutId, W: number, H: number): DesignElement[] {
  if (layoutId === "bold-hero") {
    return [
      { id: "hook", type: "text", x: 60, y: 280, width: W - 120, height: 820,
        content: post.hook, fontSize: 124, fontFamily: cfg.hookFont,
        color: cfg.headingColor, fontWeight: "bold", textAlign: "center", lineHeight: 1.0, zIndex: 2 },
      { id: "main", type: "text", x: 80, y: 1200, width: W - 160, height: 380,
        content: post.mainText, fontSize: 44, fontFamily: cfg.bodyFont,
        color: cfg.bodyColor, textAlign: "center", lineHeight: 1.4, zIndex: 2 },
      { id: "cta", type: "text", x: 80, y: 1720, width: W - 160, height: 100,
        content: post.cta, fontSize: 40, fontFamily: cfg.bodyFont,
        color: cfg.accentColor, fontWeight: "bold", textAlign: "center", zIndex: 2 },
    ];
  }
  if (layoutId === "story") {
    return [
      { id: "hook", type: "text", x: 80, y: 560, width: W - 160, height: 440,
        content: post.hook, fontSize: 84, fontFamily: cfg.hookFont,
        color: cfg.headingColor, fontWeight: "bold", textAlign: "center", lineHeight: 1.15, zIndex: 2 },
      { id: "main", type: "text", x: 100, y: 1060, width: W - 200, height: 440,
        content: post.mainText, fontSize: 46, fontFamily: cfg.bodyFont,
        color: cfg.bodyColor, textAlign: "center", lineHeight: 1.5, zIndex: 2 },
      { id: "cta", type: "text", x: 160, y: 1640, width: W - 320, height: 140,
        content: post.cta, fontSize: 40, fontFamily: cfg.bodyFont,
        color: cfg.headingColor, fontWeight: "bold", textAlign: "center",
        textBackground: cfg.accentColor, zIndex: 2 },
    ];
  }
  // centered (default)
  return [
    { id: "hook", type: "text", x: 80, y: 500, width: W - 160, height: 480,
      content: post.hook, fontSize: 88, fontFamily: cfg.hookFont,
      color: cfg.headingColor, fontWeight: "bold", textAlign: "center", lineHeight: 1.1, zIndex: 2 },
    { id: "main", type: "text", x: 100, y: 1020, width: W - 200, height: 560,
      content: post.mainText, fontSize: 48, fontFamily: cfg.bodyFont,
      color: cfg.bodyColor, textAlign: "center", lineHeight: 1.5, zIndex: 2 },
    { id: "cta", type: "text", x: 80, y: 1680, width: W - 160, height: 120,
      content: post.cta, fontSize: 42, fontFamily: cfg.bodyFont,
      color: cfg.accentColor, fontWeight: "bold", textAlign: "center", zIndex: 2 },
  ];
}

function buildPostDesign(post: ContentRow, style: TemplateStyle, layout: LayoutId, postTitle: string): DesignData {
  const cfg = TEMPLATE_CONFIGS[style];
  const W = 1080, H = 1920;
  return {
    width: W, height: H,
    background: cfg.bg, backgroundType: cfg.bgType, backgroundGradient: cfg.bgGradient,
    elements: buildElements(post, cfg, layout, W, H),
    presetName: postTitle,
  };
}

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

// ── Layout preview thumbnail ──────────────────────────────────────────────────

function LayoutThumb({ id, cfg, selected, onClick }: {
  id: LayoutId; cfg: TemplateCfg; selected: boolean; onClick: () => void;
}) {
  const W = 54, H = 96; // tiny thumbnail proportional to 1080x1920
  const bgStyle: React.CSSProperties = cfg.bgType === "gradient" && cfg.bgGradient
    ? { background: `linear-gradient(${cfg.bgGradient.angle}deg, ${cfg.bgGradient.color1}, ${cfg.bgGradient.color2})` }
    : { background: cfg.bg };

  const layouts = {
    "centered": (
      <>
        <div style={{ width: "80%", height: 3, background: cfg.accentColor, borderRadius: 2, marginBottom: 6 }} />
        <div style={{ width: "90%", height: 18, background: cfg.headingColor, opacity: 0.9, borderRadius: 2, marginBottom: 5 }} />
        <div style={{ width: "80%", height: 9, background: cfg.bodyColor, opacity: 0.6, borderRadius: 2, marginBottom: 4 }} />
        <div style={{ width: "80%", height: 6, background: cfg.bodyColor, opacity: 0.4, borderRadius: 2, marginBottom: 10 }} />
        <div style={{ width: "60%", height: 8, background: cfg.accentColor, opacity: 0.8, borderRadius: 2 }} />
      </>
    ),
    "bold-hero": (
      <>
        <div style={{ width: "90%", height: 34, background: cfg.headingColor, opacity: 0.95, borderRadius: 2, marginBottom: 8 }} />
        <div style={{ width: "80%", height: 7, background: cfg.bodyColor, opacity: 0.5, borderRadius: 2, marginBottom: 4 }} />
        <div style={{ width: "80%", height: 5, background: cfg.bodyColor, opacity: 0.35, borderRadius: 2, marginBottom: 10 }} />
        <div style={{ width: "50%", height: 6, background: cfg.accentColor, opacity: 0.8, borderRadius: 2 }} />
      </>
    ),
    "story": (
      <>
        <div style={{ width: "80%", height: 3, background: cfg.accentColor, borderRadius: 2, marginBottom: 6 }} />
        <div style={{ width: "90%", height: 20, background: cfg.headingColor, opacity: 0.9, borderRadius: 2, marginBottom: 5 }} />
        <div style={{ width: "80%", height: 16, background: cfg.bodyColor, opacity: 0.55, borderRadius: 2, marginBottom: 8 }} />
        <div style={{ width: "70%", height: 12, background: cfg.accentColor, opacity: 0.85, borderRadius: 4 }} />
      </>
    ),
  };

  return (
    <button
      onClick={onClick}
      className={`relative rounded-xl border-2 overflow-hidden transition-all ${
        selected ? "border-orange-500 ring-2 ring-orange-500/20" : "border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/30"
      }`}
    >
      <div style={{ width: W, height: H, ...bgStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 6 }}>
        {layouts[id]}
      </div>
      {selected && (
        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center">
          <Check className="w-2.5 h-2.5 text-white" />
        </div>
      )}
    </button>
  );
}

// ── Mini preview card ─────────────────────────────────────────────────────────

const PREVIEW_SCALE = 0.175;

function PostPreview({ post, style, layout, index, onDelete, onEdit, onQuickEdit, isDark }: {
  post: ContentRow; style: TemplateStyle; layout: LayoutId; index: number;
  onDelete: () => void; onEdit: () => void; onQuickEdit: () => void; isDark: boolean;
}) {
  const cfg = TEMPLATE_CONFIGS[style];
  const previewW = Math.round(1080 * PREVIEW_SCALE);
  const previewH = Math.round(1920 * PREVIEW_SCALE);
  const bgStyle: React.CSSProperties = cfg.bgType === "gradient" && cfg.bgGradient
    ? { background: `linear-gradient(${cfg.bgGradient.angle}deg, ${cfg.bgGradient.color1}, ${cfg.bgGradient.color2})` }
    : { background: cfg.bg };

  const hookSize = layout === "bold-hero" ? 124 : layout === "story" ? 84 : 88;
  const hookY = layout === "bold-hero" ? 280 : layout === "story" ? 560 : 500;
  const bodyY = layout === "bold-hero" ? 1200 : layout === "story" ? 1060 : 1020;
  const ctaY = layout === "bold-hero" ? 1720 : layout === "story" ? 1640 : 1680;

  return (
    <div className={`group rounded-xl overflow-hidden border ${isDark ? "border-white/10 bg-[#1A1A1A]" : "border-gray-200 bg-white"} shadow-sm hover:shadow-md transition-shadow`}>
      <div style={{ width: previewW, height: previewH, overflow: "hidden", position: "relative" }}>
        <div style={{ width: 1080, height: 1920, transform: `scale(${PREVIEW_SCALE})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0, display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 80px", ...bgStyle }}>
          <div style={{ position: "absolute", top: 420, left: "50%", transform: "translateX(-50%)", width: 120, height: 7, background: cfg.accentColor, borderRadius: 4 }} />
          <div style={{ position: "absolute", top: hookY, left: 80, right: 80, fontFamily: cfg.hookFont, fontSize: hookSize, fontWeight: "bold", color: cfg.headingColor, textAlign: "center", lineHeight: 1.1, wordBreak: "break-word" }}>
            {post.hook}
          </div>
          <div style={{ position: "absolute", top: bodyY, left: 100, right: 100, fontFamily: cfg.bodyFont, fontSize: 46, color: cfg.bodyColor, textAlign: "center", lineHeight: 1.5, wordBreak: "break-word" }}>
            {post.mainText}
          </div>
          <div style={{
            position: "absolute", top: ctaY, left: 160, right: 160,
            fontFamily: cfg.bodyFont, fontSize: 40, fontWeight: "bold", textAlign: "center",
            ...(layout === "story"
              ? { background: cfg.accentColor, color: cfg.headingColor, padding: "28px 40px", borderRadius: 16 }
              : { color: cfg.accentColor }),
            wordBreak: "break-word",
          }}>
            {post.cta}
          </div>
        </div>
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
        <p className={`text-[10px] font-semibold truncate ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          {post.productTitle ? `${post.productTitle}` : `Post ${index + 1}`}
        </p>
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
  style: TemplateStyle,
  layout: LayoutId,
  batchLabel: string,
): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const { toPng } = await import("html-to-image");
  const cfg = TEMPLATE_CONFIGS[style];
  const zip = new JSZip();

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const container = document.createElement("div");
    container.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:1080px;height:1920px;overflow:hidden;z-index:-9999;`;

    const bgStyle = cfg.bgType === "gradient" && cfg.bgGradient
      ? `background:linear-gradient(${cfg.bgGradient.angle}deg,${cfg.bgGradient.color1},${cfg.bgGradient.color2});`
      : `background:${cfg.bg};`;
    container.style.cssText += bgStyle;

    // Accent bar
    const bar = document.createElement("div");
    bar.style.cssText = `position:absolute;top:420px;left:480px;width:120px;height:7px;background:${cfg.accentColor};border-radius:4px;`;
    container.appendChild(bar);

    const els = buildElements(post, cfg, layout, 1080, 1920);
    for (const el of els) {
      const div = document.createElement("div");
      div.style.cssText = `
        position:absolute;
        left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;
        color:${el.color ?? "#000"};
        font-family:'${el.fontFamily ?? "Inter"}',sans-serif;
        font-size:${el.fontSize ?? 32}px;
        font-weight:${el.fontWeight ?? "normal"};
        text-align:${el.textAlign ?? "left"};
        line-height:${el.lineHeight ?? 1.3};
        z-index:${el.zIndex ?? 1};
        word-break:break-word;
        white-space:pre-wrap;
        overflow:hidden;
        ${el.textBackground ? `background:${el.textBackground};padding:28px 40px;border-radius:16px;` : ""}
      `;
      div.textContent = el.content ?? "";
      container.appendChild(div);
    }

    document.body.appendChild(container);
    try {
      const dataUrl = await toPng(container, { pixelRatio: 1, width: 1080, height: 1920 });
      const base64 = dataUrl.split(",")[1];
      const fileName = post.productTitle
        ? `${post.productTitle.replace(/[^a-z0-9]/gi, "-")}-post-${i + 1}.png`
        : `${batchLabel.replace(/[^a-z0-9]/gi, "-")}-post-${i + 1}.png`;
      zip.file(fileName, base64, { base64: true });
    } finally {
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
  const [layout, setLayout] = useState<LayoutId>("centered");
  const [count, setCount] = useState(10);
  const [posts, setPosts] = useState<ContentRow[]>([]);
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

  const canGenerate = mode === "topic" ? topic.trim().length > 0 : selectedProductIds.size > 0;
  const batchLabel = mode === "products"
    ? `${selectedProductIds.size} product${selectedProductIds.size !== 1 ? "s" : ""}`
    : topic;

  async function generate() {
    if (!canGenerate) return;
    setGenerating(true);
    setGenError(null);
    try {
      const body: Record<string, unknown> = { style, count, tone, niche };
      if (mode === "products") {
        const selected = products.filter((p) => selectedProductIds.has(p.id));
        body.products = selected.map((p) => ({
          title: p.title, format: p.format, niche: p.niche,
          description: p.marketingAssets?.productDescription ?? "",
        }));
      } else {
        body.topic = topic;
      }
      const res = await fetch("/api/designs/bulk-generate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json() as { posts?: ContentRow[]; error?: string };
      if (!res.ok) { setGenError(json.error ?? "Generation failed"); return; }
      setPosts((json.posts ?? []).map((p, i) => ({
        ...p, id: `post-${i}-${Date.now()}`,
        hook: p.hook ?? "", mainText: p.mainText ?? "", cta: p.cta ?? "", bgTheme: p.bgTheme ?? "light",
      })));
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
        data: buildPostDesign(post, style, layout, `Slide ${idx + 1}`),
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
    const res = await fetch("/api/designs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: label, data: buildPostDesign(post, style, layout, label) }),
    });
    const json = await res.json() as { design?: { id: string } };
    if (json.design?.id) router.push(`/dashboard/design-studio/${json.design.id}`);
  }

  function updatePost(updated: ContentRow) {
    setPosts((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    setEditingPost(null);
  }

  async function handleExportZip() {
    setExportingZip(true);
    try { await exportAllAsZip(posts, style, layout, batchLabel); }
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
                {(["topic", "products"] as Mode[]).map((m) => (
                  <button key={m} onClick={() => setMode(m)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors ${
                    mode === m ? "bg-orange-500 text-white" : isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
                  }`}>
                    {m === "topic" ? <><Lightbulb className="w-4 h-4" /> Topic or Niche</> : <><BookOpen className="w-4 h-4" /> My Products</>}
                  </button>
                ))}
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
                  {(Object.entries(TEMPLATE_CONFIGS) as [TemplateStyle, TemplateCfg][]).map(([key, cfg]) => (
                    <button key={key} onClick={() => setStyle(key)} className={`relative rounded-xl border-2 p-3 text-left transition-all ${style === key ? "border-orange-500 ring-2 ring-orange-500/20" : isDark ? "border-white/10 hover:border-white/30" : "border-gray-200 hover:border-gray-300"}`}>
                      <div className="w-full h-14 rounded-lg mb-2.5 flex items-center justify-center overflow-hidden" style={{ background: cfg.previewBg }}>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ color: cfg.previewText, fontSize: 9, fontWeight: "bold", fontFamily: cfg.hookFont, lineHeight: 1.2 }}>HOOK TEXT</div>
                          <div style={{ color: cfg.previewAccent, fontSize: 7, marginTop: 2, fontFamily: cfg.bodyFont }}>→ CTA here</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{cfg.emoji}</span>
                        <div>
                          <p className="text-xs font-semibold leading-tight">{cfg.label}</p>
                          <p className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>{cfg.description}</p>
                        </div>
                      </div>
                      {style === key && <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Layout picker */}
              <div className={`rounded-2xl border p-6 space-y-4 ${cardCls}`}>
                <div>
                  <label className="block text-sm font-semibold">Layout</label>
                  <p className={`text-xs mt-0.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>How text is arranged on the canvas</p>
                </div>
                <div className="flex gap-4 items-start">
                  {(Object.entries(LAYOUTS) as [LayoutId, { label: string; description: string }][]).map(([id, info]) => (
                    <div key={id} className="flex flex-col items-center gap-2">
                      <LayoutThumb id={id} cfg={TEMPLATE_CONFIGS[style]} selected={layout === id} onClick={() => setLayout(id)} />
                      <div className="text-center">
                        <p className="text-xs font-semibold">{info.label}</p>
                        <p className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>{info.description}</p>
                      </div>
                    </div>
                  ))}
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
                    {TEMPLATE_CONFIGS[style].label} · {LAYOUTS[layout].label} · {tone}
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
                  <PostPreview key={post.id} post={post} style={style} layout={layout} index={i} isDark={isDark}
                    onDelete={() => setPosts((prev) => prev.filter((p) => p.id !== post.id))}
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
                <Button variant="outline" onClick={() => { setStep(1); setPosts([]); setTopic(""); setSavedCount(0); setBundleId(null); setSelectedProductIds(new Set()); }} className={isDark ? "border-white/10 text-gray-300 hover:text-white" : ""}>
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
