/**
 * Sidebar component for the Template App
 * Provides primary navigation for the dashboard with a clean, modern UI
 * Features user avatar at the bottom and billing management option
 */
"use client";

import { Home, Settings, Package, ShoppingBag, CheckSquare, Target, CreditCard, Library, Sun, Moon, Star, PanelLeftClose, PanelLeft, Film, MessageCircle, LayoutTemplate, Lock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { SelectProfile } from "@/db/schema/profiles-schema";
import { useState, useEffect } from "react";
import { useDashboardTheme } from "@/components/dashboard-theme-provider";
import { useSidebar } from "@/components/sidebar-context";

interface SidebarProps {
  profile: SelectProfile | null;
  userEmail?: string;
  onOpenReview?: () => void;
}

export default function Sidebar({ profile, userEmail, onOpenReview }: SidebarProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const sidebar = useSidebar();
  const isCollapsed = sidebar?.isCollapsed ?? false;
  const toggleCollapsed = sidebar?.toggleCollapsed ?? (() => {});
  const { theme, toggleTheme } = useDashboardTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = (path: string, activeWhenStartsWith?: boolean) =>
    activeWhenStartsWith ? pathname.startsWith(path) : pathname === path;

  type NavItem = { href: string; icon: React.ReactNode; label: string; emoji: string; subItem?: boolean; badge?: string; activeWhenStartsWith?: boolean };

  const activeNavItems: NavItem[] = [
    { href: "/dashboard", icon: <Home size={18} />, label: "Home", emoji: "🏠" },
    { href: "/dashboard/ai-coach", icon: <MessageCircle size={18} />, label: "AI Coach", emoji: "🤖" },
    { href: "/dashboard/digital-products", icon: <Package size={18} />, label: "Digital Products", emoji: "📦" },
    { href: "/dashboard/digital-products/selling-guide", icon: <Package size={18} />, label: "Selling Guide", emoji: "🛒", subItem: true },
    { href: "/dashboard/tiktok-shop", icon: <ShoppingBag size={18} />, label: "TikTok Shop", emoji: "🛍️" },
    { href: "/dashboard/script-checker", icon: <CheckSquare size={18} />, label: "Script Checker", emoji: "✅" },
    { href: "/dashboard/goals", icon: <Target size={18} />, label: "Goal Tracker", emoji: "🎯" },
    { href: "/dashboard/library", icon: <Library size={18} />, label: "My Library", emoji: "📚" },
    { href: "/dashboard/video-timeline", icon: <Film size={18} />, label: "Video Timeline", emoji: "🎬" },
    { href: "/dashboard/template-studio", icon: <LayoutTemplate size={18} />, label: "Template Studio", emoji: "🎨", activeWhenStartsWith: true },
  ];

  // Teaser at bottom: Campaign Mode only (Coming Soon). Content Studio, Video Analytics, Content Calendar, Brand Builder are hidden from nav but pages remain.
  const comingSoonNavItems: NavItem[] = [
    { href: "/dashboard/campaign-mode", icon: <Lock size={18} />, label: "Campaign Mode", emoji: "🔒", badge: "Coming Soon" },
  ];

  const settingsItem: NavItem = { href: "/dashboard/settings", icon: <Settings size={18} />, label: "Settings", emoji: "⚙️" };

  const renderNavItem = (item: NavItem) => {
    const isSub = "subItem" in item && item.subItem;
    const active = isActive(item.href, item.activeWhenStartsWith);
    return (
      <Link key={item.href} href={item.href} className="block">
        <motion.div
          className={`flex items-center py-2 px-3 rounded-lg cursor-pointer transition-all ${isSub ? "pl-4 md:pl-5" : ""} ${
            active
              ? "bg-orange-500 text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white"
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
          <span className="ml-3 text-sm font-medium hidden md:block flex-1 min-w-0 truncate">
            {item.emoji} {item.label}
          </span>
          {item.badge && (
            <span className={`hidden md:inline-flex shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${active ? "bg-white/20 text-white" : "bg-orange-500 text-white"}`}>
              {item.badge}
            </span>
          )}
        </motion.div>
      </Link>
    );
  };

  return (
    <>
      {/* When collapsed: small expand button on left edge only */}
      {isCollapsed && (
        <motion.button
          type="button"
          onClick={toggleCollapsed}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center w-8 h-12 rounded-r-md bg-white dark:bg-card border border-l-0 border-[#E5E7EB] dark:border-white/10 shadow-sm text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Expand sidebar"
        >
          <PanelLeft size={18} />
        </motion.button>
      )}

      <div
        className={`sidebar no-print h-screen flex-shrink-0 bg-white dark:bg-card backdrop-blur-xl border-r border-[#E5E7EB] dark:border-white/10 flex flex-col justify-between py-5 relative overflow-hidden z-20 transition-[width] duration-200 ease-in-out ${
          isCollapsed ? "w-0 min-w-0 border-r-0" : "w-[60px] md:w-[220px] min-w-[60px] md:min-w-[220px]"
        }`}
        style={mounted && isCollapsed ? { width: 0, minWidth: 0 } : undefined}
      >
        {/* Subtle gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/[0.02] dark:from-white/[0.03] via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/20 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-black/10 dark:via-white/10 to-transparent" />

        {/* Logo + Collapse toggle */}
        <div className="px-3 mb-8 relative z-10 flex items-center justify-between gap-2">
          <Link href="/dashboard" className="min-w-0 flex-1">
            <motion.div
              className="flex items-center justify-center md:justify-start"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <div className="hidden md:block">
                <span className="font-bold text-lg text-gray-900 dark:text-white">Content Flywheel</span>
              </div>
              <div className="block md:hidden text-center">
                <span className="font-bold text-sm text-gray-900 dark:text-white">CF</span>
              </div>
            </motion.div>
          </Link>
          <motion.button
            type="button"
            onClick={toggleCollapsed}
            className="flex-shrink-0 p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose size={18} />
          </motion.button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 relative z-10 overflow-y-auto">
          <div className="space-y-1.5">
            {activeNavItems.map(renderNavItem)}
            <div className="pt-3 mt-3 border-t border-[#E5E7EB] dark:border-white/10">
              {comingSoonNavItems.map(renderNavItem)}
            </div>
          </div>
        </nav>

        {/* Bottom Section - Settings, Leave a review, Dark mode, Billing, Account */}
        <div className="mt-auto pt-4 relative z-10">
          <div className="px-3 mb-3">
            {renderNavItem(settingsItem)}
          </div>
          {onOpenReview && (
            <div className="px-3 mb-3">
              <motion.button
                type="button"
                onClick={onOpenReview}
                className="w-full flex items-center justify-center md:justify-start gap-1.5 py-2 px-3 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Star size={18} />
                <span className="text-sm font-medium hidden md:block">Leave a review</span>
              </motion.button>
            </div>
          )}
          {/* Dark mode */}
          <div className="px-3 mb-3">
            <motion.button
              type="button"
              onClick={toggleTheme}
              className="w-full flex items-center justify-center md:justify-start gap-1.5 py-2 px-3 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              <span className="text-sm font-medium hidden md:block">
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </span>
            </motion.button>
          </div>
          {/* Billing */}
          <div className="px-3 mb-4">
            <div className="h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent mb-4" />
            <Link href="/dashboard/settings">
              <motion.div
                whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
                whileTap={{ scale: 0.97 }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full flex items-center justify-center md:justify-start gap-1.5 border-[#E5E7EB] dark:border-white/20 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 py-1.5 h-auto transition-all"
                >
                  <CreditCard size={14} className="text-gray-500 dark:text-gray-400" />
                  <span className="text-xs hidden md:block">Billing</span>
                </Button>
              </motion.div>
            </Link>
          </div>

          {/* User Profile Section */}
          <div className="h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent" />
          <motion.div
            className="flex items-center px-3 py-3 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg mx-2 cursor-pointer"
            whileHover={{
              scale: 1.02,
              transition: { duration: 0.2 }
            }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-7 h-7 rounded-full overflow-hidden border border-[#E5E7EB] dark:border-white/20 flex items-center justify-center bg-black/5 dark:bg-white/10 shadow-sm">
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
                <div className="w-7 h-7 rounded-full bg-white/20" aria-hidden />
              )}
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-400 font-medium truncate max-w-[120px] ml-3 hidden md:block">
              {userEmail || "Account"}
            </span>
          </motion.div>
        </div>
      </div>
    </>
  );
} 