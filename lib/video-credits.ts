/**
 * Video Credits System
 *
 * New users get 100 free credits on signup.
 * Users buy additional credit packs via Stripe (one-time payment).
 * Credits never expire.
 *
 * Credit costs per action:
 *   Videos (Brand Story, Cooking, TikTok Shop) → 10 credits (~£0.30 API cost)
 *   UGC avatar video (Higgsfield)              → 20 credits (~£0.24 API cost)
 *   AI Design (image generation)               → 10 credits (~£0.03–0.05 API cost)
 *
 * Pricing gives ~2–3× margin over API costs.
 */

export const FREE_SIGNUP_CREDITS = 100;

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
    credits: 10,
    priceGbp: 1.49,
    priceStripe: 149,
    label: "Taster",
  },
  {
    id: "pack_5",
    credits: 50,
    priceGbp: 5.99,
    priceStripe: 599,
    label: "Starter",
    saving: "Save 20%",
  },
  {
    id: "pack_15",
    credits: 150,
    priceGbp: 15.99,
    priceStripe: 1599,
    label: "Creator",
    popular: true,
    saving: "Save 29%",
  },
  {
    id: "pack_30",
    credits: 300,
    priceGbp: 26.99,
    priceStripe: 2699,
    label: "Pro",
    saving: "Save 40%",
  },
  {
    id: "pack_50",
    credits: 500,
    priceGbp: 39.99,
    priceStripe: 3999,
    label: "Studio",
    saving: "Save 46%",
  },
  {
    id: "pack_100",
    credits: 1000,
    priceGbp: 69.99,
    priceStripe: 6999,
    label: "Agency",
    saving: "Save 53%",
  },
];

/** Cost in credits per generation type. 10 credits ≈ 1 standard video. */
export const VIDEO_CREDIT_COST = {
  brandStoryVideo: 10,
  cookingVideo: 10,
  avatarVideo: 20,   // Higgsfield UGC — most expensive API
  aiDesign: 10,
} as const;

export type VideoType = keyof typeof VIDEO_CREDIT_COST;

/** Stripe metadata key used to identify video credit purchases in the webhook */
export const VIDEO_CREDITS_METADATA_KEY = "video_credits_purchase";
