"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Rocket, ArrowRight, Loader2, Sparkles, Compass,
  PencilLine, AlertTriangle, ChevronRight, Lightbulb,
} from "lucide-react";
import { DiscoveryFlow } from "./components/DiscoveryFlow";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

type Intent = "clear" | "vague" | "no_idea" | "invalid";
type Phase  = "idle" | "validating" | "blocked" | "launching";

interface ValidationResult {
  valid:      boolean;
  intent:     Intent;
  suggestion?: string;
}

/* ─── Constants ──────────────────────────────────────────────────────────────── */

const EXAMPLES = [
  { label: "Budgeting planner for students", goal: "I want to build a budgeting planner for university students" },
  { label: "Fitness meal prep guide",        goal: "I want to build a fitness meal prep guide" },
  { label: "AI prompt bundle for creators",  goal: "I want to build an AI prompt bundle for content creators" },
  { label: "Notion productivity template",   goal: "I want to build a Notion productivity template" },
  { label: "Digital cookbook for parents",   goal: "I want to build a digital cookbook for busy parents" },
  { label: "Social media content calendar",  goal: "I want to build a social media content calendar template" },
];

const PIPELINE_STAGES = [
  { label: "Research",   desc: "Market analysis, audience, competitors" },
  { label: "Product",    desc: "Full digital product with content" },
  { label: "Design",     desc: "Carousel slides & visual assets" },
  { label: "Marketing",  desc: "Captions, email, hashtags" },
  { label: "Store",      desc: "List, price, and publish" },
];

/* ─── Client-side quickcheck (mirrors server, but no AI) ─────────────────────── */

const NO_IDEA_EXACT = new Set([
  "idk", "i dont know", "i don't know", "not sure", "unsure",
  "no idea", "dunno", "help me decide", "help me choose",
  "i need ideas", "suggest something",
]);

const INVALID_EXACT = new Set([
  "test", "testing", "hello", "hi", "hey", "yo",
  "lol", "hmm", "hm", "um", "uh", "ok", "okay",
  "whatever", "anything", "nothing", "something",
  "asdf", "qwerty", "foo", "bar", "123", "abc",
]);

const SPAM_RE = [
  /^(.)\1{3,}$/,          // aaaa, zzzz
  /^[qwerty]{3,}$/i,
  /^[asdfghjkl]{3,}$/i,
  /^[zxcvbnm]{3,}$/i,
  /^[^a-zA-Z\s]{5,}$/,    // symbols only
];

function clientQuickCheck(text: string): Intent | null {
  const norm = text.toLowerCase().replace(/['"!?.]/g, "").trim();
  if (!norm || norm.length < 5) return "invalid";
  if (NO_IDEA_EXACT.has(norm)) return "no_idea";
  if (INVALID_EXACT.has(norm)) return "invalid";
  for (const re of SPAM_RE) if (re.test(norm)) return "invalid";
  if (norm.replace(/\s/g, "").length < 8) return "invalid";
  return null;
}

/* ─── Validation feedback components ────────────────────────────────────────── */

function NoIdeaState({ onEnterOwn }: { onEnterOwn: () => void }) {
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <p className="text-[13px] font-semibold text-foreground mb-1">
        Not sure what to build yet?
      </p>
      <p className="text-[12px] text-muted-foreground mb-4 leading-relaxed">
        That&apos;s completely fine. You can explore ideas with AI guidance, or come back when you&apos;re ready.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <Link
          href="/dashboard/digital-products/discover"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[12px] font-bold transition-colors"
        >
          <Compass className="w-3.5 h-3.5 shrink-0" />
          💡 Help me discover an idea
        </Link>
        <button
          onClick={onEnterOwn}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border hover:bg-accent text-[12px] font-semibold text-foreground transition-colors"
        >
          <PencilLine className="w-3.5 h-3.5 shrink-0" />
          ✍️ I&apos;ll enter my own idea
        </button>
      </div>
    </div>
  );
}

function VagueState({ suggestion, onContinue }: { suggestion: string; onContinue: () => void }) {
  return (
    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.04] p-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <p className="text-[13px] font-semibold text-foreground mb-1 flex items-center gap-2">
        <span>🤔</span> Almost there
      </p>
      <p className="text-[12px] text-muted-foreground leading-relaxed mb-4">
        {suggestion}
      </p>
      <div className="flex gap-2">
        <button
          onClick={onContinue}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-[12px] font-bold transition-colors"
        >
          Launch anyway
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <p className="self-center text-[11px] text-muted-foreground">
          or update your idea above for better results
        </p>
      </div>
    </div>
  );
}

