"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import {
  ArrowRight, Sparkles, Search, Megaphone, ShoppingBag,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ProblemSection } from "./ProblemSection";
import { FlywheelSection } from "./FlywheelSection";
import { FeatureShowcase } from "./FeatureShowcase";
import { RealExampleSection } from "./RealExampleSection";
import { StatsAndProof } from "./StatsAndProof";
import { SectionConnector } from "./SectionConnector";
import { ChallengeSection } from "./challenge/ChallengeSection";
import { CreatorJourney } from "./challenge/CreatorJourney";
import { FeaturedThisWeekSection } from "./challenge/FeaturedThisWeekSection";
import { MarketplaceConnectSection } from "./challenge/MarketplaceConnectSection";
import type { ChallengeEpisode } from "@/lib/marketing-challenge";

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

/* ─── main export ─── */
export function LandingAnimations({
  reviews,
  featuredEpisode,
  previousEpisodes,
  hasPreviousEpisodes,
}: {
  reviews: { text: string; name: string; rating?: number }[];
  featuredEpisode: ChallengeEpisode;
  previousEpisodes: ChallengeEpisode[];
  hasPreviousEpisodes: boolean;
}) {
  void reviews; // reviews available for future use

  return (
    <main>

      <SectionConnector />

      {/* ─── PROBLEM ─── */}
      <ProblemSection />

      <SectionConnector label="Content Flywheel analyses it" icon={Search} />

      {/* ─── FLYWHEEL (animated) ─── */}
      <FlywheelSection />

      {/* ─── FEATURE GRID ─── */}
      <FeatureShowcase />

      {/* ─── REAL EXAMPLE ─── */}
      <RealExampleSection />

      <SectionConnector />

      {/* ─── 100 PRODUCT CHALLENGE ─── */}
      <ChallengeSection episode={featuredEpisode} hasPreviousEpisodes={hasPreviousEpisodes} />

      {/* ─── CREATOR JOURNEY ─── */}
      <CreatorJourney />

      <SectionConnector label="Creator featured" icon={Megaphone} />

      {/* ─── FEATURED THIS WEEK ─── */}
      <FeaturedThisWeekSection episode={featuredEpisode} />

      <SectionConnector label="Store traffic" icon={ShoppingBag} />

      {/* ─── MARKETPLACE CONNECT ─── */}
      <MarketplaceConnectSection featuredEpisode={featuredEpisode} previousEpisodes={previousEpisodes} />

      {/* ─── BETA TRUST ─── */}
      <StatsAndProof />

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
                &ldquo;I kept watching creators build genuinely great products, then let them sit there because marketing felt like a second full-time job. Research, hooks, scripts, carousels, emails, a launch plan: nobody has time to do all of that for one £19 guide.
                <br /><br />
                Content Flywheel exists to close that gap. You already did the hard part by creating something. This is what happens next.&rdquo;
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

        </div>
      </section>

      {/* ─── TRUST BAR ─── */}
      <section className="border-y border-white/5 bg-white/[0.02] py-8">
        <div className="max-w-5xl mx-auto px-6">
          <FadeUp>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-12 text-center">
              {[
                { label: "7-Day Free Trial", sub: "No card required" },
                { label: "One Dashboard", sub: "Research to launch" },
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
                <h2 className="text-4xl font-extrabold text-white tracking-tight">One plan. A full marketing engine.</h2>
                <div className="mt-4 flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-extrabold text-white">£19</span>
                  <span className="text-xl text-white/40">/mo</span>
                  <span className="text-sm text-white/30 ml-1">· or £29/mo monthly</span>
                </div>
                <p className="mt-3 text-white/40 text-base max-w-md mx-auto">No per-post fees. No hidden charges. No extra tools.</p>
                <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                    <Link href="/pricing" className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-400 px-8 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition-colors">
                      See pricing <ArrowRight className="h-4 w-4" />
                    </Link>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl border border-white/10 hover:bg-white/5 px-8 py-4 text-base font-bold text-white transition-colors">
                      Start Marketing Free
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
                  q: "I already have a digital product. What does Content Flywheel actually do for me?",
                  a: "It turns your one product into a full marketing campaign: audience and competitor research, hooks, carousels, TikTok scripts, video ideas, email sequences, and a day-by-day launch plan. You bring the product, we build the marketing.",
                },
                {
                  value: "credits",
                  q: "What are video credits, and how many do I get?",
                  a: "Video credits power AI-generated videos on the platform, including promo clips and short-form content. Every new account gets 100 free credits on signup, which is enough for roughly 10 standard videos. Subscribers receive a monthly credit top-up, and additional packs are available if you need more.",
                },
                {
                  value: "who",
                  q: "Who is Content Flywheel for?",
                  a: "Creators, coaches, consultants, and anyone who has already made a digital product but hasn't cracked how to market it. If you have something worth selling, this platform builds the campaign around it. No marketing background needed.",
                },
                {
                  value: "sell",
                  q: "Do I need my product to already be live somewhere?",
                  a: "No. You can market a product hosted anywhere, and if you don't have a storefront yet, Content Flywheel gives you one at yourname.contentflywheel.co.uk with Stripe payments and no per-sale fees.",
                },
                {
                  value: "fees",
                  q: "Are there any per-sale or per-post fees?",
                  a: "No. Content Flywheel charges a flat monthly subscription. There are no per-sale or per-post fees. Whatever you earn from your products is yours.",
                },
                {
                  value: "email",
                  q: "Is email marketing included?",
                  a: "Yes. Content Flywheel drafts your launch sequence and nurture emails and lets you collect subscribers and send campaigns, all built in.",
                },
                {
                  value: "cancel",
                  q: "Can I cancel anytime?",
                  a: "Yes. Cancel from your dashboard settings at any time. Your subscription stays active until the end of the billing period.",
                },
                {
                  value: "trial",
                  q: "Is there a free trial?",
                  a: "Yes, you can sign up and generate your first marketing campaign immediately without a credit card, so you can see the value before subscribing.",
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
                aria-hidden="true"
                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ repeat: Infinity, duration: 5 }}
                className="absolute inset-0 bg-orange-600/20 blur-3xl rounded-3xl scale-110 pointer-events-none"
              />
              <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm px-8 py-20 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.15),transparent_60%)] pointer-events-none" aria-hidden="true" />
                <div className="relative">
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 3 }}
                    className="text-6xl mb-6"
                  >
                    🚀
                  </motion.div>
                  <h2 className="text-4xl lg:text-6xl font-extrabold text-white tracking-tight">
                    Your first campaign
                    <br />
                    <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                      could be live today.
                    </span>
                  </h2>
                  <p className="mt-5 text-lg text-white/40 max-w-lg mx-auto">
                    Add your product. AI builds the research, content, and launch plan. Start posting.
                  </p>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} className="mt-8 inline-block">
                    <Link
                      href="/signup"
                      className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-400 px-10 py-4 text-base font-bold text-white shadow-2xl shadow-orange-500/30 transition-colors"
                    >
                      Start Marketing Free <ArrowRight className="h-5 w-5" />
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
