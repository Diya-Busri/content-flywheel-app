import { LegalPageLayout } from "@/components/legal-page-layout";

export const metadata = {
  title: "Terms of Service",
  description: "Terms of Service for Content Flywheel",
};

export default function TermsPage() {
  return (
    <LegalPageLayout>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Last updated: February 2026
      </p>

      <div className="mt-10 space-y-10 text-slate-600 dark:text-slate-400">
        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Acceptance of Terms
          </h2>
          <p className="mt-3 leading-relaxed">
            By accessing or using Content Flywheel (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Description of Service
          </h2>
          <p className="mt-3 leading-relaxed">
            Content Flywheel provides AI-powered video generation for social media. The Service helps users create conversion-focused videos for digital products, TikTok Shop, affiliate marketing, and related use cases. Features include script generation, video creation, compliance checking, and platform-ready captions.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            User Accounts & Registration
          </h2>
          <p className="mt-3 leading-relaxed">
            You must create an account to use certain features. You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. You must provide accurate information and notify us of any unauthorized use.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Payment Terms
          </h2>
          <p className="mt-3 leading-relaxed">
            The Service is offered on a subscription basis and/or credit-based purchases. Fees are billed in advance according to your chosen plan. By subscribing or purchasing credits, you agree to the pricing and billing terms in effect at the time of purchase.
          </p>
          <p className="mt-3 leading-relaxed font-medium text-slate-900 dark:text-white">
            NO REFUNDS POLICY: All sales are final. We do not offer refunds for subscription fees or credit purchases. This includes partial refunds, unused credits, or cancellations. Please review our Refund Policy and test our free tier before purchasing.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Prohibited Uses
          </h2>
          <p className="mt-3 leading-relaxed">
            You may not use the Service to create, upload, or distribute: illegal content or content that violates applicable law; content that infringes copyright, trademark, or other intellectual property rights; content that violates platform policies despite our compliance tools; or misleading, defamatory, or harmful content. We may suspend or terminate accounts that violate these prohibitions.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Intellectual Property
          </h2>
          <p className="mt-3 leading-relaxed">
            <strong className="text-slate-900 dark:text-white">Your content:</strong> You retain ownership of content you upload and of videos and scripts generated for you. We do not claim ownership of your generated output.
          </p>
          <p className="mt-3 leading-relaxed">
            <strong className="text-slate-900 dark:text-white">Our platform:</strong> Content Flywheel, including the software, design, branding, and documentation, is owned by us or our licensors. You may not copy, modify, or reverse-engineer the platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            API Usage & Limits
          </h2>
          <p className="mt-3 leading-relaxed">
            Use of the Service is subject to fair use and any usage limits associated with your plan. We may throttle or limit usage to ensure service quality and prevent abuse.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Termination of Service
          </h2>
          <p className="mt-3 leading-relaxed">
            You may cancel your account or subscription at any time. We may suspend or terminate your access for violation of these terms, non-payment, or at our discretion with notice. Upon termination, your right to use the Service ceases. No refunds will be provided for any remaining period or unused credits.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Disclaimers & Limitation of Liability
          </h2>
          <p className="mt-3 leading-relaxed">
            The Service is provided &quot;as is&quot; and &quot;as available.&quot; We disclaim all warranties, express or implied. We do not guarantee that generated content will meet platform policies or achieve any particular result. To the maximum extent permitted by law, we are not liable for indirect, incidental, special, or consequential damages, or for any loss of revenue or data arising from your use of the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Governing Law
          </h2>
          <p className="mt-3 leading-relaxed">
            These terms are governed by the laws of the jurisdiction in which we operate, without regard to conflict of law principles. Any disputes shall be resolved in the courts of that jurisdiction.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Contact
          </h2>
          <p className="mt-3 leading-relaxed">
            Questions? Contact us at{" "}
            <a href="mailto:contentflywheel@gmail.com" className="text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300">
              contentflywheel@gmail.com
            </a>.
          </p>
        </section>
      </div>
    </LegalPageLayout>
  );
}
