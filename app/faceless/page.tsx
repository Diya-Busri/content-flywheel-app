import type { Metadata } from "next";
import Link from "next/link";
import { LightNavbar } from "@/components/marketing/light-navbar";
import { LightFooter } from "@/components/marketing/light-footer";

const SITE_URL = "https://contentflywheel.co.uk";

export const metadata: Metadata = {
  title: "Build a Faceless Digital Product Business | Content Flywheel",
  description:
    "Create and sell digital products online — without ever showing your face. AI-powered tools generate your content, videos, and marketing for you.",
  alternates: { canonical: `${SITE_URL}/faceless` },
  openGraph: {
    title: "Build a Faceless Digital Product Business | Content Flywheel",
    description: "Create ebooks, templates, and courses with AI. Sell them online. No camera. No face. No personal brand required.",
    url: `${SITE_URL}/faceless`,
    images: [{ url: `${SITE_URL}/og-faceless.png`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Build a Faceless Digital Product Business",
    description: "AI tools + storefront + marketplace. No face required.",
  },
  keywords: ["faceless digital products", "sell digital products without showing face", "faceless creator business", "faceless youtube", "anonymous creator", "AI digital products"],
};

const steps = [
  {
    emoji: "🤖",
    title: "AI writes & designs your product",
    desc: "Type a topic. The AI generates a full ebook, planner, or template — with a professional cover. You never need to write a word or design a graphic.",
  },
  {
    emoji: "🏪",
    title: "Your branded store goes live instantly",
    desc: "Publish to a branded storefront under your chosen brand name — not your face. Use a logo, a niche, a vibe. No personal photos needed.",
  },
  {
    emoji: "🎬",
    title: "AI creates your marketing videos",
    desc: "Generate voiceover-driven promotional videos with AI. No camera. No recording. No editing. Just scroll-stopping content ready to post.",
  },
  {
    emoji: "🛍️",
    title: "The marketplace brings the buyers",
    desc: "Your products appear in the Content Flywheel marketplace — buyers come to you. No audience required to get your first sale.",
  },
  {
    emoji: "📧",
    title: "Automated emails do the selling",
    desc: "Set up email sequences once. They nurture, follow up, and convert on autopilot — while you do nothing.",
  },
  {
    emoji: "💰",
    title: "Stripe pays you automatically",
    desc: "Every sale goes straight to your bank. 2% platform fee. No chasing payments. No invoices. Just income.",
  },
];

const niches = [
  { emoji: "💪", label: "Fitness & Wellness", examples: "Workout plans, meal prep guides, habit trackers" },
  { emoji: "💰", label: "Finance & Investing", examples: "Budget templates, savings trackers, crypto guides" },
  { emoji: "📱", label: "Social Media Growth", examples: "Caption packs, content calendars, TikTok playbooks" },
  { emoji: "🎓", label: "Study & Productivity", examples: "Note templates, revision planners, focus guides" },
  { emoji: "🏠", label: "Home & Lifestyle", examples: "Cleaning schedules, home organiser bundles" },
  { emoji: "💼", label: "Business & Side Hustles", examples: "Business plan templates, invoice kits, pricing guides" },
  { emoji: "✍️", label: "Writing & Journaling", examples: "Journal prompts, writing templates, story frameworks" },
  { emoji: "🌿", label: "Mental Health & Mindset", examples: "Anxiety workbooks, affirmation packs, mindset guides" },
];

const faqs = [
  {
    q: "Do I need any followers to start?",
    a: "No. The Content Flywheel marketplace brings buyers to your products without you needing an existing audience. Many creators make their first sale within days of publishing.",
  },
  {
    q: "Do I need any design or writing skills?",
    a: "No. The AI handles product creation from start to finish — writing, formatting, and cover design. You just pick a topic and click generate.",
  },
  {
    q: "Can I use a brand name instead of my real name?",
    a: "Yes. Your store is fully branded however you like — business name, logo, tagline. Your real name, face, and identity are never required or displayed.",
  },
  {
    q: "How do I market without showing my face?",
    a: "Content Flywheel generates AI marketing videos with voiceovers and stock visuals — no camera needed. You can also use text posts, Pinterest pins, and SEO traffic from your marketplace listing.",
  },
  {
    q: "What kinds of products can I sell?",
    a: "Ebooks, PDF guides, planners, templates, workbooks, mini-courses, prompt packs — all digital, all downloadable, all created with AI inside Content Flywheel.",
  },
  {
    q: "How much does it cost?",
    a: "£29/month (or £19/month on the annual plan), plus 2% on sales. No hidden fees. Cancel anytime.",
  },
];

export default function FacelessPage() {
  return (
    <div style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", background: "#fff" }}>
      <LightNavbar />

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section style={{ background: "#0B0B0F", padding: "100px 24px 80px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "999px", padding: "6px 16px", marginBottom: "28px" }}>
          <span style={{ fontSize: "14px" }}>🎭</span>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#f97316", letterSpacing: "0.03em" }}>FACELESS CREATOR BUSINESS</span>
        </div>

        <h1 style={{ margin: "0 0 20px", fontSize: "clamp(36px,6vw,64px)", fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.1, maxWidth: "800px", marginLeft: "auto", marginRight: "auto" }}>
          Build a Digital Product Business.<br />
          <span style={{ color: "#f97316" }}>No Face Required.</span>
        </h1>

        <p style={{ margin: "0 auto 40px", fontSize: "clamp(16px,2.5vw,20px)", color: "#9ca3af", maxWidth: "560px", lineHeight: 1.6 }}>
          AI creates your products. AI makes your videos. Your branded store sells around the clock. You stay completely anonymous.
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/sign-up"
            style={{ display: "inline-block", padding: "16px 36px", background: "#f97316", color: "#fff", fontWeight: 800, fontSize: "16px", borderRadius: "14px", textDecoration: "none" }}
          >
            Start for free →
          </Link>
          <Link
            href="/marketplace"
            style={{ display: "inline-block", padding: "16px 36px", background: "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 700, fontSize: "16px", borderRadius: "14px", textDecoration: "none", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            Browse the marketplace
          </Link>
        </div>

        {/* trust strip */}
        <div style={{ marginTop: "52px", display: "flex", gap: "28px", justifyContent: "center", flexWrap: "wrap" }}>
          {["No camera ever", "No personal brand", "No audience needed", "AI does the work"].map((t) => (
            <span key={t} style={{ fontSize: "13px", color: "#6b7280", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#f97316", fontWeight: 800 }}>✓</span> {t}
            </span>
          ))}
        </div>
      </section>

      {/* ── Problem ────────────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 24px", maxWidth: "720px", margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ margin: "0 0 16px", fontSize: "clamp(24px,4vw,36px)", fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>
          Most platforms assume you want to be famous.
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: "17px", color: "#6b7280", lineHeight: 1.7 }}>
          Every creator platform shows smiling founder faces and tells you to build a personal brand. But what if you don&apos;t want to be on camera? What if you value your privacy? What if you just want income — not fame?
        </p>
        <p style={{ margin: 0, fontSize: "17px", color: "#111827", fontWeight: 700, lineHeight: 1.7 }}>
          Content Flywheel was built for people who want to earn from their knowledge — without sacrificing their anonymity.
        </p>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section style={{ background: "#f9fafb", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "56px" }}>
            <h2 style={{ margin: "0 0 12px", fontSize: "clamp(26px,4vw,40px)", fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>
              How the faceless stack works
            </h2>
            <p style={{ margin: 0, fontSize: "17px", color: "#6b7280" }}>Six steps, all inside one platform, all without a camera.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
            {steps.map((step, i) => (
              <div key={i} style={{ background: "#fff", borderRadius: "16px", padding: "28px", border: "1px solid #e5e7eb", position: "relative" }}>
                <div style={{ position: "absolute", top: "20px", right: "20px", fontSize: "11px", fontWeight: 800, color: "#f97316", background: "rgba(249,115,22,0.1)", borderRadius: "999px", padding: "3px 10px" }}>
                  Step {i + 1}
                </div>
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>{step.emoji}</div>
                <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 800, color: "#111827" }}>{step.title}</h3>
                <p style={{ margin: 0, fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Niches ─────────────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <h2 style={{ margin: "0 0 12px", fontSize: "clamp(26px,4vw,40px)", fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>
              Any niche. Completely anonymous.
            </h2>
            <p style={{ margin: 0, fontSize: "17px", color: "#6b7280" }}>These are the best-selling faceless digital product niches on our marketplace right now.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px" }}>
            {niches.map((n) => (
              <div key={n.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px", padding: "20px" }}>
                <div style={{ fontSize: "28px", marginBottom: "8px" }}>{n.emoji}</div>
                <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 800, color: "#111827" }}>{n.label}</p>
                <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>{n.examples}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features callout ───────────────────────────────────────────────── */}
      <section style={{ background: "#0B0B0F", padding: "80px 24px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ margin: "0 0 12px", fontSize: "clamp(26px,4vw,40px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
            Everything you need. Nothing that exposes you.
          </h2>
          <p style={{ margin: "0 auto 48px", fontSize: "17px", color: "#9ca3af", maxWidth: "560px", lineHeight: 1.6 }}>
            Every tool in Content Flywheel works without a face, a following, or a personal brand.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px", textAlign: "left" }}>
            {[
              { icon: "🤖", title: "AI Product Builder", desc: "Generates complete ebooks, planners, and templates from a single prompt. No writing, no design." },
              { icon: "🎬", title: "AI Video Generator", desc: "Voiceover videos with stock visuals. No camera. No recording. Ready to post on TikTok or YouTube." },
              { icon: "🏪", title: "Branded Storefront", desc: "Your store runs under a brand name and logo — never tied to your real identity." },
              { icon: "🛍️", title: "Built-in Marketplace", desc: "Buyers find your products on the Content Flywheel marketplace. No audience required." },
              { icon: "📧", title: "Automated Email Sequences", desc: "Set once, run forever. Nurture and convert buyers while you're offline." },
              { icon: "📊", title: "Analytics Dashboard", desc: "See exactly where your sales come from — all without a single follower." },
            ].map((f) => (
              <div key={f.title} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "24px" }}>
                <div style={{ fontSize: "24px", marginBottom: "10px" }}>{f.icon}</div>
                <p style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 800, color: "#fff" }}>{f.title}</p>
                <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing strip ──────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 24px", textAlign: "center" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: "clamp(26px,4vw,40px)", fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>
          Simple pricing. No surprises.
        </h2>
        <p style={{ margin: "0 auto 40px", fontSize: "17px", color: "#6b7280", maxWidth: "480px" }}>
          One plan. Everything included. Just 2% on sales — lower than any competitor.
        </p>
        <div style={{ display: "flex", gap: "20px", justifyContent: "center", flexWrap: "wrap" }}>
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "20px", padding: "32px 40px", minWidth: "240px" }}>
            <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Monthly</p>
            <p style={{ margin: "0 0 16px" }}><span style={{ fontSize: "48px", fontWeight: 900, color: "#111827" }}>£29</span><span style={{ color: "#9ca3af", fontSize: "16px" }}>/mo</span></p>
            <Link href="/sign-up" style={{ display: "block", padding: "12px 24px", background: "#111827", color: "#fff", fontWeight: 700, borderRadius: "10px", textDecoration: "none" }}>Get started</Link>
          </div>
          <div style={{ background: "#0B0B0F", border: "2px solid #f97316", borderRadius: "20px", padding: "32px 40px", minWidth: "240px", position: "relative" }}>
            <div style={{ position: "absolute", top: "-14px", left: "50%", transform: "translateX(-50%)", background: "#f97316", color: "#fff", fontSize: "11px", fontWeight: 800, borderRadius: "999px", padding: "4px 14px", whiteSpace: "nowrap" }}>
              ⭐ Most popular
            </div>
            <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Annual</p>
            <p style={{ margin: "0 0 4px" }}><span style={{ fontSize: "48px", fontWeight: 900, color: "#fff" }}>£19</span><span style={{ color: "#9ca3af", fontSize: "16px" }}>/mo</span></p>
            <p style={{ margin: "0 0 16px", fontSize: "12px", color: "#6b7280" }}>Save 34% — 4 months free</p>
            <Link href="/sign-up" style={{ display: "block", padding: "12px 24px", background: "#f97316", color: "#fff", fontWeight: 700, borderRadius: "10px", textDecoration: "none" }}>Get started</Link>
          </div>
        </div>
        <p style={{ margin: "24px 0 0", fontSize: "13px", color: "#9ca3af" }}>+ 2% on sales. Cancel anytime. No hidden fees.</p>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section style={{ background: "#f9fafb", padding: "80px 24px" }}>
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          <h2 style={{ margin: "0 0 48px", fontSize: "clamp(26px,4vw,36px)", fontWeight: 800, color: "#111827", textAlign: "center", letterSpacing: "-0.02em" }}>
            Frequently asked questions
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {faqs.map((faq) => (
              <div key={faq.q} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px", padding: "24px" }}>
                <p style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 800, color: "#111827" }}>{faq.q}</p>
                <p style={{ margin: 0, fontSize: "14px", color: "#6b7280", lineHeight: 1.7 }}>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section style={{ background: "#0B0B0F", padding: "100px 24px", textAlign: "center" }}>
        <h2 style={{ margin: "0 0 16px", fontSize: "clamp(28px,5vw,48px)", fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>
          Ready to build your<br /><span style={{ color: "#f97316" }}>faceless income stream?</span>
        </h2>
        <p style={{ margin: "0 auto 40px", fontSize: "18px", color: "#9ca3af", maxWidth: "480px", lineHeight: 1.6 }}>
          Join creators building anonymous digital product businesses with AI — no face, no following, no fuss.
        </p>
        <Link
          href="/sign-up"
          style={{ display: "inline-block", padding: "18px 44px", background: "#f97316", color: "#fff", fontWeight: 800, fontSize: "18px", borderRadius: "14px", textDecoration: "none" }}
        >
          Start building today →
        </Link>
        <p style={{ margin: "20px 0 0", fontSize: "13px", color: "#6b7280" }}>
          From £19/month. 2% on sales. Cancel anytime.
        </p>

        <div style={{ marginTop: "48px" }}>
          <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#6b7280" }}>Want to understand the full model first?</p>
          <Link href="/blog/faceless-creator" style={{ color: "#f97316", fontSize: "14px", fontWeight: 700, textDecoration: "none" }}>
            Read: How to build a faceless digital product business in 2026 →
          </Link>
        </div>
      </section>

      <LightFooter />
    </div>
  );
}
