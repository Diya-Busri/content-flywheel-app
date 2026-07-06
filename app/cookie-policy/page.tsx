import Link from "next/link";
import { LegalPageLayout } from "@/components/legal-page-layout";

export const metadata = {
  title: "Cookie Policy | Content Flywheel",
  description: "How Content Flywheel uses cookies and tracking technologies.",
};

export default function CookiePolicyPage() {
  return (
    <LegalPageLayout>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Cookie Policy</h1>
      <p className="text-sm text-slate-400 mb-10">Last updated: July 2026</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">What are cookies?</h2>
        <p className="leading-relaxed">
          Cookies are small text files stored on your device when you visit a website. They help the site remember your preferences and keep you logged in between sessions.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">How we use cookies</h2>
        <p className="leading-relaxed mb-4">
          Content Flywheel uses cookies only for the following purposes:
        </p>
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Purpose</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Required</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {[
                ["Authentication", "Keep you signed in to your account", "Yes"],
                ["Session", "Maintain your current session state", "Yes"],
                ["Preferences", "Remember your display and language settings", "No"],
                ["Analytics", "Anonymous usage data to improve the product (no personal data)", "No"],
              ].map(([type, purpose, required]) => (
                <tr key={type} className="bg-white dark:bg-slate-950">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{type}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{purpose}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                      required === "Yes"
                        ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}>
                      {required}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">What we do not use</h2>
        <p className="leading-relaxed">
          We do not use third-party advertising cookies, tracking pixels for ad networks, or any cookies that build profiles for targeted advertising. We do not sell or share cookie data with third parties for marketing purposes.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Third-party services</h2>
        <p className="leading-relaxed mb-3">
          Some features of Content Flywheel rely on third-party services that may set their own cookies:
        </p>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed text-slate-600 dark:text-slate-400">
          <li><strong className="text-slate-900 dark:text-white">Clerk</strong> — authentication and user session management</li>
          <li><strong className="text-slate-900 dark:text-white">Stripe</strong> — payment processing and checkout</li>
        </ul>
        <p className="mt-3 leading-relaxed text-slate-600 dark:text-slate-400">
          Each service has its own privacy and cookie policy. We encourage you to review them.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Controlling cookies</h2>
        <p className="leading-relaxed">
          You can control and delete cookies through your browser settings. Note that disabling essential cookies (authentication, session) will prevent you from staying signed in. Disabling preference cookies may cause your settings to reset on each visit.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Questions?</h2>
        <p className="leading-relaxed">
          If you have questions about our use of cookies, email us at{" "}
          <a href="mailto:contentflywheel@gmail.com" className="text-amber-600 hover:underline">
            contentflywheel@gmail.com
          </a>{" "}
          or read our full{" "}
          <Link href="/privacy" className="text-amber-600 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    </LegalPageLayout>
  );
}
