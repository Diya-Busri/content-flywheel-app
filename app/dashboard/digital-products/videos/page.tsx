/**
 * Digital Products - Step 3: Customize Your Videos
 */
import type { Metadata } from "next";
import VideosFlow from "./VideosFlow";

export const metadata: Metadata = {
  title: "Customize Videos | Digital Products | Content Flywheel",
  description: "Choose video style, voice, and platform options before generating",
};

export default function DigitalProductsVideosPage() {
  return <VideosFlow />;
}
