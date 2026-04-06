"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, ArrowRight, Loader2, BookOpen, Video, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TOTAL_STEPS = 4;

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

  // Brand voice capture (step 2)
  const [brandName, setBrandName] = useState("");
  const [niche, setNiche] = useState("");
  const [tone, setTone] = useState("friendly");
  const [savingBrand, setSavingBrand] = useState(false);

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

        {/* Step 2: Brand voice quick setup */}
        {step === 2 && (
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

        {/* Step 3: Create first product */}
        {step === 3 && (
          <div className="max-w-lg text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                <BookOpen className="w-7 h-7 text-amber-500" />
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Create your first digital product
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Generate an eBook, planner, or workbook in minutes. AI writes the content using your brand voice — you just pick the topic.
            </p>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-left text-sm text-slate-600 dark:text-slate-400 space-y-2">
              <p className="font-medium text-slate-900 dark:text-white">What you&apos;ll get:</p>
              <p>✅ AI-written chapters based on your niche</p>
              <p>✅ Professional cover design</p>
              <p>✅ Ready-to-sell on Gumroad, Etsy, or Stan Store</p>
            </div>
            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold">
                <Link href="/dashboard/digital-products/create" onClick={handleComplete}>
                  Create my first product
                </Link>
              </Button>
              <Button variant="ghost" onClick={handleNext}>
                I&apos;ll do this later
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Generate promo video */}
        {step === 4 && (
          <div className="max-w-lg text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                <Video className="w-7 h-7 text-amber-500" />
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Turn it into a promo video
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              An AI avatar reads your script in your brand voice. Ready to post on TikTok, Reels, or YouTube Shorts.
            </p>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
              💡 Go to any product → <strong>Videos tab</strong> → click <strong>Generate Avatar Video</strong>
            </div>
            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold">
                <Link href="/dashboard/digital-products" onClick={handleComplete}>
                  Go to my products
                </Link>
              </Button>
              <Button variant="ghost" onClick={handleComplete}>
                Got it, thanks!
              </Button>
            </div>
          </div>
        )}
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
