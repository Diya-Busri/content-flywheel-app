import { LegalPageLayout } from "@/components/legal-page-layout";

export const metadata = {
  title: "Privacy Policy | Content Flywheel",
  description: "Privacy Policy for Content Flywheel",
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Last updated: April 2026
      </p>

      <div className="mt-10 space-y-10 text-slate-600 dark:text-slate-400">
        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Information We Collect
          </h2>
          <p className="mt-3 leading-relaxed">We collect the following types of information:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
            <li><strong className="text-slate-900 dark:text-white">Account data:</strong> Your name, email address, and profile information provided during sign-up</li>
            <li><strong className="text-slate-900 dark:text-white">Payment information:</strong> Billing details processed securely via Stripe — we never store your full card number</li>
            <li><strong className="text-slate-900 dark:text-white">Product data:</strong> Digital products, descriptions, files, and pricing you create on the platform</li>
            <li><strong className="text-slate-900 dark:text-white">Transaction data:</strong> Orders, sales, discount code usage, and affiliate referrals</li>
            <li><strong className="text-slate-900 dark:text-white">Usage data:</strong> How you interact with the Service, including pages visited and features used</li>
            <li><strong className="text-slate-900 dark:text-white">Communications:</strong> Messages you send to us via email or support</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            How We Use Your Information
          </h2>
          <p className="mt-3 leading-relaxed">We use your information to:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
            <li>Provide, maintain, and improve the Service</li>
            <li>Process payments and manage subscriptions</li>
            <li>Enable you to create, manage, and sell digital products</li>
            <li>Send transactional emails (order confirmations, receipts)</li>
            <li>Respond to support requests</li>
            <li>Analyse usage to improve the platform</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Data Storage
          </h2>
          <p className="mt-3 leading-relaxed">
            We use Supabase for database and file storage, and Clerk for authentication. Your data may be stored and processed in data centres within the EU or UK. We retain your data for as long as your account is active, or as required by law.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Third-Party Services
          </h2>
          <p className="mt-3 leading-relaxed">We use the following third-party services to operate the platform:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
            <li><strong className="text-slate-900 dark:text-white">Clerk</strong> — authentication and user management</li>
            <li><strong className="text-slate-900 dark:text-white">Stripe</strong> — payment processing and subscription management</li>
            <li><strong className="text-slate-900 dark:text-white">Supabase</strong> — database and file storage</li>
            <li><strong className="text-slate-900 dark:text-white">OpenAI</strong> — AI-assisted content generation</li>
            <li><strong className="text-slate-900 dark:text-white">Vercel</strong> — hosting and infrastructure</li>
          </ul>
          <p className="mt-3 leading-relaxed">Each provider has their own privacy policy. We encourage you to review them.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Cookies &amp; Tracking
          </h2>
          <p className="mt-3 leading-relaxed">
            We use cookies for session management and user preferences. We do not use third-party advertising cookies. You can control cookies in your browser settings, though some features may not work correctly if cookies are disabled.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Your Rights (GDPR)
          </h2>
          <p className="mt-3 leading-relaxed">As a UK/EU resident, you have the right to:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
            <li>Access the personal data we hold about you</li>
            <li>Correct any inaccurate information</li>
            <li>Request deletion of your data</li>
            <li>Request a portable copy of your data</li>
            <li>Object to or restrict certain processing</li>
          </ul>
          <p className="mt-3 leading-relaxed">
            To exercise any of these rights, email us at{" "}
            <a href="mailto:hello@contentflywheel.co.uk" className="text-orange-500 hover:text-orange-400">
              hello@contentflywheel.co.uk
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Data Security
          </h2>
          <p className="mt-3 leading-relaxed">
            We take reasonable technical and organisational measures to protect your data. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Children&apos;s Privacy
          </h2>
          <p className="mt-3 leading-relaxed">
            The Service is not intended for users under the age of 13. We do not knowingly collect personal data from children. If you believe we have done so, please contact us and we will delete it promptly.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Changes to This Policy
          </h2>
          <p className="mt-3 leading-relaxed">
            We may update this policy from time to time. We will post changes on this page and update the &quot;Last updated&quot; date. Continued use of the Service after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Contact
          </h2>
          <p className="mt-3 leading-relaxed">
            Privacy questions or concerns? Contact us at{" "}
            <a href="mailto:hello@contentflywheel.co.uk" className="text-orange-500 hover:text-orange-400">
              hello@contentflywheel.co.uk
            </a>.
          </p>
        </section>
      </div>
    </LegalPageLayout>
  );
}
