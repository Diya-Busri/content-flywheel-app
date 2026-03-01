"use client";

import { useCallback, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Star } from "lucide-react";

const PLACEHOLDER_REVIEWS = [
  {
    text: "Generated 50 TikTok videos in one afternoon. My conversion rate doubled!",
    name: "Sarah M.",
    rating: 5,
  },
  {
    text: "The compliance checker saved my account. No more worrying about bans.",
    name: "Mike T.",
    rating: 5,
  },
  {
    text: "Best $49 I've spent. ROI in the first week.",
    name: "Jessica L.",
    rating: 5,
  },
] as const;

export type ReviewItem = { text: string; name: string; rating?: number };

function ReviewCard({
  text,
  name,
  rating = 5,
}: {
  text: string;
  name: string;
  rating?: number;
}) {
  const stars = Math.min(5, Math.max(1, rating ?? 5));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800/80">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`h-5 w-5 ${i <= stars ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200 dark:fill-slate-600 dark:text-slate-600"}`}
            strokeWidth={1.5}
          />
        ))}
      </div>
      <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {text}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-medium text-slate-900 dark:text-white">{name}</span>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
          Verified User
        </span>
      </div>
    </div>
  );
}

export function ReviewsCarousel({ reviews: reviewsProp }: { reviews?: ReviewItem[] }) {
  const reviews = reviewsProp?.length ? reviewsProp : [...PLACEHOLDER_REVIEWS];

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "start",
    containScroll: "trimSnaps",
    breakpoints: {
      "(min-width: 768px)": { slidesToScroll: 1 },
      "(min-width: 1024px)": { slidesToScroll: 1 },
    },
  });

  const scrollNext = useCallback(() => {
    emblaApi?.scrollNext();
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const interval = setInterval(scrollNext, 4500);
    return () => clearInterval(interval);
  }, [emblaApi, scrollNext]);

  return (
    <div className="relative overflow-hidden">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex touch-pan-x gap-4">
          {reviews.map((review, i) => (
            <div
              key={i}
              className="min-w-0 flex-[0_0_100%] sm:flex-[0_0_calc(50%-0.5rem)] lg:flex-[0_0_calc(33.333%-0.667rem)]"
              style={{ scrollSnapAlign: "start" }}
            >
              <div className="h-full scroll-snap-align-start">
                <ReviewCard text={review.text} name={review.name} rating={review.rating} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Fade edges for polish */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-950"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-slate-50 to-transparent dark:from-slate-950"
        aria-hidden
      />
    </div>
  );
}
