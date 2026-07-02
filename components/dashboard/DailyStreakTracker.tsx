"use client";

import { useEffect, useState } from "react";
import { Flame, Clock } from "lucide-react";

const STORAGE_KEY = "cf_daily_streak";
const TARGET_MINUTES = 30;

type StreakData = {
  dates: string[]; // array of "YYYY-MM-DD" strings where user hit 30 mins
  todayMinutes: number;
  lastUpdated: string; // "YYYY-MM-DD"
};

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function loadStreak(): StreakData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { dates: [], todayMinutes: 0, lastUpdated: getToday() };
    const parsed = JSON.parse(raw) as StreakData;
    // Reset todayMinutes if it's a new day
    if (parsed.lastUpdated !== getToday()) {
      return { ...parsed, todayMinutes: 0, lastUpdated: getToday() };
    }
    return parsed;
  } catch {
    return { dates: [], todayMinutes: 0, lastUpdated: getToday() };
  }
}

function saveStreak(data: StreakData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function calcStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const sorted = [...new Set(dates)].sort().reverse();
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  for (const d of sorted) {
    const date = new Date(d + "T00:00:00");
    const diff = Math.round((cursor.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0 || diff === 1) {
      streak++;
      cursor = date;
    } else {
      break;
    }
  }
  return streak;
}

export function DailyStreakTracker() {
  const [minutes, setMinutes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [goalHit, setGoalHit] = useState(false);

  useEffect(() => {
    const data = loadStreak();
    setMinutes(data.todayMinutes);
    setStreak(calcStreak(data.dates));
    setGoalHit(data.todayMinutes >= TARGET_MINUTES);

    const sessionStart = Date.now();

    const interval = setInterval(() => {
      const sessionMins = Math.floor((Date.now() - sessionStart) / 60000);
      const fresh = loadStreak();
      const newTotal = fresh.todayMinutes + sessionMins;
      const today = getToday();

      let newDates = [...fresh.dates];
      const hitGoal = newTotal >= TARGET_MINUTES;
      if (hitGoal && !newDates.includes(today)) {
        newDates = [...newDates, today];
      }

      const updated: StreakData = { dates: newDates, todayMinutes: newTotal, lastUpdated: today };
      saveStreak(updated);
      setMinutes(newTotal);
      setStreak(calcStreak(newDates));
      setGoalHit(hitGoal);
    }, 60000); // update every minute

    return () => clearInterval(interval);
  }, []);

  const progress = Math.min((minutes / TARGET_MINUTES) * 100, 100);
  const remaining = Math.max(TARGET_MINUTES - minutes, 0);

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] px-5 py-4 mb-6 flex items-center gap-4">
      {/* Flame icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${goalHit ? "bg-orange-500/15" : "bg-gray-100 dark:bg-[#2A2A2A]"}`}>
        <Flame className={`w-5 h-5 ${goalHit ? "text-orange-500" : "text-gray-400"}`} />
      </div>

      {/* Text + progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {goalHit
              ? streak > 1 ? `${streak} day streak 🔥` : "Streak started 🔥"
              : streak > 0 ? `${streak} day streak — keep it going` : "Build your daily streak"}
          </p>
          <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0 ml-2">
            <Clock className="w-3 h-3" />
            <span>{goalHit ? "30 min ✓" : `${minutes}/${TARGET_MINUTES} min`}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full bg-gray-100 dark:bg-[#2A2A2A] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${goalHit ? "bg-orange-500" : "bg-orange-400"}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="text-xs text-gray-400 mt-1">
          {goalHit
            ? "You've hit today's 30 min creating goal. Come back tomorrow to keep the streak going."
            : `${remaining} min of creating time left today — time spent in Content Flywheel counts`}
        </p>
      </div>

      {/* Day dots */}
      <div className="hidden sm:flex items-center gap-1 shrink-0">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full ${i < Math.min(streak, 7) ? "bg-orange-500" : "bg-gray-200 dark:bg-[#2A2A2A]"}`}
          />
        ))}
      </div>
    </div>
  );
}
