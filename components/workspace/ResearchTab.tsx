"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Sparkles, Loader2, ChevronDown, ChevronUp,
  TrendingUp, Globe, Users, ShoppingBag, BarChart3,
  Lightbulb, Target, FileText, Wand2, Package,
  Mic, Layers, Video, StickyNote, BookmarkPlus,
  Send, AlertCircle, RefreshCw, Copy, Check,
  ArrowRight, Zap, Hash, Star, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContentOpp {
  title: string;
  description: string;
  format: string;
  difficulty: "Easy" | "Medium" | "Hard";
}

interface ProductOpp {
  title: string;
  description: string;
  type: string;
  priceRange: string;
}

interface Competitor {
  name: string;
  strength: string;
  gap: string;
}

interface Keyword {
  term: string;
  intent: "informational" | "commercial" | "transactional";
  opportunity: "High" | "Medium" | "Low";
  note: string;
}

interface ActionStep {
  step: number;
  action: string;
  detail: string;
  cta: string;
}

interface RecommendedOpp {
  name: string;
  why: string;
  demand: "Very High" | "High" | "Medium" | "Low";
  competition: "Very High" | "High" | "Medium" | "Low";
  monetisationPotential: "Very High" | "High" | "Medium" | "Low";
  contentPotential: "Very High" | "High" | "Medium" | "Low";
  estimatedRevenue: string;
  timeToFirstSale: string;
}

interface BuildPath {
  withFlywheel: {
    estimatedTime: string;
    difficulty: "Easy" | "Medium" | "Hard";
    steps: string[];
  };
  manually: {
    estimatedTime: string;
    tools: string[];
    note: string;
  };
}

interface AiRecommendation {
  nextStep: string;
  category: "Build Now" | "Validate First" | "Create Content First" | "Research More";
  reasoning: string;
}

interface ResearchReport {
  summary: string;
  insights: string[];
  trendingProblems: string[];
  contentOpportunities: ContentOpp[];
  productOpportunities: ProductOpp[];
  competitorInsights: Competitor[];
  keywords: Keyword[];
  actionPlan: ActionStep[];
  recommendedOpportunity?: RecommendedOpp;
  buildPath?: BuildPath;
  aiRecommendation?: AiRecommendation;
}

type ResearchState = "idle" | "loading" | "done";

