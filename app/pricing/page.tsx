/**
 * Content Flywheel Pro — Pricing (paywall)
 * Monthly £69.99/month, Yearly £671.90/year (£55.99/month billed annually). Subscribe via Stripe Checkout.
 */
"use client";

import { useState } from "react";
import { Check, Tag, Loader2, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { LightNavbar } from "@/components/marketing/light-navbar";
import { LightFooter } from "@/components/marketing/light-footer";
import { useToast } from "@/components/ui/use-toast";

const ACCENT = "#F5B942";
const CONTAINER = "mx-auto max-w-6xl";

const FEATURES = [
  "Unlimited digital product creation",
  "Unlimited TikTok Shop scripts",
  "AI-powered video creation guides",
  "Script compliance checker",
  "Goal tracking",
  "My Library storage",
];

const PLANS = [
  {
    name: "Monthly",
    price: "£69.99",
    period: "/month",
    baseAmount: 6999, // pence
    description: "Flexible month-to-month access.",
    cta: "Subscribe",
    plan: "monthly" as const,
    highlighted: false,
    badge: null as string | null,
  },
  {
    name: "Yearly",
    price: "£671.90",
    period: "/year",
    baseAmount: 67190, // pence
    description: "£55.99/month billed annually. Save 20% when you commit for a year.",
    cta: "Subscribe",
    plan: "yearly" as const,
    highlighted: true,
    badge: "Save 20%",
  },
];

interface PromoResult {
  valid: boolean;
  discountPercent?: number;
  discountAmount?: number;
  description?: string;
  error?: string;
}

function formatDiscount(result: PromoResult, baseAmount: number): string {
  if (result.discountPercent && result.discountPercent > 0) {
    const saved = Math.round((baseAmount * result.discountPercent) / 100);
    const final = baseAmount - saved;
    return `£${(final / 100).toFixed(2)} (save ${result.discountPercent}%)`;
  }
  if (result.discountAmount && result.discountAmount > 0) {
    const final = Math.max(0, baseAmount - result.discountAmount);
    return `£${(final / 100).toFixed(2)} (save £${(result.discountAmount / 100).toFixed(2)})`;
  }
  return "";
}

export default function PricingPage() {
  const reduceMotion = useReducedMotion();
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

  const clearPromo = () => {
    setPromoInput("");
    setPromoApplied("");
    setPromoResult(null);
  };

  const handleSubscribe = async (plan: "monthly" | "yearly") => {
    setLoadingPlan(plan);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const apiUrl = `${origin}/api/stripe-checkout`;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, promoCode: promoApplied || undefined }),
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };

      if (res.status === 401) {
        window.location.href = "/sign-in";
        return;
      }

      if (res.ok && typeof data.url === "string" && data.url.startsWith("http")) {
        window.location.assign(data.url);
        return;
      }

      const message = data.error || "Checkout failed. Please try again.";
      toast({ title: "Checkout failed", description: message, variant: "destructive" });
    } catch (e) {
      console.error(e);
      toast({ title: "Checkout failed", description: e instanceof Error ? e.message : "Something went wrong.", variant: "destructive" });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#0F172A]">
      <LightNavbar />

      <main className="px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className={CONTAINER}>
          <motion.div
            className="mb-16 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
              Content Flywheel Pro
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-slate-600">
              One subscription. Full access. Cancel anytime.
            </p>

            {/* Promo Code Input */}
            <div className="mx-auto mt-8 max-w-sm">
              {!promoResult?.valid ? (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={promoInput}
                      onChange={e => setPromoInput(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === "Enter" && applyPromo()}
                      placeholder="Promo code"
                      className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#F5B942] focus:outline-none focus:ring-2 focus:ring-[#F5B942]/20"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={applyPromo}
                    disabled={promoLoading || !promoInput.trim()}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-[#0F172A] hover:bg-slate-50 disabled:opacity-50 transition-colors"
                  >
                    {promoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                  </button>
                </div>
              ) : null}

              {promoResult && !promoResult.valid && (
                <p className="mt-2 text-sm text-red-500">{promoResult.error}</p>
              )}

              {promoResult?.valid && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">✅</span>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-green-700">
                        {promoApplied} applied!
                      </p>
                      {promoResult.description && (
                        <p className="text-xs text-green-600">{promoResult.description}</p>
                      )}
                    </div>
                  </div>
                  <button onClick={clearPromo} className="text-green-500 hover:text-green-700">
                    <X className="h-4 w-4" />
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
            {PLANS.map((p, i) => {
              const discountedPrice = promoResult?.valid
                ? formatDiscount(promoResult, p.baseAmount)
                : null;

              return (
                <motion.div
                  key={p.name}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    delay: i * 0.1,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                  whileHover={
                    reduceMotion ? undefined : { scale: 1.02, transition: { duration: 0.2 } }
                  }
                  className={`rounded-xl border bg-white p-8 shadow-sm transition-shadow ${
                    p.highlighted
                      ? "border-[#F5B942] ring-2 ring-[#F5B942]/20"
                      : "border-slate-200"
                  }`}
                >
                  {p.badge && (
                    <p
                      className="mb-4 inline-block rounded-full px-3 py-1 text-xs font-semibold"
                      style={{ backgroundColor: `${ACCENT}20`, color: ACCENT }}
                    >
                      {p.badge}
                    </p>
                  )}
                  <h2 className="text-xl font-semibold text-[#0F172A]">{p.name}</h2>
                  <p className="mt-2 text-slate-600">{p.description}</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    {discountedPrice ? (
                      <div>
                        <span className="text-2xl font-bold text-slate-400 line-through mr-2">{p.price}</span>
                        <span className="text-4xl font-bold text-green-600">{discountedPrice.split(" ")[0]}</span>
                        <span className="ml-1.5 text-sm font-medium text-green-500">
                          {discountedPrice.slice(discountedPrice.indexOf("("))}
                        </span>
                      </div>
                    ) : (
                      <>
                        <span className="text-4xl font-bold text-[#0F172A]">{p.price}</span>
                        <span className="text-slate-500">{p.period}</span>
                      </>
                    )}
                  </div>
                  <ul className="mt-6 space-y-3">
                    {FEATURES.map((f) => (
                      <li key={f} className="flex items-center gap-3 text-slate-600">
                        <Check className="h-5 w-5 shrink-0" style={{ color: ACCENT }} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <motion.div
                    className="mt-8"
                    whileHover={reduceMotion ? undefined : { scale: 1.02 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                  >
                    <button
                      type="button"
                      disabled={loadingPlan !== null}
                      onClick={() => handleSubscribe(p.plan)}
                      className={`inline-flex w-full justify-center rounded-xl px-5 py-3.5 text-sm font-semibold shadow-sm transition-colors disabled:opacity-70 ${
                        p.highlighted
                          ? "bg-[#F5B942] text-[#0F172A] hover:bg-[#e5a832]"
                          : "border border-slate-200 bg-white text-[#0F172A] hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {loadingPlan === p.plan ? "Redirecting…" : p.cta}
                    </button>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </main>

      <LightFooter />
    </div>
  );
}
