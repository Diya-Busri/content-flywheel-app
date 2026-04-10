import { LegalPageLayout } from "@/components/legal-page-layout";

export const metadata = {
  title: "Terms of Service | Content Flywheel",
  description: "Terms of Service for Content Flywheel",
};

export default function TermsPage() {
  return (
    <LegalPageLayout>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Last updated: April 2026
      </p>

      <div className="mt-10 space-y-10 text-slate-600 dark:text-slate-400">
        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Acceptance of Terms
          </h2>
          <p className="mt-3 leading-relaxed">
            By accessing or using Content Flywheel (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Description of Service
          </h2>
          <p className="mt-3 leading-relaxed">
            Content Flywheel is an all-in-one platform for creators to build and sell digital products. The Service includes AI-assisted product creation (ebooks, planners, templates and similar digital goods), a storefront to sell products, order management, email marketing sequences, affiliate programme management, discount codes, and customer reviews. Features may evolve over time.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            User Accounts &amp; Registration
          </h2>
          <p className="mt-3 leading-relaxed">
            You must create an account to use the Service. You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account. You must provide accurate information and notify us immediately of any unauthorised access or breach.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Subscription &amp; Payment Terms
          </h2>
          <p className="mt-3 leading-relaxed">
            The Service is offered on a subscription basis, billed monthly or annually. Fees are charged in advance at the start of each billing period. By subscribing, you authorise us to charge your payment method on a recurring basis until you cancel.
          </p>
          <p className="mt-3 leading-relaxed">
            Prices are listed in GBP (£). We reserve the right to change pricing with reasonable notice. Continued use after a price change constitutes acceptance of the new price.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Cancellation
          </h2>
          <p className="mt-3 leading-relaxed">
            You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of the current billing period — you will retain access until then. We do not provide partial refunds for unused time within a billing period.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Creator Responsibilities
          </h2>
          <p className="mt-3 leading-relaxed">
            As a creator selling digital products through the Service, you are responsible for:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
            <li>Ensuring your products comply with applicable laws and regulations</li>
            <li>Accurately describing your products to buyers</li>
            <li>Fulfilling orders and handling customer queries in a timely manner</li>
            <li>Ensuring you have the rights to sell any content you upload</li>
            <li>Complying with your own tax obligations on sales revenue</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Prohibited Uses
          </h2>
          <p className="mt-3 leading-relaxed">
            You may not use the Service to sell or distribute: illegal content; content that infringes copyright, trademark, or other intellectual property rights; counterfeit or misleading products; adult content; or anything that violates applicable law. We may suspend or terminate accounts that violate these prohibitions without refund.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Intellectual Property
          </h2>
          <p className="mt-3 leading-relaxed">
            <strong className="text-slate-900 dark:text-white">Your content:</strong> You retain full ownership of the digital products you create and sell through the Service. We do not claim any rights to your products or content.
          </p>
          <p className="mt-3 leading-relaxed">
            <strong className="text-slate-900 dark:text-white">Our platform:</strong> Content Flywheel — including the software, design, branding, and documentation — is owned by us or our licensors. You may not copy, modify, or reverse-engineer any part of the platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Termination
          </h2>
          <p className="mt-3 leading-relaxed">
            We may suspend or terminate your access for violation of these terms, non-payment, or conduct we deem harmful to other users or the platform. Upon termination, your right to use the Service ceases immediately.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Disclaimers &amp; Limitation of Liability
          </h2>
          <p className="mt-3 leading-relaxed">
            The Service is provided &quot;as is&quot; and &quot;as available.&quot; We do not guarantee uninterrupted access or that AI-generated content will meet any particular standard or expectation. To the maximum extent permitted by law, we are not liable for indirect, incidental, special, or consequential damages, or for any loss of revenue, data, or profits arising from your use of the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Governing Law
          </h2>
          <p className="mt-3 leading-relaxed">
            These terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Contact
          </h2>
          <p className="mt-3 leading-relaxed">
            Questions about these terms? Contact us at{" "}
            <a href="mailto:contentflywheel@gmail.com" className="text-orange-500 hover:text-orange-400">
              contentflywheel@gmail.com
            </a>.
          </p>
        </section>
      </div>
    </LegalPageLayout>
  );
}
