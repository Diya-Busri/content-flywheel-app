"use client";

/**
 * DiscoveryFlow
 * ─────────────────────────────────────────────────────────────────────────────
 * Full-page guided discovery conversation that helps users who don't know what
 * to build. Asks 5 questions one at a time, generates personalised opportunity
 * cards, optionally does a quick viability research check, and then either
 * launches the AI pipeline or returns the user to the goal input.
 *
 * Props:
 *   onClose  — back to the main launch input
 *   onBuild  — start the launch pipeline with a given goal string
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowLeft, ArrowRight, Loader2, Star, Search, Rocket,
  RefreshCw, CheckCircle2, AlertTriangle, ChevronRight,
  BarChart2, Lightbulb, Target, TrendingUp,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

type Phase =
  | "questions"
  | "generating"
  | "opportunities"
  | "researching"
  | "research_done"
  | "refine";

interface Answers {
  interests:   string;
  audience:    string;
  experience:  string;
  productType: string;
  goal:        string;
}

interface Opportunity {
  id:          string;
  name:        string;
  tagline:     string;
  whyFits:     string;
  demand:      number;
  competition: number;
  difficulty:  "Easy" | "Medium" | "Hard";
  priceRange:  string;
  confidence:  number;
  launchGoal:  string;
}

interface QuickResearch {
  validationScore: number;
  findings:        string[];
  opportunity:     string;
  risk:            string;
  recommendation:  string;
  refinedGoal:     string;
}

/* ─── Static config ──────────────────────────────────────────────────────────── */

const TEXT_STEPS = [
  {
    field:       "interests" as keyof Answers,
    question:    "What interests you?",
    subtitle:    "Your passions make the best products",
    placeholder: "e.g. Fitness, AI, cooking...",
    chips:       ["Fitness", "Finance", "Dogs", "AI", "Gaming", "Food", "Travel", "Photography", "Music", "Coding"],
  },
  {
    field:       "audience" as keyof Answers,
    question:    "Who would you enjoy helping?",
    subtitle:    "Think about who gets the most value from you",
    placeholder: "e.g. Students, parents, freelancers...",
    chips:       ["Students", "Parents", "Business owners", "Creators", "Teachers", "Freelancers", "Beginners", "Professionals"],
  },
  {
    field:       "experience" as keyof Answers,
    question:    "What experience do you already have?",
    subtitle:    "Even basic knowledge is valuable to others",
    placeholder: "e.g. Marketing, gym, photography...",
    chips:       ["Gym / Fitness", "University", "Photography", "Marketing", "Coding", "Finance", "Teaching", "None"],
  },
];

const PRODUCT_OPTIONS = [
  { value: "Ebook",         emoji: "📖", desc: "Written guide or digital book"     },
  { value: "Templates",     emoji: "📋", desc: "Ready-made files for others"        },
  { value: "Prompt Pack",   emoji: "🤖", desc: "AI prompts and workflows"           },
  { value: "Notion System", emoji: "🗂️",  desc: "Notion workspace or dashboard"    },
  { value: "Course",        emoji: "🎓", desc: "Video or text-based lessons"        },
  { value: "AI Tool",       emoji: "⚡", desc: "AI-powered utility or workflow"     },
  { value: "I don't know",  emoji: "🤷", desc: "Let AI decide the best format"     },
];

const GOAL_OPTIONS = [
  { value: "Passive income",   emoji: "💰", desc: "Earn while you sleep"       },
  { value: "Build a business", emoji: "🏢", desc: "Full-time online business"  },
  { value: "Grow an audience", emoji: "📣", desc: "Build a following online"   },
  { value: "Replace my job",   emoji: "🚀", desc: "Go full self-employed"      },
  { value: "Not sure",         emoji: "🤔", desc: "Still figuring it out"      },
];

const GENERATING_MSGS = [
  "Analysing your profile…",
  "Scanning market opportunities…",
  "Matching to your interests…",
  "Building your opportunity report…",
];

