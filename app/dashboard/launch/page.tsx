"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Rocket, ArrowRight, Loader2, Sparkles } from "lucide-react";

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

export default function LaunchPage() {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [goal, setGoal]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleStart = async (overrideGoal?: string) => {
    const text = (overrideGoal ?? goal).trim();
    if (!text || loading) return;
    setLoading(true);
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
      setLoading(false);
    }
  };

  const pickExample = (ex: typeof EXAMPLES[0]) => {
    setGoal(ex.goal);
    textareaRef.current?.focus();
  };

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
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm mb-3">
            <textarea
              ref={textareaRef}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleStart();
              }}
              placeholder="e.g. I want to build a budgeting planner for university students"
              rows={4}
              disabled={loading}
              className="w-full resize-none bg-transparent px-5 pt-5 pb-3 text-[15px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none leading-relaxed"
            />
            <div className="flex items-center justify-between px-4 pb-4 pt-1">
              <span className="text-[11px] text-muted-foreground/50 hidden sm:block">
                ⌘ + Enter to start
              </span>
              <button
                onClick={() => handleStart()}
                disabled={loading || !goal.trim()}
                className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-[14px] transition-all"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Starting…</>
                ) : (
                  <><Rocket className="w-4 h-4" />Start AI Execution<ArrowRight className="w-3.5 h-3.5" /></>
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-center text-[13px] text-red-500 mb-3">{error}</p>
          )}

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
                  disabled={loading}
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
