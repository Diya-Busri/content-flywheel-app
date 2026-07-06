import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { LandingNavbar } from "@/components/marketing/landing-navbar";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { LandingAnimations } from "@/components/marketing/LandingAnimations";
import HeroSection from "@/components/marketing/HeroSection";
import { LandingAICoach } from "@/components/marketing/LandingAICoach";

export const metadata: Metadata = {
  title: "Content Flywheel — Create, Sell & Market Digital Products with AI",
  description:
    "Build digital products with AI, sell from your own store, and grow your audience — all from one platform. No third-party platforms needed.",
};

async function getPublicReviews(): Promise<{ text: string; name: string; rating?: number }[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("reviews")
    .select("review_text, rating, reviewer_name")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error || !data?.length) return [];
  return data
    .filter((r) => r.review_text?.trim())
    .map((r) => ({
      text: r.review_text!.trim(),
      name: r.reviewer_name?.trim() || "Verified User",
      rating: r.rating ?? 5,
    }));
}

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  const reviews = await getPublicReviews();
  return (
    <div className="min-h-screen bg-[#0a0a0a] overflow-x-hidden">
      <LandingNavbar />
      <HeroSection />
      <LandingAnimations reviews={reviews} />
      <LandingAICoach />

      {/* Enhanced footer */}
      <footer className="border-t border-white/10 bg-[#080808]">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-5">
            {/* Brand column */}
            <div className="lg:col-span-2">
              <span className="text-xl font-extrabold text-white">
                Content<span className="text-orange-500">Flywheel</span>
              </span>
              <p className="mt-3 text-sm text-white/40 max-w-xs leading-relaxed">
                Build, sell, and market digital products with AI. One platform, one price, everything connected.
              </p>
              {/* Social links */}
              <div className="flex items-center gap-3 mt-6">
                {[
                  { label: "X", href: "https://x.com/ContentFlywhee1", icon: "𝕏" },
                  { label: "TikTok", href: "https://tiktok.com/@contentflywheelofficial", icon: "T" },
                  { label: "Instagram", href: "https://instagram.com/content.flywheel", icon: "IG" },
                ].map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="w-9 h-9 rounded-xl border border-white/10 bg-white/[0.04] flex items-center justify-center text-xs font-bold text-white/40 hover:text-white hover:border-white/20 hover:bg-white/[0.08] transition-all"
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>

            {/* Product links */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-white/30 mb-5">Product</h4>
              <ul className="space-y-3 text-sm">
                {[
                  ["Features", "/features"],
                  ["How it Works", "/journey"],
                  ["Pricing", "/pricing"],
                  ["Marketplace", "/marketplace"],
                  ["Blog", "/blog"],
                ].map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="text-white/45 hover:text-white transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support links */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-white/30 mb-5">Support</h4>
              <ul className="space-y-3 text-sm">
                {[
                  ["FAQ", "/faq"],
                  ["Contact Us", "/contact"],
                  ["Selling Guide", "/selling-guide"],
                  ["Affiliate Programme", "/affiliates"],
                ].map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="text-white/45 hover:text-white transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal + CTA */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-white/30 mb-5">Legal</h4>
              <ul className="space-y-3 text-sm">
                {[
                  ["Terms & Conditions", "/terms"],
                  ["Privacy Policy", "/privacy"],
                  ["Refund Policy", "/refund-policy"],
                  ["Cookie Policy", "/cookie-policy"],
                ].map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="text-white/45 hover:text-white transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div className="mt-8">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-400 px-5 py-2.5 text-sm font-bold text-white transition-colors shadow-lg shadow-orange-500/20"
                >
                  Start free →
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-16 border-t border-white/[0.07] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-white/20">
              © 2026 Content Flywheel. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-xs text-white/20">
              <span>Made for creators, by creators</span>
              <span>·</span>
              <a href="mailto:contentflywheel@gmail.com" className="hover:text-white/50 transition-colors">
                contentflywheel@gmail.com
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
