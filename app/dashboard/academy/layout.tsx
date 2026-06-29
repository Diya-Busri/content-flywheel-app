"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { BookOpen, Users, MessageCircle, BarChart2, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard/academy", label: "Courses", icon: BookOpen, exact: true },
  { href: "/dashboard/academy/community", label: "Community", icon: Users },
  { href: "/dashboard/academy/messages", label: "Messages", icon: MessageCircle },
  { href: "/dashboard/academy/progress", label: "Progress", icon: BarChart2 },
];

// Pages that get full-screen treatment (no secondary nav)
const FULLSCREEN_PATTERNS = [
  /^\/dashboard\/academy\/[^/]+\/[^/]+/, // lesson viewer: /academy/[courseId]/[lessonId]
  /^\/dashboard\/academy\/admin/,         // admin area has its own layout
];

export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  const isFullscreen = FULLSCREEN_PATTERNS.some((p) => p.test(pathname));

  useEffect(() => {
    fetch("/api/messages/unread")
      .then((r) => r.json())
      .then((d) => setUnreadCount(d.count ?? 0))
      .catch(() => {});
    const id = setInterval(() => {
      fetch("/api/messages/unread")
        .then((r) => r.json())
        .then((d) => setUnreadCount(d.count ?? 0))
        .catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, []);

  if (isFullscreen) return <>{children}</>;

  return (
    <div className="flex min-h-full flex-col">
      {/* Secondary nav bar */}
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 md:px-6">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const isActive = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex shrink-0 items-center gap-2 px-3 py-3.5 text-sm font-medium transition-colors",
                  isActive
                    ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                {label === "Messages" && unreadCount > 0 && (
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}

          {/* Admin link — shown only to admin (checked client-side via a simple data attr trick) */}
          <AdminLink pathname={pathname} />
        </div>
      </div>

      <div className="flex-1">{children}</div>
    </div>
  );
}

// Separate component so we can fetch admin status once
function AdminLink({ pathname }: { pathname: string }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/is-admin")
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.isAdmin ?? false))
      .catch(() => {});
  }, []);

  if (!isAdmin) return null;

  const isActive = pathname.startsWith("/dashboard/academy/admin");
  return (
    <Link
      href="/dashboard/academy/admin"
      className={cn(
        "relative ml-auto flex shrink-0 items-center gap-2 px-3 py-3.5 text-sm font-medium transition-colors",
        isActive
          ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Settings2 className="h-4 w-4" />
      Manage
    </Link>
  );
}
