import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart2, MessageSquare, Heart, FileText } from "lucide-react";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import {
  academyCommunityPostsTable,
  academyCommunityCommentsTable,
  academyCommunityLikesTable,
} from "@/db/schema/academy-schema";
import { asc, desc, eq, sql } from "drizzle-orm";
import { timeAgo } from "@/lib/academy";

export const dynamic = "force-dynamic";
export const metadata = { title: "Community Analytics | Admin" };

export default async function CommunityAnalyticsPage() {
  if (!(await isAdmin())) return redirect("/dashboard");

  const [[totals], byCategory, unanswered, activeUsers, recent] = await Promise.all([
    db
      .select({
        posts: sql<number>`count(*)`,
        comments: sql<number>`coalesce(sum(${academyCommunityPostsTable.commentsCount}), 0)`,
        likes: sql<number>`coalesce(sum(${academyCommunityPostsTable.likesCount}), 0)`,
      })
      .from(academyCommunityPostsTable),
    db
      .select({
        category: academyCommunityPostsTable.category,
        count: sql<number>`count(*)`,
      })
      .from(academyCommunityPostsTable)
      .groupBy(academyCommunityPostsTable.category)
      .orderBy(desc(sql`count(*)`)),
    db
      .select()
      .from(academyCommunityPostsTable)
      .where(eq(academyCommunityPostsTable.commentsCount, 0))
      .orderBy(asc(academyCommunityPostsTable.createdAt))
      .limit(10),
    db
      .select({
        userEmail: academyCommunityPostsTable.userEmail,
        count: sql<number>`count(*)`,
      })
      .from(academyCommunityPostsTable)
      .groupBy(academyCommunityPostsTable.userEmail)
      .orderBy(desc(sql`count(*)`))
      .limit(8),
    db
      .select()
      .from(academyCommunityPostsTable)
      .orderBy(desc(academyCommunityPostsTable.createdAt))
      .limit(10),
  ]);

  const totalPosts = Number(totals?.posts ?? 0);
  const totalComments = Number(totals?.comments ?? 0);
  const totalLikes = Number(totals?.likes ?? 0);
  const maxCat = Math.max(1, ...byCategory.map((c) => Number(c.count)));

  const stat = (icon: React.ReactNode, label: string, value: number) => (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs">{label}</span></div>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6">
      <h1 className="mb-5 flex items-center gap-2 text-2xl font-bold text-foreground">
        <BarChart2 className="h-6 w-6 text-primary" /> Community Analytics
      </h1>

      <div className="mb-6 grid grid-cols-3 gap-3">
        {stat(<FileText className="h-4 w-4" />, "Total Posts", totalPosts)}
        {stat(<MessageSquare className="h-4 w-4" />, "Total Comments", totalComments)}
        {stat(<Heart className="h-4 w-4" />, "Total Likes", totalLikes)}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* By category */}
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Posts by Category</h2>
          <div className="space-y-2">
            {byCategory.length === 0 && <p className="text-sm text-muted-foreground">No posts yet.</p>}
            {byCategory.map((c) => (
              <div key={c.category}>
                <div className="mb-0.5 flex justify-between text-xs">
                  <span className="capitalize text-muted-foreground">{c.category}</span>
                  <span className="font-medium text-foreground">{Number(c.count)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${(Number(c.count) / maxCat) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Most active users */}
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Most Active Users</h2>
          <div className="space-y-2">
            {activeUsers.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
            {activeUsers.map((u, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="truncate text-foreground">{u.userEmail ?? "Unknown"}</span>
                <span className="text-muted-foreground">{Number(u.count)} posts</span>
              </div>
            ))}
          </div>
        </div>

        {/* Unanswered */}
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Unanswered Posts (oldest first)</h2>
          <div className="space-y-2">
            {unanswered.length === 0 && <p className="text-sm text-muted-foreground">All posts have replies!</p>}
            {unanswered.map((p) => (
              <Link key={p.id} href={`/dashboard/academy/community/${p.id}`} className="block rounded-lg border p-2 hover:border-primary/50">
                <p className="truncate text-sm font-medium text-foreground">{p.title}</p>
                <p className="text-[11px] text-muted-foreground">{timeAgo(p.createdAt)}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Recent Activity</h2>
          <div className="space-y-2">
            {recent.length === 0 && <p className="text-sm text-muted-foreground">No posts yet.</p>}
            {recent.map((p) => (
              <Link key={p.id} href={`/dashboard/academy/community/${p.id}`} className="block rounded-lg border p-2 hover:border-primary/50">
                <p className="truncate text-sm font-medium text-foreground">{p.title}</p>
                <p className="text-[11px] text-muted-foreground">{p.userEmail} · {timeAgo(p.createdAt)}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
