import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Star } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ReviewsCarousel } from "@/components/marketing/reviews-carousel";
import { LandingNavbar } from "@/components/marketing/landing-navbar";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { LandingAnimations } from "@/components/marketing/LandingAnimations";

export const metadata: Metadata = {
  title: "Content Flywheel — Create & Sell Digital Products with AI",
  description:
    "Build ebooks, planners and templates with AI. Sell from your own store. Market with email sequences, affiliates and discount codes. All in one platform.",
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
  const reviews = await getPublicReviews();
  return (
    <div className="min-h-screen bg-[#0a0a0a] overflow-x-hidden">
      <LandingNavbar />
      <LandingAnimations reviews={reviews} />

      {/* Static footer — server rendered */}
      <footer className="border-t border-white/10 bg-black">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="col-span-1 sm:col-span-2 lg:col-span-1">
              <span className="text-lg font-extrabold text-white">
                Content<span className="text-orange-500">Flywheel</span>
              </span>
              <p className="mt-3 text-sm text-white/40 max-w-xs leading-relaxed">
                The all-in-one platform for creators who want to build and sell digital products without the faff.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-white/30 mb-4">Product</h4>
              <ul className="space-y-2.5 text-sm">
                {[["Features", "/#features"], ["How it Works", "/#how-it-works"], ["Pricing", "/pricing"]].map(([label, href]) => (
                  <li key={label}><Link href={href} className="text-white/50 hover:text-white transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-white/30 mb-4">Legal</h4>
              <ul className="space-y-2.5 text-sm">
                {[["Terms", "/terms"], ["Privacy", "/privacy"], ["Refund Policy", "/refund-policy"]].map(([label, href]) => (
                  <li key={label}><Link href={href} className="text-white/50 hover:text-white transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-white/30 mb-4">Contact</h4>
              <a href="mailto:hello@contentflywheel.co.uk" className="text-sm text-orange-400 hover:text-orange-300 transition-colors">
                hello@contentflywheel.co.uk
              </a>
            </div>
          </div>
          <div className="mt-12 border-t border-white/10 pt-8 text-center text-sm text-white/20">
            © 2026 Content Flywheel. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
