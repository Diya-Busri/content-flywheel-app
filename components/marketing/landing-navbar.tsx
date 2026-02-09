"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_OFFSET_PX = 80;

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET_PX;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

export function LandingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    scrollToSection(id);
    setMobileOpen(false);
  };

  const navLinks = [
    { label: "Features", id: "features" },
    { label: "How it Works", id: "how-it-works" },
    { label: "Pricing", id: "pricing-preview" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b border-gray-800 bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-gray-900/90">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-20">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 shrink-0 text-2xl font-bold text-white"
        >
          Content <span className="text-orange-500">Flywheel</span>
        </Link>

        {/* Desktop nav - more spacing */}
        <nav className="hidden md:flex items-center gap-10">
          {navLinks.map(({ label, id }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => handleNavClick(e, id)}
              className="text-gray-300 hover:text-white transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA + theme - more spacing */}
        <div className="hidden md:flex items-center gap-6">
          <ThemeToggle />
          <Link
            href="/sign-in"
            className="text-gray-300 hover:text-white transition-colors hidden sm:block"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-lg font-semibold text-white transition-all hover:scale-105"
          >
            Start Creating Free
          </Link>
        </div>

        {/* Mobile: theme + menu */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-300 hover:text-white"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-800 bg-gray-900 px-4 py-4 flex flex-col gap-2">
          {navLinks.map(({ label, id }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => handleNavClick(e, id)}
              className={cn(
                "rounded-lg px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800"
              )}
            >
              {label}
            </a>
          ))}
          <Link
            href="/sign-in"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg px-4 py-3 bg-orange-500 hover:bg-orange-600 font-semibold text-center text-white"
          >
            Start Creating Free
          </Link>
        </div>
      )}
    </header>
  );
}
