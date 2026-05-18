"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, ChevronLeft, Loader2, Trash2, Edit3, Download,
  Check, RefreshCw, ChevronRight, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardTheme } from "@/components/dashboard-theme-provider";
import { DesignData, DesignElement } from "@/db/schema/designs-schema";

// ── Types ─────────────────────────────────────────────────────────────────────

type ContentRow = {
  id: string;
  hook: string;
  mainText: string;
  cta: string;
  bgTheme: string;
};

type TemplateStyle =
  | "minimal-luxury"
  | "dark-aesthetic"
  | "wellness"
  | "clean-productivity"
  | "faceless-creator"
  | "modern-business";

// ── Template configs ───────────────────────────────────────────────────────────

type TemplateCfg = {
  label: string;
  description: string;
  emoji: string;
  bg: string;
  bgType: "solid" | "gradient";
  bgGradient?: { color1: string; color2: string; angle: number };
  headingColor: string;
  bodyColor: string;
  accentColor: string;
  hookFont: string;
  bodyFont: string;
  previewBg: string;
  previewText: string;
  previewAccent: string;
};

const TEMPLATE_CONFIGS: Record<TemplateStyle, TemplateCfg> = {
  "minimal-luxury": {
    label: "Minimal Luxury",
    description: "Clean, elegant, premium",
    emoji: "✨",
    bg: "#FAFAF7",
    bgType: "solid",
    headingColor: "#1A1A1A",
    bodyColor: "#4A4A4A",
    accentColor: "#C9A84C",
    hookFont: "Playfair Display",
    bodyFont: "Georgia",
    previewBg: "#FAFAF7",
    previewText: "#1A1A1A",
    previewAccent: "#C9A84C",
  },
  "dark-aesthetic": {
    label: "Dark Aesthetic",
    description: "Bold, edgy, raw",
    emoji: "🖤",
    bg: "#0D0D0D",
    bgType: "solid",
    headingColor: "#FFFFFF",
    bodyColor: "#CCCCCC",
    accentColor: "#FF6B35",
    hookFont: "Oswald",
    bodyFont: "Inter",
    previewBg: "#0D0D0D",
    previewText: "#FFFFFF",
    previewAccent: "#FF6B35",
  },
  "wellness": {
    label: "Wellness",
    description: "Calm, nurturing, natural",
    emoji: "🌿",
    bg: "#E8F0E8",
    bgType: "gradient",
    bgGradient: { color1: "#E8F0E8", color2: "#C5DBC5", angle: 160 },
    headingColor: "#2D5016",
    bodyColor: "#3D6B2A",
    accentColor: "#5C9A3E",
    hookFont: "Playfair Display",
    bodyFont: "Georgia",
    previewBg: "linear-gradient(160deg,#E8F0E8,#C5DBC5)",
    previewText: "#2D5016",
    previewAccent: "#5C9A3E",
  },
  "clean-productivity": {
    label: "Clean Productivity",
    description: "Clear, actionable, focused",
    emoji: "⚡",
    bg: "#FFFFFF",
    bgType: "solid",
    headingColor: "#1E3A5F",
    bodyColor: "#374151",
    accentColor: "#3B82F6",
    hookFont: "Inter",
    bodyFont: "Inter",
    previewBg: "#FFFFFF",
    previewText: "#1E3A5F",
    previewAccent: "#3B82F6",
  },
  "faceless-creator": {
    label: "Faceless Creator",
    description: "Mysterious, viral, relatable",
    emoji: "🎭",
    bg: "#1a1a2e",
    bgType: "gradient",
    bgGradient: { color1: "#1a1a2e", color2: "#16213e", angle: 135 },
    headingColor: "#FFFFFF",
    bodyColor: "#B0B8D0",
    accentColor: "#E94560",
    hookFont: "Oswald",
    bodyFont: "Inter",
    previewBg: "linear-gradient(135deg,#1a1a2e,#16213e)",
    previewText: "#FFFFFF",
    previewAccent: "#E94560",
  },
  "modern-business": {
    label: "Modern Business",
    description: "Professional, confident, results",
    emoji: "💼",
    bg: "#1E3A5F",
    bgType: "solid",
    headingColor: "#FFFFFF",
    bodyColor: "#CBD5E1",
    accentColor: "#F59E0B",
    hookFont: "Oswald",
    bodyFont: "Inter",
    previewBg: "#1E3A5F",
    previewText: "#FFFFFF",
    previewAccent: "#F59E0B",
  },
};

