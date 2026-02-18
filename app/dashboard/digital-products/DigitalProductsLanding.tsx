"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Sparkles, Check, ArrowRight, ChevronRight, Home, X, BookOpen } from "lucide-react";

const CARD_CLASS =
  "border-[#2A2A2A] bg-[#1A1A1A] hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-200 hover:scale-[1.01] overflow-hidden";

const SELLING_GUIDE_BANNER_KEY = "digital-products-selling-guide-banner-dismissed";

export default function DigitalProductsLanding() {
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SELLING_GUIDE_BANNER_KEY) === "1") setBannerDismissed(true);
    } catch {}
  }, []);

  const dismissBanner = () => {
    try {
      localStorage.setItem(SELLING_GUIDE_BANNER_KEY, "1");
      setBannerDismissed(true);
    } catch {}
  };

  return (
    <main className="min-h-screen bg-[#0F0F0F] text-white p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        {/* Dismissable banner for new users */}
        {!bannerDismissed && (
          <div className="mb-6 rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-3 flex items-center justify-between gap-4">
            <Link
              href="/dashboard/digital-products/selling-guide"
              className="flex items-center gap-2 text-amber-200 hover:text-orange-400 transition-colors flex-1 min-w-0"
            >
              <BookOpen className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">
                New to selling? Check our Selling Platforms Guide →
              </span>
            </Link>
            <button
              type="button"
              onClick={dismissBanner}
              className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Breadcrumb nav so main app navigation is visible */}
        <nav className="flex items-center gap-2 text-sm text-[#A0A0A0] mb-8">
          <Link href="/dashboard" className="flex items-center gap-1 hover:text-white transition-colors">
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
          <ChevronRight className="w-4 h-4 text-[#666]" />
          <span className="text-white">Digital Products</span>
        </nav>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
          Create Your Digital Product
        </h1>
        <p className="text-[#A0A0A0] text-base md:text-lg mb-12">
          Choose how you&apos;d like to get started
        </p>

        <div className="grid md:grid-cols-2 gap-6 items-stretch">
          {/* LEFT CARD */}
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 text-orange-500 mb-3">
                <Package className="w-7 h-7" />
                <CardTitle className="text-xl text-white">I Know What I Want</CardTitle>
              </div>
              <p className="text-sm text-[#A0A0A0]">Perfect if you:</p>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 space-y-6">
              <ul className="space-y-2 text-sm text-[#E0E0E0]">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                  Already have a product idea
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
                <p className="text-sm text-[#A0A0A0] mb-2">What you&apos;ll do:</p>
                <ul className="text-sm text-[#E0E0E0] space-y-1">
                  <li>→ Enter your product details</li>
                  <li>→ Customize AI-generated scripts</li>
                  <li>→ Get a Video Creation Guide in minutes</li>
                </ul>
              </div>
              <p className="text-xs text-[#A0A0A0]">Time: ~10 minutes</p>
              <Button
                asChild
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12 text-base gap-2 mt-auto"
              >
                <Link href="/dashboard/digital-products/create">
                  Start Creating
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* RIGHT CARD */}
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 text-orange-500 mb-3">
                <Sparkles className="w-7 h-7" />
                <CardTitle className="text-xl text-white">Help Me Discover</CardTitle>
              </div>
              <p className="text-sm text-[#A0A0A0]">Perfect if you:</p>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 space-y-6">
              <ul className="space-y-2 text-sm text-[#E0E0E0]">
                <li>• Don&apos;t have a product idea yet</li>
                <li>• Unsure what niche to target</li>
                <li>• New to digital products</li>
                <li>• Want guidance on content strategy</li>
              </ul>
              <div>
                <p className="text-sm text-[#A0A0A0] mb-2">What you&apos;ll do:</p>
                <ul className="text-sm text-[#E0E0E0] space-y-1">
                  <li>→ Discover profitable niches</li>
                  <li>→ Get AI product recommendations</li>
                  <li>→ Learn hooks, CTAs, and strategy</li>
                  <li>→ Create product with guidance</li>
                </ul>
              </div>
              <p className="text-xs text-[#A0A0A0]">Time: ~20 minutes</p>
              <Button
                asChild
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12 text-base gap-2 mt-auto"
              >
                <Link href="/dashboard/digital-products/discover">
                  Start Discovery
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <p className="mt-8 text-center text-sm text-gray-500">
          Don&apos;t have a store yet?{" "}
          <Link
            href="/dashboard/digital-products/selling-guide"
            className="text-orange-500 hover:text-orange-400 font-medium"
          >
            Check our Selling Platforms Guide
          </Link>{" "}
          to find the best place to sell.
        </p>
      </div>
    </main>
  );
}
