/**
 * Protected route: /jarvis
 *
 * Standalone layout — deliberately does not reuse the dashboard shell
 * (sidebar, subscription paywall, feature-flag gating) so this Phase 1
 * feature stays additive and doesn't risk touching how the existing
 * dashboard behaves. auth().protect() already runs for every non-public
 * route in middleware.ts (this route is not in the public matcher), so the
 * redirect below is defence-in-depth, matching the pattern used elsewhere
 * (e.g. app/dashboard/layout.tsx).
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";

export default async function JarvisLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#0F0F0F]">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-[#0F0F0F]/80">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
            <Sparkles className="h-4 w-4 text-orange-500" />
            Jarvis
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
