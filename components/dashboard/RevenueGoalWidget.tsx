"use client";

import { useState, useEffect } from "react";
import { Target, TrendingUp } from "lucide-react";

const STORAGE_KEY = "cf_monthly_revenue_goal_pence";

export function RevenueGoalWidget() {
  const [goalPence, setGoalPence] = useState<number | null>(null);
  const [thisMonthPence, setThisMonthPence] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(true);

  // Load goal from localStorage and fetch this-month revenue
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setGoalPence(parseInt(stored, 10));

    fetch("/api/analytics/revenue-summary")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.thisMonth?.cents !== undefined) {
          setThisMonthPence(Number(data.thisMonth.cents));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saveGoal = () => {
    const pence = Math.round(parseFloat(inputValue || "0") * 100);
    if (pence > 0) {
      localStorage.setItem(STORAGE_KEY, String(pence));
      setGoalPence(pence);
    }
    setEditing(false);
  };

  const clearGoal = () => {
    localStorage.removeItem(STORAGE_KEY);
    setGoalPence(null);
    setEditing(false);
  };

  const progressPct = goalPence && thisMonthPence !== null
    ? Math.min(100, Math.round((thisMonthPence / goalPence) * 100))
    : 0;

  const fmtPounds = (pence: number) =>
    `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const now = new Date();
  const monthName = now.toLocaleString("en-GB", { month: "long" });
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate();

  return (
    <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] shadow-lg p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-sm">
            <Target className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{monthName} Revenue Goal</p>
            <p className="text-xs text-gray-500">{daysLeft} day{daysLeft !== 1 ? "s" : ""} left this month</p>
          </div>
        </div>
        <button
          onClick={() => { setEditing(true); setInputValue(goalPence ? String(goalPence / 100) : ""); }}
          className="text-xs text-orange-500 hover:text-orange-600 font-semibold"
        >
          {goalPence ? "Edit goal" : "Set goal"}
        </button>
      </div>

      {editing ? (
        <div className="flex gap-2 items-center">
          <span className="text-gray-400 font-bold">£</span>
          <input
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveGoal(); if (e.key === "Escape") setEditing(false); }}
            placeholder="e.g. 1000"
            className="flex-1 rounded-lg border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#111] text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            autoFocus
          />
          <button onClick={saveGoal} className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-bold hover:bg-orange-600">Save</button>
          {goalPence && <button onClick={clearGoal} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#333] text-xs text-gray-500 hover:text-red-500">Clear</button>}
        </div>
      ) : !goalPence ? (
        <div className="text-center py-4">
          <TrendingUp className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Set a monthly revenue goal to track your progress.</p>
          <button
            onClick={() => { setEditing(true); setInputValue(""); }}
            className="mt-2 text-xs text-orange-500 hover:text-orange-600 font-semibold underline"
          >
            Set a goal →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">
              {loading ? "—" : fmtPounds(thisMonthPence ?? 0)}
            </span>
            <span className="text-sm text-gray-400">of {fmtPounds(goalPence)}</span>
          </div>

          {/* Progress bar */}
          <div className="h-3 w-full bg-gray-100 dark:bg-[#2A2A2A] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progressPct}%`,
                background: progressPct >= 100
                  ? "linear-gradient(90deg,#22c55e,#16a34a)"
                  : progressPct >= 60
                  ? "linear-gradient(90deg,#f97316,#fb923c)"
                  : "linear-gradient(90deg,#f97316,#fbbf24)",
              }}
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className={`font-semibold ${progressPct >= 100 ? "text-green-500" : "text-orange-500"}`}>
              {progressPct >= 100 ? "🎉 Goal reached!" : `${progressPct}% there`}
            </span>
            {progressPct < 100 && (
              <span className="text-gray-400">
                {fmtPounds(Math.max(0, goalPence - (thisMonthPence ?? 0)))} to go
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
