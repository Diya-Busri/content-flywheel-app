"use client"

import { motion } from "framer-motion"
import { ArrowRight, Sparkles } from "lucide-react"
import Link from "next/link"
import { HeroDashboard } from "./HeroDashboard"

export default function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden bg-[#0a0a0a] flex min-h-[100svh] flex-col justify-start pt-24 md:justify-center md:pt-20">
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl" aria-hidden="true">
        <div
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-orange-600/20 to-amber-500/10 opacity-60 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
          style={{ clipPath: "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)" }}
        />
      </div>
      {/* Additional glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] bg-[radial-gradient(ellipse_at_top_center,rgba(249,115,22,0.06),transparent_60%)]" aria-hidden="true" />

      <div className="mx-auto w-full max-w-7xl px-6 pb-8 sm:pb-10 lg:px-8">
        {/* Hero text — centered */}
        <div className="mx-auto max-w-3xl text-center">
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-sm font-medium text-orange-400"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
            </span>
            The marketing engine for digital products
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            Creating your digital product is the easy part.
            <br />
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              Marketing it is where most creators give up.
            </span>
          </motion.h1>

          {/* Supporting text */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-lg leading-8 text-white/50 sm:text-xl max-w-2xl mx-auto"
          >
            Content Flywheel turns one digital product into weeks of marketing content using AI. Generate research, competitor analysis, hooks, carousels, short-form video scripts, emails and launch campaigns from one dashboard so you can focus on growing your business instead of wondering what to post next.
          </motion.p>

          {/* Two audiences, two paths: use the software, or have us market your product. */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href="/signup"
              className="press-feedback group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition hover:shadow-xl hover:shadow-orange-500/40 hover:scale-105"
            >
              <Sparkles className="h-4 w-4" />
              Start Marketing Free
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <Link
              href="/challenge/submit"
              className="press-feedback inline-flex items-center justify-center gap-2 rounded-full border border-white/15 hover:bg-white/5 px-8 py-4 text-base font-bold text-white transition-colors"
            >
              Submit Your Product
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-5 text-sm text-white/25"
          >
            No credit card required · Cancel anytime
          </motion.p>
        </div>

        {/* ─── Dashboard mockup ─── */}
        <div className="mt-10 sm:mt-12">
          <HeroDashboard />
        </div>

      </div>
    </section>
  )
}
