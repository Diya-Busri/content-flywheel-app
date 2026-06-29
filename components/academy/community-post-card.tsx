import Link from "next/link";
import { Heart, MessageCircle, Pin, Star } from "lucide-react";
import { CATEGORY_COLORS, categoryLabel, timeAgo } from "@/lib/academy";
import type { SelectAcademyCommunityPost } from "@/db/schema/academy-schema";
import { ReportButton } from "@/components/community/report-button";

export function CommunityPostCard({ post }: { post: SelectAcademyCommunityPost }) {
  return (
    <Link
      href={`/dashboard/academy/community/${post.id}`}
      className="block rounded-xl border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
    >
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
      <h3 className="mt-2 font-semibold text-foreground line-clamp-1">{post.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.content}</p>
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Heart className="h-3.5 w-3.5" /> {post.likesCount}
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle className="h-3.5 w-3.5" /> {post.commentsCount}
        </span>
        {post.userEmail && <span className="ml-auto truncate max-w-[160px]">{post.userEmail}</span>}
        <ReportButton postId={post.id} reportedUserId={post.userId} className="ml-1" />
      </div>
    </Link>
  );
}
