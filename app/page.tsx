import type { Metadata } from "next";
import Link from "next/link";
import { Check, ArrowRight, Package, Video, ShoppingBag, ShieldCheck, Upload, Sparkles, Download, Youtube } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ReviewsCarousel } from "@/components/marketing/reviews-carousel";
import { LandingNavbar } from "@/components/marketing/landing-navbar";
import { ChatWidget } from "@/components/chat-widget";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Content Flywheel - AI Video Generation for Social Media",
  description:
    "Turn products into sales-driving videos for TikTok, Instagram, and YouTube. AI-powered video creation focused on conversion, not vanity metrics.",
};

async function getApprovedPublicReviews(): Promise<{ text: string; name: string; rating?: number }[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("reviews")
    .select("review_text, rating")
    .eq("is_public", true)
    .eq("is_approved", true)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error || !data?.length) return [];
  return data
    .filter((r) => r.review_text?.trim())
    .map((r) => ({
      text: r.review_text!.trim(),
      name: "Verified User",
      rating: r.rating ?? 5,
    }));
}

export default async function HomePage() {
  const reviews = await getApprovedPublicReviews();
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 overflow-x-hidden">
      <LandingNavbar />

      <div className="fixed bottom-4 right-4 z-50">
        <ChatWidget />
      </div>

      <main className="pt-16">
        {/* Hero - breathing room */}
        <section className="relative min-h-[85vh] sm:min-h-screen flex items-center bg-slate-50 dark:bg-slate-950">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-12 sm:py-16 w-full">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
              {/* Left - Text content */}
              <div className="space-y-5 pt-24 sm:pt-32">
                <h1 className="text-5xl lg:text-6xl font-bold leading-tight text-slate-900 dark:text-white">
                  Build, Package & Market
                  <br />
                  <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                    Digital Products
                  </span>
                  <br />
                  in Minutes
                </h1>
                <p className="text-sm sm:text-base lg:text-lg text-slate-600 dark:text-gray-400 leading-relaxed max-w-xl">
                  Generate ebooks, planners, workbooks, AI voiceovers, video scripts, and multi-platform marketing content — all from one platform.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Link
                    href="/sign-up"
                    className="px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-lg font-semibold text-base inline-flex items-center justify-center gap-2 transition-all hover:scale-105 text-white"
                  >
                    Start Creating Free <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="#how-it-works"
                    className="px-6 py-3 bg-slate-200 dark:bg-gray-800 hover:bg-slate-300 dark:hover:bg-gray-700 rounded-lg font-semibold text-base inline-flex items-center justify-center transition-all text-slate-900 dark:text-white"
                  >
                    See How It Works
                  </Link>
                </div>
                <div className="pt-6 space-y-3">
                  <p className="text-sm text-slate-600 dark:text-gray-400">
                    Everything you need in one platform
                  </p>
                  <div className="flex flex-wrap gap-6 text-sm text-slate-600 dark:text-gray-400">
                    <span className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-500 shrink-0" />
                      No credit card required
                    </span>
                    <span className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-500 shrink-0" />
                      Cancel anytime
                    </span>
                  </div>
                </div>
              </div>
              {/* Right - Visual demo */}
              <div className="relative">
                <div className="flex items-center justify-center gap-4 sm:gap-6">
                  <div className="relative group">
                    <div className="w-32 h-32 sm:w-36 sm:h-36 lg:w-40 lg:h-40 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-xl flex flex-col items-center justify-center border border-slate-300 dark:border-gray-700 transition-all group-hover:scale-105">
                      <Package className="w-10 h-10 sm:w-12 sm:h-12 text-slate-500 dark:text-gray-500 mb-1" />
                      <p className="text-xs text-slate-600 dark:text-gray-400 font-medium">BEFORE</p>
                      <p className="text-[10px] text-slate-500 dark:text-gray-500">Product photo</p>
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl text-orange-500 animate-pulse" aria-hidden>
                    →
                  </div>
                  <div className="relative group">
                    <div className="w-32 h-32 sm:w-36 sm:h-36 lg:w-40 lg:h-40 bg-gradient-to-br from-orange-900/20 to-orange-600/20 rounded-xl shadow-xl flex flex-col items-center justify-center border border-orange-500/30 transition-all group-hover:scale-105">
                      <Video className="w-10 h-10 sm:w-12 sm:h-12 text-orange-400 mb-1" />
                      <p className="text-xs text-orange-400 font-medium">AFTER</p>
                      <p className="text-[10px] text-gray-400">AI Video</p>
                    </div>
                  </div>
                </div>
                <div className="mt-8 text-center">
                  <p className="text-sm text-slate-600 dark:text-gray-400">
                    Works for: <span className="text-slate-900 dark:text-white">Digital products</span> • <span className="text-slate-900 dark:text-white">TikTok Shop</span> • <span className="text-slate-900 dark:text-white">Affiliate links</span> • <span className="text-slate-900 dark:text-white">Script fixing</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Built for conversion - dedicated section with spacing */}
        <section className="py-16 lg:py-24 bg-slate-100 dark:bg-gray-900/50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Built for conversion, not views
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-slate-600 dark:text-gray-400 leading-relaxed">
              Three sales-focused tools to turn any product into videos that drive revenue
            </p>
          </div>
        </section>

        {/* Features - cards with spacing */}
        <section id="features" className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="p-8 bg-white dark:bg-gray-800/50 rounded-2xl border border-slate-200 dark:border-gray-700 hover:border-orange-500/50 transition-all hover:scale-105 shadow-sm dark:shadow-none">
                <div className="text-5xl mb-6">📱</div>
                <h3 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Digital Product Creator</h3>
                <p className="text-slate-600 dark:text-gray-400 leading-relaxed">
                  Transform your expertise into professional digital products. Workbooks, guides, templates - all AI-generated and ready to sell.
                </p>
              </div>
              <div className="p-8 bg-white dark:bg-gray-800/50 rounded-2xl border border-slate-200 dark:border-gray-700 hover:border-orange-500/50 transition-all hover:scale-105 shadow-sm dark:shadow-none">
                <div className="text-5xl mb-6">🛍️</div>
                <h3 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">TikTok Shop Videos</h3>
                <p className="text-slate-600 dark:text-gray-400 leading-relaxed">
                  Upload any product photo and get scroll-stopping TikTok Shop videos that convert browsers into buyers.
                </p>
              </div>
              <div className="p-8 bg-white dark:bg-gray-800/50 rounded-2xl border border-slate-200 dark:border-gray-700 hover:border-orange-500/50 transition-all hover:scale-105 shadow-sm dark:shadow-none">
                <div className="text-5xl mb-6">✅</div>
                <h3 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Script Compliance</h3>
                <p className="text-slate-600 dark:text-gray-400 leading-relaxed">
                  Ensure your marketing videos meet platform guidelines. Auto-check for banned phrases and compliance issues.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                From product to posted in 3 steps
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
                No video editing skills required. Our AI handles the heavy lifting
              </p>
            </div>
            <div className="mx-auto mt-14 max-w-2xl space-y-10">
            {/* Step 1 */}
            <div className="flex gap-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-500 dark:bg-amber-500/20">
                <Upload className="h-6 w-6" strokeWidth={2} />
              </div>
              <div>
                <span className="text-sm font-semibold text-amber-500">Step 1</span>
                <h3 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
                  Upload product image or paste link
                </h3>
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                  Drop your product photo or paste a TikTok Shop, Amazon, or affiliate link
                </p>
              </div>
            </div>
            {/* Step 2 */}
            <div className="flex gap-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-500 dark:bg-amber-500/20">
                <Sparkles className="h-6 w-6" strokeWidth={2} />
              </div>
              <div>
                <span className="text-sm font-semibold text-amber-500">Step 2</span>
                <h3 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
                  AI generates conversion-focused scripts and videos
                </h3>
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                  Our AI optimizes for sales, not engagement theater. Every script is built to drive clicks and purchases.
                </p>
              </div>
            </div>
            {/* Step 3 */}
            <div className="flex gap-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-500 dark:bg-amber-500/20">
                <Download className="h-6 w-6" strokeWidth={2} />
              </div>
              <div>
                <span className="text-sm font-semibold text-amber-500">Step 3</span>
                <h3 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
                  Download with ready-to-paste captions
                </h3>
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                  Get video files and platform-ready captions for TikTok, Reels, and Shorts
                </p>
              </div>
            </div>
            </div>
          </div>
        </section>

        {/* What Our Users Say */}
        <section id="reviews" className="py-24 bg-slate-100 dark:bg-gray-900/30">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              What Our Users Say
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-400">
              Real results from creators using Content Flywheel
            </p>
            </div>
            <div className="mt-14">
              <ReviewsCarousel reviews={reviews} />
            </div>
          </div>
        </section>

        {/* Why Generic AI Tools Miss Sales */}
        <section id="why-us" className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Most tools optimize for the wrong metrics. We optimize for revenue.
            </h2>
          </div>
          <div className="mt-14 grid gap-8 lg:grid-cols-2 lg:gap-10">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Generic AI Tools
              </h3>
              <ul className="mt-5 space-y-3 text-slate-600 dark:text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                  Optimize for views and likes
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                  Engagement theater, not revenue
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                  One-size-fits-all scripts
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-amber-500 bg-white p-8 shadow-sm dark:bg-slate-900">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Content Flywheel
              </h3>
              <ul className="mt-5 space-y-3 text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  Revenue-focused video scripts
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  Conversion psychology built-in
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  Product-specific optimization
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  A/B tested hooks and CTAs
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  Buyer objection handling
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  Platform-specific strategies that sell
                </li>
              </ul>
            </div>
          </div>
          </div>
        </section>

        {/* Platforms */}
        <section id="platforms" className="py-24 bg-slate-100 dark:bg-gray-900/30">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Works with all major platforms
            </h2>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-12">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-8 py-4 dark:border-slate-800 dark:bg-slate-900">
              <span className="text-xl font-bold text-slate-900 dark:text-white">TikTok</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-8 py-4 dark:border-slate-800 dark:bg-slate-900">
              <span className="text-xl font-bold text-slate-900 dark:text-white">Instagram</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-8 py-4 dark:border-slate-800 dark:bg-slate-900">
              <Youtube className="h-8 w-8 text-red-600 dark:text-red-500" />
              <span className="text-xl font-bold text-slate-900 dark:text-white">YouTube</span>
            </div>
            </div>
          </div>
        </section>

        {/* Pricing preview */}
        <section id="pricing-preview" className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-400">
              Start free, upgrade when it&apos;s working for you.
            </p>
            <Link
              href="/pricing"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3.5 text-sm font-semibold text-slate-900 hover:bg-amber-400"
            >
              View pricing <ArrowRight className="h-4 w-4" />
            </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-24 bg-slate-100 dark:bg-gray-900/30">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Frequently Asked Questions
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-400">
              Quick answers to common questions
            </p>
            </div>
            <div className="mx-auto mt-14 max-w-3xl">
              <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="formats" className="border-slate-200 dark:border-slate-700 [&[data-state=open]]:border-l-4 [&[data-state=open]]:border-l-amber-500 [&[data-state=open]]:pl-4">
                <AccordionTrigger className="text-left text-slate-900 hover:text-amber-600 hover:no-underline dark:text-white dark:hover:text-amber-400">
                  What video formats and platforms do you support?
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 dark:text-slate-400">
                  We generate videos optimized for TikTok (9:16), Instagram Reels (9:16), and YouTube Shorts (9:16). Videos include platform-specific captions, hashtags, and descriptions ready to copy/paste.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="time" className="border-slate-200 dark:border-slate-700 [&[data-state=open]]:border-l-4 [&[data-state=open]]:border-l-amber-500 [&[data-state=open]]:pl-4">
                <AccordionTrigger className="text-left text-slate-900 hover:text-amber-600 hover:no-underline dark:text-white dark:hover:text-amber-400">
                  How long does it take to generate a video?
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 dark:text-slate-400">
                  Most videos are generated in 2-5 minutes. You&apos;ll receive the video file plus ready-to-use captions for each platform.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="own" className="border-slate-200 dark:border-slate-700 [&[data-state=open]]:border-l-4 [&[data-state=open]]:border-l-amber-500 [&[data-state=open]]:pl-4">
                <AccordionTrigger className="text-left text-slate-900 hover:text-amber-600 hover:no-underline dark:text-white dark:hover:text-amber-400">
                  Do I own the videos I create?
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 dark:text-slate-400">
                  Yes! All videos you generate are 100% yours. Use them however you want—post, download, edit, or repurpose.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="edit" className="border-slate-200 dark:border-slate-700 [&[data-state=open]]:border-l-4 [&[data-state=open]]:border-l-amber-500 [&[data-state=open]]:pl-4">
                <AccordionTrigger className="text-left text-slate-900 hover:text-amber-600 hover:no-underline dark:text-white dark:hover:text-amber-400">
                  Can I edit the AI-generated scripts before creating videos?
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 dark:text-slate-400">
                  Absolutely. You can review and customize scripts before generating videos. Our AI gives you a strong starting point, but you have full control.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="trial" className="border-slate-200 dark:border-slate-700 [&[data-state=open]]:border-l-4 [&[data-state=open]]:border-l-amber-500 [&[data-state=open]]:pl-4">
                <AccordionTrigger className="text-left text-slate-900 hover:text-amber-600 hover:no-underline dark:text-white dark:hover:text-amber-400">
                  What&apos;s included in the free trial?
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 dark:text-slate-400">
                  3 free video generations. No credit card required. Test the full platform before deciding to upgrade.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="refunds" className="border-slate-200 dark:border-slate-700 [&[data-state=open]]:border-l-4 [&[data-state=open]]:border-l-amber-500 [&[data-state=open]]:pl-4">
                <AccordionTrigger className="text-left text-slate-900 hover:text-amber-600 hover:no-underline dark:text-white dark:hover:text-amber-400">
                  Do you offer refunds?
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 dark:text-slate-400">
                  No. We operate a strict no-refunds policy because AI processing costs are incurred immediately. Test with our free trial (3 videos) before purchasing. See our <Link href="/refund-policy" className="text-amber-500 underline hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300">Refund Policy</Link> for details.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="cancel" className="border-slate-200 dark:border-slate-700 [&[data-state=open]]:border-l-4 [&[data-state=open]]:border-l-amber-500 [&[data-state=open]]:pl-4">
                <AccordionTrigger className="text-left text-slate-900 hover:text-amber-600 hover:no-underline dark:text-white dark:hover:text-amber-400">
                  Can I cancel my subscription anytime?
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 dark:text-slate-400">
                  Yes. Cancel anytime from your dashboard. Your subscription remains active until the end of your billing period, then no further charges occur.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 lg:py-32">
          <div className="max-w-7xl mx-auto px-6">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/20 via-slate-100 to-amber-600/10 dark:from-amber-500/15 dark:via-slate-900 dark:to-amber-600/10">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-400/10 via-transparent to-transparent dark:from-amber-500/10" aria-hidden />
            <div className="relative px-8 py-16 text-center sm:px-12 lg:py-20">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl">
                Ready to turn products into sales?
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-lg text-slate-600 dark:text-slate-400">
                Start free. No credit card required.
              </p>
              <Link
                href="/sign-up"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-8 py-4 text-base font-semibold text-slate-900 shadow-lg transition-all hover:bg-amber-400 hover:shadow-xl"
              >
                Start Creating Free <ArrowRight className="h-5 w-5" />
              </Link>
              <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
                First 3 videos free • Cancel anytime
              </p>
            </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-white">
                Product
              </h4>
              <ul className="mt-4 space-y-2">
                <li>
                  <Link href="/#features" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="/#how-it-works" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                    How it Works
                  </Link>
                </li>
                <li>
                  <Link href="/#pricing-preview" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                    Pricing
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-white">
                Legal
              </h4>
              <ul className="mt-4 space-y-2">
                <li>
                  <Link href="/terms" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/refund-policy" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                    Refund Policy
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-white">
                Connect
              </h4>
              <ul className="mt-4 flex gap-4">
                <li>
                  <a
                    href="https://x.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-slate-600 dark:text-slate-400 dark:hover:text-white"
                    aria-label="X (Twitter)"
                  >
                    <span className="text-sm font-bold">X</span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-slate-600 dark:text-slate-400 dark:hover:text-white"
                    aria-label="Instagram"
                  >
                    <span className="text-sm font-bold">IG</span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://youtube.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-slate-600 dark:text-slate-400 dark:hover:text-white"
                    aria-label="YouTube"
                  >
                    <Youtube className="h-5 w-5" />
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-700">
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              © 2026 Content Flywheel. All rights reserved.
            </p>
            <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
              Contact:{" "}
              <a
                href="mailto:contentflywheel@gmail.com"
                className="text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300"
              >
                contentflywheel@gmail.com
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