function InvalidState({ suggestion }: { suggestion: string }) {
  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-4 animate-in fade-in slide-in-from-bottom-2 duration-200 flex items-start gap-3">
      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-[12px] font-semibold text-foreground mb-0.5">Please enter a real business idea</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{suggestion}</p>
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────────── */

export default function LaunchPage() {
  const router       = useRouter();
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const [mode,    setMode]    = useState<"launch" | "discover">("launch");
  const [goal,    setGoal]    = useState("");
  const [phase,   setPhase]   = useState<Phase>("idle");
  const [error,   setError]   = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  /* ── Clear validation when user edits ── */
  const handleGoalChange = (val: string) => {
    setGoal(val);
    if (validation) setValidation(null);
  };

  /* ── Actually start the pipeline ── */
  const startPipeline = async (overrideGoal?: string) => {
    const text = (overrideGoal ?? goal).trim();
    if (!text) return;
    setPhase("launching");
    setError(null);
    try {
      const res = await fetch("/api/launch/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: text }),
      });
      if (!res.ok) throw new Error("Failed to create execution");
      const { launchId } = await res.json() as { launchId: string };
      router.push(`/dashboard/launch/${launchId}`);
    } catch {
      setError("Something went wrong — please try again.");
      setPhase("idle");
    }
  };

  /* ── Main submit: validate first, then launch ── */
  const handleStart = async (overrideGoal?: string) => {
    const text = (overrideGoal ?? goal).trim();
    if (!text || phase !== "idle") return;

    // 1. Client-side instant check
    const quickIntent = clientQuickCheck(text);
    if (quickIntent !== null && quickIntent !== "clear") {
      setValidation({
        valid:      false,
        intent:     quickIntent,
        suggestion: quickIntent === "no_idea"
          ? "It looks like you're not sure what to build yet."
          : "Please describe a real business idea. For example: \"A budgeting planner for university students\".",
      });
      setPhase("blocked");
      return;
    }

    // 2. AI validation
    setPhase("validating");
    try {
      const res = await fetch("/api/launch/validate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ goal: text }),
      });

      if (!res.ok) {
        // Fail open — don't block on validation errors
        await startPipeline(text);
        return;
      }

      const result = await res.json() as ValidationResult;
      setValidation(result);

      if (result.intent === "clear") {
        // Immediately proceed
        await startPipeline(text);
      } else {
        setPhase("blocked");
      }
    } catch {
      // Validation API down — fail open and proceed
      await startPipeline(text);
    }
  };

  const pickExample = (ex: typeof EXAMPLES[0]) => {
    setGoal(ex.goal);
    setValidation(null);
    setPhase("idle");
    textareaRef.current?.focus();
  };

  const resetToEnterOwn = () => {
    setGoal("");
    setValidation(null);
    setPhase("idle");
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const isLoading = phase === "validating" || phase === "launching";

  /* ── Discovery mode — full-page takeover ── */
  if (mode === "discover") {
    return (
      <DiscoveryFlow
        onClose={() => setMode("launch")}
        onBuild={(goal) => startPipeline(goal)}
      />
    );
  }

  return (
    <main className="min-h-dvh bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl">

          {/* Badge */}
          <div className="flex justify-center mb-8">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[11px] font-bold uppercase tracking-widest">
              <Sparkles className="w-3 h-3" />
              AI Execution Mode · Beta
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-[2.4rem] sm:text-5xl font-black text-foreground text-center leading-[1.08] tracking-tight mb-3">
            What do you want<br />
            <span className="text-orange-500">to build today?</span>
          </h1>
          <p className="text-center text-[14px] text-muted-foreground mb-10 leading-relaxed">
            Describe your idea. The AI handles every step — Research → Product → Design → Marketing → Store.
          </p>

          {/* Goal input card */}
          <div className={[
            "bg-card border rounded-2xl overflow-hidden shadow-sm mb-3 transition-colors",
            validation?.intent === "invalid" ? "border-red-500/30" :
            validation?.intent === "no_idea" ? "border-amber-500/30" :
            validation?.intent === "vague"   ? "border-blue-500/30" :
            "border-border",
          ].join(" ")}>
            <textarea
              ref={textareaRef}
              value={goal}
              onChange={(e) => handleGoalChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleStart();
              }}
              placeholder="e.g. I want to build a budgeting planner for university students who struggle with money"
              rows={4}
              disabled={isLoading}
              className="w-full resize-none bg-transparent px-5 pt-5 pb-3 text-[15px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none leading-relaxed"
            />
            <div className="flex items-center justify-between px-4 pb-4 pt-1 gap-3">
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground/50">
                <span className="hidden sm:block">⌘ + Enter to start</span>
                {goal.trim().length > 0 && goal.trim().length < 20 && !validation && (
                  <span className="text-amber-500">Add more detail for better results</span>
                )}
                {phase === "validating" && (
                  <span className="flex items-center gap-1 text-muted-foreground/60">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Checking idea…
                  </span>
                )}
              </div>
              <button
                onClick={() => handleStart()}
                disabled={isLoading || !goal.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-[14px] transition-all shrink-0"
              >
                {phase === "launching" ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Starting…</>
                ) : phase === "validating" ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Checking…</>
                ) : (
                  <><Rocket className="w-4 h-4" />Launch<ArrowRight className="w-3.5 h-3.5" /></>
                )}
              </button>
            </div>
          </div>

          {/* Validation feedback — shown below the input */}
          {validation && phase === "blocked" && (
            <div className="mb-3">
              {validation.intent === "no_idea" && (
                <NoIdeaState onEnterOwn={resetToEnterOwn} />
              )}
              {validation.intent === "vague" && (
                <VagueState
                  suggestion={validation.suggestion ?? "Can you add your target audience or the specific problem you solve?"}
                  onContinue={() => startPipeline()}
                />
              )}
              {validation.intent === "invalid" && (
                <InvalidState suggestion={validation.suggestion ?? "Please describe a real business idea."} />
              )}
            </div>
          )}

          {/* Generic error */}
          {error && (
            <p className="text-center text-[13px] text-red-500 mb-3">{error}</p>
          )}

          {/* ── Help Me Decide CTA ── */}
          <div className="relative flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-border/60" />
            <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest shrink-0">or</span>
            <div className="flex-1 h-px bg-border/60" />
          </div>

          <button
            onClick={() => setMode("discover")}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-2xl border-2 border-dashed border-border hover:border-orange-500/40 hover:bg-orange-500/[0.03] text-foreground text-[14px] font-semibold transition-all group disabled:opacity-40 disabled:cursor-not-allowed mb-4"
          >
            <Lightbulb className="w-4 h-4 text-orange-500 group-hover:scale-110 transition-transform" />
            ✨ Help me decide what to build
            <span className="text-[11px] text-muted-foreground font-normal hidden sm:inline">— guided discovery</span>
          </button>

          {/* Time estimate */}
          <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground/50 mb-3">
            <span>⏱ Takes 3–5 minutes</span>
            <span>·</span>
            <span>🤖 Fully automated</span>
            <span>·</span>
            <span>✨ No design skills needed</span>
          </div>

          {/* Example prompts */}
          <div className="mb-10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 text-center mb-3">
              Try an example
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  onClick={() => pickExample(ex)}
                  disabled={isLoading}
                  className="text-[12px] px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-accent hover:border-orange-500/30 text-muted-foreground hover:text-foreground transition-all disabled:opacity-40"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pipeline preview */}
          <div className="border border-border rounded-2xl p-5 bg-card/50">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-4 text-center">
              What gets built automatically
            </p>
            <div className="flex items-start gap-0">
              {PIPELINE_STAGES.map((s, i) => (
                <div key={s.label} className="flex-1 flex flex-col items-center text-center relative">
                  {i < PIPELINE_STAGES.length - 1 && (
                    <div className="absolute top-3 left-1/2 w-full h-px bg-border" />
                  )}
                  <div className="relative z-10 w-6 h-6 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mb-2">
                    <span className="text-[9px] font-black text-orange-500">{i + 1}</span>
                  </div>
                  <p className="text-[11px] font-semibold text-foreground leading-tight">{s.label}</p>
                  <p className="text-[9px] text-muted-foreground/60 leading-tight mt-0.5 hidden sm:block">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
