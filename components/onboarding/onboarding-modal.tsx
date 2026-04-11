"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, ArrowRight, Loader2, BookOpen, Video, Sparkles, Shirt, Mail, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { USE_CASES } from "@/lib/use-cases";

type StepContent = {
  icon: React.ReactNode;
  title: string;
  description: string;
  bullets: string[];
  cta: string;
  href: string;
};

const STEP_CONTENT: Record<string, StepContent> = {
  videos: {
    icon: <Video className="w-7 h-7 text-amber-500" />,
    title: "Create your first video",
    description: "Generate TikTok, Reels, or YouTube Shorts with an AI avatar in your brand voice — no camera needed.",
    bullets: ["AI avatar reads your script", "Auto-captions and hooks", "Ready to post in minutes"],
    cta: "Get video ideas",
    href: "/dashboard/video-ideas",
  },
  physical_products: {
    icon: <Shirt className="w-7 h-7 text-amber-500" />,
    title: "Set up your first print-on-demand product",
    description: "Upload a design, pick a product from the Printify catalog, and start selling merch — no stock needed.",
    bullets: ["Upload your design", "Choose from 1000+ products", "Printify handles fulfilment"],
    cta: "Create a product",
    href: "/dashboard/print-on-demand",
  },
  digital_products: {
    icon: <BookOpen className="w-7 h-7 text-amber-500" />,
    title: "Create your first digital product",
    description: "Generate an eBook, planner, or workbook in minutes. AI writes the content using your brand voice — you just pick the topic.",
    bullets: ["AI-written chapters based on your niche", "Professional cover design", "Ready-to-sell on Gumroad, Etsy, or Stan Store"],
    cta: "Create my first product",
    href: "/dashboard/digital-products/create",
  },
  email_marketing: {
    icon: <Mail className="w-7 h-7 text-amber-500" />,
    title: "Build your email list",
    description: "Create a landing page and start collecting subscribers. Send campaigns directly from Content Flywheel.",
    bullets: ["Custom opt-in pages", "Automated welcome sequences", "Track open and click rates"],
    cta: "Set up email marketing",
    href: "/dashboard/email",
  },
  goals: {
    icon: <Target className="w-7 h-7 text-amber-500" />,
    title: "Set your first goal",
    description: "Define revenue and content milestones. Content Flywheel breaks them into daily tasks and tracks your progress.",
    bullets: ["Revenue and follower milestones", "AI-generated daily task plan", "Progress tracking dashboard"],
    cta: "Set a goal",
    href: "/dashboard/goals",
  },
};

const PRIORITY_ORDER = ["videos", "physical_products", "digital_products", "email_marketing", "goals"];

function getStepContent(selectedUseCases: string[], stepIndex: 0 | 1): StepContent {
  const ordered = PRIORITY_ORDER.filter((id) => selectedUseCases.includes(id));
  const fallback = STEP_CONTENT.digital_products;
  if (stepIndex === 0) return STEP_CONTENT[ordered[0]] ?? fallback;
  // Step 2: show second priority, or a generic "you're set" with videos fallback
  return STEP_CONTENT[ordered[1]] ?? STEP_CONTENT.videos;
}

const TOTAL_STEPS = 5;

type OnboardingModalProps = {
  show: boolean;
  onComplete: () => void;
  onStepComplete?: (step: number) => void;
};

const TONE_OPTIONS = [
  { id: "friendly", label: "Friendly & Casual" },
  { id: "professional", label: "Professional" },
  { id: "bold", label: "Bold & Energetic" },
  { id: "educational", label: "Educational" },
];

