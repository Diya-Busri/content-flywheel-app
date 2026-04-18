/**
 * Content Flywheel Pro — Pricing
 * Monthly: £29/mo | Annual: £228/yr (£19/mo, save 34%)
 *
 * NOTE: Update Stripe price IDs in /api/stripe-checkout to match these amounts.
 */
"use client";

import { useState } from "react";
import { Check, Tag, Loader2, X, Zap, Shield, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LightNavbar } from "@/components/marketing/light-navbar";
import { LightFooter } from "@/components/marketing/light-footer";
import { useToast } from "@/components/ui/use-toast";

const FEATURES = [
  { text: "AI digital product creator (ebooks, planners, workbooks)", highlight: true },
  { text: "Branded creator store with custom URL" },
  { text: "Stripe payments — 0% platform fees" },
  { text: "Unlimited digital products" },
  { text: "Order management & automatic download delivery" },
  { text: "Email marketing & subscriber list" },
  { text: "Automated drip sequences" },
  { text: "Affiliate programme with referral tracking" },
  { text: "Discount codes with expiry & usage limits" },
  { text: "Product reviews & testimonials" },
  { text: "Product page analytics & view tracking" },
  { text: "TikTok Shop scripts & video creation guides" },
  { text: "Script compliance checker" },
  { text: "Goal tracker & content calendar" },
];

const PLANS = [
  {
    name: "Monthly",
    price: "£29",
    period: "/month",
    subtext: "Billed monthly. Cancel anytime.",
    baseAmount: 2900,
    plan: "monthly" as const,
    highlighted: false,
    badge: null as string | null,
    saving: null as string | null,
  },
  {
    name: "Annual",
    price: "£19",
    period: "/month",
    subtext: "£228 billed annually.",
    baseAmount: 22800,
    plan: "yearly" as const,
    highlighted: true,
    badge: "Most popular",
    saving: "Save 34% — 4 months free",
  },
];

interface PromoResult {
  valid: boolean;
  discountPercent?: number;
  discountAmount?: number;
  description?: string;
  plan?: "monthly" | "yearly" | "both";
  error?: string;
}

function formatDiscountedPrice(result: PromoResult, baseAmount: number, isAnnual: boolean): string {
  if (result.discountPercent && result.discountPercent > 0) {
    const saved = Math.round((baseAmount * result.discountPercent) / 100);
    const final = (baseAmount - saved) / 100;
    const monthly = isAnnual ? (final / 12).toFixed(2) : final.toFixed(2);
    return `£${monthly}`;
  }
  if (result.discountAmount && result.discountAmount > 0) {
    const final = Math.max(0, baseAmount - result.discountAmount) / 100;
    const monthly = isAnnual ? (final / 12).toFixed(2) : final.toFixed(2);
    return `£${monthly}`;
  }
  return "";
}

