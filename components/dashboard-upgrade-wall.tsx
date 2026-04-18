"use client";

import { useState } from "react";
import { Check, Loader2, Zap, Star, Shield } from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";

const FEATURES = [
  "AI video creation & TikTok scripts",
  "Print-on-demand product designer",
  "AI digital product creator (ebooks, planners)",
  "Branded creator store with custom URL",
  "Stripe payments — 0% platform fees",
  "Unlimited digital products",
  "Email marketing & subscriber list",
  "Automated drip sequences",
  "Affiliate programme with referral tracking",
  "Discount codes & analytics",
];

const PLANS = [
  { name: "Monthly", price: "£29", period: "/month", subtext: "Billed monthly. Cancel anytime.", plan: "monthly" as const, highlighted: false },
  { name: "Annual", price: "£19", period: "/month", subtext: "£228 billed annually.", plan: "yearly" as const, highlighted: true, badge: "Most popular", saving: "Save 34%" },
];

export function DashboardUpgradeWall({ userEmail }: { userEmail: string }) {
  const [loadingPlan, setLoadingPlan] = useState<"monthly" | "yearly" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async (plan: "monthly" | "yearly") => {
    setLoadingPlan(plan);
    setError(null);
    try {
      const res = await fetch("/api/stripe-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({})) as { url?: string; error?: string };
      if (res.status === 401) { window.location.href = "/sign-in"; return; }
      if (res.ok && typeof data.url === "string" && data.url.startsWith("http")) {
        window.location.assign(data.url); return;
      }
      setError(data.error || "Checkout failed. Please try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Minimal top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <span className="font-bold text-white text-sm">Content Flywheel</span>
        <div className="flex items-center gap-4">
          {userEmail && <span className="text-white/30 text-xs hidden sm:block">{userEmail}</span>}
          <SignOutButton>
            <button className="text-white/40 hover:text-white/70 text-xs transition-colors">Sign out</button>
          </SignOutButton>
        </div>
      </div>

      <main className="flex-1 flex flex-col items-center justify-start px-4 py-16">
        <div className="w-full max-w-3xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-semibold mb-6">
              <Zap className="w-3.5 h-3.5" /> Unlock your dashboard
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-white">
              One plan.{" "}
              <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                Everything included.
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-base text-white/40">
              No per-sale fees. No hidden charges. No extra tools to pay for.
            </p>
          </div>

          {/* Pricing cards */}
          <div className="grid gap-5 sm:grid-cols-2 mb-10">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`relative rounded-2xl p-7 ${
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
                <h2 className="text-base font-bold text-white mb-1">{p.name}</h2>
                {p.saving && (
                  <span className="inline-block mb-3 px-2.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold">
                    {p.saving}
                  </span>
                )}
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-5xl font-extrabold text-white">{p.price}</span>
                  <span className="text-white/40 text-base">{p.period}</span>
                </div>
                <p className="text-white/30 text-sm mb-5">{p.subtext}</p>
                <button
                  type="button"
                  disabled={loadingPlan !== null}
                  onClick={() => handleSubscribe(p.plan)}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-60 ${
                    p.highlighted
                      ? "bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-500/30"
                      : "bg-white/10 hover:bg-white/15 text-white border border-white/10"
                  }`}
                >
                  {loadingPlan === p.plan ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Redirecting…
                    </span>
                  ) : (
                    "Get started →"
                  )}
                </button>
                <p className="text-center text-xs text-white/20 mt-3">No per-sale fees. Cancel anytime.</p>
              </div>
            ))}
          </div>

          {error && (
            <p className="text-center text-sm text-red-400 mb-6">{error}</p>
          )}

          {/* Features */}
          <div className="grid sm:grid-cols-2 gap-2 mb-8">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-start gap-3 px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <Check className="w-4 h-4 shrink-0 mt-0.5 text-orange-500" />
                <span className="text-sm text-white/50">{f}</span>
              </div>
            ))}
          </div>

          {/* Trust */}
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { icon: Shield, title: "Secure checkout", desc: "Powered by Stripe" },
              { icon: Zap, title: "Instant access", desc: "Live the moment you subscribe" },
              { icon: Star, title: "Cancel anytime", desc: "No lock-in" },
            ].map((t) => (
              <div key={t.title} className="text-center px-4 py-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <t.icon className="w-5 h-5 text-orange-500 mx-auto mb-2" />
                <p className="font-bold text-white text-xs mb-0.5">{t.title}</p>
                <p className="text-white/30 text-xs">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
