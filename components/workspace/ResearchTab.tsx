"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Sparkles, Loader2, ChevronDown, ChevronUp,
  TrendingUp, Globe, Users, ShoppingBag, BarChart3,
  Lightbulb, Target, FileText, Wand2, Package,
  Mic, Layers, StickyNote, BookmarkPlus,
  Send, AlertCircle, RefreshCw, Copy, Check,
  ArrowRight, Zap, Hash, Star, MessageSquare,
  Library, Trash2, Heart, Brain, Building2, FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EvidenceItem {
  source: string;
  finding: string;
  context: string;
}

interface BusinessOpp {
  title: string;
  description: string;
  type: string;
}

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
  popularProducts?: string;
  contentStrategy?: string;
  whatToLearn?: string;
}

interface Keyword {
  term: string;
  intent: "informational" | "commercial" | "transactional";
  opportunity: "High" | "Medium" | "Low";
  type?: string;
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
  withFlywheel: { estimatedTime: string; difficulty: "Easy" | "Medium" | "Hard"; steps: string[] };
  manually: { estimatedTime: string; tools: string[]; note: string };
}

interface AiRecommendation {
  nextStep: string;
  category: "Build Now" | "Validate First" | "Create Content First" | "Research More";
  reasoning: string;
}

interface Scorecard {
  opportunityScore: number;    // 0–100
  confidenceLevel: number;     // 0–100
  timeToLaunch: string;
  difficulty: "Easy" | "Medium" | "Hard";
  competitionLevel: "Low" | "Medium" | "High" | "Very High";
  revenuePotential: string;
  audienceDemand: "Low" | "Medium" | "High" | "Very High";
  recommendedPriority: "Build Now" | "Validate First" | "Create Content First" | "Research More";
}

interface BestNextActionData {
  action: string;
  reasoning: string;
  estimatedPrice: string;
  timeToFirstSale: string;
}

interface ResearchReport {
  summary: string;
  insights: string[];
  evidence?: EvidenceItem[];
  rootCauses?: string[];
  contentOpportunities: ContentOpp[];
  productOpportunities: ProductOpp[];
  businessOpportunities?: BusinessOpp[];
  competitorInsights: Competitor[];
  keywords: Keyword[];
  actionPlan: ActionStep[];
  recommendedOpportunity?: RecommendedOpp;
  buildPath?: BuildPath;
  aiRecommendation?: AiRecommendation;
  scorecard?: Scorecard;
  bestNextAction?: BestNextActionData;
  // legacy — may exist in old saved reports
  trendingProblems?: string[];
}

