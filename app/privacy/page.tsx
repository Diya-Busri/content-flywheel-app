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
        Last updated: February 2026
      </p>

      <div className="mt-10 space-y-10 text-slate-600 dark:text-slate-400">
        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Information We Collect
          </h2>
          <p className="mt-3 leading-relaxed">We collect:</p>
          <ul className="mt-3 list-disc space-y-1 pl-6">
            <li><strong className="text-slate-900 dark:text-white">Account data:</strong> Email, name, profile info</li>
            <li><strong className="text-slate-900 dark:text-white">Payment info:</strong> Billing details via payment providers (we do not store full card numbers)</li>
            <li><strong className="text-slate-900 dark:text-white">Uploaded content:</strong> Product images, links, and materials you submit</li>
            <li><strong className="text-slate-900 dark:text-white">Usage data:</strong> How you use the Service (features, credits, device and log data)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            How We Use Information
          </h2>
          <p className="mt-3 leading-relaxed">We use it to: deliver the Service; process payments; run AI processing (scripts, video, compliance); improve the Service and fix issues; analyze usage; and send service-related communications.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Data Storage
          </h2>
          <p className="mt-3 leading-relaxed">We use Supabase for database and storage. Video generation may use third-party video APIs. Data may be processed and stored in regions required to operate the Service. We retain data as needed to provide the Service and as required by law.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Third-Party Services
          </h2>
          <p className="mt-3 leading-relaxed">We use: authentication (e.g., Clerk); AI and video (OpenAI, D-ID or similar); payments (Stripe, Whop, or other processors). Each has its own privacy practices—please review their policies.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Cookies & Tracking
          </h2>
          <p className="mt-3 leading-relaxed">We use cookies for session management, preferences (e.g., theme), and to understand usage. You can control cookies in your browser; some features may not work if cookies are disabled.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            User Rights (GDPR Compliance)
          </h2>
          <p className="mt-3 leading-relaxed">You may have the right to: access your data; correct inaccuracies; request deletion; request portability; object or restrict processing. To exercise these rights or lodge a complaint, contact contentflywheel@gmail.com.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Data Security
          </h2>
          <p className="mt-3 leading-relaxed">We use appropriate measures to protect your data. No method is 100% secure; we cannot guarantee absolute security.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Children&apos;s Privacy
          </h2>
          <p className="mt-3 leading-relaxed">The Service is not for users under 13. We do not knowingly collect data from children under 13. If you believe we have, contact us and we will delete it.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Changes to Policy
          </h2>
          <p className="mt-3 leading-relaxed">We may update this policy. We will post changes here and update the &quot;Last updated&quot; date. Continued use after changes means you accept the updated policy.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Contact
          </h2>
          <p className="mt-3 leading-relaxed">
            Privacy questions? Contact{" "}
            <a href="mailto:contentflywheel@gmail.com" className="text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300">
              contentflywheel@gmail.com
            </a>.
          </p>
        </section>
      </div>
    </LegalPageLayout>
  );
}
