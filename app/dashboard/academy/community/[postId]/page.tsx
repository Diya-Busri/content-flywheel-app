import Link from "next/link";
import { notFound } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Pin, Star } from "lucide-react";
import {
  getCommunityPostById,
  listComments,
  hasLiked,
} from "@/db/queries/academy-queries";
import { CATEGORY_COLORS, categoryLabel, timeAgo } from "@/lib/academy";
import { PostInteractions } from "./PostInteractions";
import { PostMessageButton } from "./PostMessageButton";

export const dynamic = "force-dynamic";

export default async function CommunityPostPage({ params }: { params: { postId: string } }) {
  const post = await getCommunityPostById(params.postId);
  if (!post) return notFound();

  const { userId } = await auth();
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const isAdmin = !!adminEmail && email.trim().toLowerCase() === adminEmail;

  const [comments, liked] = await Promise.all([
    listComments(params.postId),
    userId ? hasLiked(params.postId, userId) : Promise.resolve(false),
  ]);

  let images: string[] = [];
  try {
    if (post.imageUrls) images = JSON.parse(post.imageUrls);
  } catch {
    images = [];
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-6">
      <Link href="/dashboard/academy/community" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to community
      </Link>

      <article className="mt-4 rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${CATEGORY_COLORS[post.category] ?? CATEGORY_COLORS.general}`}
          >
            {categoryLabel(post.category)}
          </span>
          {post.isPinned && (
            <span className="flex items-center gap-1 text-[11px] text-amber-500">
              <Pin className="h-3 w-3" /> Pinned
            </span>
          )}
          {post.isFeatured && (
            <span className="flex items-center gap-1 text-[11px] text-yellow-500">
              <Star className="h-3 w-3" /> Featured
            </span>
          )}
          <span className="ml-auto text-[11px] text-muted-foreground">{timeAgo(post.createdAt)}</span>
        </div>

        <h1 className="mt-2 text-xl font-bold text-foreground">{post.title}</h1>
        {post.userEmail && <p className="text-xs text-muted-foreground">by {post.userEmail}</p>}
        {post.userEmail && userId && post.userId !== userId && (
          <PostMessageButton authorEmail={post.userEmail} />
        )}

        <p className="mt-3 whitespace-pre-wrap text-foreground">{post.content}</p>

        {images.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt="" className="w-full rounded-lg border object-cover" />
            ))}
          </div>
        )}

        <PostInteractions
          postId={post.id}
          initialLiked={liked}
          initialLikes={post.likesCount}
          comments={comments}
          currentUserId={userId ?? null}
          isAdmin={isAdmin}
        />
      </article>
    </div>
  );
}
