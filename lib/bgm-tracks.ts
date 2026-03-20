/**
 * Client-safe background music catalog (no fs/path). Server resolves files in lib/bgm-tracks.server.ts.
 */

/** Bed level under voiceover (~18%) */
export const BGM_MIX_VOLUME = 0.18;

export type BgmTrackId = "dramatic" | "romantic" | "tense" | "upbeat";
export type BgmSelectValue = BgmTrackId | "none";

export type BgmTrackDefinition = {
  id: BgmSelectValue;
  label: string;
  /** MP3 under public/bgm/, or null for "No music" */
  filename: string | null;
};

export const BGM_TRACKS: readonly BgmTrackDefinition[] = [
  { id: "none", label: "No Music", filename: null },
  { id: "dramatic", label: "Dramatic", filename: "dramatic.mp3" },
  { id: "romantic", label: "Romantic", filename: "romantic.mp3" },
  { id: "tense", label: "Tense", filename: "tense.mp3" },
  { id: "upbeat", label: "Upbeat", filename: "upbeat.mp3" },
] as const;

export const BGM_SELECT_OPTIONS: { value: BgmSelectValue; label: string }[] = BGM_TRACKS.map((t) => ({
  value: t.id,
  label: t.label,
}));

export const BGM_TRACK_IDS: BgmTrackId[] = BGM_TRACKS.slice(1).map((t) => t.id as BgmTrackId);

/** Allowed JSON body values for `backgroundMusic` */
export const BGM_REQUEST_VALUES = new Set<string>(BGM_TRACKS.map((t) => t.id));
