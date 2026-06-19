"use client";

import { useState } from "react";
import { Zap, Flame, Package, Video, Mail, ArrowRight } from "lucide-react";
import { CreateVideoModal } from "./CreateVideoModal";
import Link from "next/link";

type DashboardHeroProps = {
  productsCount: number;
  videosCount: number;
  videosThisWeek: number;
  emailSubscribers: number;
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardHero({
  productsCount,
  videosCount,
  videosThisWeek,
  emailSubscribers,
}: DashboardHeroProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const streakDays = Math.min(videosThisWeek, 7);

  const message =
    productsCount === 0
      ? "Create your first digital product and start building passive income today."
      : productsCount > 0 && videosCount === 0
      ? `You have ${productsCount} product${productsCount > 1 ? "s" : ""} — create a promo video to start making sales.`
      : `${productsCount} product${productsCount > 1 ? "s" : ""}, ${videosCount} video${videosCount > 1 ? "s" : ""} — keep the flywheel spinning.`;

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl mb-6 sm:mb-8 shadow-xl">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800" />
        {/* Decorative circles */}
        <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-white/10" />
        <div className="absolute right-8 top-24 w-40 h-40 rounded-full bg-white/[0.07]" />
        <div className="absolute -left-8 bottom-0 w-32 h-32 rounded-full bg-black/[0.06]" />

        <div className="relative p-5 sm:p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            {/* Left: greeting + message + pills */}
            <div className="space-y-2.5 flex-1 min-w-0">
              <p className="text-orange-100 text-[10px] font-bold uppercase tracking-widest">
                Content Flywheel
              </p>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                {getGreeting()} 👋
              </h1>
              <p className="text-orange-100 text-sm leading-relaxed max-w-lg line-clamp-2 md:line-clamp-none">
                {message}
              </p>

              {/* Stat pills */}
              <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-0.5">
                <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold text-white">
                  <Package className="w-3.5 h-3.5" />
                  {productsCount} product{productsCount !== 1 ? "s" : ""}
                </span>
                <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold text-white">
                  <Video className="w-3.5 h-3.5" />
                  {videosCount} video{videosCount !== 1 ? "s" : ""}
                </span>
                {emailSubscribers > 0 && (
                  <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold text-white">
                    <Mail className="w-3.5 h-3.5" />
                    {emailSubscribers} subscriber{emailSubscribers !== 1 ? "s" : ""}
                  </span>
                )}
                {streakDays >= 2 && (
                  <span className="inline-flex items-center gap-1.5 bg-white/25 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold text-white">
                    <Flame className="w-3.5 h-3.5" />
                    {streakDays}-day streak 🔥
                  </span>
                )}
              </div>
            </div>

            {/* Right: CTA + streak dots */}
            <div className="flex flex-col items-stretch md:items-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="flex items-center justify-center gap-2 bg-white text-orange-600 hover:bg-orange-50 active:bg-orange-100 font-bold px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-xl text-sm whitespace-nowrap"
              >
                <Zap className="w-4 h-4" />
                Create Video Now
              </button>
              <Link
                href="/dashboard/digital-products/create"
                className="flex items-center justify-center md:justify-end gap-1.5 text-orange-100 hover:text-white text-xs font-medium transition-colors"
              >
                + New product
                <ArrowRight className="w-3 h-3" />
              </Link>

              {/* Week streak dots — hidden on mobile to save space */}
              <div className="hidden sm:flex items-center gap-1 mt-1">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    title={`Day ${i + 1}`}
                    className={`w-2.5 h-2.5 rounded-full transition-colors ${
                      i < streakDays ? "bg-white" : "bg-white/30"
                    }`}
                  />
                ))}
                <span className="ml-2 text-xs text-orange-100 font-medium">this week</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CreateVideoModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
