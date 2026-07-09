import Link from "next/link";
import { Youtube } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export function LegalPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white"
          >
            Content <span className="text-amber-500">Flywheel</span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/pricing"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Pricing
            </Link>
            <Link
              href="/sign-up"
              className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-400"
            >
              Start Creating Free
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          ← Back to Home
        </Link>
        {children}
      </main>

      <footer className="mt-24 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-white">
                Product
              </h4>
              <ul className="mt-4 space-y-2">
                <li>
                  <Link href="/#features" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="/#how-it-works" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                    How it Works
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                    Pricing
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-white">
                Legal
              </h4>
              <ul className="mt-4 space-y-2">
                <li>
                  <Link href="/terms" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/refund-policy" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                    Refund Policy
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-white">
                Connect
              </h4>
              <ul className="mt-4 flex gap-4">
                <li>
                  <a
                    href="https://x.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-slate-600 dark:text-slate-400 dark:hover:text-white"
                    aria-label="X (Twitter)"
                  >
                    <span className="text-sm font-bold">X</span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-slate-600 dark:text-slate-400 dark:hover:text-white"
                    aria-label="Instagram"
                  >
                    <span className="text-sm font-bold">IG</span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://youtube.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-slate-600 dark:text-slate-400 dark:hover:text-white"
                    aria-label="YouTube"
                  >
                    <Youtube className="h-5 w-5" />
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-700">
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              © 2026 Content Flywheel. All rights reserved.
            </p>
            <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
              Contact:{" "}
              <a
                href="mailto:contentflywheel@gmail.com"
                className="text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300"
              >
                contentflywheel@gmail.com
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
