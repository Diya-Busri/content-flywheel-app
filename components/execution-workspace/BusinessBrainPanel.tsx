/**
 * BusinessBrainPanel — Phase 2.0
 * ──────────────────────────────────────────────────────────────────────────────
 * Auto-triggers on first workspace visit after pipeline completion.
 * Calls POST /api/launch/brain, caches result in DB via the API.
 *
 * Sections:
 *  1. Header — Business Score ring + Launch Score ring + summary verdict
 *  2. Section grid — 6 scored cards (market, product, design, store, marketing, launch readiness)
 *  3. Smart Recommendations — priority-sorted, each with Apply Fix button
 */
"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import {
  Brain, Loader2, RefreshCw, CheckCircle2, AlertTriangle,
  XCircle, ArrowRight, TrendingUp, Package, Palette,
  Store, Megaphone, Rocket, ChevronDown, ChevronUp,
  Zap, Target, Sparkles,
} from "lucide-react";
import type { BrainResult, BrainRecommendation, LaunchStageResults } from "@/db/schema/launch-schema";

/* ─── Props ─────────────────────────────────────────────────────────────────── */

interface BusinessBrainPanelProps {
  launchId:     string;
  productId:    string;
  storeUrl:     string;
  goal:         string;
  initialBrain: BrainResult | undefined;
}

/* ─── Loading messages shown while brain is thinking ─────────────────────────── */

const LOADING_MESSAGES = [
  { emoji: "🔍", text: "Analysing market opportunity…" },
  { emoji: "📦", text: "Reviewing product quality…" },
  { emoji: "🎨", text: "Checking design effectiveness…" },
  { emoji: "🛍️", text: "Auditing store listing…" },
  { emoji: "📣", text: "Evaluating marketing content…" },
  { emoji: "🧠", text: "Generating smart recommendations…" },
];

/* ─── Score ring ─────────────────────────────────────────────────────────────── */

