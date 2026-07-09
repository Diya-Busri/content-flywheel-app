"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, Copy, Check, RotateCcw, Hash,
  MessageSquare, Zap, Target, Globe, Download, Loader2,
  Layers, TrendingUp, ExternalLink, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ContentAssets } from "@/db/schema/bundles-schema";
import { DesignData } from "@/db/schema/designs-schema";
import { SlidePreview } from "@/app/dashboard/design-studio/SlidePreview";

// ─── Types ──────────────────────────────────────────────────────────────────

type RewriteAction =
  | "shorter" | "longer" | "more viral" | "more emotional"
  | "more luxury" | "simpler" | "stronger cta" | "more educational";

const REWRITE_ACTIONS: { value: RewriteAction; label: string }[] = [
  { value: "shorter",          label: "Shorter" },
  { value: "longer",           label: "Longer" },
  { value: "more viral",       label: "More viral" },
  { value: "more emotional",   label: "More emotional" },
  { value: "more luxury",      label: "More luxury" },
  { value: "simpler",          label: "Simpler" },
  { value: "stronger cta",     label: "Stronger CTA" },
  { value: "more educational", label: "More educational" },
];

export type SlideInfo = {
  id: string;
  previewUrl: string | null;
  title: string;
  data: DesignData;
};

const PLATFORMS = [
  { id: "instagram" as const, label: "Instagram", emoji: "📸" },
  { id: "tiktok"    as const, label: "TikTok",    emoji: "🎵" },
  { id: "threads"   as const, label: "Threads",   emoji: "🧵" },
  { id: "twitter"   as const, label: "X / Twitter", emoji: "𝕏" },
] as const;

type PlatformId = "instagram" | "tiktok" | "threads" | "twitter";

// ─── Hooks ──────────────────────────────────────────────────────────────────

function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
  }
  return { copy, isCopied: (key: string) => copiedKey === key };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CopyBtn({ text, id, small }: { text: string; id: string; small?: boolean }) {
  const { copy, isCopied } = useCopy();
  return (
    <button
      onClick={() => copy(text, id)}
      title="Copy"
      className={`shrink-0 rounded flex items-center justify-center transition-colors ${
        small ? "w-6 h-6" : "w-7 h-7"
      } ${isCopied(id) ? "text-emerald-500" : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
    >
      {isCopied(id) ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function RewriteBtn({
  bundleId, text, onRewrite, context,
}: {
  bundleId: string;
  text: string;
  onRewrite: (newText: string) => void;
  context?: string;
}) {
  const [rewriting, setRewriting] = useState(false);
  async function rewrite(action: RewriteAction) {
    setRewriting(true);
    try {
      const res = await fetch(`/api/design-bundles/${bundleId}/rewrite-asset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, action, context }),
      });
      const json = await res.json();
      if (json.text) onRewrite(json.text);
    } finally { setRewriting(false); }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={rewriting}
          title="Rewrite"
          className="shrink-0 w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-40 transition-colors"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${rewriting ? "animate-spin" : ""}`} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {REWRITE_ACTIONS.map((a) => (
          <DropdownMenuItem key={a.value} onClick={() => rewrite(a.value)}>
            {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TextBlock({
  text, id, bundleId, onUpdate, context, rows = 5,
}: {
  text: string;
  id: string;
  bundleId: string;
  onUpdate: (t: string) => void;
  context?: string;
  rows?: number;
}) {
  return (
    <div className="relative">
      <textarea
        value={text}
        onChange={(e) => onUpdate(e.target.value)}
        rows={rows}
        className="w-full text-sm leading-relaxed resize-none bg-transparent border rounded-lg p-3 pr-16 border-gray-200 dark:border-white/10 focus:outline-none focus:border-orange-400 dark:focus:border-orange-500 text-gray-800 dark:text-gray-100 placeholder-gray-400"
      />
      <div className="absolute top-2 right-2 flex gap-0.5">
        <CopyBtn text={text} id={id} />
        <RewriteBtn bundleId={bundleId} text={text} onRewrite={onUpdate} context={context} />
      </div>
    </div>
  );
}

function FieldLabel({ label, dimCls }: { label: string; dimCls: string }) {
  return (
    <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${dimCls}`}>
      {label}
    </p>
  );
}

