import Link from "next/link";
import { LegalPageLayout } from "@/components/legal-page-layout";
import { Mail } from "lucide-react";

export const metadata = {
  title: "Affiliate Programme | Content Flywheel",
  description: "Earn commission by referring creators to Content Flywheel.",
};

export default function AffiliatesPage() {
  return (
    <LegalPageLayout>
      <div className="mb-10">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-2">Affiliates</p>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Affiliate Programme</h1>
        <p className="mt-3 text-slate-500 dark:text-slate-400 max-w-xl">
          Earn commission for every creator you refer to Content Flywheel.
        </p>
      </div>

      <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 p-10 text-center mb-8">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-500/20 mb-4">
          <span className="text-2xl">🚀</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Coming soon</h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto text-sm leading-relaxed">
          Our affiliate programme is in the works. We&apos;re building a way for you to earn recurring commission for every creator you refer.
        </p>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Want to be notified when it launches? Email us below.
        </p>
        <a
          href="mailto:contentflywheel@gmail.com?subject=Affiliate%20Programme%20Interest"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-400 transition-colors"
        >
          <Mail className="h-4 w-4" />
          Express interest
        </a>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
          Already earning commission through your store?
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          If you have a Content Flywheel account, you can already generate affiliate links for your own products and earn commission from referrals via your store.
        </p>
        <Link
          href="/sign-up"
          className="inline-flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400 hover:underline"
        >
          Create your account
        </Link>
      </div>
    </LegalPageLayout>
  );
}
