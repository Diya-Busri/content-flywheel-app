/**
 * Digital Products - Guided discovery wizard (Path B: Help Me Discover)
 */
import type { Metadata } from "next";
import dynamic from "next/dynamic";

export const metadata: Metadata = {
  title: "Discover | Digital Products | Content Flywheel",
  description: "Find your niche and product idea with our guided discovery",
};

const DiscoverFlow = dynamic(() => import("./DiscoverFlow"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="text-center text-[#A0A0A0]">Loading discover...</div>
    </div>
  ),
});

export default function DigitalProductsDiscoverPage() {
  return <DiscoverFlow />;
}
