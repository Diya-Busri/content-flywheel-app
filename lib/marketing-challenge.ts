/**
 * Data layer for the "100 Product Challenge" homepage sections.
 *
 * Nothing here is fabricated social proof — until real submissions come in,
 * the seed data below models an honest "coming soon" first episode. Every
 * getter is already async so swapping the body for a real DB query later
 * (e.g. a `challenge_episodes` table) requires no changes in consumers.
 */

export type EpisodeStatus = "live" | "coming_soon" | "complete";

export type MarketingAssetType =
  | "research"
  | "hooks"
  | "carousel"
  | "video_script"
  | "email"
  | "launch_plan"
  | "published"
  | "analytics";

export interface MarketingAsset {
  type: MarketingAssetType;
  label: string;
  done: boolean;
}

export interface CreatorStat {
  label: string;
  value: string;
}

export interface ChallengeEpisode {
  episodeNumber: number;
  totalEpisodes: number;
  creatorName: string;
  /** Emoji or image URL. */
  creatorAvatar: string;
  productName: string;
  /** Emoji or image URL. */
  productImage: string;
  storeUrl: string | null;
  status: EpisodeStatus;
  generatedAssets: MarketingAsset[];
  /** ISO date string, null until the episode actually airs. */
  featuredAt: string | null;
  /** Optional creator/store stats (sales, reach, followers gained, etc.) once available. */
  stats?: CreatorStat[];
}

/** The 8-step generation pipeline shown by <MarketingTimeline />. */
export const ASSET_PIPELINE: { type: MarketingAssetType; label: string }[] = [
  { type: "research", label: "Research" },
  { type: "hooks", label: "Hooks" },
  { type: "carousel", label: "Carousels" },
  { type: "video_script", label: "Video Scripts" },
  { type: "email", label: "Emails" },
  { type: "launch_plan", label: "Launch Calendar" },
  { type: "published", label: "Published" },
  { type: "analytics", label: "Analytics" },
];

export function emptyPipeline(): MarketingAsset[] {
  return ASSET_PIPELINE.map((a) => ({ ...a, done: false }));
}

// TODO(challenge-backend): replace with a real query once creator
// submissions exist, e.g. `db.select().from(challengeEpisodesTable)...`
const SEED_EPISODES: ChallengeEpisode[] = [
  {
    episodeNumber: 1,
    totalEpisodes: 100,
    creatorName: "Applications open",
    creatorAvatar: "🎬",
    productName: "This slot is yours to claim",
    productImage: "✨",
    storeUrl: null,
    status: "coming_soon",
    generatedAssets: emptyPipeline(),
    featuredAt: null,
  },
];

export async function getChallengeEpisodes(): Promise<ChallengeEpisode[]> {
  return SEED_EPISODES;
}

export async function getFeaturedEpisode(): Promise<ChallengeEpisode | null> {
  const episodes = await getChallengeEpisodes();
  return episodes.find((e) => e.status === "live") ?? episodes[0] ?? null;
}

export async function getPreviousEpisodes(): Promise<ChallengeEpisode[]> {
  const episodes = await getChallengeEpisodes();
  return episodes.filter((e) => e.status === "complete");
}

/** Next Monday 10:00 local time — the weekly reveal slot. Computed, never hardcoded. */
export function getNextFeatureDate(from: Date = new Date()): Date {
  const next = new Date(from);
  const day = next.getDay(); // 0 = Sunday
  let daysUntilMonday = (1 - day + 7) % 7;
  if (daysUntilMonday === 0) daysUntilMonday = 7; // if it's already Monday, roll to next week
  next.setDate(next.getDate() + daysUntilMonday);
  next.setHours(10, 0, 0, 0);
  return next;
}