const COMPARISON = [
  { tool: "Stan Store", price: "£23/mo", features: "Store only" },
  { tool: "Gumroad", price: "10% per sale", features: "Store only" },
  { tool: "Beacons", price: "£24/mo", features: "Link-in-bio + store" },
  { tool: "ConvertKit", price: "£29/mo", features: "Email only" },
  { tool: "Kajabi", price: "£119/mo", features: "All-in-one" },
  { tool: "Content Flywheel", price: "£29/mo", features: "All-in-one + AI", highlight: true },
];

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<"monthly" | "yearly" | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState("");
  const [promoResult, setPromoResult] = useState<PromoResult | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const { toast } = useToast();

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoLoading(true);
    setPromoResult(null);
    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data: PromoResult = await res.json();
      setPromoResult(data);
      if (data.valid) setPromoApplied(code);
    } catch {
      setPromoResult({ valid: false, error: "Could not validate code. Try again." });
    }
    setPromoLoading(false);
  };

  const clearPromo = () => { setPromoInput(""); setPromoApplied(""); setPromoResult(null); };

  const handleSubscribe = async (plan: "monthly" | "yearly") => {
    setLoadingPlan(plan);
    try {
      const res = await fetch(`${window.location.origin}/api/stripe-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, promoCode: promoApplied || undefined }),
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({})) as { url?: string; error?: string };
      if (res.status === 401) { window.location.href = "/sign-in"; return; }
      if (res.ok && typeof data.url === "string" && data.url.startsWith("http")) {
        window.location.assign(data.url); return;
      }
      toast({ title: "Checkout failed", description: data.error || "Please try again.", variant: "destructive" });
    } catch (e) {
      toast({ title: "Checkout failed", description: e instanceof Error ? e.message : "Something went wrong.", variant: "destructive" });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <LightNavbar />

      <main className="px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">

          {/* Header */}
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-semibold mb-6">
              <Zap className="w-3.5 h-3.5" /> Simple, transparent pricing
            </div>
            <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tight text-white">
              One plan.{" "}
              <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                Everything included.
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/40">
              No per-sale fees. No hidden charges. No extra tools to pay for.
            </p>

            {/* Promo code */}
            <div className="mx-auto mt-8 max-w-sm">
              <AnimatePresence mode="wait">
                {!promoResult?.valid ? (
                  <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                      <input
                        type="text"
                        value={promoInput}
                        onChange={e => setPromoInput(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === "Enter" && applyPromo()}
                        placeholder="Promo code"
                        className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>
                    <button
                      onClick={applyPromo}
                      disabled={promoLoading || !promoInput.trim()}
                      className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40 transition-colors"
                    >
                      {promoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                    </button>
                  </motion.div>
                ) : (
                  <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-between rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-green-400">✅</span>
                      <p className="text-sm font-semibold text-green-400">{promoApplied} applied!</p>
                    </div>
                    <button onClick={clearPromo} className="text-green-500/60 hover:text-green-400"><X className="h-4 w-4" /></button>
                  </motion.div>
                )}
              </AnimatePresence>
              {promoResult && !promoResult.valid && (
                <p className="mt-2 text-sm text-red-400">{promoResult.error}</p>
              )}
            </div>
          </motion.div>

          {/* Pricing cards */}
          <div className="grid gap-6 lg:grid-cols-2 max-w-4xl mx-auto mb-20">
            {PLANS.map((p, i) => {
              const promoAppliesToThisPlan =
                promoResult?.valid &&
                (promoResult.plan === "both" || promoResult.plan === p.plan);
              const discountedPrice = promoAppliesToThisPlan
                ? formatDiscountedPrice(promoResult!, p.baseAmount, p.plan === "yearly")
                : null;
              const promoExcludesThisPlan =
                promoResult?.valid && !promoAppliesToThisPlan;

              return (
                <motion.div
                  key={p.name}
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className={`relative rounded-2xl p-8 transition-shadow ${
                    p.highlighted
                      ? "border-2 border-orange-500 bg-gradient-to-b from-orange-500/10 to-white/[0.02] shadow-2xl shadow-orange-500/20"
                      : "border border-white/10 bg-white/[0.03]"
                  }`}
                >
                  {p.badge && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <span className="px-4 py-1.5 rounded-full bg-orange-500 text-white text-xs font-bold shadow-lg shadow-orange-500/30">
                        ⭐ {p.badge}
                      </span>
                    </div>
                  )}

                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-white">{p.name}</h2>
                    {p.saving && (
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold">
                        {p.saving}
                      </span>
                    )}
                  </div>

                  {/* Price */}
                  <div className="flex items-baseline gap-1 mb-1">
                    <AnimatePresence mode="wait">
                      {discountedPrice ? (
                        <motion.div key="discounted" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-white/30 line-through">{p.price}</span>
                          <span className="text-5xl font-extrabold text-green-400">{discountedPrice}</span>
                        </motion.div>
                      ) : (
                        <motion.span key="normal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-5xl font-extrabold text-white">
                          {p.price}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <span className="text-white/40 text-base">{p.period}</span>
                  </div>
                  <p className="text-white/30 text-sm mb-2">{p.subtext}</p>
                  {promoExcludesThisPlan && (
                    <p className="text-amber-400/80 text-xs mb-6">
                      ⚠️ <span className="font-medium">{promoApplied}</span> is only valid for the{" "}
                      <span className="font-semibold capitalize">{promoResult?.plan}</span> plan
                    </p>
                  )}
                  {!promoExcludesThisPlan && <div className="mb-6" />}

                  <motion.button
                    type="button"
                    disabled={loadingPlan !== null}
                    onClick={() => handleSubscribe(p.plan)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full py-3.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-60 ${
                      p.highlighted
                        ? "bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-500/30"
                        : "bg-white/10 hover:bg-white/15 text-white border border-white/10"
                    }`}
                  >
                    {loadingPlan === p.plan ? (
                      <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Redirecting…</span>
                    ) : (
                      "Get started →"
                    )}
                  </motion.button>

                  <p className="text-center text-xs text-white/20 mt-3">No per-sale fees. Cancel anytime.</p>
                </motion.div>
              );
            })}
          </div>

          {/* Features list */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="max-w-2xl mx-auto mb-20"
          >
            <h2 className="text-2xl font-bold text-white text-center mb-8">Everything included in every plan</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.text}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.04 }}
                  className={`flex items-start gap-3 px-4 py-3 rounded-xl ${f.highlight ? "bg-orange-500/10 border border-orange-500/20" : "bg-white/[0.03] border border-white/5"}`}
                >
                  <Check className={`w-4 h-4 shrink-0 mt-0.5 ${f.highlight ? "text-orange-400" : "text-orange-500"}`} />
                  <span className={`text-sm ${f.highlight ? "text-orange-300 font-semibold" : "text-white/60"}`}>{f.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Comparison table */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="max-w-2xl mx-auto mb-20"
          >
            <h2 className="text-2xl font-bold text-white text-center mb-8">How we compare</h2>
            <div className="rounded-2xl border border-white/10 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <th className="text-left px-5 py-3.5 text-xs font-bold uppercase tracking-widest text-white/30">Platform</th>
                    <th className="text-left px-5 py-3.5 text-xs font-bold uppercase tracking-widest text-white/30">Price</th>
                    <th className="text-left px-5 py-3.5 text-xs font-bold uppercase tracking-widest text-white/30">What you get</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((c, i) => (
                    <tr
                      key={c.tool}
                      className={`border-b border-white/5 last:border-0 ${c.highlight ? "bg-orange-500/10" : ""}`}
                    >
                      <td className="px-5 py-4">
                        <span className={`font-semibold text-sm ${c.highlight ? "text-orange-400" : "text-white/50"}`}>
                          {c.highlight && "⭐ "}{c.tool}
                        </span>
                      </td>
                      <td className={`px-5 py-4 text-sm font-bold ${c.highlight ? "text-orange-400" : "text-white/40"}`}>{c.price}</td>
                      <td className={`px-5 py-4 text-sm ${c.highlight ? "text-orange-300" : "text-white/30"}`}>{c.features}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="grid sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-20"
          >
            {[
              { icon: Shield, title: "Secure checkout", desc: "Powered by Stripe. Bank-level encryption." },
              { icon: Zap, title: "Instant access", desc: "Your account is live the moment you subscribe." },
              { icon: Star, title: "Cancel anytime", desc: "No lock-in. Cancel from your dashboard in seconds." },
            ].map((t) => (
              <div key={t.title} className="text-center px-4 py-5 rounded-2xl bg-white/[0.03] border border-white/5">
                <t.icon className="w-6 h-6 text-orange-500 mx-auto mb-3" />
                <p className="font-bold text-white text-sm mb-1">{t.title}</p>
                <p className="text-white/30 text-xs leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </motion.div>

          {/* FAQ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="max-w-2xl mx-auto"
          >
            <h2 className="text-2xl font-bold text-white text-center mb-8">Questions</h2>
            <div className="space-y-3">
              {[
                { q: "How do I get started?", a: "Sign up and pick a plan — monthly or annual. You get immediate access to all features from day one." },
                { q: "Are there per-sale fees?", a: "No. We charge a flat subscription. You keep everything Stripe pays you, minus Stripe's standard card fee (~1.4% + 20p)." },
                { q: "What happens if I cancel?", a: "Your subscription stays active until the end of the billing period. After that, no further charges." },
                { q: "Can I switch between monthly and annual?", a: "Yes. Contact us and we'll sort it out, or manage it directly from your billing portal." },
              ].map((item, i) => (
                <motion.div
                  key={item.q}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 + i * 0.07 }}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4"
                >
                  <p className="font-semibold text-white text-sm mb-1.5">{item.q}</p>
                  <p className="text-white/40 text-sm leading-relaxed">{item.a}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

        </div>
      </main>

      <LightFooter />
    </div>
  );
}