interface ResearchTabProps {
  onTabChange?: (tab: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LOADING_STEPS = [
  { label: "Scanning the web", icon: <Globe className="w-3.5 h-3.5" /> },
  { label: "Analysing market trends", icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { label: "Finding opportunities", icon: <Lightbulb className="w-3.5 h-3.5" /> },
  { label: "Building your report", icon: <Sparkles className="w-3.5 h-3.5" /> },
];

const SUGGESTED_QUERIES = [
  "Notion templates for solopreneurs",
  "AI tools for content creators in 2025",
  "Digital products for healthcare professionals",
  "Personal finance content for millennials UK",
  "Productivity systems for remote founders",
  "Social media automation for small businesses",
];

const SOURCES = [
  { id: "web", label: "Web", icon: Globe, active: true },
  { id: "social", label: "Social Media", icon: Users, active: false },
  { id: "communities", label: "Communities", icon: MessageSquare, active: false },
  { id: "marketplaces", label: "Marketplaces", icon: ShoppingBag, active: false },
  { id: "seo", label: "SEO Data", icon: BarChart3, active: false },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy:   "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  Medium: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  Hard:   "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

const INTENT_COLORS: Record<string, string> = {
  informational: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  commercial:    "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  transactional: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
};

const OPP_COLORS: Record<string, string> = {
  High:   "text-green-500",
  Medium: "text-yellow-500",
  Low:    "text-muted-foreground",
};

// Metrics where High = good (demand, monetisation, content potential)
const METRIC_COLORS: Record<string, string> = {
  "Very High": "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/25",
  "High":      "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  "Medium":    "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  "Low":       "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

// Competition where Low = good
const COMPETITION_COLORS: Record<string, string> = {
  "Very High": "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25",
  "High":      "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  "Medium":    "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  "Low":       "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
};

const CATEGORY_COLORS: Record<string, string> = {
  "Build Now":           "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/25",
  "Validate First":      "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/25",
  "Create Content First":"bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25",
  "Research More":       "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/25",
};

const FLYWHEEL_STEP_ROUTES: Record<string, string> = {
  "Generate Product":       "/dashboard/library",
  "Edit in Design Studio":  "/dashboard/design-studio",
  "Generate Carousel":      "/dashboard/design-studio",
  "Generate Video Guide":   "/dashboard/video-guide/new",
  "Generate Publishing Kit":"/dashboard/video-guide/new",
};

const LAUNCH_ROADMAP = [
  { label: "Research Done",          emoji: "🔍", route: null },
  { label: "Generate Product",       emoji: "📦", route: "/dashboard/library" },
  { label: "Edit in Design Studio",  emoji: "🎨", route: "/dashboard/design-studio" },
  { label: "Generate Carousel",      emoji: "📱", route: "/dashboard/design-studio" },
  { label: "Generate Video Guide",   emoji: "🎬", route: "/dashboard/video-guide/new" },
  { label: "Generate Publishing Kit",emoji: "🚀", route: "/dashboard/video-guide/new" },
  { label: "Launch",                 emoji: "⚡", route: "/dashboard/library" },
];

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  id, title, icon, badge, open, onToggle, children, accent,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  badge?: string | number;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className={cn(
      "rounded-2xl border border-border bg-card overflow-hidden transition-all",
      accent,
    )}>
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-accent/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-orange-500">{icon}</span>
          <span className="font-semibold text-[15px] text-foreground">{title}</span>
          {badge !== undefined && (
            <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 text-[11px] font-bold">
              {badge}
            </span>
          )}
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

// ─── Quick action bar ─────────────────────────────────────────────────────────

function QuickActions({ actions }: { actions: { label: string; icon: React.ReactNode; onClick: () => void; primary?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/40">
      {actions.map((a, i) => (
        <button
          key={i}
          onClick={a.onClick}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all border",
            a.primary
              ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
              : "bg-background hover:bg-accent text-muted-foreground hover:text-foreground border-border"
          )}
        >
          {a.icon}
          {a.label}
        </button>
      ))}
    </div>
  );
}

// ─── Save confirmation hook ───────────────────────────────────────────────────

function useSaveToResearch() {
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const save = useCallback(async (key: string, title: string, content: string) => {
    setSaving(key);
    try {
      await fetch("/api/founder-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "research",
          type: "insight",
          title,
          content,
        }),
      });
      setSaved(prev => new Set([...Array.from(prev), key]));
      setTimeout(() => setSaved(prev => { const n = new Set(Array.from(prev)); n.delete(key); return n; }), 2500);
    } catch {
      // silent fail
    } finally {
      setSaving(null);
    }
  }, []);

  return { save, saving, saved };
}

// ─── CTA button mapping ───────────────────────────────────────────────────────

function CtaButton({ cta, router, onTabChange, context }: {
  cta: string;
  router: ReturnType<typeof useRouter>;
  onTabChange?: (tab: string) => void;
  context?: string;
}) {
  const configs: Record<string, { label: string; icon: React.ReactNode; action: () => void }> = {
    "Create Note":       { label: "Turn into Note",     icon: <StickyNote className="w-3 h-3" />,    action: () => onTabChange?.("notes") },
    "Generate Carousel": { label: "Generate Carousel",  icon: <Layers className="w-3 h-3" />,         action: () => router.push("/dashboard/design-studio") },
    "Generate Video":    { label: "Generate Video",     icon: <Video className="w-3 h-3" />,           action: () => router.push("/dashboard/video-guide/new") },
    "Generate Script":   { label: "Generate Script",    icon: <Mic className="w-3 h-3" />,             action: () => router.push("/dashboard/video-guide/new") },
    "Create Product":    { label: "Create Product",     icon: <Package className="w-3 h-3" />,         action: () => router.push("/dashboard/library") },
    "Open Design Studio":{ label: "Design Studio",      icon: <Wand2 className="w-3 h-3" />,           action: () => router.push("/dashboard/design-studio") },
  };

  const cfg = configs[cta];
  if (!cfg) return null;

  return (
    <button
      onClick={cfg.action}
      title={context}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/20 transition-all"
    >
      {cfg.icon}
      {cfg.label}
    </button>
  );
}

// ─── Recommended Opportunity Card ────────────────────────────────────────────

function RecommendedOpportunityCard({ opp }: { opp: RecommendedOpp }) {
  const metrics = [
    { label: "Demand",               value: opp.demand,               colors: METRIC_COLORS },
    { label: "Competition",          value: opp.competition,          colors: COMPETITION_COLORS },
    { label: "Monetisation",         value: opp.monetisationPotential,colors: METRIC_COLORS },
    { label: "Content Potential",    value: opp.contentPotential,     colors: METRIC_COLORS },
  ];

  return (
    <div className="rounded-2xl border-2 border-orange-500/30 bg-gradient-to-br from-orange-500/5 via-background to-amber-500/5 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-orange-500/20 bg-orange-500/5">
        <Star className="w-4 h-4 text-orange-500 fill-orange-500" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-orange-500">Top Opportunity</span>
        <span className="ml-auto text-[10px] font-medium text-orange-500/60 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
          AI Recommended
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Name */}
        <h3 className="text-[18px] font-bold text-foreground leading-snug">{opp.name}</h3>

        {/* Why */}
        <p className="text-[13px] text-foreground/80 leading-relaxed">{opp.why}</p>

        {/* Metric badges */}
        <div className="grid grid-cols-2 gap-2">
          {metrics.map(m => (
            <div key={m.label} className="flex items-center justify-between px-3 py-2 rounded-xl bg-background border border-border">
              <span className="text-[11px] font-medium text-muted-foreground">{m.label}</span>
              <span className={cn(
                "text-[11px] font-bold px-2 py-0.5 rounded-lg border",
                m.colors[m.value] ?? m.colors["Medium"]
              )}>
                {m.value}
              </span>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-medium">💰 Est. revenue</span>
            <span className="text-[12px] font-bold text-green-600 dark:text-green-400">{opp.estimatedRevenue}</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-medium">⏱ Time to first sale</span>
            <span className="text-[12px] font-bold text-foreground">{opp.timeToFirstSale}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Build Path comparison ────────────────────────────────────────────────────

function BuildPathSection({ buildPath, router }: {
  buildPath: BuildPath;
  router: ReturnType<typeof useRouter>;
}) {
  const { withFlywheel, manually } = buildPath;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/40">
        <Zap className="w-4 h-4 text-orange-500" />
        <span className="font-semibold text-[15px] text-foreground">Build Path</span>
        <span className="text-[11px] text-muted-foreground/50 ml-1">— two ways to launch</span>
      </div>

      <div className="grid grid-cols-2 divide-x divide-border">
        {/* ── Flywheel path ── */}
        <div className="p-5 space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500">🚀 With Content Flywheel</span>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-[28px] font-black text-orange-500 leading-none">{withFlywheel.estimatedTime.split("–")[0] ?? withFlywheel.estimatedTime}</span>
              {withFlywheel.estimatedTime.includes("–") && (
                <span className="text-[14px] font-bold text-orange-400/70">
                  –{withFlywheel.estimatedTime.split("–")[1]}
                </span>
              )}
            </div>
            <span className={cn(
              "inline-flex text-[11px] font-bold px-2 py-0.5 rounded-lg border",
              DIFFICULTY_COLORS[withFlywheel.difficulty] ?? DIFFICULTY_COLORS.Easy
            )}>
              {withFlywheel.difficulty}
            </span>
          </div>

          <div className="space-y-2">
            {withFlywheel.steps.map((step, i) => {
              const route = FLYWHEEL_STEP_ROUTES[step];
              return (
                <button
                  key={i}
                  onClick={() => route && router.push(route)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-medium text-left transition-all border",
                    route
                      ? "bg-orange-500/8 border-orange-500/20 text-orange-600 dark:text-orange-400 hover:bg-orange-500/15"
                      : "bg-muted/30 border-border text-muted-foreground cursor-default"
                  )}
                >
                  <span className="w-5 h-5 rounded-md bg-orange-500/15 text-orange-500 flex items-center justify-center text-[10px] font-black shrink-0">
                    {i + 1}
                  </span>
                  {step}
                  {route && <ArrowRight className="w-3 h-3 ml-auto opacity-60" />}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => router.push("/dashboard/library")}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold transition-all"
          >
            <Zap className="w-3.5 h-3.5" />
            Start Building
          </button>
        </div>

        {/* ── Manual path ── */}
        <div className="p-5 space-y-4 bg-muted/10">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">🔧 Build Manually</span>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-[28px] font-black text-muted-foreground/60 leading-none">{manually.estimatedTime.split("–")[0] ?? manually.estimatedTime}</span>
              {manually.estimatedTime.includes("–") && (
                <span className="text-[14px] font-bold text-muted-foreground/40">
                  –{manually.estimatedTime.split("–")[1]}
                </span>
              )}
            </div>
            <span className="inline-flex text-[11px] font-bold px-2 py-0.5 rounded-lg border bg-muted/40 border-border text-muted-foreground">
              More steps involved
            </span>
          </div>

          <div className="space-y-2">
            {manually.tools.map((tool, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-background border border-border text-[12px] text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                {tool}
              </div>
            ))}
          </div>

          {manually.note && (
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed italic">{manually.note}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Launch Roadmap ───────────────────────────────────────────────────────────

function LaunchRoadmap({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/40">
        <Target className="w-4 h-4 text-orange-500" />
        <span className="font-semibold text-[15px] text-foreground">Fastest Path to Launch</span>
      </div>
      <div className="px-5 py-5">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {LAUNCH_ROADMAP.map((step, i) => (
            <div key={i} className="flex items-center gap-1 shrink-0">
              {/* Node */}
              <button
                onClick={() => step.route && router.push(step.route)}
                className={cn(
                  "flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border text-center transition-all min-w-[90px]",
                  i === 0
                    ? "bg-green-500/10 border-green-500/25 text-green-600 dark:text-green-400 cursor-default"
                    : step.route
                    ? "bg-orange-500/8 border-orange-500/20 text-orange-600 dark:text-orange-400 hover:bg-orange-500/15 cursor-pointer"
                    : "bg-muted/20 border-border text-muted-foreground cursor-default"
                )}
              >
                <span className="text-[16px] leading-none">{step.emoji}</span>
                <span className="text-[10px] font-semibold leading-tight">{step.label}</span>
                {step.route && (
                  <ArrowRight className="w-2.5 h-2.5 opacity-50 rotate-90" />
                )}
              </button>

              {/* Arrow connector */}
              {i < LAUNCH_ROADMAP.length - 1 && (
                <div className="flex items-center shrink-0">
                  <div className="w-3 h-px bg-border" />
                  <ChevronDown className="w-3 h-3 text-muted-foreground/40 -rotate-90" />
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground/50 mt-3">
          Click any step to jump directly to that tool in Content Flywheel
        </p>
      </div>
    </div>
  );
}

// ─── AI Recommendation Card ───────────────────────────────────────────────────

function AiRecommendationCard({ rec, router, onTabChange }: {
  rec: AiRecommendation;
  router: ReturnType<typeof useRouter>;
  onTabChange?: (tab: string) => void;
}) {
  const ctaMap: Record<string, { label: string; action: () => void }> = {
    "Build Now":           { label: "Generate Product →", action: () => router.push("/dashboard/library") },
    "Validate First":      { label: "Generate Carousel →", action: () => router.push("/dashboard/design-studio") },
    "Create Content First":{ label: "Generate Script →", action: () => router.push("/dashboard/video-guide/new") },
    "Research More":       { label: "Refine Research", action: () => {} },
  };
  const cta = ctaMap[rec.category] ?? ctaMap["Build Now"];

  return (
    <div className="rounded-2xl border-2 border-orange-500/25 bg-gradient-to-br from-orange-500/5 to-background overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-orange-500/20">
        <Sparkles className="w-4 h-4 text-orange-500" />
        <span className="font-semibold text-[15px] text-foreground">Recommended Next Step</span>
        <span className={cn(
          "ml-auto text-[11px] font-bold px-2.5 py-1 rounded-full border",
          CATEGORY_COLORS[rec.category] ?? CATEGORY_COLORS["Build Now"]
        )}>
          {rec.category}
        </span>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-[16px] font-bold text-foreground leading-snug">
          &ldquo;{rec.nextStep}&rdquo;
        </p>
        <p className="text-[13px] text-foreground/75 leading-relaxed">{rec.reasoning}</p>

        <button
          onClick={cta.action}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[14px] font-semibold transition-all"
        >
          <Zap className="w-4 h-4" />
          {cta.label}
        </button>
      </div>
    </div>
  );
}

// ─── Main ResearchTab ─────────────────────────────────────────────────────────

export function ResearchTab({ onTabChange }: ResearchTabProps) {
  const router = useRouter();
  const { save, saving, saved } = useSaveToResearch();

  // State
  const [state, setState]             = useState<ResearchState>("idle");
  const [inputQuery, setInputQuery]   = useState("");
  const [query, setQuery]             = useState("");
  const [report, setReport]           = useState<ResearchReport | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set([
    "summary", "insights", "problems", "content", "product", "competitors", "keywords", "plan",
  ]));
  const [followUpInput, setFollowUpInput]   = useState("");
  const [followUpAnswer, setFollowUpAnswer] = useState<string | null>(null);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [copiedKeywords, setCopiedKeywords] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animate loading steps
  useEffect(() => {
    if (state === "loading") {
      setLoadingStep(0);
      let i = 0;
      stepTimerRef.current = setInterval(() => {
        i++;
        if (i < LOADING_STEPS.length) setLoadingStep(i);
        else if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      }, 1400);
    } else {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    }
    return () => { if (stepTimerRef.current) clearInterval(stepTimerRef.current); };
  }, [state]);

  const toggleSection = (id: string) =>
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleSearch = async () => {
    const q = inputQuery.trim();
    if (!q) return;
    setQuery(q);
    setReport(null);
    setError(null);
    setFollowUpAnswer(null);
    setFollowUpInput("");
    setState("loading");

    try {
      const res = await fetch("/api/research/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json() as { report?: ResearchReport; generatedAt?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Unknown error");
      setReport(data.report ?? null);
      setGeneratedAt(data.generatedAt ?? null);
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Research failed");
      setState("idle");
    }
  };

  const handleFollowUp = async () => {
    if (!followUpInput.trim() || !query) return;
    setFollowUpLoading(true);
    setFollowUpAnswer(null);
    try {
      const res = await fetch("/api/research/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followUp: followUpInput.trim(), reportContext: query }),
      });
      const data = await res.json() as { answer?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Unknown error");
      setFollowUpAnswer(data.answer ?? "");
    } catch {
      setFollowUpAnswer("Sorry, I couldn't answer that. Please try again.");
    } finally {
      setFollowUpLoading(false);
    }
  };

  const handleCopyKeywords = () => {
    if (!report) return;
    const terms = report.keywords.map(k => k.term).join(", ");
    navigator.clipboard.writeText(terms);
    setCopiedKeywords(true);
    setTimeout(() => setCopiedKeywords(false), 2000);
  };

  const handleSaveReport = () => {
    if (!report) return;
    const summary = `${query}\n\n${report.summary}\n\nKey Insights:\n${report.insights.map(i => `• ${i}`).join("\n")}`;
    save("full-report", `Research: ${query}`, summary);
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
  };

  // ── IDLE STATE — search hero ───────────────────────────────────────────────
  if (state === "idle") {
    return (
      <div className="max-w-3xl mx-auto space-y-8 py-4">

        {/* Hero */}
        <div className="text-center space-y-3 pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[12px] font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            AI Research Assistant
          </div>
          <h2 className="text-3xl font-bold text-foreground tracking-tight">
            Find your next opportunity
          </h2>
          <p className="text-muted-foreground text-[15px] max-w-xl mx-auto">
            Research any niche, market, or topic. Get an instant structured report with insights, opportunities, and a clear action plan.
          </p>
        </div>

        {/* Search box */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="p-4">
            <textarea
              ref={textareaRef}
              value={inputQuery}
              onChange={e => setInputQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSearch(); } }}
              placeholder="Research anything… e.g. 'Notion templates for nurses' or 'AI tools for freelancers UK'"
              rows={3}
              className="w-full bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground/50 outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Sources */}
          <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider mr-1">Sources</span>
            {SOURCES.map(s => (
              <div
                key={s.id}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[12px] font-medium transition-all",
                  s.active
                    ? "bg-orange-500/10 border-orange-500/30 text-orange-500"
                    : "bg-muted/30 border-border text-muted-foreground/40 cursor-not-allowed"
                )}
                title={s.active ? undefined : "Coming soon"}
              >
                <s.icon className="w-3 h-3" />
                {s.label}
                {!s.active && (
                  <span className="text-[9px] font-bold uppercase tracking-wider opacity-60 ml-0.5">Soon</span>
                )}
              </div>
            ))}
          </div>

          <div className="px-4 pb-4 flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground/40">
              Press Enter to research · Shift+Enter for new line
            </p>
            <Button
              onClick={handleSearch}
              disabled={!inputQuery.trim()}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 h-9 gap-2 shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
              Research
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Suggested queries */}
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50">
            Try these
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUERIES.map(q => (
              <button
                key={q}
                onClick={() => { setInputQuery(q); textareaRef.current?.focus(); }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card hover:bg-accent hover:border-orange-500/30 text-sm text-muted-foreground hover:text-foreground transition-all"
              >
                <ArrowRight className="w-3 h-3 text-orange-500 shrink-0" />
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Value props */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: <TrendingUp className="w-4 h-4 text-orange-500" />, title: "Market Opportunities", desc: "Discover gaps before your competitors do" },
            { icon: <Target className="w-4 h-4 text-orange-500" />,     title: "Actionable Plans",     desc: "Step-by-step next actions, not just insights" },
            { icon: <Zap className="w-4 h-4 text-orange-500" />,        title: "Instant Execution",    desc: "One click to turn research into content or products" },
          ].map((item, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
              {item.icon}
              <p className="text-[13px] font-semibold text-foreground">{item.title}</p>
              <p className="text-[12px] text-muted-foreground/70">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── LOADING STATE ──────────────────────────────────────────────────────────
  if (state === "loading") {
    return (
      <div className="max-w-3xl mx-auto py-16 space-y-10">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6 text-orange-500 animate-pulse" />
          </div>
          <h3 className="text-xl font-bold text-foreground">Researching your topic…</h3>
          <p className="text-sm text-muted-foreground italic">&ldquo;{query}&rdquo;</p>
        </div>

        <div className="space-y-3 max-w-sm mx-auto">
          {LOADING_STEPS.map((step, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-500",
                i < loadingStep
                  ? "bg-green-500/5 border-green-500/20 text-green-600 dark:text-green-400"
                  : i === loadingStep
                  ? "bg-orange-500/10 border-orange-500/30 text-orange-500"
                  : "bg-muted/20 border-border text-muted-foreground/40"
              )}
            >
              {i < loadingStep ? (
                <Check className="w-4 h-4 shrink-0" />
              ) : i === loadingStep ? (
                <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
              ) : (
                <div className="w-4 h-4 shrink-0 rounded-full border border-current opacity-30" />
              )}
              <span className="text-[13px] font-medium">{step.label}</span>
            </div>
          ))}
        </div>

        <p className="text-center text-[12px] text-muted-foreground/40">
          This usually takes 10–20 seconds for a full report
        </p>
      </div>
    );
  }

  // ── DONE STATE — full report ───────────────────────────────────────────────
  if (!report) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-12">

      {/* Report header */}
      <div className="flex items-start justify-between gap-4 py-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50">Research Report</span>
            {generatedAt && (
              <span className="text-[11px] text-muted-foreground/40">· {formatTime(generatedAt)}</span>
            )}
          </div>
          <h2 className="text-xl font-bold text-foreground leading-tight">{query}</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleSaveReport}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-all",
              saved.has("full-report")
                ? "bg-green-500/10 border-green-500/20 text-green-600"
                : "bg-background hover:bg-accent border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {saving === "full-report" ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : saved.has("full-report") ? (
              <Check className="w-3 h-3" />
            ) : (
              <BookmarkPlus className="w-3 h-3" />
            )}
            {saved.has("full-report") ? "Saved!" : "Save Report"}
          </button>
          <button
            onClick={() => { setState("idle"); setReport(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-accent text-[12px] font-medium text-muted-foreground hover:text-foreground transition-all"
          >
            <RefreshCw className="w-3 h-3" />
            New Research
          </button>
        </div>
      </div>

      {/* ── Recommended Opportunity ───────────────────────────────────────── */}
      {report.recommendedOpportunity && (
        <RecommendedOpportunityCard opp={report.recommendedOpportunity} />
      )}

      {/* ── Build Path comparison ──────────────────────────────────────────── */}
      {report.buildPath && (
        <BuildPathSection buildPath={report.buildPath} router={router} />
      )}

      {/* ── Fastest Path to Launch roadmap ────────────────────────────────── */}
      <LaunchRoadmap router={router} />

      {/* ── 1. Executive Summary ───────────────────────────────────────────── */}
      <Section
        id="summary"
        title="Executive Summary"
        icon={<FileText className="w-4 h-4" />}
        open={openSections.has("summary")}
        onToggle={toggleSection}
      >
        <div className="space-y-3">
          {report.summary.split(/\n\n+/).map((para, i) => (
            <p key={i} className="text-[14px] text-foreground/90 leading-relaxed">{para}</p>
          ))}
          <QuickActions actions={[
            {
              label: "Save to Research", icon: <BookmarkPlus className="w-3 h-3" />,
              onClick: () => save("summary", `Summary: ${query}`, report.summary),
            },
            {
              label: "Turn into Note", icon: <StickyNote className="w-3 h-3" />,
              onClick: () => onTabChange?.("notes"),
            },
          ]} />
        </div>
      </Section>

      {/* ── 2. Key Insights ───────────────────────────────────────────────── */}
      <Section
        id="insights"
        title="Key Insights"
        icon={<Lightbulb className="w-4 h-4" />}
        badge={report.insights.length}
        open={openSections.has("insights")}
        onToggle={toggleSection}
      >
        <ul className="space-y-3">
          {report.insights.map((insight, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-[14px] text-foreground/90 leading-relaxed">{insight}</p>
            </li>
          ))}
        </ul>
        <QuickActions actions={[
          {
            label: "Turn into Carousel", icon: <Layers className="w-3 h-3" />,
            onClick: () => router.push("/dashboard/design-studio"), primary: true,
          },
          {
            label: "Save Insights", icon: <BookmarkPlus className="w-3 h-3" />,
            onClick: () => save("insights", `Insights: ${query}`, report.insights.map((i, n) => `${n + 1}. ${i}`).join("\n")),
          },
        ]} />
      </Section>

      {/* ── 3. Trending Problems ──────────────────────────────────────────── */}
      <Section
        id="problems"
        title="Trending Problems"
        icon={<TrendingUp className="w-4 h-4" />}
        badge={report.trendingProblems.length}
        open={openSections.has("problems")}
        onToggle={toggleSection}
      >
        <div className="space-y-2">
          {report.trendingProblems.map((problem, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/10 hover:border-red-500/20 transition-colors">
              <span className="text-red-500 shrink-0 mt-0.5">⚡</span>
              <p className="text-[13px] text-foreground/90 leading-relaxed">{problem}</p>
            </div>
          ))}
        </div>
        <QuickActions actions={[
          {
            label: "Generate Script", icon: <Mic className="w-3 h-3" />,
            onClick: () => router.push("/dashboard/video-guide/new"), primary: true,
          },
          {
            label: "Turn into Note", icon: <StickyNote className="w-3 h-3" />,
            onClick: () => onTabChange?.("notes"),
          },
          {
            label: "Save Problems", icon: <BookmarkPlus className="w-3 h-3" />,
            onClick: () => save("problems", `Problems: ${query}`, report.trendingProblems.map(p => `• ${p}`).join("\n")),
          },
        ]} />
      </Section>

      {/* ── 4. Content Opportunities ──────────────────────────────────────── */}
      <Section
        id="content"
        title="Content Opportunities"
        icon={<Layers className="w-4 h-4" />}
        badge={report.contentOpportunities.length}
        open={openSections.has("content")}
        onToggle={toggleSection}
      >
        <div className="space-y-3">
          {report.contentOpportunities.map((opp, i) => (
            <div key={i} className="p-4 rounded-xl border border-border bg-background hover:bg-accent/20 transition-colors group">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-semibold text-foreground">{opp.title}</p>
                    <span className="px-2 py-0.5 rounded-md border text-[10px] font-bold bg-blue-500/8 border-blue-500/20 text-blue-500 dark:text-blue-400">
                      {opp.format}
                    </span>
                    <span className={cn("px-2 py-0.5 rounded-md border text-[10px] font-bold", DIFFICULTY_COLORS[opp.difficulty] ?? DIFFICULTY_COLORS.Medium)}>
                      {opp.difficulty}
                    </span>
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">{opp.description}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => router.push("/dashboard/video-guide/new")}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/20 transition-all"
                >
                  <Mic className="w-3 h-3" />Generate Script
                </button>
                <button
                  onClick={() => router.push("/dashboard/design-studio")}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-background hover:bg-accent text-muted-foreground border border-border transition-all"
                >
                  <Layers className="w-3 h-3" />Make Carousel
                </button>
              </div>
            </div>
          ))}
        </div>
        <QuickActions actions={[
          {
            label: "Open Design Studio", icon: <Wand2 className="w-3 h-3" />,
            onClick: () => router.push("/dashboard/design-studio"), primary: true,
          },
          {
            label: "Save Opportunities", icon: <BookmarkPlus className="w-3 h-3" />,
            onClick: () => save("content-opps", `Content Opps: ${query}`,
              report.contentOpportunities.map(o => `${o.title} (${o.format}, ${o.difficulty})\n${o.description}`).join("\n\n")),
          },
        ]} />
      </Section>

      {/* ── 5. Product Opportunities ──────────────────────────────────────── */}
      <Section
        id="product"
        title="Product Opportunities"
        icon={<Package className="w-4 h-4" />}
        badge={report.productOpportunities.length}
        open={openSections.has("product")}
        onToggle={toggleSection}
      >
        <div className="space-y-3">
          {report.productOpportunities.map((opp, i) => (
            <div key={i} className="p-4 rounded-xl border border-border bg-background hover:bg-accent/20 transition-colors group">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-semibold text-foreground">{opp.title}</p>
                    <span className="px-2 py-0.5 rounded-md border text-[10px] font-bold bg-purple-500/8 border-purple-500/20 text-purple-500 dark:text-purple-400">
                      {opp.type}
                    </span>
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">{opp.description}</p>
                  <p className="text-[12px] font-bold text-green-600 dark:text-green-400">{opp.priceRange}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => router.push("/dashboard/library")}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/20 transition-all"
                >
                  <Package className="w-3 h-3" />Create Product
                </button>
                <button
                  onClick={() => save(`product-${i}`, opp.title, `${opp.description}\n\nType: ${opp.type}\nPrice: ${opp.priceRange}`)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-background hover:bg-accent text-muted-foreground border border-border transition-all"
                >
                  {saved.has(`product-${i}`) ? <Check className="w-3 h-3 text-green-500" /> : <BookmarkPlus className="w-3 h-3" />}
                  {saved.has(`product-${i}`) ? "Saved!" : "Save Idea"}
                </button>
              </div>
            </div>
          ))}
        </div>
        <QuickActions actions={[
          {
            label: "Create Digital Product", icon: <Package className="w-3 h-3" />,
            onClick: () => router.push("/dashboard/library"), primary: true,
          },
          {
            label: "Save All", icon: <BookmarkPlus className="w-3 h-3" />,
            onClick: () => save("product-opps", `Product Opps: ${query}`,
              report.productOpportunities.map(o => `${o.title}\n${o.description}\nType: ${o.type} · ${o.priceRange}`).join("\n\n")),
          },
        ]} />
      </Section>

      {/* ── 6. Competitor Insights ────────────────────────────────────────── */}
      <Section
        id="competitors"
        title="Competitor Insights"
        icon={<Star className="w-4 h-4" />}
        badge={report.competitorInsights.length}
        open={openSections.has("competitors")}
        onToggle={toggleSection}
      >
        <div className="space-y-3">
          {report.competitorInsights.map((comp, i) => (
            <div key={i} className="p-4 rounded-xl border border-border bg-background space-y-3">
              <p className="text-[13px] font-bold text-foreground">{comp.name}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Strength</p>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">{comp.strength}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400">Your Opportunity</p>
                  <p className="text-[12px] text-green-700 dark:text-green-300 leading-relaxed font-medium">{comp.gap}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <QuickActions actions={[
          {
            label: "Save Analysis", icon: <BookmarkPlus className="w-3 h-3" />,
            onClick: () => save("competitors", `Competitor Analysis: ${query}`,
              report.competitorInsights.map(c => `${c.name}\nStrength: ${c.strength}\nOpportunity: ${c.gap}`).join("\n\n")),
          },
        ]} />
      </Section>

      {/* ── 7. Keywords & Search Intent ───────────────────────────────────── */}
      <Section
        id="keywords"
        title="Keywords & Search Intent"
        icon={<Hash className="w-4 h-4" />}
        badge={report.keywords.length}
        open={openSections.has("keywords")}
        onToggle={toggleSection}
      >
        <div className="space-y-2">
          {report.keywords.map((kw, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-background hover:bg-accent/20 transition-colors">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-mono font-semibold text-foreground">{kw.term}</span>
                  <span className={cn("px-2 py-0.5 rounded-md border text-[10px] font-bold", INTENT_COLORS[kw.intent] ?? INTENT_COLORS.informational)}>
                    {kw.intent}
                  </span>
                  <span className={cn("text-[11px] font-bold", OPP_COLORS[kw.opportunity] ?? "text-muted-foreground")}>
                    ● {kw.opportunity} opportunity
                  </span>
                </div>
                {kw.note && <p className="text-[11px] text-muted-foreground">{kw.note}</p>}
              </div>
            </div>
          ))}
        </div>
        <QuickActions actions={[
          {
            label: copiedKeywords ? "Copied!" : "Copy All Keywords", icon: copiedKeywords ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />,
            onClick: handleCopyKeywords, primary: true,
          },
          {
            label: "Save Keywords", icon: <BookmarkPlus className="w-3 h-3" />,
            onClick: () => save("keywords", `Keywords: ${query}`,
              report.keywords.map(k => `${k.term} (${k.intent}, ${k.opportunity} opportunity)\n${k.note}`).join("\n\n")),
          },
        ]} />
      </Section>

      {/* ── 8. Action Plan ────────────────────────────────────────────────── */}
      <Section
        id="plan"
        title="Your Action Plan"
        icon={<Target className="w-4 h-4" />}
        badge={report.actionPlan.length}
        open={openSections.has("plan")}
        onToggle={toggleSection}
      >
        <div className="space-y-3">
          {report.actionPlan.map((step, i) => (
            <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-border bg-background">
              <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[13px] font-bold flex items-center justify-center shrink-0">
                {step.step}
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-[13px] font-semibold text-foreground">{step.action}</p>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{step.detail}</p>
                {step.cta && (
                  <CtaButton
                    cta={step.cta}
                    router={router}
                    onTabChange={onTabChange}
                    context={step.action}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
        <QuickActions actions={[
          {
            label: "Save Action Plan", icon: <BookmarkPlus className="w-3 h-3" />,
            onClick: () => save("action-plan", `Action Plan: ${query}`,
              report.actionPlan.map(s => `Step ${s.step}: ${s.action}\n${s.detail}`).join("\n\n")),
          },
        ]} />
      </Section>

      {/* ── AI Recommendation ─────────────────────────────────────────────── */}
      {report.aiRecommendation && (
        <AiRecommendationCard
          rec={report.aiRecommendation}
          router={router}
          onTabChange={onTabChange}
        />
      )}

      {/* ── AI Follow-up ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40">
          <MessageSquare className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-[15px] text-foreground">Ask a follow-up question</span>
        </div>
        <div className="p-5 space-y-4">
          {followUpAnswer && (
            <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-orange-500">AI Answer</p>
              <div className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-line">
                {followUpAnswer}
              </div>
            </div>
          )}

          <div className="flex items-end gap-3">
            <textarea
              value={followUpInput}
              onChange={e => setFollowUpInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleFollowUp(); } }}
              placeholder={`Ask anything about "${query}"… e.g. "Which content format would convert best for this niche?"`}
              rows={2}
              className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none resize-none focus:border-orange-500/40 transition-colors leading-relaxed"
            />
            <Button
              onClick={handleFollowUp}
              disabled={!followUpInput.trim() || followUpLoading}
              className="bg-orange-500 hover:bg-orange-600 text-white h-10 px-4 shrink-0 gap-2"
            >
              {followUpLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Ask
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              "Which opportunity should I start with?",
              "What's the fastest way to validate this?",
              "How should I price my first product here?",
              "What content would go most viral in this niche?",
            ].map(suggestion => (
              <button
                key={suggestion}
                onClick={() => setFollowUpInput(suggestion)}
                className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-accent text-[11px] text-muted-foreground hover:text-foreground transition-all"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
