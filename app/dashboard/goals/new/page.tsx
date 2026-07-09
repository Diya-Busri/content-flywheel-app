/**
 * New Goal - Create a goal (placeholder for now)
 */
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "New Goal | Content Flywheel",
  description: "Create a new goal",
};

export default function NewGoalPage() {
  return (
    <main className="p-6 md:p-10 max-w-2xl mx-auto">
      <Link
        href="/dashboard/goals"
        className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-orange-500 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Goal Tracker
      </Link>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
        New Goal
      </h1>
      <p className="text-slate-600 dark:text-slate-400">
        Goal creation form coming soon.
      </p>
    </main>
  );
}
