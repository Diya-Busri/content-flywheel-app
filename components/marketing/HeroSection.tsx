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
    <section className="relative isolate overflow-hidden bg-[#0a0a0a]">
      {/* Subtle glow */}
      <div className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl" aria-hidden="true">
        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-orange-600/20 to-amber-500/10 opacity-60 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" style={{ clipPath: "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)" }} />
      </div>

      <div className="mx-auto max-w-7xl px-6 pb-24 pt-20 sm:pt-32 lg:px-8 lg:pt-40">
        <div className="mx-auto max-w-3xl text-center">
          {/* Beta badge */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-sm font-medium text-orange-400"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            Now in Beta — Built for creators, coaches &amp; digital sellers
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-balance text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            Describe your idea.{" "}
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              We build the business.
            </span>
          </motion.h1>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-lg leading-8 text-white/50 sm:text-xl max-w-2xl mx-auto"
          >
            Content Flywheel is an AI-powered operating system for creators. It writes your{" "}
            <Link href="/dashboard/digital-products" className="text-orange-400 hover:text-orange-300 underline underline-offset-4 transition-colors">
              digital products
            </Link>
            , builds your store, and runs your marketing — all from one tab.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link href="/signup" className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition hover:shadow-xl hover:shadow-orange-500/40">
              Start for free
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <Link href="#how-it-works" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-8 py-4 text-base font-semibold text-white transition hover:bg-white/10">
              See how it works
              <span className="text-white/40">→</span>
            </Link>
          </motion.div>

          {/* Trust */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-6 text-sm text-white/25"
          >
            No credit card required · Free trial included · Cancel anytime
          </motion.p>
        </div>

        {/* Flywheel steps */}
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
      <p className="mb-8 text-center text-xs font-semibold uppercase tracking-widest text-white/25">
        One platform · One workflow · One subscription
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
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 shadow-sm"
              >
                <motion.div
                  animate={{ backgroundColor: ["rgba(249,115,22,0.08)", "rgba(249,115,22,0.18)", "rgba(249,115,22,0.08)"] }}
                  transition={{ duration: 3, repeat: Infinity, delay: i * 0.4 }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                >
                  <Icon className="h-5 w-5 text-orange-500" />
                </motion.div>
                <span className="text-sm font-semibold text-white/80">{step.label}</span>
              </motion.div>
              {i < FLYWHEEL_STEPS.length - 1 && (
                <motion.div
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                  className="mx-1 text-white/20"
                >
                  <ArrowRight className="h-4 w-4" />
                </motion.div>
              )}
            </div>
          )
        })}
      </div>

      {/* Comparison callout */}
      <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 text-center text-white/50">
        <p className="text-sm sm:text-base">
          ChatGPT writes it. Canva designs it. Stan stores it. Mailchimp sends it. Affiliate software tracks it.{" "}
          <span className="font-semibold text-orange-400">Content Flywheel does all of it.</span>
        </p>
      </div>
    </div>
  )
}
