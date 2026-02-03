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

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <ChatWidget />
      <LandingNavbar />

      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left column: headline, description, CTA, subtext */}
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
              Turn Products Into Sales-Driving Videos in Minutes
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-600 dark:text-slate-400">
              AI-powered video creation for digital products, TikTok Shop, and affiliate marketing. Upload your product, get conversion-focused videos for TikTok, Instagram, and YouTube.
            </p>
            <div className="mt-8 flex flex-col gap-4">
              <Link
                href="/sign-up"
                className="inline-flex w-fit items-center gap-2 rounded-xl bg-amber-500 px-6 py-3.5 text-sm font-semibold text-slate-900 hover:bg-amber-400"
              >
                Start Creating Free <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No editing skills required. First 3 videos free.
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-500" /> No credit card required
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-500" /> Cancel anytime
                </span>
              </div>
            </div>
          </div>

          {/* Right column: before/after comparison */}
          <div className="flex flex-col items-center gap-4">
            <div className="flex w-full max-w-md items-center gap-3">
              {/* BEFORE card */}
              <div className="flex flex-1 flex-col items-center gap-2">
                <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                  <Package className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                </div>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  BEFORE — Product photo
                </span>
              </div>

              {/* Arrow */}
              <div className="flex shrink-0 items-center justify-center text-amber-500" aria-hidden>
                <ArrowRight className="h-8 w-8 lg:h-10 lg:w-10" />
              </div>

              {/* AFTER card */}
              <div className="flex flex-1 flex-col items-center gap-2">
                <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-slate-700 bg-slate-900 dark:border-slate-600 dark:bg-black">
                  <Video className="h-12 w-12 text-slate-500 dark:text-slate-400" />
                </div>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  AFTER — AI Video
                </span>
              </div>
            </div>
            <p className="text-center text-xs font-medium text-slate-500 dark:text-slate-400">
              Works for: Digital products • TikTok Shop • Affiliate links • Script fixing
            </p>
          </div>
        </div>

        {/* Features */}
        <section id="features" className="mt-24 lg:mt-32">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Built for conversion, not views
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              Three sales-focused tools to turn any product into videos that drive revenue
            </p>
          </div>
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3">
            {/* Card 1: Digital Product Videos */}
            <div className="group rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-amber-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-amber-800/50">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 dark:bg-amber-500/20">
                <Package className="h-7 w-7" strokeWidth={2} />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-slate-900 dark:text-white">
                Digital Product Videos
              </h3>
              <p className="mt-3 text-slate-600 dark:text-slate-400">
                Scripts optimized for click-through and purchase, not just views. AI analyzes your product&apos;s value prop and creates videos that drive action.
              </p>
              <ul className="mt-5 space-y-2 border-t border-slate-100 pt-5 dark:border-slate-700">
                <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  Conversion-optimized hooks and CTAs
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  Platform-specific aspect ratios (9:16, 1:1)
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  Sales-focused captions that convert
                </li>
              </ul>
            </div>

            {/* Card 2: TikTok Shop & Affiliate */}
            <div className="group rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-amber-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-amber-800/50">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 dark:bg-amber-500/20">
                <ShoppingBag className="h-7 w-7" strokeWidth={2} />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-slate-900 dark:text-white">
                TikTok Shop & Affiliate Videos
              </h3>
              <p className="mt-3 text-slate-600 dark:text-slate-400">
                Turn any product link into compelling demos and reviews. Focused on answering buyer questions and overcoming objections.
              </p>
              <ul className="mt-5 space-y-2 border-t border-slate-100 pt-5 dark:border-slate-700">
                <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  Works with TikTok Shop, Amazon, any link
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  Buyer psychology-driven scripts
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  Objection-handling built in
                </li>
              </ul>
            </div>

            {/* Card 3: Auto Compliance Check */}
            <div className="group rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-amber-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-amber-800/50 sm:col-span-2 lg:col-span-1">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 dark:bg-amber-500/20">
                <ShieldCheck className="h-7 w-7" strokeWidth={2} />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-slate-900 dark:text-white">
                Auto Compliance Check
              </h3>
              <p className="mt-3 text-slate-600 dark:text-slate-400">
                Never lose revenue to account bans. AI ensures your videos meet platform guidelines before you post.
              </p>
              <ul className="mt-5 space-y-2 border-t border-slate-100 pt-5 dark:border-slate-700">
                <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  Pre-screens against platform rules
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  Auto-corrects flagged content
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  Protect your revenue stream
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mt-24 lg:mt-32">
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
        </section>

        {/* What Our Users Say */}
        <section id="reviews" className="mt-24 lg:mt-32">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              What Our Users Say
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-400">
              Real results from creators using Content Flywheel
            </p>
          </div>
          <div className="mt-14">
            <ReviewsCarousel />
          </div>
        </section>

        {/* Why Generic AI Tools Miss Sales */}
        <section id="why-us" className="mt-24 lg:mt-32">
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
        </section>

        {/* Platforms */}
        <section id="platforms" className="mt-24 lg:mt-32">
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
        </section>

        {/* Pricing preview */}
        <section id="pricing-preview" className="mt-24 lg:mt-32">
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
        </section>

        {/* FAQ */}
        <section id="faq" className="mt-24 lg:mt-32">
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
        </section>

        {/* Final CTA */}
        <section className="mt-24 lg:mt-32">
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
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-24 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
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
