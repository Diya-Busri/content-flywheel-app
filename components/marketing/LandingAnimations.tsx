"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import {
  ArrowRight, Check, X, Sparkles,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ProductJourney } from "./ProductJourney";
import { FeatureShowcase } from "./FeatureShowcase";
import { StatsAndProof } from "./StatsAndProof";

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
  void reviews; // reviews available for future use

  return (
    <main>

      {/* ─── COMPARISON ─── */}
      <section className="py-28 lg:py-36 bg-white/[0.02] border-y border-white/[0.05]">
        <div className="max-w-5xl mx-auto px-6">
          <FadeUp className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-500 mb-4">Why Content Flywheel</p>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
              The tool stack is{" "}
              <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">costing you £112+/mo</span>
              {" "}— and none of it talks to itself
            </h2>
            <p className="mt-4 text-white/40 text-lg max-w-xl mx-auto">
              Most creators stitch together five separate tools. Content Flywheel replaces all of them — one login, one price, everything connected.
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
                  <span className="text-sm font-bold text-white/30">£112+/mo + 5 browser tabs</span>
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
      <section className="py-28 bg-[#0a0a0a] border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6">
          <FadeUp>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10">
              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="w-4 h-4 text-orange-400" />
                <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">Why we built this</p>
              </div>
              <blockquote className="text-lg sm:text-xl text-white/70 leading-relaxed">
                &ldquo;I was spending more time managing tools than actually creating. ChatGPT for writing, Canva for design, Stan for selling, Mailchimp for email — and none of them talked to each other.
                <br /><br />
                Creators shouldn&apos;t need a six-tool stack to run a digital product business. One platform should do it all — so I built it.&rdquo;
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
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-orange-500 hover:bg-orange-400 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/30 transition-colors"
            >
              Try it free for 7 days <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-3 text-xs text-white/20">No credit card required</p>
          </FadeUp>
        </div>
      </section>

      {/* ─── TRUST BAR ─── */}
      <section className="border-y border-white/5 bg-white/[0.02] py-8">
        <div className="max-w-5xl mx-auto px-6">
          <FadeUp>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-12 text-center">
              {[
                { label: "Now in Beta", sub: "Early access open" },
                { label: "7-Day Free Trial", sub: "No card required" },
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

      {/* ─── PRODUCT JOURNEY (animated flow) ─── */}
      <ProductJourney />

      {/* ─── FEATURE SHOWCASE (8 features with UI mockups) ─── */}
      <div className="border-t border-white/[0.05]">
        <FeatureShowcase />
      </div>

      {/* ─── WHAT YOU GET + REVIEWS ─── */}
      <div className="border-t border-white/[0.05]">
        <StatsAndProof reviews={reviews} />
      </div>

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
            <p className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-4">Got questions?</p>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">FAQs</h2>
          </FadeUp>
          <FadeUp delay={0.1}>
            <Accordion type="single" collapsible className="w-full space-y-3">
              {[
                {
                  value: "what",
                  q: "What kind of digital products can I create?",
                  a: "Ebooks, planners, workbooks, guides, templates, checklists — anything text and design based. You describe the topic and AI generates the full product including a cover.",
                },
                {
                  value: "who",
                  q: "Who is Content Flywheel for?",
                  a: "Creators, coaches, consultants, and anyone who wants to sell digital products. If you have knowledge worth packaging, this platform builds it for you — no tech skills needed.",
                },
                {
                  value: "sell",
                  q: "How do I sell products and get paid?",
                  a: "You get a branded store at yourname.contentflywheel.co.uk. Payments go through Stripe directly to your bank — we charge no per-sale fees.",
                },
                {
                  value: "fees",
                  q: "Are there any per-sale fees?",
                  a: "No. Content Flywheel charges a flat monthly subscription. There are no per-sale fees from us — whatever you earn from your products is yours.",
                },
                {
                  value: "email",
                  q: "Is email marketing included?",
                  a: "Yes. Collect subscribers and send email campaigns directly from Content Flywheel — no Mailchimp required.",
                },
                {
                  value: "cancel",
                  q: "Can I cancel anytime?",
                  a: "Yes. Cancel from your dashboard settings at any time. Your subscription stays active until the end of the billing period.",
                },
                {
                  value: "trial",
                  q: "Is there a free trial?",
                  a: "Yes — you can sign up and start creating products immediately without a credit card. The trial gives you access to the core tools so you can see the value before subscribing.",
                },
              ].map((item) => (
                <AccordionItem
                  key={item.value}
                  value={item.value}
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
                    Type your idea. AI builds your product. Publish your store. Start earning.
                  </p>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} className="mt-8 inline-block">
                    <Link
                      href="/signup"
                      className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-400 px-10 py-4 text-base font-bold text-white shadow-2xl shadow-orange-500/30 transition-colors"
                    >
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
