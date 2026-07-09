/**
 * Redirect /dashboard/my-videos to My Library (products, videos, and scripts in one place).
 */
import { redirect } from "next/navigation";

export default function MyVideosPage() {
  redirect("/dashboard/library");
}
