/**
 * Landing page for Content Flywheel
 * Dark, premium SaaS marketing page (UI only).
 */
import Link from "next/link";
import { ArrowRight, Check, Github, Twitter } from "lucide-react";

const ACCENT = "#F5C97A";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0B0B0F] text-white selection:bg-[#F5C97A]/25 selection:text-white">
      {/* Background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-20%] h-[620px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(245,201,122,0.22),rgba(11,11,15,0)_62%)] blur-2xl" />
        <div className="absolute bottom-[-30%] right-[-10%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_center,rgba(245,201,122,0.12),rgba(11,11,15,0)_60%)] blur-2xl" />
      </div>

      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-30 h-14 border-b border-white/5 bg-[#0B0B0F]/60 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-sm font-semibold tracking-wide text-white">
            Content <span style={{ color: ACCENT }}>Flywheel</span>
          </Link>

          <Link
            href="/sign-in"
            className="text-sm font-medium text-white/70 transition-colors hover:text-white"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="pt-14">
        <section className="relative">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8 lg:py-24">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70">
                <span className="inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: ACCENT }} />
                Private beta · Built for creators & founder-led teams
              </div>

              <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                Turn one idea into a week of{" "}
                <span className="relative whitespace-nowrap">
                  <span className="relative" style={{ color: ACCENT }}>
                    high‑signal content
                  </span>
                </span>
                .
              </h1>

              <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-white/70 sm:text-lg">
                Content Flywheel helps you capture insights, repurpose them into platform-native posts, and ship on a
                consistent cadence—without a messy spreadsheet or a content calendar you’ll abandon in two weeks.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="#waitlist"
                  className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-[#0B0B0F] shadow-[0_0_0_1px_rgba(245,201,122,0.25),0_18px_48px_rgba(245,201,122,0.18)] transition hover:shadow-[0_0_0_1px_rgba(245,201,122,0.35),0_24px_60px_rgba(245,201,122,0.22)]"
                  style={{ backgroundColor: ACCENT }}
                >
                  Join the waitlist <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  href="#features"
                  className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white/90 transition hover:border-white/25 hover:bg-white/10"
                >
                  See what you’ll ship
                </Link>
              </div>

              <ul className="mt-8 flex flex-col gap-3 text-sm text-white/70 sm:flex-row sm:items-center sm:gap-6">
                <li className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4" style={{ color: ACCENT }} />
                  One source of truth for ideas
                </li>
                <li className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4" style={{ color: ACCENT }} />
                  Creator + founder workflows
                </li>
                <li className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4" style={{ color: ACCENT }} />
                  Output-focused, not “busy work”
                </li>
              </ul>
            </div>

            {/* Right-side preview panel */}
            <div className="lg:col-span-5">
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
                <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,201,122,0.16),rgba(11,11,15,0)_55%)]" />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold tracking-wide">This week’s flywheel</p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                      Draft → Publish
                    </span>
                  </div>

                  <div className="mt-6 space-y-3">
                    {[
                      { title: "Founder note", desc: "A contrarian insight from customer calls" },
                      { title: "LinkedIn thread", desc: "5 points + 1 story (platform-native)" },
                      { title: "Short video", desc: "60s script that hooks in 3 seconds" },
                      { title: "Newsletter", desc: "One idea, one framework, one CTA" },
                    ].map((item) => (
                      <div
                        key={item.title}
                        className="rounded-xl border border-white/10 bg-[#0B0B0F]/40 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-white">{item.title}</p>
                            <p className="mt-1 text-sm text-white/60">{item.desc}</p>
                          </div>
                          <span
                            className="mt-1 inline-flex h-2.5 w-2.5 flex-none rounded-full"
                            style={{ backgroundColor: ACCENT }}
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm font-semibold">Outcome</p>
                    <p className="mt-1 text-sm text-white/70">
                      Consistent output that compounds—without burning weekends.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-white/10">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold tracking-wide" style={{ color: ACCENT }}>
                What it does
              </p>
              <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                A lightweight system that turns inputs into output.
              </h2>
              <p className="mt-4 text-pretty text-base text-white/70">
                Capture raw material once, refine it into reusable assets, and ship across channels with a clear,
                repeatable workflow.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                {
                  title: "Capture",
                  desc: "Collect ideas, hooks, and insights the moment they happen—without breaking flow.",
                },
                {
                  title: "Repurpose",
                  desc: "Transform one thought into multiple angles: threads, posts, scripts, and newsletters.",
                },
                {
                  title: "Ship",
                  desc: "A simple, momentum-friendly pipeline from draft to publish—built for consistency.",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.05)]"
                >
                  <p className="text-sm font-semibold" style={{ color: ACCENT }}>
                    {f.title}
                  </p>
                  <p className="mt-2 text-lg font-semibold tracking-tight">{f.desc}</p>
                  <div className="mt-6 h-px w-full bg-gradient-to-r from-white/0 via-white/10 to-white/0" />
                  <ul className="mt-5 space-y-3 text-sm text-white/70">
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 flex-none" style={{ color: ACCENT }} />
                      <span>Designed for real workflows (not “content theater”).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 flex-none" style={{ color: ACCENT }} />
                      <span>Clear next actions—so you keep moving.</span>
                    </li>
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section id="who-its-for" className="border-t border-white/10">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
              <div className="lg:col-span-5">
                <p className="text-sm font-semibold tracking-wide" style={{ color: ACCENT }}>
                  Built for
                </p>
                <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                  Creators and founders who want content that compounds.
                </h2>
                <p className="mt-4 text-pretty text-base text-white/70">
                  Whether you’re building an audience or building a company, your best marketing asset is consistent,
                  high-signal communication.
                </p>
              </div>

              <div className="lg:col-span-7">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                    <p className="text-lg font-semibold">Creators</p>
                    <p className="mt-2 text-sm text-white/70">
                      Keep momentum without guessing what to post next.
                    </p>
                    <ul className="mt-6 space-y-3 text-sm text-white/70">
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 flex-none" style={{ color: ACCENT }} />
                        Hooks, angles, and story banks you can reuse
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 flex-none" style={{ color: ACCENT }} />
                        Platform-native formats (threads, shorts, newsletters)
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 flex-none" style={{ color: ACCENT }} />
                        A workflow that makes consistency easier
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                    <p className="text-lg font-semibold">Founders</p>
                    <p className="mt-2 text-sm text-white/70">
                      Turn customer insight into distribution—while you build.
                    </p>
                    <ul className="mt-6 space-y-3 text-sm text-white/70">
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 flex-none" style={{ color: ACCENT }} />
                        Ship thought leadership without a full content team
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 flex-none" style={{ color: ACCENT }} />
                        Translate calls + wins into narrative and proof
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 flex-none" style={{ color: ACCENT }} />
                        Consistent posting that drives inbound over time
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Social proof */}
        <section className="border-t border-white/10">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold tracking-wide" style={{ color: ACCENT }}>
                  Early feedback
                </p>
                <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                  Built with creators who ship.
                </h2>
                <p className="mt-4 text-pretty text-base text-white/70">
                  The goal isn’t more content. It’s more clarity, more consistency, and more compounding.
                </p>
              </div>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                {
                  quote:
                    "This turns scattered notes into a real content system. I finally know what I’m posting next week.",
                  name: "Creator",
                },
                {
                  quote:
                    "The workflow feels lightweight but keeps me shipping. It’s the first tool that reduced my content stress.",
                  name: "Founder",
                },
                {
                  quote:
                    "I stopped overthinking. Capture → repurpose → ship is exactly the structure I needed.",
                  name: "Indie builder",
                },
              ].map((t) => (
                <div
                  key={t.quote}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <p className="text-sm leading-relaxed text-white/80">“{t.quote}”</p>
                  <p className="mt-4 text-sm font-semibold text-white/70">{t.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Waitlist */}
        <section id="waitlist" className="border-t border-white/10">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 sm:p-10">
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,201,122,0.18),rgba(11,11,15,0)_60%)]"
              />

              <div className="relative grid gap-10 lg:grid-cols-12 lg:items-center">
                <div className="lg:col-span-7">
                  <p className="text-sm font-semibold tracking-wide" style={{ color: ACCENT }}>
                    Join the waitlist
                  </p>
                  <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                    Get early access when Content Flywheel opens.
                  </h2>
                  <p className="mt-4 text-pretty text-base text-white/70">
                    We’re onboarding a small group first. If you care about consistent, high-signal output, put your
                    email down and we’ll reach out.
                  </p>
                </div>

                <div className="lg:col-span-5">
                  <form action="#waitlist" method="get" className="flex flex-col gap-3">
                    <label className="text-sm font-medium text-white/80" htmlFor="email">
                      Email
                    </label>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        id="email"
                        name="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="you@company.com"
                        className="w-full rounded-full border border-white/15 bg-[#0B0B0F] px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none ring-0 transition focus:border-white/25 focus:outline-none focus:ring-2 focus:ring-[#F5C97A]/25"
                      />
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-[#0B0B0F] shadow-[0_0_0_1px_rgba(245,201,122,0.25),0_18px_48px_rgba(245,201,122,0.18)] transition hover:shadow-[0_0_0_1px_rgba(245,201,122,0.35),0_24px_60px_rgba(245,201,122,0.22)]"
                        style={{ backgroundColor: ACCENT }}
                      >
                        Request invite <ArrowRight className="ml-2 h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-xs text-white/50">
                      No spam. One email when we’re ready, plus occasional updates if you opt in later.
                    </p>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold">
                Content <span style={{ color: ACCENT }}>Flywheel</span>
              </p>
              <p className="mt-1 text-sm text-white/60">
                A compounding content system for creators & founders.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 p-2 text-white/80 transition hover:border-white/25 hover:bg-white/10"
              >
                <Github className="h-5 w-5" />
                <span className="sr-only">GitHub</span>
              </Link>
              <Link
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 p-2 text-white/80 transition hover:border-white/25 hover:bg-white/10"
              >
                <Twitter className="h-5 w-5" />
                <span className="sr-only">Twitter</span>
              </Link>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-white/50 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Content Flywheel. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href="#" className="transition-colors hover:text-white/80">
                Privacy
              </Link>
              <Link href="#" className="transition-colors hover:text-white/80">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