export function OnboardingModal({ show, onComplete, onStepComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const [mounted, setMounted] = useState(false);

  // Step 2: Use case selection
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([]);

  // Step 3: Brand voice capture
  const [brandName, setBrandName] = useState("");
  const [niche, setNiche] = useState("");
  const [tone, setTone] = useState("friendly");
  const [savingBrand, setSavingBrand] = useState(false);

  const toggleUseCase = (id: string) => {
    setSelectedUseCases((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSaveUseCases = async () => {
    try {
      await fetch("/api/user-features", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabledFeatures: selectedUseCases }),
      });
    } catch {
      // non-blocking
    }
    handleNext();
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !show) return null;

  const progressPct = (step / TOTAL_STEPS) * 100;

  const handleSkip = () => {
    try {
      onComplete();
    } catch (err) {
      console.error("[OnboardingModal] handleSkip:", err);
    }
  };

  const handleNext = () => {
    try {
      onStepComplete?.(step);
      if (step >= TOTAL_STEPS) {
        onComplete();
        return;
      }
      setStep((s) => s + 1);
    } catch (err) {
      console.error("[OnboardingModal] handleNext:", err);
    }
  };

  const handleComplete = () => {
    try {
      onComplete();
    } catch (err) {
      console.error("[OnboardingModal] handleComplete:", err);
    }
  };

  const handleSaveBrandVoice = async () => {
    if (!brandName.trim() && !niche.trim()) {
      handleNext();
      return;
    }
    setSavingBrand(true);
    try {
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
    } catch {
      // non-blocking
    } finally {
      setSavingBrand(false);
      handleNext();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-[#0F0F0F]">
      {/* Progress bar */}
      <div className="h-1 w-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full bg-amber-500 transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Step counter */}
      <div className="flex items-center justify-center pt-6 pb-2">
        <div className="flex items-center gap-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i + 1 <= step
                  ? "bg-amber-500 w-6"
                  : "bg-slate-200 dark:bg-slate-700 w-2"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 sm:p-8">

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="max-w-lg text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-amber-500" />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
              Welcome to Content Flywheel 🚀
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Turn your knowledge into digital products and promo videos — in minutes. Let&apos;s get you set up in 3 quick steps.
            </p>
            <div className="grid grid-cols-3 gap-4 text-sm text-left mt-6">
              {[
                { icon: <Sparkles className="w-4 h-4" />, label: "Brand voice", desc: "AI that sounds like you" },
                { icon: <BookOpen className="w-4 h-4" />, label: "First product", desc: "eBook, planner, or guide" },
                { icon: <Video className="w-4 h-4" />, label: "Promo video", desc: "Avatar video to sell it" },
              ].map((item) => (
                <div key={item.label} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                  <div className="flex justify-center mb-1 text-amber-500">{item.icon}</div>
                  <p className="font-semibold text-slate-900 dark:text-white text-xs">{item.label}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="pt-4">
              <Button
                onClick={handleNext}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold px-8"
              >
                Let&apos;s get started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Use case selection */}
        {step === 2 && (
          <div className="max-w-lg w-full space-y-6">
            <div className="text-center space-y-2">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-amber-500" />
                </div>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                What will you use Content Flywheel for?
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Pick everything that applies — we&apos;ll customise your sidebar to show only what you need.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {USE_CASES.map((uc) => {
                const selected = selectedUseCases.includes(uc.id);
                return (
                  <button
                    key={uc.id}
                    type="button"
                    onClick={() => toggleUseCase(uc.id)}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                      selected
                        ? "border-amber-500 bg-amber-500/10"
                        : "border-slate-200 dark:border-slate-700 hover:border-amber-300"
                    }`}
                  >
                    <span className="text-2xl shrink-0">{uc.emoji}</span>
                    <div className="min-w-0">
                      <p className={`font-semibold text-sm ${selected ? "text-amber-700 dark:text-amber-400" : "text-slate-900 dark:text-white"}`}>
                        {uc.label}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{uc.description}</p>
                    </div>
                    <div className={`ml-auto shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      selected ? "border-amber-500 bg-amber-500" : "border-slate-300 dark:border-slate-600"
                    }`}>
                      {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                onClick={handleSaveUseCases}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
              >
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={handleNext} className="text-slate-500 hover:text-slate-700">
                Skip — show everything
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Brand voice quick setup */}
        {step === 3 && (
          <div className="max-w-md w-full space-y-6">
            <div className="text-center space-y-2">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-amber-500" />
                </div>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                Tell us about your brand
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                This powers every AI output — scripts, product copy, and videos will sound like <em>you</em>.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="ob-brand-name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Brand or creator name
                </Label>
                <Input
                  id="ob-brand-name"
                  placeholder="e.g. Sarah's Planner Co."
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="ob-niche" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Your niche / target audience
                </Label>
                <Input
                  id="ob-niche"
                  placeholder="e.g. busy moms who want to get organised"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                  Tone of voice
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {TONE_OPTIONS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTone(t.id)}
                      className={`p-2.5 rounded-lg border text-sm font-medium transition-all ${
                        tone === t.id
                          ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-amber-300"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                onClick={handleSaveBrandVoice}
                disabled={savingBrand}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
              >
                {savingBrand ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  <>Save & continue <ArrowRight className="ml-2 h-4 w-4" /></>
                )}
              </Button>
              <Button variant="ghost" onClick={handleNext} className="text-slate-500 hover:text-slate-700">
                Skip for now
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Primary action based on use case */}
        {step === 4 && (() => {
          const content = getStepContent(selectedUseCases, 0);
          return (
            <div className="max-w-lg text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                  {content.icon}
                </div>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                {content.title}
              </h2>
              <p className="text-slate-600 dark:text-slate-400">{content.description}</p>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-left text-sm text-slate-600 dark:text-slate-400 space-y-2">
                <p className="font-medium text-slate-900 dark:text-white">What you&apos;ll get:</p>
                {content.bullets.map((b) => <p key={b}>✅ {b}</p>)}
              </div>
              <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold">
                  <Link href={content.href} onClick={handleComplete}>{content.cta}</Link>
                </Button>
                <Button variant="ghost" onClick={handleNext}>I&apos;ll do this later</Button>
              </div>
            </div>
          );
        })()}

        {/* Step 5: Secondary action based on use case */}
        {step === 5 && (() => {
          const content = getStepContent(selectedUseCases, 1);
          return (
            <div className="max-w-lg text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                  {content.icon}
                </div>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                {content.title}
              </h2>
              <p className="text-slate-600 dark:text-slate-400">{content.description}</p>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-left text-sm text-slate-600 dark:text-slate-400 space-y-2">
                <p className="font-medium text-slate-900 dark:text-white">What you&apos;ll get:</p>
                {content.bullets.map((b) => <p key={b}>✅ {b}</p>)}
              </div>
              <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold">
                  <Link href={content.href} onClick={handleComplete}>{content.cta}</Link>
                </Button>
                <Button variant="ghost" onClick={handleComplete}>Got it, thanks!</Button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Skip button - top right */}
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={handleSkip}
          className="rounded-lg p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          aria-label="Skip onboarding"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
