"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, ArrowRight, Zap, Package, Palette, Video, Megaphone } from "lucide-react";

const EXAMPLES = [
  "I want to sell a budgeting planner for university students",
  "I want to launch a fitness meal prep guide",
  "I want to create an AI prompt bundle for content creators",
  "I want to sell a Notion productivity template",
  "I want to launch a digital cookbook for busy parents",
];

const PIPELINE_STEPS = [
  { icon: <Sparkles className="w-4 h-4" />, label: "Research market", desc: "Audience, competitors, opportunities" },
  { icon: <Package className="w-4 h-4" />, label: "Create product", desc: "Full digital product with content" },
  { icon: <Palette className="w-4 h-4" />, label: "Design assets", desc: "Carousel slides & social graphics" },
  { icon: <Video className="w-4 h-4" />, label: "Write video script", desc: "TikTok/Reels ready script" },
  { icon: <Megaphone className="w-4 h-4" />, label: "Launch marketing", desc: "Captions, email subject, hashtags" },
];

export default function LaunchPage() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLaunch = async (g?: string) => {
    const goalText = (g ?? goal).trim();
    if (!goalText) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/launch/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goalText }),
      });
      if (!res.ok) throw new Error("Failed to start launch");
      const { launchId } = await res.json() as { launchId: string };
      router.push(`/dashboard/launch/${launchId}`);
    } catch {
      setError("Something went wrong — please try again.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh bg-background">
      <div className="max-w-2xl mx-auto px-4 py-16 sm:py-24">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[11px] font-bold uppercase tracking-wider mb-5">
            <Zap className="w-3 h-3 fill-current" />
            AI Execution Mode · Beta
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-foreground leading-[1.05] tracking-tight mb-4">
            What do you want<br />
            <span className="text-orange-500">to launch?</span>
          </h1>
          <p className="text-[15px] text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Tell us your goal. The AI handles Research → Product → Design → Marketing — everything, automatically.
          </p>
        </div>

        {/* Goal input */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm mb-6">
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleLaunch(); }}
            placeholder="e.g. I want to sell a budgeting planner for university students"
            className="w-full h-24 resize-none bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none leading-relaxed"
            disabled={loading}
          />
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <p className="text-[11px] text-muted-foreground">⌘ + Enter to launch</p>
            <button
              onClick={() => handleLaunch()}
              disabled={loading || !goal.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold text-[14px] transition-all shadow-sm"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Starting…</>
              ) : (
                <><Sparkles className="w-4 h-4" />Launch with AI<ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-center text-[13px] text-red-500 mb-4">{error}</p>
        )}

        {/* Examples */}
        <div className="mb-12">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50 text-center mb-3">Try an example</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => { setGoal(ex); handleLaunch(ex); }}
                disabled={loading}
                className="text-[12px] px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-accent hover:border-orange-500/30 text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
              >
                {ex.replace("I want to sell a ", "").replace("I want to launch a ", "").replace("I want to create an ", "").replace("I want a ", "")}
              </button>
            ))}
          </div>
        </div>

        {/* Pipeline preview */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-4">What happens when you launch</p>
          <div className="space-y-3">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center shrink-0">
                  {step.icon}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{step.label}</p>
                  <p className="text-[11px] text-muted-foreground">{step.desc}</p>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div className="ml-auto text-muted-foreground/30 text-[10px]">↓</div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-[11px] text-muted-foreground text-center">
              Everything is saved to your library. You review and approve before anything goes live.
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
