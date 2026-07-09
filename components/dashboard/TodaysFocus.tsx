"use client";

import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";

type FocusAction = {
  label: string;
  description: string;
  href: string;
  timeEstimate: string;
  emoji: string;
};

function getFocusAction(
  productsCount: number,
  videosCount: number,
  hasThumbnail: boolean,
  totalOrders: number,
  emailSubscribers: number,
): FocusAction {
  if (productsCount === 0) {
    return {
      emoji: "📦",
      label: "Create your first digital product",
      description: "Tell the AI what you want to sell — it writes the whole thing.",
      href: "/dashboard/digital-products/create",
      timeEstimate: "~5 min to start",
    };
  }
  if (!hasThumbnail) {
    return {
      emoji: "🖼️",
      label: "Add a cover to your product",
      description: "Products with covers sell. Generate one in seconds with AI.",
      href: "/dashboard/digital-products",
      timeEstimate: "~2 min",
    };
  }
  if (videosCount === 0) {
    return {
      emoji: "🎬",
      label: "Make your first promo video",
      description: "Turn your product into a short video that sells on TikTok or Instagram.",
      href: "/dashboard/video-guide/new",
      timeEstimate: "~3 min",
    };
  }
  if (emailSubscribers === 0) {
    return {
      emoji: "📧",
      label: "Get your first email subscriber",
      description: "Set up your list. Every sale starts with an audience.",
      href: "/dashboard/email-marketing",
      timeEstimate: "~10 min",
    };
  }
  if (totalOrders === 0) {
    return {
      emoji: "📣",
      label: "Post content to promote your product",
      description: "Use the AI Coach to write a TikTok script or Instagram caption right now.",
      href: "/dashboard/ai-coach",
      timeEstimate: "~5 min",
    };
  }
  return {
    emoji: "🚀",
    label: "Create your next digital product",
    description: "You have sales — double down. More products = more revenue.",
    href: "/dashboard/digital-products/create",
    timeEstimate: "~5 min to start",
  };
}

type Props = {
  productsCount: number;
  videosCount: number;
  hasThumbnail: boolean;
  totalOrders: number;
  emailSubscribers: number;
};

export function TodaysFocus({ productsCount, videosCount, hasThumbnail, totalOrders, emailSubscribers }: Props) {
  const action = getFocusAction(productsCount, videosCount, hasThumbnail, totalOrders, emailSubscribers);

  return (
    <Link href={action.href} className="block mb-6 sm:mb-8 group">
      <div className="rounded-2xl border border-orange-200 dark:border-orange-500/20 bg-gradient-to-r from-orange-50 to-amber-50/50 dark:from-orange-950/20 dark:to-amber-950/10 p-4 sm:p-5 flex items-center gap-4 hover:shadow-md transition-all">
        <div className="text-3xl shrink-0">{action.emoji}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-orange-400 mb-0.5 flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> Today&apos;s focus · {action.timeEstimate}
          </p>
          <p className="font-bold text-gray-900 dark:text-white text-sm sm:text-base leading-tight">{action.label}</p>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">{action.description}</p>
        </div>
        <ArrowRight className="h-5 w-5 text-orange-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
      </div>
    </Link>
  );
}
