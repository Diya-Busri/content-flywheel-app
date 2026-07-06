import Link from "next/link";

const PRODUCT_LINKS = [
  { label: "Features", href: "/features" },
  { label: "How it Works", href: "/journey" },
  { label: "Pricing", href: "/pricing" },
  { label: "Marketplace", href: "/marketplace" },
  { label: "Blog", href: "/blog" },
];

const SUPPORT_LINKS = [
  { label: "FAQ", href: "/faq" },
  { label: "Contact Us", href: "/contact" },
  { label: "Selling Guide", href: "/selling-guide" },
  { label: "Affiliate Programme", href: "/affiliates" },
];

const LEGAL_LINKS = [
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Refund Policy", href: "/refund-policy" },
  { label: "Cookie Policy", href: "/cookie-policy" },
];

// Only include social accounts with confirmed active profiles
const SOCIAL_LINKS = [
  { label: "Twitter / X", href: "https://twitter.com/contentflywheel", icon: "𝕏" },
  { label: "Instagram", href: "https://instagram.com/contentflywheel", icon: "IG" },
  { label: "TikTok", href: "https://tiktok.com/@contentflywheel", icon: "TK" },
];

export function LightFooter() {
  return (
    <footer className="mt-24 border-t border-slate-200 bg-white text-[#0F172A]">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        {/* Brand + nav grid */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="text-lg font-extrabold tracking-tight text-slate-900">
              Content<span className="text-amber-500">Flywheel</span>
            </Link>
            <p className="mt-3 text-sm text-slate-500 max-w-xs leading-relaxed">
              Build, sell, and market digital products with AI. One platform, one price, everything connected.
            </p>
            <div className="flex items-center gap-2 mt-5">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-xs font-bold text-slate-500 hover:border-slate-400 hover:text-slate-900 transition-colors"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
              Product
            </h4>
            <ul className="space-y-2.5">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
              Support
            </h4>
            <ul className="space-y-2.5">
              {SUPPORT_LINKS.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
              Legal
            </h4>
            <ul className="space-y-2.5">
              {LEGAL_LINKS.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-slate-200 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-400">
            © 2026 Content Flywheel. All rights reserved.
          </p>
          <a
            href="mailto:contentflywheel@gmail.com"
            className="text-sm text-slate-400 hover:text-amber-600 transition-colors"
          >
            contentflywheel@gmail.com
          </a>
        </div>
      </div>
    </footer>
  );
}
