/**
 * Content Flywheel — Pricing (light SaaS layout)
 * Monthly $59.99, Yearly $499.99, one highlighted plan.
 */
"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { LightNavbar } from "@/components/marketing/light-navbar";
import { LightFooter } from "@/components/marketing/light-footer";

const ACCENT = "#F5B942";
const CONTAINER = "mx-auto max-w-6xl";

const PLANS = [
  {
    name: "Monthly",
    price: "$59.99",
    period: "per month",
    description: "Flexible month-to-month access.",
    features: [
      "Unlimited capture & repurpose",
      "All publishing channels",
      "Email support",
      "Cancel anytime",
    ],
    cta: "Start monthly",
    href: "/api/checkout?plan=monthly",
    highlighted: false,
  },
  {
    name: "Yearly",
    price: "$499.99",
    period: "per year",
    description: "Save when you commit for a year.",
    features: [
      "Everything in Monthly",
      "2 months free",
      "Priority support",
      "Early access to new features",
    ],
    cta: "Start yearly",
    href: "/api/checkout?plan=yearly",
    highlighted: true,
  },
] as const;

export default function PricingPage() {
  const reduceMotion = useReducedMotion();

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
              Simple, transparent pricing
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-slate-600">
              Choose the plan that fits your workflow. No hidden fees.
            </p>
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
            {PLANS.map((plan, i) => (
              <motion.div
                key={plan.name}
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
                  plan.highlighted
                    ? "border-[#F5B942] ring-2 ring-[#F5B942]/20"
                    : "border-slate-200"
                }`}
              >
                {plan.highlighted && (
                  <p
                    className="mb-4 inline-block rounded-full px-3 py-1 text-xs font-semibold"
                    style={{ backgroundColor: `${ACCENT}20`, color: ACCENT }}
                  >
                    Best value
                  </p>
                )}
                <h2 className="text-xl font-semibold text-[#0F172A]">
                  {plan.name}
                </h2>
                <p className="mt-2 text-slate-600">{plan.description}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-[#0F172A]">
                    {plan.price}
                  </span>
                  <span className="text-slate-500">{plan.period}</span>
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-slate-600">
                      <Check
                        className="h-5 w-5 shrink-0"
                        style={{ color: ACCENT }}
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <motion.div
                  className="mt-8"
                  whileHover={reduceMotion ? undefined : { scale: 1.02 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                >
                  <Link
                    href={plan.href}
                    className={`inline-flex w-full justify-center rounded-xl px-5 py-3.5 text-sm font-semibold shadow-sm transition-colors ${
                      plan.highlighted
                        ? "bg-[#F5B942] text-[#0F172A] hover:bg-[#e5a832]"
                        : "border border-slate-200 bg-white text-[#0F172A] hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {plan.cta}
                  </Link>
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
