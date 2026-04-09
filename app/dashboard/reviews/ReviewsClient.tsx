"use client";
import { useState } from "react";

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

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ color: "#f59e0b", fontSize: "14px" }}>
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  );
}

export default function ReviewsClient({ initialReviews }: { initialReviews: Review[] }) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);

  async function approve(id: string) {
    await fetch(`/api/reviews/${id}`, { method: "PATCH" });
    setReviews((r) => r.map((rev) => rev.id === id ? { ...rev, approved: true } : rev));
  }

  async function remove(id: string) {
    if (!confirm("Delete this review?")) return;
    await fetch(`/api/reviews/${id}`, { method: "DELETE" });
    setReviews((r) => r.filter((rev) => rev.id !== id));
  }

  const pending = reviews.filter((r) => !r.approved);
  const approved = reviews.filter((r) => r.approved);

  return (
    <div style={{ padding: "32px 24px", maxWidth: "900px" }}>
      <h1 style={{ margin: "0 0 4px", fontSize: "24px", fontWeight: 800, color: "#111827" }}>⭐ Reviews</h1>
      <p style={{ margin: "0 0 32px", fontSize: "14px", color: "#6b7280" }}>
        Manage customer reviews. Approved reviews appear on your product pages.
      </p>

      {reviews.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 24px", color: "#9ca3af", fontSize: "15px" }}>
          No reviews yet. They&apos;ll appear here once customers submit them after purchase.
        </div>
      )}

      {pending.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <h2 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: "8px" }}>
            Pending
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "22px", height: "22px", borderRadius: "50%", background: "#f97316", color: "#fff", fontSize: "11px", fontWeight: 700 }}>
              {pending.length}
            </span>
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {pending.map((r) => (
              <ReviewCard key={r.id} review={r} onApprove={() => approve(r.id)} onDelete={() => remove(r.id)} />
            ))}
          </div>
        </div>
      )}

      {approved.length > 0 && (
        <div>
          <h2 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "#111827" }}>Live on product pages</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {approved.map((r) => (
              <ReviewCard key={r.id} review={r} onDelete={() => remove(r.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewCard({ review, onApprove, onDelete }: { review: Review; onApprove?: () => void; onDelete: () => void }) {
  return (
    <div style={{ background: "#fff", borderRadius: "14px", padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", border: `1px solid ${review.approved ? "#f3f4f6" : "#fed7aa"}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", flexWrap: "wrap" }}>
            <Stars rating={review.rating} />
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>{review.buyerName || "Anonymous"}</span>
            <span style={{ fontSize: "12px", color: "#9ca3af" }}>{review.buyerEmail}</span>
            {review.productTitle && (
              <span style={{ fontSize: "12px", color: "#6b7280", background: "#f3f4f6", padding: "2px 8px", borderRadius: "999px" }}>
                {review.productTitle}
              </span>
            )}
            <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700,
              background: review.approved ? "#f0fdf4" : "#fff7ed",
              color: review.approved ? "#16a34a" : "#c2410c",
              border: `1px solid ${review.approved ? "#86efac" : "#fed7aa"}` }}>
              {review.approved ? "Live" : "Pending"}
            </span>
          </div>
          {review.reviewText && (
            <p style={{ margin: 0, fontSize: "14px", color: "#374151", lineHeight: 1.6 }}>&ldquo;{review.reviewText}&rdquo;</p>
          )}
          <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#9ca3af" }}>
            {new Date(review.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          {!review.approved && onApprove && (
            <button onClick={onApprove}
              style={{ padding: "7px 16px", borderRadius: "8px", border: "1px solid #86efac", background: "#f0fdf4", color: "#16a34a", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
              ✓ Approve
            </button>
          )}
          <button onClick={onDelete}
            style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid #fee2e2", background: "#fef2f2", color: "#dc2626", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
