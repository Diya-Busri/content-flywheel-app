"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Check,
  ArrowRight,
  ChevronRight,
  Home,
  X,
  BookOpen,
  Package,
  Sparkles,
  Film,
} from "lucide-react";

const CARD_CLASS =
  "border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-200 hover:scale-[1.01] overflow-hidden";

const GROWTH_GUIDE_BANNER_KEY = "content-studio-growth-guide-banner-dismissed";

export default function ContentStudioLanding() {
  const [bannerDismissed, setBannerDismissed] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(GROWTH_GUIDE_BANNER_KEY) === "1") setBannerDismissed(true);
      else setBannerDismissed(false);
    } catch {
      setBannerDismissed(false);
    }
  }, []);

  const dismissBanner = () => {
    try {
      localStorage.setItem(GROWTH_GUIDE_BANNER_KEY, "1");
      setBannerDismissed(true);
    } catch {}
  };

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        {/* Dismissable orange banner */}
        {!bannerDismissed && (
          <div className="mb-6 rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-3 flex items-center justify-between gap-4">
            <Link
              href="/dashboard/content-studio/video-ideas"
              className="flex items-center gap-2 text-amber-700 dark:text-amber-200 hover:text-orange-600 dark:hover:text-orange-400 transition-colors flex-1 min-w-0"
            >
              <BookOpen className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">
                New to YouTube? Check our Growth Guide →
              </span>
            </Link>
            <button
              type="button"
              onClick={dismissBanner}
              className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Breadcrumb: Dashboard > Content Studio */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-[#A0A0A0] mb-8">
          <Link href="/dashboard" className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors">
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
          <ChevronRight className="w-4 h-4 text-gray-400 dark:text-[#666]" />
          <span className="text-gray-900 dark:text-white">Content Studio</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Create Your Video
        </h1>
        <p className="text-gray-600 dark:text-[#A0A0A0] text-base md:text-lg mb-12">
          Choose how you&apos;d like to get started
        </p>

        <div className="grid md:grid-cols-2 gap-6 items-stretch">
          {/* CARD 1: I Know What I Want (icon: box / Package) */}
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 text-orange-500 mb-3">
                <Package className="w-7 h-7" />
                <CardTitle className="text-xl text-gray-900 dark:text-white">I Know What I Want</CardTitle>
              </div>
              <p className="text-sm text-gray-600 dark:text-[#A0A0A0]">Perfect if you:</p>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 space-y-6">
              <ul className="space-y-2 text-sm text-gray-700 dark:text-[#E0E0E0]">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                  Already have a video idea
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                  Know your target audience
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                  Understand your niche
                </li>
              </ul>
              <div>
                <p className="text-sm text-gray-600 dark:text-[#A0A0A0] mb-2">What you&apos;ll do:</p>
                <ul className="text-sm text-gray-700 dark:text-[#E0E0E0] space-y-1">
                  <li>→ Enter your video details</li>
                  <li>→ Customize AI-generated scripts</li>
                  <li>→ Get a Video Timeline in minutes</li>
                </ul>
              </div>
              <p className="text-xs text-gray-500 dark:text-[#A0A0A0]">Time: ~10 minutes</p>
              <Button
                asChild
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12 text-base gap-2 mt-auto"
              >
                <Link href="/dashboard/content-studio/create">
                  Start Creating
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* CARD 2: Help Me Discover (icon: sparkles) */}
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 text-orange-500 mb-3">
                <Sparkles className="w-7 h-7" />
                <CardTitle className="text-xl text-gray-900 dark:text-white">Help Me Discover</CardTitle>
              </div>
              <p className="text-sm text-gray-600 dark:text-[#A0A0A0]">Perfect if you:</p>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 space-y-6">
              <ul className="space-y-2 text-sm text-gray-700 dark:text-[#E0E0E0]">
                <li>• Don&apos;t have a video idea yet</li>
                <li>• Unsure what niche to target</li>
                <li>• New to content creation</li>
                <li>• Want guidance on content strategy</li>
              </ul>
              <div>
                <p className="text-sm text-gray-600 dark:text-[#A0A0A0] mb-2">What you&apos;ll do:</p>
                <ul className="text-sm text-gray-700 dark:text-[#E0E0E0] space-y-1">
                  <li>→ Discover profitable niches</li>
                  <li>→ Get AI video recommendations</li>
                  <li>→ Learn hooks, CTAs, and strategy</li>
                  <li>→ Create video with guidance</li>
                </ul>
              </div>
              <p className="text-xs text-gray-500 dark:text-[#A0A0A0]">Time: ~20 minutes</p>
              <Button
                asChild
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12 text-base gap-2 mt-auto"
              >
                <Link href="/dashboard/content-studio/create?flow=discover">
                  Start Discovery
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Faceless Content Planner highlight */}
        <div className="mt-8 rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-1">No face required</p>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Faceless Content Planner</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              7-day TikTok + Instagram plan — text scripts, product reveals, teasers &amp; captions. All faceless.
            </p>
          </div>
          <Button
            asChild
            className="shrink-0 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-black font-semibold gap-2"
          >
            <Link href="/dashboard/content-studio/faceless-planner">
              <Sparkles className="w-4 h-4" />
              Plan my content
            </Link>
          </Button>
        </div>

        {/* Bottom: Generate 3 Video Scripts (orange button) */}
        <div className="mt-4 flex flex-col items-center">
          <Button
            asChild
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12 px-6 gap-2"
          >
            <Link href="/dashboard/content-studio/video-ideas">
              <Film className="w-5 h-5" />
              Generate 3 Video Scripts
            </Link>
          </Button>
          <p className="mt-2 text-sm text-gray-500 dark:text-[#A0A0A0]">
            One idea → 3 platform-specific scripts (YouTube, TikTok, Reels)
          </p>
        </div>
      </div>
    </main>
  );
}
