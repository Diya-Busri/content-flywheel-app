/**
 * Video Credits System
 *
 * Users buy credit packs via Stripe (one-time payment).
 * Each video generation costs 1 credit.
 * Credits never expire.
 *
 * Pricing is set to give ~2-3x margin over fal.ai / DALL-E / ElevenLabs costs.
 * e.g. a full brand story video (8 scenes + voiceover) costs ~£0.30 in API fees.
 * We charge £1/video → healthy margin.
 */

export type VideoCreditPack = {
  id: string;
  credits: number;
  priceGbp: number;       // what we charge (£)
  priceStripe: number;    // in pence (for Stripe API)
  label: string;
  popular?: boolean;
  saving?: string;        // e.g. "Save 20%"
};

export const VIDEO_CREDIT_PACKS: VideoCreditPack[] = [
  {
    id: "pack_5",
    credits: 5,
    priceGbp: 4.99,
    priceStripe: 499,
    label: "Starter",
  },
  {
    id: "pack_15",
    credits: 15,
    priceGbp: 12.99,
    priceStripe: 1299,
    label: "Creator",
    popular: true,
    saving: "Save 13%",
  },
  {
    id: "pack_30",
    credits: 30,
    priceGbp: 22.99,
    priceStripe: 2299,
    label: "Pro",
    saving: "Save 23%",
  },
  {
    id: "pack_50",
    credits: 50,
    priceGbp: 34.99,
    priceStripe: 3499,
    label: "Studio",
    saving: "Save 30%",
  },
];

/** Cost in credits per video type */
export const VIDEO_CREDIT_COST = {
  brandStoryVideo: 1,
  cookingVideo: 1,
  avatarVideo: 1,
  aiDesign: 1,
} as const;

export type VideoType = keyof typeof VIDEO_CREDIT_COST;

/** Stripe metadata key used to identify video credit purchases in the webhook */
export const VIDEO_CREDITS_METADATA_KEY = "video_credits_purchase";
