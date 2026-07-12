"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageCircle, ListChecks, Loader2 } from "lucide-react";
import AICoachPageClient from "./AICoachPageClient";
import { TaskModeClient } from "@/components/coach/task-mode/TaskModeClient";

type Mode = "chat" | "tasks";

/**
 * Top-level switcher for AI Coach: Chat Mode (existing coaching chat,
 * AICoachPageClient — completely unchanged) vs Task Mode (the former
 * standalone /jarvis execution engine, now embedded here as
 * TaskModeClient). Mode is tracked in the URL (?mode=tasks) so it survives
 * refresh and can be deep-linked/shared.
 */
function ModeSwitcherContent({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode: Mode = searchParams.get("mode") === "tasks" ? "tasks" : "chat";

  const setMode = useCallback(
    (next: Mode) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "chat") {
        // Leaving Task Mode — drop both the mode flag and any active run id
        // so switching back to Chat never carries stale task state in the URL.
        params.delete("mode");
        params.delete("run");
      } else {
        params.set("mode", "tasks");
      }
      const qs = params.toString();
      router.replace(qs ? `/dashboard/ai-coach?${qs}` : "/dashboard/ai-coach", { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-1 border-b border-gray-200 bg-white px-3 pt-2 dark:border-gray-800 dark:bg-[#0F0F0F]">
        <button
          type="button"
          onClick={() => setMode("chat")}
          className={`flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            mode === "chat"
              ? "border-orange-500 text-orange-600 dark:text-orange-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          <MessageCircle className="h-4 w-4" />
          Chat
        </button>
        <button
          type="button"
          onClick={() => setMode("tasks")}
          className={`flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            mode === "tasks"
              ? "border-orange-500 text-orange-600 dark:text-orange-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          <ListChecks className="h-4 w-4" />
          Tasks
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {mode === "chat" ? <AICoachPageClient isAdmin={isAdmin} /> : <TaskModeClient />}
      </div>
    </div>
  );
}

export default function AICoachModeSwitcher({ isAdmin }: { isAdmin: boolean }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-0 items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
        </div>
      }
    >
      <ModeSwitcherContent isAdmin={isAdmin} />
    </Suspense>
  );
}
