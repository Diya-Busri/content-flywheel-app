/**
 * Content Studio - Two-path onboarding landing (same pattern as Digital Products)
 * Gated by FEATURE_PREVIEW_PASSWORD; access stored in localStorage as feature_preview_access.
 */
import type { Metadata } from "next";
import { FeaturePreviewGate } from "@/components/feature-preview-gate";
import ContentStudioLanding from "./ContentStudioLanding";

export const metadata: Metadata = {
  title: "Content Studio | Content Flywheel",
  description: "Create your video: start with an idea or discover your niche with AI guidance",
};

export default function ContentStudioPage() {
  return (
    <FeaturePreviewGate title="Content Studio">
      <ContentStudioLanding />
    </FeaturePreviewGate>
  );
}
