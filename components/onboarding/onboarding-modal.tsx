"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, BookOpen, Video, TrendingUp, Megaphone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type OnboardingModalProps = {
  show: boolean;
  onComplete: () => void;
  onStepComplete?: (step: number) => void;
};

const GOALS = [
  {
    id: "digital_products",
    emoji: "📦",
    title: "Create a digital product",
    description: "eBooks, planners, guides — AI writes it, you sell it",
    href: "/dashboard/digital-products/discover",
  },
  {
    id: "youtube",
    emoji: "🎬",
    title: "Make a YouTube video",
    description: "Script → voiceover → visuals → ready to upload",
    href: "/dashboard/ai-coach",
  },
  {
    id: "tiktok",
    emoji: "📱",
    title: "Grow my TikTok",
    description: "Generate faceless content that actually gets views",
    href: "/dashboard/design-studio/bulk",
  },
  {
    id: "marketing",
    emoji: "📣",
    title: "Market something I already have",
    description: "Create promo videos, slides, and captions for your product",
    href: "/dashboard/design-studio",
  },
];

const TONES = [
  { id: "friendly", label: "Friendly & Casual", emoji: "😊" },
  { id: "professional", label: "Professional", emoji: "💼" },
  { id: "bold", label: "Bold & Energetic", emoji: "⚡" },
  { id: "educational", label: "Educational", emoji: "🎓" },
];

const TOTAL_STEPS = 3;

export function OnboardingModal({ show, onComplete, onStepComplete }: OnboardingModalProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [mounted, setMounted] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("");
  const [niche, setNiche] = useState("");
  const [tone, setTone] = useState("friendly");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted || !show) return null;

  const progressPct = (step / TOTAL_STEPS) * 100;
  const goal = GOALS.find((g) => g.id === selectedGoal);

  const handleNext = () => {
    onStepComplete?.(step);
    if (step >= TOTAL_STEPS) { onComplete(); return; }
    setStep((s) => s + 1);
  };

  const handleGoalSelect = (id: string) => {
    setSelectedGoal(id);
    // Save use case non-blocking
    fetch("/api/user-features", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabledFeatures: [id] }),
    }).catch(() => {});
    onStepComplete?.(step);
    setStep(2);
  };

  const handleSaveBrand = async () => {
    setSaving(true);
    try {
      if (brandName.trim() || niche.trim()) {
        await fetch("/api/brand-voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandName: brandName.trim() || null,
            tone,
            targetAudience: niche.trim() || null,
            writingStyle: null,
            examplePhrases: null,
          }),
        });
      }
    } catch { /* non-blocking */ }
    setSaving(false);
    setStep(3);
    onStepComplete?.(2);
  };

  const handleLaunch = () => {
    onComplete();
    if (goal?.href) router.push(goal.href);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0a0a0a]">
      {/* Progress bar */}
      <div className="h-1 w-full bg-white/10">
        <div
          className="h-full bg-orange-500 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Step dots */}
      <div className="flex items-center justify-center pt-5 pb-2 gap-2">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i + 1 <= step ? "bg-orange-500 w-8" : "bg-white/20 w-3"
            }`}
          />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6">

        {/* Step 1: What do you want to do? */}
        {step === 1 && (
          <div className="max-w-lg w-full">
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-orange-500/20 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-7 h-7 text-orange-500" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Welcome to Content Flywheel
              </h1>
              <p className="text-white/50 text-base">
                What do you want to do first?
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => handleGoalSelect(g.id)}
                  className="flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/5 hover:border-orange-500/50 hover:bg-orange-500/10 text-left transition-all group"
                >
                  <span className="text-2xl shrink-0">{g.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm">{g.title}</p>
                    <p className="text-white/40 text-xs mt-0.5">{g.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-white/20 group-hover:text-orange-500 transition-colors shrink-0" />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { onComplete(); }}
              className="w-full mt-4 text-white/30 hover:text-white/50 text-xs transition-colors"
            >
              Skip setup — explore everything
            </button>
          </div>
        )}

        {/* Step 2: Brand setup */}
        {step === 2 && (
          <div className="max-w-md w-full">
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-orange-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">{goal?.emoji ?? "✦"}</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Quick — tell us about your brand
              </h2>
              <p className="text-white/40 text-sm">
                Makes every AI output sound like you. Skip if you want.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-white/70 mb-1 block">
                  Brand or creator name
                </Label>
                <Input
                  placeholder="e.g. Digital Drift"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-white/70 mb-1 block">
                  Your niche
                </Label>
                <Input
                  placeholder="e.g. personal finance for beginners"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-white/70 mb-2 block">
                  Tone of voice
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {TONES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTone(t.id)}
                      className={`p-2.5 rounded-lg border text-sm font-medium transition-all flex items-center gap-2 ${
                        tone === t.id
                          ? "border-orange-500 bg-orange-500/20 text-orange-400"
                          : "border-white/10 bg-white/5 text-white/50 hover:border-white/20"
                      }`}
                    >
                      <span>{t.emoji}</span>
                      <span className="text-xs">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={handleSaveBrand}
                disabled={saving}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
              >
                {saving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
                ) : (
                  <>Save & continue <ArrowRight className="ml-2 h-4 w-4" /></>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => { setStep(3); onStepComplete?.(2); }}
                className="text-white/30 hover:text-white/50"
              >
                Skip
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Launch */}
        {step === 3 && (
          <div className="max-w-md w-full text-center">
            <div className="w-20 h-20 rounded-2xl bg-orange-500/20 flex items-center justify-center mx-auto mb-6 text-4xl">
              {goal?.emoji ?? "🚀"}
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">
              You&apos;re all set.
            </h2>
            <p className="text-white/50 mb-2">
              Let&apos;s go {goal ? `— ${goal.title.toLowerCase()}` : "build something"}.
            </p>
            <p className="text-white/30 text-sm mb-8">
              Everything else is waiting when you need it.
            </p>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 text-left">
              <p className="text-white/60 text-xs uppercase tracking-wider mb-3 font-semibold">Your starting point</p>
              {goal ? (
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{goal.emoji}</span>
                  <div>
                    <p className="text-white font-medium text-sm">{goal.title}</p>
                    <p className="text-white/40 text-xs">{goal.description}</p>
                  </div>
                </div>
              ) : (
                <p className="text-white/50 text-sm">Dashboard — explore everything</p>
              )}
            </div>

            <Button
              onClick={handleLaunch}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 text-base"
            >
              Let&apos;s go <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <button
              type="button"
              onClick={onComplete}
              className="mt-3 w-full text-white/30 hover:text-white/50 text-xs transition-colors"
            >
              Go to dashboard instead
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
