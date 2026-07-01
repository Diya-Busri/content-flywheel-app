import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

export type MarketingAssets = {
  productTitle?: string;
  productDescription?: string;
  hashtags?: string[];
  seoKeywords?: string[];
  thumbnailUrl?: string | null;
  /** Cover page thumbnail for library cards (generated on save). */
  coverThumbnailUrl?: string | null;
  /** Realistic book-on-desk mockup image generated via DALL-E 3. */
  bookMockupUrl?: string | null;
  /** HeyGen avatar promo video URL (9:16 vertical, expires in 7 days unless persisted). */
  promoVideoUrl?: string | null;
  /** In-progress HeyGen video_id being polled. */
  promoVideoId?: string | null;
  /** "processing" | "completed" | "failed" */
  promoVideoStatus?: string | null;
  /** "falai" | "did" | "heygen" */
  promoVideoProvider?: string | null;
  /** Creator's checkout / purchase URL (Gumroad, Beacons, Stripe, etc.) shown on the public sales page. */
  checkoutUrl?: string | null;
  /** Display price shown on the public sales page (e.g. "$27", "£15", "Free"). */
  priceLabel?: string | null;
  /** Vercel Blob URL of the uploaded product file (PDF, ZIP, etc.) — for manually-uploaded products. */
  uploadedFileUrl?: string | null;
  /** Original filename of the uploaded product file. */
  uploadedFileName?: string | null;
  /** Whether this product is published via the native Content Flywheel store. */
  isNativePublished?: boolean;
  /** Native store price in pence (e.g. 1500 = £15.00). */
  nativePrice?: number;
  /** Stripe product ID for the native store listing. */
  stripeProductId?: string;
  /** Stripe price ID for the native store listing. */
  stripePriceId?: string;
  /** Testimonials for the public sales page. */
  testimonials?: Array<{ name: string; text: string; rating?: number }>;
  /** Whether this product is coming soon (shows waitlist instead of buy button). */
  comingSoon?: boolean;
  /** ISO date string — if set, the product closes after this date (auto-unpublished). */
  saleEndsAt?: string | null;
  /** Supabase URL of a captured content page screenshot shown as a teaser on the store. */
  previewPageUrl?: string | null;
  /** Custom thank-you message shown to the buyer after purchase. */
  thankYouMessage?: string | null;
  /** Optional bonus URL (e.g. Discord invite) shown after purchase. */
  thankYouBonusUrl?: string | null;
  updatedAt?: string;
};

export const productsTable = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  niche: text("niche").notNull(),
  format: text("format").notNull(),
  content: jsonb("content").$type<{ sections: Array<{ id: string; title: string; content: string; order: number; imageUrl?: string }> }>().notNull(),
  designSettings: jsonb("design_settings").$type<Record<string, unknown>>(),
  placedElements: jsonb("placed_elements").$type<unknown[]>(),
  /** Discovery customization (chapters, length, tone, format-specific options). Null for existing products before migration. */
  customizationOptions: jsonb("customization_options").$type<Record<string, unknown> | null>(),
  /** Marketing assets for marketplaces (Etsy, Gumroad, etc.): title, description, hashtags, seoKeywords, thumbnailUrl. */
  marketingAssets: jsonb("marketing_assets").$type<MarketingAssets | null>(),
  status: text("status").default("draft").notNull(),
  /** When status is "failed", store the error message for logging and display. */
  generationError: text("generation_error"),
  /** Granular generation state: 'pending' | 'generating' | 'complete' | 'failed' | 'partial'. */
  generationStatus: text("generation_status"),
  /** When set, this product belongs to a bundle (same bundleId = same bundle). */
  bundleId: uuid("bundle_id"),
  /** When 'ai' or 'brand', product was auto-designed; show "AI Designed" badge in library. Null = manual/blank. */
  designSource: text("design_source").$type<"ai" | "brand" | null>(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
