"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Sparkles, Package, ExternalLink } from "lucide-react";
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

type ProductIdea = { name: string; description: string; format: string };

export function OnboardingModal({ show, onComplete, onStepComplete }: OnboardingModalProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [mounted, setMounted] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("");
  const [niche, setNiche] = useState("");
  const [tone, setTone] = useState("friendly");
  const [saving, setSaving] = useState(false);
  const [productIdea, setProductIdea] = useState<ProductIdea | null>(null);
  const [generatingIdea, setGeneratingIdea] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted || !show) return null;

  const progressPct = (step / TOTAL_STEPS) * 100;
  const goal = GOALS.find((g) => g.id === selectedGoal);

  /** Generate a product idea in the background after step 2 */
  async function generateProductIdea(userNiche: string) {
    if (!userNiche.trim()) return;
    setGeneratingIdea(true);
    try {
      const res = await fetch("/api/onboarding/product-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: userNiche.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setProductIdea(data.idea ?? null);
      }
    } catch { /* non-blocking */ }
    setGeneratingIdea(false);
  }

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
    // Fire product idea generation in background (non-blocking)
    if (niche.trim()) generateProductIdea(niche.trim());
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
                Makes every AI output sound like you. All fields optional.
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

            <div className="mt-6">
              <Button
                onClick={handleSaveBrand}
                disabled={saving}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold"
              >
                {saving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
                ) : (
                  <>Save & continue <ArrowRight className="ml-2 h-4 w-4" /></>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Launch + personalised product idea */}
        {step === 3 && (
          <div className="max-w-md w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-orange-500/20 flex items-center justify-center mx-auto mb-4 text-3xl">
                🚀
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">
                You&apos;re all set{brandName ? `, ${brandName}` : ""}!
              </h2>
              <p className="text-white/40 text-sm">Here&apos;s your personalised starting point.</p>
            </div>

            {/* Product idea card */}
            {niche.trim() ? (
              <div className="bg-white/5 border border-orange-500/30 rounded-xl p-4 mb-4">
                <p className="text-orange-400 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" /> Your first product idea
                </p>
                {generatingIdea ? (
                  <div className="flex items-center gap-2 text-white/40 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Generating idea for your niche…</span>
                  </div>
                ) : productIdea ? (
                  <div>
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-9 h-9 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Package className="h-4 w-4 text-orange-400" />
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">{productIdea.name}</p>
                        <p className="text-white/50 text-xs mt-0.5 leading-relaxed">{productIdea.description}</p>
                        <span className="inline-block mt-1.5 text-[10px] font-medium bg-white/10 text-white/50 rounded-full px-2 py-0.5">
                          {productIdea.format}
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        onComplete();
                        router.push(
                          `/dashboard/digital-products/create?topic=${encodeURIComponent(productIdea.name)}`
                        );
                      }}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm py-2.5"
                    >
                      Create this product <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-white/30 text-sm py-1">
                    Based on your niche: <span className="text-white/60 font-medium">{niche}</span>
                  </div>
                )}
              </div>
            ) : null}

            {/* Fallback / other goal */}
            {goal && goal.id !== "digital_products" && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 flex items-center gap-3">
                <span className="text-2xl shrink-0">{goal.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">{goal.title}</p>
                  <p className="text-white/40 text-xs">{goal.description}</p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-white/20 shrink-0" />
              </div>
            )}

            <button
              type="button"
              onClick={handleLaunch}
              className="w-full bg-white/10 hover:bg-white/15 text-white/70 hover:text-white border border-white/10 rounded-lg py-2.5 px-4 text-sm font-medium transition-all"
            >
              {goal && goal.id !== "digital_products" ? `Go to ${goal.title}` : "Explore the dashboard"} <ArrowRight className="inline ml-1.5 h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
