import { LegalPageLayout } from "@/components/legal-page-layout";
import { Mail, MessageSquare, Clock } from "lucide-react";

export const metadata = {
  title: "Contact Us | Content Flywheel",
  description: "Get in touch with the Content Flywheel team.",
};

export default function ContactPage() {
  return (
    <LegalPageLayout>
      <div className="mb-10">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-2">Contact</p>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Get in touch</h1>
        <p className="mt-3 text-slate-500 dark:text-slate-400">
          We&apos;re a small team and we read every message. You&apos;ll hear back within 24 hours.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3 mb-10">
        {[
          {
            icon: Mail,
            title: "Email us",
            desc: "For general questions, billing, and feedback.",
            action: "contentflywheel@gmail.com",
            href: "mailto:contentflywheel@gmail.com",
          },
          {
            icon: Clock,
            title: "Response time",
            desc: "We aim to reply within 24 hours on weekdays.",
            action: null,
            href: null,
          },
          {
            icon: MessageSquare,
            title: "Feature requests",
            desc: "Got an idea? Tell us what would help you most.",
            action: "contentflywheel@gmail.com",
            href: "mailto:contentflywheel@gmail.com?subject=Feature%20Request",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/15">
                <Icon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="font-semibold text-slate-900 dark:text-white">{item.title}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.desc}</p>
              {item.href && (
                <a
                  href={item.href}
                  className="mt-3 block text-sm font-medium text-amber-600 dark:text-amber-400 hover:underline"
                >
                  {item.action}
                </a>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Send us a message
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Click the link below to open an email to our team. Include your account email address so we can look things up faster.
        </p>
        <a
          href="mailto:contentflywheel@gmail.com"
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-400 transition-colors"
        >
          <Mail className="h-4 w-4" />
          Email us now
        </a>
      </div>
    </LegalPageLayout>
  );
}
