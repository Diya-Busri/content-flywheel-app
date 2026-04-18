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
    id: "pack_1",
    credits: 1,
    priceGbp: 1.49,
    priceStripe: 149,
    label: "Taster",
  },
  {
    id: "pack_5",
    credits: 5,
    priceGbp: 5.99,
    priceStripe: 599,
    label: "Starter",
    saving: "Save 20%",
  },
  {
    id: "pack_15",
    credits: 15,
    priceGbp: 15.99,
    priceStripe: 1599,
    label: "Creator",
    popular: true,
    saving: "Save 29%",
  },
  {
    id: "pack_30",
    credits: 30,
    priceGbp: 26.99,
    priceStripe: 2699,
    label: "Pro",
    saving: "Save 40%",
  },
  {
    id: "pack_50",
    credits: 50,
    priceGbp: 39.99,
    priceStripe: 3999,
    label: "Studio",
    saving: "Save 46%",
  },
  {
    id: "pack_100",
    credits: 100,
    priceGbp: 69.99,
    priceStripe: 6999,
    label: "Agency",
    saving: "Save 53%",
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