function ScoreRing({
  score, size = 80, label, sublabel,
}: {
  score: number; size?: number; label: string; sublabel?: string;
}) {
  const r = size / 2 - 6;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f97316" : score >= 40 ? "#fbbf24" : "#f87171";
  const fontSize = size >= 80 ? "text-[24px]" : "text-[14px]";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          className="-rotate-90"
          style={{ width: size, height: size }}
          viewBox={`0 0 ${size} ${size}`}
        >
          <circle cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke="currentColor" className="text-muted/20" strokeWidth="5" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={color} strokeWidth="5"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-black tabular-nums leading-none ${fontSize}`} style={{ color }}>
            {score}
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[11px] font-bold text-foreground">{label}</p>
        {sublabel && <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">{sublabel}</p>}
      </div>
    </div>
  );
}

/* ─── Section card ───────────────────────────────────────────────────────────── */

interface SectionCardProps {
  icon:      ReactNode;
  label:     string;
  score:     number;
  summary:   string;
  items?:    { label: string; type: "strength" | "issue" }[];
}

function SectionCard({ icon, label, score, summary, items }: SectionCardProps) {
  const [open, setOpen] = useState(false);
  const color = score >= 80 ? "text-green-400" : score >= 60 ? "text-orange-400" : score >= 40 ? "text-amber-400" : "text-red-400";
  const ring  = score >= 80 ? "#22c55e" : score >= 60 ? "#f97316" : score >= 40 ? "#fbbf24" : "#f87171";

  const r = 14;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  const issues    = items?.filter(i => i.type === "issue")    ?? [];
  const strengths = items?.filter(i => i.type === "strength") ?? [];
  const hasItems  = items && items.length > 0;

  return (
    <div className="rounded-xl border border-border/40 bg-card/60 overflow-hidden">
      <button
        onClick={() => hasItems && setOpen(v => !v)}
        className={[
          "w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors",
          hasItems ? "hover:bg-muted/20 cursor-pointer" : "cursor-default",
        ].join(" ")}
      >
        {/* Mini score ring */}
        <div className="relative w-9 h-9 shrink-0">
          <svg className="-rotate-90 w-9 h-9" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor"
              className="text-muted/20" strokeWidth="4" />
            <circle cx="18" cy="18" r={r} fill="none" stroke={ring} strokeWidth="4"
              strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1s ease" }} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-[9px] font-black tabular-nums ${color}`}>{score}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground/60">{icon}</span>
            <p className="text-[12px] font-bold text-foreground">{label}</p>
          </div>
          <p className="text-[10px] text-muted-foreground/60 leading-snug mt-0.5 line-clamp-2">{summary}</p>
        </div>

        {hasItems && (
          <div className="shrink-0 text-muted-foreground/30">
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        )}
      </button>

      {open && hasItems && (
        <div className="border-t border-border/30 px-3.5 py-2.5 space-y-1.5">
          {strengths.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground/70 leading-snug">{item.label}</p>
            </div>
          ))}
          {issues.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground/70 leading-snug">{item.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Recommendation card ────────────────────────────────────────────────────── */

const PRIORITY_STYLES = {
  high:   { badge: "bg-red-500/15 text-red-400 border-red-500/20",   dot: "bg-red-400",    label: "High priority" },
  medium: { badge: "bg-amber-500/15 text-amber-400 border-amber-500/20", dot: "bg-amber-400",  label: "Medium priority" },
  low:    { badge: "bg-muted/40 text-muted-foreground border-border/40",  dot: "bg-muted-foreground/40", label: "Low priority"  },
};

const CONFIDENCE_LABEL = {
  high:   "High confidence",
  medium: "Medium confidence",
  low:    "Lower confidence",
};

const ACTION_LABELS: Record<BrainRecommendation["actionType"], string> = {
  edit_product:       "Edit Product",
  edit_store:         "Edit Store",
  regenerate_design:  "Open Design Studio",
  edit_marketing:     "Edit Content",
  manual:             "View Details",
};

function RecommendationCard({
  rec, productId, storeUrl,
}: {
  rec: BrainRecommendation; productId: string; storeUrl: string;
}) {
  const p = PRIORITY_STYLES[rec.priority];
  const [expanded, setExpanded] = useState(false);

  /* Resolve actionHref — substitute real productId/storeUrl */
  const resolvedHref = rec.actionHref
    ?.replace("[id]",        productId)
    ?.replace("[launchId]",  "")
    ?? (rec.actionType === "edit_product"      ? `/dashboard/products/${productId}`
      : rec.actionType === "edit_store"        ? `/dashboard/products/${productId}#publish`
      : rec.actionType === "regenerate_design" ? "/dashboard/design-studio"
      : rec.actionType === "edit_marketing"    ? "/dashboard/workspace?tab=content"
      : undefined);

  return (
    <div className={[
      "rounded-xl border bg-card/60 overflow-hidden transition-shadow hover:shadow-sm",
      rec.priority === "high" ? "border-red-500/20" : "border-border/40",
    ].join(" ")}>
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${p.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
            {p.label}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-foreground leading-snug">{rec.title}</p>
          <p className="text-[11px] text-muted-foreground/70 mt-1 leading-snug">{rec.detail}</p>
        </div>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-2 border-t border-border/20 hover:bg-muted/20 transition-colors text-left"
      >
        <span className="text-[10px] text-muted-foreground/50 font-semibold flex-1">
          {expanded ? "Hide reasoning" : "Why this matters"}
        </span>
        {expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground/30" /> : <ChevronDown className="w-3 h-3 text-muted-foreground/30" />}
      </button>

      {expanded && (
        <div className="px-4 py-3 border-t border-border/20 bg-muted/10 space-y-2">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-1">Reasoning</p>
            <p className="text-[11px] text-muted-foreground/70 leading-snug">{rec.reasoning}</p>
          </div>
          {rec.impact && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-1">Expected impact</p>
              <p className="text-[11px] text-muted-foreground/70 leading-snug">{rec.impact}</p>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Confidence:</p>
            <p className="text-[9px] text-muted-foreground/60">{CONFIDENCE_LABEL[rec.confidence]}</p>
          </div>
        </div>
      )}

      {/* Apply Fix */}
      {resolvedHref && (
        <div className="px-4 pb-3 pt-2">
          <a
            href={resolvedHref}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[12px] font-bold transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            {ACTION_LABELS[rec.actionType]}
            <ArrowRight className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

export function BusinessBrainPanel({
  launchId, productId, storeUrl, goal, initialBrain,
}: BusinessBrainPanelProps) {
  const [brain,    setBrain]    = useState<BrainResult | null>(initialBrain ?? null);
  const [status,   setStatus]   = useState<"idle" | "loading" | "complete" | "error">(
    initialBrain ? "complete" : "idle"
  );
  const [msgIdx,   setMsgIdx]   = useState(0);
  const [error,    setError]    = useState<string | null>(null);

  /* Auto-run on mount if no cached result */
  useEffect(() => {
    if (!initialBrain) {
      void runBrain();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Cycle loading messages */
  useEffect(() => {
    if (status !== "loading") return;
    const t = setInterval(() => {
      setMsgIdx(i => (i + 1) % LOADING_MESSAGES.length);
    }, 2800);
    return () => clearInterval(t);
  }, [status]);

  const runBrain = useCallback(async () => {
    setStatus("loading");
    setError(null);
    setMsgIdx(0);
    try {
      const res = await fetch("/api/launch/brain", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ launchId }),
      });
      if (!res.ok) {
        const e = await res.json() as { error?: string };
        throw new Error(e.error ?? "Analysis failed");
      }
      const data = await res.json() as { brain: BrainResult };
      setBrain(data.brain);
      setStatus("complete");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setStatus("error");
    }
  }, [launchId]);

  /* ── Loading state ── */
  if (status === "loading") {
    const msg = LOADING_MESSAGES[msgIdx];
    return (
      <div className="mt-8">
        <BrainHeader />
        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.03] p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full border-2 border-purple-500/30 flex items-center justify-center">
            <Brain className="w-5 h-5 text-purple-400 animate-pulse" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-foreground">Business Brain is reviewing your launch</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">
              Analysing every AI-generated asset like an experienced founder
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-muted/30">
            <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin shrink-0" />
            <span className="text-[12px] text-foreground/80 font-medium">
              {msg.emoji} {msg.text}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/40">Usually takes 15–20 seconds</p>
        </div>
      </div>
    );
  }

  /* ── Error state ── */
  if (status === "error") {
    return (
      <div className="mt-8">
        <BrainHeader />
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] p-6 flex flex-col items-center gap-4 text-center">
          <XCircle className="w-8 h-8 text-red-400" />
          <div>
            <p className="text-[13px] font-bold text-foreground">Business Brain analysis failed</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">{error}</p>
          </div>
          <button
            onClick={() => void runBrain()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/40 hover:bg-muted/60 text-[12px] font-semibold text-foreground transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry analysis
          </button>
        </div>
      </div>
    );
  }

  /* ── Complete state ── */
  if (!brain) return null;

  const { sections, recommendations } = brain;

  const sectionCards = [
    {
      icon:    <TrendingUp className="w-3.5 h-3.5" />,
      label:   "Market Opportunity",
      score:   sections.marketOpportunity.score,
      summary: sections.marketOpportunity.summary,
      items:   sections.marketOpportunity.insights.map(s => ({ label: s, type: "strength" as const })),
    },
    {
      icon:    <Package className="w-3.5 h-3.5" />,
      label:   "Product",
      score:   sections.product.score,
      summary: sections.product.summary,
      items:   [
        ...sections.product.strengths.map(s => ({ label: s, type: "strength" as const })),
        ...sections.product.issues.map(s => ({ label: s, type: "issue" as const })),
      ],
    },
    {
      icon:    <Palette className="w-3.5 h-3.5" />,
      label:   "Design",
      score:   sections.design.score,
      summary: sections.design.summary,
      items:   sections.design.issues.map(s => ({ label: s, type: "issue" as const })),
    },
    {
      icon:    <Store className="w-3.5 h-3.5" />,
      label:   "Store",
      score:   sections.store.score,
      summary: sections.store.summary,
      items:   sections.store.issues.map(s => ({ label: s, type: "issue" as const })),
    },
    {
      icon:    <Megaphone className="w-3.5 h-3.5" />,
      label:   "Marketing",
      score:   sections.marketing.score,
      summary: sections.marketing.summary,
      items:   sections.marketing.issues.map(s => ({ label: s, type: "issue" as const })),
    },
    {
      icon:    <Rocket className="w-3.5 h-3.5" />,
      label:   "Launch Readiness",
      score:   sections.launchReadiness.score,
      summary: sections.launchReadiness.explanation,
      items:   [],
    },
  ];

  const highRecs   = recommendations.filter(r => r.priority === "high");
  const medRecs    = recommendations.filter(r => r.priority === "medium");
  const lowRecs    = recommendations.filter(r => r.priority === "low");

  return (
    <div className="mt-8 space-y-5">

      <BrainHeader onRerun={() => void runBrain()} />

      {/* ── Score header ── */}
      <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/[0.06] to-purple-600/[0.02] p-5">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Score rings */}
          <div className="flex items-center gap-6 shrink-0">
            <ScoreRing score={brain.businessScore} size={88} label="Business Score" sublabel="overall" />
            <div className="h-14 w-px bg-border/30" />
            <ScoreRing score={brain.launchScore}   size={88} label="Launch Score"   sublabel="readiness" />
          </div>

          {/* Summary */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-purple-400 shrink-0" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-purple-400">Founder Review</p>
            </div>
            <p className="text-[13px] text-foreground/90 leading-relaxed">{brain.reviewSummary}</p>
            <p className="text-[10px] text-muted-foreground/40 mt-2">
              Reviewed {new Date(brain.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      </div>

      {/* ── Section grid ── */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">
          Section Reviews
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {sectionCards.map(card => (
            <SectionCard key={card.label} {...card} />
          ))}
        </div>
      </div>

      {/* ── Smart Recommendations ── */}
      {recommendations.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50">
              Smart Recommendations
            </p>
            <span className="ml-auto text-[10px] font-bold text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full">
              {recommendations.length} action{recommendations.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-3">
            {[...highRecs, ...medRecs, ...lowRecs].map(rec => (
              <RecommendationCard
                key={rec.id}
                rec={rec}
                productId={productId}
                storeUrl={storeUrl}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

/* ─── Section header (shared between loading/error/complete) ─────────────────── */

function BrainHeader({ onRerun }: { onRerun?: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Brain className="w-4 h-4 text-purple-400 shrink-0" />
      <h2 className="text-[14px] font-black tracking-tight text-foreground">
        Business Brain
      </h2>
      <div className="flex-1 h-px bg-border/30" />
      {onRerun && (
        <button
          onClick={onRerun}
          className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Re-analyse
        </button>
      )}
    </div>
  );
}
