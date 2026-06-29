import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Users } from "lucide-react";
import { listCommunityPosts } from "@/db/queries/academy-queries";
import { CommunityPostCard } from "@/components/academy/community-post-card";
import { NewPostModal } from "@/components/academy/new-post-modal";
import { ACADEMY_CATEGORIES } from "@/lib/academy";

export const dynamic = "force-dynamic";
export const metadata = { title: "Community | Academy" };

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: { category?: string; filter?: string };
}) {
  const category = searchParams.category ?? "all";
  const unansweredOnly = searchParams.filter === "unanswered";
  const allPosts = await listCommunityPosts(category);
  const posts = unansweredOnly ? allPosts.filter((p) => p.commentsCount === 0) : allPosts;

  await auth();
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const isAdmin = !!adminEmail && email.trim().toLowerCase() === adminEmail;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Users className="h-6 w-6 text-primary" /> Community
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Share wins, ask questions, get feedback.</p>
        </div>
        <NewPostModal isAdmin={isAdmin} />
      </div>

      {/* Category tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {ACADEMY_CATEGORIES.map((c) => {
          const active = c.id === category || (c.id === "all" && !searchParams.category);
          return (
            <Link
              key={c.id}
              href={c.id === "all" ? "/dashboard/academy/community" : `/dashboard/academy/community?category=${c.id}`}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {c.label}
            </Link>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="mb-5 flex gap-2">
        <Link
          href={category === "all" ? "/dashboard/academy/community" : `/dashboard/academy/community?category=${category}`}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            !unansweredOnly ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          All Posts
        </Link>
        <Link
          href={category === "all" ? "/dashboard/academy/community?filter=unanswered" : `/dashboard/academy/community?category=${category}&filter=unanswered`}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            unansweredOnly ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          Unanswered
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">
          <Users className="mx-auto h-10 w-10 opacity-40" />
          <p className="mt-3">No posts yet. Be the first to start a conversation!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <CommunityPostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
