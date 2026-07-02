import type { Metadata } from "next";
import { Suspense } from "react";
import MarketplaceClient from "./MarketplaceClient";

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

export default function MarketplacePage() {
  return (
    <Suspense fallback={<div style={{ padding: "80px", textAlign: "center", color: "#9ca3af" }}>Loading…</div>}>
      <MarketplaceClient />
    </Suspense>
  );
}
