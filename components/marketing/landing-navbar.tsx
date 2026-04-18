"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { SignedIn, SignedOut, SignOutButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

const NAV_OFFSET_PX = 80;

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET_PX;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

const NAV_LINKS = [
  { label: "Features", id: "features", href: "/#features" },
  { label: "How it Works", id: "how-it-works", href: "/#how-it-works" },
  { label: "Pricing", id: null, href: "/pricing" },
];

export function LandingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string | null, href: string) => {
    if (isHome && id) {
      e.preventDefault();
      scrollToSection(id);
      setMobileOpen(false);
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-black/80 backdrop-blur-xl border-b border-white/10 shadow-xl shadow-black/20"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0 text-xl font-extrabold text-white" aria-label="Content Flywheel home">
          Content<span className="text-orange-500">Flywheel</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map(({ label, id, href }) => (
            <a
              key={label}
              href={href}
              onClick={(e) => handleNavClick(e, id, href)}
              className="text-white/60 hover:text-white transition-colors text-sm font-medium"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-4">
          <SignedOut>
            <Link href="/sign-in" className="text-white/60 hover:text-white transition-colors text-sm font-medium">
              Sign In
            </Link>
            <Link href="/sign-up" className="px-5 py-2.5 bg-orange-500 hover:bg-orange-400 rounded-xl font-bold text-sm text-white transition-all hover:scale-105 shadow-lg shadow-orange-500/25">
              Get Started →
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="px-5 py-2.5 bg-orange-500 hover:bg-orange-400 rounded-xl font-bold text-sm text-white transition-all hover:scale-105 shadow-lg shadow-orange-500/25">
              Go to Dashboard
            </Link>
            <SignOutButton redirectUrl="/">
              <button className="text-white/60 hover:text-white transition-colors text-sm font-medium">
                Sign Out
              </button>
            </SignOutButton>
          </SignedIn>
        </div>

        {/* Mobile hamburger */}
        <button
          className="flex items-center justify-center md:hidden w-9 h-9 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-black/95 backdrop-blur-xl border-t border-white/10 px-4 py-4 flex flex-col gap-1">
          {NAV_LINKS.map(({ label, id, href }) => (
            <a
              key={label}
              href={href}
              onClick={(e) => { handleNavClick(e, id, href); setMobileOpen(false); }}
              className="rounded-xl px-4 py-3 text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
            >
              {label}
            </a>
          ))}
          <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-2">
            <SignedOut>
              <Link href="/sign-in" onClick={() => setMobileOpen(false)} className="rounded-xl px-4 py-3 text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium">
                Sign In
              </Link>
              <Link href="/sign-up" onClick={() => setMobileOpen(false)} className="rounded-xl px-4 py-3 bg-orange-500 hover:bg-orange-400 font-bold text-center text-white text-sm transition-colors">
                Get Started →
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="rounded-xl px-4 py-3 bg-orange-500 hover:bg-orange-400 font-bold text-center text-white text-sm transition-colors">
                Go to Dashboard
              </Link>
              <SignOutButton redirectUrl="/">
                <button className="rounded-xl px-4 py-3 text-white/60 hover:text-white hover:bg-white/5 text-left w-full text-sm transition-colors">
                  Sign Out
                </button>
              </SignOutButton>
            </SignedIn>
          </div>
        </div>
      )}
    </header>
  );
}
