import Link from "next/link";
import { LegalPageLayout } from "@/components/legal-page-layout";
import { ArrowRight, Clock } from "lucide-react";

export const metadata = {
  title: "Blog | Content Flywheel",
  description: "Guides, strategies, and stories for creators who sell digital products.",
};

const POSTS = [
  {
    slug: "faceless-creator",
    title: "The Faceless Creator Playbook",
    description:
      "How to build a profitable digital product business without showing your face on camera. AI tools, anonymous branding, and the exact funnel that works.",
    date: "2026",
    readTime: "8 min read",
    tag: "Strategy",
  },
];

export default function BlogPage() {
  return (
    <LegalPageLayout>
      <div className="mb-10">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-2">Blog</p>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Creator Resources</h1>
        <p className="mt-3 text-slate-500 dark:text-slate-400 max-w-xl">
          Guides and playbooks for creators who build and sell digital products.
        </p>
      </div>

      <div className="space-y-6">
        {POSTS.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group block rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 hover:border-amber-400 dark:hover:border-amber-500 transition-colors"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400">
                {post.tag}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Clock className="h-3 w-3" /> {post.readTime}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              {post.title}
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {post.description}
            </p>
            <div className="flex items-center gap-1 mt-4 text-sm font-semibold text-amber-600 dark:text-amber-400">
              Read article <ArrowRight className="h-4 w-4" />
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-8 text-center">
        <p className="font-semibold text-slate-900 dark:text-white mb-1">More articles coming soon</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          We&apos;re writing guides on pricing, product creation, email marketing, and more.
        </p>
      </div>
    </LegalPageLayout>
  );
}
