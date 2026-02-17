/**
 * Sidebar component for the Template App
 * Provides primary navigation for the dashboard with a clean, modern UI
 * Features user avatar at the bottom and billing management option
 */
"use client";

import { Home, Settings, Package, ShoppingBag, CheckSquare, Target, CreditCard, Library, FlaskConical } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { SelectProfile } from "@/db/schema/profiles-schema";
import { useState, useEffect } from "react";

interface SidebarProps {
  profile: SelectProfile | null;
  userEmail?: string;
}

export default function Sidebar({ profile, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = (path: string) => pathname === path;

  const navItems = [
    { href: "/dashboard", icon: <Home size={18} />, label: "Home", emoji: "🏠" },
    { href: "/dashboard/digital-products", icon: <Package size={18} />, label: "Digital Products", emoji: "📦" },
    { href: "/dashboard/tiktok-shop", icon: <ShoppingBag size={18} />, label: "TikTok Shop", emoji: "🛍️" },
    // Hidden from sidebar – re-enable by uncommenting:
    // { href: "/dashboard/ugc-lab", icon: <FlaskConical size={18} />, label: "UGC Lab", emoji: "🔬" },
    { href: "/dashboard/script-checker", icon: <CheckSquare size={18} />, label: "Script Checker", emoji: "✅" },
    { href: "/dashboard/goals", icon: <Target size={18} />, label: "Goal Tracker", emoji: "🎯" },
    { href: "/dashboard/library", icon: <Library size={18} />, label: "My Library", emoji: "📚" },
    { href: "/dashboard/settings", icon: <Settings size={18} />, label: "Settings", emoji: "⚙️" },
  ];

  return (
    <div className="sidebar no-print h-screen w-[60px] md:w-[220px] flex-shrink-0 bg-white/80 dark:bg-[#1a1a1a] backdrop-blur-xl border-r border-gray-200 dark:border-white/10 flex flex-col justify-between py-5 relative overflow-hidden z-20">
        {/* Glassmorphism effects */}
        <motion.div 
          className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/5 pointer-events-none"
          animate={{ 
            opacity: [0.4, 0.6, 0.4],
            background: [
              "linear-gradient(to bottom, rgba(var(--primary), 0.03), transparent, rgba(var(--primary), 0.03))",
              "linear-gradient(to bottom, rgba(var(--primary), 0.05), transparent, rgba(var(--primary), 0.05))",
              "linear-gradient(to bottom, rgba(var(--primary), 0.03), transparent, rgba(var(--primary), 0.03))"
            ]
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* Enhanced edge highlights for 3D effect */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gray-300/50 to-transparent" />
        <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-white to-transparent opacity-80" />
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white to-transparent opacity-80" />

        {/* Logo + theme toggle */}
        <div className="px-3 mb-8 relative z-10 flex items-center justify-between gap-2">
          <Link href="/dashboard" className="min-w-0 flex-1">
            <motion.div 
              className="flex items-center justify-center md:justify-start"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <div className="hidden md:block">
                <span className="font-bold text-lg text-slate-900 dark:text-white">Content Flywheel</span>
              </div>
              <div className="block md:hidden text-center">
                <span className="font-bold text-sm text-slate-900 dark:text-white">CF</span>
              </div>
            </motion.div>
          </Link>
          <div className="flex-shrink-0">
            <ThemeToggle />
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 relative z-10 overflow-y-auto">
          <div className="space-y-1.5">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="block">
                <motion.div 
                  className={`flex items-center py-2 px-3 rounded-lg cursor-pointer transition-all ${
                    isActive(item.href) 
                      ? "bg-primary text-white shadow-sm dark:bg-orange-600 dark:text-white" 
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-white/10 hover:border-gray-200/50 dark:hover:border-white/10 hover:shadow-md"
                  }`}
                  whileHover={{ 
                    scale: 1.03, 
                    x: 4,
                    transition: { duration: 0.2 }
                  }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center justify-center">
                    {item.icon}
                  </div>
                  <span className="ml-3 hidden md:block text-sm font-medium">
                    {item.emoji} {item.label}
                  </span>
                </motion.div>
              </Link>
            ))}
          </div>
        </nav>

        {/* Bottom Section - Account and Subscription Management */}
        <div className="mt-auto pt-4 relative z-10">
          {/* Billing: link to Settings where user can open Stripe Customer Portal */}
          <div className="px-3 mb-4">
            <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-white/10 to-transparent mb-4" />
            <Link href="/dashboard/settings">
              <motion.div
                whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
                whileTap={{ scale: 0.97 }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full flex items-center justify-center md:justify-start gap-1.5 border-white/60 bg-white/70 hover:bg-white/90 hover:border-white dark:border-white/20 dark:bg-white/10 dark:hover:bg-white/20 dark:text-gray-200 py-1.5 h-auto transition-all shadow-sm hover:shadow-md"
                >
                  <CreditCard size={14} className="text-gray-600 dark:text-gray-400" />
                  <span className="hidden md:block text-xs">Billing</span>
                </Button>
              </motion.div>
            </Link>
          </div>

          {/* User Profile Section */}
          <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
          <motion.div 
            className="flex items-center px-3 py-3 hover:bg-white/50 rounded-lg mx-2 cursor-pointer"
            whileHover={{ 
              scale: 1.02,
              transition: { duration: 0.2 }
            }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-7 h-7 rounded-full overflow-hidden border border-white/80 dark:border-white/20 flex items-center justify-center bg-white/80 dark:bg-white/10 shadow-sm">
              {mounted ? (
                <UserButton 
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      userButtonAvatarBox: "w-7 h-7",
                      userButtonTrigger: "w-7 h-7 rounded-full"
                    }
                  }} 
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-600" aria-hidden />
              )}
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-300 hidden md:block ml-3 font-medium truncate max-w-[120px]">
              {userEmail || "Account"}
            </span>
          </motion.div>
        </div>
      </div>
  );
} 