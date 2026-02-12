/**
 * Redirect /dashboard/my-videos to unified library (Videos tab lives in My Library).
 */
import { redirect } from "next/navigation";

export default function MyVideosPage() {
  redirect("/dashboard/library");
}
