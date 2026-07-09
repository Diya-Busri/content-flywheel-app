"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, Pin, Star, Link2 } from "lucide-react";
import { CATEGORY_COLORS, categoryLabel, timeAgo } from "@/lib/academy";
import type { SelectAcademyCommunityPost } from "@/db/schema/academy-schema";
import { ReportButton } from "@/components/community/report-button";
import { startDirectConversationAction } from "@/actions/messaging-actions";

function extractUrl(content: string): string | null {
  const m = content.match(/\n\n🔗 (https?:\/\/\S+)$/);
  return m ? m[1] : null;
}

function MessageButton({ authorEmail }: { authorEmail: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    const res = await startDirectConversationAction(authorEmail);
    setLoading(false);
    if (res.isSuccess && res.data) {
      router.push(`/dashboard/academy/messages/${res.data.id}`);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60 md:opacity-0 md:group-hover:opacity-100"
      aria-label={`Message ${authorEmail}`}
    >
      <MessageCircle className="h-3.5 w-3.5" />
      <span>{loading ? "…" : "Message"}</span>
    </button>
  );
}

export function CommunityPostCard({
  post,
  currentUserId,
}: {
  post: SelectAcademyCommunityPost;
  currentUserId?: string | null;
}) {
  const canMessage =
    !!post.userEmail && !!currentUserId && post.userId !== currentUserId;

  return (
    <Link
      href={`/dashboard/academy/community/${post.id}`}
      className="group block rounded-xl border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
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
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
        {post.content.replace(/\n\n🔗 https?:\/\/\S+$/, "")}
      </p>
      {extractUrl(post.content) && (
        <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary">
          <Link2 className="h-3 w-3" />
          {extractUrl(post.content)}
        </span>
      )}
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Heart className="h-3.5 w-3.5" /> {post.likesCount}
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle className="h-3.5 w-3.5" /> {post.commentsCount}
        </span>
        {canMessage && <MessageButton authorEmail={post.userEmail as string} />}
        {post.userEmail && <span className="ml-auto truncate max-w-[160px]">{post.userEmail}</span>}
        <ReportButton postId={post.id} reportedUserId={post.userId} className="ml-1" />
      </div>
    </Link>
  );
}
