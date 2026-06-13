"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import {
  ArrowRight, Check, Package, Mail, Tag, Link2, ShoppingBag,
  Bot, Sparkles, BarChart3, Zap, BookOpen, Megaphone, Workflow,
  X,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/* ─────────────── helpers ─────────────── */
function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────── engine items ─────────────── */
const ENGINE_ITEMS = [
  {
    icon: Sparkles,
    title: "Niche Discovery",
    what: "Automatic",
    desc: "Describe a broad topic. The AI analyses demand, competition, and buyer intent to surface a profitable niche for you to own.",
  },
  {
    icon: Bot,
    title: "AI Coach",
    what: "Always on",
    desc: "A strategy layer that sits above everything else. Ask it what to build next, how to price it, or how to grow — it knows your store.",
  },
  {
    icon: BookOpen,
    title: "Product Generation",
    what: "Minutes, not days",
    desc: "Type a title. The AI writes, formats, and packages a complete ebook, planner, workbook, or template — cover included.",
  },
  {
    icon: Megaphone,
    title: "Marketing Copy",
    what: "Auto-generated",
    desc: "Every product gets a sales page, social captions, and a launch email sequence written and ready to publish the moment you go live.",
  },
  {
    icon: Mail,
    title: "Email Campaigns",
    what: "Built in",
    desc: "No Mailchimp. No ConvertKit. Build your list, send broadcasts, and run automated drip sequences from inside the same dashboard.",
  },
  {
    icon: Workflow,
    title: "Automation Workflows",
    what: "Set and forget",
    desc: "Welcome sequences, abandoned-cart nudges, post-purchase upsells — configured once, running forever without you touching them.",
  },
  {
    icon: Zap,
    title: "Content Systems",
    what: "On demand",
    desc: "Script TikTok videos, write hooks, generate thumbnails, and publish across platforms — all tied to the product you just built.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    what: "Real-time",
    desc: "See which products sell, which emails convert, and where buyers drop off. One dashboard, every metric that matters.",
  },
];

/* ─────────────── feature cards ─────────────── */
const FEATURES = [
  { icon: Package,     emoji: "📦", title: "AI Product Creator",  desc: "Describe your idea — our AI writes, formats, and designs the full product in minutes.", badge: "Core feature" },
  { icon: ShoppingBag, emoji: "🏪", title: "Branded Store",       desc: "Your own store with Stripe checkout, download delivery, and buyer email built in." },
  { icon: Mail,        emoji: "📧", title: "Email Marketing",     desc: "Build your list, send broadcasts, and automate drip sequences. No third-party tools." },
  { icon: Tag,         emoji: "🎟️", title: "Discount Codes",     desc: "Promo codes with expiry dates and usage limits. Perfect for launches and collabs." },
  { icon: Link2,       emoji: "🔗", title: "Affiliates",          desc: "Give partners referral links, set commission rates, and track clicks and earnings." },
  { icon: BarChart3,   emoji: "📊", title: "Analytics",           desc: "Track product views, sales, email open rates, and revenue from one dashboard." },
];

/* ─────────────── traditional stack ─────────────── */
const OLD_STACK = [
  { tool: "ChatGPT", cost: "~£20/mo", purpose: "Write your product" },
  { tool: "Canva Pro", cost: "~£13/mo", purpose: "Design covers & pages" },
  { tool: "Stan Store / Gumroad", cost: "fees + £29/mo", purpose: "Host & sell" },
  { tool: "Mailchimp", cost: "~£20/mo", purpose: "Email marketing" },
  { tool: "Affiliate software", cost: "~£30/mo", purpose: "Track referrals" },
];

