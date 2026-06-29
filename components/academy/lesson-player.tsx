"use client";

import { youTubeEmbedUrl } from "@/lib/academy";

export function LessonPlayer({ videoUrl }: { videoUrl: string | null | undefined }) {
  const embed = youTubeEmbedUrl(videoUrl);
  if (!embed) return null;
  return (
    <iframe
      src={embed}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      className="w-full aspect-video rounded-lg border bg-black"
      title="Lesson video"
    />
  );
}
