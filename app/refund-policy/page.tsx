import { LegalPageLayout } from "@/components/legal-page-layout";

export const metadata = {
  title: "Refund Policy",
  description: "Refund Policy for Content Flywheel",
};

export default function RefundPolicyPage() {
  return (
    <LegalPageLayout>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
        Refund Policy
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Last updated: February 2026
      </p>

      <div className="mt-10 space-y-8 text-slate-600 dark:text-slate-400">
        <section className="rounded-xl border-2 border-slate-300 bg-slate-100 p-6 dark:border-slate-600 dark:bg-slate-800/50">
          <h2 className="text-2xl font-bold uppercase tracking-tight text-slate-900 dark:text-white">
            No Refund Policy
          </h2>
          <p className="mt-4 text-lg font-medium leading-relaxed text-slate-900 dark:text-white">
            Content Flywheel operates a strict no-refund policy. All sales are final.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Why No Refunds?
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
            <li>AI video generation costs are incurred immediately when you generate content</li>
            <li>You receive instant value—all generated videos are yours to keep</li>
            <li>A free trial (3 videos) is available so you can test the service before purchase</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            What This Means
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
            <li><strong className="text-slate-900 dark:text-white">Subscription fees</strong> are non-refundable once paid</li>
            <li><strong className="text-slate-900 dark:text-white">Credit purchases</strong> are non-refundable</li>
            <li><strong className="text-slate-900 dark:text-white">Canceling</strong> your subscription stops future charges but does not refund past payments</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Exceptions
          </h2>
          <p className="mt-3 leading-relaxed">
            We may make exceptions in limited circumstances:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
            <li><strong className="text-slate-900 dark:text-white">Technical issues</strong> that prevented you from accessing the service (evaluated case-by-case)</li>
            <li><strong className="text-slate-900 dark:text-white">Duplicate charges</strong> (refunded within 48 hours once verified)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Before You Subscribe
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
            <li>Test our free tier first (3 videos, no credit card required)</li>
            <li>Review our features and limits on the pricing page</li>
            <li>Contact us with any questions:{" "}
              <a
                href="mailto:contentflywheel@gmail.com"
                className="font-medium text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300"
              >
                contentflywheel@gmail.com
              </a>
            </li>
          </ul>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-center text-slate-600 dark:text-slate-400">
            Questions about refunds? Contact us at{" "}
            <a
              href="mailto:contentflywheel@gmail.com"
              className="font-semibold text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300"
            >
              contentflywheel@gmail.com
            </a>
          </p>
        </section>
      </div>
    </LegalPageLayout>
  );
}
