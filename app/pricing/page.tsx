/**
 * Content Flywheel Pro — Pricing (paywall)
 * Monthly $69.99, Yearly $671.90 (save 20%). Subscribe via Stripe Checkout.
 */
"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { LightNavbar } from "@/components/marketing/light-navbar";
import { LightFooter } from "@/components/marketing/light-footer";

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
    price: "$69.99",
    period: "per month",
    description: "Flexible month-to-month access.",
    cta: "Subscribe",
    plan: "monthly" as const,
    highlighted: false,
    badge: null as string | null,
  },
  {
    name: "Yearly",
    price: "$671.90",
    period: "per year",
    description: "Save 20% when you commit for a year.",
    cta: "Subscribe",
    plan: "yearly" as const,
    highlighted: true,
    badge: "Save 20%",
  },
];

export default function PricingPage() {
  const reduceMotion = useReducedMotion();
  const [loadingPlan, setLoadingPlan] = useState<"monthly" | "yearly" | null>(null);

  const handleSubscribe = async (plan: "monthly" | "yearly") => {
    setLoadingPlan(plan);
    try {
      const res = await fetch("/api/stripe-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      if (data.url) window.location.href = data.url;
      else throw new Error("No checkout URL");
    } catch (e) {
      console.error(e);
      setLoadingPlan(null);
      alert(e instanceof Error ? e.message : "Something went wrong. Try again.");
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
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
            {PLANS.map((p, i) => (
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
                  <span className="text-4xl font-bold text-[#0F172A]">{p.price}</span>
                  <span className="text-slate-500">{p.period}</span>
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
            ))}
          </div>
        </div>
      </main>

      <LightFooter />
    </div>
  );
}
