/**
 * Sidebar component for the Template App
 * Provides primary navigation for the dashboard with a clean, modern UI
 * Features user avatar at the bottom and billing management option
 */
"use client";

import { Home, Settings, Package, ShoppingBag, Store, CheckSquare, Target, CreditCard, Library, Sun, Moon, Star, PanelLeftClose, PanelLeft, Film, MessageCircle, LayoutTemplate, Mail, Calendar, Gift, Users, TrendingUp, Flag, Activity, LayoutDashboard, BarChart2, Inbox, Bell, Megaphone, Tag, Send, FlaskConical, TrendingDown, Receipt, Wallet, Youtube, Shirt, Palette, BookMarked, Link2, Zap, ListTodo, MoreHorizontal, X, Brush, Video, Clapperboard, HelpCircle, NotebookPen, GraduationCap, UserPlus, ChevronDown, ChevronRight, Rocket } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NotificationBell } from "@/components/NotificationBell";
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { SelectProfile } from "@/db/schema/profiles-schema";
import { useState, useEffect } from "react";
import { useDashboardTheme } from "@/components/dashboard-theme-provider";
import { useSidebar } from "@/components/sidebar-context";
import { HelpPanel, HelpButton } from "@/components/help/HelpPanel";
import { AdminToolbar } from "@/components/dev/AdminToolbar";

interface SidebarProps {
  profile: SelectProfile | null;
  userEmail?: string;
  disabledFeatures?: string[];
  onOpenReview?: () => void;
  isAdmin?: boolean;
}

