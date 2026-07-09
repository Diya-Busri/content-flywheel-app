import Link from "next/link";
import { Youtube } from "lucide-react";

export function LightFooter() {
  return (
    <footer className="mt-24 border-t border-slate-200 bg-white text-[#0F172A]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-[#0F172A]">
              Product
            </h4>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/#features" className="text-slate-600 hover:text-slate-900">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="text-slate-600 hover:text-slate-900">
                  How it Works
                </Link>
              </li>
              <li>
                <Link href="/#pricing-preview" className="text-slate-600 hover:text-slate-900">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-[#0F172A]">
              Legal
            </h4>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/terms" className="text-slate-600 hover:text-slate-900">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-slate-600 hover:text-slate-900">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/refund-policy" className="text-slate-600 hover:text-slate-900">
                  Refund Policy
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-[#0F172A]">
              Connect
            </h4>
            <ul className="mt-4 flex gap-4">
              <li>
                <a
                  href="https://x.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-900"
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
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-900"
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
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-900"
                  aria-label="YouTube"
                >
                  <Youtube className="h-5 w-5" />
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-slate-200 pt-8">
          <p className="text-center text-sm text-slate-500">
            © 2026 Content Flywheel. All rights reserved.
          </p>
          <p className="mt-2 text-center text-sm text-slate-500">
            Contact:{" "}
            <a
              href="mailto:contentflywheel@gmail.com"
              className="text-amber-600 hover:text-amber-700"
            >
              contentflywheel@gmail.com
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
