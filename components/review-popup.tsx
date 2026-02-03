"use client";

import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ReviewPopupProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Call when user submits a 5-star review (parent should save to reviews table and then not show popup again) */
  onSubmitReview?: (data: { rating: 5; reviewText: string; isPublic: boolean }) => Promise<void> | void;
  /** Call when user submits 1–4 star feedback (parent should save privately and then not show popup again) */
  onSubmitFeedback?: (data: { rating: number; feedbackText?: string }) => Promise<void> | void;
  /** Call when user clicks "Maybe Later" (parent can show again after more usage) */
  onMaybeLater?: () => void;
};

const MIN_REVIEW_CHARS = 20;

export function ReviewPopup({
  open,
  onOpenChange,
  onSubmitReview,
  onSubmitFeedback,
  onMaybeLater,
}: ReviewPopupProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<"review" | "feedback" | null>(null);
  const [hoverStar, setHoverStar] = useState<number | null>(null);
  const displayStars = hoverStar ?? rating ?? 0;

  const handleClose = () => {
    if (success) {
      setRating(null);
      setReviewText("");
      setFeedbackText("");
      setIsPublic(true);
      setSuccess(null);
    }
    onOpenChange(false);
  };

  const handleMaybeLater = () => {
    onMaybeLater?.();
    handleClose();
  };

  const handleSubmitReview = async () => {
    if (rating !== 5 || reviewText.trim().length < MIN_REVIEW_CHARS) return;
    setIsSubmitting(true);
    try {
      await onSubmitReview?.({ rating: 5, reviewText: reviewText.trim(), isPublic });
      setSuccess("review");
      setTimeout(handleClose, 1500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (rating == null || rating > 4) return;
    setIsSubmitting(true);
    try {
      await onSubmitFeedback?.({ rating, feedbackText: feedbackText.trim() || undefined });
      setSuccess("feedback");
      setTimeout(handleClose, 1500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmitReview = rating === 5 && reviewText.trim().length >= MIN_REVIEW_CHARS;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:p-8"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogPrimitive.Close
            className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </DialogPrimitive.Close>

          {success ? (
            <div className="py-8 text-center">
              <p className="text-lg font-medium text-slate-900 dark:text-white">
                {success === "review" ? "Thank you for sharing! 🎉" : "Thanks for your feedback!"}
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {success === "review"
                  ? "Your review helps other creators discover us."
                  : "We use your feedback to improve."}
              </p>
            </div>
          ) : (
            <>
              <DialogPrimitive.Title className="pr-8 text-xl font-semibold text-slate-900 dark:text-white">
                How&apos;s your experience with Content Flywheel?
              </DialogPrimitive.Title>

              {rating == null ? (
                /* Step 1: Star rating */
                <div className="mt-8">
                  <div
                    className="flex justify-center gap-1"
                    onMouseLeave={() => setHoverStar(null)}
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRating(value)}
                        onMouseEnter={() => setHoverStar(value)}
                        className="rounded p-1 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                        aria-label={`${value} star${value === 1 ? "" : "s"}`}
                      >
                        <Star
                          className={cn(
                            "h-10 w-10 transition-colors",
                            value <= displayStars
                              ? "fill-amber-400 text-amber-400 dark:fill-amber-500 dark:text-amber-500"
                              : "fill-transparent text-slate-300 dark:text-slate-600"
                          )}
                          strokeWidth={1.5}
                        />
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-center text-sm text-slate-500 dark:text-slate-400">
                    Tap to rate
                  </p>
                </div>
              ) : rating === 5 ? (
                /* Step 2a: 5-star – request public review */
                <div className="mt-6 space-y-5">
                  <p className="text-slate-600 dark:text-slate-400">
                    Amazing! 🎉 Would you share your experience?
                  </p>
                  <div>
                    <Label htmlFor="review-text" className="text-slate-700 dark:text-slate-300">
                      What did you love most? <span className="text-amber-500">*</span>
                    </Label>
                    <Textarea
                      id="review-text"
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder="e.g. The scripts are so conversion-focused..."
                      className="mt-2 min-h-[100px] resize-none"
                      maxLength={500}
                    />
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {reviewText.length} / 500 (min {MIN_REVIEW_CHARS} characters)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="is-public"
                      checked={isPublic}
                      onCheckedChange={(checked) => setIsPublic(checked === true)}
                    />
                    <Label
                      htmlFor="is-public"
                      className="cursor-pointer text-sm font-normal text-slate-700 dark:text-slate-300"
                    >
                      Display my review on the landing page
                    </Label>
                  </div>
                  <Button
                    onClick={handleSubmitReview}
                    disabled={!canSubmitReview || isSubmitting}
                    className="w-full bg-amber-500 text-slate-900 hover:bg-amber-400"
                  >
                    {isSubmitting ? "Sharing…" : "Share My Review"}
                  </Button>
                  <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                    Your review helps other creators discover us.
                  </p>
                </div>
              ) : (
                /* Step 2b: 1–4 stars – private feedback */
                <div className="mt-6 space-y-5">
                  <p className="text-slate-600 dark:text-slate-400">
                    Thanks for your feedback! How can we improve?
                  </p>
                  <div>
                    <Label htmlFor="feedback-text" className="text-slate-700 dark:text-slate-300">
                      Tell us what we can do better (optional)
                    </Label>
                    <Textarea
                      id="feedback-text"
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="Your feedback..."
                      className="mt-2 min-h-[80px] resize-none"
                      maxLength={500}
                    />
                  </div>
                  <Button
                    onClick={handleSubmitFeedback}
                    disabled={isSubmitting}
                    variant="secondary"
                    className="w-full bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  >
                    {isSubmitting ? "Submitting…" : "Submit Feedback"}
                  </Button>
                  <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                    This feedback is private and helps us improve.
                  </p>
                </div>
              )}

              {/* Maybe Later – show when rating not yet submitted */}
              {rating != null && !success && (
                <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={handleMaybeLater}
                    className="w-full text-center text-sm text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-slate-300"
                  >
                    Maybe Later
                  </button>
                </div>
              )}
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
