"use client"

import { motion } from "framer-motion"
import {
  Sparkles,
  Bot,
  Video,
  Package,
  ShoppingBag,
  Shirt,
  ArrowRight,
} from "lucide-react"
import Link from "next/link"

const FLYWHEEL_STEPS = [
  { label: "Niche", icon: Sparkles },
  { label: "AI Coach", icon: Bot },
  { label: "Video", icon: Video },
  { label: "Product", icon: Package },
  { label: "TikTok Shop", icon: ShoppingBag },
  { label: "Print on Demand", icon: Shirt },
]

export default function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-orange-50 via-white to-white">
      <div className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-orange-200 to-amber-300 opacity-40 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" style={{ clipPath: "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)" }} />
      </div>
      <div className="mx-auto max-w-7xl px-6 pb-24 pt-20 sm:pt-32 lg:px-8 lg:pt-40">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-sm font-medium text-orange-700">
            <Sparkles className="h-4 w-4" />
            AI factory for faceless creators
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
            Spin a faceless business —{" "}
            <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
              straight into TikTok Shop.
            </span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600 sm:text-xl">
            Content Flywheel turns a niche into a brand: AI-generated videos, digital products, and print-on-demand merch — sold from one tab, no 7-tool stack required.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/signup" className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:shadow-xl hover:shadow-orange-500/40">
              Start free — 100 video credits
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <Link href="#demo" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-8 py-4 text-base font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50">
              See it spin
              <span className="text-slate-400">→</span>
            </Link>
          </div>
          <p className="mt-8 text-sm text-slate-500">
            Built for first-time creators · No credit card to start · TikTok Shop + Stripe ready
          </p>
        </div>
        <div className="mt-20">
          <FlywheelLoop />
        </div>
      </div>
    </section>
  )
}

function FlywheelLoop() {
  return (
    <div className="mx-auto max-w-5xl">
      <p className="mb-8 text-center text-sm font-medium uppercase tracking-wide text-slate-500">
        Five steps. One tab. No stack.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {FLYWHEEL_STEPS.map((step, i) => {
          const Icon = step.icon
          return (
            <div key={step.label} className="flex items-center">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15, duration: 0.4 }}
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <motion.div
                  animate={{ backgroundColor: ["#fff7ed", "#fed7aa", "#fff7ed"] }}
                  transition={{ duration: 3, repeat: Infinity, delay: i * 0.4 }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                >
                  <Icon className="h-5 w-5 text-orange-600" />
                </motion.div>
                <span className="text-sm font-semibold text-slate-900">{step.label}</span>
              </motion.div>
              {i < FLYWHEEL_STEPS.length - 1 && (
                <motion.div
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                  className="mx-1 text-slate-300"
                >
                  <ArrowRight className="h-4 w-4" />
                </motion.div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mx-auto mt-16 max-w-3xl rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-700">
        <p className="text-sm sm:text-base">
          <span className="font-semibold">Stan</span> stores what you made.{" "}
          <span className="font-semibold">Kajabi</span> hosts what you wrote.{" "}
          <span className="font-semibold">Canva</span> designs what you draw.{" "}
          <span className="font-semibold text-orange-600">Content Flywheel builds it for you.</span>
        </p>
      </div>
    </div>
  )
}
