/**
 * Shared types for avatar video providers.
 * Providers: heygen | falai | did
 *
 * Auto-detection order (checks env vars):
 *   1. AVATAR_VIDEO_PROVIDER (explicit override)
 *   2. FAL_API_KEY → "falai"  (cheapest, already installed)
 *   3. DID_API_KEY → "did"    (good quality, ~$0.10/video)
 *   4. HEYGEN_API_KEY → "heygen" (highest quality, most expensive)
 */

export type AvatarVideoProvider = "heygen" | "falai" | "did";

export type StartVideoResult = {
  /** Provider-specific job ID to pass back to the status endpoint */
  jobId: string;
  /** Which provider started this job */
  provider: AvatarVideoProvider;
  /** Script that was used (auto-generated or user-provided) */
  script: string;
};

export type VideoStatusResult =
  | { status: "processing" }
  | { status: "completed"; videoUrl: string }
  | { status: "failed"; error: string };

export type ProviderOptions = {
  script: string;
  /** Face image URL (required for falai, optional for did/heygen) */
  faceImageUrl?: string;
  /** Avatar ID (HeyGen-specific) */
  avatarId?: string;
  /** Voice ID (HeyGen/D-ID specific) or OpenAI TTS voice (falai) */
  voiceId?: string;
  backgroundPreset?: string;
};

/**
 * Detect which provider to use based on available env vars.
 */
export function detectProvider(): AvatarVideoProvider {
  const explicit = process.env.AVATAR_VIDEO_PROVIDER?.trim().toLowerCase();
  if (explicit === "heygen" || explicit === "falai" || explicit === "did") {
    return explicit as AvatarVideoProvider;
  }
  if (process.env.FAL_API_KEY?.trim()) return "falai";
  if (process.env.DID_API_KEY?.trim()) return "did";
  if (process.env.HEYGEN_API_KEY?.trim()) return "heygen";
  return "falai"; // default to cheapest
}
