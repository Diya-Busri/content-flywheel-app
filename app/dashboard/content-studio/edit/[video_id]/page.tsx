import type { Metadata } from "next";
import { redirect } from "next/navigation";

type Props = { params: Promise<{ video_id: string }> };

export const metadata: Metadata = {
  title: "Edit Video | Content Studio",
  description: "Edit your Content Studio video",
};

/**
 * Placeholder: redirect to video timeline with this project id when timeline editor is ready.
 * For now we show a simple "Edit" placeholder so links from the library don't 404.
 */
export default async function ContentStudioEditVideoPage({ params }: Props) {
  const { video_id } = await params;
  if (!video_id) redirect("/dashboard/content-studio/library");

  // TODO: Load video, then either render editor or redirect to /dashboard/video-timeline?projectId=...
  redirect(`/dashboard/video-timeline?projectId=${encodeURIComponent(video_id)}`);
}
