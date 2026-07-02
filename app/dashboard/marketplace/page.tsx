import { Suspense } from "react";
import MarketplaceClient from "@/app/marketplace/MarketplaceClient";
import MarketplaceFeaturePanel from "./MarketplaceFeaturePanel";
import EmbedCodePanel from "./EmbedCodePanel";

export const metadata = {
  title: "Marketplace | Content Flywheel",
  description: "Browse digital products from independent creators — templates, guides, courses, and more.",
};

export default function DashboardMarketplacePage() {
  return (
    <>
      <MarketplaceFeaturePanel />
      <EmbedCodePanel />
      <Suspense fallback={<div style={{ padding: "80px", textAlign: "center", color: "#9ca3af" }}>Loading…</div>}>
        <MarketplaceClient />
      </Suspense>
    </>
  );
}