interface SavedReport {
  id: string;
  query: string;
  researchType: string;
  report: ResearchReport;
  savedAt: string;
  favourite: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type ResearchState = "idle" | "loading" | "done";

interface ResearchTabProps {
  onTabChange?: (tab: string) => void;
}

// ─── Research Types ───────────────────────────────────────────────────────────

const RESEARCH_TYPES = [
  {
    id: "find-niche",
    label: "Find a Niche",
    emoji: "🎯",
    description: "Validate a niche before entering",
    placeholder: "e.g. 'Productivity tools for NHS nurses' or 'Notion templates for freelancers UK'",
  },
  {
    id: "product-ideas",
    label: "Product Ideas",
    emoji: "📦",
    description: "Discover digital products to create",
    placeholder: "e.g. 'Digital products for content creators' or 'Templates for remote founders'",
  },
  {
    id: "content-ideas",
    label: "Content Ideas",
    emoji: "✏️",
    description: "Find high-performing content angles",
    placeholder: "e.g. 'Content ideas for personal finance UK creators' or 'Viral hooks for productivity niche'",
  },
  {
    id: "competitor",
    label: "Competitor Analysis",
    emoji: "🔍",
    description: "Understand what competitors are doing",
    placeholder: "e.g. 'Notion template creators on Gumroad' or 'AI writing tool market leaders'",
  },
  {
    id: "marketing",
    label: "Marketing Strategy",
    emoji: "📣",
    description: "Build a go-to-market plan",
    placeholder: "e.g. 'How to market a productivity course to solopreneurs' or 'Launch strategy for Notion templates'",
  },
  {
    id: "customer",
    label: "Customer Research",
    emoji: "👥",
    description: "Understand your ideal customer deeply",
    placeholder: "e.g. 'Pain points of burnt-out NHS nurses' or 'Struggles of freelance designers managing clients'",
  },
  {
    id: "seo-keywords",
    label: "SEO & Keywords",
    emoji: "🔎",
    description: "Find keyword opportunities and gaps",
    placeholder: "e.g. 'SEO opportunities in Notion template niche' or 'Content gap analysis for AI tools creators'",
  },
  {
    id: "market-trends",
    label: "Market Trends",
    emoji: "📈",
    description: "Spot emerging trends before they peak",
    placeholder: "e.g. 'Emerging trends in creator economy 2025' or 'What is growing fast in digital product space UK'",
  },
  {
    id: "custom",
    label: "Custom Research",
    emoji: "✨",
    description: "Open-ended research on any topic",
    placeholder: "Research anything… e.g. 'Notion templates for solopreneurs' or 'AI tools for freelancers UK'",
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_KEY = "cf-research-library";
const MAX_SAVED = 20;

const LOADING_STEPS = [
  { label: "Scanning the web", icon: <Globe className="w-3.5 h-3.5" /> },
  { label: "Analysing market trends", icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { label: "Finding opportunities", icon: <Lightbulb className="w-3.5 h-3.5" /> },
  { label: "Building your report", icon: <Sparkles className="w-3.5 h-3.5" /> },
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

const METRIC_COLORS: Record<string, string> = {
  "Very High": "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/25",
  "High":      "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  "Medium":    "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  "Low":       "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

const COMPETITION_COLORS: Record<string, string> = {
  "Very High": "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25",
  "High":      "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  "Medium":    "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  "Low":       "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
};

const CATEGORY_COLORS: Record<string, string> = {
  "Build Now":            "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/25",
  "Validate First":       "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/25",
  "Create Content First": "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25",
  "Research More":        "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/25",
};

const BIZ_OPP_COLORS: Record<string, string> = {
  "Market Gap":          "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  "Underserved Audience":"bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  "Emerging Trend":      "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  "Monetisation Angle":  "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  "First-Mover Advantage":"bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
};

const FLYWHEEL_STEP_ROUTES: Record<string, string> = {
  "Generate Product":        "/dashboard/library",
  "Edit in Design Studio":   "/dashboard/design-studio",
  "Generate Carousel":       "/dashboard/design-studio",
  "Generate Video Guide":    "/dashboard/video-guide/new",
  "Generate Publishing Kit": "/dashboard/video-guide/new",
};

const LAUNCH_ROADMAP = [
  { label: "Research Done",           emoji: "🔍", route: null },
  { label: "Generate Product",        emoji: "📦", route: "/dashboard/library" },
  { label: "Edit in Design Studio",   emoji: "🎨", route: "/dashboard/design-studio" },
  { label: "Generate Carousel",       emoji: "📱", route: "/dashboard/design-studio" },
  { label: "Generate Video Guide",    emoji: "🎬", route: "/dashboard/video-guide/new" },
  { label: "Generate Publishing Kit", emoji: "🚀", route: "/dashboard/video-guide/new" },
  { label: "Launch",                  emoji: "⚡", route: "/dashboard/library" },
];

// ─── Markdown stripper ────────────────────────────────────────────────────────

/** Strip raw markdown syntax from AI-generated text fields. */
function stripMd(text: string): string {
  if (!text || typeof text !== "string") return text ?? "";
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/#{1,6}\s*/g, "")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Render AI chat assistant content with basic markdown to JSX. */
function renderChatContent(text: string) {
  const cleaned = text
    .replace(/\*\*(.*?)\*\*/g, "BOLD:$1:BOLD")
    .replace(/#{1,3}\s+(.*)/g, "HEADING:$1:HEADING");
  const lines = cleaned.split("\n");
  return lines.map((line, i) => {
    const isHeading = /^HEADING:(.*):HEADING$/.test(line);
    const isBullet = /^[-•*]\s/.test(line);
    const isNum = /^\d+\.\s/.test(line);
    const renderLine = (l: string) => {
      const parts = l.split(/(BOLD:.*?:BOLD)/g);
      return parts.map((p, j) =>
        p.startsWith("BOLD:") && p.endsWith(":BOLD")
          ? <strong key={j}>{p.slice(5, -5)}</strong>
          : p
      );
    };
    if (isHeading) {
      const content = line.replace(/^HEADING:(.*):HEADING$/, "$1");
      return <p key={i} className="font-semibold text-foreground mt-3 mb-1">{content}</p>;
    }
    if (isBullet) {
      const content = line.replace(/^[-•*]\s/, "");
      return (
        <div key={i} className="flex items-start gap-2 my-0.5">
          <span className="text-orange-500 shrink-0 mt-1 text-[10px]">●</span>
          <span>{renderLine(content)}</span>
        </div>
      );
    }
    if (isNum) {
      const match = line.match(/^(\d+)\.\s(.*)/);
      if (match) return (
        <div key={i} className="flex items-start gap-2 my-0.5">
          <span className="text-orange-500 shrink-0 font-semibold text-[12px] mt-px">{match[1]}.</span>
          <span>{renderLine(match[2])}</span>
        </div>
      );
    }
    if (!line.trim()) return <div key={i} className="h-2" />;
    return <p key={i} className="my-0.5">{renderLine(line)}</p>;
  });
}

// ─── Research Library hook ────────────────────────────────────────────────────

function useResearchLibrary() {
  const [library, setLibrary] = useState<SavedReport[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setLibrary(JSON.parse(raw) as SavedReport[]);
    } catch {}
  }, []);

  const persist = useCallback((next: SavedReport[]) => {
    setLibrary(next);
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const saveReport = useCallback((query: string, researchType: string, report: ResearchReport) => {
    const entry: SavedReport = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      query,
      researchType,
      report,
      savedAt: new Date().toISOString(),
      favourite: false,
    };
    setLibrary(prev => {
      let next = [entry, ...prev];
      if (next.length > MAX_SAVED) {
        // purge oldest non-favourite
        const nfIdx = [...next].reverse().findIndex(r => !r.favourite);
        if (nfIdx !== -1) next.splice(next.length - 1 - nfIdx, 1);
      }
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    return entry.id;
  }, []);

  const toggleFavourite = useCallback((id: string) => {
    setLibrary(prev => {
      const next = prev.map(r => r.id === id ? { ...r, favourite: !r.favourite } : r);
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const deleteReport = useCallback((id: string) => {
    setLibrary(prev => {
      const next = prev.filter(r => r.id !== id);
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { library, saveReport, toggleFavourite, deleteReport, persist };
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  id, title, icon, badge, open, onToggle, children, accent, advancedOnly,
}: {
  id: string; title: string; icon: React.ReactNode; badge?: string | number;
  open: boolean; onToggle: (id: string) => void; children: React.ReactNode;
  accent?: string; advancedOnly?: boolean;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card overflow-hidden transition-all", accent)}>
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
          {advancedOnly && (
            <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 text-[10px] font-bold border border-purple-500/20">
              Advanced
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

// ─── Quick actions ────────────────────────────────────────────────────────────

function QuickActions({ actions }: {
  actions: { label: string; icon: React.ReactNode; onClick: () => void; primary?: boolean }[];
}) {
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
        body: JSON.stringify({ category: "research", type: "insight", title, content }),
      });
      setSaved(prev => new Set([...Array.from(prev), key]));
      setTimeout(() => setSaved(prev => { const n = new Set(Array.from(prev)); n.delete(key); return n; }), 2500);
    } catch {}
    finally { setSaving(null); }
  }, []);

  return { save, saving, saved };
}

// ─── CTA button ───────────────────────────────────────────────────────────────

function CtaButton({ cta, router, onTabChange }: {
  cta: string;
  router: ReturnType<typeof useRouter>;
  onTabChange?: (tab: string) => void;
}) {
  const configs: Record<string, { label: string; icon: React.ReactNode; action: () => void }> = {
    "Create Note":        { label: "Turn into Note",    icon: <StickyNote className="w-3 h-3" />,  action: () => onTabChange?.("notes") },
    "Generate Carousel":  { label: "Generate Carousel", icon: <Layers className="w-3 h-3" />,       action: () => router.push("/dashboard/design-studio") },
    "Generate Video":     { label: "Generate Video",    icon: <Zap className="w-3 h-3" />,          action: () => router.push("/dashboard/video-guide/new") },
    "Generate Script":    { label: "Generate Script",   icon: <Mic className="w-3 h-3" />,          action: () => router.push("/dashboard/video-guide/new") },
    "Create Product":     { label: "Create Product",    icon: <Package className="w-3 h-3" />,      action: () => router.push("/dashboard/library") },
    "Open Design Studio": { label: "Design Studio",     icon: <Wand2 className="w-3 h-3" />,        action: () => router.push("/dashboard/design-studio") },
  };
  const cfg = configs[cta];
  if (!cfg) return null;
  return (
    <button
      onClick={cfg.action}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/20 transition-all"
    >
      {cfg.icon}
      {cfg.label}
    </button>
  );
}

// ─── Recommended Opportunity Card ─────────────────────────────────────────────

function RecommendedOpportunityCard({ opp }: { opp: RecommendedOpp }) {
  const metrics = [
    { label: "Demand",            value: opp.demand,                colors: METRIC_COLORS },
    { label: "Competition",       value: opp.competition,           colors: COMPETITION_COLORS },
    { label: "Monetisation",      value: opp.monetisationPotential, colors: METRIC_COLORS },
    { label: "Content Potential", value: opp.contentPotential,      colors: METRIC_COLORS },
  ];
  return (
    <div className="rounded-2xl border-2 border-orange-500/30 bg-gradient-to-br from-orange-500/5 via-background to-amber-500/5 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-orange-500/20 bg-orange-500/5">
        <Star className="w-4 h-4 text-orange-500 fill-orange-500" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-orange-500">Top Opportunity</span>
        <span className="ml-auto text-[10px] font-medium text-orange-500/60 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">AI Recommended</span>
      </div>
      <div className="p-5 space-y-4">
        <h3 className="text-[18px] font-bold text-foreground leading-snug">{stripMd(opp.name)}</h3>
        <p className="text-[13px] text-foreground/80 leading-relaxed">{stripMd(opp.why)}</p>
        <div className="grid grid-cols-2 gap-2">
          {metrics.map(m => (
            <div key={m.label} className="flex items-center justify-between px-3 py-2 rounded-xl bg-background border border-border">
              <span className="text-[11px] font-medium text-muted-foreground">{m.label}</span>
              <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-lg border", m.colors[m.value] ?? m.colors["Medium"])}>
                {m.value}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-medium">💰 Est. revenue</span>
            <span className="text-[12px] font-bold text-green-600 dark:text-green-400">{opp.estimatedRevenue}</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-medium">⏱ First sale</span>
            <span className="text-[12px] font-bold text-foreground">{opp.timeToFirstSale}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Build Path ───────────────────────────────────────────────────────────────

function BuildPathSection({ buildPath, router }: { buildPath: BuildPath; router: ReturnType<typeof useRouter> }) {
  const { withFlywheel, manually } = buildPath;
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/40">
        <Zap className="w-4 h-4 text-orange-500" />
        <span className="font-semibold text-[15px] text-foreground">Build Path</span>
        <span className="text-[11px] text-muted-foreground/50 ml-1">— two ways to launch</span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-border">
        <div className="p-5 space-y-4">
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-orange-500">🚀 With Content Flywheel</div>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-[28px] font-black text-orange-500 leading-none">{withFlywheel.estimatedTime.split("–")[0]}</span>
              {withFlywheel.estimatedTime.includes("–") && (
                <span className="text-[14px] font-bold text-orange-400/70">–{withFlywheel.estimatedTime.split("–")[1]}</span>
              )}
            </div>
            <span className={cn("inline-flex text-[11px] font-bold px-2 py-0.5 rounded-lg border", DIFFICULTY_COLORS[withFlywheel.difficulty] ?? DIFFICULTY_COLORS.Easy)}>
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
                  <span className="w-5 h-5 rounded-md bg-orange-500/15 text-orange-500 flex items-center justify-center text-[10px] font-black shrink-0">{i + 1}</span>
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
            <Zap className="w-3.5 h-3.5" />Start Building
          </button>
        </div>
        <div className="p-5 space-y-4 bg-muted/10">
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">🔧 Build Manually</div>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-[28px] font-black text-muted-foreground/60 leading-none">{manually.estimatedTime.split("–")[0]}</span>
              {manually.estimatedTime.includes("–") && (
                <span className="text-[14px] font-bold text-muted-foreground/40">–{manually.estimatedTime.split("–")[1]}</span>
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
          {manually.note && <p className="text-[11px] text-muted-foreground/60 leading-relaxed italic">{manually.note}</p>}
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
              </button>
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

function AiRecommendationCard({ rec, router }: {
  rec: AiRecommendation; router: ReturnType<typeof useRouter>;
}) {
  const ctaMap: Record<string, { label: string; action: () => void }> = {
    "Build Now":            { label: "Generate Product →",  action: () => router.push("/dashboard/library") },
    "Validate First":       { label: "Generate Carousel →", action: () => router.push("/dashboard/design-studio") },
    "Create Content First": { label: "Generate Script →",   action: () => router.push("/dashboard/video-guide/new") },
    "Research More":        { label: "Refine Research",     action: () => {} },
  };
  const cta = ctaMap[rec.category] ?? ctaMap["Build Now"];
  return (
    <div className="rounded-2xl border-2 border-orange-500/25 bg-gradient-to-br from-orange-500/5 to-background overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-orange-500/20">
        <Sparkles className="w-4 h-4 text-orange-500" />
        <span className="font-semibold text-[15px] text-foreground">Recommended Next Step</span>
        <span className={cn("ml-auto text-[11px] font-bold px-2.5 py-1 rounded-full border", CATEGORY_COLORS[rec.category] ?? CATEGORY_COLORS["Build Now"])}>
          {rec.category}
        </span>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-[16px] font-bold text-foreground leading-snug">&ldquo;{stripMd(rec.nextStep)}&rdquo;</p>
        <p className="text-[13px] text-foreground/75 leading-relaxed">{stripMd(rec.reasoning)}</p>
        <button
          onClick={cta.action}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[14px] font-semibold transition-all"
        >
          <Zap className="w-4 h-4" />{cta.label}
        </button>
      </div>
    </div>
  );
}

// ─── Business Scorecard ───────────────────────────────────────────────────────

const SCORE_COLORS = {
  green:  "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400",
  amber:  "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400",
  red:    "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400",
  blue:   "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400",
  purple: "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20 text-purple-700 dark:text-purple-400",
  orange: "bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20 text-orange-700 dark:text-orange-400",
} as const;

function scorecardColor(value: string | number): keyof typeof SCORE_COLORS {
  if (typeof value === "number") {
    if (value >= 75) return "green";
    if (value >= 50) return "amber";
    return "red";
  }
  const v = value.toLowerCase();
  if (v === "easy" || v === "low" || v === "build now" || v === "very high") return "green";
  if (v === "medium" || v === "validate first" || v === "high") return "amber";
  if (v === "hard" || v === "very high competition" || v === "create content first" || v === "research more") return "red";
  return "blue";
}

function ScorecardMetric({
  icon, title, value, subLabel, colorKey,
}: {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subLabel?: string;
  colorKey: keyof typeof SCORE_COLORS;
}) {
  return (
    <div className={cn("rounded-xl border p-3 flex flex-col gap-1.5", SCORE_COLORS[colorKey])}>
      <div className="flex items-center gap-1.5">
        <span className="opacity-70 shrink-0">{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">{title}</span>
      </div>
      <div className="font-bold text-[18px] leading-tight">{value}</div>
      {subLabel && <div className="text-[11px] opacity-60 leading-tight">{subLabel}</div>}
    </div>
  );
}

function BusinessScorecard({ scorecard, report }: { scorecard: Scorecard; report: ResearchReport }) {
  const metrics = [
    {
      icon: <Sparkles className="w-3.5 h-3.5" />,
      title: "Opportunity Score",
      value: `${scorecard.opportunityScore}/100`,
      subLabel: scorecard.opportunityScore >= 75 ? "Strong opportunity" : scorecard.opportunityScore >= 50 ? "Moderate opportunity" : "Needs validation",
      colorKey: scorecardColor(scorecard.opportunityScore),
    },
    {
      icon: <BarChart3 className="w-3.5 h-3.5" />,
      title: "Confidence Level",
      value: `${scorecard.confidenceLevel}%`,
      subLabel: "Research confidence",
      colorKey: scorecardColor(scorecard.confidenceLevel),
    },
    {
      icon: <Zap className="w-3.5 h-3.5" />,
      title: "Time to Launch",
      value: scorecard.timeToLaunch,
      subLabel: "With Content Flywheel",
      colorKey: "orange" as keyof typeof SCORE_COLORS,
    },
    {
      icon: <Target className="w-3.5 h-3.5" />,
      title: "Difficulty",
      value: scorecard.difficulty,
      subLabel: scorecard.difficulty === "Easy" ? "Beginner-friendly" : scorecard.difficulty === "Medium" ? "Some experience needed" : "Expert-level",
      colorKey: scorecard.difficulty === "Easy" ? "green" : scorecard.difficulty === "Medium" ? "amber" : "red" as keyof typeof SCORE_COLORS,
    },
    {
      icon: <Users className="w-3.5 h-3.5" />,
      title: "Competition",
      value: scorecard.competitionLevel,
      subLabel: scorecard.competitionLevel === "Low" ? "Wide open" : scorecard.competitionLevel === "Medium" ? "Manageable" : "Competitive space",
      colorKey: (scorecard.competitionLevel === "Low" ? "green" : scorecard.competitionLevel === "Medium" ? "amber" : "red") as keyof typeof SCORE_COLORS,
    },
    {
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      title: "Revenue Potential",
      value: scorecard.revenuePotential,
      subLabel: "Estimated monthly",
      colorKey: "green" as keyof typeof SCORE_COLORS,
    },
    {
      icon: <Globe className="w-3.5 h-3.5" />,
      title: "Audience Demand",
      value: scorecard.audienceDemand,
      subLabel: scorecard.audienceDemand === "Very High" || scorecard.audienceDemand === "High" ? "Strong market pull" : "Growing audience",
      colorKey: (scorecard.audienceDemand === "Very High" || scorecard.audienceDemand === "High" ? "green" : "amber") as keyof typeof SCORE_COLORS,
    },
    {
      icon: <Lightbulb className="w-3.5 h-3.5" />,
      title: "Recommended Priority",
      value: scorecard.recommendedPriority,
      subLabel: "AI assessment",
      colorKey: (scorecard.recommendedPriority === "Build Now" ? "green" : scorecard.recommendedPriority === "Validate First" ? "amber" : "blue") as keyof typeof SCORE_COLORS,
    },
  ] as const;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/40 bg-gradient-to-r from-orange-500/5 to-transparent">
        <BarChart3 className="w-4 h-4 text-orange-500" />
        <span className="font-semibold text-[15px] text-foreground">Business Scorecard</span>
        <span className="text-[11px] text-muted-foreground/50 ml-1">— understand the opportunity in 10 seconds</span>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {metrics.map((m, i) => (
            <ScorecardMetric key={i} icon={m.icon} title={m.title} value={m.value} subLabel={m.subLabel} colorKey={m.colorKey} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Best Next Action Card ─────────────────────────────────────────────────────

function BestNextActionCard({
  bestNextAction, router,
}: {
  bestNextAction: BestNextActionData;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <div className="rounded-2xl border-2 border-orange-500/40 bg-gradient-to-br from-orange-500/8 via-background to-amber-500/5 overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-orange-500/20 bg-orange-500/8">
        <span className="text-[18px] leading-none">🚀</span>
        <span className="font-bold text-[14px] text-orange-600 dark:text-orange-400">Best Next Action</span>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <h3 className="text-[18px] font-bold text-foreground leading-snug">{stripMd(bestNextAction.action)}</h3>
          <p className="text-[13px] text-foreground/75 leading-relaxed mt-2">{stripMd(bestNextAction.reasoning)}</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {bestNextAction.estimatedPrice && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-muted-foreground">💰 Selling price</span>
              <span className="text-[13px] font-bold text-green-600 dark:text-green-400">{bestNextAction.estimatedPrice}</span>
            </div>
          )}
          {bestNextAction.timeToFirstSale && (
            <>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">⏱ First sale</span>
                <span className="text-[13px] font-bold text-foreground">{bestNextAction.timeToFirstSale}</span>
              </div>
            </>
          )}
        </div>
        <button
          onClick={() => router.push("/dashboard/library")}
          className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[14px] font-bold transition-all shadow-sm"
        >
          <Package className="w-4 h-4" />
          Build This Product
          <ArrowRight className="w-4 h-4 ml-1" />
        </button>
      </div>
    </div>
  );
}

// ─── Research Type Selector ───────────────────────────────────────────────────

function ResearchTypeSelector({ selected, onSelect }: {
  selected: string; onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50">Research Type</p>
      <div className="grid grid-cols-3 gap-2">
        {RESEARCH_TYPES.map(type => (
          <button
            key={type.id}
            onClick={() => onSelect(type.id)}
            className={cn(
              "flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all",
              selected === type.id
                ? "bg-orange-500/10 border-orange-500/40 shadow-sm"
                : "bg-card border-border hover:bg-accent/50 hover:border-orange-500/20"
            )}
          >
            <div className="flex items-center gap-2 w-full">
              <span className="text-[16px] leading-none">{type.emoji}</span>
              <span className={cn(
                "text-[12px] font-semibold leading-tight",
                selected === type.id ? "text-orange-600 dark:text-orange-400" : "text-foreground"
              )}>
                {type.label}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground/70 leading-tight">{type.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Research Library Panel ───────────────────────────────────────────────────

function ResearchLibraryPanel({
  library, onLoad, onToggleFavourite, onDelete, onRefresh,
}: {
  library: SavedReport[];
  onLoad: (saved: SavedReport) => void;
  onToggleFavourite: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: (saved: SavedReport) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return library;
    const q = search.toLowerCase();
    return library.filter(r => r.query.toLowerCase().includes(q));
  }, [library, search]);

  if (library.length === 0) return null;

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffH = diffMs / 3600000;
      if (diffH < 1) return "Just now";
      if (diffH < 24) return `${Math.floor(diffH)}h ago`;
      if (diffH < 168) return `${Math.floor(diffH / 24)}d ago`;
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    } catch { return ""; }
  };

  const getTypeInfo = (id: string) => RESEARCH_TYPES.find(t => t.id === id) ?? RESEARCH_TYPES[8];

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Library className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-[15px] text-foreground">Research Library</span>
          <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 text-[11px] font-bold">{library.length}</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-3">
          {library.length > 3 && (
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search saved research…"
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-orange-500/40 transition-colors"
            />
          )}

          <div className="space-y-2">
            {filtered.slice(0, 8).map(saved => {
              const typeInfo = getTypeInfo(saved.researchType);
              return (
                <div
                  key={saved.id}
                  className="group flex items-center gap-3 p-3 rounded-xl border border-border bg-background hover:bg-accent/30 hover:border-orange-500/20 transition-all"
                >
                  <span className="text-[18px] shrink-0">{typeInfo.emoji}</span>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onLoad(saved)}>
                    <p className="text-[13px] font-semibold text-foreground truncate">{saved.query}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-medium text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded-md border border-border">
                        {typeInfo.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground/50">{formatDate(saved.savedAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => onRefresh(saved)}
                      title="Refresh Research"
                      className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-orange-500 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onToggleFavourite(saved.id)}
                      title={saved.favourite ? "Unfavourite" : "Favourite"}
                      className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                    >
                      <Heart className={cn("w-3.5 h-3.5", saved.favourite ? "text-red-500 fill-red-500" : "text-muted-foreground")} />
                    </button>
                    <button
                      onClick={() => onDelete(saved.id)}
                      title="Delete"
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && search && (
            <p className="text-[13px] text-muted-foreground/50 text-center py-2">No results for &ldquo;{search}&rdquo;</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ResearchTab ─────────────────────────────────────────────────────────

export function ResearchTab({ onTabChange }: ResearchTabProps) {
  const router = useRouter();
  const { save, saving, saved } = useSaveToResearch();
  const lib = useResearchLibrary();

  // Core state
  const [state, setState]             = useState<ResearchState>("idle");
  const [inputQuery, setInputQuery]   = useState("");
  const [query, setQuery]             = useState("");
  const [researchType, setResearchType] = useState("custom");
  const [report, setReport]           = useState<ResearchReport | null>(null);
  const [activeReportType, setActiveReportType] = useState("custom");
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [advancedMode, setAdvancedMode] = useState(false);

  // Sections
  const [openSections, setOpenSections] = useState<Set<string>>(new Set([
    "summary", "insights", "content", "product", "plan",
  ]));

  // Chat follow-up
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput]       = useState("");
  const [chatLoading, setChatLoading]   = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Misc
  const [copiedKeywords, setCopiedKeywords] = useState(false);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
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

  // Scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const toggleSection = (id: string) =>
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Which advanced sections are always shown for this type
  const alwaysShowCompetitors = activeReportType === "competitor";
  const alwaysShowKeywords    = activeReportType === "seo-keywords";

  const showSection = (key: "evidence" | "rootCauses" | "businessOpps" | "competitors" | "keywords") => {
    if (key === "competitors") return alwaysShowCompetitors || advancedMode;
    if (key === "keywords")    return alwaysShowKeywords    || advancedMode;
    return advancedMode;
  };

  // ── Trigger search ────────────────────────────────────────────────────────
  const runSearch = useCallback(async (q: string, type: string) => {
    setQuery(q);
    setActiveReportType(type);
    setReport(null);
    setError(null);
    setChatMessages([]);
    setChatInput("");
    setAdvancedMode(false);
    setOpenSections(new Set(["summary", "insights", "content", "product", "plan"]));
    setState("loading");

    try {
      const res = await fetch("/api/research/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, researchType: type }),
      });
      const data = await res.json() as { report?: ResearchReport; generatedAt?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Unknown error");
      const r = data.report ?? null;
      setReport(r);
      setGeneratedAt(data.generatedAt ?? null);
      setState("done");
      // Auto-save to library
      if (r) lib.saveReport(q, type, r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Research failed");
      setState("idle");
    }
  }, [lib]);

  const handleSearch = () => {
    const q = inputQuery.trim();
    if (!q) return;
    runSearch(q, researchType);
  };

  // ── Load saved report from library ────────────────────────────────────────
  const handleLoadSaved = useCallback((saved: SavedReport) => {
    setQuery(saved.query);
    setActiveReportType(saved.researchType);
    setReport(saved.report);
    setGeneratedAt(saved.savedAt);
    setChatMessages([]);
    setChatInput("");
    setAdvancedMode(false);
    setOpenSections(new Set(["summary", "insights", "content", "product", "plan"]));
    setState("done");
  }, []);

  // ── Chat follow-up ────────────────────────────────────────────────────────
  const handleChat = async () => {
    const input = chatInput.trim();
    if (!input || !report) return;

    const userMsg: ChatMessage = { role: "user", content: input };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/research/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followUp: input,
          reportContext: query,
          query: report.summary.slice(0, 600),
          conversationHistory: chatMessages,
        }),
      });
      const data = await res.json() as { answer?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Error");
      setChatMessages(prev => [...prev, { role: "assistant", content: data.answer ?? "" }]);
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't answer that. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleCopyKeywords = () => {
    if (!report) return;
    navigator.clipboard.writeText(report.keywords.map(k => k.term).join(", "));
    setCopiedKeywords(true);
    setTimeout(() => setCopiedKeywords(false), 2000);
  };

  const handleSaveReport = () => {
    if (!report) return;
    const content = `${query}\n\n${report.summary}\n\nKey Insights:\n${report.insights.map(i => `• ${i}`).join("\n")}`;
    save("full-report", `Research: ${query}`, content);
  };

  const formatTime = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  };

  const currentTypeInfo = RESEARCH_TYPES.find(t => t.id === researchType) ?? RESEARCH_TYPES[8];
  const activeTypeInfo  = RESEARCH_TYPES.find(t => t.id === activeReportType) ?? RESEARCH_TYPES[8];

  // ════════════════════════════════════════════════════════════════════════════
  // IDLE STATE
  // ════════════════════════════════════════════════════════════════════════════
  if (state === "idle") {
    return (
      <div className="max-w-3xl mx-auto space-y-6 py-4">

        {/* Hero */}
        <div className="text-center space-y-3 pt-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[12px] font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            AI Business Analyst
          </div>
          <h2 className="text-3xl font-bold text-foreground tracking-tight">
            Research any market, niche, or topic
          </h2>
          <p className="text-muted-foreground text-[15px] max-w-xl mx-auto">
            Get a structured report with evidence, root causes, opportunities, and a clear action plan. Adapted to your research goal.
          </p>
        </div>

        {/* Powered by AI Research — onboarding card */}
        <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-orange-500" />
            <span className="font-semibold text-[14px] text-foreground">Powered by AI Research</span>
          </div>
          <p className="text-[13px] text-foreground/70 leading-relaxed">
            Ask any business question and get a full structured report — with evidence, competitor analysis, product ideas, a step-by-step action plan, and a business scorecard.
          </p>
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50">Example searches</p>
            <div className="flex flex-wrap gap-2">
              {[
                "Find a profitable niche for nurses",
                "Research competitors in Notion templates",
                "What content is trending in productivity?",
                "Validate my ebook idea for freelancers",
                "Best digital products for teachers",
                "How to price my Notion template",
              ].map(ex => (
                <button
                  key={ex}
                  onClick={() => setInputQuery(ex)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-accent hover:border-orange-500/20 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-all"
                >
                  <Search className="w-3 h-3 shrink-0 opacity-50" />
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Research Type Selector */}
        <ResearchTypeSelector selected={researchType} onSelect={setResearchType} />

        {/* Search box */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="p-4">
            <textarea
              ref={textareaRef}
              value={inputQuery}
              onChange={e => setInputQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSearch(); } }}
              placeholder={currentTypeInfo.placeholder}
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
                {!s.active && <span className="text-[9px] font-bold uppercase tracking-wider opacity-60 ml-0.5">Soon</span>}
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

        {/* Research Library */}
        <ResearchLibraryPanel
          library={lib.library}
          onLoad={handleLoadSaved}
          onToggleFavourite={lib.toggleFavourite}
          onDelete={lib.deleteReport}
          onRefresh={(saved) => {
            setInputQuery(saved.query);
            setResearchType(saved.researchType);
            setTimeout(() => textareaRef.current?.focus(), 50);
          }}
        />

        {/* Value props */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: <TrendingUp className="w-4 h-4 text-orange-500" />, title: "Market Intelligence",  desc: "Discover gaps before your competitors do" },
            { icon: <Brain className="w-4 h-4 text-orange-500" />,      title: "Root Cause Analysis",  desc: "Understand why opportunities exist, not just that they do" },
            { icon: <Zap className="w-4 h-4 text-orange-500" />,        title: "Instant Execution",    desc: "One click to turn research into products, content, or campaigns" },
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

  // ════════════════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ════════════════════════════════════════════════════════════════════════════
  if (state === "loading") {
    return (
      <div className="max-w-3xl mx-auto py-16 space-y-10">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6 text-orange-500 animate-pulse" />
          </div>
          <h3 className="text-xl font-bold text-foreground">Researching your topic…</h3>
          <p className="text-sm text-muted-foreground italic">&ldquo;{query}&rdquo;</p>
          {activeTypeInfo.id !== "custom" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-500 text-[12px] font-medium">
              {activeTypeInfo.emoji} {activeTypeInfo.label} mode
            </span>
          )}
        </div>
        <div className="space-y-3 max-w-sm mx-auto">
          {LOADING_STEPS.map((step, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-500",
                i < loadingStep  ? "bg-green-500/5 border-green-500/20 text-green-600 dark:text-green-400"
                : i === loadingStep ? "bg-orange-500/10 border-orange-500/30 text-orange-500"
                : "bg-muted/20 border-border text-muted-foreground/40"
              )}
            >
              {i < loadingStep ? <Check className="w-4 h-4 shrink-0" />
                : i === loadingStep ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                : <div className="w-4 h-4 shrink-0 rounded-full border border-current opacity-30" />}
              <span className="text-[13px] font-medium">{step.label}</span>
            </div>
          ))}
        </div>
        <p className="text-center text-[12px] text-muted-foreground/40">This usually takes 15–25 seconds for a full report</p>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DONE STATE — full report
  // ════════════════════════════════════════════════════════════════════════════
  if (!report) return null;

  const CHAT_SUGGESTIONS = [
    "Which opportunity should I start with?",
    "What's the fastest way to validate this?",
    "How should I price my first product here?",
    "What content would go most viral in this niche?",
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-12">

      {/* ── Report header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 py-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-6 h-6 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50">Research Report</span>
            {generatedAt && <span className="text-[11px] text-muted-foreground/40">· {formatTime(generatedAt)}</span>}
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/50 border border-border text-[11px] font-medium text-muted-foreground">
              {activeTypeInfo.emoji} {activeTypeInfo.label}
            </span>
          </div>
          <h2 className="text-xl font-bold text-foreground leading-tight">{query}</h2>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {/* Advanced toggle */}
          <button
            onClick={() => setAdvancedMode(!advancedMode)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-all",
              advancedMode
                ? "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400"
                : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <Brain className="w-3 h-3" />
            {advancedMode ? "Advanced: On" : "Advanced Analysis"}
          </button>
          <button
            onClick={handleSaveReport}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-all",
              saved.has("full-report")
                ? "bg-green-500/10 border-green-500/20 text-green-600"
                : "bg-background hover:bg-accent border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {saving === "full-report" ? <Loader2 className="w-3 h-3 animate-spin" /> : saved.has("full-report") ? <Check className="w-3 h-3" /> : <BookmarkPlus className="w-3 h-3" />}
            {saved.has("full-report") ? "Saved!" : "Save"}
          </button>
          <button
            onClick={() => setState("idle")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-accent text-[12px] font-medium text-muted-foreground hover:text-foreground transition-all"
          >
            <RefreshCw className="w-3 h-3" />
            New Research
          </button>
        </div>
      </div>

      {/* ── Business Scorecard ────────────────────────────────────────────── */}
      {report.scorecard && (
        <BusinessScorecard scorecard={report.scorecard} report={report} />
      )}

      {/* ── Best Next Action ──────────────────────────────────────────────── */}
      {report.bestNextAction && (
        <BestNextActionCard bestNextAction={report.bestNextAction} router={router} />
      )}

      {/* ── Recommended Opportunity ────────────────────────────────────────── */}
      {report.recommendedOpportunity && (
        <RecommendedOpportunityCard opp={report.recommendedOpportunity} />
      )}

      {/* ── Build Path ────────────────────────────────────────────────────── */}
      {report.buildPath && <BuildPathSection buildPath={report.buildPath} router={router} />}

      {/* ── Launch Roadmap ────────────────────────────────────────────────── */}
      <LaunchRoadmap router={router} />

      {/* ── 1. Executive Summary ───────────────────────────────────────────── */}
      <Section id="summary" title="Executive Summary" icon={<FileText className="w-4 h-4" />} open={openSections.has("summary")} onToggle={toggleSection}>
        <div className="space-y-3">
          {report.summary.split(/\n\n+/).map((para, i) => (
            <p key={i} className="text-[14px] text-foreground/90 leading-relaxed">{stripMd(para)}</p>
          ))}
          <QuickActions actions={[
            { label: "Save to Research", icon: <BookmarkPlus className="w-3 h-3" />, onClick: () => save("summary", `Summary: ${query}`, report.summary) },
            { label: "Turn into Note",   icon: <StickyNote className="w-3 h-3" />,   onClick: () => onTabChange?.("notes") },
          ]} />
        </div>
      </Section>

      {/* ── 2. Key Insights ───────────────────────────────────────────────── */}
      <Section id="insights" title="Key Insights" icon={<Lightbulb className="w-4 h-4" />} badge={report.insights.length} open={openSections.has("insights")} onToggle={toggleSection}>
        <ul className="space-y-3">
          {report.insights.map((insight, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <p className="text-[14px] text-foreground/90 leading-relaxed">{stripMd(insight)}</p>
            </li>
          ))}
        </ul>
        <QuickActions actions={[
          { label: "Generate Carousel", icon: <Layers className="w-3 h-3" />,       onClick: () => router.push("/dashboard/design-studio"), primary: true },
          { label: "Save Insights",     icon: <BookmarkPlus className="w-3 h-3" />, onClick: () => save("insights", `Insights: ${query}`, report.insights.map((ins, n) => `${n + 1}. ${ins}`).join("\n")) },
        ]} />
      </Section>

      {/* ── 3. Evidence & Research Signals [advanced] ─────────────────────── */}
      {showSection("evidence") && report.evidence && report.evidence.length > 0 && (
        <Section id="evidence" title="Evidence & Research Signals" icon={<FlaskConical className="w-4 h-4" />} badge={report.evidence.length} open={openSections.has("evidence")} onToggle={toggleSection} advancedOnly>
          <div className="space-y-3">
            {report.evidence.map((ev, i) => (
              <div key={i} className="p-4 rounded-xl border border-border bg-background space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-500 dark:text-blue-400 text-[10px] font-bold">
                    {ev.source}
                  </span>
                </div>
                <p className="text-[13px] font-semibold text-foreground leading-relaxed">{stripMd(ev.finding)}</p>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{stripMd(ev.context)}</p>
              </div>
            ))}
          </div>
          <QuickActions actions={[
            { label: "Save Evidence", icon: <BookmarkPlus className="w-3 h-3" />, onClick: () => save("evidence", `Evidence: ${query}`, (report.evidence ?? []).map(e => `[${e.source}] ${e.finding}\n${e.context}`).join("\n\n")) },
          ]} />
        </Section>
      )}

      {/* ── 4. Root Causes [advanced] ─────────────────────────────────────── */}
      {showSection("rootCauses") && report.rootCauses && report.rootCauses.length > 0 && (
        <Section id="rootCauses" title="Root Causes" icon={<Brain className="w-4 h-4" />} badge={report.rootCauses.length} open={openSections.has("rootCauses")} onToggle={toggleSection} advancedOnly>
          <div className="space-y-2">
            {report.rootCauses.map((cause, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-purple-500/5 border border-purple-500/10 hover:border-purple-500/20 transition-colors">
                <span className="text-purple-500 shrink-0 mt-0.5 font-bold text-[12px]">{i + 1}.</span>
                <p className="text-[13px] text-foreground/90 leading-relaxed">{stripMd(cause)}</p>
              </div>
            ))}
          </div>
          <QuickActions actions={[
            { label: "Turn into Note", icon: <StickyNote className="w-3 h-3" />,   onClick: () => onTabChange?.("notes") },
            { label: "Save Causes",    icon: <BookmarkPlus className="w-3 h-3" />, onClick: () => save("root-causes", `Root Causes: ${query}`, (report.rootCauses ?? []).map((c, n) => `${n + 1}. ${c}`).join("\n")) },
          ]} />
        </Section>
      )}

      {/* ── 5. Content Opportunities ──────────────────────────────────────── */}
      <Section id="content" title="Content Opportunities" icon={<Layers className="w-4 h-4" />} badge={report.contentOpportunities.length} open={openSections.has("content")} onToggle={toggleSection}>
        <div className="space-y-3">
          {report.contentOpportunities.map((opp, i) => (
            <div key={i} className="p-4 rounded-xl border border-border bg-background hover:bg-accent/20 transition-colors group">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[13px] font-semibold text-foreground">{stripMd(opp.title)}</p>
                  <span className="px-2 py-0.5 rounded-md border text-[10px] font-bold bg-blue-500/8 border-blue-500/20 text-blue-500 dark:text-blue-400">{opp.format}</span>
                  <span className={cn("px-2 py-0.5 rounded-md border text-[10px] font-bold", DIFFICULTY_COLORS[opp.difficulty] ?? DIFFICULTY_COLORS.Medium)}>{opp.difficulty}</span>
                </div>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{stripMd(opp.description)}</p>
              </div>
              <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => router.push("/dashboard/video-guide/new")} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/20 transition-all">
                  <Mic className="w-3 h-3" />Generate Script
                </button>
                <button onClick={() => router.push("/dashboard/design-studio")} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-background hover:bg-accent text-muted-foreground border border-border transition-all">
                  <Layers className="w-3 h-3" />Make Carousel
                </button>
              </div>
            </div>
          ))}
        </div>
        <QuickActions actions={[
          { label: "Open Design Studio",    icon: <Wand2 className="w-3 h-3" />,       onClick: () => router.push("/dashboard/design-studio"), primary: true },
          { label: "Save Opportunities",    icon: <BookmarkPlus className="w-3 h-3" />, onClick: () => save("content-opps", `Content Opps: ${query}`, report.contentOpportunities.map(o => `${o.title} (${o.format}, ${o.difficulty})\n${o.description}`).join("\n\n")) },
        ]} />
      </Section>

      {/* ── 6. Product Opportunities ──────────────────────────────────────── */}
      <Section id="product" title="Product Opportunities" icon={<Package className="w-4 h-4" />} badge={report.productOpportunities.length} open={openSections.has("product")} onToggle={toggleSection}>
        <div className="space-y-3">
          {report.productOpportunities.map((opp, i) => (
            <div key={i} className="p-4 rounded-xl border border-border bg-background hover:bg-accent/20 transition-colors group">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[13px] font-semibold text-foreground">{stripMd(opp.title)}</p>
                  <span className="px-2 py-0.5 rounded-md border text-[10px] font-bold bg-purple-500/8 border-purple-500/20 text-purple-500 dark:text-purple-400">{opp.type}</span>
                </div>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{stripMd(opp.description)}</p>
                <p className="text-[12px] font-bold text-green-600 dark:text-green-400">{opp.priceRange}</p>
              </div>
              <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => router.push("/dashboard/library")} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/20 transition-all">
                  <Package className="w-3 h-3" />Create Product
                </button>
                <button onClick={() => save(`product-${i}`, opp.title, `${opp.description}\n\nType: ${opp.type}\nPrice: ${opp.priceRange}`)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-background hover:bg-accent text-muted-foreground border border-border transition-all">
                  {saved.has(`product-${i}`) ? <Check className="w-3 h-3 text-green-500" /> : <BookmarkPlus className="w-3 h-3" />}
                  {saved.has(`product-${i}`) ? "Saved!" : "Save Idea"}
                </button>
              </div>
            </div>
          ))}
        </div>
        <QuickActions actions={[
          { label: "Create Digital Product", icon: <Package className="w-3 h-3" />,      onClick: () => router.push("/dashboard/library"), primary: true },
          { label: "Save All",               icon: <BookmarkPlus className="w-3 h-3" />, onClick: () => save("product-opps", `Product Opps: ${query}`, report.productOpportunities.map(o => `${o.title}\n${o.description}\nType: ${o.type} · ${o.priceRange}`).join("\n\n")) },
        ]} />
      </Section>

      {/* ── 7. Business Opportunities [advanced] ──────────────────────────── */}
      {showSection("businessOpps") && report.businessOpportunities && report.businessOpportunities.length > 0 && (
        <Section id="businessOpps" title="Business Opportunities" icon={<Building2 className="w-4 h-4" />} badge={report.businessOpportunities.length} open={openSections.has("businessOpps")} onToggle={toggleSection} advancedOnly>
          <div className="space-y-3">
            {report.businessOpportunities.map((opp, i) => (
              <div key={i} className="p-4 rounded-xl border border-border bg-background space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13px] font-semibold text-foreground">{stripMd(opp.title)}</p>
                  <span className={cn("px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0", BIZ_OPP_COLORS[opp.type] ?? "bg-muted/30 border-border text-muted-foreground")}>
                    {opp.type}
                  </span>
                </div>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{stripMd(opp.description)}</p>
              </div>
            ))}
          </div>
          <QuickActions actions={[
            { label: "Save Opportunities", icon: <BookmarkPlus className="w-3 h-3" />, onClick: () => save("biz-opps", `Business Opportunities: ${query}`, (report.businessOpportunities ?? []).map(o => `${o.title} [${o.type}]\n${o.description}`).join("\n\n")) },
          ]} />
        </Section>
      )}

      {/* ── 8. Competitor Insights ────────────────────────────────────────── */}
      {showSection("competitors") && (
        <Section id="competitors" title="Competitor Insights" icon={<Star className="w-4 h-4" />} badge={report.competitorInsights.length} open={openSections.has("competitors")} onToggle={toggleSection} advancedOnly={!alwaysShowCompetitors}>
          <div className="space-y-3">
            {report.competitorInsights.map((comp, i) => (
              <div key={i} className="p-4 rounded-xl border border-border bg-background space-y-3">
                <p className="text-[13px] font-bold text-foreground">{stripMd(comp.name)}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Strength</p>
                    <p className="text-[12px] text-muted-foreground leading-relaxed">{stripMd(comp.strength)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400">Your Opportunity</p>
                    <p className="text-[12px] text-green-700 dark:text-green-300 leading-relaxed font-medium">{stripMd(comp.gap)}</p>
                  </div>
                </div>
                {(comp.popularProducts || comp.contentStrategy || comp.whatToLearn) && (
                  <div className="pt-2 border-t border-border/40 space-y-2">
                    {comp.popularProducts && (
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Popular Products</p>
                        <p className="text-[12px] text-muted-foreground">{stripMd(comp.popularProducts)}</p>
                      </div>
                    )}
                    {comp.contentStrategy && (
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Content Strategy</p>
                        <p className="text-[12px] text-muted-foreground">{stripMd(comp.contentStrategy)}</p>
                      </div>
                    )}
                    {comp.whatToLearn && (
                      <div className="space-y-0.5 p-2.5 rounded-lg bg-orange-500/5 border border-orange-500/15">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-orange-500/70">Key Lesson</p>
                        <p className="text-[12px] text-foreground/80 italic">{stripMd(comp.whatToLearn)}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <QuickActions actions={[
            { label: "Save Analysis", icon: <BookmarkPlus className="w-3 h-3" />, onClick: () => save("competitors", `Competitor Analysis: ${query}`, report.competitorInsights.map(c => `${c.name}\nStrength: ${c.strength}\nOpportunity: ${c.gap}`).join("\n\n")) },
          ]} />
        </Section>
      )}

      {/* ── 9. Keywords ───────────────────────────────────────────────────── */}
      {showSection("keywords") && (
        <Section id="keywords" title="Keywords & Search Intent" icon={<Hash className="w-4 h-4" />} badge={report.keywords.length} open={openSections.has("keywords")} onToggle={toggleSection} advancedOnly={!alwaysShowKeywords}>
          <div className="space-y-2">
            {report.keywords.map((kw, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-background hover:bg-accent/20 transition-colors">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-mono font-semibold text-foreground">{kw.term}</span>
                    <span className={cn("px-2 py-0.5 rounded-md border text-[10px] font-bold", INTENT_COLORS[kw.intent] ?? INTENT_COLORS.informational)}>{kw.intent}</span>
                    {kw.type && <span className="px-2 py-0.5 rounded-md border text-[10px] font-medium bg-muted/30 border-border text-muted-foreground">{kw.type}</span>}
                    <span className={cn("text-[11px] font-bold", OPP_COLORS[kw.opportunity] ?? "text-muted-foreground")}>● {kw.opportunity} opp</span>
                  </div>
                  {kw.note && <p className="text-[11px] text-muted-foreground">{kw.note}</p>}
                </div>
              </div>
            ))}
          </div>
          <QuickActions actions={[
            { label: copiedKeywords ? "Copied!" : "Copy All Keywords", icon: copiedKeywords ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />, onClick: handleCopyKeywords, primary: true },
            { label: "Save Keywords", icon: <BookmarkPlus className="w-3 h-3" />, onClick: () => save("keywords", `Keywords: ${query}`, report.keywords.map(k => `${k.term} (${k.intent}, ${k.opportunity} opp)\n${k.note}`).join("\n\n")) },
          ]} />
        </Section>
      )}

      {/* ── 10. Action Plan ───────────────────────────────────────────────── */}
      <Section id="plan" title="Your Action Plan" icon={<Target className="w-4 h-4" />} badge={report.actionPlan.length} open={openSections.has("plan")} onToggle={toggleSection}>
        <div className="space-y-3">
          {report.actionPlan.map((step, i) => (
            <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-border bg-background">
              <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[13px] font-bold flex items-center justify-center shrink-0">
                {step.step}
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-[13px] font-semibold text-foreground">{stripMd(step.action)}</p>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{stripMd(step.detail)}</p>
                {step.cta && <CtaButton cta={step.cta} router={router} onTabChange={onTabChange} />}
              </div>
            </div>
          ))}
        </div>
        <QuickActions actions={[
          { label: "Save Action Plan", icon: <BookmarkPlus className="w-3 h-3" />, onClick: () => save("action-plan", `Action Plan: ${query}`, report.actionPlan.map(s => `Step ${s.step}: ${s.action}\n${s.detail}`).join("\n\n")) },
        ]} />
      </Section>

      {/* ── AI Recommendation ─────────────────────────────────────────────── */}
      {report.aiRecommendation && (
        <AiRecommendationCard rec={report.aiRecommendation} router={router} />
      )}

      {/* ── AI Chat Follow-up ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40">
          <MessageSquare className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-[15px] text-foreground">Ask the AI Analyst</span>
          {chatMessages.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 text-[11px] font-bold">
              {Math.floor(chatMessages.length / 2)} {Math.floor(chatMessages.length / 2) === 1 ? "answer" : "answers"}
            </span>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Chat messages */}
          {chatMessages.length > 0 && (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {chatMessages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] px-4 py-3 rounded-2xl text-[13px] leading-relaxed",
                    msg.role === "user"
                      ? "bg-orange-500 text-white rounded-br-sm"
                      : "bg-muted/50 border border-border text-foreground/90 rounded-bl-sm"
                  )}>
                    {msg.role === "assistant" ? (
                      <div className="space-y-0.5 text-[13px] leading-relaxed">{renderChatContent(msg.content)}</div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-muted/50 border border-border">
                    <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>
          )}

          {/* Input */}
          <div className="flex items-end gap-3">
            <textarea
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChat(); } }}
              placeholder={chatMessages.length === 0
                ? `Ask anything about "${query}"… e.g. "Which content format would convert best for this niche?"`
                : "Ask a follow-up question…"}
              rows={2}
              className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none resize-none focus:border-orange-500/40 transition-colors leading-relaxed"
            />
            <Button
              onClick={handleChat}
              disabled={!chatInput.trim() || chatLoading}
              className="bg-orange-500 hover:bg-orange-600 text-white h-10 px-4 shrink-0 gap-2"
            >
              {chatLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Ask
            </Button>
          </div>

          {/* Suggestions */}
          {chatMessages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {CHAT_SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setChatInput(s)}
                  className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-accent text-[11px] text-muted-foreground hover:text-foreground transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
