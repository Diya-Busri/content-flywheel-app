import type { Metadata } from "next";
import Link from "next/link";
import { LightNavbar } from "@/components/marketing/light-navbar";
import { LightFooter } from "@/components/marketing/light-footer";

const SITE_URL = "https://contentflywheel.co.uk";

export const metadata: Metadata = {
  title: "100 Product Challenge | Content Flywheel",
  description:
    "Submit your digital product and get a two-part marketing series built with Content Flywheel. Not a competition — every eligible submission joins the production queue.",
  alternates: { canonical: `${SITE_URL}/challenge` },
  openGraph: {
    title: "100 Product Challenge | Content Flywheel",
    description: "Submit your product. Every eligible submission is added to the production queue — not a competition, no ranking.",
    url: `${SITE_URL}/challenge`,
  },
};

const steps = [
  {
    num: "1",
    title: "Submit your product",
    desc: "Upload the exact product you want me to promote and tell me what it does.",
  },
  {
    num: "2",
    title: "Choose public or anonymous",
    desc: "You decide whether your creator and product identity can be shown publicly.",
  },
  {
    num: "3",
    title: "I create the marketing",
    desc: "I'll use Content Flywheel to create a marketing strategy, content ideas, hooks, scripts, carousels or other launch assets.",
  },
  {
    num: "4",
    title: "Follow the series",
    desc: "Your product will be featured across a two-part marketing series once it reaches production.",
  },
];

export default function ChallengePage() {
  return (
    <div style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", background: "#fff" }}>
      <LightNavbar />

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section style={{ background: "#0B0B0F", padding: "100px 24px 80px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "999px", padding: "6px 16px", marginBottom: "28px" }}>
          <span style={{ fontSize: "14px" }}>🏆</span>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#f97316", letterSpacing: "0.03em" }}>NOT A COMPETITION</span>
        </div>

        <h1 style={{ margin: "0 0 20px", fontSize: "clamp(32px,6vw,58px)", fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.1, maxWidth: "800px", marginLeft: "auto", marginRight: "auto" }}>
          Submit Your Product to the <span style={{ color: "#f97316" }}>100 Product Challenge</span>
        </h1>

        <p style={{ margin: "0 auto 12px", fontSize: "clamp(16px,2.5vw,20px)", color: "#9ca3af", maxWidth: "620px", lineHeight: 1.6 }}>
          I&apos;m using Content Flywheel to create marketing campaigns for 100 real digital products. Submit your
          product and it will be added to the production queue once it passes a basic eligibility review.
        </p>

        <p style={{ margin: "0 auto 40px", fontSize: "14px", color: "#f97316", fontWeight: 600 }}>
          Free to submit · Public or anonymous options available
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/challenge/submit"
            style={{ display: "inline-block", padding: "16px 36px", background: "#f97316", color: "#fff", fontWeight: 800, fontSize: "16px", borderRadius: "14px", textDecoration: "none" }}
          >
            Submit your product →
          </Link>
        </div>
      </section>

      {/* ── Core concept clarification ─────────────────────────────────────── */}
      <section style={{ padding: "72px 24px", maxWidth: "720px", margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ margin: "0 0 16px", fontSize: "clamp(22px,4vw,32px)", fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>
          Every eligible submission gets featured.
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: "16px", color: "#6b7280", lineHeight: 1.7 }}>
          There&apos;s no ranking and nothing to compete for. Once your submission passes a basic eligibility review,
          it joins the production queue — the same queue every other eligible product joins.
        </p>
        <p style={{ margin: "0 0 16px", fontSize: "16px", color: "#6b7280", lineHeight: 1.7 }}>
          Features may not be published in submission order, and publishing times will depend on demand and
          production capacity.
        </p>
        <p style={{ margin: 0, fontSize: "15px", color: "#9ca3af", lineHeight: 1.7 }}>
          A submission can only be rejected if it&apos;s incomplete, unsafe, unlawful, fraudulent, inappropriate,
          outside the challenge scope, or submitted by someone who doesn&apos;t own or have permission to use the
          product.
        </p>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section style={{ background: "#f9fafb", padding: "72px 24px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <h2 style={{ margin: "0 0 12px", fontSize: "clamp(24px,4vw,36px)", fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>
              How it works
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "20px" }}>
            {steps.map((step) => (
              <div key={step.num} style={{ background: "#fff", borderRadius: "16px", padding: "28px", border: "1px solid #e5e7eb" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(249,115,22,0.12)", color: "#f97316", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "16px", marginBottom: "16px" }}>
                  {step.num}
                </div>
                <h3 style={{ margin: "0 0 8px", fontSize: "17px", fontWeight: 700, color: "#111827" }}>{step.title}</h3>
                <p style={{ margin: 0, fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            ))}
          </div>

          <p style={{ textAlign: "center", margin: "36px 0 0", fontSize: "14px", color: "#9ca3af" }}>
            Publishing times will depend on the number of products currently in the queue.
          </p>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 24px", textAlign: "center" }}>
        <h2 style={{ margin: "0 0 16px", fontSize: "clamp(24px,4vw,36px)", fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>
          Ready to submit your product?
        </h2>
        <p style={{ margin: "0 0 32px", fontSize: "16px", color: "#6b7280" }}>Takes a few minutes. No account required.</p>
        <Link
          href="/challenge/submit"
          style={{ display: "inline-block", padding: "16px 36px", background: "#f97316", color: "#fff", fontWeight: 800, fontSize: "16px", borderRadius: "14px", textDecoration: "none" }}
        >
          Submit your product →
        </Link>
      </section>

      <LightFooter />
    </div>
  );
}
