/**
 * UGC Lab — Template definitions for Face Swap and video generation.
 */

export type TemplateEnergy = "soft" | "hype" | "aesthetic";

export type UGCTemplate = {
  id: string;
  name: string;
  energy: TemplateEnergy;
  duration: number; // seconds
  requiresFaceSwap: boolean;
  previewThumbnail: string; // URL or path
};

export const UGC_TEMPLATES: UGCTemplate[] = [
  {
    id: "selfie-talk",
    name: "Selfie Talk",
    energy: "hype",
    duration: 30,
    requiresFaceSwap: true,
    previewThumbnail: "/templates/selfie-talk.jpg",
  },
  {
    id: "unboxing",
    name: "Unboxing",
    energy: "hype",
    duration: 45,
    requiresFaceSwap: true,
    previewThumbnail: "/templates/unboxing.jpg",
  },
  {
    id: "testimonial",
    name: "Testimonial",
    energy: "soft",
    duration: 30,
    requiresFaceSwap: true,
    previewThumbnail: "/templates/testimonial.jpg",
  },
  {
    id: "reaction",
    name: "Reaction",
    energy: "hype",
    duration: 20,
    requiresFaceSwap: true,
    previewThumbnail: "/templates/reaction.jpg",
  },
  {
    id: "aesthetic-vibe",
    name: "Aesthetic Vibe",
    energy: "aesthetic",
    duration: 25,
    requiresFaceSwap: true,
    previewThumbnail: "/templates/aesthetic-vibe.jpg",
  },
];