function CollapsibleSection({
  title, icon, children, defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-orange-500">{icon}</span>
          <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{title}</span>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-400" />
          : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}

type SaveStatus = "idle" | "saving" | "saved";

// ─── Main component ──────────────────────────────────────────────────────────

export function ContentAssetsPanel({
  bundleId,
  bundleStyle,
  bundleTitle,
  initialAssets,
  isDark,
  slideCount,
  onAssetsChange,
  slides,
}: {
  bundleId: string;
  bundleStyle: string;
  bundleTitle: string;
  initialAssets: ContentAssets | null | undefined;
  isDark: boolean;
  slideCount?: number;
  onAssetsChange?: (assets: ContentAssets) => void;
  slides?: SlideInfo[];
}) {
  const router = useRouter();
  const [assets, setAssets] = useState<ContentAssets | null>(initialAssets ?? null);
  const [generating, setGenerating] = useState(false);
  const [sectionLoading, setSectionLoading] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<PlatformId>("instagram");
  const [hashtagTab, setHashtagTab] = useState<"broad" | "niche" | "lowCompetition">("niche");
  const { copy, isCopied } = useCopy();

  useEffect(() => {
    if (initialAssets && !assets) setAssets(initialAssets);
  }, [initialAssets]); // eslint-disable-line react-hooks/exhaustive-deps

  const dimCls  = isDark ? "text-gray-400" : "text-gray-500";
  const cardCls = isDark ? "bg-[#1A1A1A] border-[#2A2A2A]" : "bg-white border-gray-200";
  const rowCls  = isDark ? "border-[#2A2A2A] bg-[#111]" : "border-gray-100 bg-gray-50";

  // ── Find CTA slide ────────────────────────────────────────────────────────
  const ctaSlide = useMemo<SlideInfo | null>(() => {
    if (!slides || slides.length === 0) return null;
    const byCta = slides.find((s) => s.title?.toLowerCase().includes("cta"));
    return byCta ?? slides[slides.length - 1];
  }, [slides]);

  // Thumbnail sizing: 152px wide, maintain aspect ratio
  const THUMB_W = 152;
  const ctaThumbH = ctaSlide
    ? Math.round((THUMB_W * (ctaSlide.data.height ?? 1350)) / (ctaSlide.data.width ?? 1080))
    : 200;
  const ctaThumbScale = ctaSlide ? THUMB_W / (ctaSlide.data.width ?? 1080) : 1;

  // ── Generate all ─────────────────────────────────────────────────────────
  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/design-bundles/${bundleId}/generate-assets`, { method: "POST" });
      const json = await res.json();
      if (json.assets) { setAssets(json.assets); onAssetsChange?.(json.assets); }
      else setError(json.error ?? "Failed to generate. Please try again.");
    } catch { setError("Network error — please try again."); }
    finally { setGenerating(false); }
  }

  // ── Section regeneration ─────────────────────────────────────────────────
  async function generateSection(section: keyof ContentAssets) {
    setSectionLoading((prev) => ({ ...prev, [section]: true }));
    setError(null);
    try {
      const res = await fetch(`/api/design-bundles/${bundleId}/generate-assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section }),
      });
      const json = await res.json() as { section?: string; value?: unknown; error?: string };
      if (json.value !== undefined && json.section) {
        patch(json.section as keyof ContentAssets, json.value as ContentAssets[keyof ContentAssets]);
      } else setError(json.error ?? "Failed to regenerate.");
    } catch { setError("Network error — please try again."); }
    finally { setSectionLoading((prev) => ({ ...prev, [section]: false })); }
  }

  // Regen button used inside sections
  function RegenBtn({ section }: { section: keyof ContentAssets }) {
    const loading = sectionLoading[section as string];
    return (
      <button
        onClick={() => generateSection(section)}
        disabled={loading}
        title="Regenerate"
        className={`shrink-0 w-6 h-6 rounded flex items-center justify-center transition-colors disabled:opacity-40 ${
          isDark ? "text-gray-500 hover:text-orange-400" : "text-gray-400 hover:text-orange-500"
        }`}
      >
        <RotateCcw className={`w-3 h-3 ${loading ? "animate-spin text-orange-400" : ""}`} />
      </button>
    );
  }

  // ── Patch helper ─────────────────────────────────────────────────────────
  function patch<K extends keyof ContentAssets>(key: K, value: ContentAssets[K]) {
    setAssets((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      onAssetsChange?.(next);
      setSaveStatus("saving");
      fetch(`/api/design-bundles/${bundleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets: next }),
      })
        .then(() => {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2500);
        })
        .catch(() => setSaveStatus("idle"));
      return next;
    });
  }

  // ── Copy helpers ─────────────────────────────────────────────────────────
  function buildPlatformCopy(platform: PlatformId): string {
    if (!assets) return "";
    const caption = assets.platformVariants[platform];
    const hook    = (assets.hooks ?? [])[0] ?? "";
    const cta     = (assets.ctaSuggestions ?? [])[0] ?? "";
    const tags    = (assets.hashtagSets?.niche ?? []).join(" ");
    return [
      `--- CAPTION ---\n${caption}`,
      hook ? `--- HOOK ---\n${hook}` : "",
      cta  ? `--- CTA ---\n${cta}` : "",
      tags ? `--- HASHTAGS ---\n${tags}` : "",
    ].filter(Boolean).join("\n\n");
  }

  function buildCopyAll(): string {
    if (!assets) return "";
    return PLATFORMS.map((p) => `=== ${p.label} ===\n\n${buildPlatformCopy(p.id)}`).join("\n\n\n");
  }

  // ── Stat pill for overview bar ────────────────────────────────────────────
  function StatPill({ icon, label, active }: { icon: React.ReactNode; label: string; active: boolean }) {
    return (
      <div className={`flex items-center gap-1 text-[11px] rounded-full px-2.5 py-1 border font-medium ${
        active
          ? isDark ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-emerald-300 bg-emerald-50 text-emerald-700"
          : isDark ? "border-[#2A2A2A] text-gray-600" : "border-gray-200 text-gray-400"
      }`}>
        {icon}<span className="ml-0.5">{label}</span>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Empty state
  // ═══════════════════════════════════════════════════════════════════════════

  if (!assets) {
    const WHAT_YOU_GET = [
      { emoji: "📸", label: "Platform Captions",   note: "Instagram, TikTok, Threads, X" },
      { emoji: "🎣", label: "Scroll-Stopping Hooks", note: "First lines that demand attention" },
      { emoji: "⚡", label: "High-Convert CTAs",   note: "Copy that drives clicks & sales" },
      { emoji: "#️⃣", label: "Hashtag Sets",         note: "Niche + trending combos" },
      { emoji: "🔍", label: "SEO Title + Meta",    note: "Google-ready descriptions" },
      { emoji: "📧", label: "Email Subject Lines", note: "High-open-rate variants" },
      { emoji: "🎬", label: "Short-Form Hooks",    note: "Reels / Shorts / TikTok openers" },
    ];
    return (
      <div className="flex items-center justify-center h-full min-h-[500px] p-8">
        <div className="flex flex-col items-center gap-6 w-full max-w-[520px] text-center">

          {/* Hero glow icon */}
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-orange-500/20 blur-2xl scale-150" />
            <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-xl shadow-orange-500/30">
              <Sparkles className="w-9 h-9 text-white" />
            </div>
          </div>

          {/* Copy */}
          <div className="space-y-1.5">
            <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
              Your content package is one click away
            </h3>
            <p className={`text-sm leading-relaxed max-w-sm mx-auto ${dimCls}`}>
              AI writes{" "}
              <span className="font-semibold text-orange-500">7 types of launch content</span>{" "}
              tailored to your{" "}
              <span className="font-semibold">{bundleStyle.replace(/-/g, " ")}</span>{" "}
              product — ready to copy and post.
            </p>
          </div>

          {/* What you get grid */}
          <div className="w-full">
            <div className="grid grid-cols-2 gap-1.5">
              {WHAT_YOU_GET.map((item) => (
                <div key={item.label}
                  className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 bg-background border border-border/60 hover:border-orange-500/30 hover:bg-orange-500/3 transition-all text-left">
                  <span className="text-base leading-none mt-px shrink-0">{item.emoji}</span>
                  <div>
                    <p className="text-[12px] font-bold text-foreground leading-tight">{item.label}</p>
                    <p className={`text-[10px] leading-snug mt-0.5 ${dimCls}`}>{item.note}</p>
                  </div>
                </div>
              ))}
              {/* 7th item is odd — full width */}
            </div>
          </div>

          {/* Time estimate pill */}
          <div className={`flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full border ${isDark ? "border-white/10 text-gray-400 bg-white/5" : "border-orange-200 text-orange-600 bg-orange-50"}`}>
            <Zap className="w-3 h-3" />
            Usually ready in 5–10 seconds
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-2.5 w-full">
              {error}
            </p>
          )}

          <Button onClick={generate} disabled={generating} size="lg"
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white gap-2 px-10 text-[15px] font-bold shadow-xl shadow-orange-500/25 transition-all hover:shadow-orange-500/40 hover:-translate-y-px w-full max-w-xs">
            {generating ? (
              <><RotateCcw className="w-4 h-4 animate-spin" /> Generating your package…</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Generate Content Package</>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Filled state — publishing hub
  // ═══════════════════════════════════════════════════════════════════════════

  const activePlatformCfg = PLATFORMS.find((p) => p.id === activePlatform)!;
  const hooks = assets.hooks ?? [];
  const ctas  = assets.ctaSuggestions ?? [];
  const niche = assets.hashtagSets?.niche ?? [];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-5">

        {/* ── Campaign Overview ────────────────────────────────────────── */}
        <section className={`rounded-xl border p-4 ${cardCls}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-orange-500"><TrendingUp className="w-4 h-4" /></span>
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Campaign Overview</span>
            </div>
            <div className={`flex items-center gap-2 text-xs ${dimCls}`}>
              {saveStatus === "saving" && (
                <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</span>
              )}
              {saveStatus === "saved" && (
                <span className="flex items-center gap-1 text-emerald-500"><Check className="w-3 h-3" /> Saved</span>
              )}
              {saveStatus === "idle" && assets.generatedAt && (
                <span>Updated {new Date(assets.generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {slideCount !== undefined && (
              <StatPill icon={<Layers className="w-3 h-3" />} label={`${slideCount} slide${slideCount !== 1 ? "s" : ""}`} active={slideCount > 0} />
            )}
            <StatPill icon={<Globe className="w-3 h-3" />} label="4 platforms" active={!!(assets.platformVariants?.instagram)} />
            <StatPill icon={<Zap className="w-3 h-3" />} label={`${hooks.length} hooks`} active={hooks.length > 0} />
            <StatPill icon={<Target className="w-3 h-3" />} label={`${ctas.length} CTAs`} active={ctas.length > 0} />
            <StatPill icon={<Hash className="w-3 h-3" />} label="Hashtags" active={niche.length > 0} />
            <StatPill icon={<MessageSquare className="w-3 h-3" />} label="CTA slide" active={!!ctaSlide} />
          </div>
        </section>

        {/* ── Action row ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline"
              onClick={() => copy(buildCopyAll(), "all")}
              className={`gap-1.5 text-xs ${isDark ? "border-[#2A2A2A] text-gray-300 hover:text-white" : ""}`}
            >
              {isCopied("all") ? <Check className="w-3 h-3" /> : <Download className="w-3 h-3" />}
              Copy All Platforms
            </Button>
            <Button size="sm" onClick={generate} disabled={generating}
              className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5 text-xs"
            >
              <RotateCcw className={`w-3 h-3 ${generating ? "animate-spin" : ""}`} />
              {generating ? "Regenerating…" : "Regenerate All"}
            </Button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        {/* ── Platform tabs ────────────────────────────────────────────── */}
        <div className={`flex gap-1 p-1 rounded-xl border ${isDark ? "bg-[#1A1A1A] border-[#2A2A2A]" : "bg-gray-50 border-gray-200"}`}>
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => setActivePlatform(p.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activePlatform === p.id
                  ? "bg-orange-500 text-white shadow-sm"
                  : isDark
                  ? "text-gray-400 hover:text-white hover:bg-white/5"
                  : "text-gray-500 hover:text-gray-900 hover:bg-white"
              }`}
            >
              <span>{p.emoji}</span>
              <span className="hidden sm:inline">{p.label}</span>
            </button>
          ))}
        </div>

        {/* ── Platform publishing card ─────────────────────────────────── */}
        <section className={`rounded-xl border overflow-hidden ${cardCls}`}>

          {/* Card header */}
          <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? "border-[#2A2A2A]" : "border-gray-100"}`}>
            <div className="flex items-center gap-2">
              <span className="text-xl leading-none">{activePlatformCfg.emoji}</span>
              <span className="font-semibold text-sm">{activePlatformCfg.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm" variant="ghost"
                onClick={() => copy(buildPlatformCopy(activePlatform), `platform-${activePlatform}`)}
                className={`gap-1.5 text-xs h-7 ${dimCls}`}
              >
                {isCopied(`platform-${activePlatform}`) ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                Copy Package
              </Button>
              <RegenBtn section="platformVariants" />
            </div>
          </div>

          <div className="p-4 space-y-5">

            {/* Caption */}
            <div>
              <FieldLabel label="Caption" dimCls={dimCls} />
              <TextBlock
                text={assets.platformVariants[activePlatform]}
                id={`caption-${activePlatform}`}
                bundleId={bundleId}
                rows={activePlatform === "twitter" ? 3 : activePlatform === "threads" ? 4 : 6}
                context={`Style: ${bundleStyle}, Platform: ${activePlatformCfg.label}`}
                onUpdate={(t) => patch("platformVariants", { ...assets.platformVariants, [activePlatform]: t })}
              />
              {activePlatform === "twitter" && (
                <p className={`text-xs mt-1 ${dimCls}`}>
                  {assets.platformVariants.twitter.length} / 280 characters
                </p>
              )}
              {activePlatform === "threads" && (
                <p className={`text-xs mt-1 ${dimCls}`}>
                  {assets.platformVariants.threads.length} / 500 characters
                </p>
              )}
            </div>

            {/* Hook + CTA Slide — two column */}
            <div className="grid gap-4" style={{ gridTemplateColumns: ctaSlide ? "1fr auto" : "1fr" }}>
              <div className="space-y-5 min-w-0">

                {/* Hook */}
                {hooks.length > 0 && (
                  <div>
                    <FieldLabel label="Hook" dimCls={dimCls} />
                    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${rowCls}`}>
                      <span className={`text-[10px] font-bold w-4 shrink-0 ${dimCls}`}>1</span>
                      <input
                        value={hooks[0]}
                        onChange={(e) => {
                          const next = [...hooks];
                          next[0] = e.target.value;
                          patch("hooks", next);
                        }}
                        className="flex-1 text-sm bg-transparent focus:outline-none text-gray-800 dark:text-gray-100 min-w-0"
                      />
                      <div className="flex gap-0.5 shrink-0">
                        <CopyBtn text={hooks[0]} id={`hook-0-${activePlatform}`} small />
                        <RewriteBtn
                          bundleId={bundleId}
                          text={hooks[0]}
                          context={`Posting hook for ${bundleStyle.replace(/-/g, " ")} carousel, ${activePlatformCfg.label}`}
                          onRewrite={(t) => {
                            const next = [...hooks];
                            next[0] = t;
                            patch("hooks", next);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* CTA text */}
                {ctas.length > 0 && (
                  <div>
                    <FieldLabel label="CTA" dimCls={dimCls} />
                    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${rowCls}`}>
                      <input
                        value={ctas[0]}
                        onChange={(e) => {
                          const next = [...ctas];
                          next[0] = e.target.value;
                          patch("ctaSuggestions", next);
                        }}
                        className="flex-1 text-sm bg-transparent focus:outline-none text-gray-800 dark:text-gray-100 min-w-0"
                      />
                      <CopyBtn text={ctas[0]} id={`cta-0-${activePlatform}`} small />
                    </div>
                  </div>
                )}

                {/* Hashtags */}
                {niche.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <FieldLabel label="Hashtags" dimCls={dimCls} />
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => copy(niche.join(" "), `hashtags-${activePlatform}`)}
                        className={`gap-1 text-[10px] h-6 px-2 mb-2 ${dimCls}`}
                      >
                        {isCopied(`hashtags-${activePlatform}`) ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                        Copy all
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {niche.slice(0, 10).map((tag, i) => (
                        <button
                          key={i}
                          onClick={() => copy(tag, `tag-${activePlatform}-${i}`)}
                          className={`text-xs rounded-full px-2 py-0.5 border font-mono transition-colors ${
                            isCopied(`tag-${activePlatform}-${i}`)
                              ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600"
                              : isDark
                              ? "border-[#2A2A2A] bg-[#111] text-gray-300 hover:border-orange-500/40 hover:text-orange-400"
                              : "border-gray-200 bg-gray-50 text-gray-600 hover:border-orange-300 hover:text-orange-600"
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* CTA slide preview */}
              {ctaSlide && (
                <div className="flex flex-col gap-2 shrink-0">
                  <FieldLabel label="CTA Slide" dimCls={dimCls} />
                  <div
                    className={`rounded-lg overflow-hidden border ${isDark ? "border-[#2A2A2A]" : "border-gray-200"} shadow-sm`}
                    style={{ width: THUMB_W, height: ctaThumbH }}
                  >
                    {ctaSlide.previewUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={ctaSlide.previewUrl} alt="CTA Slide" className="w-full h-full object-cover" />
                      : <SlidePreview data={ctaSlide.data} scale={ctaThumbScale} />}
                  </div>
                  <button
                    onClick={() => router.push(`/dashboard/design-studio/${ctaSlide.id}`)}
                    className={`w-full flex items-center justify-center gap-1.5 text-[11px] font-medium py-2 rounded-lg border transition-colors ${
                      isDark
                        ? "border-[#2A2A2A] text-gray-400 hover:text-orange-400 hover:border-orange-500/40"
                        : "border-gray-200 text-gray-600 hover:text-orange-500 hover:border-orange-300"
                    }`}
                  >
                    <ExternalLink className="w-3 h-3" />
                    Edit in Studio
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Global libraries (collapsible) ──────────────────────────── */}

        <CollapsibleSection title="All Hooks" icon={<Zap className="w-3.5 h-3.5" />}>
          <div className="flex items-center justify-between mb-1">
            <Button size="sm" variant="ghost"
              onClick={() => copy(hooks.join("\n"), "hooks-all")}
              className={`gap-1.5 text-xs h-7 ${dimCls}`}>
              {isCopied("hooks-all") ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              Copy all
            </Button>
            <RegenBtn section="hooks" />
          </div>
          <div className="space-y-2">
            {hooks.map((hook, i) => (
              <div key={i} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${rowCls}`}>
                <span className={`text-[10px] font-bold w-4 shrink-0 ${dimCls}`}>{i + 1}</span>
                <input
                  value={hook}
                  onChange={(e) => {
                    const next = [...hooks];
                    next[i] = e.target.value;
                    patch("hooks", next);
                  }}
                  className="flex-1 text-sm bg-transparent focus:outline-none text-gray-800 dark:text-gray-100 min-w-0"
                />
                <div className="flex gap-0.5 shrink-0">
                  <CopyBtn text={hook} id={`hook-lib-${i}`} small />
                  <RewriteBtn
                    bundleId={bundleId}
                    text={hook}
                    context={`Posting hook for ${bundleStyle.replace(/-/g, " ")} carousel`}
                    onRewrite={(t) => { const next = [...hooks]; next[i] = t; patch("hooks", next); }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="All CTAs" icon={<Target className="w-3.5 h-3.5" />}>
          <div className="flex items-center justify-between mb-1">
            <Button size="sm" variant="ghost"
              onClick={() => copy(ctas.join("\n"), "ctas-all")}
              className={`gap-1.5 text-xs h-7 ${dimCls}`}>
              {isCopied("ctas-all") ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              Copy all
            </Button>
            <RegenBtn section="ctaSuggestions" />
          </div>
          <div className="flex flex-wrap gap-2">
            {ctas.map((cta, i) => (
              <div
                key={i}
                className={`group flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  isDark ? "border-[#2A2A2A] bg-[#111] hover:border-orange-500/40" : "border-gray-200 bg-gray-50 hover:border-orange-300"
                }`}
              >
                <input
                  value={cta}
                  onChange={(e) => {
                    const next = [...ctas];
                    next[i] = e.target.value;
                    patch("ctaSuggestions", next);
                  }}
                  className="bg-transparent focus:outline-none text-sm text-gray-800 dark:text-gray-100 min-w-0 w-auto"
                  style={{ width: `${Math.max(cta.length, 6)}ch` }}
                />
                <button
                  onClick={() => copy(cta, `cta-lib-${i}`)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-all"
                >
                  {isCopied(`cta-lib-${i}`) ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Hashtag Sets" icon={<Hash className="w-3.5 h-3.5" />}>
          <div className="flex items-center gap-1 mb-3 flex-wrap">
            {(["niche", "broad", "lowCompetition"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setHashtagTab(t)}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors capitalize ${
                  hashtagTab === t
                    ? "bg-orange-500 text-white"
                    : isDark
                    ? "text-gray-400 hover:text-white hover:bg-white/5"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                {t === "lowCompetition" ? "Low competition" : t}
              </button>
            ))}
            <div className={`w-px h-4 mx-0.5 ${isDark ? "bg-[#2A2A2A]" : "bg-gray-200"}`} />
            <RegenBtn section="hashtagSets" />
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(assets.hashtagSets?.[hashtagTab] ?? []).map((tag, i) => (
              <button
                key={i}
                onClick={() => copy(tag, `tag-lib-${hashtagTab}-${i}`)}
                className={`text-xs rounded-full px-2.5 py-1 border font-mono transition-colors ${
                  isCopied(`tag-lib-${hashtagTab}-${i}`)
                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600"
                    : isDark
                    ? "border-[#2A2A2A] bg-[#111] text-gray-300 hover:border-orange-500/40 hover:text-orange-400"
                    : "border-gray-200 bg-gray-50 text-gray-600 hover:border-orange-300 hover:text-orange-600"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <Button
            size="sm" variant="ghost"
            onClick={() => copy((assets.hashtagSets?.[hashtagTab] ?? []).join(" "), `hashtags-lib-${hashtagTab}`)}
            className={`gap-1.5 text-xs h-7 ${dimCls}`}
          >
            {isCopied(`hashtags-lib-${hashtagTab}`) ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            Copy all {hashtagTab === "lowCompetition" ? "low-competition" : hashtagTab} hashtags
          </Button>
        </CollapsibleSection>

        <div className="pb-8" />
      </div>
    </div>
  );
}
