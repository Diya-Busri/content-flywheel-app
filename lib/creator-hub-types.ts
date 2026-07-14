/**
 * Client-safe Creator Hub types and constants — no database imports.
 * Anything imported by client components (e.g. CreatorHubBlocksClient) must
 * live here, not in lib/creator-hub.ts, which pulls in `db` (Node-only
 * `postgres` client — breaks the browser bundle if imported client-side).
 */

export type SectionType =
  | "featured_product"
  | "products"
  | "social_links"
  | "featured_content"
  | "newsletter"
  | "currently_building"
  | "custom";

export const SECTION_LABELS: Record<SectionType, string> = {
  featured_product: "Featured Product",
  products: "Store (Products)",
  social_links: "Social Links",
  featured_content: "Featured Content",
  newsletter: "Newsletter Signup",
  currently_building: "Currently Building",
  custom: "Custom Section",
};

export type FeaturedProductConfig = { productId: string | null };
export type FeaturedContentItem = { id: string; platform: "youtube" | "tiktok" | "instagram"; url: string; title?: string };
export type FeaturedContentConfig = { items: FeaturedContentItem[] };
export type NewsletterConfig = { headline?: string; subtext?: string };
export type CurrentlyBuildingConfig = { text: string };
export type CustomConfig = { title: string; body: string; links: { label: string; url: string }[] };
