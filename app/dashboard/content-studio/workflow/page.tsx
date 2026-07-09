import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Target, Lightbulb, Calendar, FileText, ImagePlus, Search, Film, Send, BarChart3, FlaskConical, ChevronRight } from "lucide-react";

export const metadata: Metadata = {
  title: "4-Day Content Workflow | Content Studio | Content Flywheel",
  description:
    "Planning → Production → Publishing → Tracking. End-to-end workflow from niche and ideas to script, thumbnail, timeline, publish, and analytics.",
};

const stepLinkClass =
  "text-orange-500 hover:text-orange-600 dark:hover:text-orange-400 font-medium inline-flex items-center gap-1";

export default async function ContentWorkflowPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <main className="p-6 md:p-10 max-w-3xl">
      <Link
        href="/dashboard/content-studio"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Content Studio
      </Link>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        4-Day Content Workflow
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-10">
        From niche and ideas to published video and insights. Follow this path to plan, produce, publish, and track.
      </p>

      {/* DAY 1: Planning */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <span className="rounded-full bg-orange-500/20 text-orange-600 dark:text-orange-400 px-3 py-1 text-sm font-semibold">
            Day 1
          </span>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Planning
          </h2>
        </div>
        <ol className="space-y-3 text-gray-700 dark:text-gray-300">
          <li className="flex gap-3">
            <span className="text-muted-foreground font-mono text-sm w-6 shrink-0">1.</span>
            <span>
              Go to <Link href="/dashboard/content-studio/niche-research" className={stepLinkClass}><Target className="w-4 h-4" /> Niche Research</Link> → Select &quot;Personal Finance for Beginners&quot; (or your niche).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted-foreground font-mono text-sm w-6 shrink-0">2.</span>
            <span>
              Go to <Link href="/dashboard/content-studio/video-ideas" className={stepLinkClass}><Lightbulb className="w-4 h-4" /> Video Ideas</Link> → Generate 50 ideas → Save 10 to calendar.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted-foreground font-mono text-sm w-6 shrink-0">3.</span>
            <span>Pick an idea (e.g. &quot;5 Money Mistakes You&apos;re Making&quot;).</span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted-foreground font-mono text-sm w-6 shrink-0">4.</span>
            <span>
              Generate Script → Creates 30s TikTok script with hook, body, and CTA (use Script Checker or Digital Products script tools).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted-foreground font-mono text-sm w-6 shrink-0">5.</span>
            <span>
              Go to <Link href="/dashboard/content-studio/thumbnails" className={stepLinkClass}><ImagePlus className="w-4 h-4" /> Thumbnails</Link> → AI creates 3 options.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted-foreground font-mono text-sm w-6 shrink-0">6.</span>
            <span>
              Go to <Link href="/dashboard/content-studio/copy-writer" className={stepLinkClass}><FileText className="w-4 h-4" /> Copy Writer</Link> → Generate title &amp; description (SEO-optimized).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted-foreground font-mono text-sm w-6 shrink-0">7.</span>
            <span>
              Go to <Link href="/dashboard/content-studio/seo" className={stepLinkClass}><Search className="w-4 h-4" /> SEO &amp; Keywords</Link> → Research hashtags → Get 30 hashtags for TikTok.
            </span>
          </li>
        </ol>
      </section>

      {/* DAY 2: Production */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <span className="rounded-full bg-orange-500/20 text-orange-600 dark:text-orange-400 px-3 py-1 text-sm font-semibold">
            Day 2
          </span>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Production
          </h2>
        </div>
        <ol className="space-y-3 text-gray-700 dark:text-gray-300">
          <li className="flex gap-3">
            <span className="text-muted-foreground font-mono text-sm w-6 shrink-0">8.</span>
            <span>
              Go to <Link href="/dashboard/video-timeline" className={stepLinkClass}><Film className="w-4 h-4" /> Video Timeline</Link>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted-foreground font-mono text-sm w-6 shrink-0">9.</span>
            <span>All content pre-loaded (script, scenes, music suggested).</span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted-foreground font-mono text-sm w-6 shrink-0">10.</span>
            <span>Upload custom footage or use stock.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted-foreground font-mono text-sm w-6 shrink-0">11.</span>
            <span>Add captions, adjust timing.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted-foreground font-mono text-sm w-6 shrink-0">12.</span>
            <span>Export MP4.</span>
          </li>
        </ol>
      </section>

      {/* DAY 3: Publishing */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <span className="rounded-full bg-orange-500/20 text-orange-600 dark:text-orange-400 px-3 py-1 text-sm font-semibold">
            Day 3
          </span>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Publishing
          </h2>
        </div>
        <ol className="space-y-3 text-gray-700 dark:text-gray-300">
          <li className="flex gap-3">
            <span className="text-muted-foreground font-mono text-sm w-6 shrink-0">13.</span>
            <span>
              Go to <Link href="/dashboard/content-studio/publisher" className={stepLinkClass}><Send className="w-4 h-4" /> Publisher</Link>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted-foreground font-mono text-sm w-6 shrink-0">14.</span>
            <span>Select TikTok + YouTube Shorts.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted-foreground font-mono text-sm w-6 shrink-0">15.</span>
            <span>Attach thumbnail, title, description, hashtags.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted-foreground font-mono text-sm w-6 shrink-0">16.</span>
            <span>
              Schedule for Tuesday 6pm (optimal time) via <Link href="/dashboard/content-studio/calendar" className={stepLinkClass}><Calendar className="w-4 h-4" /> Calendar</Link> or publisher.
            </span>
          </li>
        </ol>
      </section>

      {/* DAY 4: Tracking */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <span className="rounded-full bg-orange-500/20 text-orange-600 dark:text-orange-400 px-3 py-1 text-sm font-semibold">
            Day 4
          </span>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Tracking
          </h2>
        </div>
        <ol className="space-y-3 text-gray-700 dark:text-gray-300">
          <li className="flex gap-3">
            <span className="text-muted-foreground font-mono text-sm w-6 shrink-0">17.</span>
            <span>Video publishes automatically at scheduled time.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted-foreground font-mono text-sm w-6 shrink-0">18.</span>
            <span>
              Go to <Link href="/dashboard/content-studio/analytics" className={stepLinkClass}><BarChart3 className="w-4 h-4" /> Analytics</Link> → See real-time views.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted-foreground font-mono text-sm w-6 shrink-0">19.</span>
            <span>
              <Link href="/dashboard/content-studio/ab-testing" className={stepLinkClass}><FlaskConical className="w-4 h-4" /> A/B test</Link> results show Thumbnail B performed better.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted-foreground font-mono text-sm w-6 shrink-0">20.</span>
            <span>Save insights for next video (Analytics AI insights + apply winning thumbnail).</span>
          </li>
        </ol>
      </section>

      <div className="pt-6 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
        <Link
          href="/dashboard/content-studio"
          className="inline-flex items-center gap-2 text-sm text-orange-500 hover:text-orange-600 font-medium"
        >
          Back to Content Studio
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </main>
  );
}
