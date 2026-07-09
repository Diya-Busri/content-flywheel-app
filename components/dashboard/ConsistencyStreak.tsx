import { Flame } from "lucide-react";

type ConsistencyStreakProps = {
  videosThisWeek: number;
};

export function ConsistencyStreak({ videosThisWeek }: ConsistencyStreakProps) {
  const days = Math.min(videosThisWeek, 7);
  const hasStreak = days >= 2;

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] px-5 py-4 mb-8">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${hasStreak ? "bg-orange-500/15" : "bg-gray-100 dark:bg-[#2A2A2A]"}`}>
          <Flame className={`w-4 h-4 ${hasStreak ? "text-orange-500" : "text-gray-400"}`} />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {hasStreak ? `${days} day streak 🔥` : `You've posted ${days}/7 days this week`}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {days >= 5
              ? "You're on fire — don't break it now"
              : days >= 2
              ? "Post today to keep your streak going"
              : "Post daily to build your streak and grow faster"}
          </p>
        </div>
      </div>

      {/* Mini day dots */}
      <div className="hidden sm:flex items-center gap-1 shrink-0">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i < days
                ? "bg-orange-500"
                : "bg-gray-200 dark:bg-[#2A2A2A]"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
