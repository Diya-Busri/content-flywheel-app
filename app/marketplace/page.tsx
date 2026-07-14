import type { Metadata } from "next";
import { Suspense } from "react";
import MarketplaceClient from "./MarketplaceClient";
import { isAdmin } from "@/lib/is-admin";
import { isFeatureEnabledForVisitors } from "@/lib/feature-flags";

const SITE_URL = "https://contentflywheel.co.uk";

export const metadata: Metadata = {
  title: "Digital Product Marketplace | Content Flywheel",
  description: "Discover templates, guides, courses, and more from independent creators. Buy and sell digital products on Content Flywheel.",
  keywords: ["digital products", "templates", "online courses", "guides", "ebooks", "creator marketplace", "content flywheel"],
  openGraph: {
    title: "Digital Product Marketplace | Content Flywheel",
    description: "Discover templates, guides, courses, and more from independent creators.",
    url: `${SITE_URL}/marketplace`,
    siteName: "Content Flywheel",
    type: "website",
    images: [
      {
        url: `${SITE_URL}/og-marketplace.png`,
        width: 1200,
        height: 630,
        alt: "Content Flywheel Marketplace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Digital Product Marketplace | Content Flywheel",
    description: "Discover templates, guides, courses, and more from independent creators.",
    images: [`${SITE_URL}/og-marketplace.png`],
  },
  alternates: {
    canonical: `${SITE_URL}/marketplace`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function MarketplacePage() {
  const [admin, marketplaceEnabled] = await Promise.all([
    isAdmin(),
    isFeatureEnabledForVisitors("marketplace"),
  ]);

  if (!marketplaceEnabled) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "80px 24px" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🛍️</div>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#111827", marginBottom: "8px" }}>Marketplace unavailable</h1>
        <p style={{ fontSize: "14px", color: "#6b7280", maxWidth: "360px" }}>
          The marketplace isn&apos;t available right now. Check back soon.
        </p>
      </div>
    );
  }

  return (
    <Suspense fallback={<div style={{ padding: "80px", textAlign: "center", color: "#9ca3af" }}>Loading…</div>}>
      <MarketplaceClient isAdmin={admin} />
    </Suspense>
  );
}
