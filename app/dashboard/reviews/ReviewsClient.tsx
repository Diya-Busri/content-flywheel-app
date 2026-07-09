"use client";

import { useState } from "react";
import { Star, CheckCircle2, Trash2, Clock, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

type Review = {
  id: string;
  productId: string;
  buyerName: string | null;
  buyerEmail: string;
  rating: number;
  reviewText: string | null;
  approved: boolean;
  createdAt: Date;
  productTitle: string | null;
};

function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const sz = size === "lg" ? "w-5 h-5" : "w-3.5 h-3.5";
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={cn(sz, i <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600")} />
      ))}
    </div>
  );
}

function ReviewCard({ review, onApprove, onDelete }: { review: Review; onApprove?: () => void; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className={cn("bg-card rounded-2xl border p-5 transition-all", review.approved ? "border-border" : "border-orange-500/30 bg-orange-500/[0.02]")}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0 space-y-2">
          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Stars rating={review.rating} />
            <span className="text-sm font-semibold text-foreground">{review.buyerName || "Anonymous"}</span>
            <span className="text-xs text-muted-foreground">{review.buyerEmail}</span>
            {review.productTitle && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium shrink-0">{review.productTitle}</span>
            )}
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold border shrink-0",
              review.approved ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-orange-500/10 text-orange-500 border-orange-500/20")}>
              {review.approved ? "Live" : "Pending"}
            </span>
          </div>

          {/* Review text */}
          {review.reviewText && (
            <p className="text-sm text-foreground/80 leading-relaxed italic">&ldquo;{review.reviewText}&rdquo;</p>
          )}

          <p className="text-xs text-muted-foreground">
            {new Date(review.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 shrink-0">
          {!review.approved && onApprove && (
            <button onClick={onApprove}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-green-500/30 bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors">
              <CheckCircle2 className="w-3.5 h-3.5" />Approve
            </button>
          )}
          {!confirming ? (
            <button onClick={() => setConfirming(true)}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:border-red-500/30 hover:text-red-500 hover:bg-red-500/5 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex gap-1.5">
              <button onClick={onDelete} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">Delete</button>
              <button onClick={() => setConfirming(false)} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReviewsClient({ initialReviews }: { initialReviews: Review[] }) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);

  const approve = async (id: string) => {
    await fetch(`/api/reviews/${id}`, { method: "PATCH" });
    setReviews(r => r.map(rev => rev.id === id ? { ...rev, approved: true } : rev));
  };
  const remove = async (id: string) => {
    await fetch(`/api/reviews/${id}`, { method: "DELETE" });
    setReviews(r => r.filter(rev => rev.id !== id));
  };

  const pending  = reviews.filter(r => !r.approved);
  const approved = reviews.filter(r => r.approved);
  const avgRating = approved.length > 0 ? (approved.reduce((s, r) => s + r.rating, 0) / approved.length).toFixed(1) : null;

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-3xl mx-auto space-y-7">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            <h1 className="text-2xl font-bold text-foreground">Reviews</h1>
          </div>
          <p className="text-sm text-muted-foreground">Approved reviews appear on your product pages.</p>
        </div>

        {/* Summary */}
        {reviews.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total reviews", value: reviews.length.toString(), icon: MessageSquare },
              { label: "Pending approval", value: pending.length.toString(), icon: Clock, highlight: pending.length > 0 },
              { label: "Avg rating", value: avgRating ? `${avgRating} ★` : "—", icon: Star },
            ].map(s => (
              <div key={s.label} className={cn("bg-card border rounded-2xl p-5", s.highlight ? "border-orange-500/30" : "border-border")}>
                <div className="flex items-center gap-1.5 mb-2">
                  <s.icon className={cn("w-4 h-4", s.highlight ? "text-orange-400" : "text-muted-foreground")} />
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{s.label}</p>
                </div>
                <p className={cn("text-2xl font-black", s.highlight && s.value !== "0" ? "text-orange-400" : "text-foreground")}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {reviews.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-14 text-center">
            <Star className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No reviews yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Reviews appear here after customers submit them post-purchase.</p>
          </div>
        )}

        {/* Pending */}
        {pending.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Needs approval</h2>
              <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">{pending.length}</span>
            </div>
            {pending.map(r => <ReviewCard key={r.id} review={r} onApprove={() => approve(r.id)} onDelete={() => remove(r.id)} />)}
          </div>
        )}

        {/* Approved */}
        {approved.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Live on product pages</h2>
            {approved.map(r => <ReviewCard key={r.id} review={r} onDelete={() => remove(r.id)} />)}
          </div>
        )}
      </div>
    </div>
  );
}
