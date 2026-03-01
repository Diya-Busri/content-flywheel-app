"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, ArrowRight, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";

const TOTAL_STEPS = 4;

type OnboardingModalProps = {
  show: boolean;
  onComplete: () => void;
  onStepComplete?: (step: number) => void;
};

export function OnboardingModal({ show, onComplete, onStepComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const [mounted, setMounted] = useState(false);

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

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-[#0F0F0F]">
      {/* Progress bar */}
      <div className="h-1 w-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full bg-amber-500 transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 sm:p-8">
        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="max-w-lg text-center space-y-6">
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
              Welcome to Content Flywheel 🚀
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Create digital products, AI voiceovers, and conversion-focused videos for TikTok, Instagram, and YouTube—all from one place.
            </p>
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

        {/* Step 2: Coming soon placeholder */}
        {step === 2 && (
          <div className="max-w-2xl w-full space-y-6">
            <div className="aspect-video rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 flex flex-col items-center justify-center gap-2 px-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white text-center">
                Coming Soon
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-center">
                We&apos;re working on something great.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={handleNext}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
              >
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={handleNext} className="text-slate-600">
                <SkipForward className="mr-2 h-4 w-4" /> Skip
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Brand profile */}
        {step === 3 && (
          <div className="max-w-lg text-center space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Set up your brand profile
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Add your brand name and niche so we can tailor content to you.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold">
                <Link href="/dashboard/settings">Go to Settings</Link>
              </Button>
              <Button variant="ghost" onClick={handleNext}>
                Skip for now
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: First product — use router for CTA to avoid Link + modal unmount issues */}
        {step === 4 && (
          <div className="max-w-lg text-center space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Create your first digital product
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Generate an ebook, planner, or workbook in minutes.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold">
                <Link href="/dashboard/digital-products/create" onClick={handleComplete}>
                  Create product
                </Link>
              </Button>
              <Button variant="ghost" onClick={handleComplete}>
                I&apos;ll do this later
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Skip for now - top right */}
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={handleSkip}
          className="rounded-lg p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          aria-label="Skip for now"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="sr-only">Skip for now</span>
      </div>
    </div>
  );
}
