/**
 * Discovery Step 6–8: Product creation, generation loading, and review/edit
 */
import type { Metadata } from "next";
import DiscoverCreateFlow from "./DiscoverCreateFlow";

export const metadata: Metadata = {
  title: "Create product | Discovery | Content Flywheel",
  description: "Choose format and generate your digital product",
};

export default function DiscoverCreatePage() {
  return <DiscoverCreateFlow />;
}
