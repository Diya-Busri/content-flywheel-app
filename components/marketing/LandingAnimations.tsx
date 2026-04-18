"use client";

import { motion, useScroll, useTransform, useInView, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Check, Star, Zap, TrendingUp, Users, Package, Mail, Tag, Link2, ShoppingBag } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ReviewsCarousel } from "@/components/marketing/reviews-carousel";

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

function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 1800;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target]);
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

/* ─────────────── hero mock dashboard ─────────────── */
const PRODUCTS = [
  { title: "90-Day Content Planner", price: "£19", sales: 47, color: "from-orange-500/20 to-orange-600/5", badge: "🔥" },
  { title: "Instagram Caption Guide", price: "£12", sales: 83, color: "from-blue-500/20 to-blue-600/5", badge: "⭐" },
  { title: "Viral Hook Workbook",     price: "£27", sales: 31, color: "from-purple-500/20 to-purple-600/5", badge: "🚀" },
];

function MockDashboard() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % PRODUCTS.length), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40, rotateY: -10 }}
      animate={{ opacity: 1, x: 0, rotateY: 0 }}
      transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      style={{ perspective: 1000 }}
      className="relative hidden lg:block"
    >
      {/* Glow */}
      <div className="absolute inset-0 bg-orange-500/20 blur-3xl rounded-3xl scale-110 pointer-events-none" />

      <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-5">
          <span className="text-white font-bold text-sm">My Store</span>
          <motion.span
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1 rounded-full font-semibold"
          >
            ● Live
          </motion.span>
        </div>

        {/* Product rows */}
        <div className="space-y-3 mb-5">
          {PRODUCTS.map((p, i) => (
            <motion.div
              key={p.title}
              animate={{ scale: active === i ? 1.02 : 1, opacity: active === i ? 1 : 0.65 }}
              transition={{ duration: 0.3 }}
              className={`flex items-center justify-between rounded-xl px-4 py-3 bg-gradient-to-r ${p.color} border border-white/5`}
            >
              <div>
                <p className="font-semibold text-white text-sm">{p.badge} {p.title}</p>
                <p className="text-xs text-white/40">{p.sales} sales</p>
              </div>
              <span className="font-bold text-orange-400 text-sm">{p.price}</span>
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Revenue", value: "£1,847" },
            { label: "Orders", value: "161" },
            { label: "Subs", value: "924" },
          ].map((s) => (
            <div key={s.label} className="bg-white/5 border border-white/5 rounded-xl p-3 text-center">
              <p className="font-bold text-white text-base">{s.value}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Floating badges */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        className="absolute -top-5 -right-5 bg-orange-500 text-white rounded-2xl px-4 py-2.5 shadow-xl shadow-orange-500/40 text-sm font-bold rotate-3 whitespace-nowrap"
      >
        🚀 AI-built in 2 mins
      </motion.div>
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
        className="absolute -bottom-5 -left-5 bg-white/10 border border-white/20 backdrop-blur-sm text-white rounded-2xl px-4 py-2.5 shadow-xl text-sm font-bold -rotate-2 whitespace-nowrap"
      >
        💳 Stripe built-in
      </motion.div>
    </motion.div>
  );
}

/* ─────────────── feature cards ─────────────── */
const FEATURES = [
  { icon: Package,    emoji: "📦", title: "AI Product Creator",  desc: "Describe your idea — our AI writes, formats, and designs the full product in minutes.", badge: "Most popular" },
  { icon: ShoppingBag, emoji: "🏪", title: "Branded Store",      desc: "Your own store with Stripe checkout, download delivery, and buyer email built in." },
  { icon: Mail,       emoji: "📧", title: "Email Marketing",     desc: "Build your list, send broadcasts, and automate drip sequences. No third-party tools." },
  { icon: Tag,        emoji: "🎟️", title: "Discount Codes",     desc: "Promo codes with expiry dates and usage limits. Perfect for launches and collabs." },
  { icon: Link2,      emoji: "🔗", title: "Affiliates",          desc: "Give partners referral links, set commission rates, and track clicks and earnings." },
  { icon: Star,       emoji: "⭐", title: "Reviews",             desc: "Collect post-purchase reviews. Approve them and they go live on your product pages." },
];

/* ─────────────── main export ─────────────── */
export function LandingAnimations({ reviews }: { reviews: { text: string; name: string; rating?: number }[] }) {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <main className="pt-16">

      {/* ─── HERO ─── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden bg-[#0a0a0a]">
        {/* Animated background */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }}
            transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
            className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-orange-600 rounded-full blur-[120px]"
          />
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.08, 0.15, 0.08] }}
            transition={{ repeat: Infinity, duration: 10, delay: 2, ease: "easeInOut" }}
            className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-orange-400 rounded-full blur-[100px]"
          />
          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: "linear-gradient(white 1px,transparent 1px),linear-gradient(90deg,white 1px,transparent 1px)", backgroundSize: "60px 60px" }}
          />
        </div>

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative max-w-7xl mx-auto px-4 sm:px-6 w-full py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left */}
            <div className="space-y-7">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-semibold"
              >
                <motion.span animate={{ rotate: [0, 15, -15, 0] }} transition={{ repeat: Infinity, duration: 2 }}>⚡</motion.span>
                AI-Powered Digital Product Platform
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="text-5xl lg:text-6xl xl:text-7xl font-extrabold leading-[1.05] tracking-tight text-white"
              >
                Create, sell &{" "}
                <br className="hidden sm:block" />
                market{" "}
                <span className="relative inline-block">
                  <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 bg-clip-text text-transparent">
                    digital products
                  </span>
                  <motion.span
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.6, delay: 0.8 }}
                    style={{ originX: 0 }}
                    className="absolute -bottom-1 left-0 right-0 h-[3px] bg-gradient-to-r from-orange-400 to-orange-600 rounded-full"
                  />
                </span>
                <br />in minutes.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
                className="text-lg text-white/50 leading-relaxed max-w-lg"
              >
                Build ebooks, planners & templates with AI. Sell from your own branded store. Grow with email marketing, affiliates, and discount codes.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.35 }}
                className="flex flex-col sm:flex-row gap-3 pt-1"
              >
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                  <Link href="/sign-up" className="px-7 py-3.5 bg-orange-500 hover:bg-orange-400 rounded-xl font-bold text-base inline-flex items-center justify-center gap-2 text-white shadow-xl shadow-orange-500/30 transition-colors">
                    Get Started <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Link href="#how-it-works" className="px-7 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold text-base inline-flex items-center justify-center text-white transition-colors">
                    See how it works
                  </Link>
                </motion.div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="flex flex-wrap gap-5 text-sm text-white/40"
              >
                {["No per-sale fees", "All features included", "Cancel anytime"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-green-500" /> {t}
                  </span>
                ))}
              </motion.div>
            </div>

            {/* Right */}
            <MockDashboard />
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 8, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/30"
        >
          <span className="text-xs font-medium tracking-widest uppercase">Scroll</span>
          <div className="w-5 h-8 rounded-full border border-white/20 flex items-start justify-center p-1.5">
            <motion.div animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-1 h-1 rounded-full bg-orange-400" />
          </div>
        </motion.div>
      </section>

      {/* ─── STATS BAR ─── */}
      <section className="border-y border-white/5 bg-white/[0.02] py-12">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { target: 2500, suffix: "+", label: "Creators" },
              { target: 50000, suffix: "+", label: "Products Built" },
              { target: 500, suffix: "k+", label: "£ Revenue Generated" },
              { target: 4.9, suffix: " ★", label: "Average Rating" },
            ].map((s, i) => (
              <FadeUp key={s.label} delay={i * 0.1}>
                <p className="text-3xl lg:text-4xl font-extrabold text-white">
                  <AnimatedNumber target={s.target} suffix={s.suffix} />
                </p>
                <p className="text-sm text-white/40 mt-1">{s.label}</p>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="py-28 lg:py-36">
        <div className="max-w-7xl mx-auto px-6">
          <FadeUp className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
              Everything you need to sell
              <br />
              <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">digital products</span>
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
                  {/* Hover glow */}
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

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="py-28 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-5xl mx-auto px-6">
          <FadeUp className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">From idea to selling in 3 steps</h2>
            <p className="mt-4 text-white/40 text-lg">No design skills. No technical setup. No third-party tools.</p>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: "01", emoji: "✍️", title: "Describe your product", desc: "Tell our AI your topic or niche. It writes, designs, and packages your digital product automatically." },
              { step: "02", emoji: "🚀", title: "Publish to your store", desc: "Set your price, upload a cover, go live. Your Stripe checkout and download delivery are pre-connected." },
              { step: "03", emoji: "📈", title: "Market & grow", desc: "Use email sequences, affiliate links, and promo codes. Track sales, views, and revenue in your dashboard." },
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
                  {/* Connecting line */}
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
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
              Why creators choose
              <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent"> Content Flywheel</span>
            </h2>
          </FadeUp>
          <div className="grid md:grid-cols-2 gap-6">
            <FadeUp delay={0}>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 h-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/40 font-bold text-sm">✕</div>
                  <h3 className="font-bold text-white/50">Without Content Flywheel</h3>
                </div>
                <ul className="space-y-3 text-white/30 text-sm">
                  {["Hours writing and formatting products manually", "Paying for Gumroad, Stan Store, or Kajabi", "Separate email tool (Mailchimp, ConvertKit)", "No built-in affiliate tracking", "Manual order management", "No analytics on your product pages"].map((t) => (
                    <li key={t} className="flex items-start gap-2.5"><span className="text-white/20 mt-0.5">—</span>{t}</li>
                  ))}
                </ul>
              </div>
            </FadeUp>
            <FadeUp delay={0.1}>
              <motion.div
                whileHover={{ scale: 1.01 }}
                className="rounded-2xl border-2 border-orange-500 bg-white/[0.03] p-8 h-full shadow-2xl shadow-orange-500/10"
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-sm">✓</div>
                  <h3 className="font-bold text-white">With Content Flywheel</h3>
                </div>
                <ul className="space-y-3 text-white/70 text-sm">
                  {["AI builds your product in minutes", "Built-in store — zero platform fees", "Email marketing & sequences included", "Affiliate programme with referral tracking", "Orders dashboard with automatic delivery", "Product view analytics per page"].map((t) => (
                    <li key={t} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />{t}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ─── REVIEWS ─── */}
      <section className="py-28 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <FadeUp className="text-center mb-16">
            <div className="flex items-center justify-center gap-1 mb-4">
              {[...Array(5)].map((_, i) => (
                <motion.div key={i} initial={{ opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                  <Star className="w-5 h-5 fill-orange-400 text-orange-400" />
                </motion.div>
              ))}
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">Loved by creators</h2>
            <p className="mt-4 text-white/40 text-lg">Real results from real people building real income.</p>
          </FadeUp>
          <ReviewsCarousel reviews={reviews} />
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
                    <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-xl border border-white/10 hover:bg-white/5 px-8 py-4 text-base font-bold text-white transition-colors">
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
                { value: "what", q: "What kind of digital products can I create?", a: "Ebooks, planners, workbooks, guides, templates, checklists — anything text and design based. You describe the topic and our AI generates the full product including a cover." },
                { value: "sell", q: "How do I sell products and get paid?", a: "Your store connects to Stripe. Buyers pay by card, Stripe sends the money to your account, and we automatically email the buyer their download link." },
                { value: "fees", q: "Are there any per-sale fees?", a: "No. We charge a flat monthly subscription. You keep everything Stripe sends you (minus Stripe's standard fee of ~1.4% + 20p)." },
                { value: "email", q: "Is email marketing included?", a: "Yes. Collect subscribers, send broadcasts, and build automated drip sequences. All built in — no Mailchimp or ConvertKit required." },
                { value: "start", q: "How do I get started?", a: "Sign up and get immediate access to the full platform. Choose a monthly or annual plan and start building your first digital product right away." },
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
      <section className="py-28 lg:py-36">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <FadeUp>
            <div className="relative">
              {/* Glow */}
              <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ repeat: Infinity, duration: 5 }}
                className="absolute inset-0 bg-orange-600/20 blur-3xl rounded-3xl scale-110 pointer-events-none"
              />
              <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm px-8 py-20 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.15),transparent_60%)] pointer-events-none" />
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
                  className="absolute -top-20 -right-20 w-64 h-64 border border-orange-500/10 rounded-full"
                />
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ repeat: Infinity, duration: 30, ease: "linear" }}
                  className="absolute -bottom-20 -left-20 w-96 h-96 border border-orange-500/5 rounded-full"
                />
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
                    Join thousands of creators building real income with digital products. One plan, everything included.
                  </p>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} className="mt-8 inline-block">
                    <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-400 px-10 py-4 text-base font-bold text-white shadow-2xl shadow-orange-500/30 transition-colors">
                      Start Creating <ArrowRight className="h-5 w-5" />
                    </Link>
                  </motion.div>
                  <p className="mt-5 text-sm text-white/20">No per-sale fees • Cancel anytime</p>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>
    </main>
  );
}