export default function Sidebar({ profile, userEmail, disabledFeatures = [], onOpenReview, isAdmin = false }: SidebarProps) {
  const disabled = new Set(disabledFeatures);
  const pathname = usePathname();
  const isAdminUser = isAdmin;
  const [mounted, setMounted] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const sidebar = useSidebar();
  const isCollapsed = sidebar?.isCollapsed ?? false;
  const toggleCollapsed = sidebar?.toggleCollapsed ?? (() => {});
  const { theme, toggleTheme } = useDashboardTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const storePages = ["/dashboard/store", "/dashboard/bundles", "/dashboard/reviews", "/dashboard/webhooks", "/dashboard/referral"];
  const [storeExpanded, setStoreExpanded] = useState(() => storePages.some((p) => pathname.startsWith(p)));

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-expand My Store group when navigating to a store-related page
  useEffect(() => {
    if (storePages.some((p) => pathname.startsWith(p))) {
      setStoreExpanded(true);
    }
  }, [pathname]);

  // Poll unread message count for the Messages badge.
  useEffect(() => {
    let active = true;
    const load = () => {
      fetch("/api/messages/unread")
        .then((r) => (r.ok ? r.json() : { count: 0 }))
        .then((d) => { if (active) setUnreadCount(Number(d?.count ?? 0)); })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 15000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  const isActive = (path: string, activeWhenStartsWith?: boolean) =>
    activeWhenStartsWith ? pathname.startsWith(path) : pathname === path;

  type NavItem = { href: string; icon: React.ReactNode; label: string; subItem?: boolean; badge?: string; activeWhenStartsWith?: boolean; featureKey?: string; parentToggle?: string; parentKey?: string };
  type NavGroup = { label: string; items: NavItem[] };

  const navGroups: NavGroup[] = [
    {
      label: "Create",
      items: [
        { href: "/dashboard/academy", icon: <GraduationCap size={18} />, label: "Academy", activeWhenStartsWith: true },
        { href: "/dashboard/ai-coach", icon: <MessageCircle size={18} />, label: "AI Coach", featureKey: "ai_coach" },
        { href: "/dashboard/design-studio", icon: <Palette size={18} />, label: "Design Studio", activeWhenStartsWith: true, featureKey: "design_studio" },
        { href: "/dashboard/template-studio", icon: <LayoutTemplate size={18} />, label: "Template Studio", activeWhenStartsWith: true, featureKey: "template_studio" },
        { href: "/dashboard/video-timeline", icon: <Video size={18} />, label: "Video Timeline", featureKey: "video_timeline" },
        { href: "/dashboard/ugc-lab", icon: <Clapperboard size={18} />, label: "UGC Lab", activeWhenStartsWith: true, featureKey: "ugc_lab" },
        { href: "/dashboard/brand-builder", icon: <Brush size={18} />, label: "Brand Builder", activeWhenStartsWith: true, featureKey: "brand_builder" },
        { href: "/dashboard/tiktok-shop", icon: <ShoppingBag size={18} />, label: "TikTok Shop", activeWhenStartsWith: true, featureKey: "tiktok_shop" },
        { href: "/dashboard/digital-products", icon: <Package size={18} />, label: "Digital Products", activeWhenStartsWith: true, featureKey: "digital_products" },
        { href: "/dashboard/video-guide/new", icon: <Clapperboard size={18} />, label: "Video Guide", activeWhenStartsWith: true, featureKey: "digital_products" },
        { href: "/dashboard/video-credits", icon: <Film size={18} />, label: "Video Credits", featureKey: "video_credits" },
      ],
    },
    {
      label: "Content",
      items: [
        { href: "/dashboard/library", icon: <Library size={18} />, label: "My Library", featureKey: "my_library" },
        { href: "/dashboard/caption-library", icon: <BookMarked size={18} />, label: "Caption Library", activeWhenStartsWith: true, featureKey: "caption_library" },
        { href: "/dashboard/content-calendar", icon: <Calendar size={18} />, label: "Content Calendar", featureKey: "content_calendar" },
        { href: "/dashboard/script-checker", icon: <CheckSquare size={18} />, label: "Script Checker", featureKey: "script_checker" },
        { href: "/dashboard/workspace", icon: <ListTodo size={18} />, label: "Workspace", activeWhenStartsWith: true },
      ],
    },
    {
      label: "Sell",
      items: [
        { href: "/dashboard/store", icon: <Store size={18} />, label: "My Store", activeWhenStartsWith: true },
        { href: "/dashboard/marketplace", icon: <ShoppingBag size={18} />, label: "Marketplace", activeWhenStartsWith: true },
        { href: "/dashboard/print-on-demand", icon: <Shirt size={18} />, label: "Print on Demand", activeWhenStartsWith: true, featureKey: "print_on_demand" },
        { href: "/dashboard/drop-campaign", icon: <Gift size={18} />, label: "Drop Campaign", activeWhenStartsWith: true, featureKey: "drop_campaign" },
      ],
    },
    {
      label: "Grow",
      items: [
        { href: "/dashboard/email-marketing", icon: <Mail size={18} />, label: "Email Marketing", activeWhenStartsWith: true, featureKey: "email_marketing" },
        { href: "/dashboard/email-sequences", icon: <Zap size={18} />, label: "Email Sequences", activeWhenStartsWith: true, featureKey: "email_marketing" },
        { href: "/dashboard/goals", icon: <Target size={18} />, label: "Goal Tracker", activeWhenStartsWith: true, featureKey: "goal_tracker" },
        { href: "/dashboard/campaign-mode", icon: <Zap size={18} />, label: "Campaign Mode", activeWhenStartsWith: true, featureKey: "campaign_mode" },
        { href: "/dashboard/grow", icon: <TrendingUp size={18} />, label: "Grow Hub", featureKey: "grow_hub" },
      ],
    },
  ].map((group) => ({ ...group, items: group.items.filter((item) => !item.featureKey || !disabled.has(item.featureKey)) }));

  if (isAdminUser) {
    navGroups.push({ label: "Admin", items: [
      { href: "/dashboard/admin", icon: <LayoutDashboard size={18} />, label: "Admin Overview", activeWhenStartsWith: false },
      { href: "/dashboard/admin/users", icon: <Users size={18} />, label: "Users", activeWhenStartsWith: true },
      { href: "/dashboard/admin/revenue", icon: <TrendingUp size={18} />, label: "Revenue", activeWhenStartsWith: true },
      { href: "/dashboard/admin/applications", icon: <Star size={18} />, label: "Applications", activeWhenStartsWith: true },
      { href: "/dashboard/admin/feature-flags", icon: <Flag size={18} />, label: "Feature Flags", activeWhenStartsWith: true },
      { href: "/dashboard/admin/analytics", icon: <BarChart2 size={18} />, label: "Analytics", activeWhenStartsWith: true },
      { href: "/dashboard/admin/feedback", icon: <Inbox size={18} />, label: "Feedback Inbox", activeWhenStartsWith: true },
      { href: "/dashboard/admin/support", icon: <Inbox size={18} />, label: "Support Inbox", activeWhenStartsWith: true },
      { href: "/dashboard/admin/reports", icon: <Flag size={18} />, label: "Reports", activeWhenStartsWith: true },
      { href: "/dashboard/admin/community-analytics", icon: <BarChart2 size={18} />, label: "Community Analytics", activeWhenStartsWith: true },
      { href: "/dashboard/admin/health", icon: <Activity size={18} />, label: "Platform Health", activeWhenStartsWith: true },
      { href: "/dashboard/admin/announcements", icon: <Megaphone size={18} />, label: "Announcements", activeWhenStartsWith: true },
      { href: "/dashboard/admin/notifications", icon: <Bell size={18} />, label: "Push Notifications", activeWhenStartsWith: true },
      { href: "/dashboard/admin/retention", icon: <TrendingDown size={18} />, label: "Retention", activeWhenStartsWith: true },
      { href: "/dashboard/admin/promo-codes", icon: <Tag size={18} />, label: "Promo Codes", activeWhenStartsWith: true },
      { href: "/dashboard/admin/email-blast", icon: <Send size={18} />, label: "Email Blast", activeWhenStartsWith: true },
      { href: "/dashboard/admin/ab-tests", icon: <FlaskConical size={18} />, label: "A/B Tests", activeWhenStartsWith: true },
      { href: "/dashboard/email-marketing", icon: <Mail size={18} />, label: "Email Marketing" },
      { href: "/dashboard/admin/finances", icon: <Wallet size={18} />, label: "Finance Tracker", activeWhenStartsWith: true },
      { href: "/dashboard/admin/video-agent", icon: <Clapperboard size={18} />, label: "Video Agent", activeWhenStartsWith: true },
      { href: "/dashboard/admin/notes", icon: <NotebookPen size={18} />, label: "Notes", activeWhenStartsWith: true },
    ]});
  }

  const comingSoonNavItems: NavItem[] = [];

  const settingsItem: NavItem = { href: "/dashboard/settings", icon: <Settings size={18} />, label: "Settings" };

  const renderNavItem = (item: NavItem, onToggle?: () => void, isExpanded?: boolean) => {
    const isSub = "subItem" in item && item.subItem;
    const active = isActive(item.href, item.activeWhenStartsWith);
    const hasToggle = !!item.parentToggle && !!onToggle;
    return (
      <div key={item.href} className={isSub ? "relative pl-3 hidden md:block" : ""}>
        {isSub && (
          <span className="absolute left-3 top-0 bottom-0 w-px bg-gray-200 dark:bg-white/10" />
        )}
        <Link href={item.href} className={`block ${isSub ? "pl-3" : ""}`}>
          <motion.div
            className={`flex items-center py-2 px-3 rounded-lg cursor-pointer transition-all ${
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
              {item.label}
            </span>
            {item.badge && (
              <span className={`hidden md:inline-flex shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${active ? "bg-white/20 text-white" : "bg-orange-500 text-white"}`}>
                {item.badge}
              </span>
            )}
            {hasToggle && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle!(); }}
                className={`hidden md:flex items-center justify-center w-5 h-5 rounded shrink-0 transition-colors ${active ? "text-white/70 hover:text-white" : "text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
                aria-label={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
            )}
          </motion.div>
        </Link>
      </div>
    );
  };

  const renderNavItemMobile = (item: NavItem) => {
    const active = isActive(item.href, item.activeWhenStartsWith);
    return (
      <Link key={item.href} href={item.href} onClick={() => setMobileNavOpen(false)} className="block">
        <div className={`flex items-center gap-3 py-3 px-3 rounded-xl transition-colors ${active ? "bg-orange-500 text-white" : "text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10"}`}>
          {item.icon}
          <span className="text-sm font-medium">{item.label}</span>
        </div>
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
          className="hidden md:flex fixed left-0 top-1/2 -translate-y-1/2 z-50 items-center justify-center w-8 h-12 rounded-r-md bg-white dark:bg-card border border-l-0 border-[#E5E7EB] dark:border-white/10 shadow-sm text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Expand sidebar"
        >
          <PanelLeft size={18} />
        </motion.button>
      )}

      <div
        className={`sidebar no-print h-screen flex-shrink-0 bg-white dark:bg-card backdrop-blur-xl border-r border-[#E5E7EB] dark:border-white/10 hidden md:flex flex-col justify-between py-5 relative overflow-hidden z-40 transition-[width] duration-200 ease-in-out ${
          isCollapsed ? "w-0 min-w-0 border-r-0" : "md:w-[220px] md:min-w-[220px]"
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
                <span className="text-xl font-bold tracking-tight">
                  <span className="text-gray-900 dark:text-white">Content</span><span className="text-orange-500">Flywheel</span>
                </span>
              </div>
              <div className="block md:hidden text-center">
                <span className="text-lg font-bold tracking-tight">
                  <span className="text-white">C</span><span className="text-orange-500">F</span>
                </span>
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

        {/* Admin Toolbar — Test Wizard, Restore, and future admin tools */}
        <AdminToolbar isAdmin={isAdmin} />

        {/* Navigation Items */}
        <nav className="flex-1 px-3 relative z-10 overflow-y-auto min-h-0">
          <div className="space-y-1.5 mb-2">
            {renderNavItem({ href: "/dashboard", icon: <Home size={18} />, label: "Home" })}
          </div>
          <div className="space-y-4">
            {navGroups.filter((group) => group.items.length > 0).map((group) => (
              <div key={group.label}>
                <p className="hidden md:block text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600 px-3 mb-1.5">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items
                    .filter((item) => !item.parentKey || (item.parentKey === "store" && storeExpanded))
                    .map((item) =>
                      item.parentToggle === "store"
                        ? renderNavItem(item, () => setStoreExpanded((v) => !v), storeExpanded)
                        : renderNavItem(item)
                    )}
                </div>
              </div>
            ))}
            {comingSoonNavItems.length > 0 && (
              <div className="pt-3 border-t border-[#E5E7EB] dark:border-white/10">
                {comingSoonNavItems.map(renderNavItem)}
              </div>
            )}
          </div>
        </nav>

        {/* Bottom Section - Settings, Leave a review, Dark mode, Billing, Account */}
        <div className="mt-auto pt-4 relative z-10">
          <PushNotificationPrompt />
          <div className="px-3 mb-3 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              {renderNavItem(settingsItem)}
            </div>
            <div className="flex-shrink-0">
              <NotificationBell />
            </div>
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
          {/* Help */}
          <div className="px-3 mb-3">
            <HelpButton onClick={() => setHelpOpen(true)} />
          </div>

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
          {/* Video Credits */}
          {typeof profile?.videoCredits === "number" && (
            <div className="px-3 mb-2">
              <Link href="/dashboard/video-credits">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center justify-center md:justify-between gap-1.5 py-1.5 px-3 rounded-lg bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Film size={13} className="text-orange-500 shrink-0" />
                    <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 hidden md:block truncate">Video Credits</span>
                  </div>
                  <span className="text-xs font-bold text-orange-600 dark:text-orange-400 shrink-0 bg-orange-100 dark:bg-orange-500/20 px-1.5 py-0.5 rounded-full">
                    {profile.videoCredits}
                  </span>
                </motion.div>
              </Link>
            </div>
          )}

          {/* Billing */}
          <div className="px-3 mb-4">
            <div className="h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent mb-4" />
            <Link href="/pricing">
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

      {/* Mobile Bottom Navigation Bar */}
      <div data-tour="mobile-nav" className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-card border-t border-[#E5E7EB] dark:border-white/10 flex items-center justify-around px-2 pb-safe">
        {[
          { href: "/dashboard",           icon: <Home size={22} />,       label: "Home"     },
          { href: "/dashboard/library",   icon: <Library size={22} />,    label: "Library"  },
          { href: "/dashboard/launch",    icon: <Rocket size={22} />,     label: "Launch"   },
        ].map((item) => {
          const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5 py-2 px-3 min-w-[56px] min-h-[56px] justify-center">
              <span className={active ? "text-orange-500" : "text-gray-500 dark:text-gray-400"}>{item.icon}</span>
              <span className={`text-[10px] font-medium ${active ? "text-orange-500" : "text-gray-500 dark:text-gray-400"}`}>{item.label}</span>
            </Link>
          );
        })}

        {/* More Sheet */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center gap-0.5 py-2 px-3 min-w-[56px] min-h-[56px] justify-center" aria-label="More navigation">
              <MoreHorizontal size={22} className="text-gray-500 dark:text-gray-400" />
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80dvh] rounded-t-2xl bg-white dark:bg-card border-t border-[#E5E7EB] dark:border-white/10 px-0 py-0 flex flex-col">
            {/* Handle */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#E5E7EB] dark:border-white/10 shrink-0">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Navigation</span>
              <div className="flex items-center gap-2">
                <NotificationBell />
                <button onClick={() => setMobileNavOpen(false)} className="p-1 rounded-lg text-gray-500 hover:bg-black/5 dark:hover:bg-white/10">
                  <X size={18} />
                </button>
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto px-4 py-3">
              <div className="space-y-4">
                {navGroups.filter((group) => group.items.length > 0).map((group) => (
                  <div key={group.label}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600 px-2 mb-1.5">{group.label}</p>
                    <div className="space-y-0.5">
                      {group.items
                        .filter((item) => !item.parentKey || (item.parentKey === "store" && storeExpanded))
                        .map(renderNavItemMobile)}
                    </div>
                  </div>
                ))}
              </div>
              {/* Settings group */}
              <div className="mt-4 pt-4 border-t border-[#E5E7EB] dark:border-white/10">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600 px-2 mb-1.5">Settings</p>
                <div className="space-y-0.5">
                  <Link href="/dashboard/settings" onClick={() => setMobileNavOpen(false)} className="block">
                    <div className={`flex items-center gap-3 py-3 px-3 rounded-xl transition-colors ${pathname === "/dashboard/settings" ? "bg-orange-500 text-white" : "text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10"}`}>
                      <Settings size={18} />
                      <span className="text-sm font-medium">Settings</span>
                    </div>
                  </Link>
                  <Link href="/pricing" onClick={() => setMobileNavOpen(false)} className="block">
                    <div className="flex items-center gap-3 py-3 px-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                      <CreditCard size={18} />
                      <span className="text-sm font-medium">Billing</span>
                    </div>
                  </Link>
                  <button onClick={() => { toggleTheme(); setMobileNavOpen(false); }} className="w-full flex items-center gap-3 py-3 px-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                    {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                    <span className="text-sm font-medium">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
                  </button>
                </div>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      {/* Help Panel — rendered outside sidebar so it overlays the full page */}
      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
} 