/* ─────────────── main export ─────────────── */
export function LandingAnimations({ reviews }: { reviews: { text: string; name: string; rating?: number }[] }) {
  return (
    <main>

      {/* ─── BETA TRUST BAR ─── */}
      <section className="border-y border-white/5 bg-white/[0.02] py-8">
        <div className="max-w-5xl mx-auto px-6">
          <FadeUp>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-10 text-center">
              {[
                { label: "Now in Beta", sub: "Early access open" },
                { label: "Free Trial", sub: "No card required" },
                { label: "One Subscription", sub: "Everything included" },
                { label: "Cancel Anytime", sub: "No lock-in" },
              ].map((s) => (
                <div key={s.label} className="flex flex-col items-center gap-0.5">
                  <p className="text-sm font-bold text-white">{s.label}</p>
                  <p className="text-xs text-white/30">{s.sub}</p>
                </div>
              ))}
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ─── THE ENGINE ─── */}
      <section id="features" className="py-28 lg:py-36">
        <div className="max-w-7xl mx-auto px-6">
          <FadeUp className="text-center mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-500 mb-4">The Platform</p>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
              The engine behind{" "}
              <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                Content Flywheel
              </span>
            </h2>
            <p className="mt-4 text-lg text-white/40 max-w-2xl mx-auto">
              This is not a store builder. It is an AI operating system. Describe your idea — the platform does the work.
            </p>
          </FadeUp>

          <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {ENGINE_ITEMS.map((item, i) => {
              const Icon = item.icon;
              return (
                <FadeUp key={item.title} delay={i * 0.06}>
                  <motion.div
                    whileHover={{ y: -6 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className="group relative h-full p-6 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-orange-500/30 rounded-2xl transition-colors cursor-default"
                  >
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 border border-orange-500/20">
                        <Icon className="h-5 w-5 text-orange-400" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500/70 border border-orange-500/20 rounded-full px-2 py-0.5">
                        {item.what}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-white/35 text-sm leading-relaxed">{item.desc}</p>
                  </motion.div>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="py-28 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-5xl mx-auto px-6">
          <FadeUp className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-500 mb-4">How it works</p>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">From idea to selling in 3 steps</h2>
            <p className="mt-4 text-white/40 text-lg">No design skills. No technical setup. No third-party tools.</p>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: "01", emoji: "✍️", title: "Describe your product", desc: "Tell the AI your topic or niche. It writes, designs, and packages your digital product automatically." },
              { step: "02", emoji: "🚀", title: "Publish to your store", desc: "Set your price, go live. Your Stripe checkout and download delivery are pre-connected — no setup required." },
              { step: "03", emoji: "📈", title: "Market & grow", desc: "Use the built-in email sequences, affiliate links, and promo codes. Track sales and revenue in your dashboard." },
            ].map((s, i) => (
              <FadeUp key={s.step} delay={i * 0.12}>
                <motion.div
                  whileHover={{ y: -4 }}
                  className="relative text-center bg-white/[0.03] border border-white/[0.07] hover:border-orange-500/30 rounded-2xl p-8 transition-colors"
                >
                  <div className="text-4xl mb-4">{s.emoji}</div>
                  <div className="inline-block px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold mb-4">
                    Step {s.step}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed">{s.desc}</p>
                  {i < 2 && (
                    <motion.div
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                      style={{ originX: 0 }}
                      className="hidden md:block absolute top-1/2 -right-3 w-6 h-px bg-gradient-to-r from-orange-500/50 to-transparent"
                    />
                  )}
                </motion.div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ─── COMPARISON ─── */}
      <section className="py-28 lg:py-36">
        <div className="max-w-5xl mx-auto px-6">
          <FadeUp className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-500 mb-4">Why Content Flywheel</p>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
              Stop paying for{" "}
              <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">five tools</span>
              {" "}to do one job
            </h2>
            <p className="mt-4 text-white/40 text-lg max-w-xl mx-auto">
              Most creators stitch together a stack that costs £100+/mo and still doesn't talk to itself.
            </p>
          </FadeUp>

          <div className="grid md:grid-cols-2 gap-6 items-start">
            {/* Traditional stack */}
            <FadeUp delay={0}>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 h-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <X className="w-4 h-4 text-white/30" />
                  </div>
                  <h3 className="font-bold text-white/40">The traditional stack</h3>
                </div>
                <ul className="space-y-4">
                  {OLD_STACK.map((t) => (
                    <li key={t.tool} className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white/40">{t.tool}</p>
                        <p className="text-xs text-white/20">{t.purpose}</p>
                      </div>
                      <span className="text-xs text-white/20 shrink-0 mt-0.5">{t.cost}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 pt-6 border-t border-white/10 flex justify-between items-center">
                  <span className="text-xs text-white/20 uppercase tracking-wide">Total</span>
                  <span className="text-sm font-bold text-white/30">£100+/mo + your time</span>
                </div>
              </div>
            </FadeUp>

            {/* Content Flywheel */}
            <FadeUp delay={0.1}>
              <motion.div
                whileHover={{ scale: 1.01 }}
                className="relative rounded-2xl border-2 border-orange-500 bg-white/[0.03] p-8 h-full shadow-2xl shadow-orange-500/10"
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-bold text-white">Content Flywheel</h3>
                </div>
                <ul className="space-y-3 text-sm">
                  {[
                    "AI writes & designs your product",
                    "Built-in store — zero platform fees",
                    "Email marketing & automation included",
                    "Affiliate programme with tracking",
                    "Orders dashboard & auto-delivery",
                    "Analytics, hooks & content tools",
                    "AI Coach guides your whole strategy",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2.5 text-white/70">
                      <Check className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />{t}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 pt-6 border-t border-orange-500/20 flex justify-between items-center">
                  <span className="text-xs text-white/30 uppercase tracking-wide">One subscription</span>
                  <span className="text-sm font-bold text-orange-400">Everything included</span>
                </div>
              </motion.div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ─── FOUNDER SECTION ─── */}
      <section className="py-28 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-3xl mx-auto px-6">
          <FadeUp>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10">
              <p className="text-xs font-semibold uppercase tracking-widest text-orange-500 mb-6">Why we built this</p>
              <blockquote className="text-lg sm:text-xl text-white/70 leading-relaxed">
                "I was spending more time managing tools than actually creating. ChatGPT for writing, Canva for design, Stan for selling, Mailchimp for email, a separate affiliate app for tracking — and none of them talked to each other.
                <br /><br />
                I built Content Flywheel because creators shouldn't need a six-tool stack and a VA to run a digital product business. One platform should do it all."
              </blockquote>
              <div className="mt-8 flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 font-bold text-sm">CF</div>
                <div>
                  <p className="text-sm font-bold text-white">Content Flywheel</p>
                  <p className="text-xs text-white/30">Founder · contentflywheel.co.uk</p>
                </div>
              </div>
            </div>
          </FadeUp>

          {/* Beta CTA */}
          <FadeUp delay={0.1} className="mt-8 text-center">
            <p className="text-white/40 text-sm mb-4">
              We are in early access. Join now and help shape what gets built next.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-orange-500 hover:bg-orange-400 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/30 transition-colors"
            >
              Join the beta <ArrowRight className="h-4 w-4" />
            </Link>
          </FadeUp>
        </div>
      </section>

      {/* ─── WHAT'S INCLUDED (features) ─── */}
      <section className="py-28 lg:py-36">
        <div className="max-w-7xl mx-auto px-6">
          <FadeUp className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-500 mb-4">What's included</p>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
              Everything you need to sell{" "}
              <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">digital products</span>
            </h2>
            <p className="mt-4 text-lg text-white/40 max-w-xl mx-auto">From idea to first sale in one afternoon. No tech skills needed.</p>
          </FadeUp>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <FadeUp key={f.title} delay={i * 0.07}>
                <motion.div
                  whileHover={{ y: -6, scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="relative group h-full p-7 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-orange-500/30 rounded-2xl transition-colors cursor-default"
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />
                  {f.badge && (
                    <span className="absolute -top-3 left-6 px-3 py-1 rounded-full bg-orange-500 text-white text-xs font-bold shadow-lg shadow-orange-500/30">
                      {f.badge}
                    </span>
                  )}
                  <div className="text-4xl mb-4">{f.emoji}</div>
                  <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed">{f.desc}</p>
                </motion.div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing-preview" className="py-28 lg:py-36 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-3xl mx-auto px-6">
          <FadeUp>
            <motion.div
              whileHover={{ scale: 1.01 }}
              className="relative overflow-hidden rounded-3xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-white/[0.03] to-transparent p-px shadow-2xl shadow-orange-500/20"
            >
              <div className="rounded-3xl bg-[#111] px-10 py-16 text-center">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 4 }}
                  className="text-5xl mb-6"
                >
                  🎉
                </motion.div>
                <h2 className="text-4xl font-extrabold text-white tracking-tight">One plan. Everything included.</h2>
                <p className="mt-4 text-white/40 text-lg max-w-md mx-auto">No per-sale fees. No hidden charges. No extra tools.</p>
                <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                    <Link href="/pricing" className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-400 px-8 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition-colors">
                      See pricing <ArrowRight className="h-4 w-4" />
                    </Link>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl border border-white/10 hover:bg-white/5 px-8 py-4 text-base font-bold text-white transition-colors">
                      Get Started
                    </Link>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </FadeUp>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="py-28">
        <div className="max-w-3xl mx-auto px-6">
          <FadeUp className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">FAQs</h2>
          </FadeUp>
          <FadeUp delay={0.1}>
            <Accordion type="single" collapsible className="w-full space-y-3">
              {[
                { value: "what", q: "What kind of digital products can I create?", a: "Ebooks, planners, workbooks, guides, templates, checklists — anything text and design based. You describe the topic and our AI generates the full product including a cover." },
                { value: "who", q: "Who is Content Flywheel for?", a: "Creators, coaches, consultants, and anyone who wants to sell digital products without stitching together five different tools. If you have knowledge worth packaging, this platform builds it for you." },
                { value: "sell", q: "How do I sell products and get paid?", a: "Your store connects to Stripe. Buyers pay by card, Stripe sends the money to your account, and we automatically email the buyer their download link." },
                { value: "fees", q: "Are there any per-sale fees?", a: "No. We charge a flat monthly subscription. You keep everything Stripe sends you (minus Stripe's standard processing fee)." },
                { value: "email", q: "Is email marketing included?", a: "Yes. Collect subscribers, send broadcasts, and build automated drip sequences. All built in — no Mailchimp or ConvertKit required." },
                { value: "cancel", q: "Can I cancel anytime?", a: "Yes. Cancel from your dashboard settings at any time. Your subscription stays active until the end of the billing period." },
              ].map((item) => (
                <AccordionItem key={item.value} value={item.value}
                  className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-6 data-[state=open]:border-orange-500/30 transition-colors"
                >
                  <AccordionTrigger className="text-left text-white hover:text-orange-400 hover:no-underline font-semibold py-5 text-sm">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-white/40 pb-5 leading-relaxed text-sm">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </FadeUp>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-28 lg:py-36 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <FadeUp>
            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ repeat: Infinity, duration: 5 }}
                className="absolute inset-0 bg-orange-600/20 blur-3xl rounded-3xl scale-110 pointer-events-none"
              />
              <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm px-8 py-20 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.15),transparent_60%)] pointer-events-none" />
                <div className="relative">
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 3 }}
                    className="text-6xl mb-6"
                  >
                    🚀
                  </motion.div>
                  <h2 className="text-4xl lg:text-6xl font-extrabold text-white tracking-tight">
                    Your first product
                    <br />
                    <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                      could be live today.
                    </span>
                  </h2>
                  <p className="mt-5 text-lg text-white/40 max-w-lg mx-auto">
                    Describe your idea. Content Flywheel writes it, designs it, lists it, and markets it.
                  </p>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} className="mt-8 inline-block">
                    <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-400 px-10 py-4 text-base font-bold text-white shadow-2xl shadow-orange-500/30 transition-colors">
                      Start for free <ArrowRight className="h-5 w-5" />
                    </Link>
                  </motion.div>
                  <p className="mt-5 text-sm text-white/20">No credit card required · Free trial included · Cancel anytime</p>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>
    </main>
  );
}
