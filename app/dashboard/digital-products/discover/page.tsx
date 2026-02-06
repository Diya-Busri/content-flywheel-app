/**
 * Digital Products - Guided discovery wizard (Path B: Help Me Discover)
 */
import type { Metadata } from "next";
import DiscoverFlow from "./DiscoverFlow";

export const metadata: Metadata = {
  title: "Discover | Digital Products | Content Flywheel",
  description: "Find your niche and product idea with our guided discovery",
};

export default function DigitalProductsDiscoverPage() {
  return <DiscoverFlow />;
}
