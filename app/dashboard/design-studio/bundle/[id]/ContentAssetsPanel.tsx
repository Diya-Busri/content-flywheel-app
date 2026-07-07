"use client";

import React, { useEffect, useState } from "react";
import {
  Sparkles, Copy, Check, RotateCcw, ChevronDown, Hash,
  MessageSquare, Zap, Target, Globe, Download, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ContentAssets } from "@/db/schema/bundles-schema";

type RewriteAction = "shorter" | "longer" | "more viral" | "more emotional" | "more luxury" | "simpler" | "stronger cta" | "more educational";

const REWRITE_ACTIONS: { value: RewriteAction; label: string }[] = [
  { value: "shorter", label: "Shorter" },
  { value: "longer", label: "Longer" },
  { value: "more viral", label: "More viral" },
  { value: "more emotional", label: "More emotional" },
  { value: "more luxury", label: "More luxury" },
  { value: "simpler", label: "Simpler" },
  { value: "stronger cta", label: "Stronger CTA" },
  { value: "more educational", label: "More educational" },
];

function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
  }
  return { copy, isCopied: (key: string) => copiedKey === key };
}

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
    } finally {
      setRewriting(false);
    }
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

function SectionHeader({ icon, title, action }: { icon: React.ReactNode; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className="text-orange-500">{icon}</span>
        <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{title}</span>
      </div>
      {action}
    </div>
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

type SaveStatus = "idle" | "saving" | "saved";

export function ContentAssetsPanel({
  bundleId,
  bundleStyle,
  bundleTitle,
  initialAssets,
  isDark,
  onAssetsChange,
}: {
  bundleId: string;
  bundleStyle: string;
  bundleTitle: string;
  initialAssets: ContentAssets | null | undefined;
  isDark: boolean;
  onAssetsChange?: (assets: ContentAssets) => void;
}) {
  const [assets, setAssets] = useState<ContentAssets | null>(initialAssets ?? null);
  const [generating, setGenerating] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [captionTab, setCaptionTab] = useState<"tiktok" | "instagram">("instagram");
  const [platformTab, setPlatformTab] = useState<"instagram" | "tiktok" | "threads" | "twitter">("instagram");
  const [hashtagTab, setHashtagTab] = useState<"broad" | "niche" | "lowCompetition">("niche");
  const { copy, isCopied } = useCopy();

  // Sync when the parent's bundle fetch resolves — only fills in if we have no
  // local content yet (avoids overwriting in-progress edits).
  useEffect(() => {
    if (initialAssets && !assets) {
      setAssets(initialAssets);
    }
  }, [initialAssets]); // eslint-disable-line react-hooks/exhaustive-deps

  const dimCls = isDark ? "text-gray-400" : "text-gray-500";
  const cardCls = isDark
    ? "bg-[#1A1A1A] border-[#2A2A2A]"
    : "bg-white border-gray-200";

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/design-bundles/${bundleId}/generate-assets`, { method: "POST" });
      const json = await res.json();
      if (json.assets) {
        setAssets(json.assets);
        onAssetsChange?.(json.assets);
      } else {
        setError(json.error ?? "Failed to generate. Please try again.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setGenerating(false);
    }
  }

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

  function buildCopyAll(): string {
    if (!assets) return "";
    const sections: string[] = [
      `=== ${bundleTitle} — Social Media Package ===\n`,
      `--- INSTAGRAM CAPTION ---\n${assets.mainCaption.instagram}`,
      `--- TIKTOK CAPTION ---\n${assets.mainCaption.tiktok}`,
      `--- HOOKS ---\n${(assets.hooks ?? []).map((h, i) => `${i + 1}. ${h}`).join("\n")}`,
      `--- CTAs ---\n${(assets.ctaSuggestions ?? []).join("\n")}`,
      `--- HASHTAGS (NICHE) ---\n${(assets.hashtagSets?.niche ?? []).join(" ")}`,
      `--- HASHTAGS (BROAD) ---\n${(assets.hashtagSets?.broad ?? []).join(" ")}`,
      `--- HASHTAGS (LOW COMPETITION) ---\n${(assets.hashtagSets?.lowCompetition ?? []).join(" ")}`,
      `--- PLATFORM VARIANTS ---`,
      `Instagram: ${assets.platformVariants.instagram}`,
      `TikTok: ${assets.platformVariants.tiktok}`,
      `Threads: ${assets.platformVariants.threads}`,
      `X/Twitter: ${assets.platformVariants.twitter}`,
    ];
    return sections.join("\n\n");
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!assets) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8 text-center">
        <div className="w-20 h-20 rounded-2xl bg-orange-500/10 flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-orange-500" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
            Generate your content package
          </h3>
          <p className={`text-sm max-w-sm ${dimCls}`}>
            AI will write captions, hooks, CTAs, hashtags, and platform-ready copy — all matched to your{" "}
            <span className="font-semibold text-orange-500">{bundleStyle.replace(/-/g, " ")}</span> style.
          </p>
        </div>
        {error && (
          <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-4 py-2">
            {error}
          </p>
        )}
        <Button
          onClick={generate}
          disabled={generating}
          className="bg-orange-500 hover:bg-orange-600 text-white gap-2 px-6"
        >
          {generating ? (
            <><RotateCcw className="w-4 h-4 animate-spin" /> Generating…</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Generate Content Package</>
          )}
        </Button>
        <p className={`text-xs ${dimCls}`}>Usually takes 5–10 seconds</p>
      </div>
    );
  }

  // ── Tab bar helper ───────────────────────────────────────────────────────────
  function Tab<T extends string>({ value, active, onClick }: { value: T; active: boolean; onClick: () => void }) {
    return (
      <button
        onClick={onClick}
        className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors capitalize ${
          active
            ? "bg-orange-500 text-white"
            : isDark
            ? "text-gray-400 hover:text-white hover:bg-white/5"
            : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
        }`}
      >
        {value === "lowCompetition" ? "Low competition" : value === "twitter" ? "X / Twitter" : value}
      </button>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-8">

        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Content Package</h2>
            <div className={`flex items-center gap-2 mt-0.5 text-xs ${dimCls}`}>
              {saveStatus === "saving" && (
                <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</span>
              )}
              {saveStatus === "saved" && (
                <span className="flex items-center gap-1 text-emerald-500"><Check className="w-3 h-3" /> Saved</span>
              )}
              {saveStatus === "idle" && assets.generatedAt && (
                <span>Last updated {new Date(assets.generatedAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => copy(buildCopyAll(), "all")}
              className={`gap-1.5 text-xs ${isDark ? "border-[#2A2A2A] text-gray-300 hover:text-white" : ""}`}
            >
              {isCopied("all") ? <Check className="w-3 h-3" /> : <Download className="w-3 h-3" />}
              Copy All
            </Button>
            <Button
              size="sm"
              onClick={generate}
              disabled={generating}
              className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5 text-xs"
            >
              <RotateCcw className={`w-3 h-3 ${generating ? "animate-spin" : ""}`} />
              {generating ? "Regenerating…" : "Regenerate"}
            </Button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        {/* ── Captions ─────────────────────────────────────────────────────── */}
        <section className={`rounded-xl border p-4 ${cardCls}`}>
          <SectionHeader
            icon={<MessageSquare className="w-4 h-4" />}
            title="Caption"
            action={
              <div className="flex gap-1">
                {(["instagram", "tiktok"] as const).map((t) => (
                  <Tab key={t} value={t} active={captionTab === t} onClick={() => setCaptionTab(t)} />
                ))}
              </div>
            }
          />
          {captionTab === "instagram" ? (
            <TextBlock
              text={assets.mainCaption.instagram}
              id="caption-instagram"
              bundleId={bundleId}
              rows={7}
              context={`Style: ${bundleStyle}, Platform: Instagram`}
              onUpdate={(t) => patch("mainCaption", { ...assets.mainCaption, instagram: t })}
            />
          ) : (
            <TextBlock
              text={assets.mainCaption.tiktok}
              id="caption-tiktok"
              bundleId={bundleId}
              rows={5}
              context={`Style: ${bundleStyle}, Platform: TikTok`}
              onUpdate={(t) => patch("mainCaption", { ...assets.mainCaption, tiktok: t })}
            />
          )}
        </section>

        {/* ── Hooks ────────────────────────────────────────────────────────── */}
        <section className={`rounded-xl border p-4 ${cardCls}`}>
          <SectionHeader
            icon={<Zap className="w-4 h-4" />}
            title="Posting Hooks"
            action={
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copy((assets.hooks ?? []).join("\n"), "hooks-all")}
                className={`gap-1.5 text-xs h-7 ${dimCls}`}
              >
                {isCopied("hooks-all") ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                Copy all
              </Button>
            }
          />
          <div className="space-y-2">
            {(assets.hooks ?? []).map((hook, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 rounded-lg px-3 py-2.5 border ${
                  isDark ? "border-[#2A2A2A] bg-[#111]" : "border-gray-100 bg-gray-50"
                }`}
              >
                <span className={`text-[10px] font-bold w-4 shrink-0 ${dimCls}`}>{i + 1}</span>
                <input
                  value={hook}
                  onChange={(e) => {
                    const next = (assets.hooks ?? []).map((h, j) => (j === i ? e.target.value : h));
                    patch("hooks", next);
                  }}
                  className="flex-1 text-sm bg-transparent focus:outline-none text-gray-800 dark:text-gray-100 min-w-0"
                />
                <div className="flex gap-0.5 shrink-0">
                  <CopyBtn text={hook} id={`hook-${i}`} small />
                  <RewriteBtn
                    bundleId={bundleId}
                    text={hook}
                    context={`Posting hook for ${bundleStyle.replace(/-/g, " ")} style carousel`}
                    onRewrite={(t) => {
                      const next = (assets.hooks ?? []).map((h, j) => (j === i ? t : h));
                      patch("hooks", next);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTAs ─────────────────────────────────────────────────────────── */}
        <section className={`rounded-xl border p-4 ${cardCls}`}>
          <SectionHeader
            icon={<Target className="w-4 h-4" />}
            title="CTA Suggestions"
            action={
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copy((assets.ctaSuggestions ?? []).join("\n"), "ctas-all")}
                className={`gap-1.5 text-xs h-7 ${dimCls}`}
              >
                {isCopied("ctas-all") ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                Copy all
              </Button>
            }
          />
          <div className="flex flex-wrap gap-2">
            {(assets.ctaSuggestions ?? []).map((cta, i) => (
              <div
                key={i}
                className={`group flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  isDark ? "border-[#2A2A2A] bg-[#111] hover:border-orange-500/40" : "border-gray-200 bg-gray-50 hover:border-orange-300"
                }`}
              >
                <input
                  value={cta}
                  onChange={(e) => {
                    const next = (assets.ctaSuggestions ?? []).map((c, j) => (j === i ? e.target.value : c));
                    patch("ctaSuggestions", next);
                  }}
                  className="bg-transparent focus:outline-none text-sm text-gray-800 dark:text-gray-100 min-w-0 w-auto"
                  style={{ width: `${Math.max(cta.length, 6)}ch` }}
                />
                <button
                  onClick={() => copy(cta, `cta-${i}`)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-all"
                >
                  {isCopied(`cta-${i}`) ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ── Hashtags ─────────────────────────────────────────────────────── */}
        <section className={`rounded-xl border p-4 ${cardCls}`}>
          <SectionHeader
            icon={<Hash className="w-4 h-4" />}
            title="Hashtag Sets"
            action={
              <div className="flex gap-1">
                {(["niche", "broad", "lowCompetition"] as const).map((t) => (
                  <Tab key={t} value={t} active={hashtagTab === t} onClick={() => setHashtagTab(t)} />
                ))}
              </div>
            }
          />
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(assets.hashtagSets?.[hashtagTab] ?? []).map((tag, i) => (
              <button
                key={i}
                onClick={() => copy(tag, `tag-${hashtagTab}-${i}`)}
                className={`text-xs rounded-full px-2.5 py-1 border transition-colors font-mono ${
                  isCopied(`tag-${hashtagTab}-${i}`)
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
            size="sm"
            variant="ghost"
            onClick={() => copy((assets.hashtagSets?.[hashtagTab] ?? []).join(" "), `hashtags-${hashtagTab}`)}
            className={`gap-1.5 text-xs h-7 ${dimCls}`}
          >
            {isCopied(`hashtags-${hashtagTab}`) ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            Copy all {hashtagTab === "lowCompetition" ? "low-competition" : hashtagTab} hashtags
          </Button>
        </section>

        {/* ── Platform Variants ─────────────────────────────────────────────── */}
        <section className={`rounded-xl border p-4 ${cardCls}`}>
          <SectionHeader
            icon={<Globe className="w-4 h-4" />}
            title="Platform Variants"
            action={
              <div className="flex gap-1 flex-wrap justify-end">
                {(["instagram", "tiktok", "threads", "twitter"] as const).map((t) => (
                  <Tab key={t} value={t} active={platformTab === t} onClick={() => setPlatformTab(t)} />
                ))}
              </div>
            }
          />
          <TextBlock
            text={assets.platformVariants[platformTab]}
            id={`platform-${platformTab}`}
            bundleId={bundleId}
            rows={platformTab === "twitter" || platformTab === "threads" ? 3 : 5}
            context={`Platform: ${platformTab}, Style: ${bundleStyle}`}
            onUpdate={(t) => patch("platformVariants", { ...assets.platformVariants, [platformTab]: t })}
          />
          {platformTab === "twitter" && (
            <p className={`text-xs mt-1.5 ${dimCls}`}>
              {assets.platformVariants.twitter.length}/240 characters
            </p>
          )}
          {platformTab === "threads" && (
            <p className={`text-xs mt-1.5 ${dimCls}`}>
              {assets.platformVariants.threads.length}/500 characters
            </p>
          )}
        </section>

        <div className="pb-8" />
      </div>
    </div>
  );
}
