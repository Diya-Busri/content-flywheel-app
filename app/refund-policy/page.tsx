import { LegalPageLayout } from "@/components/legal-page-layout";

export const metadata = {
  title: "Refund Policy | Content Flywheel",
  description: "Refund Policy for Content Flywheel",
};

export default function RefundPolicyPage() {
  return (
    <LegalPageLayout>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
        Refund Policy
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Last updated: April 2026
      </p>

      <div className="mt-10 space-y-8 text-slate-600 dark:text-slate-400">
        <section className="rounded-xl border-2 border-orange-200 bg-orange-50 p-6 dark:border-orange-500/30 dark:bg-orange-500/10">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            14-Day Money-Back Guarantee
          </h2>
          <p className="mt-4 text-lg font-medium leading-relaxed text-slate-900 dark:text-white">
            If you&apos;re not happy within the first 14 days of your subscription, contact us and we&apos;ll refund you — no questions asked.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            How to Request a Refund
          </h2>
          <p className="mt-3 leading-relaxed">
            Email us at{" "}
            <a href="mailto:contentflywheel@gmail.com" className="font-medium text-orange-500 hover:text-orange-400">
              contentflywheel@gmail.com
            </a>{" "}
            within 14 days of your initial subscription payment. Include the email address on your account and we&apos;ll process your refund within 5 business days.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            After 14 Days
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
            <li><strong className="text-slate-900 dark:text-white">Subscription renewals</strong> are non-refundable once charged</li>
            <li><strong className="text-slate-900 dark:text-white">Cancellation</strong> stops future charges but does not refund the current period — you keep access until the period ends</li>
            <li>We do not offer pro-rata refunds for unused time within a billing period</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Exceptions (Always Refunded)
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
            <li><strong className="text-slate-900 dark:text-white">Duplicate charges</strong> — if you were charged twice in error, we will refund the duplicate immediately</li>
            <li><strong className="text-slate-900 dark:text-white">Extended service outage</strong> — if the platform is unavailable for more than 24 consecutive hours, you may request a pro-rata credit</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Digital Products Sold by Creators
          </h2>
          <p className="mt-3 leading-relaxed">
            Content Flywheel is a platform that enables creators to sell their own digital products. Refund policies for individual products are set by the creator who sold them. If you purchased a digital product from a creator&apos;s store, please contact them directly. Content Flywheel is not responsible for refunds on third-party creator products.
          </p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-center text-slate-600 dark:text-slate-400">
            Questions? We&apos;re happy to help.{" "}
            <a
              href="mailto:contentflywheel@gmail.com"
              className="font-semibold text-orange-500 hover:text-orange-400"
            >
              contentflywheel@gmail.com
            </a>
          </p>
        </section>
      </div>
    </LegalPageLayout>
  );
}
