/**
 * Digital Products - Guided discovery wizard (Path B: Help Me Discover)
 */
import { Suspense } from "react";
import type { Metadata } from "next";
import DiscoverPageClient from "./DiscoverPageClient";

export const metadata: Metadata = {
  title: "Discover | Digital Products | Content Flywheel",
  description: "Find your niche and product idea with our guided discovery",
};

export default function DigitalProductsDiscoverPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="text-center text-[#A0A0A0]">Loading discover...</div>
      </div>
    }>
      <DiscoverPageClient />
    </Suspense>
  );
}
