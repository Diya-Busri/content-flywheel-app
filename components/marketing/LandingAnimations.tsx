"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import {
  ArrowRight, Check, Package, Video, Calendar, Rocket, X,
  Sparkles, BarChart3,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/* ─── helpers ─── */
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

/* ─── 4 core outcome cards ─── */
const OUTCOMES = [
  {
    icon: Package,
    step: "01",
    title: "Create Your Product",
    desc: "Describe your idea. AI writes a complete ebook, planner, guide, or template — formatted, designed, and ready to sell in minutes.",
    detail: "No writing skills needed. Pick a topic and the platform does the rest.",
    color: "from-blue-500/10 to-blue-600/5",
    border: "hover:border-blue-500/30",
    iconBg: "bg-blue-500/10 border-blue-500/20",
    iconColor: "text-blue-400",
  },
  {
    icon: Video,
    step: "02",
    title: "Create Promo Videos",
    desc: "Turn your product into short-form promo videos, hooks, captions, and content ideas — ready for TikTok, Instagram, and YouTube.",
    detail: "Content that sells while you sleep.",
    color: "from-orange-500/10 to-orange-600/5",
    border: "hover:border-orange-500/30",
    iconBg: "bg-orange-500/10 border-orange-500/20",
    iconColor: "text-orange-400",
  },
  {
    icon: Calendar,
    step: "03",
    title: "Build Your Audience",
    desc: "Grow your email list and stay in front of your audience. Send campaigns, collect subscribers, and keep people coming back.",
    detail: "Stay consistent without the mental load.",
    color: "from-violet-500/10 to-violet-600/5",
    border: "hover:border-violet-500/30",
    iconBg: "bg-violet-500/10 border-violet-500/20",
    iconColor: "text-violet-400",
  },
  {
    icon: Rocket,
    step: "04",
    title: "Drive Sales",
    desc: "List your product on Gumroad, Etsy, or Payhip — then use your Content Flywheel content to drive a steady stream of buyers.",
    detail: "From product to first sale in one afternoon.",
    color: "from-emerald-500/10 to-emerald-600/5",
    border: "hover:border-emerald-500/30",
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
    iconColor: "text-emerald-400",
  },
];

/* ─── traditional stack ─── */
const OLD_STACK = [
  { tool: "ChatGPT", cost: "~£20/mo", purpose: "Write your product" },
  { tool: "Canva Pro", cost: "~£13/mo", purpose: "Design covers & pages" },
  { tool: "Stan Store / Gumroad", cost: "fees + £29/mo", purpose: "Host & sell" },
  { tool: "Mailchimp", cost: "~£20/mo", purpose: "Email marketing" },
  { tool: "Affiliate software", cost: "~£30/mo", purpose: "Track referrals" },
];

/* ─── main export ─── */
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

      {/* ─── 4 OUTCOMES ─── */}
      <section id="features" className="py-28 lg:py-36">
        <div className="max-w-7xl mx-auto px-6">
          <FadeUp className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-500 mb-4">How it works</p>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
              One platform.{" "}
              <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                Four steps.
              </span>
            </h2>
            <p className="mt-4 text-lg text-white/40 max-w-xl mx-auto">
              Content Flywheel guides you through the full journey — from idea to income.
            </p>
          </FadeUp>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {OUTCOMES.map((o, i) => {
              const Icon = o.icon;
              return (
                <FadeUp key={o.title} delay={i * 0.08}>
                  <motion.div
                    whileHover={{ y: -6 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className={`group relative h-full p-6 bg-gradient-to-br ${o.color} border border-white/[0.06] ${o.border} rounded-2xl transition-colors cursor-default`}
                  >
                    <div className="flex items-center gap-3 mb-5">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${o.iconBg}`}>
                        <Icon className={`h-5 w-5 ${o.iconColor}`} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">
                        Step {o.step}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white mb-2"
                      dangerouslySetInnerHTML={{ __html: o.title }}
                    />
                    <p className="text-white/40 text-sm leading-relaxed mb-3">{o.desc}</p>
                    <p className="text-xs text-white/25 italic">{o.detail}</p>
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
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-500 mb-4">The journey</p>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
              Idea → Product → Content → Sales
            </h2>
            <p className="mt-4 text-white/40 text-lg">No design skills. No technical setup. No third-party tools.</p>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                emoji: "📦",
                title: "Create Product",
                desc: "Generate ebooks, guides, planners, templates, and digital products in minutes. Describe your idea — AI does the writing, formatting, and design.",
              },
              {
                step: "02",
                emoji: "🎬",
                title: "Create Content",
                desc: "Turn your product into promo videos, captions, hooks, and content ideas. Build a content library that promotes your product around the clock.",
              },
              {
                step: "03",
                emoji: "🚀",
                title: "Drive Sales",
                desc: "List on Gumroad, Etsy, or Payhip — then let your Content Flywheel videos, captions, and email campaigns bring buyers to you consistently.",
              },
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
              Most creators stitch together a stack that costs £100+/mo and still doesn&apos;t talk to itself.
            </p>
          </FadeUp>

          <div className="grid md:grid-cols-2 gap-6 items-start">
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
                    "AI creates your digital product in minutes",
                    "Built-in store with Stripe — zero platform fees",
                    "Promo video creator included",
                    "Content calendar to plan and stay consistent",
                    "Email marketing built in — no Mailchimp needed",
                    "Affiliate programme and discount codes included",
                    "Orders dashboard with automatic download delivery",
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
                &ldquo;I was spending more time managing tools than actually creating. ChatGPT for writing, Canva for design, Stan for selling, Mailchimp for email — and none of them talked to each other.
                <br /><br />
                I built Content Flywheel because creators shouldn&apos;t need a six-tool stack to run a digital product business. One platform should do it all.&rdquo;
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

      {/* ─── PRICING ─── */}
      <section id="pricing-preview" className="py-28 lg:py-36">
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
      <section id="faq" className="py-28 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-3xl mx-auto px-6">
          <FadeUp className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">FAQs</h2>
          </FadeUp>
          <FadeUp delay={0.1}>
            <Accordion type="single" collapsible className="w-full space-y-3">
              {[
                { value: "what", q: "What kind of digital products can I create?", a: "Ebooks, planners, workbooks, guides, templates, checklists — anything text and design based. You describe the topic and AI generates the full product including a cover." },
                { value: "who", q: "Who is Content Flywheel for?", a: "Creators, coaches, consultants, and anyone who wants to sell digital products. If you have knowledge worth packaging, this platform builds it for you — no tech skills needed." },
                { value: "sell", q: "How do I sell products and get paid?", a: "List your product on Gumroad, Etsy, Payhip, or any platform you choose — Content Flywheel creates the content that drives buyers there. You own your storefront and payments directly." },
                { value: "fees", q: "Are there any per-sale fees?", a: "No. Content Flywheel charges a flat monthly subscription. There are no per-sale fees from us — whatever you earn from your products is yours." },
                { value: "email", q: "Is email marketing included?", a: "Yes. Collect subscribers and send email campaigns directly from Content Flywheel — no Mailchimp required." },
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
                    Content Flywheel helps you create, market, and sell digital products using AI.
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
