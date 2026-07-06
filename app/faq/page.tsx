import Link from "next/link";
import { LegalPageLayout } from "@/components/legal-page-layout";

export const metadata = {
  title: "FAQ | Content Flywheel",
  description: "Answers to the most common questions about Content Flywheel.",
};

const FAQS = [
  {
    q: "What kind of digital products can I create?",
    a: "Ebooks, planners, workbooks, guides, templates, checklists: anything text and design based. You describe the topic and AI generates the full product including a cover.",
  },
  {
    q: "What are video credits, and how many do I get?",
    a: "Video credits power AI-generated videos on the platform, including promo clips and short-form content. Every new account gets 100 free credits on signup, which is enough for roughly 10 standard videos. Subscribers receive a monthly credit top-up, and additional packs are available if you need more.",
  },
  {
    q: "Who is Content Flywheel for?",
    a: "Creators, coaches, consultants, and anyone who wants to sell digital products. If you have knowledge worth packaging, this platform builds it for you. No tech skills needed.",
  },
  {
    q: "How do I sell products and get paid?",
    a: "You get a branded store at yourname.contentflywheel.co.uk. Payments go through Stripe directly to your bank, and we charge no per-sale fees.",
  },
  {
    q: "Are there any per-sale fees?",
    a: "No. Content Flywheel charges a flat monthly subscription. There are no per-sale fees. Whatever you earn from your products is yours.",
  },
  {
    q: "Is email marketing included?",
    a: "Yes. Collect subscribers and send email campaigns directly from Content Flywheel. No Mailchimp required.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from your dashboard settings at any time. Your subscription stays active until the end of the billing period.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes, you can sign up and start creating products immediately without a credit card. The trial gives you access to the core tools so you can see the value before subscribing.",
  },
  {
    q: "Do I need any design or coding skills?",
    a: "No. The AI handles product generation, cover design, and store setup. You just provide the topic and your branding.",
  },
  {
    q: "Can I use a custom domain for my store?",
    a: "Yes. You can connect your own domain to your Content Flywheel store from the settings page. Your default store URL is yourname.contentflywheel.co.uk.",
  },
];

export default function FAQPage() {
  return (
    <LegalPageLayout>
      <div className="mb-10">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-2">FAQ</p>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Frequently asked questions</h1>
        <p className="mt-3 text-slate-500 dark:text-slate-400">
          Can&apos;t find your answer?{" "}
          <Link href="/contact" className="text-amber-600 hover:text-amber-700 underline">
            Get in touch
          </Link>
          .
        </p>
      </div>

      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {FAQS.map((item) => (
          <details key={item.q} className="group py-5">
            <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-semibold text-slate-900 dark:text-white list-none">
              {item.q}
              <span className="shrink-0 text-slate-400 group-open:rotate-45 transition-transform text-xl leading-none">+</span>
            </summary>
            <p className="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
              {item.a}
            </p>
          </details>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 p-8">
        <p className="font-semibold text-slate-900 dark:text-white mb-1">Still have questions?</p>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Send us a message and we&apos;ll get back to you within 24 hours.
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-400 transition-colors"
        >
          Contact us
        </Link>
      </div>
    </LegalPageLayout>
  );
}
