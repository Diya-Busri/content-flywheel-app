"use client";

import { useSearchParams } from "next/navigation";
import VideoTimelineFlow from "./VideoTimelineFlow";

export default function VideoTimelinePage() {
  const searchParams = useSearchParams();
  const initialScriptId = searchParams.get("scriptId") ?? searchParams.get("libraryScriptId");
  return <VideoTimelineFlow initialScriptId={initialScriptId} />;
}
