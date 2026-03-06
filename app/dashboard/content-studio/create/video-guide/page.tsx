import { redirect } from "next/navigation";

/**
 * Redirect old Content Studio video-guide URL to the actual page.
 * The video guide lives at /dashboard/digital-products/video-guide.
 */
export default function ContentStudioVideoGuideRedirect() {
  redirect("/dashboard/digital-products/video-guide?source=content-studio");
}
