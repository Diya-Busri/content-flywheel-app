import { MetadataRoute } from "next";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { isNull, and, inArray } from "drizzle-orm";
import type { MarketingAssets } from "@/db/schema/products-schema";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://contentflywheel.co.uk";

const STATIC_PAGES: MetadataRoute.Sitemap = [
  { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
  { url: `${BASE_URL}/marketplace`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
  { url: `${BASE_URL}/apply`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${BASE_URL}/sign-up`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.6 },
  { url: `${BASE_URL}/sign-in`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.5 },
  { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  { url: `${BASE_URL}/refund-policy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
  { url: `${BASE_URL}/faceless`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${BASE_URL}/blog/faceless-creator`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch all non-deleted products with their creator's deletion status
  let productRows: { id: string; updatedAt: Date; marketingAssets: MarketingAssets | null; userId: string }[] = [];
  let activeSellerIds: Set<string> = new Set();
  try {
    const [products, activeProfiles] = await Promise.all([
      db
        .select({
          id: productsTable.id,
          updatedAt: productsTable.updatedAt,
          marketingAssets: productsTable.marketingAssets,
          userId: productsTable.userId,
        })
        .from(productsTable)
        .where(isNull(productsTable.deletedAt)),
      db
        .select({ userId: profilesTable.userId })
        .from(profilesTable)
        .where(isNull(profilesTable.deletedAt)),
    ]);
    productRows = products;
    activeSellerIds = new Set(activeProfiles.map((p) => p.userId));
  } catch {
    // If DB is unavailable during build, return static pages only
    return STATIC_PAGES;
  }

  // Filter to published products from non-deleted creators only
  const publishedProducts = productRows.filter((p) => {
    const ma = p.marketingAssets ?? {};
    return ma.isNativePublished === true && !ma.comingSoon && activeSellerIds.has(p.userId);
  });

  const productEntries: MetadataRoute.Sitemap = publishedProducts.map((p) => ({
    url: `${BASE_URL}/product/${p.id}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...STATIC_PAGES, ...productEntries];
}
