"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpDown } from "lucide-react";
import type { CheckpointLessonAnalytics } from "@/db/queries/academy-checkpoint-analytics-queries";

type SortKey = "opened" | "understood" | "skipRate" | "questions" | "struggling" | "explain" | "example" | "apply";

function skipRate(l: CheckpointLessonAnalytics): number {
  return l.opened > 0 ? l.skipped / l.opened : 0;
}
function understandRate(l: CheckpointLessonAnalytics): number {
  return l.opened > 0 ? l.understandingConfirmed / l.opened : 0;
}

export function CheckpointAnalyticsClient({ lessons }: { lessons: CheckpointLessonAnalytics[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("opened");
  const [sortDesc, setSortDesc] = useState(true);

  const totals = useMemo(() => {
    return lessons.reduce(
      (acc, l) => ({
        opened: acc.opened + l.opened,
        understood: acc.understood + l.understandingConfirmed,
        skipped: acc.skipped + l.skipped,
        questions: acc.questions + l.questionsSubmitted,
      }),
      { opened: 0, understood: 0, skipped: 0, questions: 0 }
    );
  }, [lessons]);

  const sorted = useMemo(() => {
    const withDerived = lessons.map((l) => ({ l, skipRate: skipRate(l), understandRate: understandRate(l) }));
    withDerived.sort((a, b) => {
      const val = (x: typeof a) => {
        switch (sortKey) {
          case "opened":
            return x.l.opened;
          case "understood":
            return x.understandRate;
          case "skipRate":
            return x.skipRate;
          case "questions":
            return x.l.questionsSubmitted;
          case "struggling":
            return x.l.struggleDetected;
          case "explain":
            return x.l.helpOptionCounts.explain_simpler;
          case "example":
            return x.l.helpOptionCounts.example;
          case "apply":
            return x.l.helpOptionCounts.apply;
          default:
            return 0;
        }
      };
      return sortDesc ? val(b) - val(a) : val(a) - val(b);
    });
    return withDerived;
  }, [lessons, sortKey, sortDesc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const th = (label: string, key: SortKey) => (
    <th
      className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted-foreground hover:text-foreground"
      onClick={() => toggleSort(key)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === key && <ArrowUpDown className="h-3 w-3" />}
      </span>
    </th>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      <div className="mb-4">
        <Link href="/dashboard/academy/admin" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit">
          <ArrowLeft className="h-4 w-4" /> Back to Academy admin
        </Link>
      </div>

      <h1 className="mb-1 text-xl font-semibold text-foreground">Understanding Check analytics</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Built from existing checkpoint events — no additional tracking. Click a column to sort.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Opened" value={totals.opened} />
        <StatCard
          label="Understood"
          value={`${totals.opened > 0 ? Math.round((totals.understood / totals.opened) * 100) : 0}%`}
          sub={`${totals.understood} confirmed`}
        />
        <StatCard
          label="Skipped"
          value={`${totals.opened > 0 ? Math.round((totals.skipped / totals.opened) * 100) : 0}%`}
          sub={`${totals.skipped} skipped`}
        />
        <StatCard label="Questions asked" value={totals.questions} />
      </div>

      {lessons.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          No Understanding Check activity yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Lesson</th>
                {th("Opened", "opened")}
                {th("Understood", "understood")}
                {th("Skip rate", "skipRate")}
                {th("Questions", "questions")}
                {th("Struggling", "struggling")}
                {th("Explain simpler", "explain")}
                {th("Example", "example")}
                {th("Apply", "apply")}
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ l, skipRate: sr, understandRate: ur }) => (
                <tr key={l.lessonId} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <p className="font-medium text-foreground">{l.lessonTitle}</p>
                    <p className="text-xs text-muted-foreground">{l.courseTitle}</p>
                  </td>
                  <td className="px-3 py-2">{l.opened}</td>
                  <td className="px-3 py-2">{Math.round(ur * 100)}%</td>
                  <td className={`px-3 py-2 ${sr > 0.4 ? "text-red-600 dark:text-red-400 font-medium" : ""}`}>
                    {Math.round(sr * 100)}%
                  </td>
                  <td className="px-3 py-2">{l.questionsSubmitted}</td>
                  <td className={`px-3 py-2 ${l.struggleDetected > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : ""}`}>
                    {l.struggleDetected}
                  </td>
                  <td className="px-3 py-2">{l.helpOptionCounts.explain_simpler}</td>
                  <td className="px-3 py-2">{l.helpOptionCounts.example}</td>
                  <td className="px-3 py-2">{l.helpOptionCounts.apply}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
