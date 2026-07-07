import Link from "next/link";
import { LegalPageLayout } from "@/components/legal-page-layout";
import { CheckCircle, ArrowRight, Store, Zap, DollarSign, Share2 } from "lucide-react";

export const metadata = {
  title: "Selling Guide | Content Flywheel",
  description: "Everything you need to know about selling digital products on Content Flywheel.",
};

const STEPS = [
  {
    icon: Zap,
    step: "1",
    title: "Create your product",
    desc: "Describe your topic and AI generates a full digital product in seconds. Ebook, planner, guide, or template. Edit any section with one click.",
  },
  {
    icon: Store,
    step: "2",
    title: "Set up your store",
    desc: "Your branded storefront is created automatically at yourname.contentflywheel.co.uk. Connect Stripe and you&apos;re ready to take payments.",
  },
  {
    icon: Share2,
    step: "3",
    title: "Promote your product",
    desc: "Use the built-in marketing tools to generate TikTok scripts, Instagram captions, email sequences, and promo videos for your product.",
  },
  {
    icon: DollarSign,
    step: "4",
    title: "Get paid, keep everything",
    desc: "Stripe pays out directly to your bank. Content Flywheel charges no per-sale fees. Every penny you earn is yours.",
  },
];

const INCLUDED = [
  "Branded store URL (yourname.contentflywheel.co.uk)",
  "Custom domain support",
  "Stripe-powered checkout, no setup required",
  "Automatic PDF delivery on purchase",
  "Discount codes and promotional links",
  "Affiliate tracking for referral commissions",
  "Order dashboard with buyer details",
  "Email marketing to notify subscribers",
  "Analytics: revenue, views, conversions",
  "Marketplace listing for extra discovery",
];

export default function SellingGuidePage() {
  return (
    <LegalPageLayout>
      <div className="mb-10">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-2">Selling Guide</p>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          How to sell digital products on Content Flywheel
        </h1>
        <p className="mt-3 text-slate-500 dark:text-slate-400 max-w-xl">
          From idea to first sale in one afternoon. Here&apos;s exactly how it works.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 mb-12">
        {STEPS.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.step}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Step {s.step}</span>
              </div>
              <h2 className="font-semibold text-slate-900 dark:text-white mb-1">{s.title}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: s.desc }}
              />
            </div>
          );
        })}
      </div>

      <div className="mb-12">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
          Everything included in your subscription
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {INCLUDED.map((item) => (
            <div key={item} className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
              <span className="text-sm text-slate-700 dark:text-slate-300">{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 p-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          Ready to start selling?
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">
          Create your first product for free. No credit card required.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-400 transition-colors"
          >
            Get started free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:border-slate-400 transition-colors"
          >
            See pricing
          </Link>
        </div>
      </div>
    </LegalPageLayout>
  );
}
