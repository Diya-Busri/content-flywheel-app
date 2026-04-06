"use client";

import { useSearchParams } from "next/navigation";
import ContentCalendarClient from "./ContentCalendarClient";

export default function ContentCalendarPage() {
  const searchParams = useSearchParams();
  const scheduleVideoId = searchParams.get("schedule");
  const ideaTitle = searchParams.get("ideaTitle");
  const ideaHook = searchParams.get("ideaHook");

  return (
    <ContentCalendarClient
      scheduleVideoId={scheduleVideoId}
      ideaTitle={ideaTitle}
      ideaHook={ideaHook}
    />
  );
}