const TOPIC_SUGGESTIONS = [
  "Wellness tips for busy moms",
  "Faceless business motivation",
  "Productivity hacks",
  "Skincare advice",
  "TikTok Shop product tips",
  "Morning routine habits",
  "Digital product creator tips",
  "Mindset shifts for success",
  "Fitness motivation",
  "Financial freedom tips",
];

const COUNT_OPTIONS = [10, 20, 30];

// ── Design builder ─────────────────────────────────────────────────────────────

function buildPostDesign(post: ContentRow, style: TemplateStyle, postTitle: string): DesignData {
  const cfg = TEMPLATE_CONFIGS[style];
  const W = 1080, H = 1920;

  const elements: DesignElement[] = [
    {
      id: "hook",
      type: "text",
      x: 80,
      y: 500,
      width: W - 160,
      height: 480,
      content: post.hook,
      fontSize: 88,
      fontFamily: cfg.hookFont,
      color: cfg.headingColor,
      fontWeight: "bold",
      textAlign: "center",
      lineHeight: 1.1,
      zIndex: 2,
    },
    {
      id: "main",
      type: "text",
      x: 100,
      y: 1020,
      width: W - 200,
      height: 560,
      content: post.mainText,
      fontSize: 48,
      fontFamily: cfg.bodyFont,
      color: cfg.bodyColor,
      textAlign: "center",
      lineHeight: 1.5,
      zIndex: 2,
    },
    {
      id: "cta",
      type: "text",
      x: 80,
      y: 1680,
      width: W - 160,
      height: 120,
      content: post.cta,
      fontSize: 42,
      fontFamily: cfg.bodyFont,
      color: cfg.accentColor,
      fontWeight: "bold",
      textAlign: "center",
      zIndex: 2,
    },
  ];

  return {
    width: W,
    height: H,
    background: cfg.bg,
    backgroundType: cfg.bgType,
    backgroundGradient: cfg.bgGradient,
    elements,
    presetName: postTitle,
  };
}

// ── Mini preview card ─────────────────────────────────────────────────────────

const PREVIEW_SCALE = 0.175; // 1080 × 0.175 ≈ 189px wide, 1920 × 0.175 ≈ 336px tall

