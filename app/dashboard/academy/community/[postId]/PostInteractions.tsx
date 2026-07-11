"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Send, Trash2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  toggleLikeAction,
  createCommentAction,
  deleteCommentAction,
} from "@/actions/academy-actions";
import { timeAgo } from "@/lib/academy";

interface CommentRow {
  id: string;
  userEmail: string | null;
  userId: string;
  content: string;
  isAiReply?: boolean;
  createdAt: Date | string;
}

export function PostInteractions({
  postId,
  initialLiked,
  initialLikes,
  comments: initialComments,
  currentUserId,
  isAdmin,
}: {
  postId: string;
  initialLiked: boolean;
  initialLikes: number;
  comments: CommentRow[];
  currentUserId: string | null;
  isAdmin: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [likes, setLikes] = useState(initialLikes);
  const [comments, setComments] = useState(initialComments);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function handleLike() {
    // optimistic
    setLiked((p) => !p);
    setLikes((n) => (liked ? n - 1 : n + 1));
    const res = await toggleLikeAction(postId);
    if (!res.isSuccess) {
      setLiked((p) => !p);
      setLikes((n) => (liked ? n + 1 : n - 1));
      toast({ title: "Error", description: res.message, variant: "destructive" });
    } else {
      router.refresh();
    }
  }

  async function handleComment() {
    if (!text.trim()) return;
    setBusy(true);
    const res = await createCommentAction(postId, text.trim());
    setBusy(false);
    if (res.isSuccess && res.data) {
      setComments((c) => [...c, res.data as CommentRow]);
      setText("");
      router.refresh();
    } else {
      toast({ title: "Error", description: res.message, variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    const res = await deleteCommentAction(id, postId);
    if (res.isSuccess) {
      setComments((c) => c.filter((x) => x.id !== id));
      router.refresh();
    } else {
      toast({ title: "Error", description: res.message, variant: "destructive" });
    }
  }

  return (
    <div>
      <div className="mt-4 flex items-center gap-3 border-y py-3">
        <button
          onClick={handleLike}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            liked ? "bg-red-500/15 text-red-500" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} /> {likes}
        </button>
        <span className="text-sm text-muted-foreground">
          {comments.length} {comments.length === 1 ? "comment" : "comments"}
        </span>
      </div>

      <div className="mt-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Comments</h2>
        <div className="space-y-3">
          {comments.map((c) => (
            <div
              key={c.id}
              className={`rounded-lg border p-3 ${
                c.isAiReply
                  ? "bg-orange-500/5 border-orange-500/20"
                  : "bg-card"
              }`}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {c.isAiReply ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-orange-500">
                    <Sparkles className="h-3 w-3" />
                    CF AI
                  </span>
                ) : (
                  <span className="truncate font-medium text-foreground">{c.userEmail ?? "User"}</span>
                )}
                <span>{timeAgo(c.createdAt)}</span>
                {!c.isAiReply && (isAdmin || c.userId === currentUserId) && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="ml-auto text-muted-foreground hover:text-red-500"
                    aria-label="Delete comment"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {c.isAiReply && isAdmin && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="ml-auto text-muted-foreground hover:text-red-500"
                    aria-label="Delete AI comment"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{c.content}</p>
            </div>
          ))}
          {comments.length === 0 && (
            <p className="text-sm text-muted-foreground">No comments yet. Start the conversation.</p>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a comment..."
            rows={2}
            className="flex-1"
          />
          <Button onClick={handleComment} disabled={busy || !text.trim()} className="self-end">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
