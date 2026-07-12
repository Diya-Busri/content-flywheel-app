"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SuggestedGoals } from "./SuggestedGoals";

export function GoalInput({
  onSubmit,
  pending,
  error,
}: {
  onSubmit: (goal: string) => void;
  pending: boolean;
  error: string | null;
}) {
  const [goal, setGoal] = useState("");

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = goal.trim();
    if (!trimmed || pending) return;
    onSubmit(trimmed);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-4 py-10 sm:py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500 text-white shadow-sm">
          <Sparkles className="h-5 w-5" />
        </span>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
          What would you like Jarvis to accomplish?
        </h1>
        <p className="max-w-md text-sm text-gray-500 dark:text-gray-400">
          Jarvis reads your business profile, products, and memory, builds a plan, and generates content for your
          review — nothing gets saved or published without your approval.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full">
        <div className="relative">
          <Textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) handleSubmit(e);
            }}
            placeholder="e.g. Content Flywheel needs more sales. Create content for this week."
            disabled={pending}
            rows={3}
            className="min-h-[100px] resize-none rounded-xl border-gray-200 bg-white p-4 text-base shadow-sm focus-visible:ring-orange-400 dark:border-gray-800 dark:bg-[#141414]"
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">Shift + Enter for a new line</p>
          <Button
            type="submit"
            disabled={pending || goal.trim().length === 0}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {pending ? "Starting…" : "Start"}
          </Button>
        </div>
      </form>

      {error && (
        <div className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="w-full">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Suggested goals</p>
        <SuggestedGoals onPick={(g) => setGoal(g)} disabled={pending} />
      </div>
    </div>
  );
}
