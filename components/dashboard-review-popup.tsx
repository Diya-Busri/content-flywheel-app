"use client";

import { useState, useEffect } from "react";
import { ReviewPopup } from "@/components/review-popup";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";

const STORAGE_KEYS = {
  reviewed: "content_flywheel_review_submitted",
  feedback: "content_flywheel_feedback_submitted",
  maybeLaterCredits: "content_flywheel_maybe_later_credits",
} as const;

const VIDEOS_AFTER_MAYBE_LATER = 5;

type Profile = { usedCredits?: number | null; userId: string };

export function DashboardReviewPopup({ profile }: { profile: Profile }) {
  const [showPopup, setShowPopup] = useState(false);
  const { toast } = useToast();
  const usedCredits = profile?.usedCredits ?? 0;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEYS.reviewed) || localStorage.getItem(STORAGE_KEYS.feedback)) {
      return;
    }
    const maybeLaterCredits = localStorage.getItem(STORAGE_KEYS.maybeLaterCredits);
    if (maybeLaterCredits != null) {
      const credits = parseInt(maybeLaterCredits, 10);
      if (!Number.isNaN(credits) && usedCredits >= credits + VIDEOS_AFTER_MAYBE_LATER) {
        localStorage.removeItem(STORAGE_KEYS.maybeLaterCredits);
        setShowPopup(true);
      }
    }
  }, [usedCredits]);

  const handleSubmitReview = async (data: {
    rating: 5;
    reviewText: string;
    isPublic: boolean;
  }) => {
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating: data.rating,
        reviewText: data.reviewText,
        isPublic: data.isPublic,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({
        title: "Something went wrong",
        description: (err as { error?: string }).error ?? "Could not save review",
        variant: "destructive",
      });
      return;
    }
    localStorage.setItem(STORAGE_KEYS.reviewed, "true");
    toast({
      title: "Thank you!",
      description: "Your review helps other creators discover us.",
    });
    setShowPopup(false);
  };

  const handleSubmitFeedback = async (data: {
    rating: number;
    feedbackText?: string;
  }) => {
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating: data.rating,
        reviewText: data.feedbackText ?? "",
        isPublic: false,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({
        title: "Something went wrong",
        description: (err as { error?: string }).error ?? "Could not save feedback",
        variant: "destructive",
      });
      return;
    }
    localStorage.setItem(STORAGE_KEYS.feedback, "true");
    toast({
      title: "Thanks for your feedback",
      description: "We use it to improve.",
    });
    setShowPopup(false);
  };

  const handleMaybeLater = () => {
    localStorage.setItem(STORAGE_KEYS.maybeLaterCredits, String(usedCredits));
    setShowPopup(false);
  };

  return (
    <>
      <ReviewPopup
        open={showPopup}
        onOpenChange={setShowPopup}
        onSubmitReview={handleSubmitReview}
        onSubmitFeedback={handleSubmitFeedback}
        onMaybeLater={handleMaybeLater}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowPopup(true)}
        className="fixed bottom-4 right-4 z-40"
      >
        Leave a review (test)
      </Button>
    </>
  );
}
