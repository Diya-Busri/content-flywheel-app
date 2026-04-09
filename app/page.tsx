import type { Metadata } from "next";
import Link from "next/link";
import { Check, ArrowRight, Star, Zap, ShoppingBag, Mail, BarChart2, Youtube } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ReviewsCarousel } from "@/components/marketing/reviews-carousel";
import { LandingNavbar } from "@/components/marketing/landing-navbar";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Content Flywheel — Create & Sell Digital Products with AI",
  description:
    "Build ebooks, planners and templates with AI. Sell them from your own store. Market with email sequences, affiliates and discount codes. All in one platform.",
};

async function getPublicReviews(): Promise<{ text: string; name: string; rating?: number }[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("reviews")
    .select("review_text, rating, reviewer_name")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error || !data?.length) return [];
  return data
    .filter((r) => r.review_text?.trim())
    .map((r) => ({
      text: r.review_text!.trim(),
      name: r.reviewer_name?.trim() || "Verified User",
      rating: r.rating ?? 5,
    }));
}

export default async function HomePage() {
  const reviews = await getPublicReviews();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 overflow-x-hidden">
      <LandingNavbar />

      <main className="pt-16">

        {/* ── HERO ── */}
        <section className="relative min-h-[92vh] flex items-center bg-white dark:bg-slate-950 overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-orange-400/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-orange-300/5 rounded-full blur-3xl" />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 w-full py-24 lg:py-32">
            <div className="grid lg:grid-cols-2 gap-16 items-center">

              {/* Left */}
              <div className="space-y-7">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 text-orange-600 dark:text-orange-400 text-sm font-semibold">
                  <Zap className="w-3.5 h-3.5" />
                  AI-Powered Digital Product Platform
                </div>

                <h1 className="text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight text-slate-900 dark:text-white">
                  Create, sell & market
                  <br />
                  <span className="bg-gradient-to-r from-orange-500 to-orange-400 bg-clip-text text-transparent">
                    digital products
                  </span>
                  <br />
                  in minutes.
                </h1>

                <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg">
                  Build ebooks, planners & templates with AI. Sell from your own branded store. Grow with email marketing, affiliates, and discount codes — all from one place.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <Link
                    href="/sign-up"
                    className="px-7 py-3.5 bg-orange-500 hover:bg-orange-600 rounded-xl font-bold text-base inline-flex items-center justify-center gap-2 transition-all hover:scale-105 text-white shadow-lg shadow-orange-500/25"
                  >
                    Start for free <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="#how-it-works"
                    className="px-7 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold text-base inline-flex items-center justify-center transition-all text-slate-900 dark:text-white"
                  >
                    See how it works
                  </Link>
                </div>

                {/* Trust signals */}
                <div className="flex flex-wrap gap-5 pt-2 text-sm text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-500" /> No credit card required</span>
                  <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-500" /> Free trial included</span>
                  <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-500" /> Cancel anytime</span>
                </div>
              </div>

              {/* Right — mock dashboard cards */}
              <div className="relative hidden lg:block">
                {/* Main card */}
                <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 p-6 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">My Store</span>
                    <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full font-semibold">Live ✓</span>
                  </div>

                  {/* Product rows */}
                  {[
                    { title: "90-Day Content Planner", price: "£19", sales: 47, color: "bg-orange-100 dark:bg-orange-900/20" },
                    { title: "Instagram Caption Guide", price: "£12", sales: 83, color: "bg-blue-100 dark:bg-blue-900/20" },
                    { title: "Viral Hook Workbook", price: "£27", sales: 31, color: "bg-purple-100 dark:bg-purple-900/20" },
                  ].map((p) => (
                    <div key={p.title} className={`flex items-center justify-between rounded-xl px-4 py-3 ${p.color}`}>
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{p.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{p.sales} sales</p>
                      </div>
                      <span className="font-bold text-orange-600 dark:text-orange-400 text-sm">{p.price}</span>
                    </div>
                  ))}

                  {/* Mini stats */}
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    {[
                      { label: "Revenue", value: "£1,847" },
                      { label: "Orders", value: "161" },
                      { label: "Subscribers", value: "924" },
                    ].map((s) => (
                      <div key={s.label} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                        <p className="font-bold text-slate-900 dark:text-white text-base">{s.value}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating badge */}
                <div className="absolute -top-4 -right-4 bg-orange-500 text-white rounded-2xl px-4 py-2.5 shadow-lg shadow-orange-500/30 text-sm font-bold rotate-3">
                  🚀 AI-generated in 2 mins
                </div>
                <div className="absolute -bottom-4 -left-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 shadow-lg text-sm font-semibold text-slate-900 dark:text-white -rotate-2">
                  💳 Stripe payments built-in
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── STATS BAR ── */}
        <section className="border-y border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-10">
          <div className="max-w-5xl mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { value: "2,500+", label: "Creators" },
                { value: "50,000+", label: "Products Built" },
                { value: "£500k+", label: "Creator Revenue" },
                { value: "4.9 ★", label: "Average Rating" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{s.value}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" className="py-24 lg:py-32">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Everything you need to sell digital products
              </h2>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                From idea to first sale in one afternoon. No tech skills needed.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: "📦",
                  title: "AI Product Creator",
                  desc: "Describe your idea, and Content Flywheel builds a full ebook, planner, or workbook — complete with cover design and sales copy.",
                  badge: "Most popular",
                },
                {
                  icon: "🏪",
                  title: "Branded Store",
                  desc: "Get your own store at contentflywheel.co.uk/c/you — with Stripe checkout, download delivery, and a buyer email system built in.",
                },
                {
                  icon: "📧",
                  title: "Email Marketing",
                  desc: "Build your list, send broadcasts, and automate drip sequences. All from your dashboard, no third-party tools needed.",
                },
                {
                  icon: "🎟️",
                  title: "Discount Codes",
                  desc: "Create promo codes with expiry dates and usage limits. Perfect for launches, collaborations, and seasonal sales.",
                },
                {
                  icon: "🔗",
                  title: "Affiliate Programme",
                  desc: "Give partners their own referral links and set custom commission rates. Track clicks and earnings automatically.",
                },
                {
                  icon: "⭐",
                  title: "Reviews & Social Proof",
                  desc: "Collect reviews after each sale. Approve the best ones and they go live on your product pages instantly.",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="relative group p-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/5 transition-all"
                >
                  {f.badge && (
                    <span className="absolute -top-3 left-6 px-3 py-1 rounded-full bg-orange-500 text-white text-xs font-bold shadow">
                      {f.badge}
                    </span>
                  )}
                  <div className="text-4xl mb-4">{f.icon}</div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{f.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" className="py-24 lg:py-32 bg-slate-50 dark:bg-slate-900">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                From idea to selling in 3 steps
              </h2>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
                No design skills, no technical setup, no third-party tools.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "01",
                  title: "Describe your product",
                  desc: "Tell our AI what topic or niche you want to target. It writes, designs, and packages your digital product automatically.",
                  icon: "✍️",
                },
                {
                  step: "02",
                  title: "Publish to your store",
                  desc: "Set your price, add a cover image, and go live. Your Stripe checkout and download delivery are already connected.",
                  icon: "🚀",
                },
                {
                  step: "03",
                  title: "Market & grow",
                  desc: "Use email sequences, affiliate links, and discount codes to drive sales. Track everything in your dashboard.",
                  icon: "📈",
                },
              ].map((s, i) => (
                <div key={s.step} className="relative">
                  {i < 2 && (
                    <div className="hidden md:block absolute top-12 left-full w-full h-px border-t-2 border-dashed border-orange-200 dark:border-orange-500/20 z-0" style={{ width: "calc(100% - 48px)", left: "calc(50% + 24px)" }} />
                  )}
                  <div className="relative bg-white dark:bg-slate-800 rounded-2xl p-7 border border-slate-200 dark:border-slate-700 text-center shadow-sm">
                    <div className="text-4xl mb-4">{s.icon}</div>
                    <div className="inline-block px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-bold mb-3">
                      Step {s.step}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{s.title}</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── COMPARISON ── */}
        <section className="py-24 lg:py-32">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Why creators choose Content Flywheel
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Without */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 font-bold text-sm">✕</div>
                  <h3 className="font-bold text-slate-700 dark:text-slate-300">Without Content Flywheel</h3>
                </div>
                <ul className="space-y-3 text-slate-600 dark:text-slate-400 text-sm">
                  {[
                    "Hours writing and formatting ebooks manually",
                    "Paying for Gumroad, Stan Store, or Kajabi",
                    "Separate email tool (Mailchimp, ConvertKit)",
                    "No built-in affiliate tracking",
                    "Manual order management",
                    "No analytics on your product pages",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2.5">
                      <span className="mt-0.5 text-slate-400">—</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              {/* With */}
              <div className="rounded-2xl border-2 border-orange-500 bg-white dark:bg-slate-900 p-8 shadow-lg shadow-orange-500/10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-sm">✓</div>
                  <h3 className="font-bold text-slate-900 dark:text-white">With Content Flywheel</h3>
                </div>
                <ul className="space-y-3 text-slate-700 dark:text-slate-300 text-sm">
                  {[
                    "AI builds your product in minutes",
                    "Built-in store with Stripe — zero platform fees",
                    "Email marketing & sequences included",
                    "Affiliate programme with referral tracking",
                    "Orders dashboard with download delivery",
                    "Product view analytics per page",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── REVIEWS ── */}
        <section id="reviews" className="py-24 bg-slate-50 dark:bg-slate-900">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <div className="flex items-center justify-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-orange-400 text-orange-400" />
                ))}
              </div>
              <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Loved by creators
              </h2>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
                Real results from real people building real income.
              </p>
            </div>
            <ReviewsCarousel reviews={reviews} />
          </div>
        </section>

        {/* ── PLATFORMS ── */}
        <section className="py-20 border-y border-slate-100 dark:border-slate-800">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-8">
              Market your products across
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6">
              {["TikTok", "Instagram", "YouTube", "Twitter / X", "Facebook"].map((p) => (
                <span
                  key={p}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-300 shadow-sm"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING PREVIEW ── */}
        <section id="pricing-preview" className="py-24 lg:py-32">
          <div className="max-w-4xl mx-auto px-6">
            <div className="rounded-3xl bg-gradient-to-br from-orange-500 to-orange-600 p-px shadow-2xl shadow-orange-500/30">
              <div className="rounded-3xl bg-white dark:bg-slate-900 px-10 py-14 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-sm font-semibold mb-6">
                  🎉 Simple pricing
                </div>
                <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  One plan. Everything included.
                </h2>
                <p className="mt-4 text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
                  No per-sale fees. No extra tools. No hidden charges. Everything you need to create, sell, and market digital products.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                  <Link
                    href="/pricing"
                    className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 px-8 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/25 transition-all hover:scale-105"
                  >
                    See pricing <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/sign-up"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-8 py-4 text-base font-bold text-slate-900 dark:text-white transition-all"
                  >
                    Start free trial
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="py-24 bg-slate-50 dark:bg-slate-900">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Frequently asked questions
              </h2>
            </div>
            <Accordion type="single" collapsible className="w-full space-y-3">
              {[
                {
                  value: "what",
                  q: "What kind of digital products can I create?",
                  a: "Ebooks, planners, workbooks, guides, templates, checklists — anything text and design based. You describe the topic and our AI generates the full product including a cover.",
                },
                {
                  value: "sell",
                  q: "How do I sell products and get paid?",
                  a: "Your store is connected to Stripe. Buyers pay by card, Stripe sends the money to your account, and we automatically email the buyer their download link. No extra steps.",
                },
                {
                  value: "fees",
                  q: "Are there any per-sale fees?",
                  a: "No. We charge a flat monthly subscription. You keep everything Stripe sends you (minus Stripe's standard card processing fee of ~1.4% + 20p).",
                },
                {
                  value: "email",
                  q: "Is email marketing included?",
                  a: "Yes. You can collect subscribers, send broadcasts, and build automated drip sequences. All built in — no Mailchimp or ConvertKit required.",
                },
                {
                  value: "trial",
                  q: "What's included in the free trial?",
                  a: "Full access to the platform. No credit card required. Test everything before deciding to subscribe.",
                },
                {
                  value: "cancel",
                  q: "Can I cancel anytime?",
                  a: "Yes. Cancel from your dashboard settings at any time. Your subscription stays active until the end of the billing period, then stops — no further charges.",
                },
                {
                  value: "refunds",
                  q: "Do you offer refunds?",
                  a: "We operate a no-refunds policy because AI processing costs are incurred immediately. Use the free trial to make sure Content Flywheel is right for you before subscribing.",
                },
              ].map((item) => (
                <AccordionItem
                  key={item.value}
                  value={item.value}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-6 [&[data-state=open]]:border-orange-300 dark:[&[data-state=open]]:border-orange-500/50"
                >
                  <AccordionTrigger className="text-left text-slate-900 hover:text-orange-600 hover:no-underline dark:text-white dark:hover:text-orange-400 font-semibold py-5">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-600 dark:text-slate-400 pb-5 leading-relaxed">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="py-24 lg:py-32">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 px-8 py-20 shadow-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/20 via-transparent to-transparent pointer-events-none" aria-hidden />
              <div className="relative">
                <div className="text-5xl mb-6">🚀</div>
                <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
                  Your first product could be
                  <br />
                  <span className="text-orange-400">live today.</span>
                </h2>
                <p className="mt-5 text-lg text-slate-400 max-w-lg mx-auto">
                  Join thousands of creators building real income with digital products. Start free — no credit card needed.
                </p>
                <Link
                  href="/sign-up"
                  className="mt-8 inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-400 px-10 py-4 text-base font-bold text-white shadow-xl shadow-orange-500/30 transition-all hover:scale-105"
                >
                  Start creating for free <ArrowRight className="h-5 w-5" />
                </Link>
                <p className="mt-5 text-sm text-slate-500">Free trial • No credit card • Cancel anytime</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="col-span-1 sm:col-span-2 lg:col-span-1">
              <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                Content<span className="text-orange-500">Flywheel</span>
              </span>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                The all-in-one platform for creators who want to build and sell digital products without the faff.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">Product</h4>
              <ul className="space-y-2.5 text-sm">
                {[["Features", "/#features"], ["How it Works", "/#how-it-works"], ["Pricing", "/pricing"]].map(([label, href]) => (
                  <li key={label}><Link href={href} className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">Legal</h4>
              <ul className="space-y-2.5 text-sm">
                {[["Terms", "/terms"], ["Privacy", "/privacy"], ["Refund Policy", "/refund-policy"]].map(([label, href]) => (
                  <li key={label}><Link href={href} className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">Contact</h4>
              <a href="mailto:hello@contentflywheel.co.uk" className="text-sm text-orange-500 hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
                hello@contentflywheel.co.uk
              </a>
            </div>
          </div>
          <div className="mt-12 border-t border-slate-100 dark:border-slate-800 pt-8 text-center text-sm text-slate-400 dark:text-slate-500">
            © 2026 Content Flywheel. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
