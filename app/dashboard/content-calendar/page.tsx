"use client";

import { useSearchParams } from "next/navigation";
import { FeaturePreviewGate } from "@/components/feature-preview-gate";
import ContentCalendarClient from "./ContentCalendarClient";

export default function ContentCalendarPage() {
  const searchParams = useSearchParams();
  const scheduleVideoId = searchParams.get("schedule");
  const ideaTitle = searchParams.get("ideaTitle");
  const ideaHook = searchParams.get("ideaHook");

  return (
    <FeaturePreviewGate title="Content Calendar">
      {/* Original placeholder (commented out for restore):
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Content Calendar</h1>
        <p className="text-gray-600 dark:text-gray-400">Calendar scheduling feature coming soon...</p>
      </div>
      */}
      <ContentCalendarClient
        scheduleVideoId={scheduleVideoId}
        ideaTitle={ideaTitle}
        ideaHook={ideaHook}
      />
    </FeaturePreviewGate>
  );
}