const RESEARCH_MSGS = [
  "Checking market demand…",
  "Analysing competition…",
  "Reviewing search trends…",
  "Validating business viability…",
];

/* ─── Sub-components ──────────────────────────────────────────────────────────── */

function ScoreBar({ score, colorClass }: { score: number; colorClass: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/8 dark:bg-black/20">
        <div
          className={`h-full rounded-full ${colorClass} transition-all duration-700`}
          style={{ width: `${score * 10}%` }}
        />
      </div>
      <span className="text-[10px] font-bold text-foreground/70 w-4 text-right tabular-nums">{score}</span>
    </div>
  );
}

function DiffBadge({ diff }: { diff: "Easy" | "Medium" | "Hard" }) {
  const cls = diff === "Easy"
    ? "text-green-500 bg-green-500/10"
    : diff === "Medium"
      ? "text-amber-500 bg-amber-500/10"
      : "text-red-500 bg-red-500/10";
  return (
    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{diff}</span>
  );
}

function LoadingState({ msgs }: { msgs: string[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % msgs.length), 1800);
    return () => clearInterval(t);
  }, [msgs]);
  return (
    <div className="flex flex-col items-center py-20 gap-6">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-orange-500 animate-spin" />
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 animate-pulse" />
      </div>
      <div className="text-center">
        <p className="text-[15px] font-semibold text-foreground animate-pulse">{msgs[idx]}</p>
        <p className="text-[12px] text-muted-foreground mt-1">This takes about 10 seconds</p>
      </div>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────────────────── */

interface Props {
  onClose: () => void;
  onBuild: (goal: string) => void;
}

export function DiscoveryFlow({ onClose, onBuild }: Props) {
  const [phase,       setPhase]       = useState<Phase>("questions");
  const [step,        setStep]        = useState(0);          // 0-4
  const [answers,     setAnswers]     = useState<Partial<Answers>>({});
  const [currentInput,setCurrentInput]= useState("");
  const [opportunities,setOpps]       = useState<Opportunity[]>([]);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [research,    setResearch]    = useState<QuickResearch | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [refineGoal,  setRefineGoal]  = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 80);

  /* ── Progress ── */
  const progress =
    phase === "questions"   ? ((step + 1) / 5) * 80 :
    phase === "generating"  ? 85 :
    phase === "opportunities"? 90 :
    phase === "researching" ? 95 : 100;

  /* ── Navigation ── */
  const handleBack = useCallback(() => {
    if (phase === "research_done")  { setPhase("opportunities"); setSelectedOpp(null); setResearch(null); return; }
    if (phase === "refine")         { setPhase("research_done"); return; }
    if (phase === "opportunities")  { setPhase("questions"); setStep(4); return; }
    if (phase === "questions") {
      if (step === 0) { onClose(); return; }
      setStep(s => s - 1);
      // restore previous answer into input if text step
      if (step - 1 < 3) {
        const prevField = TEXT_STEPS[step - 1].field;
        setCurrentInput((answers[prevField] as string) ?? "");
      }
    }
  }, [phase, step, answers, onClose]);

  /* ── Text step: chip click ── */
  const selectChip = (chip: string) => {
    const field = TEXT_STEPS[step].field;
    setAnswers(prev => ({ ...prev, [field]: chip }));
    setCurrentInput("");
    if (step < 2) { setStep(s => s + 1); focusInput(); }
    else          { setStep(3); }                       // advance to step 3 (product type)
  };

  /* ── Text step: Next button ── */
  const handleTextNext = () => {
    const val = currentInput.trim();
    if (!val) return;
    const field = TEXT_STEPS[step].field;
    setAnswers(prev => ({ ...prev, [field]: val }));
    setCurrentInput("");
    if (step < 2) { setStep(s => s + 1); focusInput(); }
    else          { setStep(3); }
  };

  /* ── Step 3: product type ── */
  const selectProductType = (val: string) => {
    setAnswers(prev => ({ ...prev, productType: val }));
    setStep(4);
  };

  /* ── Step 4: goal → generate ── */
  const selectGoal = (val: string) => {
    const finalAnswers = { ...answers, goal: val } as Answers;
    setAnswers(finalAnswers);
    generateOpportunities(finalAnswers);
  };

  /* ── Generate opportunities ── */
  const generateOpportunities = async (ans: Answers) => {
    setPhase("generating");
    setError(null);
    try {
      const res = await fetch("/api/launch/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ans),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json() as { opportunities?: Opportunity[] };
      setOpps(data.opportunities ?? []);
      setPhase("opportunities");
    } catch {
      setError("Failed to generate ideas — please try again.");
      setPhase("questions");
      setStep(4);
    }
  };

  /* ── Research a chosen idea ── */
  const handleResearch = async (opp: Opportunity) => {
    setSelectedOpp(opp);
    setPhase("researching");
    setError(null);
    try {
      const res = await fetch("/api/launch/discover-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:           opp.name,
          tagline:        opp.tagline,
          launchGoal:     opp.launchGoal,
          answersContext: `Interests: ${answers.interests ?? ""}. Audience: ${answers.audience ?? ""}. Experience: ${answers.experience ?? ""}. Goal: ${answers.goal ?? ""}.`,
        }),
      });
      if (!res.ok) throw new Error("Research failed");
      const data = await res.json() as QuickResearch;
      setResearch(data);
      setPhase("research_done");
    } catch {
      setError("Research failed — please try again.");
      setPhase("opportunities");
    }
  };

  /* ── Build with goal ── */
  const handleBuild = (goal: string) => onBuild(goal.trim() || (selectedOpp?.launchGoal ?? ""));

  /* ─────────────────────────────────────────────────── */
  /* Render helpers */
  /* ─────────────────────────────────────────────────── */

  const renderTextStep = () => {
    const s = TEXT_STEPS[step];
    return (
      <div key={step} className="animate-in fade-in slide-in-from-bottom-3 duration-250">
        <p className="text-[10px] font-bold text-orange-500/70 uppercase tracking-widest mb-2">
          Step {step + 1} of 5
        </p>
        <h2 className="text-[1.6rem] font-black text-foreground leading-tight mb-1">{s.question}</h2>
        <p className="text-[13px] text-muted-foreground mb-6">{s.subtitle}</p>

        {/* Quick-pick chips */}
        <div className="flex flex-wrap gap-2 mb-5">
          {s.chips.map(chip => (
            <button
              key={chip}
              onClick={() => selectChip(chip)}
              className={[
                "px-3 py-1.5 rounded-xl text-[12px] font-semibold border transition-all",
                currentInput === chip
                  ? "bg-orange-500 border-orange-500 text-white"
                  : "bg-card border-border text-foreground hover:border-orange-500/40 hover:bg-orange-500/5",
              ].join(" ")}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Free-text input */}
        <div className="relative mb-6">
          <input
            ref={inputRef}
            type="text"
            value={currentInput}
            onChange={e => setCurrentInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleTextNext(); }}
            placeholder={s.placeholder}
            className="w-full px-4 py-3 rounded-xl border border-border bg-card text-[14px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-orange-500/40 transition-colors"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleTextNext}
            disabled={!currentInput.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[13px] transition-all"
          >
            Next <ArrowRight className="w-3.5 h-3.5" />
          </button>
          {step > 0 && (
            <button onClick={handleBack} className="px-4 py-2.5 rounded-xl border border-border hover:bg-accent text-[13px] font-medium text-muted-foreground transition-colors">
              Back
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderProductStep = () => (
    <div key="step3" className="animate-in fade-in slide-in-from-bottom-3 duration-250">
      <p className="text-[10px] font-bold text-orange-500/70 uppercase tracking-widest mb-2">Step 4 of 5</p>
      <h2 className="text-[1.6rem] font-black text-foreground leading-tight mb-1">What would you rather create?</h2>
      <p className="text-[13px] text-muted-foreground mb-6">Pick a format — or let AI decide what suits you best</p>

      <div className="grid grid-cols-2 gap-2 mb-5">
        {PRODUCT_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => selectProductType(opt.value)}
            className="flex flex-col items-start gap-0.5 p-3.5 rounded-xl border border-border bg-card hover:border-orange-500/40 hover:bg-orange-500/[0.03] text-left transition-all group"
          >
            <span className="text-xl mb-0.5">{opt.emoji}</span>
            <span className="text-[12px] font-bold text-foreground group-hover:text-orange-500 transition-colors">{opt.value}</span>
            <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
          </button>
        ))}
      </div>

      <button onClick={handleBack} className="text-[12px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> Back
      </button>
    </div>
  );

  const renderGoalStep = () => (
    <div key="step4" className="animate-in fade-in slide-in-from-bottom-3 duration-250">
      <p className="text-[10px] font-bold text-orange-500/70 uppercase tracking-widest mb-2">Step 5 of 5</p>
      <h2 className="text-[1.6rem] font-black text-foreground leading-tight mb-1">What&apos;s your goal?</h2>
      <p className="text-[13px] text-muted-foreground mb-6">What do you want to achieve with this product?</p>

      <div className="flex flex-col gap-2 mb-5">
        {GOAL_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => selectGoal(opt.value)}
            className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:border-orange-500/40 hover:bg-orange-500/[0.03] text-left transition-all group"
          >
            <span className="text-xl shrink-0">{opt.emoji}</span>
            <div>
              <p className="text-[13px] font-bold text-foreground group-hover:text-orange-500 transition-colors">{opt.value}</p>
              <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 ml-auto shrink-0" />
          </button>
        ))}
      </div>

      <button onClick={handleBack} className="text-[12px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> Back
      </button>
    </div>
  );

  const renderOpportunities = () => (
    <div className="animate-in fade-in slide-in-from-bottom-3 duration-250">
      <div className="mb-6">
        <p className="text-[10px] font-bold text-orange-500/70 uppercase tracking-widest mb-2">
          Your Opportunity Report
        </p>
        <h2 className="text-[1.6rem] font-black text-foreground leading-tight mb-1">
          {opportunities.length} ideas matched your profile
        </h2>
        <p className="text-[13px] text-muted-foreground">
          Based on your interests, audience, and experience. Research an idea before building, or jump straight in.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-[12px] text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-3 mb-5">
        {opportunities.map((opp, i) => (
          <OpportunityCard
            key={opp.id}
            opp={opp}
            rank={i}
            onResearch={() => handleResearch(opp)}
            onBuild={() => handleBuild(opp.launchGoal)}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => generateOpportunities(answers as Answers)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border hover:bg-accent text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          🔄 Different ideas
        </button>
        <button onClick={onClose} className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">
          ← Back to manual entry
        </button>
      </div>
    </div>
  );

  const renderResearchDone = () => {
    if (!research || !selectedOpp) return null;

    const scoreColor =
      research.validationScore >= 7 ? "text-green-500" :
      research.validationScore >= 5 ? "text-amber-500" : "text-red-500";

    const recIcon =
      research.recommendation === "Build it" ? CheckCircle2 :
      research.recommendation === "Refine first" ? Target : AlertTriangle;
    const RecIcon = recIcon;

    const recColor =
      research.recommendation === "Build it"           ? "text-green-500 bg-green-500/10 border-green-500/20" :
      research.recommendation === "Refine first"        ? "text-amber-500 bg-amber-500/10 border-amber-500/20" :
      "text-red-400 bg-red-500/10 border-red-500/20";

    return (
      <div className="animate-in fade-in slide-in-from-bottom-3 duration-250">
        {/* Header */}
        <div className="mb-5">
          <p className="text-[10px] font-bold text-orange-500/70 uppercase tracking-widest mb-2">Research Report</p>
          <h2 className="text-[1.4rem] font-black text-foreground leading-tight mb-1">{selectedOpp.name}</h2>
          <p className="text-[13px] text-muted-foreground">{selectedOpp.tagline}</p>
        </div>

        {/* Validation score */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border mb-4">
          <div className="text-center">
            <p className={`text-[2rem] font-black ${scoreColor} leading-none`}>{research.validationScore}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mt-0.5">/ 10</p>
          </div>
          <div>
            <p className="text-[13px] font-bold text-foreground mb-0.5">Validation Score</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{research.opportunity}</p>
          </div>
        </div>

        {/* Key findings */}
        <div className="rounded-2xl bg-card border border-border p-4 mb-4">
          <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <BarChart2 className="w-3 h-3" /> Key Findings
          </p>
          <ul className="space-y-2">
            {(research.findings ?? []).map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px] text-foreground/80">
                <span className="text-green-500 font-bold shrink-0 mt-0.5">✓</span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Risk */}
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/[0.04] border border-amber-500/20 mb-4">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-0.5">Main Risk</p>
            <p className="text-[12px] text-foreground/80">{research.risk}</p>
          </div>
        </div>

        {/* Recommendation */}
        <div className={`flex items-center gap-3 p-3.5 rounded-xl border mb-5 ${recColor}`}>
          <RecIcon className="w-4 h-4 shrink-0" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest">Recommendation</p>
            <p className="text-[13px] font-black">{research.recommendation}</p>
          </div>
        </div>

        {/* Founder decision */}
        <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">Do you want to build this?</p>
        <div className="flex flex-col gap-2 mb-4">
          <button
            onClick={() => handleBuild(research.refinedGoal || selectedOpp.launchGoal)}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-[13px] transition-colors"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            ✅ Build it — start the AI pipeline
          </button>
          <button
            onClick={() => { setRefineGoal(research.refinedGoal || selectedOpp.launchGoal); setPhase("refine"); }}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border hover:bg-accent text-[13px] font-semibold text-foreground transition-colors"
          >
            <TrendingUp className="w-4 h-4 shrink-0 text-blue-400" />
            ✏️ Improve the positioning first
          </button>
          <button
            onClick={() => { setPhase("opportunities"); setSelectedOpp(null); setResearch(null); }}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border hover:bg-accent text-[13px] font-semibold text-foreground transition-colors"
          >
            <RefreshCw className="w-4 h-4 shrink-0 text-muted-foreground" />
            🔄 Try another idea
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            ← Back to manual entry
          </button>
        </div>
      </div>
    );
  };

  const renderRefine = () => (
    <div className="animate-in fade-in slide-in-from-bottom-3 duration-250">
      <p className="text-[10px] font-bold text-orange-500/70 uppercase tracking-widest mb-2">Refine Positioning</p>
      <h2 className="text-[1.4rem] font-black text-foreground leading-tight mb-1">Edit your launch goal</h2>
      <p className="text-[13px] text-muted-foreground mb-5">
        The AI generated this based on your research. Tweak it until it feels exactly right.
      </p>

      <textarea
        value={refineGoal}
        onChange={e => setRefineGoal(e.target.value)}
        rows={4}
        className="w-full resize-none px-4 py-3 rounded-xl border border-border bg-card text-[14px] text-foreground focus:outline-none focus:border-orange-500/40 leading-relaxed mb-4 transition-colors"
      />

      <div className="flex gap-2">
        <button
          onClick={() => handleBuild(refineGoal)}
          disabled={!refineGoal.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[13px] transition-all"
        >
          <Rocket className="w-4 h-4" />
          Launch with this goal
        </button>
        <button
          onClick={() => setPhase("research_done")}
          className="px-4 py-2.5 rounded-xl border border-border hover:bg-accent text-[13px] font-medium text-muted-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  /* ─────────────────────────────────────────────────── */
  /* Main render */
  /* ─────────────────────────────────────────────────── */

  return (
    <div className="min-h-dvh bg-background flex flex-col">

      {/* ── Header ── */}
      <header className="border-b border-border px-4 py-3 flex items-center gap-4 shrink-0">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {phase === "questions" && step === 0 ? "Back" : "Back"}
        </button>

        <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {phase === "questions" && (
          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
            {step + 1} / 5
          </span>
        )}
      </header>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-4 py-10">

          {/* Intro badge */}
          {phase === "questions" && step === 0 && (
            <div className="flex items-center gap-2 mb-6 animate-in fade-in duration-300">
              <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <Lightbulb className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-orange-500">AI Business Coach</p>
                <p className="text-[10px] text-muted-foreground">I&apos;ll help you find the perfect product to build</p>
              </div>
            </div>
          )}

          {/* Phase content */}
          {phase === "questions"    && step < 3  && renderTextStep()}
          {phase === "questions"    && step === 3 && renderProductStep()}
          {phase === "questions"    && step === 4 && renderGoalStep()}
          {phase === "generating"   && <LoadingState msgs={GENERATING_MSGS} />}
          {phase === "opportunities"&& renderOpportunities()}
          {phase === "researching"  && <LoadingState msgs={RESEARCH_MSGS} />}
          {phase === "research_done"&& renderResearchDone()}
          {phase === "refine"       && renderRefine()}

        </div>
      </div>

    </div>
  );
}

/* ─── Opportunity card ────────────────────────────────────────────────────────── */

function OpportunityCard({
  opp, rank, onResearch, onBuild,
}: {
  opp: Opportunity;
  rank: number;
  onResearch: () => void;
  onBuild: () => void;
}) {
  return (
    <div className={[
      "rounded-2xl border p-4 transition-all",
      rank === 0
        ? "border-orange-500/30 bg-orange-500/[0.03] shadow-sm"
        : "border-border bg-card/60",
    ].join(" ")}>

      {rank === 0 && (
        <div className="flex items-center gap-1.5 mb-2.5">
          <Star className="w-3 h-3 text-orange-500 fill-orange-500" />
          <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Best match</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-black text-foreground leading-tight">{opp.name}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{opp.tagline}</p>
        </div>
        <DiffBadge diff={opp.difficulty} />
      </div>

      <p className="text-[11px] text-muted-foreground/70 italic leading-relaxed mb-3 border-l-2 border-orange-500/20 pl-2.5">
        {opp.whyFits}
      </p>

      <div className="space-y-1.5 mb-3">
        <div>
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-[9px] text-muted-foreground/60 uppercase tracking-widest">Demand</span>
          </div>
          <ScoreBar score={opp.demand} colorClass="bg-green-500" />
        </div>
        <div>
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-[9px] text-muted-foreground/60 uppercase tracking-widest">Competition</span>
          </div>
          <ScoreBar score={opp.competition} colorClass="bg-amber-500" />
        </div>
        <div>
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-[9px] text-muted-foreground/60 uppercase tracking-widest">AI Confidence</span>
          </div>
          <ScoreBar score={opp.confidence} colorClass="bg-blue-500" />
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-muted-foreground">Est. price</span>
        <span className="text-[13px] font-bold text-foreground">{opp.priceRange}</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onResearch}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border hover:bg-accent text-[11px] font-semibold text-foreground transition-colors"
        >
          <Search className="w-3 h-3" />
          📊 Research
        </button>
        <button
          onClick={onBuild}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold transition-colors"
        >
          <Rocket className="w-3 h-3" />
          🚀 Build
        </button>
      </div>
    </div>
  );
}