function PostPreview({
  post,
  style,
  index,
  onDelete,
  onEdit,
  isDark,
}: {
  post: ContentRow;
  style: TemplateStyle;
  index: number;
  onDelete: () => void;
  onEdit: () => void;
  isDark: boolean;
}) {
  const cfg = TEMPLATE_CONFIGS[style];
  const previewW = Math.round(1080 * PREVIEW_SCALE);
  const previewH = Math.round(1920 * PREVIEW_SCALE);

  const bgStyle: React.CSSProperties = cfg.bgType === "gradient" && cfg.bgGradient
    ? { background: `linear-gradient(${cfg.bgGradient.angle}deg, ${cfg.bgGradient.color1}, ${cfg.bgGradient.color2})` }
    : { background: cfg.bg };

  return (
    <div className={`group rounded-xl overflow-hidden border ${isDark ? "border-white/10 bg-[#1A1A1A]" : "border-gray-200 bg-white"} shadow-sm hover:shadow-md transition-shadow`}>
      {/* Canvas preview */}
      <div style={{ width: previewW, height: previewH, overflow: "hidden", position: "relative", flexShrink: 0 }}>
        <div
          style={{
            width: 1080,
            height: 1920,
            transform: `scale(${PREVIEW_SCALE})`,
            transformOrigin: "top left",
            position: "absolute",
            top: 0,
            left: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "120px 80px",
            gap: 60,
            ...bgStyle,
          }}
        >
          {/* Decorative accent line */}
          <div style={{ width: 80, height: 6, background: cfg.accentColor, borderRadius: 3, flexShrink: 0 }} />

          <div style={{
            fontFamily: cfg.hookFont,
            fontSize: 88,
            fontWeight: "bold",
            color: cfg.headingColor,
            textAlign: "center",
            lineHeight: 1.1,
            wordBreak: "break-word",
          }}>
            {post.hook}
          </div>

          <div style={{
            fontFamily: cfg.bodyFont,
            fontSize: 48,
            color: cfg.bodyColor,
            textAlign: "center",
            lineHeight: 1.5,
            wordBreak: "break-word",
          }}>
            {post.mainText}
          </div>

          <div style={{
            fontFamily: cfg.bodyFont,
            fontSize: 42,
            fontWeight: "bold",
            color: cfg.accentColor,
            textAlign: "center",
            padding: "24px 48px",
            border: `3px solid ${cfg.accentColor}`,
            borderRadius: 16,
            wordBreak: "break-word",
          }}>
            {post.cta}
          </div>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button
            onClick={onEdit}
            className="bg-white text-gray-900 rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1 hover:bg-orange-500 hover:text-white transition-colors"
          >
            <Edit3 className="w-3 h-3" /> Edit
          </button>
          <button
            onClick={onDelete}
            className="bg-white text-red-500 rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1 hover:bg-red-500 hover:text-white transition-colors"
          >
            <Trash2 className="w-3 h-3" /> Remove
          </button>
        </div>
      </div>

      {/* Card footer */}
      <div className={`px-2.5 py-2 border-t ${isDark ? "border-white/10" : "border-gray-100"}`}>
        <p className={`text-[10px] font-semibold truncate ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          Post {index + 1}
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BulkContentDesigner() {
  const router = useRouter();
  const { theme } = useDashboardTheme();
  const isDark = theme === "dark";

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState<TemplateStyle>("minimal-luxury");
  const [count, setCount] = useState(10);
  const [posts, setPosts] = useState<ContentRow[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const containerCls = isDark ? "bg-[#0F0F0F] text-white" : "bg-[#F9FAFB] text-gray-900";
  const cardCls = isDark ? "bg-[#1A1A1A] border-white/10" : "bg-white border-gray-200";

  async function generate() {
    if (!topic.trim()) return;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/designs/bulk-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, style, count }),
      });
      const json = await res.json() as { posts?: ContentRow[]; error?: string };
      if (!res.ok) { setGenError(json.error ?? "Generation failed"); return; }
      const rows = (json.posts ?? []).map((p, i) => ({
        ...p,
        id: `post-${i}-${Date.now()}`,
        hook: p.hook ?? "",
        mainText: p.mainText ?? "",
        cta: p.cta ?? "",
        bgTheme: p.bgTheme ?? "light",
      }));
      setPosts(rows);
      setStep(2);
    } catch {
      setGenError("Network error — please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveAll() {
    if (posts.length === 0) return;
    setSaving(true);
    setSavedCount(0);
    let saved = 0;

    // Save in batches of 5
    for (let i = 0; i < posts.length; i += 5) {
      const batch = posts.slice(i, i + 5);
      await Promise.all(batch.map(async (post) => {
        const designData = buildPostDesign(post, style, `${topic} — Post ${posts.indexOf(post) + 1}`);
        await fetch("/api/designs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `${topic} — Post ${posts.indexOf(post) + 1}`,
            data: designData,
          }),
        });
        saved++;
        setSavedCount(saved);
      }));
    }

    setSaving(false);
    setStep(3);
  }

  async function saveAndEdit(post: ContentRow, index: number) {
    const designData = buildPostDesign(post, style, `${topic} — Post ${index + 1}`);
    const res = await fetch("/api/designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${topic} — Post ${index + 1}`,
        data: designData,
      }),
    });
    const json = await res.json() as { design?: { id: string } };
    if (json.design?.id) router.push(`/dashboard/design-studio/${json.design.id}`);
  }

  function removePost(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  const bgHeader = isDark
    ? "bg-gradient-to-r from-orange-500/20 to-purple-500/20 border-b border-white/10"
    : "bg-gradient-to-r from-orange-50 to-purple-50 border-b border-gray-200";

  return (
    <div className={`flex flex-col min-h-full ${containerCls}`}>
      {/* Header */}
      <div className={`${bgHeader} px-6 py-5`}>
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard/design-studio")}
            className={`flex items-center gap-1.5 text-sm ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}
          >
            <ChevronLeft className="w-4 h-4" /> Design Studio
          </button>
          <div className={`h-4 w-px ${isDark ? "bg-white/20" : "bg-gray-300"}`} />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold">Bulk Content Designer</h1>
              <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                Generate branded social posts from AI content
              </p>
            </div>
          </div>

          {/* Step indicator */}
          <div className="ml-auto flex items-center gap-2">
            {([1, 2, 3] as const).map((s) => (
              <React.Fragment key={s}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s ? "bg-orange-500 text-white" :
                  step > s ? "bg-emerald-500 text-white" :
                  isDark ? "bg-white/10 text-gray-500" : "bg-gray-200 text-gray-400"
                }`}>
                  {step > s ? <Check className="w-3 h-3" /> : s}
                </div>
                {s < 3 && <div className={`w-8 h-px ${isDark ? "bg-white/10" : "bg-gray-300"}`} />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">

          {/* ── STEP 1: Setup ── */}
          {step === 1 && (
            <div className="max-w-2xl mx-auto space-y-8">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">What are you creating content about?</h2>
                <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  AI will generate {count} unique posts ready to publish
                </p>
              </div>

              {/* Topic input */}
              <div className={`rounded-2xl border p-6 space-y-4 ${cardCls}`}>
                <label className="block text-sm font-semibold">Your topic or niche</label>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && topic.trim()) generate(); }}
                  placeholder="e.g. Wellness tips for busy moms"
                  className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500 ${
                    isDark ? "bg-[#0F0F0F] border-white/10 text-white placeholder-gray-600" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"
                  }`}
                />
                <div className="flex flex-wrap gap-2">
                  {TOPIC_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setTopic(s)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        topic === s
                          ? "border-orange-500 bg-orange-500/10 text-orange-500"
                          : isDark ? "border-white/10 text-gray-400 hover:border-orange-500/50" : "border-gray-200 text-gray-500 hover:border-orange-300"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Style picker */}
              <div className={`rounded-2xl border p-6 space-y-4 ${cardCls}`}>
                <label className="block text-sm font-semibold">Template style</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(Object.entries(TEMPLATE_CONFIGS) as [TemplateStyle, TemplateCfg][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setStyle(key)}
                      className={`relative rounded-xl border-2 p-3 text-left transition-all ${
                        style === key
                          ? "border-orange-500 ring-2 ring-orange-500/20"
                          : isDark ? "border-white/10 hover:border-white/30" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {/* Mini palette preview */}
                      <div
                        className="w-full h-14 rounded-lg mb-2.5 flex items-center justify-center overflow-hidden"
                        style={{ background: cfg.previewBg }}
                      >
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
                      {style === key && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Count picker */}
              <div className={`rounded-2xl border p-6 space-y-4 ${cardCls}`}>
                <label className="block text-sm font-semibold">How many posts?</label>
                <div className="flex gap-3">
                  {COUNT_OPTIONS.map((n) => (
                    <button
                      key={n}
                      onClick={() => setCount(n)}
                      className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-colors ${
                        count === n
                          ? "border-orange-500 bg-orange-500 text-white"
                          : isDark ? "border-white/10 text-gray-300 hover:border-orange-500/50" : "border-gray-200 text-gray-700 hover:border-orange-300"
                      }`}
                    >
                      {n} posts
                    </button>
                  ))}
                </div>
              </div>

              {genError && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{genError}</p>
              )}

              <Button
                disabled={!topic.trim() || generating}
                onClick={generate}
                className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold gap-2 text-base rounded-xl"
              >
                {generating ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Generating {count} posts…</>
                ) : (
                  <><Sparkles className="w-5 h-5" /> Generate {count} Posts</>
                )}
              </Button>
            </div>
          )}

          {/* ── STEP 2: Preview & Edit ── */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">{posts.length} posts generated</h2>
                  <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    Hover any post to edit or remove · Style: {TEMPLATE_CONFIGS[style].label}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setStep(1); setGenError(null); }}
                    className={`gap-1.5 ${isDark ? "border-white/10 text-gray-300 hover:text-white" : ""}`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveAll}
                    disabled={saving || posts.length === 0}
                    className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
                  >
                    {saving ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving {savedCount}/{posts.length}…</>
                    ) : (
                      <><Download className="w-3.5 h-3.5" /> Save All to Design Studio</>
                    )}
                  </Button>
                </div>
              </div>

              {/* Post grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {posts.map((post, i) => (
                  <PostPreview
                    key={post.id}
                    post={post}
                    style={style}
                    index={i}
                    isDark={isDark}
                    onDelete={() => removePost(post.id)}
                    onEdit={() => saveAndEdit(post, i)}
                  />
                ))}
              </div>

              {posts.length === 0 && (
                <div className="text-center py-16">
                  <p className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>All posts removed.</p>
                  <Button variant="outline" size="sm" onClick={() => setStep(1)} className="mt-4">
                    Start over
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Done ── */}
          {step === 3 && (
            <div className="max-w-md mx-auto text-center py-16 space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
                <Check className="w-10 h-10 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">
                  {savedCount} posts saved!
                </h2>
                <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  Your branded posts are now in Design Studio. Open any to edit, export as PNG or PDF.
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => { setStep(1); setPosts([]); setTopic(""); setSavedCount(0); }}
                  className={isDark ? "border-white/10 text-gray-300 hover:text-white" : ""}
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> Create Another Batch
                </Button>
                <Button
                  onClick={() => router.push("/dashboard/design-studio")}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  View in Design Studio <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
