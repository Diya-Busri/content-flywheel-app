"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { BookOpen, Users, BarChart2, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard/academy", label: "Courses", icon: BookOpen, exact: true },
  { href: "/dashboard/academy/community", label: "Community", icon: Users },
  { href: "/dashboard/academy/progress", label: "Progress", icon: BarChart2 },
];

// Pages that get full-screen treatment (no secondary nav)
const FULLSCREEN_PATTERNS = [
  /^\/dashboard\/academy\/[^/]+\/[^/]+/, // lesson viewer: /academy/[courseId]/[lessonId]
  /^\/dashboard\/academy\/admin/,         // admin area has its own layout
];

export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isFullscreen = FULLSCREEN_PATTERNS.some((p) => p.test(pathname));

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
              </Link>
            );
          })}

          <AdminLink pathname={pathname} />
        </div>
      </div>

      <div className="flex-1">{children}</div>
    </div>
  );
}

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
