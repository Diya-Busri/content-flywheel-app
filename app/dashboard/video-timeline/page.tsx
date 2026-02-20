import type { Metadata } from "next";
import VideoTimelineFlow from "./VideoTimelineFlow";

export const metadata: Metadata = {
  title: "Video Timeline | Content Flywheel",
  description: "Arrange video and audio clips in order and preview the sequence",
};

export default function VideoTimelinePage() {
  return <VideoTimelineFlow />;
}
